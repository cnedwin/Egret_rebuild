// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.network;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.ByteBuffer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;
import org.egret.runtime.player.ProjectHostServices;
import org.egret.runtime.player.ProjectHostServices.Reply;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONException;
import org.json.JSONObject;

/** One optional, origin-restricted transport per game session. Register this handler as network.request. */
public final class PlayerNetwork implements ProjectHostServices.Handler, AutoCloseable {
    public static final String ACTION = "network.request";
    private static final int BYTE_LIMIT = 32 * 1024;
    private static final int TIMEOUT_MS = 12000;
    private final Set<String> origins = new HashSet<>();
    private final Set<Socket> liveTransports = new HashSet<>();
    private final Set<HttpCall> requests = new HashSet<>();
    private final ThreadPoolExecutor http = new ThreadPoolExecutor(0, 4, 15, TimeUnit.SECONDS, new SynchronousQueue<>());
    private final ScheduledThreadPoolExecutor timers = new ScheduledThreadPoolExecutor(1);
    private Socket socket;
    private int lastId;
    private boolean closed;

    public PlayerNetwork(Collection<String> allowedOrigins) {
        for (String value : allowedOrigins) {
            URI uri = URI.create(value);
            String enabledOrigin = origin(uri);
            if ((!uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/")) || uri.getRawQuery() != null)
                throw new IllegalArgumentException("Expected a secure origin without a path or query");
            origins.add(enabledOrigin);
        }
        timers.setRemoveOnCancelPolicy(true);
        timers.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
    }

    private static String origin(URI uri) {
        String scheme = uri.getScheme();
        int port = uri.getPort();
        if (!("https".equals(scheme) || "wss".equals(scheme)) || uri.getHost() == null ||
            uri.getRawUserInfo() != null || uri.getRawFragment() != null || port == 0 || port > 65535 ||
            uri.getRawAuthority().endsWith(":")) throw new IllegalArgumentException("Expected a secure origin");
        return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT) + ":" + (port < 0 ? 443 : port);
    }

    private URI endpoint(String value, String scheme) {
        URI uri = URI.create(value);
        if (!scheme.equals(uri.getScheme()) || !origins.contains(origin(uri)))
            throw new IllegalArgumentException("Network origin is not enabled");
        return uri;
    }

    private static byte[] decode(String encoded) {
        if (encoded.length() > 4 * ((BYTE_LIMIT + 2) / 3)) throw new IllegalArgumentException("Payload exceeds limit");
        byte[] bytes = Base64.getDecoder().decode(encoded);
        if (bytes.length > BYTE_LIMIT) throw new IllegalArgumentException("Payload exceeds limit");
        return bytes;
    }

    private static String data(String prefix, byte[] bytes) {
        return prefix + Base64.getEncoder().encodeToString(bytes) + "\"}";
    }

    @Override public synchronized Runnable begin(String input, Reply reply) {
        if (closed) { reply.reject("NETWORK_SESSION_CLOSED"); return null; }
        try {
            JSONObject value = new JSONObject(input);
            String op = value.getString("op");
            if (op.equals("http")) {
                HttpCall request = new HttpCall(endpoint(value.getString("url"), "https"), value, reply);
                requests.add(request);
                try { request.work = http.submit(request); }
                catch (RejectedExecutionException busy) {
                    requests.remove(request);
                    reply.reject("NETWORK_BACKPRESSURE");
                    return null;
                }
                return request::cancel;
            }
            Object requestedId = value.get("id");
            if (!(requestedId instanceof Number)) throw new IllegalArgumentException();
            int id = ((Number) requestedId).intValue();
            if (id < 1 || id != ((Number) requestedId).doubleValue()) throw new IllegalArgumentException();
            if (op.equals("open")) {
                URI target = endpoint(value.getString("url"), "wss");
                if (id <= lastId || (socket != null && !socket.ended)) { reply.reject("NETWORK_SOCKET_BUSY"); return null; }
                if (liveTransports.size() >= 4) { reply.reject("NETWORK_BACKPRESSURE"); return null; }
                lastId = id;
                if (socket != null) socket.release("NETWORK_SOCKET_REPLACED");
                Socket next = new Socket(target, id, reply);
                socket = next;
                liveTransports.add(next);
                next.deadline = timers.schedule(() -> {
                    synchronized (PlayerNetwork.this) {
                        if (socket == next && next.opening != null) next.release("NETWORK_TIMEOUT");
                    }
                }, TIMEOUT_MS, TimeUnit.MILLISECONDS);
                next.connect();
                return () -> { synchronized (PlayerNetwork.this) { if (socket == next) next.release("NETWORK_CANCELED"); } };
            }
            if (op.equals("close")) {
                if (socket != null && socket.id == id) socket.release("NETWORK_SOCKET_CLOSED");
                reply.resolve("null");
                return null;
            }
            if (socket == null || socket.id != id) { reply.reject("NETWORK_STALE_SOCKET"); return null; }
            if (op.equals("receive")) return socket.receive(reply);
            if (op.equals("ack")) { socket.acknowledge(value.getLong("sequence"), reply); return null; }
            if (op.equals("send")) {
                if (socket.ended || !socket.isOpen()) reply.reject("NETWORK_SOCKET_CLOSED");
                else if (socket.hasBufferedData()) reply.reject("NETWORK_BACKPRESSURE");
                else {
                    socket.send(decode(value.getString("body")));
                    reply.resolve("null");
                }
                return null;
            }
            reply.reject("NETWORK_UNKNOWN_OPERATION");
        } catch (JSONException | IllegalArgumentException invalid) { reply.reject("NETWORK_INVALID_REQUEST"); }
        return null;
    }

    private final class HttpCall implements Runnable {
        final URI endpoint;
        final String method, contentType;
        final byte[] body;
        final Reply reply;
        HttpsURLConnection current;
        Future<?> work;
        boolean canceled;

        HttpCall(URI endpoint, JSONObject value, Reply reply) throws JSONException {
            this.endpoint = endpoint;
            this.reply = reply;
            method = value.optString("method", "GET");
            if (!method.equals("GET") && !method.equals("POST")) throw new IllegalArgumentException();
            body = value.has("body") ? decode(value.getString("body")) : null;
            if (body != null && !method.equals("POST")) throw new IllegalArgumentException();
            contentType = value.optString("contentType", "application/octet-stream");
            if (!contentType.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")) throw new IllegalArgumentException();
        }

        void cancel() {
            synchronized (PlayerNetwork.this) {
                if (canceled) return;
                canceled = true;
                requests.remove(this);
                if (work != null) work.cancel(true);
                if (current != null) {
                    HttpsURLConnection connection = current;
                    timers.execute(connection::disconnect);
                }
            }
        }

        @Override public void run() {
            HttpsURLConnection connection = null;
            try {
                connection = (HttpsURLConnection) endpoint.toURL().openConnection();
                synchronized (PlayerNetwork.this) {
                    if (canceled || closed) return;
                    current = connection;
                }
                connection.setConnectTimeout(TIMEOUT_MS);
                connection.setReadTimeout(TIMEOUT_MS);
                connection.setInstanceFollowRedirects(false);
                connection.setUseCaches(false);
                connection.setRequestMethod(method);
                if (body != null) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", contentType);
                    connection.setFixedLengthStreamingMode(body.length);
                    try (OutputStream output = connection.getOutputStream()) { output.write(body); }
                }
                int status = connection.getResponseCode();
                byte[] bytes;
                try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] chunk = new byte[4096];
                    int count;
                    while (input != null && (count = input.read(chunk)) >= 0) {
                        if (out.size() + count > BYTE_LIMIT) throw new IOException("Response exceeds limit");
                        out.write(chunk, 0, count);
                    }
                    bytes = out.toByteArray();
                }
                synchronized (PlayerNetwork.this) {
                    if (!canceled && !closed) reply.resolve(data("{\"status\":" + status + ",\"body\":\"", bytes));
                }
            } catch (IOException | RuntimeException failure) {
                synchronized (PlayerNetwork.this) { if (!canceled && !closed) reply.reject("NETWORK_HTTP_FAILED"); }
            } finally {
                if (connection != null) connection.disconnect();
                synchronized (PlayerNetwork.this) { requests.remove(this); current = null; }
            }
        }
    }

    private final class Socket extends WebSocketClient {
        final int id;
        final ArrayDeque<byte[]> pending = new ArrayDeque<>();
        Reply opening, reader;
        ScheduledFuture<?> deadline;
        boolean ended;
        int closeCode = 1006;
        long headSequence = 1;
        String failure;

        Socket(URI target, int id, Reply reply) {
            super(target, new Draft_6455(Collections.emptyList(), BYTE_LIMIT), Collections.emptyMap(), TIMEOUT_MS);
            this.id = id;
            opening = reply;
            setDnsResolver(uri -> {
                synchronized (PlayerNetwork.this) {
                    if (ended || closed) throw new java.net.UnknownHostException("Connection canceled");
                }
                return java.net.InetAddress.getByName(uri.getHost());
            });
        }

        @Override public void run() {
            try { super.run(); }
            finally { synchronized (PlayerNetwork.this) { liveTransports.remove(this); } }
        }

        @Override public void onOpen(ServerHandshake ignored) {
            synchronized (PlayerNetwork.this) {
                if (socket != this || ended || closed) { stopTransport(); return; }
                deadline.cancel(false);
                opening.resolve("null");
                opening = null;
            }
        }

        @Override public void onMessage(ByteBuffer packet) {
            synchronized (PlayerNetwork.this) {
                if (socket != this || ended) return;
                if (packet.remaining() > BYTE_LIMIT || pending.size() >= 8) { release("NETWORK_BACKPRESSURE"); return; }
                byte[] message = new byte[packet.remaining()];
                packet.get(message);
                pending.add(message);
                offerHead();
            }
        }

        @Override public void onMessage(String ignored) {
            synchronized (PlayerNetwork.this) { if (socket == this && !ended) release("NETWORK_BINARY_REQUIRED"); }
        }

        @Override public void onClose(int code, String reason, boolean remote) {
            synchronized (PlayerNetwork.this) {
                if (ended || socket != this) return;
                ended = true;
                closeCode = code;
                if (deadline != null) deadline.cancel(false);
                if (opening != null) { opening.reject("NETWORK_CONNECT_FAILED"); opening = null; }
                finishReader();
            }
        }

        @Override public void onError(Exception error) {
            synchronized (PlayerNetwork.this) { if (socket == this && !ended) release("NETWORK_SOCKET_FAILED"); }
        }

        Runnable receive(Reply reply) {
            if (reader != null) { reply.reject("NETWORK_READ_PENDING"); return null; }
            reader = reply;
            if (!pending.isEmpty()) { offerHead(); return null; }
            if (ended) { finishReader(); return null; }
            return () -> { synchronized (PlayerNetwork.this) { if (reader == reply) reader = null; } };
        }

        void offerHead() {
            if (reader == null || pending.isEmpty()) return;
            reader.resolve(data("{\"done\":false,\"sequence\":" + headSequence + ",\"body\":\"", pending.element()));
            reader = null;
        }

        void acknowledge(long sequence, Reply reply) {
            if (sequence == headSequence && !pending.isEmpty()) {
                pending.remove();
                headSequence++;
            } else if (sequence <= 0 || sequence != headSequence - 1) {
                reply.reject("NETWORK_STALE_PACKET");
                return;
            }
            reply.resolve("null");
        }

        void finishReader() {
            if (reader == null) return;
            if (failure == null) reader.resolve("{\"done\":true,\"code\":" + closeCode + "}");
            else reader.reject(failure);
            reader = null;
        }

        void release(String reason) {
            ended = true;
            failure = reason;
            if (deadline != null) deadline.cancel(false);
            if (opening != null) { opening.reject(reason); opening = null; }
            pending.clear();
            finishReader();
            stopTransport();
        }

        void stopTransport() {
            // TLS close can write a close_notify. Keep it off Android's UI thread, and outside the library's state lock.
            final java.net.Socket transport = getSocket();
            if (transport == null || transport.isClosed()) return;
            Runnable cleanup = () -> {
                try { transport.close(); } catch (IOException ignored) { /* Already closed by the peer. */ }
            };
            if (!timers.isShutdown()) timers.execute(cleanup);
            else cleanup.run(); // Only a late library callback can arrive after session shutdown.
        }
    }

    @Override public void closeSession() { close(); }

    @Override public synchronized void close() {
        if (closed) return;
        closed = true;
        if (socket != null) { socket.release("NETWORK_SESSION_CLOSED"); socket = null; }
        for (HttpCall request : new ArrayList<>(requests)) request.cancel();
        http.shutdownNow();
        timers.shutdown(); // Drain the already scheduled disconnects before releasing this owner.
    }
}
