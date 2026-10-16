// SPDX-License-Identifier: Apache-2.0
// First-party, AI-assisted literal oracle for the P04-TR1 R2 contract.
// No generator, SDK, sampler, product command, matrix, or placement is imported.
export const WIDTH = 24;
export const HEIGHT = 16;
const CHANNELS = 1536;
const COLORS = Object.freeze({
  R:Object.freeze([255,0,0,255]), G:Object.freeze([0,255,0,255]),
  B:Object.freeze([0,0,255,255]), Y:Object.freeze([255,255,0,255]),
  M:Object.freeze([255,0,255,255]), C:Object.freeze([0,255,255,255]),
});
// These are destination pixel coordinates, not a rasterizer or transform model.
// Every unlisted coordinate has literal RGBA (0,0,0,0), including hidden RGB.
const AA = [[3,3,'R'],[4,3,'G'],[3,4,'B'],[4,4,'Y'],[3,5,'M'],[4,5,'C'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const BA = [[3,4,'R'],[4,4,'G'],[5,4,'B'],[3,5,'Y'],[4,5,'M'],[5,5,'C'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const BB = [[3,4,'R'],[4,4,'G'],[5,4,'B'],[3,5,'Y'],[4,5,'M'],[5,5,'C'],[13,4,'R'],[14,4,'G'],[15,4,'B'],[13,5,'Y'],[14,5,'M'],[15,5,'C']];
const N08 = [[0,2,'R'],[0,3,'G'],[0,4,'B'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const N09 = [[0,2,'R'],[0,3,'G'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const SIGN_WRONG = [[3,6,'Y'],[4,6,'M'],[5,6,'C'],[3,7,'R'],[4,7,'G'],[5,7,'B'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const TRIM_WRONG = [[3,3,'R'],[4,3,'G'],[5,3,'B'],[3,4,'Y'],[4,4,'M'],[5,4,'C'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const MASKS = Object.freeze({
  N01:AA, N02:BA, N03:BA, N04:BA, N05:BA, N06:BB,
  N07:BA, N08, N09, N10:BA, N11:AA,
  'rotation-sign:healthy':BA, 'rotation-sign:assigned':SIGN_WRONG,
  'trim-y-constant:healthy':BA, 'trim-y-constant:assigned':TRIM_WRONG,
});
for (const mask of new Set(Object.values(MASKS))) {
  for (const point of mask) Object.freeze(point);
  Object.freeze(mask);
}
export const CASE_IDS = Object.freeze(Object.keys(MASKS));

/** Return a fresh tightly packed 24x16 top-left, row-major RGBA8 Uint8Array.
 * caseId must be an exact primitive string from CASE_IDS. N11 is savedN01 replay.
 * Assigned masks are explicit diagnostic targets; they are never fallback passes.
 */
export function expectedRGBA(caseId) {
  if (typeof caseId !== 'string' || !Object.hasOwn(MASKS,caseId)) throw new TypeError('Unknown atlas-frame oracle caseId');
  const expected = new Uint8Array(CHANNELS);
  for (const [x,y,color] of MASKS[caseId]) expected.set(COLORS[color],(y*WIDTH+x)*4);
  return expected;
}

/** Compare all 384 pixels / 1536 channels exactly, including transparent RGB.
 * Accept only Uint8Array (including Buffer) with view byteLength===1536.
 * A correctly sized offset view is valid even when its backing buffer is larger.
 * This validates the accessible RGBA view, not backing storage or physical memory.
 * Rows must already be tightly packed: padded rows, other views, and wrappers fail.
 * firstDifference reports channel index 0=R,1=G,2=B,3=A and top-left x/y.
 */
export function compare(actual,caseId) {
  const expected=expectedRGBA(caseId);
  if (!(actual instanceof Uint8Array) || actual.length !== CHANNELS || actual.byteLength !== CHANNELS) throw new TypeError('Expected a tightly packed 1536-byte Uint8Array RGBA view');
  let differingPixels=0, differingChannels=0, firstDifference=null;
  for(let pixel=0;pixel<384;pixel++) {
    let different=false;
    for(let channel=0;channel<4;channel++) {
      const offset=pixel*4+channel;
      if(actual[offset]!==expected[offset]) {
        different=true; differingChannels++;
        if(firstDifference===null) firstDifference=Object.freeze({x:pixel%WIDTH,y:Math.floor(pixel/WIDTH),channel,expected:expected[offset],actual:actual[offset]});
      }
    }
    if(different) differingPixels++;
  }
  return Object.freeze({match:differingChannels===0,width:WIDTH,height:HEIGHT,pixels:384,channels:CHANNELS,differingPixels,differingChannels,firstDifference});
}
