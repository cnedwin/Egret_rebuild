// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.app.Activity;
import android.graphics.Color;
import android.opengl.GLSurfaceView;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Embeds a trusted bundled Egret project in any Activity. Construct, attach and
 * call lifecycle methods on the main thread. The project directory is relative
 * to Android assets. Forward Activity resume, pause and destroy (close) events.
 */
public final class EgretPlayerView extends FrameLayout implements AutoCloseable {
    public interface Listener {
        /** Called once, after the first successful native draw submission. */
        default void onReady() {}
        /** Session or teardown failure, reported on the main thread. */
        default void onError(String message) {}
        /** JSON supplied by the game's EgretNativePlayer.state call. */
        default void onState(String json) {}
        /** Terminal notification after native, script and audio cleanup. */
        default void onClosed() {}
    }

    final Handler ui = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private ProjectAssets project;
    private GLSurfaceView surface;
    private PlayerGraphics graphics;
    private PlayerScripts scripts;
    private PlayerInput controls;
    private final PlayerAudio audio = new PlayerAudio(this);
    private final Choreographer.FrameCallback tick = this::tick;
    private final Runnable startupTimeout = () -> fail("Project did not submit its first native frame within 30 seconds");
    private final Runnable closeTimeout = () -> finishClose(null, "Project close did not complete within 10 seconds");
    private boolean wanted, foreground, gpuReady, scriptReady, ready, scheduled, busy, closed, surfacePaused;
    private boolean renderThreadStarted;
    private int contextAtLastReady, lastFrameId;
    private long foregroundStartNs, elapsedNs, frames;
    private Object projectClose = JSONObject.NULL;
    volatile int epoch;
    volatile boolean ending;

    public EgretPlayerView(Activity activity, String projectAssetDir, Listener listener) {
        super(activity);
        mainThread();
        this.listener = listener != null ? listener : new Listener() {};
        setBackgroundColor(Color.BLACK);
        try {
            project = new ProjectAssets(activity.getAssets(), projectAssetDir);
            graphics = new PlayerGraphics(this);
            surface = new GLSurfaceView(activity);
            surface.setEGLContextClientVersion(3);
            surface.setEGLConfigChooser(8, 8, 8, 8, 0, 0);
            surface.setEGLContextFactory(graphics);
            surface.setPreserveEGLContextOnPause(false);
            surface.setContentDescription("Egret game");
            controls = new PlayerInput(this, activity, surface, project);
            scripts = new PlayerScripts(this, activity, project);
        } catch (Exception | LinkageError e) { reportFailure("Cannot open Egret project: " + e); }
    }

    private static void mainThread() {
        if (Looper.myLooper() != Looper.getMainLooper()) throw new IllegalStateException("EgretPlayerView requires the main thread");
    }

