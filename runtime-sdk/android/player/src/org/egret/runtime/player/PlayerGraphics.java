// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.opengl.EGL14;
import android.opengl.EGLContext;
import android.opengl.GLSurfaceView;
import android.util.Base64;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import javax.microedition.khronos.egl.EGL10;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.egl.EGLDisplay;
import javax.microedition.khronos.opengles.GL10;

final class PlayerGraphics implements GLSurfaceView.Renderer, GLSurfaceView.EGLContextFactory {
    static final int MAX_QUADS = 4096, QUAD_BYTES = 64, ATLAS_BYTES = 24;
    static final int MAX_FRAME_BYTES = 24 + MAX_QUADS * (QUAD_BYTES + ATLAS_BYTES);
    private static final int MAX_PAGE_BYTES = 64 << 20, MAX_RESIDENT_BYTES = 256 << 20;
    private final EgretPlayerView owner;
    private final AtomicReference<Frame> pending = new AtomicReference<>();
    private long handle;
    private EGLContext context;
    private ByteBuffer commands;
    private Map<Integer, Page> uploaded = Collections.emptyMap();
    // A published page can have both sRGB color and linear material mip chains.
    private final Page[] worldViews = new Page[256];
    private final Page[] dataViews = new Page[256];
    private final java.util.function.IntConsumer prepareWorldView = id -> prepareWorldView(id, false);
    private final java.util.function.IntConsumer prepareDataView = id -> prepareWorldView(id, true);
    private int width, height;
    // Last explicitly sampled vertex/index payload, excluding driver and texture allocations.
    volatile long sampledWorldGeometryBytes = -1;
    volatile int contexts, uploads, releases, abandoned, replacedPages, residentPages;

    PlayerGraphics(EgretPlayerView owner) { this.owner = owner; }

    // Snapshots share immutable pages. A frame always retains the page versions present
    // when its bytes crossed the bridge, even if a later input edits a texture.
    static final class Pages {
        private Map<Integer, Page> current = Collections.emptyMap();
        private int size;
        private boolean retired;

        synchronized void publish(int id, int width, int height, String encoded) {
            if (retired) return;
            long length = (long) width * height * 4;
            if (id < 1 || id > 255 || width < 1 || width > 16384 || height < 1 || height > 16384
                || length > MAX_PAGE_BYTES || encoded == null || encoded.length() != 4 * ((length + 2) / 3))
                throw new IllegalArgumentException("Invalid RGBA page " + id);
            Page old = current.get(id);
            long nextSize = size + length - (old == null ? 0 : old.data.capacity());
            if (nextSize > MAX_RESIDENT_BYTES) throw new IllegalArgumentException("Page memory budget exceeded");
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (bytes.length != length) throw new IllegalArgumentException("RGBA length mismatch");
            Map<Integer, Page> copy = new HashMap<>(current);
            copy.put(id, new Page(width, height, bytes));
            current = Collections.unmodifiableMap(copy);
            size = (int) nextSize;
        }

        synchronized void release(int id) {
            Page old = current.get(id);
            if (old == null) return;
            Map<Integer, Page> copy = new HashMap<>(current);
            copy.remove(id);
            size -= old.data.capacity();
            current = Collections.unmodifiableMap(copy);
        }

        synchronized Map<Integer, Page> snapshot() { return current; }
        synchronized void close() { retired = true; current = Collections.emptyMap(); size = 0; }
    }

    static final class Page {
        final int width, height;
        final ByteBuffer data;
        Page(int width, int height, byte[] bytes) {
            this.width = width;
            this.height = height;
            data = ByteBuffer.allocateDirect(bytes.length);
            data.put(bytes).flip();
        }
    }

    static final class Frame {
        final int epoch;
        final byte[] bytes;
        final Map<Integer, Page> pages;
        final byte[][] geometryBatches;
        Frame(int epoch, byte[] bytes, Map<Integer, Page> pages) {
            this(epoch, bytes, pages, WorldProjectPacket.Batches.EMPTY);
        }
        Frame(int epoch, byte[] bytes, Map<Integer, Page> pages, byte[][] geometryBatches) {
            this.geometryBatches = geometryBatches;
            this.epoch = epoch;
            this.bytes = bytes;
            this.pages = pages;
        }
        int id() {
            return (bytes[4] & 255) | (bytes[5] & 255) << 8 | (bytes[6] & 255) << 16 | bytes[7] << 24;
        }
    }

    void enqueue(Frame frame) { pending.set(frame); }

    @Override public javax.microedition.khronos.egl.EGLContext createContext(EGL10 egl, EGLDisplay display, EGLConfig config) {
        return egl.eglCreateContext(display, config, EGL10.EGL_NO_CONTEXT, new int[]{0x3098, 3, EGL10.EGL_NONE});
    }

