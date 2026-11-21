// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.HandlerThread;
import com.caoccao.javet.annotations.V8Function;
import com.caoccao.javet.enums.JSRuntimeType;
import com.caoccao.javet.interop.V8Host;
import com.caoccao.javet.interop.V8Runtime;
import com.caoccao.javet.values.V8Value;
import com.caoccao.javet.values.reference.V8ValueArrayBuffer;
import com.caoccao.javet.values.reference.V8ValueDataView;
import com.caoccao.javet.values.reference.V8ValueObject;
import com.caoccao.javet.values.reference.V8ValueTypedArray;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** One worker owns the isolate, its persistent handles and all timer callbacks. */
public final class JavetProjectScripts extends ScriptSession {
    private interface Job { void run() throws Exception; }
    private final HandlerThread thread = new HandlerThread("Egret project V8");
    private final Handler worker;
    private final Map<Integer, Runnable> timers = new HashMap<>();
    private final Services services = new Services();
    private final Object interruptLock = new Object();
    private V8Runtime runtime;
    private V8ValueObject servicesObject, tasks, game;
    private boolean retired;
    private volatile boolean deadlineExpired;

    JavetProjectScripts(EgretPlayerView owner, Activity activity, ProjectAssets project, String profile) {
        super(owner, project);
        Context context = activity.getApplicationContext();
        thread.start();
        worker = new Handler(thread.getLooper());
        worker.post(() -> run(() -> open(context, profile)));
    }

    private void open(Context context, String profile) throws Exception {
        if (owner.ending) return;
        boolean full = "standard".equals(profile);
        if (!full && !"trimmed".equals(profile)) throw new IOException("Unknown embedded V8 profile");
        if (full) ProjectV8Assets.installIcu(context);
        JSRuntimeType type = full ? JSRuntimeType.V8I18n : JSRuntimeType.V8;
        synchronized (interruptLock) {
            if (deadlineExpired) return;
        }
        V8Runtime opened = V8Host.getInstance(type).createV8Runtime();
        synchronized (interruptLock) { runtime = opened; }
        if (owner.ending) return;
        // Leave ICU tables cold until a game actually needs locale formatting.
        boolean intl = runtime.getExecutor("typeof Intl !== 'undefined'").executeBoolean();
        if (intl != full)
            throw new IOException("Unexpected Intl capability for " + profile);
        String version = runtime.getVersion();
        owner.ui.post(() -> owner.vmDetails(version, intl));
        servicesObject = runtime.createV8ValueObject();
        servicesObject.bind(services);
        runtime.getGlobalObject().set("EgretNativePlayer", servicesObject);
        runtime.getExecutor(ProjectV8Assets.read(context, "bootstrap.js", 65536))
            .setResourceName("egret-project-bootstrap.js").executeVoid();
        tasks = runtime.getGlobalObject().get("EgretRuntimeTasks");
        String source = new String(project.read("game.js", 16 << 20), StandardCharsets.UTF_8);
        runtime.getExecutor(source).setResourceName("game.js").executeVoid();
        runtime.getExecutor("for (const k of ['start','frame','input','pause','resume','close']) "
            + "if (typeof globalThis.EgretPlayerProject?.[k] !== 'function') throw Error('Missing project method '+k)")
            .executeVoid();
        game = runtime.getGlobalObject().get("EgretPlayerProject");
        if (!owner.ending) runtime.getExecutor("Promise.resolve().then(()=>EgretPlayerProject.start())"
            + ".then(()=>EgretNativePlayer.started(),e=>EgretNativePlayer.failure(String(e)))").executeVoid();
    }

    // Promise continuations run on this worker. Timers re-enter through its
    // ordinary queue, so a pending asynchronous factory can receive close().
    private void run(Job job) {
        if (retired || deadlineExpired) return;
        try {
            job.run();
            if (runtime != null) runtime.await();
        } catch (Exception | LinkageError e) {
            if (owner.ending) finish(null, e.toString());
            else owner.reportFailure(e.toString());
        }
    }

    @Override void invoke(String expression) {
        worker.post(() -> run(() -> { if (game != null && !owner.ending) runtime.getExecutor(expression).executeVoid(); }));
    }

    @Override void frame(int epoch, double elapsedMs, long previousFrame, long retryId) {
        worker.post(() -> run(() -> {
            if (owner.ending || owner.epoch != epoch || game == null) return;
            boolean timed = owner.timing.isEnabled();
            long start = timed ? System.nanoTime() : 0;
            try (V8Value frame = retryId < 0 ? game.invoke("frame", elapsedMs, epoch, (double) previousFrame)
                    : game.invoke("recoverWorldFrame", epoch, (double) retryId)) {
                long produced = timed ? System.nanoTime() : 0;
                byte[] bytes = copyFrame(frame);
                long copied = timed ? System.nanoTime() : 0;
                commands(epoch, bytes, timed ? produced - start : -1, timed ? copied - produced : -1);
            }
        }));
    }

    private static byte[] copyFrame(V8Value frame) throws Exception {
        if (frame instanceof V8ValueTypedArray) {
            V8ValueTypedArray view = (V8ValueTypedArray) frame;
            try (V8ValueArrayBuffer buffer = view.getBuffer()) {
                return copyRange(buffer, view.getByteOffset(), view.getByteLength());
            }
        }
        if (frame instanceof V8ValueDataView) {
            V8ValueDataView view = (V8ValueDataView) frame;
            try (V8ValueArrayBuffer buffer = view.getBuffer()) {
                return copyRange(buffer, view.getByteOffset(), view.getByteLength());
            }
        }
        if (frame instanceof V8ValueArrayBuffer) {
            V8ValueArrayBuffer buffer = (V8ValueArrayBuffer) frame;
            return copyRange(buffer, 0, buffer.getByteBuffer().capacity());
        }
        throw new IOException("frame() must return a binary command buffer");
    }

