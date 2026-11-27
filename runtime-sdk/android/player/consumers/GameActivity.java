// SPDX-License-Identifier: Apache-2.0
package org.egret.example;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Toast;
import java.io.FileDescriptor;
import java.io.PrintWriter;
import org.egret.runtime.player.EgretPlayerView;

/** The game owns the whole content area of this standalone app. */
public final class GameActivity extends Activity {
    private EgretPlayerView player;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        player = new EgretPlayerView(this, "game", new EgretPlayerView.Listener() {
            @Override public void onError(String message) {
                Toast.makeText(GameActivity.this, message, Toast.LENGTH_LONG).show();
            }
        });
        GameInsets.apply(player);
        setContentView(player);
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (!GameBack.consume(player)) super.onBackPressed();
    }

    @Override protected void onResume() {
        super.onResume();
        player.onResume();
    }

    @Override protected void onPause() {
        player.onPause();
        super.onPause();
    }

    @Override public void dump(String prefix, FileDescriptor fd, PrintWriter writer, String[] args) {
        super.dump(prefix, fd, writer, args);
        writer.println(prefix + "Egret player: " + player.getDiagnostics());
    }

    @Override protected void onDestroy() {
        player.close();
        super.onDestroy();
    }
}
