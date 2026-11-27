// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.app.Activity;
import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

/** One foreground overlay may claim the next system Back. A bare game leaves Android in charge. */
final class ProjectBack {
    private final Activity activity;
    private ProjectHostServices.Reply pending;
    private Runnable unregister;
    private boolean foreground;

    ProjectBack(Activity activity) { this.activity = activity; }

    Runnable waitForBack(ProjectHostServices.Reply next) {
        ProjectHostServices.Reply replaced = pending;
        disarm();
        pending = next;
        if (replaced != null) replaced.resolve("false");
        update();
        // A canceled old overlay must never unregister its replacement.
        return () -> {
            if (pending == next) clear();
        };
    }

    void setForeground(boolean value) {
        foreground = value;
        if (foreground) update(); else disarm();
    }

    boolean consume() {
        if (!foreground || pending == null) return false;
        ProjectHostServices.Reply reply = pending;
        clear();
        reply.resolve("true");
        return true;
    }

    void clear() {
        disarm();
        pending = null;
    }

    private void update() {
        if (!foreground || pending == null || unregister != null || Build.VERSION.SDK_INT < 33) return;
        ProjectHostServices.Reply expected = pending;
        unregister = Api33.register(activity, () -> {
            if (pending == expected) consume();
        });
    }

    private void disarm() {
        if (unregister == null) return;
        unregister.run();
        unregister = null;
    }

    private static final class Api33 {
        static Runnable register(Activity activity, Runnable action) {
            OnBackInvokedDispatcher dispatcher = activity.getOnBackInvokedDispatcher();
            OnBackInvokedCallback callback = action::run;
            dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
            return () -> dispatcher.unregisterOnBackInvokedCallback(callback);
        }
    }
}
