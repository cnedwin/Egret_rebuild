// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.IntConsumer;

/** Framing and geometry references shared by live and recorded World3D submissions. */
final class WorldProjectPacket {
    static final int MAGIC = 0x31443345, TEXTURED_MAGIC = 0x32443345;
    static final int DELTA_MAGIC = 0x33443345, TEXTURED_DELTA_MAGIC = 0x34443345;
    private static final int HEADER = 160, DRAW = 88, TEXTURED_DRAW = 96;
    private WorldProjectPacket() {}

    static final int TEXTURED_LIMIT = 2 * 1024 * 1024;
    static int byteLimit(int magic) {
        return isTextured(magic) ? TEXTURED_LIMIT : PlayerGraphics.MAX_FRAME_BYTES;
    }

    static boolean isDelta(int format) { return format == DELTA_MAGIC || format == TEXTURED_DELTA_MAGIC; }
    static boolean isTextured(int format) { return format == TEXTURED_MAGIC || format == TEXTURED_DELTA_MAGIC; }
    static boolean isWorld(int format) { return format == MAGIC || format == TEXTURED_MAGIC || isDelta(format); }
    private static int headerSize(int format) { return isDelta(format) ? HEADER + Integer.BYTES : HEADER; }

    // The live bridge only inspects the envelope. Native decoding checks the full packet before drawing.
    static int stageOffset(ByteBuffer data) {
        if (data.limit() < 24) return -1;
        if (!isWorld(data.getInt(0))) return 0;
        int length = data.getInt(8);
        if (length < 24 || length > PlayerGraphics.MAX_FRAME_BYTES || length > data.limit() - headerSize(data.getInt(0))) return -1;
        int offset = data.limit() - length;
        int format = data.getInt(offset);
        if ((offset & 3) != 0 ||
            (format != 0x32524745 && format != 0x33524745 && format != 0x34524745 && format != 0x35524745) ||
            data.getInt(offset + 4) != data.getInt(4) || (data.getInt(offset + 16) & 255) != 0) return -1;
        return offset;
    }

    // The GL thread needs only the draw table to prepare sRGB mip chains from this frame's immutable pages.
    static void visitTexturePages(ByteBuffer data, IntConsumer visit) {
        if (data.limit() < 24 || !isTextured(data.getInt(0))) return;
        int end = stageOffset(data), draws = data.getInt(16);
        int header = headerSize(data.getInt(0));
        if (end < header || draws < 0 || draws > PlayerGraphics.MAX_QUADS || (long) draws * TEXTURED_DRAW > end - header)
            throw new IllegalArgumentException("Invalid World3D draw table");
        for (int draw = end - draws * TEXTURED_DRAW; draw < end; draw += TEXTURED_DRAW) {
            int page = data.getInt(draw + DRAW);
            if (page < 0 || page > 255) throw new IllegalArgumentException("Invalid World3D texture page");
            if (page != 0) visit.accept(page);
        }
    }

    // A definition refers to a slice of an immutable command already owned by the tape.
    private static final class Definition {
        final byte[] bytes;
        final int start, length;
        Definition(byte[] bytes, int start, int length) {
            this.bytes = bytes; this.start = start; this.length = length;
        }
    }

    static final class GeometryState {
        final int hudOffset;
        private final int id, format, drawOffset, fullLength;
        private final Map<Integer, Definition> visible;

        GeometryState(int id, int format, int drawOffset, int hudOffset, int fullLength,
                      Map<Integer, Definition> visible) {
            this.id = id; this.format = format; this.drawOffset = drawOffset;
            this.hudOffset = hudOffset; this.fullLength = fullLength; this.visible = visible;
        }

        boolean incremental() { return isDelta(format); }

        // Materialize only the requested recovery frame. Draw order, page slots, HUD and
        // camera come verbatim from that tick; definitions follow their first draw.
        byte[] complete(byte[] original) {
            if (!incremental()) return original;
            ByteBuffer out = ByteBuffer.allocate(fullLength).order(ByteOrder.LITTLE_ENDIAN);
            out.put(original, 0, HEADER);
            out.putInt(0, isTextured(format) ? TEXTURED_MAGIC : MAGIC);
            out.putInt(12, visible.size());
            for (Definition geometry : visible.values()) out.put(geometry.bytes, geometry.start, geometry.length);
            out.put(original, drawOffset, original.length - drawOffset);
            return out.array();
        }
    }