    @Override public void destroyContext(EGL10 egl, EGLDisplay display, javax.microedition.khronos.egl.EGLContext old) {
        // Surface detach or spontaneous loss can precede the Activity's onPause.
        // Retire the Rust allocation on the owner thread even with no EGL context current.
        closeCurrent();
        egl.eglDestroyContext(display, old);
    }

    @Override public void onSurfaceCreated(GL10 unused, EGLConfig config) {
        if (handle != 0) abandon();
        if (owner.ending) return;
        try {
            context = EGL14.eglGetCurrentContext();
            handle = PlayerGpu.create();
            if (handle == 0) throw new IllegalStateException("Cannot create GLES 3 renderer");
            contexts++;
        } catch (RuntimeException | LinkageError e) { owner.reportFailure(e.toString()); }
    }

    @Override public void onSurfaceChanged(GL10 unused, int width, int height) {
        this.width = width;
        this.height = height;
        int epoch = owner.epoch;
        if (handle != 0) owner.ui.post(() -> owner.surfaceReady(epoch));
    }

    @Override public void onDrawFrame(GL10 unused) {
        Frame frame = pending.getAndSet(null);
        if (frame == null || frame.epoch != owner.epoch || owner.ending || handle == 0) return;
        try {
            if (uploaded != frame.pages) {
                for (int id : uploaded.keySet()) {
                    if (!frame.pages.containsKey(id)) {
                        check(PlayerGpu.release(handle, id), "release", id);
                        worldViews[id] = dataViews[id] = null;
                        releases++;
                        residentPages--;
                    }
                }
                for (Map.Entry<Integer, Page> entry : frame.pages.entrySet()) {
                    int id = entry.getKey();
                    Page page = entry.getValue();
                    if (page == uploaded.get(id)) continue;
                    check(PlayerGpu.upload(handle, id, page.width, page.height, page.data), "upload", id);
                    worldViews[id] = dataViews[id] = null;
                    if (uploaded.containsKey(id)) replacedPages++;
                    else residentPages++;
                    uploads++;
                }
                uploaded = frame.pages;
            }
            // Stage bounded packets on this GL thread before the single visible draw.
            for (byte[] batch : frame.geometryBatches) {
                copyCommands(batch);
                check(PlayerGpu.draw(handle, commands, 0, batch.length, width, height), "stage World3D geometry", frame.id());
            }
            copyCommands(frame.bytes);
            WorldProjectPacket.visitTexturePages(commands, prepareWorldView, prepareDataView);
            int status = PlayerGpu.draw(handle, commands, 0, frame.bytes.length, width, height);
            if (status == PlayerGpu.MISSING_WORLD_BASE && WorldProjectPacket.incremental(commands)) {
                owner.ui.post(() -> owner.missingWorldBase(frame));
                return;
            }
            check(status, "draw", frame.id());
            if (owner.timing.isEnabled()) sampledWorldGeometryBytes = PlayerGpu.worldGeometryBytes(handle);
            owner.ui.post(() -> owner.drawn(frame.epoch, frame.id()));
        } catch (RuntimeException | LinkageError e) { owner.reportFailure(e.toString()); }
    }

    private void copyCommands(byte[] bytes) {
        if (commands == null || commands.capacity() < bytes.length)
            commands = ByteBuffer.allocateDirect(bytes.length).order(ByteOrder.LITTLE_ENDIAN);
        commands.clear();
        commands.put(bytes).flip();
    }

    private void prepareWorldView(int id, boolean linearData) {
        Page[] views = linearData ? dataViews : worldViews;
        Page page = uploaded.get(id);
        if (page == null) throw new IllegalStateException("Missing World3D texture page " + id);
        if (views[id] == page) return;
        check(PlayerGpu.prepareWorldPage(handle, id, page.data, linearData), "prepare World3D texture", id);
        views[id] = page;
    }

    private static void check(int status, String operation, int id) {
        if (status != 0) throw new IllegalStateException("GLES " + operation + " failed (" + id + ", status " + status + ")");
    }

    private void abandon() {
        PlayerGpu.destroy(handle, false);
        handle = 0;
        abandoned++;
        residentPages = 0;
        sampledWorldGeometryBytes = 0;
        Arrays.fill(worldViews, null);
        Arrays.fill(dataViews, null);
        uploaded = Collections.emptyMap();
    }

    void closeCurrent() {
        pending.set(null);
        commands = null;
        sampledWorldGeometryBytes = 0;
        if (handle == 0) return;
        if (context == null || EGL14.EGL_NO_CONTEXT.equals(context) || !context.equals(EGL14.eglGetCurrentContext())) {
            abandon();
        } else {
            for (int id : uploaded.keySet()) if (PlayerGpu.release(handle, id) == 0) {
                releases++;
                residentPages--;
            }
            PlayerGpu.destroy(handle, true);
            // Native teardown also owns pages created before a failed batch was committed.
            residentPages = 0;
            handle = 0;
            uploaded = Collections.emptyMap();
        }
        Arrays.fill(worldViews, null);
        Arrays.fill(dataViews, null);
        context = null;
    }
}
