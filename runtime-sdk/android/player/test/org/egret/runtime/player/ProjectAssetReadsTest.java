// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/** Uses the same bounded I/O queue and data conversion code shipped in the player AAR. */
public final class ProjectAssetReadsTest {
    private static void check(boolean value, String reason) {
        if (!value) throw new AssertionError(reason);
    }

    private static void next(LinkedBlockingQueue<Runnable> queue) throws Exception {
        Runnable callback = queue.poll(5, TimeUnit.SECONDS);
        check(callback != null, "Missing owner-thread completion");
        callback.run();
    }

    /** The first block reaches the production accumulator before the second read starts. */
    private static void activeBinaryRead(boolean close) throws Exception {
        CountDownLatch secondRead = new CountDownLatch(1), release = new CountDownLatch(1);
        CountDownLatch interrupted = new CountDownLatch(1), streamClosed = new CountDownLatch(1);
        LinkedBlockingQueue<Runnable> posts = new LinkedBlockingQueue<>();
        int[] delivered = {0};
        ProjectAssetReads reads = new ProjectAssetReads(path -> {
            if ("retry".equals(path)) return new ByteArrayInputStream(new byte[]{0, (byte)0xff});
            return new java.io.InputStream() {
                boolean first = true;
                @Override public int read() { throw new AssertionError("Expected a block read"); }
                @Override public int read(byte[] block, int offset, int length) throws java.io.IOException {
                    if (first) { first = false; block[offset] = 42; return 1; }
                    secondRead.countDown();
                    try { release.await(); }
                    catch (InterruptedException e) {
                        interrupted.countDown();
                        throw new java.io.InterruptedIOException();
                    }
                    return -1;
                }
                @Override public void close() { streamClosed.countDown(); }
            };
        }, posts::add, (id, error) -> { check(error.isEmpty(), "Unexpected retrieval failure"); delivered[0]++; });
        try {
            check(reads.start(1, "hold", ProjectAssetReads.Format.BYTES), "Read did not start");
            check(secondRead.await(5, TimeUnit.SECONDS), "Did not read the first binary block");
            if (close) reads.close(); else reads.cancel(1);
            check(interrupted.await(5, TimeUnit.SECONDS), "Active read did not observe interruption");
            check(streamClosed.await(5, TimeUnit.SECONDS), "Active stream was not released");
            check(reads.take(1) == null && delivered[0] == 0, "Delivered cancelled bytes");
            if (!close) {
                check(reads.start(1, "retry", ProjectAssetReads.Format.BYTES), "Retry refused");
                next(posts);
                check("AP8=".equals(reads.take(1)) && delivered[0] == 1, "Retry received stale bytes");
            }
        } finally { release.countDown(); reads.close(); }
    }

