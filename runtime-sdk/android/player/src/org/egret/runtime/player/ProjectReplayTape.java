// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.TreeMap;

/** A bounded, local recording of the exact project submissions and immutable RGBA page versions. */
final class ProjectReplayTape {
    static final int FRAMES = 210;
    private static final int MAGIC = 0x45475250, VERSION = 1, EGR2 = 0x32524745, EGR3 = 0x33524745;
    private static final int MAX_BYTES = 64 << 20, MAX_GENERATIONS = 4096, CHECKSUM = 32;
    private static final int HEADER = 5 * Integer.BYTES, REUSE = -1;
    private final PlayerGraphics.Frame[] frames;
    private final String digest;

    private ProjectReplayTape(PlayerGraphics.Frame[] frames, byte[] checksum) {
        this.frames = frames;
        digest = hex(checksum);
    }
    String sha256() { return digest; }
    PlayerGraphics.Frame frame(int index, int epoch) {
        PlayerGraphics.Frame stored = frames[index];
        return new PlayerGraphics.Frame(epoch, stored.bytes, stored.pages);
    }

    static final class Recorder {
        private final int width, height;
        private final ArrayList<PlayerGraphics.Frame> frames = new ArrayList<>(FRAMES);
        private final IdentityHashMap<PlayerGraphics.Page, Boolean> pages = new IdentityHashMap<>();
        private long fileBytes = HEADER + CHECKSUM;

        Recorder(int width, int height) {
            if (!dimension(width) || !dimension(height)) throw new IllegalArgumentException("Invalid replay stage");
            this.width = width;
            this.height = height;
        }
        int size() { return frames.size(); }

        // Call after a successful native draw. Published page maps and Page objects are
        // immutable; the command packet is copied only on this opt-in capture path.
        boolean add(PlayerGraphics.Frame frame) throws IOException {
            int index = frames.size();
            if (index == FRAMES || (index != 0 && frame.epoch != frames.get(0).epoch))
                throw new IOException("Replay collection crossed its session boundary");
            validatePacket(frame.bytes, index, width, height, frame.pages);
            long next = fileBytes + 8 + frame.bytes.length;
            Map<Integer, PlayerGraphics.Page> previous = index == 0 ? null : frames.get(index - 1).pages;
            if (!frame.pages.equals(previous)) {
                if (frame.pages.size() > 255) throw new IOException("Too many replay slots");
                IdentityHashMap<PlayerGraphics.Page, Boolean> added = new IdentityHashMap<>();
                next += 5L * frame.pages.size();
                for (Map.Entry<Integer, PlayerGraphics.Page> entry : frame.pages.entrySet()) {
                    Integer slot = entry.getKey();
                    PlayerGraphics.Page page = entry.getValue();
                    if (slot == null || slot < 1 || slot > 255 || page == null)
                        throw new IOException("Invalid replay page slot");
                    if (!pages.containsKey(page) && added.put(page, true) == null) {
                        int length = pageLength(page.width, page.height);
                        if (page.data.capacity() != length) throw new IOException("Invalid RGBA storage");
                        next += 8L + length;
                    }
                }
                if (pages.size() + added.size() > MAX_GENERATIONS || next > MAX_BYTES)
                    throw new IOException("Replay capture exceeds its storage budget");
                pages.putAll(added);
            }
            if (next > MAX_BYTES) throw new IOException("Replay capture exceeds its storage budget");
            frames.add(new PlayerGraphics.Frame(frame.epoch, frame.bytes.clone(), frame.pages));
            fileBytes = next;
            return frames.size() == FRAMES;
        }

