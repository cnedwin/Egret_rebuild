// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.os.Process;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Measures successful UI-thread frame callbacks. No fence, readback or GPU query is issued. */
final class PlayerTiming {
    private static final int WARMUP = 30;
    private static final int SAMPLES = 180;
    private static final int INTERVAL = 0, DISPATCH = 1, RETURN = 2, GENERATE = 3, COPY = 4;
    private static final String[] NAMES = {
        "submittedIntervalUs", "dispatchToEnqueueUs", "enqueueToCallbackUs", "generationUs", "copyUs"
    };
    private final long constructionNs = SystemClock.elapsedRealtimeNanos();
    private long firstDrawNs, beginNs, enqueueNs, previousNs, generationNs, copyNs;
    private int warm, count;
    private long[][] series;
    private volatile boolean collecting;

    // The only cross-thread read is this flag. All measurement writes happen on the main thread.
    boolean isEnabled() { return collecting; }

    void setEnabled(boolean enabled) {
        series = enabled ? new long[NAMES.length][SAMPLES] : null;
        collecting = enabled;
        count = warm = 0;
        previousNs = beginNs = enqueueNs = 0;
    }

    void discontinuity() {
        if (collecting) setEnabled(true);
    }

    void begin() {
        if (!collecting) return;
        beginNs = SystemClock.elapsedRealtimeNanos();
        enqueueNs = 0;
        generationNs = copyNs = -1;
    }

    void script(long generationNs, long transferNs) {
        if (collecting) {
            this.generationNs = generationNs;
            this.copyNs = transferNs;
        }
    }

    void enqueued() {
        if (collecting && beginNs != 0) enqueueNs = SystemClock.elapsedRealtimeNanos();
    }

    void firstDraw() {
        if (firstDrawNs == 0) firstDrawNs = SystemClock.elapsedRealtimeNanos();
    }

    void submitted() {
        if (!collecting || beginNs == 0 || enqueueNs == 0) return;
        long now = SystemClock.elapsedRealtimeNanos();
        if (warm >= WARMUP && previousNs != 0) {
            series[INTERVAL][count] = now - previousNs;
            series[DISPATCH][count] = enqueueNs - beginNs;
            series[RETURN][count] = now - enqueueNs;
            series[GENERATE][count] = generationNs;
            series[COPY][count] = copyNs;
            count++;
            if (count == SAMPLES) collecting = false;
        } else {
            warm++;
        }
        previousNs = now;
        beginNs = enqueueNs = 0;
    }

    JSONObject snapshot() throws JSONException {
        JSONObject result = new JSONObject().put("samples", count).put("warmup", WARMUP).put("capacity", SAMPLES);
        if (firstDrawNs != 0) {
            result.put("viewToFirstDrawMs", (firstDrawNs - constructionNs) / 1_000_000.0);
            result.put("processToFirstDrawMs", firstDrawNs / 1_000_000.0 - Process.getStartElapsedRealtime());
        }
        if (series == null || count == 0) return result;
        for (int field = 0; field < NAMES.length; field++) {
            JSONArray values = new JSONArray();
            for (int i = 0; i < count; i++) {
                long value = series[field][i];
                values.put(value < 0 ? JSONObject.NULL : Long.valueOf(Math.round(value / 1000.0)));
            }
            result.put(NAMES[field], values);
        }
        return result;
    }
}
