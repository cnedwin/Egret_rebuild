// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.opengl.GLSurfaceView;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import java.io.IOException;
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
    final ProjectHostServices hostServices;
    private ProjectAssets project;
    ProjectSaveStorage saves;
    private boolean drainingSaves;
    private Runnable closeAfterSaves;
    private GLSurfaceView surface;
    private PlayerGraphics graphics;
    private ScriptSession scripts;
    private ProjectBenchmark benchmark;
    final PlayerTiming timing = new PlayerTiming();
    private String vmVersion, lastError;
    private Boolean vmIntl;
    private JSONObject codeCacheStats;
    private PlayerInput controls;
    private final ProjectMusic music = new ProjectMusic();
    private final ProjectBack back;
    private final PlayerAudio audio = new PlayerAudio(this);
    private final Choreographer.FrameCallback tick = this::tick;
    private final Runnable startupTimeout = () -> fail("Project did not submit its first native frame within 30 seconds");
    private final Runnable closeTimeout = () -> { if (scripts != null) scripts.timeoutClose(); };
    private boolean wanted, foreground, gpuReady, scriptReady, ready, scheduled, busy, closed, surfacePaused;
    private boolean renderThreadStarted;
    private int contextAtLastReady, lastFrameId;
    private long acknowledgedFrame = -1;
    private PlayerGraphics.Frame rejectedWorldFrame;
    private long foregroundStartNs, elapsedNs, frames;
    private Object projectClose = JSONObject.NULL;
    volatile int epoch;
    volatile boolean ending;

    public EgretPlayerView(Activity activity, String projectAssetDir, Listener listener) {
        this(activity, projectAssetDir, listener, java.util.Collections.emptyMap(), null, null);
    }

    /** Open a project with explicit Activity-owned operations, such as a channel SDK. */
    public EgretPlayerView(Activity activity, String projectAssetDir, Listener listener,
                          java.util.Map<String, ProjectHostServices.Handler> actions) {
        this(activity, projectAssetDir, listener, actions, null, null);
    }

    /** Run a fixed workload in a debuggable application. Files stay in the app's private storage. */
    public static EgretPlayerView forDebugBenchmark(Activity activity, String projectAssetDir,
                                                   Listener listener, String mode, String expectedCaptureSha256) {
        if ((activity.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0)
            throw new IllegalStateException("Project benchmarks require a debuggable app");
        if (mode == null) throw new IllegalArgumentException("Missing project benchmark mode");
        return new EgretPlayerView(activity, projectAssetDir, listener, java.util.Collections.emptyMap(), mode, expectedCaptureSha256);
    }

    private EgretPlayerView(Activity activity, String projectAssetDir, Listener listener,
                           java.util.Map<String, ProjectHostServices.Handler> actions, String mode, String expectedDigest) {
        super(activity);
        mainThread();
        this.listener = listener != null ? listener : new Listener() {};
        back = new ProjectBack(activity);
        java.util.Map<String, ProjectHostServices.Handler> registered = new java.util.HashMap<>(actions);
        if (registered.keySet().stream().anyMatch(name -> name.startsWith("egret."))) {
            throw new IllegalArgumentException("The egret. namespace belongs to the player");
        }
        registered.put("egret.waitForBack", (json, reply) -> back.waitForBack(reply));
        registered.put("egret.editText", (json, reply) -> controls.openEditor(json, reply));
        registered.put("egret.music.play", (json, reply) -> music.play(project, json, reply));
        registered.put("egret.music.stop", (json, reply) -> { music.stop(); reply.resolve("true"); return null; });
        hostServices = new ProjectHostServices(registered, task -> ui.post(task), (id, ok) -> {
            if (!ending && scripts != null) scripts.invoke("EgretPlayerProject.hostResult(" + id + "," + ok + ")");
        }, error -> ui.post(() -> notifyError("Channel cleanup failed: " + error.getClass().getSimpleName())));
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
            if (mode != null) benchmark = new ProjectBenchmark(mode, expectedDigest, activity.getFilesDir(), project.width, project.height);
            if (benchmark != null && benchmark.replays()) {
                scripts = benchmark.replaySession(this, project);
            } else {
                saves = new ProjectSaveStorage(activity.getFilesDir(), project.root);
                scripts = BundledScripts.open(this, activity, project);
            }
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

    /** Forward Activity.onBackPressed() here on legacy hosts, then delegate to Android if false. */
    public boolean consumeSystemBack() {
        mainThread();
        return !ending && back.consume();
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
        back.setForeground(true);
        music.setForeground(true);
        scripts.resumeVm();
        if (scriptReady) scripts.invoke("EgretPlayerProject.resume()");
        if (!ready) ui.postDelayed(startupTimeout, 30000);
        schedule();
    }

    private void deactivate() {
        if (!foreground) return;
        back.setForeground(false);
        music.setForeground(false);
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
        timing.discontinuity();
        epoch++;
        if (scripts != null) scripts.discardGeometryBatches();
        acknowledgedFrame = -1;
        rejectedWorldFrame = null;
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
            if (contextAtLastReady != 0) {
                epoch++;
                if (scripts != null) scripts.discardGeometryBatches();
                acknowledgedFrame = -1;
                rejectedWorldFrame = null;
                busy = false;
                if (benchmark != null) {
                    try { benchmark.newContext(); }
                    catch (IOException error) { fail(error.getMessage()); return; }
                }
            }
            contextAtLastReady = graphics.contexts;
        }
        gpuReady = true;
        schedule();
    }

    private void schedule() {
        if (!isPlaying() || !gpuReady || busy || scheduled || (benchmark != null && !benchmark.active())) return;
        scheduled = true;
        Choreographer.getInstance().postFrameCallback(tick);
    }

    private void tick(long vsyncNs) {
        scheduled = false;
        if (!isPlaying() || !gpuReady || busy) return;
        busy = true;
        if (benchmark != null && benchmark.redrawTerminal(this)) return;
        double elapsedMs = benchmark != null ? benchmark.elapsedMs() :
            (elapsedNs + SystemClock.elapsedRealtimeNanos() - foregroundStartNs) / 1000000.0;
        timing.begin();
        long base = benchmark != null && benchmark.needsFullFrame() ? -1 : acknowledgedFrame;
        scripts.frame(epoch, elapsedMs, base, -1);
    }

    void enqueue(PlayerGraphics.Frame frame, long generationNs, long transferNs) {
        if (!isPlaying() || !gpuReady || !busy || frame.epoch != epoch) return;
        if (rejectedWorldFrame != null) {
            java.nio.ByteBuffer header = java.nio.ByteBuffer.wrap(frame.bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN);
            if (frame.id() != rejectedWorldFrame.id() || !WorldProjectPacket.isWorld(header.getInt(0)) || WorldProjectPacket.incremental(header)) {
                fail("World3D retry must supply the same complete frame");
                return;
            }
            // Preserve the texture snapshot paired with the rejected draw, even if input changed a page meanwhile.
            frame = new PlayerGraphics.Frame(epoch, frame.bytes, rejectedWorldFrame.pages, frame.geometryBatches);
            rejectedWorldFrame = null;
        }
        if (benchmark != null) {
            try { benchmark.enqueued(frame); }
            catch (IOException error) { fail(error.getMessage()); return; }
        }
        timing.script(generationNs, transferNs);
        timing.enqueued();
        graphics.enqueue(frame);
        surface.requestRender();
    }

    void missingWorldBase(PlayerGraphics.Frame rejected) {
        if (rejected.epoch != epoch || !isPlaying() || !busy) return;
        if (acknowledgedFrame < 0) { fail("World3D recovery requires a complete frame"); return; }
        acknowledgedFrame = -1;
        rejectedWorldFrame = rejected;
        // Reissue this logical frame without advancing simulation or sampling the scene twice.
        scripts.frame(epoch, 0, -1, Integer.toUnsignedLong(rejected.id()));
    }

    void drawn(int token, int frameId) {
        if (token != epoch || !isPlaying() || !busy) return;
        busy = false;
        timing.submitted();
        if (benchmark != null) {
            try { benchmark.drawn(this); }
            catch (IOException | RuntimeException error) { fail(error.toString()); return; }
        }
        // At most one frame is in flight. Only a successful draw in this epoch can be a delta base.
        acknowledgedFrame = Integer.toUnsignedLong(frameId);
        lastFrameId = frameId;
        frames++;
        if (!ready) {
            timing.firstDraw();
            ready = true;
            ui.removeCallbacks(startupTimeout);
            listener.onReady();
        }
        schedule();
    }

    void input(JSONObject event) { if (benchmark == null && isPlaying()) scripts.invoke("EgretPlayerProject.input(" + event + ")"); }
    void editor(String initial) { if (isPlaying()) controls.edit(initial == null ? "" : initial); }
    void sound(byte[] bytes) { audio.play(bytes); }
    void projectState(String json) { if (!closed) listener.onState(json); }
    void reportFailure(String reason) { ui.post(() -> fail(reason)); }

    private void fail(String reason) {
        if (ending) return;
        try { notifyError(reason); } finally { close(); }
    }

    private void notifyError(String message) {
        lastError = message == null ? "Project session failed" : message.substring(0, Math.min(512, message.length()));
        listener.onError(message);
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
        back.clear();
        hostServices.close();
        music.stop();
        wanted = false;
        if (saves == null) { closeScripts(); return; }
        // Retire admission immediately. A save that already entered may finish
        // its atomic commit without the UI thread waiting on a filesystem lock.
        drainingSaves = true;
        saves.closeWhenIdle(() -> {
            if (Looper.myLooper() == Looper.getMainLooper()) closeScripts();
            else ui.post(this::closeScripts);
        });
    }

    private void closeScripts() {
        drainingSaves = false;
        if (foreground) deactivate();
        else { cancelFrame(); stopSurface(); audio.stop(); }
        if (closeAfterSaves != null) {
            Runnable done = closeAfterSaves;
            closeAfterSaves = null;
            done.run();
            return;
        }
        if (scripts != null && scripts.requestClose()) ui.postDelayed(closeTimeout, 10000);
        else finishClose(null, null);
    }

    void finishClose(String receipt, String error) {
        if (!ending || closed) return;
        if (drainingSaves) {
            // A VM can exit while a bridge call is finishing independently.
            final String pendingError = error;
            if (closeAfterSaves == null) closeAfterSaves = () -> finishClose(receipt, pendingError);
            return;
        }
        ui.removeCallbacks(closeTimeout);
        if (benchmark != null) {
            final String sessionError = error;
            if (benchmark.releaseOrWait(() -> finishClose(receipt, sessionError))) return;
        }
        closed = true;
        if (scripts != null) { scripts.destroy(); scripts = null; }
        if (surface != null) removeView(surface);
        if (receipt != null) {
            try { projectClose = new JSONTokener(receipt).nextValue(); }
            catch (JSONException e) { error = "Invalid project close receipt: " + e; }
        }
        try { if (error != null) notifyError(error); }
        finally { listener.onClosed(); }
    }

    /** Enable bounded frame timing for an explicit measurement run. */
    public void setTimingEnabled(boolean enabled) {
        mainThread();
        timing.setEnabled(enabled && (benchmark == null || !benchmark.captures()));
    }

    void vmCache(JSONObject report) { codeCacheStats = report; }
    void vmDetails(String version, boolean intl) { vmVersion = version; vmIntl = intl; }

    /** A new snapshot of observed session counters. A draw records CPU submission. */
    public JSONObject getDiagnostics() {
        mainThread();
        try {
            return new JSONObject().put("ready", ready).put("foreground", foreground).put("closed", closed)
                .put("benchmark", benchmark == null ? null : benchmark.diagnostics())
                .put("lastError", lastError).put("scriptHost", benchmark != null && benchmark.replays() ? "native-replay" : BundledScripts.PROFILE).put("vmVersion", vmVersion).put("intl", vmIntl).put("codeCache", codeCacheStats)
                .put("music", music.snapshot()).put("timing", timing.snapshot()).put("frames", frames).put("lastFrameId", lastFrameId).put("contexts", graphics == null ? 0 : graphics.contexts)
                .put("uploads", graphics == null ? 0 : graphics.uploads).put("releases", graphics == null ? 0 : graphics.releases)
                .put("geometryBatchPackets", scripts == null ? 0 : scripts.geometryBatchPackets)
                .put("geometryBatchBridgeBytes", scripts == null ? 0 : scripts.geometryBatchBridgeBytes)
                .put("largestGeometryBatchBytes", scripts == null ? 0 : scripts.largestGeometryBatchBytes)
                .put("streamedDraws", scripts == null ? 0 : scripts.streamedDraws)
                .put("streamedDrawBridgeBytes", scripts == null ? 0 : scripts.streamedDrawBridgeBytes)
                .put("largestStreamedDrawBytes", scripts == null ? 0 : scripts.largestStreamedDrawBytes)
                .put("sampledWorldGeometryBytes", graphics == null ? 0 : graphics.sampledWorldGeometryBytes)
                .put("abandoned", graphics == null ? 0 : graphics.abandoned).put("audioStarts", audio.starts)
                .put("audioReleases", audio.releases).put("activeSounds", audio.active())
                .put("inputEvents", controls == null ? 0 : controls.events).put("editorOpens", controls == null ? 0 : controls.edits)
                .put("projectClose", projectClose);
        } catch (JSONException e) { throw new IllegalStateException(e); }
    }
}
