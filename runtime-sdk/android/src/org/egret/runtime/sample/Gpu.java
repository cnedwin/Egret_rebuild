// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import java.nio.ByteBuffer;

final class Gpu {
    static { System.loadLibrary("egret_sample"); }

    static native long create();
    static native void destroy(long handle, boolean current);
    static native int upload(long handle, int page, int width, int height, ByteBuffer bytes);
    static native int release(long handle, int page);
    static native int draw(long handle, ByteBuffer bytes, int offset, int length, int width, int height);

    private Gpu() {}
}
