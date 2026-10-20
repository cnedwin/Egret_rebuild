// SPDX-License-Identifier: Apache-2.0
// Synthetic verifier units only; no Engine/browser/native-scene acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparePreparedFrame, FRAME_CASES, REFERENCE_ENVIRONMENT } from '../tools/prepared-resource-groups/oracle.mjs';

const referenceRoot = new URL('../tools/resource-scene/reference/', import.meta.url);
const references = { left: new Uint8Array(readFileSync(new URL('left.rgba', referenceRoot))),
  right: new Uint8Array(readFileSync(new URL('right.rgba', referenceRoot))) };
const R=[255,0,0,255],G=[0,255,0,255],B=[0,0,255,255],Y=[255,255,0,255];
const W=[255,255,255,255],K=[0,0,0,255],C=[64,64,64,255],D=[32,32,32,255],S=[255,192,128,255];
function put(bytes,x,y,value){bytes.set(value,(y*192+x)*4);}
function get(bytes,x,y){return bytes.subarray((y*192+x)*4,(y*192+x)*4+4);}
// This hand-authored unit painter does not read FRAME_CASES or oracle point output.
function synthetic(profile, frame='summer-right-pose1'){
  const raw=new Uint8Array(98304), selected=frame==='classic-left-pose0'?'left':'right';
  const pose1=frame.endsWith('pose1'), absent=frame==='removed-left-right-pose1';
  const left=frame.startsWith('summer')?[B,Y]:frame.startsWith('mix')?[R,Y]:[R,G];
  for(let i=3;i<raw.length;i+=4)raw[i]=255;
  for(const [offset,colors] of [[0,absent?[C,C]:left],[80,[R,G]]])for(const [ys,color] of [[[69,72,75],colors[0]],[[81,84,87],colors[1]]])
    for(const y of ys)for(const x of [50,56,62])put(raw,x+offset,y,color);
  for(const [x,y,color] of [[10,10,R],[22,10,G],[35,11,W],[43,11,K],[51,11,W],
    [56,54,absent?C:S],[136,54,S],[45,87,absent?C:pose1?(selected==='left'?W:C):D],
    [125,87,pose1?(selected==='right'?W:C):D],[30,50,absent?C:selected==='left'?W:C],
    [110,50,selected==='right'?W:C],[96,64,profile==='canvas-2d'?K:R],[32,24,profile==='canvas-2d'?K:B]])put(raw,x,y,color);
  const ref=references[selected];
  for(let sy=4;sy<20;sy++)for(let sx=4;sx<68;sx++){
    const a=ref[(sy*128+sx)*4+3],sceneY=sy+4;
    put(raw,sx+68,sceneY,[a,a,profile==='webgpu-scene-textured'&&sceneY>=16?255:a,255]);
  }
  return raw;
}
const run=(rgba,profile='canvas-2d',frame='summer-right-pose1',control='ordinary',extra={})=>comparePreparedFrame({
  rgba,profile,frame,control,references,environment:REFERENCE_ENVIRONMENT,...extra });
const isCode=code=>error=>error.code===code;