    @Override protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        if (surface == null || surface.getParent() != this) return;
        int availableWidth = getMeasuredWidth() - getPaddingLeft() - getPaddingRight();
        int availableHeight = getMeasuredHeight() - getPaddingTop() - getPaddingBottom();
        double scale = Math.min(availableWidth / (double) project.width, availableHeight / (double) project.height);
        int w = Math.max(1, (int) Math.round(project.width * scale));
        int h = Math.max(1, (int) Math.round(project.height * scale));
        surface.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
    }

    /** Start or resume delivery of foreground time, input and frames. */
    public void onResume() {
        mainThread();
        wanted = true;
        if (isAttachedToWindow()) activate();
    }

    /** Quiesce frame delivery, release the EGL context and stop active sound effects. */
    public void onPause() {
        mainThread();
        wanted = false;
        deactivate();
    }

    @Override protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (wanted) activate();
    }

    @Override protected void onDetachedFromWindow() {
        deactivate();
        super.onDetachedFromWindow();
    }

    private void activate() {
        if (ending || foreground || scripts == null) return;
        // Starting the GL thread requires both a foreground host and a window.
        // A view closed before attachment never creates a thread that cannot detach.
        if (!renderThreadStarted) {
            surface.setRenderer(graphics);
            surface.setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY);
            renderThreadStarted = true;
            addView(surface, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.CENTER));
        }
        foreground = true;
        foregroundStartNs = SystemClock.elapsedRealtimeNanos();
        if (surfacePaused) {
            surface.onResume();
            surfacePaused = false;
        }
        scripts.resumeVm();
        if (scriptReady) scripts.invoke("EgretPlayerProject.resume()");
        if (!ready) ui.postDelayed(startupTimeout, 30000);
        schedule();
    }

    private void deactivate() {
        if (!foreground) return;
        controls.stop();
        audio.stop();
        elapsedNs += SystemClock.elapsedRealtimeNanos() - foregroundStartNs;
        foreground = false;
        cancelFrame();
        if (scripts != null) {
            if (scriptReady) scripts.invoke("EgretPlayerProject.pause()");
            scripts.pauseVm();
        }
        stopSurface();
    }

    private void cancelFrame() {
        epoch++;
        Choreographer.getInstance().removeFrameCallback(tick);
        scheduled = false;
        busy = false;
        ui.removeCallbacks(startupTimeout);
    }

    private void stopSurface() {
        gpuReady = false;
        if (!renderThreadStarted || surfacePaused) return;
        // queueEvent executes on the owner GL thread. onPause waits for Android
        // to retire its EGL context, so a new foreground cannot reuse stale names.
        surface.queueEvent(graphics::closeCurrent);
        surface.onPause();
        surfacePaused = true;
    }

    boolean isPlaying() { return foreground && scriptReady && !ending; }

    void started() {
        if (ending || scriptReady) return;
        scriptReady = true;
        scripts.invoke(foreground ? "EgretPlayerProject.resume()" : "EgretPlayerProject.pause()");
        schedule();
    }

    void surfaceReady(int token) {
        if (ending || token != epoch || surfacePaused) return;
        if (contextAtLastReady != graphics.contexts) {
            // Invalidate an outstanding JS or native callback when a context is
            // replaced outside Activity lifecycle (e.g. the window loses EGL).
            if (contextAtLastReady != 0) { epoch++; busy = false; }
            contextAtLastReady = graphics.contexts;
        }
        gpuReady = true;
        schedule();
    }

    private void schedule() {
        if (!isPlaying() || !gpuReady || busy || scheduled) return;
        scheduled = true;
        Choreographer.getInstance().postFrameCallback(tick);
    }

    private void tick(long vsyncNs) {
        scheduled = false;
        if (!isPlaying() || !gpuReady || busy) return;
        busy = true;
        double elapsedMs = (elapsedNs + SystemClock.elapsedRealtimeNanos() - foregroundStartNs) / 1000000.0;
        scripts.frame(epoch, elapsedMs);
    }

    void enqueue(PlayerGraphics.Frame frame) {
        if (!isPlaying() || !gpuReady || !busy || frame.epoch != epoch) return;
        graphics.enqueue(frame);
        surface.requestRender();
    }

    void drawn(int token, int frameId) {
        if (token != epoch || !isPlaying() || !busy) return;
        busy = false;
        lastFrameId = frameId;
        frames++;
        if (!ready) {
            ready = true;
            ui.removeCallbacks(startupTimeout);
            listener.onReady();
        }
        schedule();
    }

    void input(JSONObject event) { if (isPlaying()) scripts.invoke("EgretPlayerProject.input(" + event + ")"); }
    void editor(String initial) { if (isPlaying()) controls.edit(initial == null ? "" : initial); }
    void sound(byte[] bytes) { audio.play(bytes); }
    void projectState(String json) { if (!closed) listener.onState(json); }
    void reportFailure(String reason) { ui.post(() -> fail(reason)); }

    private void fail(String reason) {
        if (ending) return;
        try { listener.onError(reason); } finally { close(); }
    }

    void scriptProcessLost() {
        if (closed) return;
        if (ending) finishClose(null, "Script process exited during project teardown");
        else fail("Android WebView script process exited");
    }

    /** Dispose once. onClosed reports completion of the asynchronous project close. */
    @Override public void close() {
        mainThread();
        if (ending) return;
        ending = true;
        wanted = false;
        if (foreground) deactivate();
        else { cancelFrame(); stopSurface(); audio.stop(); }
        if (scripts != null && scripts.requestClose()) ui.postDelayed(closeTimeout, 10000);
        else finishClose(null, null);
    }

    void finishClose(String receipt, String error) {
        if (!ending || closed) return;
        closed = true;
        ui.removeCallbacks(closeTimeout);
        if (scripts != null) { scripts.destroy(); scripts = null; }
        if (surface != null) removeView(surface);
        if (receipt != null) {
            try { projectClose = new JSONTokener(receipt).nextValue(); }
            catch (JSONException e) { error = "Invalid project close receipt: " + e; }
        }
        try { if (error != null) listener.onError(error); }
        finally { listener.onClosed(); }
    }

    /** A new snapshot of observed session counters. A draw records CPU submission. */
    public JSONObject getDiagnostics() {
        mainThread();
        try {
            return new JSONObject().put("ready", ready).put("foreground", foreground).put("closed", closed)
                .put("frames", frames).put("lastFrameId", lastFrameId).put("contexts", graphics == null ? 0 : graphics.contexts)
                .put("uploads", graphics == null ? 0 : graphics.uploads).put("releases", graphics == null ? 0 : graphics.releases)
                .put("abandoned", graphics == null ? 0 : graphics.abandoned).put("audioStarts", audio.starts)
                .put("audioReleases", audio.releases).put("activeSounds", audio.active())
                .put("inputEvents", controls == null ? 0 : controls.events).put("editorOpens", controls == null ? 0 : controls.edits)
                .put("projectClose", projectClose);
        } catch (JSONException e) { throw new IllegalStateException(e); }
    }
}
