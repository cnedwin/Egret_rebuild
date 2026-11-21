// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashSet;

/** The inner EGR overlay supplies the stage dimensions for both live and recorded E3D1 frames. */
final class WorldProjectPacket {
    static final int MAGIC = 0x31443345;
    private static final int HEADER = 160, DRAW = 88;
    private WorldProjectPacket() {}

    // The live bridge only inspects the envelope. Native decoding checks the full packet before drawing.
    static int stageOffset(ByteBuffer data) {
        if (data.limit() < 24) return -1;
        if (data.getInt(0) != MAGIC) return 0;
        int length = data.getInt(8);
        if (length < 24 || length > data.limit() - HEADER) return -1;
        int offset = data.limit() - length;
        int format = data.getInt(offset);
        if ((offset & 3) != 0 ||
            (format != 0x32524745 && format != 0x33524745 && format != 0x34524745 && format != 0x35524745) ||
            data.getInt(offset + 4) != data.getInt(4) || (data.getInt(offset + 16) & 255) != 0) return -1;
        return offset;
    }

    // A replay can arrive from disk. Verify all world records before returning the packet to the renderer.
    static int validate(ByteBuffer data) throws IOException {
        int end = stageOffset(data);
        if (end < HEADER) throw invalid();
        int geometries = data.getInt(12), draws = data.getInt(16);
        if ((data.getInt(20) & 255) != 255 || geometries < 0 || geometries > 64 ||
            draws < 0 || draws > PlayerGraphics.MAX_QUADS || (long) draws * DRAW > end - HEADER) throw invalid();
        for (int offset = 24; offset < HEADER; offset += 4) {
            float value = data.getFloat(offset);
            if (!Float.isFinite(value) || (offset >= 112 && value < 0)) throw invalid();
        }
        int drawOffset = end - draws * DRAW, cursor = HEADER;
        HashSet<Integer> ids = new HashSet<>();
        for (int i = 0; i < geometries; i++) {
            if (cursor > drawOffset - 12) throw invalid();
            int id = data.getInt(cursor), vertices = data.getInt(cursor + 4), indices = data.getInt(cursor + 8);
            cursor += 12;
            if (id == 0 || !ids.add(id) || vertices < 3 || indices < 3 || indices % 3 != 0 ||
                (long) vertices * 24 + (long) indices * 4 > drawOffset - cursor) throw invalid();
            for (int stop = cursor + vertices * 24; cursor < stop; cursor += 4)
                if (!Float.isFinite(data.getFloat(cursor))) throw invalid();
            for (int stop = cursor + indices * 4; cursor < stop; cursor += 4) {
                int index = data.getInt(cursor);
                if (index < 0 || index >= vertices) throw invalid();
            }
        }
        if (cursor != drawOffset) throw invalid();
        for (; cursor < end; cursor += DRAW) {
            if (!ids.contains(data.getInt(cursor))) throw invalid();
            for (int p = 4; p < DRAW; p += 4) {
                float value = data.getFloat(cursor + p);
                if (!Float.isFinite(value) || (p >= 68 && (value < 0 || value > 1))) throw invalid();
            }
        }
        return end;
    }

    private static IOException invalid() { return new IOException("Invalid World3D project frame"); }
}
