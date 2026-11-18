// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import android.content.Context;
import android.os.SystemClock;
import com.caoccao.javet.annotations.V8Function;
import com.caoccao.javet.enums.JSRuntimeType;
import com.caoccao.javet.interop.V8Host;
import com.caoccao.javet.interop.V8Runtime;
import com.caoccao.javet.interop.options.V8RuntimeOptions;
import com.caoccao.javet.values.V8Value;
import com.caoccao.javet.values.reference.V8ValueArrayBuffer;
import com.caoccao.javet.values.reference.V8ValueObject;
import com.caoccao.javet.values.reference.V8ValuePromise;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import org.json.JSONObject;

/** A single isolate and all its handles stay on the owning Android worker. */
public final class JavetScene implements EmbeddedScene {
    public static final class Clock {
        @V8Function public double now() { return System.nanoTime() / 1_000_000.0; }
    }

    private V8Runtime runtime;
    private V8ValueObject fixture;
    private V8ValueObject clockObject;
    private final Clock clock = new Clock();
    private boolean scopeReleased;

    @Override public JSONObject open(Context context, String profile, ByteBuffer atlas) throws Exception {
        boolean standard = "standard".equals(profile);
        if (!standard && !"trimmed".equals(profile)) throw new IOException("Unknown embedded VM profile");
        JSONObject info = new JSONObject();
        JSRuntimeType type = standard ? JSRuntimeType.V8I18n : JSRuntimeType.V8;
        if (standard) configureIcu(context, info);
        V8Host host = V8Host.getInstance(type);
        runtime = host.createV8Runtime();
        String intlResult = runtime.getExecutor("typeof Intl === 'undefined' ? '' : "
            + "Intl.NumberFormat.supportedLocalesOf(['zh-CN']).join(',') + ':' + "
            + "new Intl.NumberFormat('zh-CN').format(1234567.5)").executeString();
        if (standard ? !"zh-CN:1,234,567.5".equals(intlResult) : !"".equals(intlResult)) {
            throw new IOException("Unexpected Intl capability for " + profile + ": " + intlResult);
        }
        info.put("version", runtime.getVersion()).put("upstreamVersion", type.getVersion())
            .put("bindingVersion", host.getJavetVersion()).put("intl", standard).put("intlProbe", intlResult);
        clockObject = runtime.createV8ValueObject();
        clockObject.bind(clock);
        runtime.getGlobalObject().set("EgretRuntimeClock", clockObject);
        String source = new String(Fixture.readAsset(context.getAssets(), "scene/host.js", 16 * 1024 * 1024),
            StandardCharsets.UTF_8);
        runtime.getExecutor(source).setResourceName("egret-fixture.js").executeVoid();
        fixture = runtime.getGlobalObject().get("EgretRuntimeFixture");
        try (V8ValuePromise ready = fixture.get("ready")) { settle(ready); }
        try (V8ValueArrayBuffer sourceAtlas = fixture.invoke("textureBuffer")) { copy(sourceAtlas, atlas); }
        return info;
    }

    private static synchronized void configureIcu(Context context, JSONObject info) throws Exception {
        String expected = new String(Fixture.readAsset(context.getAssets(), "icu-sha256.txt", 128),
            StandardCharsets.US_ASCII).trim();
        if (!expected.matches("[0-9a-f]{64}")) throw new IOException("Invalid ICU digest");
        // Existing installs reuse the previously verified, immutable data in private storage.
        File directory = context.getDir("egret-v8", Context.MODE_PRIVATE);
        File data = new File(directory, "icu-" + expected + ".dat");
        boolean unpacked = !data.isFile();
        if (unpacked) {
            File temporary = File.createTempFile("icu-", ".tmp", directory);
            try {
                MessageDigest sha = MessageDigest.getInstance("SHA-256");
                try (InputStream source = context.getAssets().open("icudtl.dat");
                     FileOutputStream destination = new FileOutputStream(temporary)) {
                    byte[] block = new byte[65536];
                    for (int n; (n = source.read(block)) != -1;) {
                        sha.update(block, 0, n);
                        destination.write(block, 0, n);
                    }
                }
                StringBuilder hex = new StringBuilder(64);
                for (byte b : sha.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 255));
                if (!expected.contentEquals(hex) || !temporary.renameTo(data))
                    throw new IOException("Cannot verify and publish ICU data");
            } finally { if (temporary.exists() && !temporary.delete()) temporary.deleteOnExit(); }
        }
        String path = data.getAbsolutePath();
        if (!V8RuntimeOptions.V8_FLAGS.isSealed()) V8RuntimeOptions.V8_FLAGS.setIcuDataFile(path);
        if (!path.equals(V8RuntimeOptions.V8_FLAGS.getIcuDataFile()))
            throw new IllegalStateException("V8 was initialized with a different ICU path");
        info.put("icuUnpacked", unpacked).put("icuBytes", data.length()).put("icuSha256", expected);
    }

    private void settle(V8ValuePromise promise) throws Exception {
        // This scene has no external I/O. Service the engine's real close deadline
        // along with promise jobs; a stalled fixture still has a bounded lifetime.
        long deadline = SystemClock.uptimeMillis() + 3000;
        while (true) {
            runtime.await();
            if (promise.isFulfilled()) return;
            if (promise.isRejected()) {
                try (V8Value error = promise.getResult()) { throw new IOException("Egret scene rejected: " + error); }
            }
            if (SystemClock.uptimeMillis() >= deadline) throw new IOException("Egret scene promise did not settle");
            fixture.invokeVoid("pollTimers");
            Thread.sleep(1);
        }
    }

    private static void copy(V8ValueArrayBuffer source, ByteBuffer destination) throws IOException {
        ByteBuffer bytes = source.getByteBuffer().duplicate();
        if (bytes.remaining() != destination.capacity()) throw new IOException("Unexpected scene buffer size");
        destination.clear();
        destination.put(bytes);
        destination.flip();
    }

    @Override public void capture(Frame frame, ByteBuffer destination) throws Exception {
        try (V8ValueArrayBuffer commands = fixture.invoke("frameBuffer", frame.index)) {
            frame.transferStartNs = System.nanoTime();
            // The V8 backing store is borrowed. Copy it before closing the V8 handle;
            // Rust consumes the stable Android buffer asynchronously on the GL thread.
            copy(commands, destination);
            frame.transferEndNs = System.nanoTime();
            frame.generationNs = fixture.getInteger("generationNs");
            frame.jsWorkNs = frame.generationNs;
        }
    }

    @Override public int releaseScope() throws Exception {
        if (fixture == null || scopeReleased) return 0;
        try (V8ValuePromise closing = fixture.invoke("close")) {
            settle(closing);
            try (V8ValueObject result = closing.getResult()) {
                int released = result.getInteger("releases");
                scopeReleased = true;
                return released;
            }
        }
    }

    @Override public void close() throws Exception {
        try {
            if (fixture != null) fixture.close();
        } finally {
            try {
                if (clockObject != null) {
                    try { clockObject.unbind(clock); } finally { clockObject.close(); }
                }
            } finally { if (runtime != null) runtime.close(); }
        }
    }
}