        // Serialize off the render thread. Rename only after every payload byte and its
        // digest reach disk; a rejected capture or interrupted write leaves the old tape intact.
        String write(File target) throws IOException {
            if (frames.size() != FRAMES) throw new IOException("Incomplete replay");
            File temp = File.createTempFile("egret-replay-", ".tmp", target.getAbsoluteFile().getParentFile());
            try {
                MessageDigest sha = sha256Digest();
                byte[] checksum;
                try (FileOutputStream file = new FileOutputStream(temp);
                     DigestOutputStream hash = new DigestOutputStream(new BufferedOutputStream(file), sha);
                     DataOutputStream out = new DataOutputStream(hash)) {
                    out.writeInt(MAGIC); out.writeInt(VERSION);
                    out.writeInt(width); out.writeInt(height); out.writeInt(FRAMES);
                    IdentityHashMap<PlayerGraphics.Page, Integer> ids = new IdentityHashMap<>();
                    Map<Integer, PlayerGraphics.Page> previous = null;
                    byte[] block = new byte[16384];
                    for (PlayerGraphics.Frame frame : frames) {
                        if (frame.pages.equals(previous)) out.writeInt(REUSE);
                        else {
                            out.writeInt(frame.pages.size());
                            // Insertion order differs between VMs. Slot order defines generation identity.
                            for (Map.Entry<Integer, PlayerGraphics.Page> entry : new TreeMap<>(frame.pages).entrySet()) {
                                out.writeByte(entry.getKey());
                                PlayerGraphics.Page page = entry.getValue();
                                Integer known = ids.get(page);
                                if (known != null) out.writeInt(known);
                                else {
                                    int id = ids.size() + 1;
                                    ids.put(page, id);
                                    out.writeInt(id); out.writeInt(page.width); out.writeInt(page.height);
                                    ByteBuffer data = page.data.duplicate();
                                    data.clear();
                                    while (data.hasRemaining()) {
                                        int count = Math.min(block.length, data.remaining());
                                        data.get(block, 0, count);
                                        out.write(block, 0, count);
                                    }
                                }
                            }
                            previous = frame.pages;
                        }
                        out.writeInt(frame.bytes.length);
                        out.write(frame.bytes);
                    }
                    checksum = sha.digest();
                    hash.on(false);
                    out.write(checksum);
                    out.flush();
                    file.getFD().sync();
                }
                Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
                return hex(checksum);
            } finally { Files.deleteIfExists(temp.toPath()); }
        }
    }

    static ProjectReplayTape read(File file, int width, int height) throws IOException {
        // Use the open file's size so a concurrent atomic replacement cannot change
        // the length bound for the inode being parsed.
        try (FileInputStream source = new FileInputStream(file);
             DataInputStream raw = new DataInputStream(new BufferedInputStream(source))) {
            long size = source.getChannel().size();
            if (size < HEADER + CHECKSUM || size > MAX_BYTES || !dimension(width) || !dimension(height))
                throw new IOException("Invalid replay size or stage");
            MessageDigest sha = sha256Digest();
            Input in = new Input(raw, sha, size - CHECKSUM);
            if (in.integer() != MAGIC || in.integer() != VERSION || in.integer() != width
                || in.integer() != height || in.integer() != FRAMES) throw new IOException("Replay header mismatch");
            ArrayList<PlayerGraphics.Page> generations = new ArrayList<>();
            PlayerGraphics.Frame[] frames = new PlayerGraphics.Frame[FRAMES];
            Map<Integer, PlayerGraphics.Page> snapshot = null;
            for (int index = 0; index < FRAMES; index++) {
                int count = in.integer();
                if (count == REUSE) {
                    if (snapshot == null) throw new IOException("Missing initial page snapshot");
                } else {
                    if (count < 0 || count > 255) throw new IOException("Invalid replay snapshot");
                    Map<Integer, PlayerGraphics.Page> current = new HashMap<>();
                    int last = 0;
                    for (int slotIndex = 0; slotIndex < count; slotIndex++) {
                        int slot = in.slot(), generation = in.integer();
                        if (slot <= last || generation < 1 || generation > generations.size() + 1
                            || generation > MAX_GENERATIONS) throw new IOException("Invalid replay slot or generation");
                        last = slot;
                        if (generation > generations.size()) {
                            int w = in.integer(), h = in.integer();
                            generations.add(new PlayerGraphics.Page(w, h, in.bytes(pageLength(w, h))));
                        }
                        current.put(slot, generations.get(generation - 1));
                    }
                    snapshot = Collections.unmodifiableMap(current);
                }
                int length = in.integer();
                if (length < 24 || length > PlayerGraphics.MAX_FRAME_BYTES)
                    throw new IOException("Invalid replay command size");
                byte[] bytes = in.bytes(length);
                validatePacket(bytes, index, width, height, snapshot);
                frames[index] = new PlayerGraphics.Frame(0, bytes, snapshot);
            }
            if (in.remaining != 0) throw new IOException("Trailing replay payload");
            byte[] actual = sha.digest(), expected = new byte[CHECKSUM];
            raw.readFully(expected);
            if (!MessageDigest.isEqual(actual, expected) || raw.read() != -1)
                throw new IOException("Replay checksum or length mismatch");
            return new ProjectReplayTape(frames, actual);
        }
    }

