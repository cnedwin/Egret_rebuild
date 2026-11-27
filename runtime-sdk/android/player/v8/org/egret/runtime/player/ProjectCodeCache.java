// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Comparator;

/** Private, disposable V8 artifacts. Source in the signed APK remains authoritative. */
final class ProjectCodeCache {
    private static final int MAX_RECORD = 1 << 20;
    private static final int MAX_BYTES = 8 << 20;
    private static final int MAX_FILES = 96;
    private static final int HEADER = 32;
    private static final char[] HEX = "0123456789abcdef".toCharArray();
    private final File directory;
    private final String environment;
    private int eligible;

    ProjectCodeCache(File parent, String environment) {
        this.directory = new File(parent, "egret-v8-compiled-v1");
        this.environment = environment;
    }

    String key(String path, byte[] source) {
        // Avoid disk traffic on tiny helpers and cap work on very large manifests.
        if (source.length < 8192 || eligible >= 64) return null;
        eligible++;
        MessageDigest sha = digest();
        sha.update(environment.getBytes(StandardCharsets.UTF_8));
        sha.update((byte)0);
        sha.update(path.getBytes(StandardCharsets.UTF_8));
        sha.update((byte)0);
        return hex(sha.digest(source));
    }

    private static MessageDigest digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException absent) { throw new AssertionError(absent); }
    }

    private static String hex(byte[] bytes) {
        char[] text = new char[2 * bytes.length];
        for (int i = 0; i < bytes.length; i++) {
            text[2 * i] = HEX[(bytes[i] >>> 4) & 15];
            text[2 * i + 1] = HEX[bytes[i] & 15];
        }
        return new String(text);
    }

    private static byte[] fingerprint(String key, byte[] payload) {
        MessageDigest sha = digest();
        sha.update(key.getBytes(StandardCharsets.US_ASCII));
        return sha.digest(payload);
    }

    byte[] read(String key) {
        File file = new File(directory, key + ".bin");
        try (DataInputStream input = new DataInputStream(new FileInputStream(file))) {
            long size = file.length() - HEADER;
            if (size <= 0 || size > MAX_RECORD) return null;
            byte[] identity = new byte[HEADER], payload = new byte[(int)size];
            input.readFully(identity);
            input.readFully(payload);
            if (input.read() != -1 || !MessageDigest.isEqual(identity, fingerprint(key, payload))) return null;
            return payload;
        } catch (IOException | SecurityException ignored) { return null; }
    }

    boolean write(String key, byte[] payload) {
        if (payload == null || payload.length == 0 || payload.length > MAX_RECORD) return false;
        // A process lock also coordinates a second Android process sharing this app's cache.
        // Contention, an OS purge or a full disk can only discard an optional compilation hint.
        try {
            if (!directory.isDirectory() && !directory.mkdirs() && !directory.isDirectory()) return false;
            try (FileOutputStream lockFile = new FileOutputStream(new File(directory, ".lock"), true);
                 FileLock lock = lockFile.getChannel().tryLock()) {
                if (lock == null) return false;
                File target = new File(directory, key + ".bin");
                File[] files = directory.listFiles((dir, name) -> name.endsWith(".bin") || name.equals("pending"));
                if (files == null) return false;
                Arrays.sort(files, Comparator.comparingLong(File::lastModified));
                long bytes = payload.length + HEADER;
                int count = 1;
                for (File file : files) {
                    if (file.equals(target) || file.getName().equals("pending")) {
                        if (!file.delete()) return false;
                    } else {
                        bytes += file.length();
                        count++;
                    }
                }
                for (File file : files) {
                    if (bytes <= MAX_BYTES && count <= MAX_FILES) break;
                    if (!file.exists()) continue;
                    long size = file.length();
                    if (!file.delete()) return false;
                    bytes -= size;
                    count--;
                }
                File pending = new File(directory, "pending");
                try {
                    try (FileOutputStream out = new FileOutputStream(pending)) {
                        out.write(fingerprint(key, payload));
                        out.write(payload);
                    }
                    return pending.renameTo(target);
                } finally { if (pending.exists()) pending.delete(); }
            }
        } catch (IOException | SecurityException | java.nio.channels.OverlappingFileLockException ignored) { return false; }
    }
}