    private static byte[] copyRange(V8ValueArrayBuffer buffer, int offset, int length) throws IOException {
        ByteBuffer source = buffer.getByteBuffer().duplicate().order(java.nio.ByteOrder.LITTLE_ENDIAN);
        source.clear();
        if (length < 24 || length > WorldProjectPacket.TEXTURED_LIMIT || offset < 0 || offset > source.capacity() - length
                || length > WorldProjectPacket.byteLimit(source.getInt(offset)))
            throw new IOException("Invalid frame buffer range");
        // The GL queue outlives this VM handle; only the visible slice belongs to the frame.
        byte[] result = new byte[length];
        source.position(offset);
        source.get(result);
        return result;
    }

    // EgretPlayerView owns foreground time, frame scheduling and the game's pause/resume calls.
    @Override void pauseVm() {}
    @Override void resumeVm() {}

    @Override boolean requestClose() {
        worker.post(() -> run(() -> {
            if (game == null) { finish(null, null); return; }
            runtime.getExecutor("Promise.resolve().then(()=>EgretPlayerProject.close())"
                + ".then(r=>EgretNativePlayer.finished(JSON.stringify(r??null)))"
                + ".catch(e=>EgretNativePlayer.closeFailure(String(e)))").executeVoid();
        }));
        return true;
    }

    @Override void timeoutClose() {
        // This is V8's thread-safe termination entry; all reference disposal stays on the worker.
        deadlineExpired = true;
        synchronized (interruptLock) { if (runtime != null) runtime.terminateExecution(); }
        worker.postAtFrontOfQueue(() -> finish(null, "Project close did not complete within 10 seconds"));
    }

    private void finish(String receipt, String cause) {
        if (retired) return;
        retired = true;
        worker.removeCallbacksAndMessages(null);
        timers.clear();
        String error = deadlineExpired ? "Project close did not complete within 10 seconds" : cause;
        // The close callback was posted out of the JS stack before its handles are destroyed.
        try {
            try {
                if (game != null) game.close();
            } finally {
                try {
                    if (tasks != null) tasks.close();
                } finally {
                    if (servicesObject != null) {
                        try { servicesObject.unbind(services); } finally { servicesObject.close(); }
                    }
                }
            }
        } catch (Exception | LinkageError e) { error = withFailure(error, e); }
        V8Runtime toClose;
        synchronized (interruptLock) { toClose = runtime; runtime = null; }
        try { if (toClose != null) toClose.close(); }
        catch (Exception | LinkageError e) { error = withFailure(error, e); }
        assetReads.close();
        pages.close();
        String finalError = error;
        thread.quitSafely();
        owner.ui.post(() -> owner.finishClose(receipt, finalError));
    }

    private static String withFailure(String cause, Throwable failure) {
        return cause == null ? failure.toString() : cause + "; " + failure;
    }

    @Override void destroy() {
        // finishClose() reaches here only after the worker has released the isolate.
    }

    public final class Services {
        @V8Function public double now() { return System.nanoTime() / 1_000_000.0; }
        @V8Function public void schedule(int id, int delay) {
            Runnable timer = () -> run(() -> {
                timers.remove(id);
                if (tasks != null) tasks.invokeVoid("fire", id);
            });
            timers.put(id, timer);
            worker.postDelayed(timer, Math.max(0, delay));
        }
        @V8Function public void cancel(int id) {
            Runnable timer = timers.remove(id);
            if (timer != null) worker.removeCallbacks(timer);
        }
        @V8Function public void page(int id, int width, int height, String rgba) { pages.publish(id, width, height, rgba); }
        @V8Function public void releasePage(int id) { pages.release(id); }
        @V8Function public String saveRead(String key) { return readSave(key); }
        @V8Function public boolean saveWrite(String key, String value) { return writeSave(key, value); }
        @V8Function public boolean saveRemove(String key) { return removeSave(key); }
        @V8Function public String raster(String json) { return raster.request(json); }
        @V8Function public boolean readText(int id, String path) { return assetReads.start(id, path, ProjectAssetReads.Format.UTF8); }
        @V8Function public boolean readBytes(int id, String path) { return assetReads.start(id, path, ProjectAssetReads.Format.BYTES); }
        @V8Function public boolean openChunks(int id, String path) { return assetReads.start(id, path, ProjectAssetReads.Format.CHUNKS); }
        @V8Function public boolean nextChunk(int id) { return assetReads.nextChunk(id); }
        @V8Function public void cancelReadText(int id) { assetReads.cancel(id); }
        @V8Function public String takeTextResult(int id) { return assetReads.take(id); }
        @V8Function public void edit(String initial) { requestEdit(initial); }
        @V8Function public void playSound(String path) { requestSound(path); }
        @V8Function public void state(String json) { owner.ui.post(() -> owner.projectState(json)); }
        @V8Function public void started() { owner.ui.post(owner::started); }
        @V8Function public void failure(String message) { owner.reportFailure(message); }
        @V8Function public void finished(String receipt) { worker.post(() -> { if (owner.ending) finish(receipt, null); }); }
        @V8Function public void closeFailure(String reason) { worker.post(() -> { if (owner.ending) finish(null, reason); }); }
    }
}
