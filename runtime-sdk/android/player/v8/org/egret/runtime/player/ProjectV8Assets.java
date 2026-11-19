// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.content.Context;
import com.caoccao.javet.interop.options.V8RuntimeOptions;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

final class ProjectV8Assets {
    private static final String ROOT = "egret-player-v8/";

    static String read(Context context, String name, int limit) throws IOException {
        try (InputStream stream = context.getAssets().open(ROOT + name)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] block = new byte[8192];
            for (int n; (n = stream.read(block)) != -1;) {
                if (output.size() + n > limit) throw new IOException("Embedded host asset too large: " + name);
                output.write(block, 0, n);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    // ICU must be named in V8 flags before the first internationalized isolate starts.
    static synchronized void installIcu(Context context) throws Exception {
        String expected = read(context, "icu-sha256.txt", 128).trim();
        if (!expected.matches("[0-9a-f]{64}")) throw new IOException("Invalid packaged ICU digest");
        File dir = context.getDir("egret-player-v8", Context.MODE_PRIVATE);
        File data = new File(dir, "icu-" + expected + ".dat");
        if (!data.isFile()) {
            File temp = File.createTempFile("icu-", ".tmp", dir);
            try {
                MessageDigest sha = MessageDigest.getInstance("SHA-256");
                try (InputStream input = context.getAssets().open(ROOT + "icudtl.dat");
                     FileOutputStream output = new FileOutputStream(temp)) {
                    byte[] block = new byte[65536];
                    for (int n; (n = input.read(block)) != -1;) {
                        sha.update(block, 0, n);
                        output.write(block, 0, n);
                    }
                }
                StringBuilder hex = new StringBuilder(64);
                for (byte b : sha.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 255));
                if (!expected.contentEquals(hex) || !temp.renameTo(data))
                    throw new IOException("Cannot verify and install packaged ICU data");
            } finally { if (temp.exists() && !temp.delete()) temp.deleteOnExit(); }
        }
        String path = data.getAbsolutePath();
        if (!V8RuntimeOptions.V8_FLAGS.isSealed()) V8RuntimeOptions.V8_FLAGS.setIcuDataFile(path);
        if (!path.equals(V8RuntimeOptions.V8_FLAGS.getIcuDataFile()))
            throw new IOException("V8 is already using different ICU data");
    }

    private ProjectV8Assets() {}
}
