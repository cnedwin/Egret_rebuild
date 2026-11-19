// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** One session owns its I/O queue, completion notifications and unread strings. */
final class ProjectTextReads {
    interface Open { InputStream open(String path) throws IOException; }
    interface Completion { void ready(int id, String error); }

    private static final int MAX_BYTES = 256 * 1024;
    private static final int MAX_PENDING = 8;
    private final Open open;
    private final Executor dispatch;
    private final Completion completion;
    private final Map<Integer, Read> pending = new HashMap<>();
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(0, 1, 15, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(), task -> new Thread(task, "Egret project assets"));
    private boolean closed;

    ProjectTextReads(Open open, Executor dispatch, Completion completion) {
        this.open = open;
        this.dispatch = dispatch;
        this.completion = completion;
    }

    synchronized boolean start(int id, String path) {
        if (closed || id < 1 || pending.size() >= MAX_PENDING || pending.containsKey(id)) return false;
        Read job = new Read(id, path);
        pending.put(id, job);
        worker.execute(job);
        return true;
    }

    // A successful completion carries only the request ID into JS. The bridge
    // transfers the decoded string as data, without compiling it as JavaScript.
    synchronized String take(int id) {
        Read job = pending.get(id);
        if (job == null || job.text == null) return null;
        pending.remove(id);
        return job.text;
    }

    synchronized void cancel(int id) {
        Read job = pending.remove(id);
        if (job != null) {
            job.cancelled = true;
            job.text = null;
            worker.remove(job);
        }
    }

    synchronized void close() {
        if (closed) return;
        closed = true;
        for (Read job : pending.values()) {
            job.cancelled = true;
            job.text = null;
        }
        pending.clear();
        worker.shutdownNow();
    }

    private final class Read implements Runnable {
        final int id;
        final String path;
        volatile boolean cancelled;
        String text; // Guarded by ProjectTextReads.this.

        Read(int id, String path) { this.id = id; this.path = path; }

        public void run() {
            if (cancelled) return;
            String value = null, error = "";
            try (InputStream input = open.open(path)) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] block = new byte[8192];
                while (!cancelled) {
                    int count = input.read(block);
                    if (count == -1) break;
                    if (bytes.size() + count > MAX_BYTES) { error = "RangeError"; break; }
                    bytes.write(block, 0, count);
                }
                if (cancelled) return;
                if (error.isEmpty()) {
                    // The reporting decoder rejects malformed bytes. Match the usual
                    // UTF-8 text reader by consuming exactly one leading BOM.
                    value = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
                    if (value.startsWith("\ufeff")) value = value.substring(1);
                }
            } catch (FileNotFoundException e) { error = "NotFoundError"; }
            catch (CharacterCodingException e) { error = "EncodingError"; }
            catch (IllegalArgumentException e) { error = "TypeError"; }
            catch (IOException | RuntimeException e) { error = "Error"; }
            final String status = error;
            synchronized (ProjectTextReads.this) {
                if (pending.get(id) != this) return;
                text = status.isEmpty() ? value : null;
            }
            dispatch.execute(() -> {
                synchronized (ProjectTextReads.this) {
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
