// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.media.AudioAttributes;
import android.media.MediaDataSource;
import android.media.MediaPlayer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

final class PlayerAudio {
    private final EgretPlayerView owner;
    private final Set<MediaPlayer> sounds = new HashSet<>();
    int starts, releases;

    PlayerAudio(EgretPlayerView owner) { this.owner = owner; }

    // Short effects, including assets compressed by an APK packager. MediaPlayer
    // owns its decoder until completion, backgrounding or session close.
    void play(byte[] asset) {
        if (!owner.isPlaying() || sounds.size() >= 8) return;
        MediaPlayer sound = new MediaPlayer();
        sounds.add(sound);
        try {
            sound.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            sound.setDataSource(new MediaDataSource() {
                @Override public long getSize() { return asset.length; }
                @Override public int readAt(long position, byte[] buffer, int offset, int size) {
                    if (position < 0 || position >= asset.length) return -1;
                    int count = Math.min(size, asset.length - (int) position);
                    System.arraycopy(asset, (int) position, buffer, offset, count);
                    return count;
                }
                @Override public void close() {}
            });
            sound.setOnCompletionListener(this::release);
            sound.setOnErrorListener((player, what, extra) -> {
                release(player);
                owner.reportFailure("Cannot decode project sound (" + what + ", " + extra + ")");
                return true;
            });
            sound.setOnPreparedListener(player -> {
                if (!sounds.contains(player)) return;
                if (!owner.isPlaying()) { release(player); return; }
                player.start();
                starts++;
            });
            sound.prepareAsync();
        } catch (Exception e) {
            release(sound);
            owner.reportFailure("Cannot play project sound: " + e);
        }
    }

    int active() { return sounds.size(); }

    void stop() {
        for (MediaPlayer sound : new ArrayList<>(sounds)) release(sound);
    }

    private void release(MediaPlayer sound) {
        if (!sounds.remove(sound)) return;
        sound.setOnPreparedListener(null);
        sound.setOnCompletionListener(null);
        sound.setOnErrorListener(null);
        sound.release();
        releases++;
    }
}
