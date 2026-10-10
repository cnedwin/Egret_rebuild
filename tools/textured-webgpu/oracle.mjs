// First-party Apache-2.0 independent encoded-premultiplied byte oracle.
// Imports frozen literals only; never imports a product/helper/shader or observed pixels.
import { definition } from './fixtures.mjs';
export class TexturedPixelAssertion extends Error {
  constructor(caseId, sample, actual, channels) {
    super(`TEXTURED_NATIVE_PIXEL:${caseId}:${sample.name}`); this.name='TexturedPixelAssertion';
    Object.assign(this,{caseId,assertion:sample.name,x:sample.x,y:sample.y,expected:sample.expected,
      bounds:sample.bounds,actual:[...actual],channels});
  }
}
export function channelAccepted(actual, expected, bound) {
  if (!Number.isInteger(actual) || actual<0 || actual>255 || !Number.isInteger(bound) || bound<0) return false;
  const [n,d]=expected.map(BigInt); if (d<=0n) throw Error('ORACLE_RATIONAL_INVALID');
  const delta=BigInt(actual)*d-n; return (delta<0n ? -delta : delta)<=BigInt(bound)*d;
}
export function checkRGBA(caseId, sample, actual) {
  const channels=sample.expected.map((value,i)=>channelAccepted(actual[i],value,sample.bounds[i]));
  if (actual.length!==4 || channels.some(value=>!value)) throw new TexturedPixelAssertion(caseId,sample,actual,channels);
  return {name:sample.name,x:sample.x,y:sample.y,expected:sample.expected,bounds:sample.bounds,actual:[...actual],channels};
}
export function verifyTexturedPixels(readback,caseId,selectedAssertion=null) {
  const value=definition(caseId), width=Math.ceil(value.width*value.pixelRatio),height=Math.ceil(value.height*value.pixelRatio);
  if (readback.width!==width || readback.height!==height || readback.bytes.length!==width*height*4
      || readback.format!=='rgba8unorm' || !['rgba8unorm','bgra8unorm'].includes(readback.sourceFormat)
      || readback.colorSpace!=='srgb' || readback.alphaMode!=='premultiplied'
      || !Number.isSafeInteger(readback.frameId) || readback.frameId<1 || !Number.isSafeInteger(readback.serial) || readback.serial<1) throw Error('TEXTURED_NATIVE_METADATA_INVALID');
  // Validate every retained byte, including unsampled regions; this is a schema check, not a whole-image color oracle.
  for (const byte of readback.bytes) if (!Number.isInteger(byte)||byte<0||byte>255) throw Error('TEXTURED_NATIVE_BYTES_INVALID');
  const samples=selectedAssertion===null?value.samples:value.samples.filter(sample=>sample.name===selectedAssertion);
  if (selectedAssertion!==null && samples.length!==1) throw Error('TEXTURED_NATIVE_ASSERTION_UNKNOWN');
  const checks=samples.map(sample=>{const offset=4*(width*sample.y+sample.x);
    return checkRGBA(caseId,sample,Array.from(readback.bytes.slice(offset,offset+4)));});
  return {caseId,phase:value.phase,backing:[width,height],checks,numericAcceptance:'Candidate bounds under one declared device window; no cross-device guarantee'};
}
export function verifyTransparentReset(readback,name,expectedWidth,expectedHeight) {
  if (readback.width!==expectedWidth || readback.height!==expectedHeight || readback.bytes.length!==4*expectedWidth*expectedHeight
      || readback.format!=='rgba8unorm' || !['rgba8unorm','bgra8unorm'].includes(readback.sourceFormat)
      || readback.colorSpace!=='srgb' || readback.alphaMode!=='premultiplied') throw Error('TEXTURED_RESET_METADATA_INVALID');
  for (let i=0;i<readback.bytes.length;i++) if (readback.bytes[i]!==0) {
    const sample={name,x:(i>>2)%expectedWidth,y:Math.floor((i>>2)/expectedWidth),expected:[['0','1'],['0','1'],['0','1'],['0','1']],bounds:[0,0,0,0]};
    const offset=i-i%4;throw new TexturedPixelAssertion(name,sample,Array.from(readback.bytes.slice(offset,offset+4)),[false]);
  }
  return {name,exactTransparent:true,bytesChecked:readback.bytes.length};
}
