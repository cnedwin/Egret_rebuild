// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.opengl.GLSurfaceView;
import android.os.Bundle;
import android.os.Debug;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;
import android.view.Choreographer;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

public final class GameActivity extends Activity {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final long activityStart = SystemClock.elapsedRealtimeNanos();
    private Fixture fixture;
    private GLSurfaceView surface;
    private FrameRenderer renderer;
    private WebView vm;
    private FrameLayout root;
    private Frame[] records;
    private ByteBuffer liveBytes;
    private int warmup, samples, next, checked;
    volatile int generation;
    private boolean replay, verify, recover, finishAfter, active, gpuReady, done, running, restored, succeeded;
    private String runId;
    private JSONObject pendingClose;
    private boolean returnAfterSuccess, graphicsPaused;
    private boolean demo, demoPaused, demoClosing, frameworkDestroyed, firstVisibleInSession;
    private long demoFrames;
    private int resumeCount;
    private final Runnable closeTimeout = () -> demoClosed(0, "JS teardown timed out");
    private long firstDrawBoottimeNs, lastProgress;
    private final Runnable watchdog = new Runnable() {
        @Override public void run() {
            if (!active || done) return;
            if (!(demo && (demoPaused || demoClosing)) && SystemClock.elapsedRealtime() - lastProgress > 30_000) {
                fail("30 s without a completed frame");
                return;
            }
            ui.postDelayed(this, 5_000);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            // Each launch has its own receipt. A prior successful file must not survive a failed launch.
            demo = Intent.ACTION_MAIN.equals(getIntent().getAction())
                && !getIntent().hasExtra("mode") && !getIntent().hasExtra("runId");
            runId = getIntent().getStringExtra("runId");
            if (runId == null) runId = "interactive";
            if (!runId.matches("[a-zA-Z0-9_.-]{1,80}")) throw new IllegalArgumentException("runId");
            save(new JSONObject().put("status", "starting"));
            String mode = getIntent().getStringExtra("mode");
            if (mode == null) mode = "native";
            if (!mode.equals("native") && !mode.equals("replay")) throw new IllegalArgumentException("mode");
            replay = mode.equals("replay");
            verify = getIntent().getBooleanExtra("verify", false);
            recover = getIntent().getBooleanExtra("recover", false);
            finishAfter = getIntent().getBooleanExtra("finish", false);
            warmup = getIntent().getIntExtra("warmup", 60);
            samples = getIntent().getIntExtra("samples", 300);
            if (warmup < 0 || warmup > 1200 || samples < 2 || samples > 3600) {
                throw new IllegalArgumentException("sample count");
            }
            fixture = new Fixture(getAssets(), verify, replay);
            if (verify && warmup + samples < fixture.frameCount) {
                throw new IllegalArgumentException("verification requires one full cycle");
            }
            if (!demo) records = new Frame[warmup + samples];
            else if (state != null) {
                next = Math.floorMod(state.getInt("demoNext"), fixture.frameCount);
                demoPaused = state.getBoolean("demoPaused");
                demoFrames = state.getLong("demoFrames");
            }
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            root = new FrameLayout(this);
            root.setBackgroundColor(Color.BLACK);
            setContentView(root);
            if (replay) installSurface();
            else installVm();
        } catch (Exception | LinkageError e) {
            fail(e.toString());
        }
    }

