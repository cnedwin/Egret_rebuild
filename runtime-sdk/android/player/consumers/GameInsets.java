// SPDX-License-Identifier: Apache-2.0
package org.egret.example;

import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;

/** The app owns its system bars. Android 15 enforces edge-to-edge for this target. */
final class GameInsets {
    private GameInsets() {}
    static void apply(View content) {
        if (Build.VERSION.SDK_INT < 35) return;
        content.setOnApplyWindowInsetsListener((v, window) -> {
            Insets safe = window.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return window;
        });
    }
}
