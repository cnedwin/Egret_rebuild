// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.os.Handler;
import java.io.File;
import java.io.IOException;
import org.json.JSONException;
import org.json.JSONObject;

/** Finite, input-free game workload for debug APK measurements. All state belongs to the UI thread. */
final class ProjectBenchmark {
    private final String mode, expectedDigest;
    private final File file;
    private final int width, height;
    private int frames;
    private boolean complete, restoreTerminal, ioPending;
    private String digest;
    private Runnable afterIO;
    private ProjectReplayTape.Recorder recorder;
    private ProjectReplayTape tape;
    private PlayerGraphics.Frame pending, terminal;

    ProjectBenchmark(String mode, String expectedDigest, File filesDir, int width, int height) {
        if (!"capture".equals(mode) && !"replay".equals(mode) && !"live".equals(mode))
            throw new IllegalArgumentException("Expected capture, live or replay benchmark mode");
        if ("replay".equals(mode) && (expectedDigest == null || !expectedDigest.matches("[0-9a-f]{64}")))
            throw new IllegalArgumentException("Replay requires the expected capture SHA-256");
        this.mode = mode;
        this.expectedDigest = expectedDigest;
        this.file = new File(filesDir, "egret-project-replay.egrp");
        this.width = width;
        this.height = height;
        if (captures()) recorder = new ProjectReplayTape.Recorder(width, height);
    }

    boolean captures() { return "capture".equals(mode); }
    boolean replays() { return "replay".equals(mode); }
    // A capture and the retained terminal image must render on a fresh EGL context.
    boolean needsFullFrame() { return captures() || frames >= ProjectReplayTape.FRAMES - 1; }
    boolean active() { return frames < ProjectReplayTape.FRAMES || restoreTerminal; }
    double elapsedMs() { return frames * 1000.0 / 120.0; }

    void enqueued(PlayerGraphics.Frame frame) throws IOException {
        int expected = Math.min(frames, ProjectReplayTape.FRAMES - 1);
        if (frame.id() != expected) throw new IOException("Benchmark expected frame " + expected + ", got " + frame.id());
        // Warm and timed live frames retain only the terminal packet. The capture pass owns its own snapshots.
        if (captures() || expected == ProjectReplayTape.FRAMES - 1) pending = frame;
    }

    void drawn(EgretPlayerView owner) throws IOException {
        if (frames == ProjectReplayTape.FRAMES) {
            pending = null;
            return;
        }
        if (captures()) recorder.add(pending);
        frames++;
        if (frames == ProjectReplayTape.FRAMES) {
            terminal = pending;
            if (captures()) save(owner);
            else complete = true;
        }
        pending = null;
    }

    void newContext() throws IOException {
        if (frames == ProjectReplayTape.FRAMES) restoreTerminal = true;
        else if (frames > 0) throw new IOException("Benchmark was interrupted before the terminal frame");
    }

    boolean redrawTerminal(EgretPlayerView owner) {
        if (!restoreTerminal) return false;
        restoreTerminal = false;
        owner.enqueue(new PlayerGraphics.Frame(owner.epoch, terminal.bytes, terminal.pages), -1, -1);
        return true;
    }

    // Only the capture lane serializes or hashes. The stored packet and immutable pages travel together.
    private void save(EgretPlayerView owner) {
        final ProjectReplayTape.Recorder captured = recorder;
        recorder = null;
        startIO(owner, () -> {
            String hash = captured.write(file);
            return () -> { digest = hash; complete = true; };
        });
    }

    private interface IO { Runnable run() throws IOException; }

    private void startIO(EgretPlayerView owner, IO operation) {
        ioPending = true;
        Handler ui = owner.ui;
        new Thread(() -> {
            Runnable completion;
            try { completion = operation.run(); }
            catch (IOException | RuntimeException error) {
                completion = () -> owner.reportFailure("Project benchmark: " + error);
            }
            final Runnable deliver = completion;
            ui.post(() -> {
                ioPending = false;
                if (!owner.ending) deliver.run();
                if (afterIO != null) {
                    Runnable done = afterIO;
                    afterIO = null;
                    done.run();
                }
            });
        }, "Egret benchmark storage").start();
    }

    boolean releaseOrWait(Runnable done) {
        if (ioPending) {
            if (afterIO == null) afterIO = done;
            return true;
        }
        recorder = null;
        tape = null;
        terminal = pending = null;
        return false;
    }

    JSONObject diagnostics() throws JSONException {
        return new JSONObject().put("mode", mode).put("frames", frames).put("complete", complete)
            .put("sha256", digest);
    }

    ScriptSession replaySession(EgretPlayerView owner, ProjectAssets project) {
        return new Replay(owner, project);
    }

    /** Only preloaded frame bytes and texture pages reach the native renderer in this lane. */
    private final class Replay extends ScriptSession {
        Replay(EgretPlayerView owner, ProjectAssets project) {
            super(owner, project);
            startIO(owner, () -> {
                ProjectReplayTape loaded = ProjectReplayTape.read(file, width, height);
                if (!expectedDigest.equals(loaded.sha256()))
                    throw new IOException("Replay tape differs from the expected capture SHA-256");
                return () -> {
                    tape = loaded;
                    digest = loaded.sha256();
                    owner.started();
                };
            });
        }

        @Override void frame(int epoch, double elapsedMs, long previousFrame, long retryId) { owner.enqueue(tape.frame(frames, epoch), -1, -1); }
        @Override void invoke(String expression) {}
        @Override void resumeVm() {}
        @Override void pauseVm() {}
        @Override boolean requestClose() {
            String receipt = "{\"replayedFrames\":" + frames + ",\"releasedReplayTape\":true}";
            owner.ui.post(() -> owner.finishClose(receipt, null));
            return true;
        }
        @Override void destroy() { pages.close(); }
    }
}
