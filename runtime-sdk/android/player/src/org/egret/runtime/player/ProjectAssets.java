// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONObject;

final class ProjectAssets {
    static final String ORIGIN = "https://egret-player.invalid/";
    private final AssetManager assets;
    private final String root;
    final int width, height;
    final String entry;

    ProjectAssets(AssetManager assets, String root) throws Exception {
        this.assets = assets;
        this.root = relative(root);
        JSONObject manifest = new JSONObject(new String(read("project.json", 65536), StandardCharsets.UTF_8));
        width = manifest.getInt("width");
        height = manifest.getInt("height");
        if (width < 1 || width > 16384 || height < 1 || height > 16384)
            throw new IOException("Invalid project stage dimensions");
        entry = ORIGIN + relative(manifest.getString("entry"));
    }

    private static String relative(String name) {
        if (name == null || name.isEmpty() || name.length() > 1024) throw new IllegalArgumentException("Invalid asset path");
        for (String part : name.split("/", -1))
            if (!part.matches("[A-Za-z0-9_~.-]+") || part.equals(".") || part.equals(".."))
                throw new IllegalArgumentException("Invalid asset path");
        return name;
    }

    byte[] read(String name, int limit) throws IOException {
        try (InputStream input = assets.open(root + "/" + relative(name))) {
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
            InputStream stream = assets.open(root + "/" + path);
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
