// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Whole-file requests and open chunk readers share one session budget and I/O worker. */
final class ProjectAssetReads {
    enum Format { UTF8, BYTES, CHUNKS }
    interface Open { InputStream open(String path) throws IOException; }
    interface Completion { void ready(int id, String status); }

    private static final int MAX_BYTES = 256 * 1024;
    private static final int CHUNK_BYTES = 64 * 1024;
    private static final int BLOCK_BYTES = 8192;
    private static final int MAX_PENDING = 8;
    private final Open open;
    private final Executor dispatch;
    private final Completion completion;
    private final Map<Integer, Read> pending = new HashMap<>();
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(0, 1, 15, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(), task -> new Thread(task, "Egret project assets"));
    // No consumer retains the scratch buffer. Idle streams only retain their positions.
    private final ThreadLocal<byte[]> chunkBuffer = ThreadLocal.withInitial(() -> new byte[CHUNK_BYTES]);
    private boolean closed;

    ProjectAssetReads(Open open, Executor dispatch, Completion completion) {
        this.open = open;
        this.dispatch = dispatch;
        this.completion = completion;
    }

    synchronized boolean start(int id, String path, Format format) {
        if (closed || id < 1 || pending.size() >= MAX_PENDING || pending.containsKey(id)) return false;
        Read job = new Read(id, path, format);
        pending.put(id, job);
        worker.execute(job);
        return true;
    }

    synchronized boolean nextChunk(int id) {
        Read job = pending.get(id);
        if (job == null || !job.awaitingPull) return false;
        job.awaitingPull = false;
        worker.execute(job);
        return true;
    }

    // A successful completion carries only the request ID into JS. The bridge
    // transfers UTF-8 text or Base64 bytes as data, without compiling it as JavaScript.
    synchronized String take(int id) {
        Read job = pending.get(id);
        if (job == null || job.result == null) return null;
        String value = job.result;
        job.result = null;
        if (job.format == Format.CHUNKS) job.awaitingPull = true;
        else pending.remove(id);
        return value;
    }

    synchronized void cancel(int id) {
        Read job = pending.remove(id);
        if (job != null) job.cancel();
    }

    synchronized void close() {
        if (closed) return;
        closed = true;
        for (Read job : pending.values()) job.cancel();
        pending.clear();
        // Cancelled pulls have been removed; already scheduled stream closes must still run.
        worker.shutdown();
    }

    private final class Read implements Runnable {
        final int id;
        final String path;
        final Format format;
        volatile boolean cancelled;
        Thread runner; // Guarded by ProjectAssetReads.this, as are result and awaitingPull.
        String result;
        boolean awaitingPull;
        InputStream stream; // Owned by the I/O worker. Only inspected by cancel() when runner is null.
        boolean atEnd;

        Read(int id, String path, Format format) {
            this.id = id;
            this.path = path;
            this.format = format;
        }

        void cancel() { // Called with the session lock held.
            cancelled = true;
            result = null;
            worker.remove(this);
            if (runner != null) runner.interrupt();
            if (format == Format.CHUNKS && (runner != null || stream != null)) {
                worker.execute(this::discardStream);
            }
        }

        private void closeStream() throws IOException {
            InputStream previous = stream;
            stream = null;
            if (previous != null) previous.close();
        }

        private void discardStream() {
            try { closeStream(); }
            catch (IOException | RuntimeException ignored) { /* The request has already ended. */ }
        }

        private String readChunk() throws IOException {
            if (atEnd) return null;
            if (stream == null) stream = open.open(path);
            byte[] block = chunkBuffer.get();
            int size = 0;
            // Stop at the caller's boundary, even for exact multiples. Never look ahead.
            while (size < CHUNK_BYTES && !cancelled) {
                int count = stream.read(block, size, Math.min(BLOCK_BYTES, CHUNK_BYTES - size));
                if (count < 0) {
                    atEnd = true;
                    closeStream();
                    break;
                }
                if (count == 0) throw new IOException("Packaged stream made no progress");
                size += count;
            }
            if (size == 0 || cancelled) return null;
            return PlayerChunkCodec.encode(block, size);
        }

        public void run() {
            synchronized (ProjectAssetReads.this) {
                if (cancelled) return;
                runner = Thread.currentThread();
            }
            String value = null, error = "";
            try {
                if (format == Format.CHUNKS) {
                    value = readChunk();
                    if (value == null) error = "eof";
                } else try (InputStream input = open.open(path)) {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] block = new byte[BLOCK_BYTES];
                    while (!cancelled) {
                        int count = input.read(block);
                        if (count == -1) break;
                        if (bytes.size() + count > MAX_BYTES) { error = "RangeError"; break; }
                        bytes.write(block, 0, count);
                    }
                    if (cancelled) return;
                    if (error.isEmpty()) {
                        byte[] payload = bytes.toByteArray();
                        if (format == Format.BYTES) {
                            value = Base64.getEncoder().encodeToString(payload);
                        } else {
                            value = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(payload)).toString();
                            if (value.startsWith("\ufeff")) value = value.substring(1);
                        }
                    }
                }
            } catch (FileNotFoundException e) { error = "NotFoundError"; }
            catch (CharacterCodingException e) { error = "EncodingError"; }
            catch (IllegalArgumentException e) { error = "TypeError"; }
            catch (IOException | RuntimeException e) { error = "Error"; }
            finally {
                if (format == Format.CHUNKS && !error.isEmpty()) discardStream();
                synchronized (ProjectAssetReads.this) { runner = null; }
            }
            final String status = error;
            synchronized (ProjectAssetReads.this) {
                if (pending.get(id) != this) return;
                result = status.isEmpty() ? value : null;
            }
            dispatch.execute(() -> {
                synchronized (ProjectAssetReads.this) {
                    // A cancelled or closed request can already have a notification
                    // in the owner's queue. An ID reused later refers to a new job.
                    if (pending.get(id) != this) return;
                    if (!status.isEmpty()) pending.remove(id);
                }
                completion.ready(id, status);
            });
        }
    }
}
