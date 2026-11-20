// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Objects;

/** App-private string storage. The host supplies the validated, case-sensitive project asset root. */
final class ProjectSaveStorage {
    private static final int MAX_KEY_UNITS = 256;
    private static final int MAX_BYTES = 1024 * 1024;
    private static final char[] HEX = "0123456789abcdef".toCharArray();
    // Java disallows overlapping file locks within one VM. Fixed stripes also bound lock bookkeeping.
    private static final class NamespaceLock { final Object publication = new Object(); }
    private static final NamespaceLock[] WRITERS = new NamespaceLock[32];
    static { for (int i = 0; i < WRITERS.length; i++) WRITERS[i] = new NamespaceLock(); }

    private final Path directory;
    private final NamespaceLock writer;
    private boolean closed;
    private int active;
    private Runnable drained;

    ProjectSaveStorage(File filesDir, String normalizedAssetRoot) {
        String namespace = digest(normalizedAssetRoot);
        directory = filesDir.toPath().resolve("egret-project-saves-v1").resolve(namespace);
        writer = WRITERS[Math.floorMod(namespace.hashCode(), WRITERS.length)];
    }

    private static String digest(String text) {
        byte[] bytes;
        try { bytes = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException e) { throw new AssertionError(e); }
        char[] chars = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int b = bytes[i] & 255;
            chars[2 * i] = HEX[b >>> 4];
            chars[2 * i + 1] = HEX[b & 15];
        }
        return new String(chars);
    }

    private static void validateText(String value, int units) {
        if (value == null || value.length() > units) throw new IllegalArgumentException("Invalid save string length");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (++i < value.length() && Character.isLowSurrogate(value.charAt(i))) continue;
            } else if (!Character.isLowSurrogate(c)) continue;
            throw new IllegalArgumentException("Save string contains an unpaired surrogate");
        }
    }

    private Path slot(String key) {
        validateText(key, MAX_KEY_UNITS);
        if (key.isEmpty()) throw new IllegalArgumentException("Empty save key");
        // Only digests become path components. A key containing a slash, NUL or .unread is ordinary data.
        return directory.resolve(digest(key) + ".save");
    }

    private synchronized void begin() {
        if (closed) throw new IllegalStateException("Project save storage is closed");
        active++;
    }

    private void end() {
        Runnable notify;
        synchronized (this) {
            if (--active != 0) return;
            notify = drained;
            drained = null;
        }
        if (notify != null) notify.run();
    }

    void closeWhenIdle(Runnable onIdle) {
        Objects.requireNonNull(onIdle);
        synchronized (this) {
            if (closed) return;
            closed = true;
            if (active != 0) {
                drained = onIdle;
                return;
            }
        }
        onIdle.run();
    }

    String getItem(String key) throws IOException {
        begin();
        try {
            Path path = slot(key);
            // Close the read handle before replacing a published file, including on filesystems
            // that deny rename over an open handle. Staging writes and their fsync stay independent.
            synchronized (writer.publication) {
                try (FileChannel input = FileChannel.open(path, StandardOpenOption.READ)) {
                    long length = input.size();
                    if (length > MAX_BYTES) throw new IOException("Invalid stored save size");
                    ByteBuffer bytes = ByteBuffer.allocate((int) length);
                    while (bytes.hasRemaining()) {
                        if (input.read(bytes) <= 0) throw new IOException("Incomplete stored save");
                    }
                    bytes.flip();
                    return StandardCharsets.UTF_8.newDecoder().decode(bytes).toString();
                } catch (NoSuchFileException missing) { return null; }
            }
        } finally { end(); }
    }

    void setItem(String key, String value) throws IOException {
        begin();
        try {
            Path target = slot(key);
            validateText(value, MAX_BYTES);
            byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Save exceeds UTF-8 byte limit");
            update(target, bytes);
        } finally { end(); }
    }

    void removeItem(String key) throws IOException {
        begin();
        try { update(slot(key), null); }
        finally { end(); }
    }

    private void update(Path target, byte[] bytes) throws IOException {
        synchronized (writer) {
            Files.createDirectories(directory);
            try (FileChannel channel = FileChannel.open(directory.resolve("writer.lock"),
                    StandardOpenOption.CREATE, StandardOpenOption.WRITE);
                 FileLock lock = channel.lock()) {
                Path staging = directory.resolve("pending");
                // The writer lock is released by the OS if a process dies. Its one orphan can now be reclaimed.
                Files.deleteIfExists(staging);
                if (bytes == null) {
                    synchronized (writer.publication) { Files.deleteIfExists(target); }
                    return;
                }
                boolean committed = false;
                try {
                    try (FileChannel out = FileChannel.open(staging, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                        ByteBuffer payload = ByteBuffer.wrap(bytes);
                        while (payload.hasRemaining()) out.write(payload);
                        out.force(true);
                    }
                    synchronized (writer.publication) {
                        Files.move(staging, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                    }
                    committed = true;
                } finally {
                    if (!committed) Files.deleteIfExists(staging);
                }
            }
        }
    }
}
