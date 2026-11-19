// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.nio.ByteBuffer;

final class PlayerGpu {
    static { System.loadLibrary("egret_player"); }

    static native long create();
    static native void destroy(long handle, boolean current);
    static native int upload(long handle, int page, int width, int height, ByteBuffer pixels);
    static native int release(long handle, int page);
    static native int draw(long handle, ByteBuffer data, int offset, int length, int width, int height);

    private PlayerGpu() {}
}
