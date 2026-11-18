// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import android.opengl.EGL14;
import android.opengl.EGLContext;
import android.opengl.GLES30;
import android.opengl.GLSurfaceView;
import android.os.Trace;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

final class FrameRenderer implements GLSurfaceView.Renderer {
    private final GameActivity owner;
    private final Fixture fixture;
    private long handle;
    private EGLContext context;
    private int width, height;
    private final java.util.concurrent.atomic.AtomicReference<Frame> pending =
        new java.util.concurrent.atomic.AtomicReference<>();

    void enqueue(Frame frame) { pending.set(frame); }
    private boolean uploaded;
    int creations, uploads, abandoned, releases;

    FrameRenderer(GameActivity owner, Fixture fixture) {
        this.owner = owner;
        this.fixture = fixture;
    }

    @Override public void onSurfaceCreated(GL10 ignored, EGLConfig config) {
        // The previous context has been irreversibly lost. GL names from it must
        // never be released against the fresh context, even if handles repeat.
        if (handle != 0) {
            Gpu.destroy(handle, false);
            abandoned++;
        }
        handle = Gpu.create();
        context = EGL14.eglGetCurrentContext();
        uploaded = handle != 0 && Gpu.upload(handle, fixture.page, fixture.atlasWidth,
            fixture.atlasHeight, fixture.atlas) == 0;
        if (handle != 0) creations++;
        if (uploaded) uploads++;
        if (!uploaded) owner.failOnUi("Rust device creation or atlas upload failed");
    }

    @Override public void onSurfaceChanged(GL10 unused, int width, int height) {
        this.width = width;
        this.height = height;
        boolean sizeMatches = width == fixture.width && height == fixture.height;
        if (uploaded && sizeMatches) {
            int epoch = owner.generation;
            owner.runOnUiThread(() -> owner.surfaceReady(epoch));
        }
    }

    @Override public void onDrawFrame(GL10 unused) {
        Frame frame = pending.getAndSet(null);
        if (frame == null || frame.generation != owner.generation) return;
        if (!uploaded || width != fixture.width || height != fixture.height) {
            owner.failOnUi("Unexpected renderbuffer or retired device");
            return;
        }
        Trace.beginSection("Egret.GLES2D.submit");
        int status;
        try {
            frame.drawStartNs = System.nanoTime();
            status = Gpu.draw(handle, frame.bytes, frame.offset, fixture.frameBytes, width, height);
            frame.drawEndNs = System.nanoTime();
        } finally {
            Trace.endSection();
        }
        if (status != 0) {
            owner.failOnUi("Rust draw returned " + status);
            return;
        }
        String pixelDigest = null;
        if (owner.lastFrame(frame)) {
            // One fenced readback after the final CPU sample, never inside its submit interval.
            try {
                pixelDigest = pixelDigest();
                closeCurrent();
                if (releases != 1) throw new IllegalStateException("GL texture release count: " + releases);
            }
            catch (Exception e) { owner.failOnUi("Pixel readback failed: " + e); return; }
        }
        final String digest = pixelDigest;
        owner.runOnUiThread(() -> owner.complete(frame, digest));
    }

    private String pixelDigest() throws Exception {
        ByteBuffer pixels = ByteBuffer.allocateDirect(width * height * 4);
        GLES30.glReadPixels(0, 0, width, height, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, pixels);
        if (GLES30.glGetError() != GLES30.GL_NO_ERROR) throw new IllegalStateException("glReadPixels");
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        // Normalize GL's bottom-up rows to top-down RGBA for cross-host comparison.
        for (int y = height - 1; y >= 0; y--) {
            ByteBuffer row = pixels.duplicate();
            row.position(y * width * 4);
            row.limit((y + 1) * width * 4);
            sha.update(row);
        }
        StringBuilder text = new StringBuilder();
        for (byte value : sha.digest()) text.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return text.toString();
    }

    void closeCurrent() {
        pending.set(null);
        if (handle == 0) return;
        boolean current = context != null && !EGL14.EGL_NO_CONTEXT.equals(context)
            && context.equals(EGL14.eglGetCurrentContext());
        if (uploaded && current && Gpu.release(handle, fixture.page) == 0) releases++;
        Gpu.destroy(handle, current);
        handle = 0;
        uploaded = false;
        context = null;
    }
}
