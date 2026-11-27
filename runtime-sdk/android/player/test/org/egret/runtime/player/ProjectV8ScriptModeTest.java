// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import com.caoccao.javet.interop.options.V8Flags;
import com.caoccao.javet.interop.options.V8RuntimeOptions;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

/** Run each mode in a fresh JVM with the exact Javet classes shipped inside the AAR. */
public final class ProjectV8ScriptModeTest {
    public static void main(String[] args) throws Exception {
        boolean strict = "strict".equals(args[0]);
        V8Flags flags = V8RuntimeOptions.V8_FLAGS;
        if (!flags.isUseStrict()) throw new AssertionError("Unexpected Javet default");
        ProjectV8ScriptMode modes = new ProjectV8ScriptMode();
        CountDownLatch inside = new CountDownLatch(1);
        CountDownLatch opponent = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread first = new Thread(() -> {
            try {
                modes.open(strict, flags, () -> {
                    inside.countDown();
                    opponent.await();
                    if (flags.isUseStrict() != strict) throw new AssertionError("First mode changed");
                    return null;
                });
            } catch (Throwable error) { failure.set(error); }
        });
        first.start();
        inside.await();
        opponent.countDown();
        try {
            modes.open(!strict, flags, () -> { throw new AssertionError("An incompatible project ran"); });
            throw new AssertionError("Mixed compiler modes accepted");
        } catch (IOException expected) { /* Javet cannot switch the platform's mode between projects. */ }
        first.join();
        if (failure.get() != null) throw new AssertionError(failure.get());
        if (!modes.open(strict, flags, () -> true)) throw new AssertionError("Matching projects must reopen");
        flags.seal();
        try {
            new ProjectV8ScriptMode().open(!strict, flags, () -> { throw new AssertionError("Sealed flags changed"); });
            throw new AssertionError("Pre-existing Javet mode ignored");
        } catch (IOException expected) { /* A separately initialized platform also fixes this process's mode. */ }
        System.out.println(args[0] + " compiler selection, concurrent rejection and same-mode reopen passed.");
    }
}
