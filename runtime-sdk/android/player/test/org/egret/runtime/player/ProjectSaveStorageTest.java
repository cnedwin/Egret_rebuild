// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.File;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

/** Exercises the player store on a real filesystem, including another process owning the writer lock. */
public final class ProjectSaveStorageTest {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private interface Operation { void run() throws Exception; }

    private static void refused(Operation op, Class<? extends Exception> type) throws Exception {
        try { op.run(); }
        catch (Exception e) {
            if (type.isInstance(e)) return;
            throw e;
        }
        throw new AssertionError("Expected " + type.getSimpleName());
    }

    private static String repeat(char value, int length) {
        char[] chars = new char[length];
        Arrays.fill(chars, value);
        return new String(chars);
    }

    private static Path onlyDirectory(Path parent) throws IOException {
        try (Stream<Path> dirs = Files.list(parent)) { return dirs.filter(Files::isDirectory).findFirst().get(); }
    }

    private static void dataAndIsolation(File root) throws Exception {
        ProjectSaveStorage first = new ProjectSaveStorage(root, "bundle/game");
        ProjectSaveStorage other = new ProjectSaveStorage(root, "bundle/Game");
        String key = "../进度/\u0000🚀.unread";
        String value = "中文\u0000🚀\n";
        check(first.getItem(key) == null, "Missing key");
        first.setItem(key, value);
        first.setItem("slot", "");
        first.setItem("slot.unread", "old");
        first.removeItem("slot");
        first.removeItem("slot");
        check(first.getItem("slot") == null && "old".equals(first.getItem("slot.unread")), "Independent keys");
        check(value.equals(first.getItem(key)) && other.getItem(key) == null, "Namespace or Unicode collision");
        other.setItem(key, "other");
        ProjectSaveStorage reopened = new ProjectSaveStorage(root, "bundle/game");
        check(value.equals(reopened.getItem(key)), "Reopened value");
        reopened.setItem("slot", "");
        check("".equals(first.getItem("slot")), "Empty value indistinguishable from missing");
        String limit = repeat('a', 1024 * 1024);
        String longKey = repeat('汉', 256);
        first.setItem(longKey, limit);
        check(limit.equals(first.getItem(longKey)), "Valid inclusive limits");
        refused(() -> first.setItem(longKey, limit + "x"), IllegalArgumentException.class);
        refused(() -> first.setItem(longKey, repeat('汉', 349526)), IllegalArgumentException.class);
        refused(() -> first.getItem(longKey + "x"), IllegalArgumentException.class);
        refused(() -> first.getItem(""), IllegalArgumentException.class);
        refused(() -> first.setItem(key, "\ud800"), IllegalArgumentException.class);
        refused(() -> first.getItem("bad\udc00"), IllegalArgumentException.class);
        check(value.equals(first.getItem(key)), "Validation changed previous bytes");
        first.closeWhenIdle(() -> {});
        other.closeWhenIdle(() -> {});
        reopened.closeWhenIdle(() -> {});
    }

    private static void concurrentSessions(File root) throws Exception {
        ProjectSaveStorage first = new ProjectSaveStorage(root, "game");
        ProjectSaveStorage second = new ProjectSaveStorage(root, "game");
        String[] values = {repeat('A', 32769), repeat('中', 32769)};
        first.setItem("slot", values[0]);
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<Throwable> failed = new AtomicReference<>();
        Thread[] tasks = new Thread[2];
        for (int i = 0; i < tasks.length; i++) {
            final ProjectSaveStorage store = i == 0 ? first : second;
            final String value = values[i];
            tasks[i] = new Thread(() -> {
                try {
                    start.await();
                    for (int j = 0; j < 12; j++) {
                        store.setItem("slot", value);
                        String actual = store.getItem("slot");
                        check(values[0].equals(actual) || values[1].equals(actual), "Torn concurrent save");
                    }
                } catch (Throwable e) { failed.compareAndSet(null, e); }
            });
            tasks[i].start();
        }
        start.countDown();
        for (Thread thread : tasks) thread.join();
        if (failed.get() != null) throw new AssertionError("Competing same-project views", failed.get());
        String actual = first.getItem("slot");
        check(values[0].equals(actual) || values[1].equals(actual), "Missing last committed value");
        first.closeWhenIdle(() -> {});
        second.closeWhenIdle(() -> {});
    }