test('unit literal domains accept only the seven authored frame states in both profiles',()=>{
  assert.deepEqual(Object.keys(FRAME_CASES),['classic-left-pose0','classic-right-pose0','classic-right-before-boundary','classic-right-pose1','summer-right-pose1','mix-right-pose1','removed-left-right-pose1']);
  for(const profile of ['canvas-2d','webgpu-scene-textured'])for(const frame of Object.keys(FRAME_CASES)){
    const result=run(synthetic(profile,frame),profile,frame);
    assert.equal(result.status,'ORDINARY_DOMAIN_PASS');assert.equal(result.pointCount,49);
    assert.equal(result.glyph.pixels,1024);assert.equal(result.glyph.channels,4096);
    assert.equal(result.ordinaryAccepted,true);assert.equal(result.nativeAcceptance,'OPEN');
  }
});
test('unit animation boundary distinguishes old dark leg from selected pose1 gap',()=>{
  const bytes=synthetic('canvas-2d','classic-right-before-boundary');
  assert.deepEqual(Array.from(get(bytes,125,87)),D);
  assert.throws(()=>run(bytes,'canvas-2d','classic-right-pose1'),isCode('P03_ORACLE_POINT_MISMATCH'));
});
test('unit removed left requires gray card at both layers head leg and surround',()=>{
  const raw=synthetic('canvas-2d','removed-left-right-pose1');
  for(const [x,y] of [[50,69],[56,84],[56,54],[45,87],[30,50]])assert.deepEqual(Array.from(get(raw,x,y)),C);
  put(raw,56,72,K);assert.throws(()=>run(raw,'canvas-2d','removed-left-right-pose1'),isCode('P03_ORACLE_POINT_MISMATCH'));
});
for(const profile of ['canvas-2d','webgpu-scene-textured'])for(const [control,ys,color] of [
  ['manual-old-A-outer',[69,72,75],R],['manual-old-B-trim',[81,84,87],G]]){
  test('unit exact assigned nine-point control '+profile+'/'+control,()=>{
    const raw=synthetic(profile);for(const y of ys)for(const x of [50,56,62])put(raw,x,y,color);
    const result=run(raw,profile,'summer-right-pose1',control);
    assert.equal(result.status,'ASSIGNED_CONTROL_DETECTED');assert.equal(result.pointMismatches.length,9);
    assert.equal(result.ordinaryAccepted,false);assert.equal(result.nativeAcceptance,'OPEN');
    assert.throws(()=>run(raw,profile),isCode('P03_ORACLE_POINT_MISMATCH'));
    put(raw,136,54,K);assert.throws(()=>run(raw,profile,'summer-right-pose1',control),isCode('P03_ORACLE_CONTROL_MISMATCH'));
  });
}
test('unit unexposed eight-point wrong-color and extra-layer controls refuse',()=>{
  assert.throws(()=>run(synthetic('canvas-2d'),'canvas-2d','summer-right-pose1','manual-old-A-outer'),isCode('P03_ORACLE_CONTROL_MISMATCH'));
  const raw=synthetic('canvas-2d');for(const y of [69,72,75])for(const x of [50,56,62])put(raw,x,y,R);
  put(raw,50,69,B);assert.throws(()=>run(raw,'canvas-2d','summer-right-pose1','manual-old-A-outer'),isCode('P03_ORACLE_CONTROL_MISMATCH'));
  put(raw,50,69,R);put(raw,56,84,G);assert.throws(()=>run(raw,'canvas-2d','summer-right-pose1','manual-old-A-outer'),isCode('P03_ORACLE_CONTROL_MISMATCH'));
});
test('unit partial-alpha RGB allows one byte while alpha opaque and larger deltas refuse',()=>{
  let partial,opaque;
  for(let y=4;y<20;y++)for(let x=4;x<68;x++){
    const rightAlpha=references.right[(y*128+x)*4+3],leftAlpha=references.left[(y*128+x)*4+3];
    if(rightAlpha>0&&rightAlpha<255&&partial===undefined)partial=[x+68,y+4];
    if(leftAlpha===255&&opaque===undefined)opaque=[x+68,y+4];
  }
  assert.ok(partial);assert.ok(opaque);
  const raw=synthetic('canvas-2d'),at=(partial[1]*192+partial[0])*4,base=raw[at];
  raw[at]=base===255?254:base+1;assert.equal(run(raw).status,'ORDINARY_DOMAIN_PASS');
  raw[at]=base<=253?base+2:base-2;assert.throws(()=>run(raw),isCode('P03_ORACLE_GLYPH_MISMATCH'));
  const alpha=synthetic('canvas-2d');alpha[at+3]=254;assert.throws(()=>run(alpha),isCode('P03_ORACLE_GLYPH_MISMATCH'));
  const solid=synthetic('canvas-2d','classic-left-pose0');solid[(opaque[1]*192+opaque[0])*4]=254;
  assert.throws(()=>run(solid,'canvas-2d','classic-left-pose0'),isCode('P03_ORACLE_GLYPH_MISMATCH'));
});
test('unit reference identity byte domain environment and closed names refuse',()=>{
  const raw=synthetic('canvas-2d'),wrong=new Uint8Array(references.left);wrong[0]^=1;
  assert.throws(()=>run(raw,'canvas-2d','summer-right-pose1','ordinary',{references:{left:wrong,right:references.right}}),isCode('P03_ORACLE_REFERENCE_IDENTITY'));
  for(const size of [98303,98305])assert.throws(()=>run(new Uint8Array(size)),isCode('P03_ORACLE_RGBA_INVALID'));
  for(const [profile,frame,control] of [['other','summer-right-pose1','ordinary'],['canvas-2d','other','ordinary'],['canvas-2d','classic-left-pose0','manual-old-A-outer'],['canvas-2d','summer-right-pose1','other']])assert.throws(()=>run(raw,profile,frame,control),isCode('P03_ORACLE_INPUT_INVALID'));
  assert.throws(()=>run(raw,'canvas-2d','summer-right-pose1','ordinary',{environment:{...REFERENCE_ENVIRONMENT,browserVersion:'155.other'}}),isCode('P03_ORACLE_REFERENCE_ENVIRONMENT'));
});

