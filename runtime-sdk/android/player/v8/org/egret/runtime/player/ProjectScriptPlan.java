// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BooleanSupplier;
import org.json.JSONArray;
import org.json.JSONObject;

/** The isolate owns one plan. A graphics-device reset has no effect on script state. */
final class ProjectScriptPlan {
    interface Open { InputStream open(String name) throws IOException; }
    interface Run { void execute(String name, String source, byte[] bytes) throws Exception; }

    private static final int FILE_LIMIT = 16 << 20;
    private static final int TOTAL_LIMIT = 64 << 20;
    private final List<String> startup = new ArrayList<>();
    private final Map<String, List<String>> groups = new HashMap<>();
    private final Set<String> paths = new HashSet<>(Collections.singleton("game.js"));
    private final boolean strict;
    private int readBytes;

    ProjectScriptPlan(Object declaration) throws Exception {
        strict = declaration != null;
        if (strict) {
            if (!(declaration instanceof JSONObject)) throw new IOException("Invalid v8Scripts manifest");
            JSONObject plan = (JSONObject)declaration;
            Iterator<String> keys = plan.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (!key.equals("startup") && !key.equals("groups")) throw new IOException("Unknown v8Scripts key: " + key);
            }
            if (plan.has("startup")) startup.addAll(paths(plan.getJSONArray("startup")));
            if (plan.has("groups")) {
                JSONObject definitions = plan.getJSONObject("groups");
                Iterator<String> names = definitions.keys();
                while (names.hasNext()) {
                    String name = names.next();
                    JSONArray files = definitions.getJSONArray(name);
                    if (!name.matches("[A-Za-z][A-Za-z0-9_-]{0,63}") || files.length() == 0)
                        throw new IOException("Invalid V8 script group: " + name);
                    groups.put(name, paths(files));
                }
            }
        }
        startup.add("game.js");
    }

    private List<String> paths(JSONArray files) throws Exception {
        List<String> result = new ArrayList<>();
        for (int i = 0; i < files.length(); i++) {
            Object value = files.get(i);
            if (!(value instanceof String)) throw new IOException("Invalid V8 script path");
            String name = (String)value;
            if (name.length() > 1024 || !name.endsWith(".js")) throw new IOException("Invalid V8 script: " + name);
            for (String part : name.split("/", -1)) {
                if (!part.matches("[A-Za-z0-9_][A-Za-z0-9._-]*") || part.endsWith(".")
                        || part.matches("(?i)(?:con|prn|aux|nul|(?:com|lpt)[1-9])(?:\\..*)?"))
                    throw new IOException("Invalid V8 script: " + name);
            }
            if (!paths.add(name.toLowerCase(Locale.ROOT)) || paths.size() > 4096)
                throw new IOException("Duplicate V8 script or more than 4096 files: " + name);
            result.add(name);
        }
        return result;
    }

    List<String> group(String name) { return groups.get(name); }
    List<String> startup() { return startup; }

    // A single script is materialized at a time. A close racing with an APK
    // read stops before the next compile; all handles belong to the V8 worker.
    void execute(List<String> files, Open source, Run run, BooleanSupplier closing) throws Exception {
        byte[] block = new byte[8192];
        for (String name : files) {
            if (closing.getAsBoolean()) return;
            try {
                byte[] bytes;
                try (InputStream in = source.open(name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    int limit = Math.min(FILE_LIMIT, TOTAL_LIMIT - readBytes);
                    for (int count; (count = in.read(block)) != -1;) {
                        if (closing.getAsBoolean()) return;
                        if (count > limit - output.size()) throw new IOException("Script byte budget exceeded");
                        output.write(block, 0, count);
                    }
                    bytes = output.toByteArray();
                }
                readBytes += bytes.length;
                if (closing.getAsBoolean()) return;
                String text = strict ? StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString()
                    : new String(bytes, StandardCharsets.UTF_8);
                if (closing.getAsBoolean()) return;
                run.execute(name, text, bytes);
            } catch (Exception failure) {
                throw new IOException("Cannot run project script " + name + ": " + failure.getMessage(), failure);
            }
        }
    }
}
