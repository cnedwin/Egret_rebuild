import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { CASES, CALIBRATION, HELD_OUT, definition, UPLOADS } from '../tools/textured-webgpu/fixtures.mjs';
// First-party prospective ORACLE UNITS. No GPU, browser, product preparation or shader imports.
const oracleURL=new URL('../tools/textured-webgpu/oracle.mjs',import.meta.url);
let module;
try { module=await import(oracleURL.href); }
catch(cause) { if (cause?.code!=='ERR_MODULE_NOT_FOUND'||cause?.url!==oracleURL.href) throw cause; }
function oracle() { assert.equal(typeof module?.verifyTexturedPixels,'function','NATIVE01 missing verifyTexturedPixels');return module; }
function headless() {return {surface:{},close:async()=>{},setTimeout(callback,delay){const handle=setTimeout(callback,delay);return()=>clearTimeout(handle);}};}
test('NATIVE01 native comparator exists after genuine public owned Mesh capture prerequisite',async()=>{
  for(const name of ['createEngine','createImageData2D','createTexture','createAssetType','createAssetRef','createTexturedGeometry2D','Mesh2D'])
    assert.equal(typeof egret[name],'function','Accepted public CPU prerequisite '+name);
  const engine=await egret.createEngine({host:headless()});let lease,mesh,texture;
  try {
    const image=egret.createImageData2D({width:1,height:1,pixels:new Uint8Array([255,255,255,128])});texture=egret.createTexture(image);
    const type=egret.createAssetType('native-oracle-owned',egret.isTexture);
    engine.assets.register(type,{load:async()=>texture,dispose:value=>value.dispose()});lease=await engine.assets.acquire(egret.createAssetRef(type,'literal'));
    const geometry=egret.createTexturedGeometry2D({positions:new Float64Array([0,0,16,0,0,16]),uvs:new Float64Array([.5,.5,.5,.5,.5,.5]),
      lightColors:new Float64Array([1,0,0,1,0,1,0,.5,0,0,1,.25]),indices:new Uint16Array([0,1,2])});
    mesh=new egret.Mesh2D(lease,geometry);engine.stage.addChild(mesh);mesh.alpha=.5;
    const frame=engine.captureTexturedFrame({width:16,height:16,clearColor:0,clearAlpha:0});
    assert.equal(frame.profile,'egret.textured-frame2d/1');assert.equal(frame.commands[0].kind,'mesh');assert.equal(frame.geometries[0],geometry);
    assert.equal(frame.images[0],image);assert.equal(mesh.geometry,geometry);assert.equal(lease.value,texture);
    for(const value of [frame,frame.commands,frame.images,frame.geometries,frame.commands[0],geometry])assert.equal(Object.isFrozen(value),true);
    // Required genuine initialized RED is this assigned assertion only, before adopting oracle.mjs.
    oracle();
  } finally {mesh?.dispose();lease?.release();await engine.dispose();texture?.dispose();}
});
test('ORACLE UNIT fixed calibration and held-out membership remains disjoint and complete',()=>{
  assert.equal(CALIBRATION.length,11);assert.equal(HELD_OUT.length,10);assert.equal(CASES.length,21);
  assert.equal(new Set([...CALIBRATION,...HELD_OUT]).size,21);assert.equal(CASES.reduce((n,value)=>n+value.samples.length,0),47);
  assert.deepEqual(CALIBRATION,['N01-a0','N01-a1','N01-a127','N01-a128','N01-a254','N01-a255','N03-forward','N03-reversed','N05-palette','N05-clamp0','N05-clamp1']);
});
test('ORACLE UNIT first-party upload literals independently satisfy fixed integer rounding model',()=>{
  const alpha=[0,1,127,128,254,255];for(let i=0;i<alpha.length;i++)assert.deepEqual([255,32,8].map(c=>Math.floor((c*alpha[i]+127)/255)).concat(alpha[i]),UPLOADS[i]);
});
for(const value of CASES)for(const sample of value.samples)for(let channel=0;channel<4;channel++) {
  test(`ORACLE UNIT inclusive rational channel interval ${value.id}/${sample.name}/${channel}`,()=>{
    const {channelAccepted}=oracle(),[n,d]=sample.expected[channel].map(BigInt),bound=BigInt(sample.bounds[channel]);
    // Independent interval endpoints using nonnegative integer ceiling/floor, never observed pixels.
    const lower=n-bound*d,upper=n+bound*d;
    const lo=Number(lower<=0n?0n:(lower+d-1n)/d),hi=Number(upper/d>255n?255n:upper/d);
    assert.equal(channelAccepted(lo,sample.expected[channel],sample.bounds[channel]),true);
    assert.equal(channelAccepted(hi,sample.expected[channel],sample.bounds[channel]),true);
    if(lo>0)assert.equal(channelAccepted(lo-1,sample.expected[channel],sample.bounds[channel]),false);
    if(hi<255)assert.equal(channelAccepted(hi+1,sample.expected[channel],sample.bounds[channel]),false);
  });
}
function unitReadback(id) {
  const d=definition(id),width=Math.ceil(d.width*d.pixelRatio),height=Math.ceil(d.height*d.pixelRatio),bytes=new Uint8Array(4*width*height);
  for(const s of d.samples){const offset=4*(width*s.y+s.x);bytes.set(s.expected.map(([n,q])=>Number((BigInt(n)+BigInt(q)/2n)/BigInt(q))),offset);}
  return {width,height,bytes,frameId:1,serial:1,format:'rgba8unorm',sourceFormat:'bgra8unorm',colorSpace:'srgb',alphaMode:'premultiplied'};
}
const unitControls=[
  ['no-op-alpha','N01-a128','alpha-128',[0,0,0,0]],
  ['no-op-interpolation','N02-interpolation','interpolated-rgba',[0,0,0,0]],
  ['reverse-painter','N03-forward','blue-over-red',[128,0,64,192]],
  ['reverse-mixed-barriers','N04-empty','last-green-empty',[255,0,0,255]],
  ['omit-light-alpha','N01-a128','alpha-128',[32,2,2,64]],
  ['omit-opacity','N01-a128','alpha-128',[32,2,2,64]],
  ['double-premultiply','N01-a128','alpha-128',[8,1,0,32]],
  ['atlas-instead-of-crop','N05-palette','crop-green',[255,0,255,255]],
  ['wrong-UV','N05-palette','crop-red',[0,255,0,255]],
  ['remove-clip','N06-diamond','clip-outside-top',[8,1,16,32]],
  ['detach-light','N06-diamond','clip-inside-left',[0,0,16,32]],
  ['swap-RG','N06-diamond','clip-inside-top',[4,8,16,32]],
  ['visible-complement-detach','N09-complement','visible-complement-transport',[0,0,0,32]],
];
for(const [name,id,assertion,bytes]of unitControls)test('ORACLE UNIT synthetic '+name+' fails its fixed named channel assertion',()=>{
  const o=oracle(),sample=definition(id).samples.find(row=>row.name===assertion);
  assert.throws(()=>o.checkRGBA(id,sample,bytes),cause=>cause instanceof o.TexturedPixelAssertion&&cause.caseId===id&&cause.assertion===assertion);
});
test('ORACLE UNIT nominal DPR fails fixed backing metadata',()=>{
  const o=oracle(),readback=unitReadback('N07-diamond');o.verifyTexturedPixels(readback,'N07-diamond');
  assert.throws(()=>o.verifyTexturedPixels({...readback,width:32,height:32,bytes:new Uint8Array(4096)},'N07-diamond'),/TEXTURED_NATIVE_METADATA_INVALID/);
});
test('ORACLE UNIT stale nontransparent reset fails exhaustive clear assertion',()=>{
  const o=oracle(),readback={...unitReadback('N10-replay02'),width:48,height:40,bytes:new Uint8Array(4*48*40)};
  o.verifyTransparentReset(readback,'N10-reset',48,40);readback.bytes.set([255,0,0,255],0);
  assert.throws(()=>o.verifyTransparentReset(readback,'N10-reset',48,40),cause=>cause instanceof o.TexturedPixelAssertion&&cause.assertion==='N10-reset');
});
test('ORACLE UNIT all fixed sample records admit their independent nearest integer channel representatives',()=>{
  const o=oracle();for(const value of CASES)assert.equal(o.verifyTexturedPixels(unitReadback(value.id),value.id).checks.length,value.samples.length);
});
test('ORACLE UNIT malformed byte/schema input remains distinct from pixel counterexample',()=>{
  const o=oracle(),raw=unitReadback('N02-interpolation');
  for(const patch of [{format:'bgra8unorm'},{alphaMode:'opaque'},{colorSpace:'display-p3'},{frameId:0},{serial:0},{bytes:raw.bytes.slice(1)}])
    assert.throws(()=>o.verifyTexturedPixels({...raw,...patch},'N02-interpolation'),/TEXTURED_NATIVE_METADATA_INVALID/);
  const bad=Array.from(raw.bytes);bad[0]=NaN;assert.throws(()=>o.verifyTexturedPixels({...raw,bytes:bad},'N02-interpolation'),/TEXTURED_NATIVE_BYTES_INVALID/);
  assert.throws(()=>o.verifyTexturedPixels(raw,'N02-interpolation','missing'),/TEXTURED_NATIVE_ASSERTION_UNKNOWN/);
});