// The original reference environment and RGBA remain historical; this verifies only the two reviewed exact versions.
test('M15 font patch accepts both exact reviewed versions with original references',()=>{
  assert.equal(REFERENCE_ENVIRONMENT.browserVersion,'155.0.4283.45');
  for(const browserVersion of ['155.0.4283.45','155.0.4283.62'])for(const profile of ['canvas-2d','webgpu-scene-textured']){
    const result=run(synthetic(profile),profile,'summer-right-pose1','ordinary',{
      environment:{...REFERENCE_ENVIRONMENT,browserVersion}});
    assert.equal(result.status,'ORDINARY_DOMAIN_PASS');assert.equal(result.glyph.changedChannels,0);
    assert.equal(result.nativeAcceptance,'OPEN');
  }
});
test('M15 font patch refuses unreviewed versions other environments and altered references',()=>{
  const raw=synthetic('canvas-2d'),environment={...REFERENCE_ENVIRONMENT,browserVersion:'155.0.4283.62'};
  const compare=extra=>run(raw,'canvas-2d','summer-right-pose1','ordinary',{environment,...extra});
  for(const browserVersion of ['155.0.4283.61','155.0.4283.63','155.0.4283.620','155.0.4283.62 ','156.0.0.0',null]){
    assert.throws(()=>compare({environment:{...environment,browserVersion}}),isCode('P03_ORACLE_REFERENCE_ENVIRONMENT'));
  }
  for(const [key,value] of Object.entries({browser:'Chromium',playwrightVersion:'1.62.2',platform:'linux',arch:'arm64',release:'10.0.26301',browserLanguage:'en-US',extraLaunchFlags:['--disable-gpu']})){
    assert.throws(()=>compare({environment:{...environment,[key]:value}}),isCode('P03_ORACLE_REFERENCE_ENVIRONMENT'));
  }
  const missing={...environment};delete missing.arch;
  for(const other of [missing,{...environment,unexpected:true}])assert.throws(()=>compare({environment:other}),isCode('P03_ORACLE_REFERENCE_ENVIRONMENT'));
  for(const side of ['left','right']){
    const wrong=new Uint8Array(references[side]);wrong[0]^=1;
    assert.throws(()=>compare({references:{...references,[side]:wrong}}),isCode('P03_ORACLE_REFERENCE_IDENTITY'));
  }
  assert.equal(compare({}).status,'ORDINARY_DOMAIN_PASS');
});
