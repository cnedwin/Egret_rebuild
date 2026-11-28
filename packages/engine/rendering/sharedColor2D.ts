import { copyImageData2DPixels } from '@egret/contracts';
import type { ImageData2D } from '@egret/contracts';
import { decodeSRGBByte } from '@egret/contracts';
/** Selected sRGB transfer. Alpha and tint coefficients are never gamma converted. */
export function decodeSharedSRGB(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
/** The linear-light value of an sRGB byte, from the written table: the same number in every JavaScript engine. */
export function decodeSharedSRGBByte(code: number): number {
  return decodeSRGBByte(code);
}
/** The recipe and target a frame records for each blend space. */
export const SHARED_BLEND_RECIPES_2D = Object.freeze({
  linear: Object.freeze({
    colorRecipe: 'egret.linear-srgb-pma/1',
    targetRepresentation: 'egret.srgb-pma8-target/1'
  } as const),
  srgb: Object.freeze({
    colorRecipe: 'egret.srgb-pma/1',
    targetRepresentation: 'egret.encoded-srgb-pma8-target/1'
  } as const)
});
/** The blend space of a frame whose recipe and target agree, or undefined. */
export function sharedBlendSpace2D(frame: {
  readonly colorRecipe: string;
  readonly targetRepresentation: string;
}): 'linear' | 'srgb' | undefined {
  for (const space of ['linear', 'srgb'] as const) {
    const recipe = SHARED_BLEND_RECIPES_2D[space];
    if (frame.colorRecipe === recipe.colorRecipe && frame.targetRepresentation === recipe.targetRepresentation)
      return space;
  }
  return undefined;
}
/**
 * Why a Host refuses a frame for its blend space and output alpha: `profile` when the frame was made for another
 * target, `invalid` when an opaque frame clears to less than full alpha, or undefined when it draws the frame.
 */
export function sharedFrameProfileRefusal2D(
  frame: {
    readonly colorRecipe: string;
    readonly targetRepresentation: string;
    readonly outputAlpha: string;
    readonly outputRepresentation: string;
    readonly clearAlpha: number;
  },
  blendSpace: 'linear' | 'srgb',
  outputAlpha: 'premultiplied' | 'opaque'
): 'profile' | 'invalid' | undefined {
  if (
    sharedBlendSpace2D(frame) !== blendSpace ||
    frame.outputAlpha !== outputAlpha ||
    frame.outputRepresentation !==
      (outputAlpha === 'opaque' ? 'egret.srgb-opaque-unorm8/1' : 'egret.srgb-premultiplied-unorm8/1')
  )
    return 'profile';
  if (outputAlpha === 'opaque' && frame.clearAlpha !== 1) return 'invalid';
  return undefined;
}
/**
 * The 0-to-1 value a target of the blend space holds for a channel byte of a colour: its linear light, or the
 * byte as it is written in a target that mixes the codes.
 */
export function sharedTargetChannel2D(space: 'linear' | 'srgb', code: number): number {
  return space === 'srgb' ? (code & 255) / 255 : decodeSRGBByte(code);
}
export function encodeSharedSRGB(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}
const caps = Object.freeze(
  Array.from({ length: 256 }, (_, alpha) => {
    let code = 0;
    while (code < 255 && decodeSharedSRGB((code + 1) / 255) <= alpha / 255) code++;
    return code;
  })
);
// All alpha and channel inputs are bytes. Precompute the exact scalar rule once.
const premultipliedSrgb = new Uint8Array(256 * 256);
for (let alpha = 0; alpha < 256; alpha++) {
  const a = alpha / 255,
    cap = caps[alpha]!;
  for (let code = 0; code < 256; code++)
    premultipliedSrgb[(alpha << 8) | code] = Math.min(
      cap,
      Math.floor(255 * encodeSharedSRGB(a * decodeSharedSRGB(code / 255)) + 0.5)
    );
}
/**
 * How many levels a page of this size has when it carries its smaller copies: the page itself, then each copy
 * half as large, rounded down and never below one texel, down to one texel.
 */
export function sharedPageLevels2D(width: number, height: number): number {
  return 1 + Math.floor(Math.log2(Math.max(width, height)));
}
/** The size of each level of a page, and where its bytes start in the page's bytes. */
export function sharedPageLevelLayout2D(
  width: number,
  height: number,
  levels: number
): { width: number; height: number; offset: number }[] {
  const layout: { width: number; height: number; offset: number }[] = [];
  let offset = 0;
  for (let level = 0; level < levels; level++) {
    const w = Math.max(1, width >> level),
      h = Math.max(1, height >> level);
    layout.push({ width: w, height: h, offset });
    offset += 4 * w * h;
  }
  return layout;
}
/** The bytes of a page with `levels` levels: the page's own, then those of each smaller copy after it. */
export function sharedPageChainBytes2D(width: number, height: number, levels: number): number {
  const layout = sharedPageLevelLayout2D(width, height, levels),
    last = layout[layout.length - 1]!;
  return last.offset + 4 * last.width * last.height;
}
const encodedCode = (value: number, alpha: number): number =>
  Math.min(caps[alpha]!, Math.floor(255 * encodeSharedSRGB(value) + 0.5));
/**
 * Writes each smaller level from the one before it. A texel of a level is the mean of the two by two texels of
 * the level above it that it covers, in linear light with alpha premultiplied, then encoded as the page is.
 * A level above that is one texel wide or high gives that texel twice. An odd last row or column of a level
 * is left out of the next, as a GPU leaves it out when it makes the levels itself.
 */
function fillSharedLevels2D(chain: Uint8Array, width: number, height: number, levels: number): void {
  const layout = sharedPageLevelLayout2D(width, height, levels);
  for (let level = 1; level < levels; level++) {
    const above = layout[level - 1]!,
      here = layout[level]!;
    for (let y = 0; y < here.height; y++) {
      const y0 = Math.min(2 * y, above.height - 1),
        y1 = Math.min(2 * y + 1, above.height - 1);
      for (let x = 0; x < here.width; x++) {
        const x0 = Math.min(2 * x, above.width - 1),
          x1 = Math.min(2 * x + 1, above.width - 1);
        const taps = [
          above.offset + 4 * (y0 * above.width + x0),
          above.offset + 4 * (y0 * above.width + x1),
          above.offset + 4 * (y1 * above.width + x0),
          above.offset + 4 * (y1 * above.width + x1)
        ];
        let alpha = 0;
        for (const tap of taps) alpha += chain[tap + 3]!;
        const a = Math.floor(alpha / 4 + 0.5),
          out = here.offset + 4 * (y * here.width + x);
        for (let channel = 0; channel < 3; channel++) {
          let sum = 0;
          for (const tap of taps) sum += decodeSRGBByte(chain[tap + channel]!);
          chain[out + channel] = encodedCode(sum / 4, a);
        }
        chain[out + 3] = a;
      }
    }
  }
}
/** Plain Host-owned observation only; no allocator, callback or resource authority. */
export interface SharedPageCopyDiagnostics2D {
  canonicalBytes: number;
  scratchBytes: number;
  highCanonicalBytes: number;
  highScratchBytes: number;
  highTemporaryBytes: number;
  saturated: boolean;
}
function sampleCopy(diagnostics: SharedPageCopyDiagnostics2D): void {
  diagnostics.highCanonicalBytes = Math.max(diagnostics.highCanonicalBytes, diagnostics.canonicalBytes);
  diagnostics.highScratchBytes = Math.max(diagnostics.highScratchBytes, diagnostics.scratchBytes);
  const excess = diagnostics.canonicalBytes > Number.MAX_SAFE_INTEGER - diagnostics.scratchBytes;
  if (excess) diagnostics.saturated = true;
  diagnostics.highTemporaryBytes = Math.max(
    diagnostics.highTemporaryBytes,
    excess ? Number.MAX_SAFE_INTEGER : diagnostics.canonicalBytes + diagnostics.scratchBytes
  );
}
function writePremultipliedPixel(source: Uint8Array, output: Uint8Array, offset: number, alpha: number): void {
  const row = alpha << 8;
  output[offset] = premultipliedSrgb[row | source[offset]!]!;
  output[offset + 1] = premultipliedSrgb[row | source[offset + 1]!]!;
  output[offset + 2] = premultipliedSrgb[row | source[offset + 2]!]!;
  output[offset + 3] = alpha;
}

// Four separated neighboring pairs select a loop. Every pixel in the chosen loop still uses its own alpha.
function hasEndpointRuns(source: Uint8Array, start: number, end: number): boolean {
  if (end - start < 32) return false;
  const stride = Math.floor((end - start) / 16) * 4;
  for (let sample = 0; sample < 4; sample++) {
    const offset = start + sample * stride + 3;
    const alpha = source[offset]!;
    if ((alpha !== 0 && alpha !== 255) || source[offset + 4] !== alpha) return false;
  }
  return true;
}

/** One actual source copy and one tight canonical output; callers reserve that peak first. */
export function copySharedPagePixels(
  image: ImageData2D,
  diagnostics?: SharedPageCopyDiagnostics2D,
  levels = 1
): Uint8Array<ArrayBuffer> {
  let source: ReturnType<typeof copyImageData2DPixels> | undefined, output: Uint8Array<ArrayBuffer> | undefined;
  try {
    source = copyImageData2DPixels(image);
    if (diagnostics) {
      diagnostics.scratchBytes += source.byteLength;
      sampleCopy(diagnostics);
    }
    output = new Uint8Array(
      levels === 1 ? source.byteLength : sharedPageChainBytes2D(image.width, image.height, levels)
    );
    if (diagnostics) {
      diagnostics.canonicalBytes += output.byteLength;
      sampleCopy(diagnostics);
    }
    const sourceWords = new Uint32Array(source.buffer, source.byteOffset, source.length / 4);
    const outputWords = new Uint32Array(output.buffer, output.byteOffset, sourceWords.length);
    const blockBytes = 1024 * 4;
    for (let start = 0; start < source.length; start += blockBytes) {
      const end = Math.min(start + blockBytes, source.length);
      if (!hasEndpointRuns(source, start, end)) {
        for (let offset = start; offset < end; offset += 4) {
          writePremultipliedPixel(source, output, offset, source[offset + 3]!);
        }
        continue;
      }
      for (let offset = start; offset < end; offset += 4) {
        const alpha = source[offset + 3]!;
        // Transparent black is already zero. Whole-word copying preserves byte order on either endianness.
        if (alpha === 0) continue;
        if (alpha === 255) outputWords[offset / 4] = sourceWords[offset / 4]!;
        else writePremultipliedPixel(source, output, offset, alpha);
      }
    }
    if (levels > 1) fillSharedLevels2D(output, image.width, image.height, levels);
    return output;
  } catch (cause) {
    if (diagnostics && output) diagnostics.canonicalBytes -= output.byteLength;
    throw cause;
  } finally {
    if (diagnostics && source) diagnostics.scratchBytes -= source.byteLength;
  }
}
