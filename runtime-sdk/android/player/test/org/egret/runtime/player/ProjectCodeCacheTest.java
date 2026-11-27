// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.stream.Stream;

public final class ProjectCodeCacheTest {
    private static void check(boolean condition) {
        if (!condition) throw new AssertionError("Compiled-script cache invariant failed");
    }

    public static void main(String[] args) throws Exception {
        Path work = Files.createTempDirectory("egret-script-cache-test");
        try {
            byte[] source = new byte[8192];
            ProjectCodeCache cache = new ProjectCodeCache(work.toFile(), "trimmed-v8-a-arm64");
            String key = cache.key("base.js", source);
            String other = cache.key("group.js", source);
            check(!key.equals(other));
            check(!key.equals(new ProjectCodeCache(work.toFile(), "standard-v8-a-arm64").key("base.js", source)));
            source[17] = 4;
            check(!key.equals(cache.key("base.js", source)));
            check(cache.key("tiny", new byte[16]) == null);
            check(cache.read(key) == null);
            byte[] original = {1, 2, 3, 4};
            check(cache.write(key, original));
            check(Arrays.equals(original, cache.read(key)));
            check(!cache.write(key, new byte[(1 << 20) + 1]));
            Path directory = work.resolve("egret-v8-compiled-v1");
            Files.copy(directory.resolve(key + ".bin"), directory.resolve(other + ".bin"));
            check(cache.read(other) == null);
            Files.write(directory.resolve(key + ".bin"), new byte[33]);
            check(cache.read(key) == null);
            for (int i = 0; i < 100; i++) {
                // A new session can admit new files independently of the previous isolate.
                String id = new ProjectCodeCache(work.toFile(), "trimmed").key("group" + i, source);
                check(cache.write(id, new byte[1024]));
            }
            check(directory.toFile().listFiles((d, name) -> name.endsWith(".bin")).length <= 96);
            for (int i = 0; i < 12; i++)
                check(cache.write(cache.key("big" + i, source), new byte[1 << 20]));
            File[] files = directory.toFile().listFiles();
            check(Arrays.stream(files).mapToLong(File::length).sum() <= (8 << 20));
            for (int i = 0; i < 64; i++) cache.key("next" + i, source);
            check(cache.key("last", source) == null);
        } finally {
            try (Stream<Path> owned = Files.walk(work)) {
                for (Path path : owned.sorted(Comparator.reverseOrder()).toArray(Path[]::new)) Files.delete(path);
            }
        }
    }
}