    private static void chunkLifecycle() throws Exception {
        final int chunk = 64 * 1024;
        byte[] bytes = new byte[5 * chunk + 7];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte)(i * 13 + i / chunk);
        int[] opens = {0}, consumed = {0};
        java.util.concurrent.atomic.AtomicInteger closes = new java.util.concurrent.atomic.AtomicInteger();
        LinkedBlockingQueue<Runnable> posts = new LinkedBlockingQueue<>();
        String[] status = {null};
        ProjectAssetReads reads = new ProjectAssetReads(path -> {
            opens[0]++;
            if ("missing".equals(path)) throw new FileNotFoundException();
            if ("broken".equals(path)) return new java.io.FilterInputStream(new ByteArrayInputStream(bytes)) {
                int remaining = chunk;
                @Override public int read(byte[] dst, int offset, int length) throws java.io.IOException {
                    if (remaining == 0) throw new java.io.IOException("Second chunk failed");
                    int count = super.read(dst, offset, Math.min(length, remaining));
                    remaining -= count;
                    return count;
                }
                @Override public void close() throws java.io.IOException { super.close(); closes.incrementAndGet(); }
            };
            int size = "empty".equals(path) ? 0 : "exact".equals(path) ? chunk : bytes.length;
            return new ByteArrayInputStream(bytes, 0, size) {
                @Override public synchronized int read(byte[] dst, int offset, int length) {
                    int n = super.read(dst, offset, Math.min(length, 1309));
                    if (n > 0) consumed[0] += n;
                    return n;
                }
                @Override public void close() { closes.incrementAndGet(); }
            };
        }, posts::add, (id, error) -> status[0] = id + ":" + error);
        try {
            check(reads.start(1, "large", ProjectAssetReads.Format.CHUNKS), "Cannot start stream");
            for (int offset = 0; offset < bytes.length; offset += chunk) {
                if (offset > 0) check(reads.nextChunk(1), "Cannot pull another chunk");
                check(!reads.nextChunk(1), "Concurrent pull was accepted");
                next(posts);
                check("1:".equals(status[0]), "Chunk status mismatch");
                check(!reads.nextChunk(1), "Allowed pull before consumer took result");
                byte[] actual = java.util.Base64.getDecoder().decode(reads.take(1));
                int end = Math.min(bytes.length, offset + chunk);
                check(java.util.Arrays.equals(actual, java.util.Arrays.copyOfRange(bytes, offset, end)), "Bad chunk");
                check(consumed[0] == end && opens[0] == 1 && reads.take(1) == null, "Read ahead or reopened");
            }
            check(reads.nextChunk(1), "EOF pull refused");
            next(posts);
            check("1:eof".equals(status[0]) && reads.take(1) == null && !reads.nextChunk(1), "EOF mismatch");
            check(closes.get() == 1, "Completed stream did not close exactly once");
            for (String path : new String[]{"empty","exact","missing"}) {
                check(reads.start(1, path, ProjectAssetReads.Format.CHUNKS), "Terminal stream leaked its slot");
                next(posts);
                if ("exact".equals(path)) {
                    check(java.util.Base64.getDecoder().decode(reads.take(1)).length == chunk, "Incorrect exact chunk");
                    check(reads.nextChunk(1), "Missing exact-sized EOF");
                    next(posts);
                }
                check(("missing".equals(path) ? "1:NotFoundError" : "1:eof").equals(status[0]), "Wrong terminal status");
            }
            int beforeFailure = closes.get();
            check(reads.start(1, "broken", ProjectAssetReads.Format.CHUNKS), "Broken stream refused");
            next(posts);
            check(reads.take(1) != null && reads.nextChunk(1), "Unable to pull failing chunk");
            next(posts);
            check("1:Error".equals(status[0]) && reads.take(1) == null && closes.get() == beforeFailure + 1,
                "Failed stream retained a result or an open input");
            for (int id = 1; id <= 8; id++) {
                check(reads.start(id, "large", ProjectAssetReads.Format.CHUNKS), "Shared budget too small");
                next(posts);
                check(reads.take(id) != null, "Idle reader missing first chunk");
            }
            check(!reads.start(9, "large", ProjectAssetReads.Format.BYTES), "Idle streams bypassed shared budget");
            reads.cancel(3);
            check(reads.start(3, "empty", ProjectAssetReads.Format.BYTES), "Cannot reuse early-return slot");
            next(posts);
            check("".equals(reads.take(3)), "Retry broke whole-file ABI");
            int beforeClose = closes.get();
            reads.close();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (closes.get() < beforeClose + 7 && System.nanoTime() < deadline) Thread.sleep(2);
            check(closes.get() == beforeClose + 7, "Session leaked idle streams");
        } finally { reads.close(); }
    }

    /** The gate is inside a read on the second requested chunk of the same stream. */
    private static void activeChunkRead(boolean close) throws Exception {
        final int chunk = 64 * 1024;
        CountDownLatch inside = new CountDownLatch(1), release = new CountDownLatch(1), closed = new CountDownLatch(1);
        LinkedBlockingQueue<Runnable> posts = new LinkedBlockingQueue<>();
        ProjectAssetReads reads = new ProjectAssetReads(path -> {
            if ("retry".equals(path)) return new ByteArrayInputStream(new byte[]{1});
            return new java.io.InputStream() {
                int position;
                @Override public int read() { throw new AssertionError("Expected block read"); }
                @Override public int read(byte[] dst, int offset, int length) throws java.io.IOException {
                    if (position == chunk + 8192) {
                        inside.countDown();
                        try { release.await(); }
                        catch (InterruptedException e) { throw new java.io.InterruptedIOException(); }
                        return -1;
                    }
                    position += length;
                    return length;
                }
                @Override public void close() { closed.countDown(); }
            };
        }, posts::add, (id, error) -> check(error.isEmpty(), "Unexpected completion after cancellation"));
        try {
            check(reads.start(1, "gated", ProjectAssetReads.Format.CHUNKS), "Gated stream refused");
            next(posts);
            check(reads.take(1) != null && reads.nextChunk(1), "Second chunk did not start");
            check(inside.await(5, TimeUnit.SECONDS), "Second chunk did not enter read");
            check(reads.start(2, "queued", ProjectAssetReads.Format.CHUNKS), "Queued stream refused");
            if (close) reads.close();
            else { reads.cancel(2); reads.cancel(1); }
            check(closed.await(5, TimeUnit.SECONDS), "Active stream not released after interruption");
            check(reads.take(1) == null && reads.take(2) == null, "Cancelled bytes escaped");
            if (!close) {
                check(reads.start(1, "retry", ProjectAssetReads.Format.CHUNKS), "Retry refused");
                next(posts);
                check("AQ==".equals(reads.take(1)), "Retry did not restart at offset zero");
            }
            check(posts.isEmpty(), "Cancelled request emitted a stale callback");
        } finally { release.countDown(); reads.close(); }
    }

    public static void main(String[] args) throws Exception {
        LinkedBlockingQueue<Runnable> posts = new LinkedBlockingQueue<>();
        CountDownLatch entered = new CountDownLatch(1), resume = new CountDownLatch(1);
        String[] observed = {null};
        String utf8 = "关卡：雪原\u0000🌲\u2028\u2029";
        ProjectAssetReads reads = new ProjectAssetReads(path -> {
            if (path.equals("missing")) throw new FileNotFoundException();
            if (path.equals("invalid")) throw new IllegalArgumentException();
            if (path.equals("io")) throw new java.io.IOException();
            if (path.equals("blocked")) {
                entered.countDown();
                try { check(resume.await(5, TimeUnit.SECONDS), "Blocked test open timed out"); }
                catch (InterruptedException e) { throw new java.io.InterruptedIOException(); }
            }
            byte[] bytes;
            if (path.equals("malformed")) bytes = new byte[]{(byte)0xc3, 0x28};
            else if (path.equals("max")) bytes = new byte[256 * 1024];
            else if (path.equals("above")) bytes = new byte[256 * 1024 + 1];
            else if (path.equals("empty")) bytes = new byte[0];
            else bytes = ("\ufeff" + utf8).getBytes(StandardCharsets.UTF_8);
            return new ByteArrayInputStream(bytes);
        }, posts::add, (id, error) -> observed[0] = id + ":" + error);
        try {
            for (String[] item : new String[][]{{"json",""},{"empty",""},{"max",""},
                    {"missing","NotFoundError"},{"invalid","TypeError"},{"malformed","EncodingError"},
                    {"above","RangeError"},{"io","Error"}}) {
                check(reads.start(1, item[0], ProjectAssetReads.Format.UTF8), "ID must be reusable after completion");
                next(posts);
                check(("1:" + item[1]).equals(observed[0]), "Wrong status for " + item[0]);
                String value = reads.take(1);
                if (item[0].equals("json")) check(utf8.equals(value), "Text/BOM/Unicode mismatch");
                else if (item[0].equals("max")) check(value.length() == 256 * 1024, "Rejected exact limit");
                else if (item[0].equals("empty")) check("".equals(value), "Lost empty string");
                else check(value == null, "Retained failed result");
                check(reads.take(1) == null, "Result must be consumable only once");
            }

            // Text and bytes share the same request budget; binary inputs preserve invalid UTF-8 and BOM bytes.
            for (String path : new String[]{"malformed", "json", "empty", "max", "above"}) {
                check(reads.start(1, path, ProjectAssetReads.Format.BYTES), "Binary read refused");
                next(posts);
                if (path.equals("above")) {
                    check("1:RangeError".equals(observed[0]) && reads.take(1) == null, "Oversize binary accepted");
                    continue;
                }
                check("1:".equals(observed[0]), "Binary bytes were decoded as UTF-8");
                byte[] value = java.util.Base64.getDecoder().decode(reads.take(1));
                byte[] expected = path.equals("max") ? new byte[256 * 1024] :
                    path.equals("empty") ? new byte[0] :
                    path.equals("malformed") ? new byte[]{(byte)0xc3, 0x28} :
                    ("\ufeff" + utf8).getBytes(StandardCharsets.UTF_8);
                check(java.util.Arrays.equals(expected, value), "Wrong binary payload: " + path);
            }
            check(reads.start(1, "blocked", ProjectAssetReads.Format.UTF8), "Cannot start blocked read");
            check(entered.await(5, TimeUnit.SECONDS), "I/O did not start");
            for (int id = 2; id <= 8; id++) check(reads.start(id, "json", ProjectAssetReads.Format.BYTES), "Queue limit too low");
            check(!reads.start(9, "json", ProjectAssetReads.Format.UTF8) && !reads.start(2, "json", ProjectAssetReads.Format.UTF8), "Limit or duplicate ignored");
            for (int id = 1; id <= 8; id++) reads.cancel(id);
            // Reuse the active ID while its cancelled work is still returning from open().
            check(reads.start(1, "empty", ProjectAssetReads.Format.UTF8), "Cancellation did not release capacity");
            resume.countDown();
            next(posts);
            check("1:".equals(observed[0]) && "".equals(reads.take(1)), "Stale result after cancellation");

            check(reads.start(1, "json", ProjectAssetReads.Format.UTF8), "Could not start close test");
            Runnable late = posts.poll(5, TimeUnit.SECONDS);
            check(late != null, "Read must reach the owner queue before close");
            observed[0] = null;
            reads.close();
            late.run();
            check(observed[0] == null && reads.take(1) == null && !reads.start(2, "json", ProjectAssetReads.Format.UTF8),
                "Closed session delivered or retained a result");
        } finally { resume.countDown(); reads.close(); }
        activeBinaryRead(false);
        activeBinaryRead(true);
        chunkEncoding();
        chunkLifecycle();
        activeChunkRead(false);
        activeChunkRead(true);
        System.out.println("Packaged text, bytes and chunk reads, cancellation and close passed.");
    }

    private static void chunkEncoding() {
        byte[] source = new byte[64 * 1024];
        new java.util.Random(394).nextBytes(source);
        int[] sizes = {0, 1, 2, 3, 4, 46, 47, 48, 49, 50, 95, 96, 97, 255, 256, 65534, 65535, 65536};
        for (int size : sizes) {
            byte[] prefix = java.util.Arrays.copyOf(source, size);
            String expected = java.util.Base64.getEncoder().encodeToString(prefix);
            check(expected.equals(PlayerChunkCodec.encode(source, size)), "Chunk encoding mismatch at " + size);
        }
        rejectChunkLength(source, -1);
        rejectChunkLength(new byte[1], 2);
        rejectChunkLength(new byte[65537], 65537);
        try {
            PlayerChunkCodec.encode(null, 0);
            throw new AssertionError("Null chunk buffer accepted");
        } catch (NullPointerException expected) { /* Null is invalid even for an empty prefix. */ }
    }

    private static void rejectChunkLength(byte[] bytes, int size) {
        try {
            PlayerChunkCodec.encode(bytes, size);
            throw new AssertionError("Out-of-range chunk length accepted: " + size);
        } catch (IllegalArgumentException expected) { /* Each byte-count limit is checked independently. */ }
    }

    private ProjectAssetReadsTest() {}
}
