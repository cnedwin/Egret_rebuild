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
            System.out.println("EGR2 project replay tape: round-trip, page generations, identity and rejection passed.");
        } finally {
            Files.deleteIfExists(file.toPath());
            Files.deleteIfExists(dir.toPath());
        }
    }
    private ProjectReplayTapeTest() {}
}
