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
    static final int SKINNED_MAGIC = 0x35443345, SKINNED_DELTA_MAGIC = 0x36443345;
    static final int STREAM_MAGIC = 0x37443345, BATCH_MAGIC = 0x31473345;
    static final int RESIDENT_LIMIT = 16 * 1024 * 1024, MAX_BATCHES = 64;
    private static final int HEADER = 160, DRAW = 88, TEXTURED_DRAW = 96, SKINNED_DRAW = 128;
    private static final int MAX_JOINTS = 56;
    private WorldProjectPacket() {}

    static final int TEXTURED_LIMIT = 2 * 1024 * 1024;
    static int byteLimit(int magic) {
        return (isTextured(magic) || magic == BATCH_MAGIC) ? TEXTURED_LIMIT : PlayerGraphics.MAX_FRAME_BYTES;
    }

    static boolean isDelta(int format) { return format == DELTA_MAGIC || format == TEXTURED_DELTA_MAGIC || format == SKINNED_DELTA_MAGIC; }
    static boolean isSkinned(int format) { return format == SKINNED_MAGIC || format == SKINNED_DELTA_MAGIC || format == STREAM_MAGIC; }
    static boolean isTextured(int format) { return format == TEXTURED_MAGIC || format == TEXTURED_DELTA_MAGIC || isSkinned(format); }
    private static int fullFormat(int format) {
        return isSkinned(format) ? SKINNED_MAGIC : isTextured(format) ? TEXTURED_MAGIC : MAGIC;
    }
    private static int drawSize(int format) {
        return isSkinned(format) ? SKINNED_DRAW : isTextured(format) ? TEXTURED_DRAW : DRAW;
    }
    static boolean isWorld(int format) { return format == MAGIC || isTextured(format) || format == DELTA_MAGIC; }
    private static int headerSize(int format) { return format == STREAM_MAGIC ? 176 : HEADER + (isDelta(format) ? 4 : 0) + (isSkinned(format) ? 4 : 0); }

    static boolean incremental(ByteBuffer data) {
        int format = data.getInt(0);
        return isDelta(format) || (format == STREAM_MAGIC && data.limit() >= 176 && data.getInt(160) == 0);
    }

    static int batchCount(ByteBuffer data) {
        if (data.getInt(0) != STREAM_MAGIC) return 0;
        if (data.limit() < 176 || data.getInt(12) != 0) throw new IllegalArgumentException("Invalid World3D streamed frame");
        int flags = data.getInt(160), count = data.getInt(168);
        if ((flags & ~1) != 0 || (flags == 1 && data.getInt(164) != 0) || count < 0 || count > MAX_BATCHES)
            throw new IllegalArgumentException("Invalid World3D streamed header");
        return count;
    }

    // The bridge owns the individual buffers until the final frame has arrived. No joined
    // byte array is ever made. Device loss or a cancelled request releases partial batches.
    static final class Batches {
        static final byte[][] EMPTY = new byte[0][];
        private byte[][] packets = EMPTY;
        private int target, epoch, received, definitions, bytes;

        void clear() {
            packets = EMPTY;
            received = definitions = bytes = 0;
        }

        void add(int token, ByteBuffer header, byte[] data) {
            int id = header.getInt(4), index = header.getInt(8), count = header.getInt(12), n = header.getInt(16);
            if (index == 0 && packets.length == 0 && count > 0 && count <= MAX_BATCHES) {
                packets = new byte[count][];
                target = id;
                epoch = token;
            }
            if (header.getInt(0) != BATCH_MAGIC || header.getInt(20) != SKINNED_MAGIC ||
                    data.length <= 24 || data.length > TEXTURED_LIMIT || packets.length == 0 ||
                    token != epoch || id != target || count != packets.length || index != received || index >= count ||
                    n < 1 || n > MAX_BATCHES - definitions || data.length - 24 > RESIDENT_LIMIT - bytes) {
                clear();
                throw new IllegalArgumentException("Invalid World3D geometry batch sequence");
            }
            packets[received++] = data;
            definitions += n;
            bytes += data.length - 24;
        }

        byte[][] finish(int token, ByteBuffer draw) {
            int expected = batchCount(draw);
            if (packets.length != expected || received != expected ||
                    (expected != 0 && (epoch != token || target != draw.getInt(4)))) {
                clear();
                throw new IllegalArgumentException("Incomplete World3D geometry batches");
            }
            byte[][] result = packets;
            clear();
            return result;
        }
    }

    // The live bridge only inspects the envelope. Native decoding checks the full packet before drawing.
    static int stageOffset(ByteBuffer data) {
        if (data.limit() < 24) return -1;
        if (!isWorld(data.getInt(0))) return 0;
        int length = data.getInt(8);
        if (length < 24 || length > PlayerGraphics.MAX_FRAME_BYTES || length > data.limit() - headerSize(data.getInt(0))) return -1;
        int offset = data.limit() - length;
        int format = data.getInt(offset);
        if ((offset & 3) != 0 ||
            (format != 0x32524745 && format != 0x33524745 && format != 0x34524745 && format != 0x35524745 && format != 0x36524745) ||
            data.getInt(offset + 4) != data.getInt(4) || (data.getInt(offset + 16) & 255) != 0) return -1;
        return offset;
    }

    // A single asset may provide both color and data views with different transfer functions.
    static void visitTexturePages(ByteBuffer data, IntConsumer visit) {
        visitTexturePages(data, visit, page -> {});
    }

    private static void visitPage(int page, IntConsumer sink) {
        if (page < 0 || page > 255) throw new IllegalArgumentException("Invalid World3D texture page");
        if (page != 0) sink.accept(page);
    }

    static void visitTexturePages(ByteBuffer data, IntConsumer color, IntConsumer linear) {
        if (data.limit() < 24 || !isTextured(data.getInt(0))) return;
        int end = stageOffset(data), draws = data.getInt(16);
        int header = headerSize(data.getInt(0)), width = drawSize(data.getInt(0));
        if (end < header || draws < 0 || draws > PlayerGraphics.MAX_QUADS || (long) draws * width > end - header)
            throw new IllegalArgumentException("Invalid World3D draw table");
        for (int draw = end - draws * width; draw < end; draw += width) {
            visitPage(data.getInt(draw + DRAW), color);
            if (width == SKINNED_DRAW) {
                visitPage(data.getInt(draw + 96), linear);
                visitPage(data.getInt(draw + 100), linear);
            }
        }
    }

    // A definition refers to a slice of an immutable command already owned by the tape.
    private static final class Definition {
        final byte[] bytes;
        final int start, length, maxJoint;
        Definition(byte[] bytes, int start, int length, int maxJoint) {
            this.bytes = bytes; this.start = start; this.length = length; this.maxJoint = maxJoint;
        }
    }

    static final class GeometryState {
        final int hudOffset;
        private final int id, format, tailOffset, fullLength;
        private final Map<Integer, Definition> visible;

        GeometryState(int id, int format, int tailOffset, int hudOffset, int fullLength,
                      Map<Integer, Definition> visible) {
            this.id = id; this.format = format; this.tailOffset = tailOffset;
            this.hudOffset = hudOffset; this.fullLength = fullLength; this.visible = visible;
        }

        boolean incremental() { return isDelta(format); }

        // Materialize only the requested recovery frame. Draw order, page slots, HUD and
        // camera come verbatim from that tick; definitions follow their first draw.
        byte[] complete(byte[] original) {
            if (!incremental()) return original;
            ByteBuffer out = ByteBuffer.allocate(fullLength).order(ByteOrder.LITTLE_ENDIAN);
            out.put(original, 0, HEADER);
            out.putInt(0, fullFormat(format));
            out.putInt(12, visible.size());
            if (isSkinned(format)) out.put(original, HEADER + 4, 4);
            for (Definition geometry : visible.values()) out.put(geometry.bytes, geometry.start, geometry.length);
            out.put(original, tailOffset, original.length - tailOffset);
            return out.array();
        }
    }

    private static boolean hasPage(int id, Map<Integer, PlayerGraphics.Page> pages) {
        return id == 0 || (id > 0 && id <= 255 && pages.containsKey(id));
    }

    // Validate both the compact stream and the equivalent full packet before accepting a frame.
    static GeometryState validate(byte[] owned, Map<Integer, PlayerGraphics.Page> pages,
                                  GeometryState previous) throws IOException {
        ByteBuffer data = ByteBuffer.wrap(owned).order(ByteOrder.LITTLE_ENDIAN);
        if (data.limit() >= 4 && data.getInt(0) == STREAM_MAGIC)
            throw new IOException("Recording streamed World3D geometry is not supported");
        int end = stageOffset(data);
        if (end < HEADER) throw invalid();
        int format = data.getInt(0), header = headerSize(format);
        boolean delta = isDelta(format), textured = isTextured(format);
        if (delta && (previous == null || previous.id != data.getInt(HEADER) ||
                fullFormat(previous.format) != fullFormat(format))) throw invalid();
        boolean skinned = isSkinned(format);
        int stride = skinned ? 68 : textured ? 32 : 24, drawBytes = drawSize(format);
        int geometries = data.getInt(12), draws = data.getInt(16);
        if ((data.getInt(20) & 255) != 255 || geometries < 0 || geometries > 64 ||
            draws < 0 || draws > PlayerGraphics.MAX_QUADS || (long) draws * drawBytes > end - header) throw invalid();
        for (int offset = 24; offset < HEADER; offset += 4) {
            float value = data.getFloat(offset);
            if (!Float.isFinite(value) || (offset >= 112 && value < 0)) throw invalid();
        }
        int drawOffset = end - draws * drawBytes, cursor = header;
        int paletteBytes = skinned ? data.getInt(header - 4) : 0;
        if (paletteBytes < 0 || paletteBytes > drawOffset - header || (paletteBytes & 3) != 0) throw invalid();
        int tailOffset = drawOffset - paletteBytes;
        Map<Integer, Definition> defined = new LinkedHashMap<>();
        for (int i = 0; i < geometries; i++) {
            if (cursor > tailOffset - 12) throw invalid();
            int id = data.getInt(cursor), vertices = data.getInt(cursor + 4), indices = data.getInt(cursor + 8);
            int start = cursor;
            cursor += 12;
            if (id == 0 || defined.containsKey(id) || vertices < 3 || indices < 3 || indices % 3 != 0 ||
                (long) vertices * stride + (long) indices * 4 > tailOffset - cursor) throw invalid();
            int maxJoint = 0;
            for (int vertex = 0; vertex < vertices; vertex++, cursor += stride) {
                for (int p = 0; p < stride; p += 4) {
                    if (skinned && p == 32) {
                        for (int lane = 0; lane < 4; lane++) maxJoint = Math.max(maxJoint, data.get(cursor + p + lane) & 255);
                    } else {
                        float value = data.getFloat(cursor + p);
                        if (!Float.isFinite(value) || (skinned && p >= 36 && (value < 0 || value > 1))) throw invalid();
                    }
                }
            }
            if (maxJoint >= MAX_JOINTS) throw invalid();
            for (int stop = cursor + indices * 4; cursor < stop; cursor += 4) {
                int index = data.getInt(cursor);
                if (index < 0 || index >= vertices) throw invalid();
            }
            defined.put(id, new Definition(owned, start, cursor - start, maxJoint));
        }
        if (cursor != tailOffset) throw invalid();
        int[] palettes = skinned ? new int[Math.min(draws, paletteBytes / 68) + 1] : null;
        int paletteCount = 0;
        while (cursor < drawOffset) {
            int joints = data.getInt(cursor);
            cursor += 4;
            if (joints < 1 || joints > MAX_JOINTS || joints * 64 > drawOffset - cursor ||
                    ++paletteCount >= palettes.length) throw invalid();
            palettes[paletteCount] = joints;
            for (int stop = cursor + joints * 64; cursor < stop; cursor += 4)
                if (!Float.isFinite(data.getFloat(cursor))) throw invalid();
        }
        // Legacy full frames may define an undrawn mesh. Delta residency matches
        // the native receiver: retire every ID absent from this complete draw list.
        Map<Integer, Definition> visible = delta ? new LinkedHashMap<>() : defined;
        int fullLength = delta ? headerSize(fullFormat(format)) + owned.length - tailOffset : owned.length;
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
                if (!hasPage(page, pages) || (flags & ~(skinned ? 3 : 1)) != 0) throw invalid();
            }
            if (skinned) {
                int palette = data.getInt(cursor + 104);
                if (!hasPage(data.getInt(cursor + 96), pages) || !hasPage(data.getInt(cursor + 100), pages) ||
                        palette < 0 || palette > paletteCount ||
                        (palette != 0 && visible.get(id).maxJoint >= palettes[palette]) ||
                        !Float.isFinite(data.getFloat(cursor + 108)) || !Float.isFinite(data.getFloat(cursor + 112))) throw invalid();
                for (int p = 116; p < SKINNED_DRAW; p += 4) {
                    float value = data.getFloat(cursor + p);
                    if (!Float.isFinite(value) || value < 0) throw invalid();
                }
            }
            for (int p = 4; p < DRAW; p += 4) {
                float value = data.getFloat(cursor + p);
                if (!Float.isFinite(value) || (p >= 68 && (value < 0 || value > 1))) throw invalid();
            }
        }
        if (delta && !visible.keySet().containsAll(defined.keySet())) throw invalid();
        if (delta && defined.isEmpty() && sameDefinitionOrder(visible, previous.visible))
            visible = previous.visible;
        return new GeometryState(data.getInt(4), format, tailOffset, end, fullLength, visible);
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
