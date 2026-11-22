// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** UI-thread session control. Frame snapshots own their bytes across JS and GL threads. */
abstract class ScriptSession {
    final EgretPlayerView owner;
    final ProjectAssets project;
    final PlayerRaster raster;
    final ProjectAssetReads assetReads;
    final PlayerGraphics.Pages pages = new PlayerGraphics.Pages();

    private final WorldProjectPacket.Batches geometry = new WorldProjectPacket.Batches();
    volatile long geometryBatchPackets, geometryBatchBridgeBytes, streamedDraws, streamedDrawBridgeBytes;
    volatile int largestGeometryBatchBytes, largestStreamedDrawBytes;

    synchronized void discardGeometryBatches() { geometry.clear(); }

    ScriptSession(EgretPlayerView owner, ProjectAssets project) {
        this.owner = owner;
        this.project = project;
        this.raster = new PlayerRaster(project);
        assetReads = new ProjectAssetReads(project::openDeclared, owner.ui::post, (id, status) -> {
            if (!owner.ending) invoke("EgretPlayerProject.textResult(" + id + ",'" + status + "')");
        });
    }

    abstract void invoke(String expression);
    abstract void frame(int epoch, double elapsedMs, long previousFrame, long retryId);
    abstract void pauseVm();
    abstract void resumeVm();
    abstract boolean requestClose();
    abstract void destroy();

    void timeoutClose() { owner.finishClose(null, "Project close did not complete within 10 seconds"); }

    final synchronized void commands(int epoch, byte[] bytes, long generationNs, long transferNs) {
        if (owner.ending || epoch != owner.epoch) return;
        if (bytes == null || bytes.length < 24 || bytes.length > WorldProjectPacket.TEXTURED_LIMIT) {
            owner.reportFailure("Invalid command length on Android bridge");
            return;
        }
        ByteBuffer header = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        byte[][] batches;
        try {
            if (header.getInt(0) == WorldProjectPacket.BATCH_MAGIC) {
                geometry.add(epoch, header, bytes);
                geometryBatchPackets++;
                geometryBatchBridgeBytes += bytes.length;
                largestGeometryBatchBytes = Math.max(largestGeometryBatchBytes, bytes.length);
                return;
            }
            batches = geometry.finish(epoch, header);
        } catch (IllegalArgumentException error) {
            geometry.clear();
            owner.reportFailure(error.getMessage());
            return;
        }
        int stage = WorldProjectPacket.stageOffset(header);
        if (bytes.length > WorldProjectPacket.byteLimit(header.getInt(0)) || stage < 0 || header.getInt(stage + 8) != project.width || header.getInt(stage + 12) != project.height) {
            owner.reportFailure("Frame dimensions differ from the project stage");
            return;
        }
        if (header.getInt(0) == WorldProjectPacket.STREAM_MAGIC) {
            streamedDraws++;
            streamedDrawBridgeBytes += bytes.length;
            largestStreamedDrawBytes = Math.max(largestStreamedDrawBytes, bytes.length);
        }
        PlayerGraphics.Frame frame = new PlayerGraphics.Frame(epoch, bytes, pages.snapshot(), batches);
        owner.ui.post(() -> owner.enqueue(frame, generationNs, transferNs));
    }

    // Both VMs call on their script/bridge worker. A missing key is distinct
    // from a refused read; no exception or private storage path crosses into the game.
    final String readSave(String key) {
        if (owner.ending) return "{\"error\":\"closed\"}";
        try {
            String value = owner.saves.getItem(key);
            return value == null ? "{\"value\":null}" : "{\"value\":" + org.json.JSONObject.quote(value) + "}";
        } catch (IOException | RuntimeException failure) {
            return "{\"error\":\"read-failed\"}";
        }
    }

    final boolean writeSave(String key, String value) {
        if (owner.ending) return false;
        try { owner.saves.setItem(key, value); return true; }
        catch (IOException | RuntimeException failure) { return false; }
    }

    final boolean removeSave(String key) {
        if (owner.ending) return false;
        try { owner.saves.removeItem(key); return true; }
        catch (IOException | RuntimeException failure) { return false; }
    }

    final void requestEdit(String initialText) {
        int epoch = owner.epoch;
        owner.ui.post(() -> { if (epoch == owner.epoch) owner.editor(initialText); });
    }

    final void requestSound(String path) {
        if (owner.ending) return;
        int epoch = owner.epoch;
        try {
            byte[] bytes = project.read(path, 8 << 20);
            owner.ui.post(() -> { if (epoch == owner.epoch && owner.isPlaying()) owner.sound(bytes); });
        } catch (Exception e) { owner.reportFailure("Cannot open project sound: " + e); }
    }
}