    // Reject claimed lengths before allocating from them and exclude the checksum
    // trailer from the hash. The file's outer limit bounds all preloaded frames and pages.
    private static final class Input {
        private final DataInputStream stream;
        private long remaining;
        Input(DataInputStream raw, MessageDigest sha, long remaining) {
            stream = new DataInputStream(new DigestInputStream(raw, sha));
            this.remaining = remaining;
        }
        void take(int n) throws IOException {
            if (n < 0 || n > remaining) throw new IOException("Truncated replay payload");
            remaining -= n;
        }
        int integer() throws IOException { take(4); return stream.readInt(); }
        int slot() throws IOException { take(1); return stream.readUnsignedByte(); }
        byte[] bytes(int n) throws IOException {
            take(n);
            byte[] bytes = new byte[n];
            stream.readFully(bytes);
            return bytes;
        }
    }

    private static boolean dimension(int v) { return v >= 1 && v <= 16384; }
    private static int pageLength(int w, int h) throws IOException {
        long bytes = (long)w * h * 4;
        if (!dimension(w) || !dimension(h) || bytes > MAX_BYTES) throw new IOException("Invalid replay page size");
        return (int)bytes;
    }
    private static void validatePacket(byte[] bytes, int id, int width, int height, Map<Integer, PlayerGraphics.Page> pages)
        throws IOException {
        if (bytes == null || bytes.length < 24 || bytes.length > PlayerGraphics.MAX_FRAME_BYTES)
            throw new IOException("Invalid project packet length");
        ByteBuffer data = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        int format = data.getInt(0), quads = data.getInt(20);
        if ((format != EGR2 && format != EGR3) || data.getInt(4) != id || data.getInt(8) != width
            || data.getInt(12) != height || quads < 0 || quads > PlayerGraphics.MAX_QUADS)
            throw new IOException("Invalid or discontinuous project frame");
        int recordsEnd = 24 + quads * PlayerGraphics.QUAD_BYTES;
        int tail = bytes.length - recordsEnd;
        if (format == EGR2 ? tail != 0 :
                tail <= 0 || tail % PlayerGraphics.ATLAS_BYTES != 0 || tail / PlayerGraphics.ATLAS_BYTES > quads)
            throw new IOException("Invalid project atlas table length");
        for (int i = 24; i < recordsEnd; i += PlayerGraphics.QUAD_BYTES) {
            int slot = bytes[i] & 255;
            if (slot != 0 && !pages.containsKey(slot)) throw new IOException("Missing project page " + slot);
        }
        // Saved frames may mix packet versions. The sparse suffix always indexes draw records.
        int previous = -1;
        for (int i = recordsEnd; i < bytes.length; i += PlayerGraphics.ATLAS_BYTES) {
            int ordinal = data.getInt(i), w = data.getInt(i+4), h = data.getInt(i+8);
            int x = data.getInt(i+12), y = data.getInt(i+16), turn = data.getInt(i+20);
            if (ordinal <= previous || ordinal >= quads || w < 1 || h < 1 || w > (1 << 20) || h > (1 << 20)
                || x < 0 || x >= w || y < 0 || y >= h || turn < 0 || turn > 3)
                throw new IOException("Invalid project atlas descriptor");
            int record = 24 + ordinal * PlayerGraphics.QUAD_BYTES;
            PlayerGraphics.Page page = pages.get(bytes[record] & 255);
            if (page == null) throw new IOException("Atlas descriptor requires a texture");
            int packedWidth = texelEdge(data.getFloat(record+40), page.width) - texelEdge(data.getFloat(record+32), page.width);
            int packedHeight = texelEdge(data.getFloat(record+44), page.height) - texelEdge(data.getFloat(record+36), page.height);
            boolean odd = (turn & 1) != 0;
            if (packedWidth <= 0 || packedHeight <= 0 || (odd ? packedHeight : packedWidth) > w - x
                || (odd ? packedWidth : packedHeight) > h - y)
                throw new IOException("Atlas content exceeds its logical region");
            previous = ordinal;
        }
    }

    private static int texelEdge(float uv, int extent) throws IOException {
        int texel = Math.round(uv * extent);
        if (!(uv >= 0 && uv <= 1) || (float)texel / extent != uv)
            throw new IOException("Atlas bounds must identify page texel edges");
        return texel;
    }
    private static MessageDigest sha256Digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException impossible) { throw new AssertionError(impossible); }
    }
    private static String hex(byte[] bytes) {
        char[] digits = "0123456789abcdef".toCharArray(), out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            out[2 * i] = digits[(bytes[i] & 255) >>> 4];
            out[2 * i + 1] = digits[bytes[i] & 15];
        }
        return new String(out);
    }
}
