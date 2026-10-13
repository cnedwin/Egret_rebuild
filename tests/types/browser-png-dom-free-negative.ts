// SPDX-License-Identifier: Apache-2.0
// Separate ES2022-only consumer; do not force optional DOM declarations into this lane.
import type { Texture } from '@egret/engine';
declare const retainedTexture: Texture;
void retainedTexture;

// BIP_TYPE_CASE BIP1-DN01: DOM document is not a default-root ambient capability.
document;
// BIP_TYPE_CASE BIP1-DN02: DOM window is not a default-root ambient capability.
window;
// BIP_TYPE_CASE BIP1-DN03: ImageBitmap is not a default-root ambient type.
let forbiddenBitmap: ImageBitmap;
// BIP_TYPE_CASE BIP1-DN04: Blob is not a default-root ambient constructor.
new Blob([]);
// BIP_TYPE_CASE BIP1-DN05: Node process is not a default-root ambient capability.
process;
// BIP_TYPE_CASE BIP1-DN06: HTMLCanvasElement is not a default-root ambient type.
let forbiddenCanvas: HTMLCanvasElement;
