// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

final class ProjectAssets {
    static final String ORIGIN = "https://egret-player.invalid/";
    private final AssetManager assets;
    final String root;
    private final DebugProjectRevision revision;
    private final Set<String> declaredAssets = new HashSet<>();
    final int width, height;
    final String entry;
    final Object v8Scripts;
    final boolean codeCache;
    final boolean requiresWasm;

    ProjectAssets(Context context, String root) throws Exception {
        this.assets = context.getAssets();
        this.root = relative(root);
        this.revision = DebugProjectRevision.active(context, this.root);
        JSONObject manifest = new JSONObject(new String(read("project.json", 65536), StandardCharsets.UTF_8));
        Set<String> required = new HashSet<>();
        if (manifest.has("requiredV8Features")) {
            JSONArray features = manifest.getJSONArray("requiredV8Features");
            for (int i = 0; i < features.length(); i++) {
                Object feature = features.get(i);
                if (!("Intl".equals(feature) || "WebAssembly".equals(feature)) || !required.add((String) feature))
                    throw new IOException("Invalid requiredV8Features");
            }
        }
        if ((!required.isEmpty() && "webview".equals(BundledScripts.PROFILE))
                || (required.contains("Intl") && !"standard".equals(BundledScripts.PROFILE)))
            throw new IOException("The selected host cannot provide the game's declared V8 features");
        requiresWasm = required.contains("WebAssembly");
        v8Scripts = manifest.opt("v8Scripts");
        Object cache = manifest.opt("v8CodeCache");
        if (manifest.has("v8CodeCache") && !(cache instanceof Boolean)) throw new IOException("Expected v8CodeCache boolean");
        codeCache = Boolean.TRUE.equals(cache);
        width = manifest.getInt("width");
        height = manifest.getInt("height");
        if (width < 1 || width > 16384 || height < 1 || height > 16384)
            throw new IOException("Invalid project stage dimensions");
        entry = ORIGIN + relative(manifest.getString("entry"));
        // Older project packages may omit the list. Validate the requested path
        // at open time so this optional service cannot prevent their startup.
        JSONArray files = manifest.optJSONArray("assets");
        if (files != null) {
            for (int i = 0; i < files.length(); i++) {
                Object name = files.opt(i);
                if (name instanceof String) declaredAssets.add((String)name);
            }
        }
    }

    static String relative(String name) {
        if (name == null || name.isEmpty() || name.length() > 1024) throw new IllegalArgumentException("Invalid asset path");
        for (String part : name.split("/", -1))
            if (!part.matches("[A-Za-z0-9_~.-]+") || part.equals(".") || part.equals(".."))
                throw new IllegalArgumentException("Invalid asset path");
        return name;
    }

    InputStream openDeclared(String name) throws IOException {
        String path = relative(name);
        if (!declaredAssets.contains(path)) throw new FileNotFoundException("Undeclared project asset");
        return openPackaged(path);
    }

    android.content.res.AssetFileDescriptor openSoundtrack(String name) throws IOException {
        String path = relative(name);
        if (!declaredAssets.contains(path)) throw new FileNotFoundException("Undeclared soundtrack");
        return revision == null ? assets.openFd(root + "/" + path) : revision.openFd(path);
    }

    InputStream openPackaged(String name) throws IOException {
        String path = relative(name);
        return revision == null ? assets.open(root + "/" + path) : revision.open(path);
    }

    byte[] read(String name, int limit) throws IOException {
        try (InputStream input = openPackaged(name)) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] block = new byte[8192];
            for (int n; (n = input.read(block)) != -1;) {
                if (bytes.size() + n > limit) throw new IOException("Asset exceeds size limit: " + name);
                bytes.write(block, 0, n);
            }
            return bytes.toByteArray();
        }
    }

    WebResourceResponse response(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !"egret-player.invalid".equals(uri.getEncodedAuthority()))
            return denied();
        try {
            String path = relative(uri.getPath().substring(1));
            InputStream stream = openPackaged(path);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'none'; "
                + "object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'");
            return new WebResourceResponse(mime(path), null, 200, "OK", headers, stream);
        } catch (IOException | RuntimeException ignored) { return denied(); }
    }

    private static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String path) {
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "json": return "application/json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "wav": return "audio/wav";
            case "css": return "text/css";
            case "woff2": return "font/woff2";
            case "ttf": return "font/ttf";
            default: return "application/octet-stream";
        }
    }
}
