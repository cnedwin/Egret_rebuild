// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.network;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import org.egret.runtime.player.ProjectHostServices.Reply;
import org.egret.runtime.player.PlayerNetworkMailboxTest;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.DefaultSSLWebSocketServerFactory;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

/** Real loopback transports and default hostname/certificate checks. Supply an ephemeral localhost TLS key via args. */
public final class PlayerNetworkTest {
    private static final class Answer implements Reply {
        final CompletableFuture<String> value = new CompletableFuture<>();
        Runnable cancel;
        @Override public void resolve(String json) { value.complete(json); }
        @Override public void reject(String code) { value.complete("!" + code); }
        String get() throws Exception { return value.get(6, TimeUnit.SECONDS); }
    }
    private static Answer begin(PlayerNetwork network, String op, int id, String... fields) {
        JSONObject value = new JSONObject().put("op", op).put("id", id);
        for (int index = 0; index < fields.length; index += 2) value.put(fields[index], fields[index + 1]);
        Answer answer = new Answer();
        answer.cancel = network.begin(value.toString(), answer);
        return answer;
    }
    private static void check(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
    }

    public static void main(String[] args) throws Exception {
        KeyStore keys = KeyStore.getInstance("PKCS12");
        char[] password = System.getProperty("javax.net.ssl.trustStorePassword").toCharArray();
        try (InputStream stream = Files.newInputStream(Path.of(args[0]))) { keys.load(stream, password); }
        KeyManagerFactory managers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        managers.init(keys, password);
        SSLContext serverContext = SSLContext.getInstance("TLS");
        serverContext.init(managers.getKeyManagers(), null, null);
        HttpsServer http = HttpsServer.create(new InetSocketAddress("localhost", 0), 0);
        ExecutorService serverWorkers = Executors.newCachedThreadPool();
        http.setExecutor(serverWorkers);
        http.setHttpsConfigurator(new HttpsConfigurator(serverContext));
        AtomicInteger redirected = new AtomicInteger();
        CountDownLatch slowEntered = new CountDownLatch(1), slowRelease = new CountDownLatch(1);
        http.createContext("/echo", exchange -> {
            byte[] bytes = exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) { out.write(bytes); }
        });
        http.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().add("Location", "/unexpected");
            exchange.sendResponseHeaders(302, -1); exchange.close();
        });
        http.createContext("/unexpected", exchange -> { redirected.incrementAndGet(); exchange.sendResponseHeaders(200,-1); exchange.close(); });
        http.createContext("/slow", exchange -> {
            slowEntered.countDown();
            try { slowRelease.await(5, TimeUnit.SECONDS); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            exchange.close();
        });
        http.start();
        CountDownLatch wsStarted = new CountDownLatch(1), burstSent = new CountDownLatch(1);
        WebSocketServer ws = new WebSocketServer(new InetSocketAddress("localhost", 0), 1) {
            @Override public void onStart() { wsStarted.countDown(); }
            @Override public void onOpen(WebSocket connection, ClientHandshake handshake) { }
            @Override public void onError(WebSocket connection, Exception error) { }
            @Override public void onClose(WebSocket connection, int code, String reason, boolean remote) { }
            @Override public void onMessage(WebSocket connection, String text) { throw new AssertionError("Expected binary"); }
            @Override public void onMessage(WebSocket connection, ByteBuffer data) {
                byte[] bytes = new byte[data.remaining()];
                data.get(bytes);
                if (bytes.length == 1 && bytes[0] == 99) {
                    for (int i = 0; i < 9; i++) connection.send(new byte[]{(byte)i});
                    burstSent.countDown();
                } else connection.send(bytes);
            }
        };
        ws.setWebSocketFactory(new DefaultSSLWebSocketServerFactory(serverContext));
        ws.start();
        check(wsStarted.await(5, TimeUnit.SECONDS), "WebSocket server started");
        String web = "https://localhost:" + http.getAddress().getPort();
        String gateway = "wss://localhost:" + ws.getPort();
        String badHttps = web.replace("localhost", "127.0.0.1"), badWss = gateway.replace("localhost","127.0.0.1");
        byte[] payload = new byte[]{0, -1, 1, -128, 42};
        String packet = Base64.getEncoder().encodeToString(payload);
        try (PlayerNetwork net = new PlayerNetwork(List.of(web, gateway, badHttps, badWss))) {
            String reply = begin(net, "http", 0, "url", web + "/echo", "method", "POST", "body", packet).get();
            JSONObject response = new JSONObject(reply);
            check(response.getInt("status") == 200 && Arrays.equals(payload, Base64.getDecoder().decode(response.getString("body"))), "HTTPS payload");
            check(new JSONObject(begin(net, "http", 0, "url", web+"/redirect").get()).getInt("status") == 302 && redirected.get() == 0, "redirect not followed");
            check(begin(net,"http",0,"url","http://localhost/test").get().startsWith("!"), "cleartext refused");
            check(begin(net,"http",0,"url","https://unlisted.invalid/test").get().startsWith("!"), "unlisted origin refused");
            check(begin(net,"http",0,"url",badHttps+"/echo").get().startsWith("!"), "HTTPS hostname mismatch");
            Answer slow = begin(net,"http",0,"url",web+"/slow");
            check(slowEntered.await(4,TimeUnit.SECONDS), "read in flight"); slow.cancel.run(); slowRelease.countDown();
            check(!slow.value.isDone(), "canceled read suppressed");
            check(begin(net,"open",1,"url",badWss).get().startsWith("!"), "WSS hostname mismatch");
            check(begin(net,"open",2,"url",gateway).get().equals("null"), "WSS open");
            Answer first = begin(net,"receive",2);
            check(begin(net,"receive",2).get().equals("!NETWORK_READ_PENDING"), "one pending receive");
            first.cancel.run();
            check(begin(net,"send",2,"body",packet).get().equals("null"), "send accepted");
            JSONObject echoed = new JSONObject(begin(net,"receive",2).get());
            check(!first.value.isDone() && echoed.getString("body").equals(packet), "canceled receive and binary echo");
            check(begin(net,"ack",2,"sequence",echoed.get("sequence").toString()).get().equals("null"), "accept received head");
            PlayerNetworkMailboxTest.verify(net, 2, payload, () -> check(begin(net,"send",2,"body",packet).get().equals("null"), "send for delayed delivery"));
            check(begin(net,"close",2).get().equals("null"), "explicit close");
            check(begin(net,"open",3,"url",gateway).get().equals("null"), "reconnect");
            check(begin(net,"send",2,"body",packet).get().equals("!NETWORK_STALE_SOCKET"), "old handle refused");
            check(begin(net,"send",3,"body","Yw==").get().equals("null"), "burst requested");
            check(burstSent.await(3,TimeUnit.SECONDS), "burst sent");
            long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(4);
            while (!ws.getConnections().isEmpty() && System.nanoTime() < until) Thread.sleep(10);
            check(begin(net,"receive",3).get().equals("!NETWORK_BACKPRESSURE"), "bounded inbound messages");
            check(begin(net,"open",4,"url",gateway).get().equals("null"), "fresh socket after overload");
            Answer pending = begin(net,"receive",4);
            net.closeSession();
            check(pending.get().equals("!NETWORK_SESSION_CLOSED") && begin(net,"open",5,"url",gateway).get().equals("!NETWORK_SESSION_CLOSED"), "session closes socket and pending read");
            System.out.println("PASS HTTPS/WSS loopback, bytes, trust, redirects, origin policy, cancellation, reconnect, backpressure and session closure");
        } finally {
            slowRelease.countDown();
            http.stop(0);
            serverWorkers.shutdownNow();
            ws.stop(2000);
        }
    }
}
