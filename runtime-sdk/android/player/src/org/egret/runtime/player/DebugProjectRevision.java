// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.res.AssetFileDescriptor;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** A debuggable application's immutable game snapshot. Release applications use packaged assets. */
final class DebugProjectRevision {
    private final Map<String, File> files = new HashMap<>();

    static DebugProjectRevision active(Context context, String root) throws Exception {
        if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) return null;
        // Android may expose an app's private data directory through a per-user alias.
        File owner = new File(context.getFilesDir().getCanonicalFile(), "egret-dev/" + root);
        if (!owner.isDirectory() && !owner.mkdirs()) throw new IOException("Cannot create development revision directory");
        File marker = new File(owner,"format-1");
        if (!marker.exists() && !marker.createNewFile() && !marker.isFile()) throw new IOException("Cannot mark development host");
        File current = new File(owner, "active");
        if (!current.exists()) return null;
        String id = new String(bounded(current, 65), StandardCharsets.US_ASCII).trim();
        return new DebugProjectRevision(owner, id);
    }

    private static byte[] bounded(File file, long limit) throws IOException {
        final boolean regular = file.isFile();
        final boolean canonical = file.getCanonicalFile().equals(file.getAbsoluteFile());
        if (!regular || file.length() > limit || !canonical)
            throw new IOException("Invalid development revision file " + file.getName() + " (regular="
                + regular + ", bytes=" + file.length() + ", limit=" + limit + ", canonical=" + canonical + ")");
        return Files.readAllBytes(file.toPath());
    }

    private DebugProjectRevision(File owner, String id) throws Exception {
        if (!id.matches("[0-9a-f]{64}")) throw new IOException("Invalid development revision ID");
        byte[] manifest = bounded(new File(owner, "manifests/" + id), 4L << 20);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(manifest);
        for (int i = 0; i < digest.length; i++) {
            int expected = Integer.parseInt(id.substring(i*2, i*2+2), 16);
            if ((digest[i] & 255) != expected) throw new IOException("Development revision identity mismatch");
        }
        JSONArray entries = new JSONArray(new String(manifest, StandardCharsets.UTF_8));
        for (int i = 0; i < entries.length(); i++) {
            JSONObject row = entries.getJSONObject(i);
            String name = ProjectAssets.relative(row.getString("name"));
            String sha = row.getString("sha256");
            if (!sha.matches("[0-9a-f]{64}")) throw new IOException("Invalid development asset digest");
            File blob = new File(owner, "blobs/" + sha);
            if (!blob.isFile() || !blob.getCanonicalFile().equals(blob.getAbsoluteFile())
                    || blob.length() != row.getLong("size") || files.put(name, blob) != null)
                throw new IOException("Missing or inconsistent development asset: " + name);
        }
    }

    private File find(String name) throws IOException {
        File file = files.get(name);
        if (file == null) throw new IOException("Unknown development asset: " + name);
        return file;
    }

    InputStream open(String name) throws IOException { return new FileInputStream(find(name)); }

    AssetFileDescriptor openFd(String name) throws IOException {
        File file = find(name);
        return new AssetFileDescriptor(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY),
            0, file.length());
    }
}