    // Validate both the compact stream and the equivalent full packet before accepting a frame.
    static GeometryState validate(byte[] owned, Map<Integer, PlayerGraphics.Page> pages,
                                  GeometryState previous) throws IOException {
        ByteBuffer data = ByteBuffer.wrap(owned).order(ByteOrder.LITTLE_ENDIAN);
        int end = stageOffset(data);
        if (end < HEADER) throw invalid();
        int format = data.getInt(0), header = headerSize(format);
        boolean delta = isDelta(format), textured = isTextured(format);
        if (delta && (previous == null || previous.id != data.getInt(HEADER) ||
                isTextured(previous.format) != textured)) throw invalid();
        int stride = textured ? 32 : 24, drawBytes = textured ? TEXTURED_DRAW : DRAW;
        int geometries = data.getInt(12), draws = data.getInt(16);
        if ((data.getInt(20) & 255) != 255 || geometries < 0 || geometries > 64 ||
            draws < 0 || draws > PlayerGraphics.MAX_QUADS || (long) draws * drawBytes > end - header) throw invalid();
        for (int offset = 24; offset < HEADER; offset += 4) {
            float value = data.getFloat(offset);
            if (!Float.isFinite(value) || (offset >= 112 && value < 0)) throw invalid();
        }
        int drawOffset = end - draws * drawBytes, cursor = header;
        Map<Integer, Definition> defined = new LinkedHashMap<>();
        for (int i = 0; i < geometries; i++) {
            if (cursor > drawOffset - 12) throw invalid();
            int id = data.getInt(cursor), vertices = data.getInt(cursor + 4), indices = data.getInt(cursor + 8);
            int start = cursor;
            cursor += 12;
            if (id == 0 || defined.containsKey(id) || vertices < 3 || indices < 3 || indices % 3 != 0 ||
                (long) vertices * stride + (long) indices * 4 > drawOffset - cursor) throw invalid();
            for (int stop = cursor + vertices * stride; cursor < stop; cursor += 4)
                if (!Float.isFinite(data.getFloat(cursor))) throw invalid();
            for (int stop = cursor + indices * 4; cursor < stop; cursor += 4) {
                int index = data.getInt(cursor);
                if (index < 0 || index >= vertices) throw invalid();
            }
            defined.put(id, new Definition(owned, start, cursor - start));
        }
        if (cursor != drawOffset) throw invalid();
        // Legacy full frames may define an undrawn mesh. Delta residency matches
        // the native receiver: retire every ID absent from this complete draw list.
        Map<Integer, Definition> visible = delta ? new LinkedHashMap<>() : defined;
        int fullLength = delta ? HEADER + owned.length - drawOffset : owned.length;
        for (; cursor < end; cursor += drawBytes) {
            int id = data.getInt(cursor);
            if (!visible.containsKey(id)) {
                if (!delta || visible.size() >= 64) throw invalid();
                Definition geometry = defined.get(id);
                if (geometry == null) geometry = previous.visible.get(id);
                if (geometry == null || geometry.length > byteLimit(format) - fullLength) throw invalid();
                visible.put(id, geometry);
                fullLength += geometry.length;
            }
            if (textured) {
                int page = data.getInt(cursor + DRAW), flags = data.getInt(cursor + DRAW + 4);
                if (page < 0 || page > 255 || (page != 0 && !pages.containsKey(page)) || (flags & ~1) != 0) throw invalid();
            }
            for (int p = 4; p < DRAW; p += 4) {
                float value = data.getFloat(cursor + p);
                if (!Float.isFinite(value) || (p >= 68 && (value < 0 || value > 1))) throw invalid();
            }
        }
        if (delta && !visible.keySet().containsAll(defined.keySet())) throw invalid();
        if (delta && defined.isEmpty() && sameDefinitionOrder(visible, previous.visible))
            visible = previous.visible;
        return new GeometryState(data.getInt(4), format, drawOffset, end, fullLength, visible);
    }

    // Preserve first-draw order for recovery even when a camera reorders unchanged meshes.
    private static boolean sameDefinitionOrder(Map<Integer, Definition> current, Map<Integer, Definition> previous) {
        if (current.size() != previous.size()) return false;
        Iterator<Definition> prior = previous.values().iterator();
        for (Definition definition : current.values()) if (definition != prior.next()) return false;
        return true;
    }

    private static IOException invalid() { return new IOException("Invalid World3D project frame"); }
}