    private void installVm() {
        liveBytes = ByteBuffer.allocateDirect(fixture.frameBytes);
        // This WebView executes only the packaged game JS. It is never attached as a rendering surface.
        vm = new WebView(this);
        vm.getSettings().setBlockNetworkLoads(true);
        vm.getSettings().setAllowContentAccess(false);
        vm.getSettings().setAllowFileAccess(false);
        vm.getSettings().setJavaScriptEnabled(true);
        vm.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
        });
        vm.setWebChromeClient(new WebChromeClient() {
            @Override public void onReceivedTitle(WebView view, String title) {
                if (title == null || done) return;
                if (demoClosing) {
                    if (title.startsWith("egret-closed:")) {
                        try {
                            int releases = new JSONObject(title.substring("egret-closed:".length())).getInt("releases");
                            demoClosed(releases, releases == 1 ? null : "Unexpected scope release count");
                        } catch (Exception e) { demoClosed(0, e.toString()); }
                    } else if (title.startsWith("egret-error:")) demoClosed(0, title);
                    else if (title.equals("egret-ready")) requestDemoScopeClose();
                    return;
                }
                if (title.startsWith("egret-closed:") && pendingClose != null) {
                    try {
                        JSONObject closed = new JSONObject(title.substring("egret-closed:".length()));
                        if (closed.getInt("releases") != 1) throw new IllegalStateException("Egret scope release count");
                        finishReport(pendingClose.put("engineLeaseReleases", 1));
                    } catch (Exception e) { fail(e.toString()); }
                    return;
                }
                if (title.startsWith("egret-error:")) { fail(title); return; }
                if (!title.equals("egret-ready") || surface != null) return;
                vm.evaluateJavascript("EgretRuntimeFixture.texture()", raw -> {
                    if (done || demoClosing || surface != null) return;
                    try {
                        byte[] rgba = decode(raw);
                        if (rgba.length != fixture.atlasWidth * fixture.atlasHeight * 4) {
                            throw new IllegalStateException("runtime atlas size");
                        }
                        fixture.atlas = (ByteBuffer)ByteBuffer.allocateDirect(rgba.length).put(rgba).rewind();
                        if (verify) Fixture.checkDigest(fixture.atlas, fixture.expectedAtlas);
                        installSurface();
                    } catch (Exception e) { fail(e.toString()); }
                });
            }
        });
        vm.loadUrl("file:///android_asset/scene/host.html");
    }

    private static String resultString(String raw) throws Exception {
        Object value = new JSONTokener(raw).nextValue();
        if (!(value instanceof String)) throw new IllegalArgumentException("Missing JS bridge result");
        return (String)value;
    }

    private static byte[] decode(String raw) throws Exception {
        return Base64.decode(resultString(raw), Base64.DEFAULT);
    }

    private void installSurface() {
        surface = new GLSurfaceView(this);
        surface.setEGLContextClientVersion(3);
        surface.setEGLConfigChooser(8, 8, 8, 8, 0, 0);
        surface.setPreserveEGLContextOnPause(false);
        surface.getHolder().setFixedSize(fixture.width, fixture.height);
        renderer = new FrameRenderer(this, fixture);
        surface.setRenderer(renderer);
        surface.setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY);
        if (demo) {
            surface.setContentDescription("Egret 2D animation. Tap to pause or resume.");
            surface.setOnClickListener(v -> {
                demoPaused = !demoPaused;
                demoState(demoPaused ? "paused" : "playing", 0, null);
                lastProgress = SystemClock.elapsedRealtime();
                if (!demoPaused) startIfReady();
            });
        }
        root.addView(surface, new FrameLayout.LayoutParams(1, 1, Gravity.CENTER));
        root.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> layoutSurface());
        layoutSurface();
    }

    private void layoutSurface() {
        if (root.getWidth() == 0 || root.getHeight() == 0) return;
        float scale = Math.min(root.getWidth() / (float)fixture.width, root.getHeight() / (float)fixture.height);
        FrameLayout.LayoutParams p = (FrameLayout.LayoutParams)surface.getLayoutParams();
        int width = Math.round(fixture.width * scale), height = Math.round(fixture.height * scale);
        if (p.width == width && p.height == height) return;
        p.width = width; p.height = height;
        surface.setLayoutParams(p);
    }

    void surfaceReady(int epoch) {
        if (epoch != generation) return;
        gpuReady = true;
        if (restored && running && !done && active) {
            restored = false;
            schedule();
        } else startIfReady();
    }

    private void startIfReady() {
        if (!(active && gpuReady) || done || demoClosing || running) return;
        running = true;
        schedule();
    }

    private void schedule() {
        final int token = generation;
        Choreographer.getInstance().postFrameCallback(time -> {
            if (done || !active || token != generation) return;
            int index = next % fixture.frameCount;
            if (demo && demoPaused && demoFrames != 0) index = Math.floorMod(next - 1, fixture.frameCount);
            final Frame frame = new Frame(next, index, token, time);
            if (replay) {
                frame.bytes = fixture.replay;
                frame.offset = frame.index * fixture.frameBytes;
                frame.dataReadyNs = System.nanoTime();
                submit(frame);
            } else {
                // JS build time includes encoding. The enclosing round trip separately includes VM scheduling.
                String js = "(()=>{let t=performance.now(),p=EgretRuntimeFixture.frame(" + frame.index
                    + ");return Math.round((performance.now()-t)*1e6)+':'+p})()";
                vm.evaluateJavascript(js, raw -> {
                    if (done || !active || token != generation) return;
                    frame.vmCallbackNs = System.nanoTime();
                    try {
                        String value = resultString(raw);
                        int separator = value.indexOf(':');
                        if (separator <= 0) throw new IllegalArgumentException("Invalid JS result");
                        frame.jsWorkNs = Long.parseLong(value.substring(0, separator));
                        byte[] bytes = Base64.decode(value.substring(separator + 1), Base64.DEFAULT);
                        if (bytes.length != fixture.frameBytes) throw new IllegalStateException("Frame size");
                        if (verify && !fixture.matches(frame.index, bytes)) throw new IllegalStateException("Frame mismatch " + frame.index);
                        if (verify) checked++;
                        liveBytes.clear();
                        liveBytes.put(bytes);
                        frame.bytes = liveBytes;
                        frame.dataReadyNs = System.nanoTime();
                        submit(frame);
                    } catch (Exception e) { fail(e.toString()); }
                });
            }
        });
    }

    private void submit(Frame frame) {
        // One frame is admitted at a time; the direct buffer may be reused only after completion.
        renderer.enqueue(frame);
        surface.requestRender();
    }

    boolean lastFrame(Frame frame) { return !demo && frame.number == records.length - 1; }

    void complete(Frame frame, String digest) {
        if (done || !active || frame.generation != generation) return;
        if (frame.number != next) { fail("Out-of-order frame"); return; }
        if (demo) {
            // Keep just the cycle cursor. An interactive launch never accumulates timing history.
            next = (frame.index + 1) % fixture.frameCount;
            demoFrames++;
            lastProgress = SystemClock.elapsedRealtime();
            if (!firstVisibleInSession) {
                firstVisibleInSession = true;
                demoState(demoPaused ? "paused" : "playing", 0, null);
            }
            if (demoPaused) running = false;
            else schedule();
            return;
        }
        if (next == 0) firstDrawBoottimeNs = SystemClock.elapsedRealtimeNanos();
        lastProgress = SystemClock.elapsedRealtime();
        records[next++] = frame;
        if (next != records.length) {
            if (recover && next == records.length / 2) {
                // Foreground diagnostic only: request Android to destroy and recreate the EGL context.
                restored = true;
                gpuReady = false;
                surface.onPause();
                surface.onResume();
            } else schedule();
            return;
        }
        try {
            JSONObject report = new JSONObject();
            report.put("status", "complete").put("mode", replay ? "replay" : "native")
                .put("backend", "gles3").put("width", fixture.width).put("height", fixture.height)
                .put("warmup", warmup).put("samples", samples).put("frameBytes", fixture.frameBytes)
                .put("verifiedLiveFrameCount", checked).put("lastCycleIndex", frame.index)
                .put("topDownRgbaSha256", digest).put("activityToFirstDrawNs", firstDrawBoottimeNs - activityStart)
                .put("processToFirstDrawNs", firstDrawBoottimeNs - android.os.Process.getStartElapsedRealtime() * 1000000L)
                .put("verifiedAssetDigests", verify).put("hostPssAtEndKiB", Debug.getPss()).put("recoveryDiagnostic", recover)
                .put("deviceCreations", renderer.creations).put("atlasUploads", renderer.uploads)
                .put("lostContextsAbandoned", renderer.abandoned).put("glPageReleases", renderer.releases);
            if (recover && (renderer.abandoned != 1 || renderer.uploads != 2)) {
                throw new IllegalStateException("EGL context recovery was not observed");
            }
            String[] fields = {"vsyncNs", "requestNs", "vmCallbackNs", "jsWorkNs", "dataReadyNs", "drawStartNs", "drawEndNs"};
            JSONArray rows = new JSONArray();
            for (int i = warmup; i < records.length; i++) {
                Frame f = records[i];
                rows.put(new JSONArray().put(f.vsyncNs).put(f.requestNs).put(f.vmCallbackNs)
                    .put(f.jsWorkNs).put(f.dataReadyNs).put(f.drawStartNs).put(f.drawEndNs));
            }
            report.put("fields", new JSONArray(java.util.Arrays.asList(fields))).put("frames", rows);
            if (replay) finishReport(report.put("engineLeaseReleases", JSONObject.NULL));
            else {
                pendingClose = report;
                vm.evaluateJavascript("EgretRuntimeFixture.close().then(r=>{document.title='egret-closed:'+JSON.stringify(r)},"
                    + "e=>{document.title='egret-error:'+String(e)})", null);
            }
        } catch (Exception e) { fail(e.toString()); }
    }

    private void finishReport(JSONObject report) throws Exception {
        save(report);
        pendingClose = null;
        done = true;
        succeeded = true;
        Log.i("EgretRuntime", "complete " + (replay ? "replay" : "native"));
        if (finishAfter) finish();
    }

    private void save(JSONObject report) throws Exception {
        report.put("runId", runId);
        android.util.AtomicFile target = new android.util.AtomicFile(new java.io.File(getFilesDir(), demo ? "demo.json" : "result.json"));
        FileOutputStream output = target.startWrite();
        try {
            output.write(report.toString().getBytes(StandardCharsets.UTF_8));
            target.finishWrite(output);
        } catch (Exception e) {
            target.failWrite(output);
            throw e;
        }
    }

    void failOnUi(String text) { runOnUiThread(() -> fail(text)); }

    private void fail(String text) {
        if (done) return;
        done = true;
        pauseGraphics();
        if (vm != null) vm.evaluateJavascript("globalThis.EgretRuntimeFixture?.close().catch(()=>{})", null);
        Log.e("EgretRuntime", text);
        try { save(new JSONObject().put("status", "failed").put("reason", text)); }
        catch (Exception io) { Log.e("EgretRuntime", "Cannot write failure", io); }
        TextView label = new TextView(this);
        label.setText("Egret Runtime: " + text);
        setContentView(label);
    }

    @Override public void onResume() {
        super.onResume();
        if (demo) resumeCount++;
        if (returnAfterSuccess) { recreate(); return; }
        active = true;
        lastProgress = SystemClock.elapsedRealtime();
        if (surface != null && !done) {
            surface.onResume();
            graphicsPaused = false;
        }
        if (vm != null) vm.onResume();
        if (!done) {
            ui.postDelayed(watchdog, 5_000);
            startIfReady();
        }
    }

    @Override public void onPause() {
        active = false;
        returnAfterSuccess = succeeded && !isFinishing();
        generation++;
        ui.removeCallbacks(watchdog);
        pauseGraphics();
        if (vm != null && !demoClosing) vm.onPause();
        if (demo) {
            running = false;
            firstVisibleInSession = false;
            if (!done && !demoClosing) demoState("background", 0, null);
        } else if (running && !done) fail("Foreground lost; measurement interrupted");
        super.onPause();
    }

    @Override public void onSaveInstanceState(Bundle out) {
        if (demo) {
            out.putInt("demoNext", next);
            out.putLong("demoFrames", demoFrames);
            out.putBoolean("demoPaused", demoPaused);
        }
        super.onSaveInstanceState(out);
    }

    @Override public void onBackPressed() {
        if (demo && !done) { closeDemo(); return; }
        super.onBackPressed();
    }

    private void demoState(String state, int engineReleases, String error) {
        try {
            JSONObject result = new JSONObject().put("status", state).put("mode", "interactive")
                .put("frames", demoFrames).put("nextIndex", next).put("resumes", resumeCount)
                .put("paused", demoPaused).put("engineLeaseReleases", engineReleases);
            if (renderer != null) result.put("atlasUploads", renderer.uploads)
                .put("glPageReleases", renderer.releases).put("lostContextsAbandoned", renderer.abandoned);
            if (error != null) result.put("reason", error);
            save(result);
        } catch (Exception e) { Log.e("EgretRuntime", "Cannot write demo state", e); }
    }

    private void pauseGraphics() {
        if (surface == null || graphicsPaused) return;
        // Retire the Rust owner on its GL thread before Android can detach the view.
        surface.queueEvent(renderer::closeCurrent);
        surface.onPause();
        graphicsPaused = true;
        gpuReady = false;
    }

    private void closeDemo() {
        if (done || demoClosing) return;
        demoClosing = true;
        generation++;
        if (active) pauseGraphics();
        if (vm == null) { demoClosed(0, "No JS session"); return; }
        vm.onResume();
        ui.postDelayed(closeTimeout, 3000);
        requestDemoScopeClose();
    }

    private void requestDemoScopeClose() {
        // A Back gesture can arrive while WebView is still on about:blank.
        // In that case the ready-title callback retries against the loaded document.
        vm.evaluateJavascript("if(globalThis.EgretRuntimeFixture)EgretRuntimeFixture.close()"
            + ".then(r=>{document.title='egret-closed:'+JSON.stringify(r)},"
            + "e=>{document.title='egret-error:'+String(e)})", null);
    }

    private void demoClosed(int engineReleases, String error) {
        if (done) return;
        done = true;
        ui.removeCallbacks(closeTimeout);
        demoState(error == null ? "closed" : "failed", engineReleases, error);
        if (vm != null) { vm.destroy(); vm = null; }
        if (!frameworkDestroyed) finish();
    }

    @Override public void onDestroy() {
        ui.removeCallbacks(watchdog);
        frameworkDestroyed = true;
        if (demo && !done) closeDemo();
        else if (vm != null) {
            vm.destroy();
            vm = null;
        }
        super.onDestroy();
    }
}
