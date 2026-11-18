// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import android.content.res.AssetManager;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

final class Fixture {
    final int width, height, frameCount, frameBytes, atlasWidth, atlasHeight, page;
    final String expectedAtlas;
    ByteBuffer atlas;
    final ByteBuffer replay;

    Fixture(AssetManager assets, boolean verify, boolean replayMode) throws Exception {
        JSONObject spec = new JSONObject(new String(readAsset(assets, "scene/fixture.json", 4096), StandardCharsets.UTF_8));
        width = bounded(spec, "width", 2048);
        height = bounded(spec, "height", 2048);
        frameCount = bounded(spec, "frameCount", 1024);
        frameBytes = bounded(spec, "frameBytes", 4 * 1024 * 1024);
        atlasWidth = bounded(spec, "atlasWidth", 2048);
        atlasHeight = bounded(spec, "atlasHeight", 2048);
        page = bounded(spec, "pageId", Integer.MAX_VALUE);
        expectedAtlas = spec.getString("atlasSha256");
        if (replayMode) atlas = exact(assets, "atlas.rgba", Math.multiplyExact(atlasWidth * atlasHeight, 4));
        replay = (replayMode || verify) ? exact(assets, "frames.bin", Math.multiplyExact(frameCount, frameBytes)) : null;
        if (verify) {
            checkDigest(replay, spec.getString("framesSha256"));
            if (replayMode) checkDigest(atlas, expectedAtlas);
        }
    }

    private static int bounded(JSONObject spec, String key, int max) throws Exception {
        int value = spec.getInt(key);
        if (value < 1 || value > max) throw new IOException("Invalid " + key);
        return value;
    }

    static byte[] readAsset(AssetManager assets, String name, int limit) throws IOException {
        try (InputStream input = assets.open(name);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] temp = new byte[8192];
            for (int count; (count = input.read(temp)) != -1;) {
                if (output.size() + count > limit) throw new IOException("Oversize " + name);
                output.write(temp, 0, count);
            }
            return output.toByteArray();
        }
    }

    private static ByteBuffer exact(AssetManager assets, String name, int length) throws IOException {
        if (length > 32 * 1024 * 1024) throw new IOException("Oversize " + name);
        byte[] bytes = readAsset(assets, "scene/" + name, length);
        if (bytes.length != length) throw new IOException("Incomplete " + name);
        return (ByteBuffer) ByteBuffer.allocateDirect(length).put(bytes).rewind();
    }

    static void checkDigest(ByteBuffer source, String expected) throws Exception {
        java.security.MessageDigest sha = java.security.MessageDigest.getInstance("SHA-256");
        sha.update(source.duplicate());
        StringBuilder hex = new StringBuilder();
        for (byte b : sha.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        if (!expected.contentEquals(hex)) throw new IOException("Fixture SHA-256 mismatch");
    }

    boolean matches(int index, ByteBuffer bytes) {
        if (bytes.remaining() != frameBytes) return false;
        ByteBuffer expected = replay.duplicate();
        expected.position(index * frameBytes);
        expected.limit(expected.position() + frameBytes);
        return expected.equals(bytes);
    }

}
