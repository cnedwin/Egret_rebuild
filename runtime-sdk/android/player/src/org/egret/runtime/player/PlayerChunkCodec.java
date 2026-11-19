// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.nio.charset.StandardCharsets;

/** Encodes only the used prefix of a package reader's 64 KiB scratch buffer. */
final class PlayerChunkCodec {
    static { System.loadLibrary("egret_player"); }

    static String encode(byte[] source, int length) {
        // The native result contains only Base64 ASCII. Latin-1 preserves every byte as a character.
        return new String(encodeAscii(source, length), StandardCharsets.ISO_8859_1);
    }

    private static native byte[] encodeAscii(byte[] source, int length);

    private PlayerChunkCodec() {}
}
