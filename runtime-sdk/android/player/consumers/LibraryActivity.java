// SPDX-License-Identifier: Apache-2.0
package org.egret.example;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.FileDescriptor;
import java.io.PrintWriter;
import org.egret.runtime.player.EgretPlayerView;

/** A native app keeps its own controls while it opens and closes the game in a child view. */
public final class LibraryActivity extends Activity {
    private FrameLayout slot;
    private Button toggle;
    private TextView status;
    private EgretPlayerView player;
    private boolean foreground;
    private String lastClose = "{}";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        status = new TextView(this);
        toggle = new Button(this);
        slot = new FrameLayout(this);
        layout.addView(status);
        layout.addView(toggle);
        layout.addView(slot, new LinearLayout.LayoutParams(-1, 0, 1));
        toggle.setOnClickListener(view -> { if (player == null) open(); else closePlayer(); });
        GameInsets.apply(layout);
        setContentView(layout);
        open();
    }

    private void open() {
        status.setText("Game library · Loading");
        toggle.setText("Close game");
        toggle.setEnabled(true);
        player = new EgretPlayerView(this, "game", new EgretPlayerView.Listener() {
            @Override public void onReady() { status.setText("Game library · Playing"); }
            @Override public void onError(String message) { status.setText("Game library · " + message); }
            @Override public void onClosed() {
                lastClose = player.getDiagnostics().toString();
                slot.removeView(player);
                player = null;
                status.setText("Game library");
                toggle.setText("Open game");
                toggle.setEnabled(true);
            }
        });
        slot.addView(player);
        if (foreground) player.onResume();
    }

    private void closePlayer() {
        toggle.setEnabled(false);
        player.close();
    }

    @Override protected void onResume() {
        super.onResume();
        foreground = true;
        if (player != null) player.onResume();
    }

    @Override protected void onPause() {
        foreground = false;
        if (player != null) player.onPause();
        super.onPause();
    }

    @Override protected void onDestroy() {
        if (player != null) closePlayer();
        super.onDestroy();
    }

    @Override public void dump(String prefix, FileDescriptor fd, PrintWriter writer, String[] args) {
        super.dump(prefix, fd, writer, args);
        writer.println(prefix + "Egret player: " + (player == null ? lastClose : player.getDiagnostics()));
    }
}
