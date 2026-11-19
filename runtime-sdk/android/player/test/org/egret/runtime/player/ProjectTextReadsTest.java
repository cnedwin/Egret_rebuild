// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/** Runs against the same request queue and UTF-8 decoder that ship in the player AAR. */
public final class ProjectTextReadsTest {
    private static void check(boolean value, String reason) {
        if (!value) throw new AssertionError(reason);
    }

    private static void next(LinkedBlockingQueue<Runnable> queue) throws Exception {
        Runnable callback = queue.poll(5, TimeUnit.SECONDS);
        check(callback != null, "Missing owner-thread completion");
        callback.run();
    }

    public static void main(String[] args) throws Exception {
        LinkedBlockingQueue<Runnable> posts = new LinkedBlockingQueue<>();
        CountDownLatch entered = new CountDownLatch(1), resume = new CountDownLatch(1);
        String[] observed = {null};
        String utf8 = "关卡：雪原\u0000🌲\u2028\u2029";
        ProjectTextReads reads = new ProjectTextReads(path -> {
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
                check(reads.start(1, item[0]), "ID must be reusable after completion");
                next(posts);
                check(("1:" + item[1]).equals(observed[0]), "Wrong status for " + item[0]);
                String value = reads.take(1);
                if (item[0].equals("json")) check(utf8.equals(value), "Text/BOM/Unicode mismatch");
                else if (item[0].equals("max")) check(value.length() == 256 * 1024, "Rejected exact limit");
                else if (item[0].equals("empty")) check("".equals(value), "Lost empty string");
                else check(value == null, "Retained failed result");
                check(reads.take(1) == null, "Result must be consumable only once");
            }

            check(reads.start(1, "blocked"), "Cannot start blocked read");
            check(entered.await(5, TimeUnit.SECONDS), "I/O did not start");
            for (int id = 2; id <= 8; id++) check(reads.start(id, "json"), "Queue limit too low");
            check(!reads.start(9, "json") && !reads.start(2, "json"), "Limit or duplicate ignored");
            for (int id = 1; id <= 8; id++) reads.cancel(id);
            // Reuse the active ID while its cancelled work is still returning from open().
            check(reads.start(1, "empty"), "Cancellation did not release capacity");
            resume.countDown();
            next(posts);
            check("1:".equals(observed[0]) && "".equals(reads.take(1)), "Stale result after cancellation");

            check(reads.start(1, "json"), "Could not start close test");
            Runnable late = posts.poll(5, TimeUnit.SECONDS);
            check(late != null, "Read must reach the owner queue before close");
            observed[0] = null;
            reads.close();
            late.run();
            check(observed[0] == null && reads.take(1) == null && !reads.start(2, "json"),
                "Closed session delivered or retained a result");
        } finally { resume.countDown(); reads.close(); }
        System.out.println("Packaged UTF-8 text reads, cancellation and close passed.");
    }

    private ProjectTextReadsTest() {}
}
