// SPDX-License-Identifier: Apache-2.0
// Integration with the pinned native provider, not an independent font/ink oracle.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {createEngine,CancellationController,copyImageData2DPixels} from '@egret/engine';
import {createParagraphCache} from '@egret/engine/paragraph';import {createCanvasKitParagraphProvider} from '@egret/engine/web/paragraph';import {host} from './helpers.mjs';
test('actual native geometry shares final glyph placement, authored ranges and unchanged raster output',async t=>{
 const vendor=new URL('../examples/paragraph-panel/vendor/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',vendor),'utf8'));
 const temporaryRoot=fs.realpathSync(os.tmpdir()),temporary=fs.mkdtempSync(path.join(temporaryRoot,'egret-geometry-native-'));
 const cjs=path.join(temporary,'native.cjs');fs.copyFileSync(new URL(manifest.runtime.glue,vendor),cjs);
 const ck=await createRequire(import.meta.url)(cjs)({locateFile:()=>fileURLToPath(new URL(manifest.runtime.wasm,vendor))});
 const provider=createCanvasKitParagraphProvider({canvasKit:ck,buildIdentity:manifest.runtime.buildIdentity,fonts:manifest.fonts.map(row=>({family:row.family,identity:row.sha256,data:new Uint8Array(fs.readFileSync(new URL(row.path,vendor)))}))});
 const engine=await createEngine({host:host().adapter}),cache=createParagraphCache(engine.assets,{provider});
 const make=changes=>({text:'ABC',width:95,fontFamilies:manifest.fonts.map(f=>f.family),fontSize:20,locale:'und',direction:'ltr',fillColor:0xffffff,density:1,...changes});
 try{
  assert.equal(provider.capabilities.textGeometry,true);
  for(const text of ['ABC','Cafe\u0301 fi ffi','مرحبا 123 abc tail','abc \u202Bمرحبا 123     \u202C xyz','中文段落自然换行','A\r\nB\rC','\n\n','A\n','\u202B\u202C','a\u200Db \u200C c'])for(const direction of ['ltr','rtl']){
   await t.test(JSON.stringify({text,direction}),async()=>{
    const input=make({text,direction}),a=await provider.prepare(input,{signal:new CancellationController().signal}),b=await provider.prepare({...input,textGeometry:true},{signal:new CancellationController().signal});
    assert.deepEqual(a.metrics,b.metrics);assert.deepEqual(a.image&&copyImageData2DPixels(a.image),b.image&&copyImageData2DPixels(b.image));assert.equal(a.offsetX,b.offsetX);assert.equal(a.offsetY,b.offsetY);
    const prepared=await cache.acquire({...input,textGeometry:true});
    try{const g=prepared.geometry;assert.equal(g.text,text);assert.equal(g.lines.length,b.metrics.lines.length);assert.deepEqual(g.clusters,b.geometry.clusters);
     for(const c of g.clusters){assert.ok(c.end>c.start);assert.ok(!/[\r\n]/.test(text.slice(c.start,c.end)));
      const before=g.getCaret(c.start,'downstream'),after=g.getCaret(c.end,'upstream');assert.equal(before.offset,c.start);assert.equal(after.offset,c.end);assert.equal(before.x,c.direction==='rtl'?c.right:c.left);assert.equal(after.x,c.direction==='rtl'?c.left:c.right);
      if(c.right>c.left){const y=(g.lines[c.lineIndex].top+g.lines[c.lineIndex].bottom)/2;const hit=g.hitTest(c.left+(c.right-c.left)*.2,y);assert.ok(hit.offset===c.start||hit.offset===c.end);assert.equal(hit.lineIndex,c.lineIndex);}
     }
     for(const offset of Array.from({length:text.length+1},(_,i)=>i)){const pos=g.getCaret(offset);if(pos){assert.ok(!(text.charCodeAt(pos.offset)>=0xdc00&&text.charCodeAt(pos.offset)<=0xdfff));assert.ok(!(text[pos.offset-1]==='\r'&&text[pos.offset]==='\n'));}}
    }finally{prepared.lease.release();}
   });
  }
  await t.test('alignment, density and source-hidden ellipsis geometry',async()=>{
   for(const textAlign of ['left','center','right','start','end','justify'])for(const direction of ['ltr','rtl']){
    const a=await cache.acquire(make({text:'AB CD EF GH',width:70,textAlign,direction,density:1,textGeometry:true}));const b=await cache.acquire(make({text:'AB CD EF GH',width:70,textAlign,direction,density:2,textGeometry:true}));
    try{assert.deepEqual(a.geometry.lines,b.geometry.lines);assert.deepEqual(a.geometry.clusters,b.geometry.clusters);}finally{a.lease.release();b.lease.release();}
   }
   for(const text of ['A\nB','A\r\nB','\nB','AB CD EF GH IJ']){
    const p=await cache.acquire(make({text,maxLines:1,textGeometry:true,width:60}));try{assert.equal(p.metrics.truncated,true);assert.ok(p.geometry.clusters.every(c=>c.end<=p.geometry.lines[0].end));assert.equal(p.geometry.getSelectionRects(p.geometry.lines[0].end,text.length).length,0);const end=p.geometry.getCaret(text.length);assert.ok(end.offset<=p.geometry.lines[0].end);}finally{p.lease.release();}
   }
  });
  await t.test('unresolved emoji remains a truthful refusal',async()=>{await assert.rejects(cache.acquire(make({text:'\ud83e\uddd1\u200d\ud83d\ude80',textGeometry:true})),error=>error.code==='ASSET_LOAD_FAILED'&&error.cause?.code==='PARAGRAPH_GLYPH_UNRESOLVED');});
 }finally{cache.dispose();await engine.dispose();provider.dispose();assert.equal(path.dirname(temporary),temporaryRoot);assert.ok(path.basename(temporary).startsWith('egret-geometry-native-'));fs.rmSync(temporary,{recursive:true});}
});
