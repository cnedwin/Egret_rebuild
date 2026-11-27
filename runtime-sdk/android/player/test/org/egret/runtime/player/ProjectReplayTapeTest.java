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

    private static byte[] isolatedPacket(int id) {
        byte[] quad = packet(id, 0);
        ByteBuffer b = ByteBuffer.allocate(24 + 28 + 68 + 4).order(ByteOrder.LITTLE_ENDIAN);
        b.put(quad, 0, 24).putInt(0, 0x36524745).putInt(20, 3);
        b.putInt(128).putInt(2).putFloat(0).putFloat(0).putFloat(W).putFloat(H).putFloat(3);
        b.putInt(0).put(quad, 24, 64).putInt(129);
        // The draw begins at byte 56. Use the whole UV region and logical surface.
        b.putFloat(96, 1).putFloat(100, 1).putFloat(112, W).putFloat(116, H);
        return b.array();
    }

    private static void effectReplay(File file) throws Exception {
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        byte[] original = isolatedPacket(0);
        for (int[] edit : new int[][]{{24, 129}, {28, 0}, {28, 32}, {48, 0x7fc00000}, {48, 0x41200000}, {120, 128}, {20, 2},
                {60, 0x7fc00000}, {64, 0x4c000000}, {96, 0}, {116, 0x7fc00000}}) {
            byte[] bad = original.clone();
            ByteBuffer.wrap(bad).order(ByteOrder.LITTLE_ENDIAN).putInt(edit[0], edit[1]);
            reject(() -> recorder.add(new PlayerGraphics.Frame(1, bad, Collections.emptyMap())));
        }
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++)
            recorder.add(new PlayerGraphics.Frame(1, isolatedPacket(i), Collections.emptyMap()));
        recorder.write(file);
        ProjectReplayTape tape = ProjectReplayTape.read(file, W, H);
        require(Arrays.equals(tape.frame(2, 1).bytes, isolatedPacket(2)));
    }

    private static void materialReplay() throws Exception {
        byte[] mesh = indexedPacket(0, false);
        ByteBuffer colored = ByteBuffer.allocate(mesh.length + 3 * 16).order(ByteOrder.LITTLE_ENDIAN);
        colored.put(mesh, 0, 76).putInt(0, 0x35524745).putInt(24, 2 | 8 | 32);
        for (int i = 0; i < 3; i++) {
            colored.put(mesh, 76 + 16*i, 16);
            for (float c : new float[]{0.25f, 0.5f, 0.7f, 1f}) colored.putFloat(c);
        }
        colored.put(mesh, mesh.length - 12, 12);
        Map<Integer, PlayerGraphics.Page> pages = Collections.singletonMap(9, page(100));
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        for (int[] edit : new int[][]{{24, 64}, {24, 2 | 4 | 8}, {92, 0x7fc00000}, {92, 0xbf800000}}) {
            byte[] bad = colored.array().clone();
            ByteBuffer.wrap(bad).order(ByteOrder.LITTLE_ENDIAN).putInt(edit[0], edit[1]);
            reject(() -> recorder.add(new PlayerGraphics.Frame(1, bad, pages)));
        }
        recorder.add(new PlayerGraphics.Frame(1, colored.array(), pages));
        require(recorder.size() == 1);
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

    private static void texturedWorldOverlay() throws Exception {
        int draw = 160 + 12 + 3 * 32 + 3 * 4, hud = draw + 96;
        ByteBuffer data = ByteBuffer.allocate(hud + 24).order(ByteOrder.LITTLE_ENDIAN);
        data.putInt(0, WorldProjectPacket.TEXTURED_MAGIC).putInt(8, 24).putInt(12, 1).putInt(16, 1).putInt(20, 255);
        data.putInt(160, 19).putInt(164, 3).putInt(168, 3);
        data.putInt(draw - 8, 1).putInt(draw - 4, 2).putInt(draw, 19).putInt(draw + 88, 1).putInt(draw + 92, 1);
        data.putInt(hud, 0x32524745).putInt(hud + 8, 960).putInt(hud + 12, 540);
        int[] visited = {0};
        WorldProjectPacket.visitTexturePages(data, id -> visited[0] += id);
        require(visited[0] == 1);
        reject(() -> WorldProjectPacket.validate(data.array(), Collections.emptyMap(), null));
        Map<Integer, PlayerGraphics.Page> pages = Collections.singletonMap(1, new PlayerGraphics.Page(1, 1, new byte[4]));
        require(WorldProjectPacket.validate(data.array(), pages, null).hudOffset == hud);
        data.putInt(draw + 92, 2);
        reject(() -> WorldProjectPacket.validate(data.array(), pages, null));
    }

    private static void residentWorldOverlay() throws Exception {
        Map<Integer, PlayerGraphics.Page> pages = Collections.singletonMap(9, page(120));
        for (boolean textured : new boolean[]{false, true}) {
            int stride = textured ? 32 : 24, drawBytes = textured ? 96 : 88;
            int draw = 160 + 12 + 3 * stride + 3 * 4, hud = draw + drawBytes;
            ByteBuffer full = ByteBuffer.allocate(hud + 24).order(ByteOrder.LITTLE_ENDIAN);
            full.putInt(0, textured ? WorldProjectPacket.TEXTURED_MAGIC : WorldProjectPacket.MAGIC);
            full.putInt(8, 24).putInt(12, 1).putInt(16, 1).putInt(20, 255);
            full.putInt(160, 19).putInt(164, 3).putInt(168, 3);
            full.putInt(draw - 8, 1).putInt(draw - 4, 2).putInt(draw, 19);
            if (textured) full.putInt(draw + 88, 9);
            full.putInt(hud, 0x32524745).putInt(hud + 8, W).putInt(hud + 12, H);
            ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
            recorder.add(new PlayerGraphics.Frame(1, full.array(), pages));

            // The next packet borrows the previous mesh but carries its own draw and texture slot.
            ByteBuffer delta = ByteBuffer.allocate(164 + drawBytes + 24).order(ByteOrder.LITTLE_ENDIAN);
            delta.put(full.array(), 0, 160).putInt(0).put(full.array(), draw, drawBytes + 24);
            delta.putInt(0, textured ? WorldProjectPacket.TEXTURED_DELTA_MAGIC : WorldProjectPacket.DELTA_MAGIC);
            delta.putInt(4, 1).putInt(12, 0).putInt(164 + drawBytes + 4, 1);
            require(WorldProjectPacket.stageOffset(delta) == 164 + drawBytes);
            int[] visits = {0, 0};
            WorldProjectPacket.visitTexturePages(delta, id -> { visits[0]++; visits[1] = id; });
            require(visits[0] == (textured ? 1 : 0) && visits[1] == (textured ? 9 : 0));
            reject(() -> new ProjectReplayTape.Recorder(W, H).add(new PlayerGraphics.Frame(1, delta.array(), pages)));
            reject(() -> recorder.add(new PlayerGraphics.Frame(1, null, pages)));
            reject(() -> recorder.add(new PlayerGraphics.Frame(1, new byte[20], pages)));
            require(recorder.size() == 1);
            recorder.add(new PlayerGraphics.Frame(1, delta.array(), pages));
            require(recorder.size() == 2);

            // Keep a complete HUD but truncate the predecessor field. A full-frame header would accept this.
            ByteBuffer truncated = ByteBuffer.allocate(160 + 24).order(ByteOrder.LITTLE_ENDIAN);
            truncated.put(delta.array(), 0, 160).put(delta.array(), 164 + drawBytes, 24);
            require(WorldProjectPacket.stageOffset(truncated) == -1);
            if (textured) {
                delta.putInt(16, 2); // Only one draw record fits before the HUD.
                try {
                    WorldProjectPacket.visitTexturePages(delta, id -> { throw new AssertionError("Partial draw visited"); });
                    throw new AssertionError("Truncated resident draw table accepted");
                } catch (IllegalArgumentException expected) { }
            }
        }
    }

    // Negative definition keys describe a new byte version of the same positive wire ID.
    private static byte[] world(int id, boolean textured, boolean delta, int[] definitions, int[] draws, int vertices) {
        int stride = textured ? 32 : 24, drawBytes = textured ? 96 : 88;
        int header = delta ? 164 : 160;
        ByteBuffer b = ByteBuffer.allocate(header + definitions.length * (24 + vertices * stride)
            + draws.length * drawBytes + 24).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0, textured ? (delta ? WorldProjectPacket.TEXTURED_DELTA_MAGIC : WorldProjectPacket.TEXTURED_MAGIC)
            : (delta ? WorldProjectPacket.DELTA_MAGIC : WorldProjectPacket.MAGIC));
        b.putInt(4, id).putInt(8, 24).putInt(12, definitions.length).putInt(16, draws.length).putInt(20, 255);
        b.putFloat(88, id); // Changing camera.
        if (delta) b.putInt(160, id - 1);
        b.position(header);
        for (int key : definitions) {
            b.putInt(Math.abs(key)).putInt(vertices).putInt(3);
            int start = b.position();
            b.putFloat(key);
            b.position(start + vertices * stride);
            b.putInt(0).putInt(1).putInt(2);
        }
        for (int i = 0; i < draws.length; i++) {
            int start = b.position();
            b.putInt(start, draws[i]).putFloat(start + 4, id + i);
            if (textured) b.putInt(start + 88, 9);
            b.position(start + drawBytes);
        }
        b.putInt(0x32524745).putInt(id).putInt(W).putInt(H).putInt(0).putInt(0);
        return b.array();
    }

    private static void residentReplay(File file) throws Exception {
        int[] empty = {}, a = {19}, b = {27}, both = {19, 27}, reordered = {27, 19};
        Map<Integer, PlayerGraphics.Page> firstPage = Collections.singletonMap(9, page(45));
        Map<Integer, PlayerGraphics.Page> secondPage = Collections.singletonMap(9, page(67));
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        long expectedSize = 20 + 32;
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++) {
            Map<Integer, PlayerGraphics.Page> pages = i < 77 ? firstPage : secondPage;
            int[] defs = i == 0 ? both : i == 50 ? new int[]{-19} : i == 60 ? b : empty;
            int[] draws = i < 50 ? ordered(i, both, reordered) : i < 60 ? a : reordered;
            byte[] bytes = world(i, true, i != 0, defs, draws, 3);
            expectedSize += 8L + bytes.length + (i == 0 || i == 77 ? 17 : 0);
            if (i == 51) {
                // Culling retired #27. Refusing its stale reference must leave #19 available for the retry.
                final int index = i;
                reject(() -> recorder.add(new PlayerGraphics.Frame(4, world(index, true, true, empty, b, 3), pages)));
                reject(() -> recorder.add(new PlayerGraphics.Frame(4, world(index, true, true, b, a, 3), pages)));
                reject(() -> recorder.add(new PlayerGraphics.Frame(4, world(index, false, true, empty, a, 3), pages)));
                reject(() -> recorder.add(new PlayerGraphics.Frame(4, bytes, Collections.emptyMap())));
                byte[] wrongBase = bytes.clone(); ByteBuffer.wrap(wrongBase).order(ByteOrder.LITTLE_ENDIAN).putInt(160, 0);
                reject(() -> recorder.add(new PlayerGraphics.Frame(4, wrongBase, pages)));
                require(recorder.size() == i);
            }
            recorder.add(new PlayerGraphics.Frame(4, bytes, pages));
            Arrays.fill(bytes, (byte)0); // The source bridge may release its buffer after capture.
        }
        String digest = recorder.write(file);
        byte[] contents = Files.readAllBytes(file.toPath());
        require(contents.length == expectedSize && ByteBuffer.wrap(contents).getInt(4) == 2);
        ProjectReplayTape tape = ProjectReplayTape.read(file, W, H);
        require(tape.sha256().equals(digest));
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++) {
            int[] draws = i < 50 ? ordered(i, both, reordered) : i < 60 ? a : reordered;
            int[] expectedDefinitions = i < 50 ? draws : i < 60 ? new int[]{-19} : new int[]{27, -19};
            PlayerGraphics.Frame full = tape.fullFrame(i, 11);
            require(full.epoch == 11 && full.pages == tape.frame(i, 40).pages);
            require(full.pages.get(9).data.get(0) == (i < 77 ? 45 : 67));
            require(Arrays.equals(full.bytes, world(i, true, false, expectedDefinitions, draws, 3)));
        }
        // A valid checksum must not hide a v2 stream masquerading as v1, or a false predecessor.
        malformed(file, contents, 4, 1, true);
        int secondCommand = 20 + 4 + 17 + 4 + world(0, true, false, both, both, 3).length + 8;
        malformed(file, contents, secondCommand + 160, Integer.reverseBytes(17), true);
    }

    private static byte[] posePacket(int id, boolean delta) {
        int definitionBytes = delta ? 0 : 12 + 3 * 68 + 12;
        int palette = (delta ? 168 : 164) + definitionBytes;
        int draw = palette + 68, hud = draw + 128;
        ByteBuffer data = ByteBuffer.allocate(hud + 24).order(ByteOrder.LITTLE_ENDIAN);
        data.putInt(0, delta ? WorldProjectPacket.SKINNED_DELTA_MAGIC : WorldProjectPacket.SKINNED_MAGIC);
        data.putInt(4, id).putInt(8, 24).putInt(12, delta ? 0 : 1).putInt(16, 1).putInt(20, 255);
        if (delta) data.putInt(160, id - 1);
        data.putInt(delta ? 164 : 160, 68);
        if (!delta) {
            data.putInt(164, 19).putInt(168, 3).putInt(172, 3);
            for (int i = 0; i < 3; i++) data.putFloat(176 + 68*i + 36, 1);
            data.putInt(palette - 8, 1).putInt(palette - 4, 2);
        }
        data.putInt(palette, 1).putFloat(palette + 4 + 48, id * 0.125f);
        data.putInt(draw, 19).putInt(draw + 88, 1).putInt(draw + 92, 3);
        data.putInt(draw + 96, 2).putInt(draw + 100, 2).putInt(draw + 104, 1);
        data.putFloat(draw + 108, 1).putFloat(draw + 112, 1).putFloat(draw + 124, 3.2f);
        data.putInt(hud, 0x32524745).putInt(hud + 4, id).putInt(hud + 8, W).putInt(hud + 12, H);
        return data.array();
    }

    private static void skinnedReplay(File file) throws Exception {
        Map<Integer, PlayerGraphics.Page> pages = new java.util.HashMap<>();
        pages.put(1, page(93)); pages.put(2, page(120));
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        for (int id = 0; id < ProjectReplayTape.FRAMES; id++) {
            byte[] pose = posePacket(id, id != 0);
            if (id == 0) {
                byte[] invalidJoint = pose.clone();
                invalidJoint[176 + 32] = 1;
                reject(() -> recorder.add(new PlayerGraphics.Frame(3, invalidJoint, pages)));
            }
            if (id == 1) {
                int draw = 168 + 68;
                for (int[] edit : new int[][]{{164, -4}, {168, 0}, {168, 57}, {172, 0x7fc00000},
                        {draw + 96, 3}, {draw + 104, 2}, {draw + 112, 0x7f800000}, {draw + 124, 0xbf800000}}) {
                    byte[] bad = pose.clone();
                    ByteBuffer.wrap(bad).order(ByteOrder.LITTLE_ENDIAN).putInt(edit[0], edit[1]);
                    reject(() -> recorder.add(new PlayerGraphics.Frame(3, bad, pages)));
                }
                int[] visits = {0, 0};
                WorldProjectPacket.visitTexturePages(ByteBuffer.wrap(pose).order(ByteOrder.LITTLE_ENDIAN),
                    page -> visits[0] += page, page -> visits[1] += page);
                require(visits[0] == 1 && visits[1] == 4);
            }
            recorder.add(new PlayerGraphics.Frame(3, pose, pages));
        }
        recorder.write(file);
        ProjectReplayTape replay = ProjectReplayTape.read(file, W, H);
        for (int i = 0; i < ProjectReplayTape.FRAMES; i++) {
            require(Arrays.equals(posePacket(i, i != 0), replay.frame(i, 9).bytes));
            require(Arrays.equals(posePacket(i, false), replay.fullFrame(i, 10).bytes));
        }
    }

    private static void invalidBatch(Runnable call) {
        try { call.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("Expected invalid World3D batch sequence");
    }

    private static ByteBuffer batchHeader(int id, int index, int count) {
        ByteBuffer b = ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(WorldProjectPacket.BATCH_MAGIC).putInt(id).putInt(index).putInt(count).putInt(1)
            .putInt(WorldProjectPacket.SKINNED_MAGIC);
        return b;
    }

    private static void streamedTransport(File directory) throws Exception {
        WorldProjectPacket.Batches batches = new WorldProjectPacket.Batches();
        ByteBuffer first = batchHeader(0, 0, 2), second = batchHeader(0, 1, 2);
        ByteBuffer draw = ByteBuffer.allocate(200).order(ByteOrder.LITTLE_ENDIAN);
        draw.putInt(0, WorldProjectPacket.STREAM_MAGIC).putInt(8, 24).putInt(160, 1).putInt(168, 2);
        draw.putInt(176, 0x32524745).putInt(184, W).putInt(188, H);
        require(WorldProjectPacket.stageOffset(draw) == 176 && !WorldProjectPacket.incremental(draw));
        require(WorldProjectPacket.byteLimit(WorldProjectPacket.BATCH_MAGIC) == 2 * 1024 * 1024);
        invalidBatch(() -> batches.add(4, second, second.array()));
        batches.add(4, first, first.array());
        invalidBatch(() -> batches.finish(4, draw));
        batches.add(4, first, first.array());
        invalidBatch(() -> batches.add(5, second, second.array()));
        batches.add(5, first, first.array());
        batches.add(5, second, second.array());
        invalidBatch(() -> batches.finish(6, draw));
        batches.add(6, first, first.array());
        batches.add(6, second, second.array());
        byte[][] packets = batches.finish(6, draw);
        require(packets.length == 2 && packets[0] == first.array() && packets[1] == second.array());
        batches.add(6, first, first.array());
        batches.clear();
        invalidBatch(() -> batches.add(6, second, second.array()));
        draw.putInt(168, 0).putInt(160, 0);
        require(WorldProjectPacket.incremental(draw) && batches.finish(6, draw).length == 0);
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W, H);
        PlayerGraphics.Frame streamed = new PlayerGraphics.Frame(6, draw.array(), Collections.emptyMap(), packets);
        reject(() -> recorder.add(streamed));
        require(recorder.size() == 0);
        ProjectBenchmark capture = new ProjectBenchmark("capture", null, directory, W, H);
        reject(() -> capture.enqueued(streamed));
        require(!new File(directory, "egret-project-replay.egrp").exists());
    }

    private static int[] ordered(int id, int[] first, int[] reversed) { return id % 2 == 0 ? first : reversed; }

    private static void expandedBudget() throws Exception {
        int[] a = {19}, b = {27}, both = {19, 27}, empty = {};
        Map<Integer, PlayerGraphics.Page> pages = Collections.emptyMap();
        ProjectReplayTape.Recorder r = new ProjectReplayTape.Recorder(W, H);
        r.add(new PlayerGraphics.Frame(2, world(0, false, false, a, a, 8000), pages));
        // Both wire packets individually fit. Their two distinct resident definitions would exceed 360,472 bytes.
        reject(() -> r.add(new PlayerGraphics.Frame(2, world(1, false, true, b, both, 8000), pages)));
        require(r.size() == 1);
        r.add(new PlayerGraphics.Frame(2, world(1, false, true, empty, a, 3), pages));
        r.add(new PlayerGraphics.Frame(2, packet(2, 0), pages)); // 2D clears the world predecessor.
        reject(() -> r.add(new PlayerGraphics.Frame(2, world(3, false, true, empty, a, 3), pages)));
    }

    private static void worldOverlay() throws Exception {
        byte[] hud = packet(0,0);
        hud[16] = 0;
        ByteBuffer world = ByteBuffer.allocate(160 + hud.length).order(ByteOrder.LITTLE_ENDIAN);
        world.putInt(0, WorldProjectPacket.MAGIC).putInt(8, hud.length).putInt(20, 255);
        world.position(160);
        world.put(hud);
        require(WorldProjectPacket.stageOffset(world) == 160);
        ProjectReplayTape.Recorder recorder = new ProjectReplayTape.Recorder(W,H);
        require(!recorder.add(new PlayerGraphics.Frame(1, world.array(), Collections.emptyMap())));
        world.putInt(4, 1);
        require(WorldProjectPacket.stageOffset(world) == -1);
        world.putInt(4, 0).putInt(8, Integer.MAX_VALUE);
        require(WorldProjectPacket.stageOffset(world) == -1);
        world.putInt(8, hud.length).putInt(12, 1);
        reject(() -> WorldProjectPacket.validate(world.array(), Collections.emptyMap(), null));
        world.putInt(12, 0).putInt(160, WorldProjectPacket.MAGIC);
        require(WorldProjectPacket.stageOffset(world) == -1);
    }

    public static void main(String[] args) throws Exception {
        worldOverlay();
        texturedWorldOverlay();
        residentWorldOverlay();
        File dir = Files.createTempDirectory("egret-project-tape-test").toFile();
        File file = new File(dir, "scene.bin");
        try {
            ProjectReplayTape.Recorder recorder = fixture(false);
            require(recorder.size() == 210);
            String digest = recorder.write(file);
            byte[] original = Files.readAllBytes(file.toPath());
            require(original.length < 210 * 100 + 100 && ByteBuffer.wrap(original).getInt(4) == 1);
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
            materialReplay();
            effectReplay(file);
            expandedBudget();
            residentReplay(file);
            skinnedReplay(file);
            streamedTransport(dir);
            System.out.println("Project replay: legacy and resident tapes, full-frame recovery, page generations, identity and rejection passed.");
        } finally {
            Files.deleteIfExists(file.toPath());
            Files.deleteIfExists(dir.toPath());
        }
    }
    private ProjectReplayTapeTest() {}
}
