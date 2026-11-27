// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import org.json.JSONObject;

/** One soundtrack per view. MediaPlayer reads the packaged range without a whole-file Java buffer. */
final class ProjectMusic {
    private MediaPlayer player;
    private ProjectHostServices.Reply pending;
    private boolean foreground;
    private boolean prepared;

    Runnable play(ProjectAssets assets, String json, ProjectHostServices.Reply reply) {
        stop();
        try {
            JSONObject options = new JSONObject(json);
            String asset = options.getString("path");
            try (AssetFileDescriptor fd = assets.openSoundtrack(asset)) {
                MediaPlayer next = new MediaPlayer();
                player = next;
                pending = reply;
                next.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                next.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
                next.setLooping(options.optBoolean("loop", true));
                next.setOnPreparedListener(p -> {
                    if (p != player) return;
                    prepared = true;
                    try {
                        if (foreground) p.start();
                        pending = null;
                        reply.resolve("true");
                    } catch (IllegalStateException error) { stop(); }
                });
                next.setOnCompletionListener(p -> { if (p == player) stop(); });
                next.setOnErrorListener((p, what, extra) -> { if (p == player) stop(); return true; });
                next.prepareAsync();
                return () -> { if (player == next) stop(); };
            }
        } catch (Exception e) {
            stop();
            reply.reject("Cannot open declared soundtrack; package an uncompressed audio asset");
            return null;
        }
    }

    void setForeground(boolean value) {
        foreground = value;
        if (player == null || !prepared) return;
        try {
            if (value) player.start();
            else if (player.isPlaying()) player.pause();
        } catch (IllegalStateException unavailable) {
            // A platform media error can precede its queued listener on the UI thread.
            stop();
        }
    }

    JSONObject snapshot() throws org.json.JSONException {
        JSONObject state = new JSONObject().put("active", player != null).put("prepared", prepared);
        if (player != null && prepared) {
            try { state.put("playing", player.isPlaying()).put("positionMs", player.getCurrentPosition()); }
            catch (IllegalStateException unavailable) { state.put("unavailable", true); }
        }
        return state;
    }

    void stop() {
        if (player != null) {
            MediaPlayer old = player;
            player = null;
            old.setOnPreparedListener(null);
            old.setOnCompletionListener(null);
            old.setOnErrorListener(null);
            old.release();
        }
        prepared = false;
        if (pending != null) {
            ProjectHostServices.Reply reply = pending;
            pending = null;
            reply.reject("Soundtrack stopped before preparation completed");
        }
    }
}
