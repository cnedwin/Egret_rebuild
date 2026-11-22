// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/** Exercises the command representation shipped in the WebView AAR, without a device. */
public final class WebViewFrameTransportTest {
    private static void worldBudget(int magic, int limit) {
        int[] words = new int[limit / Integer.BYTES];
        words[0] = ByteOrder.nativeOrder() == ByteOrder.LITTLE_ENDIAN ? magic : Integer.reverseBytes(magic);
        byte[] packet = PlayerScripts.unpackCommandWords(words);
        if (packet == null || packet.length != limit || ByteBuffer.wrap(packet).order(ByteOrder.LITTLE_ENDIAN).getInt() != magic
                || PlayerScripts.unpackCommandWords(Arrays.copyOf(words, words.length + 1)) != null)
            throw new AssertionError("World packet budget or wire format changed: " + Integer.toHexString(magic));
    }

    public static void main(String[] args) {
        for (int length : new int[]{24, 5208, PlayerGraphics.MAX_FRAME_BYTES}) {
            byte[] source = new byte[length + 8];
            for (int i = 0; i < source.length; i++) source[i] = (byte)(i * 73 + 127);
            int[] words = new int[length / Integer.BYTES];
            ByteBuffer.wrap(source, 4, length).order(ByteOrder.nativeOrder()).asIntBuffer().get(words);
            byte[] packet = PlayerScripts.unpackCommandWords(words);
            Arrays.fill(words, 0);
            if (!Arrays.equals(packet, Arrays.copyOfRange(source, 4, 4 + length))) {
                throw new AssertionError("Command slice or ownership changed at " + length + " bytes");
            }
        }
        worldBudget(WorldProjectPacket.TEXTURED_MAGIC, WorldProjectPacket.TEXTURED_LIMIT);
        worldBudget(WorldProjectPacket.TEXTURED_DELTA_MAGIC, WorldProjectPacket.TEXTURED_LIMIT);
        worldBudget(WorldProjectPacket.SKINNED_MAGIC, WorldProjectPacket.TEXTURED_LIMIT);
        worldBudget(WorldProjectPacket.SKINNED_DELTA_MAGIC, WorldProjectPacket.TEXTURED_LIMIT);
        worldBudget(WorldProjectPacket.DELTA_MAGIC, PlayerGraphics.MAX_FRAME_BYTES);
        if (PlayerScripts.unpackCommandWords(null) != null
                || PlayerScripts.unpackCommandWords(new int[5]) != null
                || PlayerScripts.unpackCommandWords(new int[PlayerGraphics.MAX_FRAME_BYTES / Integer.BYTES + 1]) != null) {
            throw new AssertionError("Invalid word count accepted");
        }
    }
}
