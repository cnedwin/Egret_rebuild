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
        System.out.println("Packaged text and binary reads, cancellation and close passed.");
    }

    private ProjectAssetReadsTest() {}
}
