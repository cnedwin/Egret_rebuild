// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.sample;

import java.nio.ByteBuffer;

final class Frame {
    final int number, index, generation;
    final long vsyncNs, requestNs;
    ByteBuffer bytes;
    int offset;
    long vmCallbackNs, jsWorkNs, dataReadyNs, drawStartNs, drawEndNs;
    long generationNs, transferStartNs, transferEndNs;

    Frame(int number, int index, int generation, long vsyncNs) {
        this.number = number;
        this.index = index;
        this.generation = generation;
        this.vsyncNs = vsyncNs;
        this.requestNs = System.nanoTime();
    }
}
