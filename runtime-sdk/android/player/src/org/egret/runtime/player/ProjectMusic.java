// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONException;
import org.json.JSONObject;

/** One streaming soundtrack per player view. Each incoming host operation runs on the UI thread. */
final class ProjectMusic {
    private final Set<MediaPlayer> probes = new HashSet<>();
    private MediaPlayer player;
    private int sessionId;
    private float volume = 1;
    private ProjectHostServices.Reply pending;
    private ProjectHostServices.Reply positionWaiter;
    private boolean foreground;
    private boolean prepared;

    private static int id(JSONObject options) throws JSONException {
        double value = options.getDouble("id");
        if (value < 1 || value > Integer.MAX_VALUE || value != Math.floor(value)) throw new JSONException("Invalid soundtrack id");
        return (int)value;
    }

    private static float gain(JSONObject options) throws JSONException {
        double value = options.getDouble("volume");
        if (!(value >= 0 && value <= 1)) throw new JSONException("Invalid volume");
        return (float)value;
    }

    /** Measuring a second sound must not replace or pause the current soundtrack. */
    Runnable describe(ProjectAssets assets, String json, ProjectHostServices.Reply reply) {
        if (probes.size() >= 4) { reply.reject("Too many pending soundtrack probes"); return null; }
        MediaPlayer probe = null;
        try (AssetFileDescriptor fd = assets.openSoundtrack(new JSONObject(json).getString("path"))) {
            final long bytes = fd.getLength();
            if (bytes <= 0) throw new IllegalArgumentException("Empty soundtrack");
            probe = new MediaPlayer();
            final MediaPlayer current = probe;
            probes.add(current);
            current.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), bytes);
            current.setOnPreparedListener(p -> {
                if (!probes.contains(p)) return;
                try {
                    int duration = p.getDuration();
                    if (duration <= 0) throw new IllegalStateException("Unknown duration");
                    reply.resolve(new JSONObject().put("seconds", duration / 1000.0).put("bytes", bytes).toString());
                } catch (Exception failed) { reply.reject("Unknown soundtrack duration"); }
                finally { releaseProbe(p); }
            });
            current.setOnErrorListener((p, what, extra) -> {
                if (probes.contains(p)) { releaseProbe(p); reply.reject("Cannot decode declared soundtrack"); }
                return true;
            });
            current.prepareAsync();
            return () -> releaseProbe(current);
        } catch (Exception failed) {
            if (probe != null) releaseProbe(probe);
            reply.reject("Cannot inspect declared soundtrack");
            return null;
        }
    }

    private void releaseProbe(MediaPlayer probe) {
        if (probes.remove(probe)) release(probe);
    }

    Runnable play(ProjectAssets assets, String json, ProjectHostServices.Reply reply) {
        return begin(assets, json, reply, false);
    }

    Runnable once(ProjectAssets assets, String json, ProjectHostServices.Reply reply) {
        return begin(assets, json, reply, true);
    }

    private Runnable begin(ProjectAssets assets, String json, ProjectHostServices.Reply reply, boolean once) {
        MediaPlayer created = null;
        try {
            JSONObject options = new JSONObject(json);
            final int activeId = once ? id(options) : 0;
            final float initialVolume = once ? gain(options) : 1;
            double offset = once ? options.getDouble("offset") : 0;
            if (!(offset >= 0 && offset <= Integer.MAX_VALUE / 1000.0)) throw new IllegalArgumentException("Invalid start time");
            final long offsetMs = Math.round(offset * 1000);
            try (AssetFileDescriptor fd = assets.openSoundtrack(options.getString("path"))) {
                stop();
                created = new MediaPlayer();
                final MediaPlayer current = created;
                player = current;
                pending = reply;
                sessionId = activeId;
                volume = initialVolume;
                current.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                current.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
                current.setLooping(!once && options.optBoolean("loop", true));
                current.setOnPreparedListener(p -> {
                    if (p != player) return;
                    try {
                        if (offsetMs > 0) {
                            if (offsetMs >= p.getDuration()) throw new IllegalArgumentException("Start exceeds duration");
                            p.setOnSeekCompleteListener(at -> { if (at == player) ready(at, once); });
                            p.seekTo(offsetMs, MediaPlayer.SEEK_CLOSEST);
                        } else ready(p, once);
                    } catch (RuntimeException failed) { finish(false, "Invalid soundtrack start"); }
                });
                current.setOnCompletionListener(p -> { if (p == player) finish(true, ""); });
                current.setOnErrorListener((p, what, extra) -> {
                    if (p == player) finish(false, "Soundtrack playback failed");
                    return true;
                });
                current.prepareAsync();
                return () -> { if (player == current) stop(); };
            }
        } catch (Exception failed) {
            if (created != null && created == player) finish(false, "Cannot open declared soundtrack");
            else reply.reject("Cannot open declared soundtrack");
            return null;
        }
    }

    private void ready(MediaPlayer current, boolean once) {
        try {
            current.setOnSeekCompleteListener(null);
            current.setVolume(volume, volume);
            prepared = true;
            if (foreground) current.start();
            answerPosition();
            if (!once && pending != null) {
                ProjectHostServices.Reply reply = pending;
                pending = null;
                reply.resolve("true");
            }
        } catch (IllegalStateException failed) { finish(false, "Soundtrack did not start"); }
    }

    Runnable volume(String json, ProjectHostServices.Reply reply) {
        try {
            JSONObject options = new JSONObject(json);
            int requestId = id(options);
            float value = gain(options);
            if (player == null || sessionId != requestId) { reply.resolve("false"); return null; }
            if (prepared) player.setVolume(value, value);
            volume = value;
            reply.resolve("true");
        } catch (Exception failed) { reply.reject("Invalid soundtrack volume"); }
        return null;
    }

    Runnable position(String json, ProjectHostServices.Reply reply) {
        try {
            int requestId = id(new JSONObject(json));
            if (player == null || requestId != sessionId) { reply.resolve("null"); return null; }
            // Before prepare/initial seek completes, return the decoder's eventual position.
            if (positionWaiter != null) positionWaiter.resolve("null");
            positionWaiter = reply;
            if (prepared) { answerPosition(); return null; }
            return () -> { if (positionWaiter == reply) positionWaiter = null; };
        } catch (Exception failed) { reply.reject("Invalid soundtrack id"); return null; }
    }

    private void answerPosition() {
        if (positionWaiter == null) return;
        ProjectHostServices.Reply reply = positionWaiter;
        positionWaiter = null;
        try { reply.resolve(player == null ? "null" : Double.toString(player.getCurrentPosition() / 1000.0)); }
        catch (IllegalStateException unavailable) { reply.resolve("null"); }
    }

    void setForeground(boolean value) {
        foreground = value;
        if (player == null || !prepared) return;
        try {
            if (value) player.start();
            else if (player.isPlaying()) player.pause();
        } catch (IllegalStateException unavailable) { finish(false, "Soundtrack unavailable"); }
    }

    JSONObject snapshot() throws JSONException {
        JSONObject state = new JSONObject().put("active", player != null).put("prepared", prepared);
        if (player != null && prepared) {
            try { state.put("playing", player.isPlaying()).put("positionMs", player.getCurrentPosition()); }
            catch (IllegalStateException unavailable) { state.put("unavailable", true); }
        }
        return state;
    }

    private static void release(MediaPlayer old) {
        old.setOnPreparedListener(null);
        old.setOnSeekCompleteListener(null);
        old.setOnCompletionListener(null);
        old.setOnErrorListener(null);
        old.release();
    }

    private void finish(boolean naturalEnd, String reason) {
        MediaPlayer old = player;
        player = null;
        sessionId = 0;
        prepared = false;
        ProjectHostServices.Reply reply = pending;
        pending = null;
        if (old != null) release(old);
        answerPosition();
        if (reply != null) {
            if (naturalEnd) reply.resolve("\"finished\"");
            else reply.reject(reason);
        }
    }

    void stop() { finish(false, "Soundtrack stopped or replaced"); }
}
