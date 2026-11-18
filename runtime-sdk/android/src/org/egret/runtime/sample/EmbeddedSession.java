// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import android.content.Context;
import android.os.Handler;
import android.os.HandlerThread;
import java.nio.ByteBuffer;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import org.json.JSONObject;

/** Serializes JS work separately from Android's UI and the GLES owner. */
final class EmbeddedSession {
    private final Handler ui, worker;
    private final HandlerThread owner = new HandlerThread("Egret.V8");
    private final Consumer<String> failure;
    private EmbeddedScene scene; // worker thread only
    private Throwable startupError;
    private boolean closing; // UI thread only

    EmbeddedSession(Handler ui, Consumer<String> failure) {
        this.ui = ui;
        this.failure = failure;
        owner.start();
        worker = new Handler(owner.getLooper());
    }

    void open(Context context, String profile, ByteBuffer atlas, Consumer<JSONObject> ready) {
        worker.post(() -> {
            try {
                scene = (EmbeddedScene) Class.forName("org.egret.runtime.sample.JavetScene")
                    .getDeclaredConstructor().newInstance();
                JSONObject details = scene.open(context, profile, atlas);
                ui.post(() -> ready.accept(details));
            } catch (Exception | LinkageError e) {
                startupError = e;
                report(e);
            }
        });
    }

    void capture(Frame frame, ByteBuffer bytes, Runnable ready) {
        if (closing) return;
        worker.post(() -> {
            try {
                scene.capture(frame, bytes);
                ui.post(() -> { if (!closing) ready.run(); });
            } catch (Exception | LinkageError e) { report(e); }
        });
    }

    void close(BiConsumer<Integer, Throwable> complete) {
        if (closing) return;
        closing = true;
        worker.post(() -> {
            int releases = 0;
            Throwable failure = startupError;
            try {
                if (scene != null) releases = scene.releaseScope();
            } catch (Exception | LinkageError e) {
                if (failure == null) failure = e;
                else failure.addSuppressed(e);
            }
            try {
                if (scene != null) scene.close();
            } catch (Exception | LinkageError e) {
                if (failure == null) failure = e;
                else failure.addSuppressed(e);
            } finally {
                scene = null;
                owner.quitSafely();
            }
            final int released = releases;
            final Throwable error = failure;
            ui.post(() -> complete.accept(released, error));
        });
    }

    private void report(Throwable error) { ui.post(() -> { if (!closing) failure.accept(error.toString()); }); }
}
