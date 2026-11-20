// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Runs on a host JDK against the actual player classes, without an Activity or GL context. */
public final class ProjectReplayTapeTest {
    private static final int W = 360, H = 640;
    private interface Checked { void run() throws Exception; }
    private static void require(boolean passes) {
        if (!passes) throw new AssertionError();
    }
    private static void reject(Checked operation) throws Exception {
        try { operation.run(); } catch (IOException expected) { return; }
        throw new AssertionError("Expected an invalid tape to be rejected");
    }
    private static byte[] packet(int id, int slot) {
        ByteBuffer b = ByteBuffer.allocate(88).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x32524745).putInt(id).putInt(W).putInt(H).putInt(0x123456ff).putInt(1);
        b.put((byte)slot).put((byte)0xa0).put((byte)0x21).put((byte)0xfe).putFloat(0.75f);
        return b.array();
    }
    private static PlayerGraphics.Page page(int value) {
        return new PlayerGraphics.Page(1, 1, new byte[]{(byte)value, 25, (byte)190, (byte)127});
    }
    private static Map<Integer, PlayerGraphics.Page> slots(PlayerGraphics.Page page, boolean reverse) {
        Map<Integer, PlayerGraphics.Page> pages = new HashMap<>();
        pages.put(reverse ? 9 : 2, page);
        pages.put(reverse ? 2 : 9, page);
        return Collections.unmodifiableMap(pages);
    }
    private static ProjectReplayTape.Recorder fixture(boolean reverse) throws Exception {
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        PlayerGraphics.Page first = page(120), second = page(36);
        first.data.position(2);
        Map<Integer, PlayerGraphics.Page> a = slots(first, reverse);
        Map<Integer, PlayerGraphics.Page> b = Collections.singletonMap(9, second);
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++) {
            Map<Integer, PlayerGraphics.Page> pages = i < 2 ? a : i == 2 ? Collections.emptyMap() : b;
            int slot = i < 2 ? 2 : i == 2 ? 0 : 9;
            byte[] original = packet(i, slot);
            require(recorder.add(new PlayerGraphics.Frame(7, original, pages)) == (i == ProjectReplayTape.FRAMES - 1));
            original[16] = 0; // The captured packet owns its bytes.
        }
        require(first.data.position() == 2);
        return recorder;
    }

    private static void malformed(File file, byte[] original, int at, int value, boolean resign) throws Exception {
        byte[] bytes = original.clone();
        ByteBuffer.wrap(bytes).putInt(at, value);
        if (resign) {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(bytes, 0, bytes.length - 32);
            System.arraycopy(sha.digest(), 0, bytes, bytes.length - 32, 32);
        }
        Files.write(file.toPath(), bytes);
        reject(() -> ProjectReplayTape.read(file, W, H));
    }

    private static byte[] atlasPacket(int frameId, int width, int trimX, int turn) {
        ByteBuffer data = ByteBuffer.allocate(112).order(ByteOrder.LITTLE_ENDIAN);
        data.put(packet(frameId, 9));
        data.putInt(0, 0x33524745);
        // The single captured texel occupies one pixel inside a larger logical image.
        data.put(25, (byte)255).put(26, (byte)255).put(27, (byte)255);
        data.putFloat(40, 3f).putFloat(52, 3f);
        data.putFloat(64, 1f).putFloat(68, 1f).putFloat(80, W).putFloat(84, H);
        data.putInt(0).putInt(width).putInt(3).putInt(trimX).putInt(1).putInt(turn);
        return data.array();
    }

    private static void atlasReplay(File file) throws Exception {
        Map<Integer, PlayerGraphics.Page> pages = Collections.singletonMap(9, page(120));
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++) {
            byte[] bytes = i % 2 == 0 ? atlasPacket(i, 3, 1, 1) : packet(i, 9);
            recorder.add(new PlayerGraphics.Frame(4, bytes, pages));
        }
        recorder.write(file);
        ProjectReplayTape replay = ProjectReplayTape.read(file, W, H);
        require(Arrays.equals(replay.frame(0, 5).bytes, atlasPacket(0, 3, 1, 1)));
        require(Arrays.equals(replay.frame(1, 5).bytes, packet(1, 9)));

        ProjectReplayTape.Recorder empty = new ProjectReplayTape.Recorder(W, H);
        byte[] good = atlasPacket(0, 3, 1, 3);
        for (byte[] bad : new byte[][] {Arrays.copyOf(good, 88), Arrays.copyOf(good, 111),
                Arrays.copyOf(good, 136), atlasPacket(0, 3, 3, 0), atlasPacket(0, 1 << 21, 0, 0),
                atlasPacket(0, 3, 0, 4)}) {
            reject(() -> empty.add(new PlayerGraphics.Frame(2, bad, pages)));
        }
        for (int at : new int[]{0, 24, 88}) {
            byte[] bad = good.clone();
            if (at == 0) ByteBuffer.wrap(bad).order(ByteOrder.LITTLE_ENDIAN).putInt(0x32524745);
            else if (at == 24) bad[at] = 0;
            else bad[at] = 1;
            reject(() -> empty.add(new PlayerGraphics.Frame(2, bad, pages)));
        }
        byte[] two = new byte[24 + 2 * 64 + 2 * 24];
        ByteBuffer buffer = ByteBuffer.wrap(two).order(ByteOrder.LITTLE_ENDIAN);
        buffer.put(good, 0, 88).put(good, 24, 64).put(good, 88, 24).put(good, 88, 24);
        buffer.putInt(20, 2);
        reject(() -> empty.add(new PlayerGraphics.Frame(2, two, pages))); // Duplicate draw ordinal.
        buffer.putInt(152, 1);
        reject(() -> empty.add(new PlayerGraphics.Frame(2, two, pages))); // Out of order.
        buffer.putInt(152, 0).putInt(176, 1);
        require(empty.size() == 0);
        empty.add(new PlayerGraphics.Frame(2, two, pages));
        require(empty.size() == 1);
    }


    private static byte[] indexedPacket(int id, boolean mapped) {
        ByteBuffer b = ByteBuffer.allocate(24 + 52 + (mapped ? 20 : 0) + 3 * 16 + 3 * 4)
            .order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x34524745).putInt(id).putInt(W).putInt(H).putInt(0x123456ff).putInt(1);
        b.putInt(mapped ? 3 : 2).putInt(9).putFloat(1);
        for (float f : new float[]{0, 0, W, H, 0, 0, 1, 1}) b.putFloat(f);
        b.putInt(3).putInt(3);
        if (mapped) b.putInt(4).putInt(5).putInt(1).putInt(2).putInt(1);
        for (float f : new float[]{8, 8, 0, 0, 24, 8, 1, 0, 8, 24, 0, 1}) b.putFloat(f);
        b.putInt(2).putInt(0).putInt(1);
        return b.array();
    }

    private static byte[] mixedPacket(int id) {
        byte[] atlas = atlasPacket(id, 3, 1, 1);
        byte[] plainMesh = indexedPacket(id, false);
        byte[] mappedMesh = indexedPacket(id, true);
        ByteBuffer b = ByteBuffer.allocate(24 + 68 + 88 + plainMesh.length - 24 + mappedMesh.length - 24)
            .order(ByteOrder.LITTLE_ENDIAN);
        b.put(plainMesh, 0, 24).putInt(20, 4);
        b.putInt(0).put(atlas, 24, 64);
        b.put(plainMesh, 24, plainMesh.length - 24);
        b.putInt(1).put(atlas, 24, 64).put(atlas, 92, 20);
        b.put(mappedMesh, 24, mappedMesh.length - 24);
        return b.array();
    }

    private static void indexedReplay(File file) throws Exception {
        Map<Integer, PlayerGraphics.Page> pages = Collections.singletonMap(9, page(100));
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++) {
            byte[] bytes = i % 3 == 0 ? mixedPacket(i) :
                i % 3 == 1 ? indexedPacket(i, true) : atlasPacket(i, 3, 1, 1);
            recorder.add(new PlayerGraphics.Frame(4, bytes, pages));
        }
        recorder.write(file);
        ProjectReplayTape replay = ProjectReplayTape.read(file, W, H);
        require(Arrays.equals(mixedPacket(0), replay.frame(0, 9).bytes));
        require(Arrays.equals(indexedPacket(1, true), replay.frame(1, 9).bytes));
        require(replay.frame(0, 9).pages == replay.frame(1, 9).pages);

        ProjectReplayTape.Recorder empty = new ProjectReplayTape.Recorder(W, H);
        byte[] good = indexedPacket(0, false);
        for (int[] edit : new int[][]{{24, 4}, {28, 0}, {28, 256}, {32, 0x7fc00000},
                {44, 0x7f800000}, {60, 0}, {68, -1}, {68, Integer.MAX_VALUE}, {72, 4},
                {76, 0x7f800000}, {84, 0x7fc00000}, {good.length - 4, 3}}) {
            byte[] bad = good.clone();
            ByteBuffer.wrap(bad).order(ByteOrder.LITTLE_ENDIAN).putInt(edit[0], edit[1]);
            reject(() -> empty.add(new PlayerGraphics.Frame(1, bad, pages)));
        }
        byte[] noMesh = Arrays.copyOf(mixedPacket(0), 24 + 68);
        ByteBuffer.wrap(noMesh).order(ByteOrder.LITTLE_ENDIAN).putInt(20, 1);
        reject(() -> empty.add(new PlayerGraphics.Frame(1, noMesh, pages)));
        byte[] badMapping = indexedPacket(0, true);
        ByteBuffer.wrap(badMapping).order(ByteOrder.LITTLE_ENDIAN).putInt(92, 4);
        reject(() -> empty.add(new PlayerGraphics.Frame(1, badMapping, pages)));
        for (int length : new int[]{24, 72, good.length - 1, good.length + 4}) {
            reject(() -> empty.add(new PlayerGraphics.Frame(1, Arrays.copyOf(good, length), pages)));
        }
        reject(() -> empty.add(new PlayerGraphics.Frame(1, good, Collections.emptyMap())));
        require(empty.size() == 0);
    }

    public static void main(String[] args) throws Exception {
        File dir = Files.createTempDirectory("egret-project-tape-test").toFile();
        File file = new File(dir, "scene.bin");
        try {
            ProjectReplayTape.Recorder recorder = fixture(false);
            require(recorder.size() == 210);
            String digest = recorder.write(file);
            byte[] original = Files.readAllBytes(file.toPath());
            require(original.length < 210 * 100 + 100);
            require(digest.equals(fixture(true).write(file)));
            require(Arrays.equals(original, Files.readAllBytes(file.toPath())));
            ProjectReplayTape tape = ProjectReplayTape.read(file, W, H);
            require(digest.equals(tape.sha256()) && digest.matches("[0-9a-f]{64}"));
            PlayerGraphics.Frame first = tape.frame(0, 19), second = tape.frame(1, 19);
            require(first.epoch == 19 && tape.frame(0, 23).epoch == 23);
            require(Arrays.equals(first.bytes, packet(0, 2)) && Arrays.equals(second.bytes, packet(1, 2)));
            require(first.pages == second.pages && first.pages.get(2) == first.pages.get(9));
            require(first.pages.get(2).data.get(0) == 120 && first.pages.get(2).data.get(3) == 127);
            require(tape.frame(2, 19).pages.isEmpty());
            require(tape.frame(3, 19).pages.size() == 1 && tape.frame(3, 19).pages.get(9).data.get(0) == 36);
            require(tape.frame(3, 19).pages == tape.frame(209, 19).pages);
            require(tape.frame(209, 19).id() == 209);
            reject(() -> ProjectReplayTape.read(file, W + 1, H));
            ProjectReplayTape.Recorder partial = new ProjectReplayTape.Recorder(W, H);
            reject(() -> partial.write(file));
            require(Arrays.equals(original, Files.readAllBytes(file.toPath())));
            reject(() -> partial.add(new PlayerGraphics.Frame(1, packet(0, 9), Collections.emptyMap())));
            partial.add(new PlayerGraphics.Frame(1, packet(0, 0), Collections.emptyMap()));
            reject(() -> partial.add(new PlayerGraphics.Frame(2, packet(1, 0), Collections.emptyMap())));
            reject(() -> partial.add(new PlayerGraphics.Frame(1, packet(2, 0), Collections.emptyMap())));
            require(partial.size() == 1);
            malformed(file, original, 0, 3, false);
            malformed(file, original, 16, Integer.MAX_VALUE, true);
            malformed(file, original, 20, -1, true); // No previous snapshot to reuse.
            malformed(file, original, 25, 8, true); // Forward page-generation reference.
            malformed(file, original, 29, Integer.MAX_VALUE, true); // Invented page width.
            byte[] damaged = original.clone();
            damaged[damaged.length - 1] ^= 0x10;
            Files.write(file.toPath(), damaged);
            reject(() -> ProjectReplayTape.read(file, W, H));
            Files.write(file.toPath(), Arrays.copyOf(original, original.length - 10));
            reject(() -> ProjectReplayTape.read(file, W, H));
            Files.write(file.toPath(), Arrays.copyOf(original, original.length + 1));
            reject(() -> ProjectReplayTape.read(file, W, H));
            atlasReplay(file);
            indexedReplay(file);
            System.out.println("Project replay: EGR2/EGR3/EGR4 round-trip, page generations, identity and rejection passed.");
        } finally {
            Files.deleteIfExists(file.toPath());
            Files.deleteIfExists(dir.toPath());
        }
    }
    private ProjectReplayTapeTest() {}
}