    private static void writesAndClose(File root) throws Exception {
        ProjectSaveStorage store = new ProjectSaveStorage(root, "one");
        ProjectSaveStorage peer = new ProjectSaveStorage(root, "one");
        store.setItem("slot", "old");
        Path namespace = onlyDirectory(onlyDirectory(root.toPath()));
        Path writer = namespace.resolve("writer.lock");
        Path staging = namespace.resolve("pending");
        // An interrupted writer leaves at most a single incomplete replacement in the namespace.
        Files.write(staging, new byte[]{1, 2, 3});
        check("old".equals(peer.getItem("slot")), "Read returned uncommitted data");
        Files.delete(staging);
        Files.move(writer, namespace.resolve("saved-lock"));
        Files.createDirectory(writer);
        refused(() -> store.setItem("slot", "broken"), IOException.class);
        check("old".equals(store.getItem("slot")), "Failed write replaced the old save");
        Files.delete(writer);
        Files.move(namespace.resolve("saved-lock"), writer);
        Process child = new ProcessBuilder(new File(System.getProperty("java.home"), "bin/java").toString(),
                "-cp", System.getProperty("java.class.path"), ProjectSaveStorageTest.class.getName(),
                "hold", writer.toString()).redirectError(ProcessBuilder.Redirect.INHERIT).start();
        AtomicReference<Throwable> failed = new AtomicReference<>();
        CountDownLatch drained = new CountDownLatch(1);
        AtomicInteger callbacks = new AtomicInteger();
        Thread write = new Thread(() -> {
            try { store.setItem("slot", "new"); }
            catch (Throwable e) { failed.set(e); }
        });
        try {
            check(child.getInputStream().read() == 1, "External file lock");
            write.start();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            boolean waiting = false;
            while (!waiting && System.nanoTime() < deadline) {
                for (StackTraceElement call : write.getStackTrace()) {
                    if (call.getClassName().contains("FileChannel") && call.getMethodName().equals("lock")) waiting = true;
                }
                if (!waiting) Thread.sleep(2);
            }
            check(waiting, "Writer failed to enter a real blocking file lock");
            store.closeWhenIdle(() -> { callbacks.incrementAndGet(); drained.countDown(); });
            store.closeWhenIdle(callbacks::incrementAndGet);
            check(callbacks.get() == 0, "Close acknowledged before active write");
            refused(() -> store.setItem("slot", "late"), IllegalStateException.class);
            check("old".equals(peer.getItem("slot")), "Concurrent reader saw uncommitted bytes");
            child.getOutputStream().write(1);
            child.getOutputStream().flush();
            check(drained.await(5, TimeUnit.SECONDS), "Close did not drain");
            write.join(5000);
            check(!write.isAlive() && failed.get() == null && callbacks.get() == 1, "Writer or close callback");
            check("new".equals(peer.getItem("slot")), "Acknowledged close lost admitted write");
            check(child.waitFor(5, TimeUnit.SECONDS) && child.exitValue() == 0, "Child lock holder");
        } finally {
            child.destroyForcibly();
        }
        peer.closeWhenIdle(() -> {});
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 2 && args[0].equals("hold")) {
            try (FileChannel channel = FileChannel.open(Paths.get(args[1]), StandardOpenOption.WRITE);
                 FileLock ignored = channel.lock()) {
                System.out.write(1);
                System.out.flush();
                if (System.in.read() < 0) throw new IOException("Lost parent process");
            }
            return;
        }
        Path root = Files.createTempDirectory("egret-player-saves-test-");
        try {
            dataAndIsolation(Files.createDirectory(root.resolve("isolation")).toFile());
            concurrentSessions(Files.createDirectory(root.resolve("concurrent")).toFile());
            writesAndClose(Files.createDirectory(root.resolve("close")).toFile());
        } finally {
            // Only this invocation's freshly created temporary files are removed.
            try (Stream<Path> paths = Files.walk(root)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try { Files.delete(path); } catch (IOException e) { throw new java.io.UncheckedIOException(e); }
                });
            }
        }
        System.out.println("Project saves: private Unicode keys, bounds, failed write, process lock and close passed.");
    }
}
