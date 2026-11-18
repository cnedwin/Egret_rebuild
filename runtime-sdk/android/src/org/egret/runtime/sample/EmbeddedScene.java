// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import android.content.Context;
import java.nio.ByteBuffer;
import org.json.JSONObject;

/** Worker-thread boundary. The system-WebView APK has no embedded VM dependency. */
interface EmbeddedScene extends AutoCloseable {
    JSONObject open(Context context, String profile, ByteBuffer atlas) throws Exception;
    void capture(Frame frame, ByteBuffer destination) throws Exception;
    int releaseScope() throws Exception;
    @Override void close() throws Exception;
}
