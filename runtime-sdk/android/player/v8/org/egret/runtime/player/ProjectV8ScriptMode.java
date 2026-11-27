// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import com.caoccao.javet.interop.options.V8Flags;
import java.io.IOException;

/** Javet fixes compiler flags for a process. Hold this lock until the isolate is created. */
final class ProjectV8ScriptMode {
    interface Open<T> { T run() throws Exception; }
    private Boolean strict;

    synchronized <T> T open(boolean requestStrict, V8Flags flags, Open<T> create) throws Exception {
        if ((strict != null && strict.booleanValue() != requestStrict)
                || (flags.isSealed() && flags.isUseStrict() != requestStrict)) {
            throw new IOException("This process already uses another V8 script mode. Open this project in a separate process.");
        }
        if (!flags.isSealed()) flags.setUseStrict(requestStrict);
        if (flags.isUseStrict() != requestStrict) throw new IOException("V8 script mode could not be selected");
        // Entering Javet may initialize its platform even if isolate creation subsequently fails.
        strict = requestStrict;
        return create.run();
    }
}
