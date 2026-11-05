// SPDX-License-Identifier: Apache-2.0
// Exact native/font integration and explicit style references, not an independent font oracle.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {createEngine,CancellationController,copyImageData2DPixels} from '@egret/engine';
import {createParagraph,createParagraphCache} from '@egret/engine/paragraph';import {createCanvasKitParagraphProvider} from '@egret/engine/web/paragraph';import {createUiRoot} from '@egret/engine/ui';import {host} from './helpers.mjs';
const vendor=new URL('../examples/paragraph-panel/vendor/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',vendor),'utf8'));
const temporaryRoot=fs.realpathSync(os.tmpdir()),temporary=fs.mkdtempSync(path.join(temporaryRoot,'egret-styles-native-'));
const cjs=path.join(temporary,'native.cjs');fs.copyFileSync(new URL(manifest.runtime.glue,vendor),cjs);
const ck=await createRequire(import.meta.url)(cjs)({locateFile:()=>fileURLToPath(new URL(manifest.runtime.wasm,vendor))});
const fonts=manifest.fonts.map(row=>({family:row.family,identity:row.sha256,data:new Uint8Array(fs.readFileSync(new URL(row.path,vendor)))}));
const provider=createCanvasKitParagraphProvider({canvasKit:ck,buildIdentity:manifest.runtime.buildIdentity,fonts});
const fm=ck.TypefaceFontProvider.Make();for(const row of fonts)fm.registerFont(row.data,row.family);
test.after(()=>{provider.dispose();fm.delete();assert.equal(path.dirname(temporary),temporaryRoot);assert.ok(path.basename(temporary).startsWith('egret-styles-native-'));fs.rmSync(temporary,{recursive:true});});
const request=changes=>({text:'office a\u0301 中文',width:200,fontFamilies:fonts.map(f=>f.family),fontSize:24,locale:'und',direction:'ltr',fillColor:0xffffff,density:1,...changes});
const prepare=input=>provider.prepare(request(input),{signal:new CancellationController().signal});
const pixels=r=>r.image?copyImageData2DPixels(r.image):new Uint8Array();
const color=n=>ck.Color4f((n>>>16)/255,((n>>>8)&255)/255,(n&255)/255,1);
function direct(input,runs=[]){
 const r=request(input),base={fontFamilies:r.fontFamilies,fontSize:r.fontSize,color:color(r.fillColor),locale:r.locale};
 const b=ck.ParagraphBuilder.MakeFromFontProvider(new ck.ParagraphStyle({textStyle:base,applyRoundingHack:false,textDirection:r.direction==='rtl'?ck.TextDirection.RTL:ck.TextDirection.LTR,textAlign:ck.TextAlign.Left,...(r.maxLines===undefined?{}:{maxLines:r.maxLines,ellipsis:'…'})}),fm);
 let cursor=0;for(const row of runs){b.addText(r.text.slice(cursor,row.start));b.pushStyle({...base,...(row.fontSize===undefined?{}:{fontSize:row.fontSize}),...(row.fontFamilies===undefined?{}:{fontFamilies:row.fontFamilies}),...(row.fillColor===undefined?{}:{color:color(row.fillColor)})});b.addText(r.text.slice(row.start,row.end));b.pop();cursor=row.end;}b.addText(r.text.slice(cursor));const p=b.build();b.delete();p.layout(r.width);return p;
}
function glyphs(p){const rows=p.getShapedLines();try{return rows.map(l=>l.runs.flatMap(r=>Array.from(r.glyphs,(id,i)=>({id,offset:r.offsets[i],x:r.positions[i*2],y:r.positions[i*2+1],size:r.size,scale:r.scaleX}))));}finally{for(const l of rows)for(const r of l.runs)r.typeface.delete();}}
function referencePixels(p,r,input){if(!r.image)return new Uint8Array();const s=ck.MakeSurface(r.image.width,r.image.height);try{const c=s.getCanvas();c.clear(ck.TRANSPARENT);c.scale(input.density??1,input.density??1);c.translate(-r.offsetX,-r.offsetY);c.drawParagraph(p,0,0);s.flush();return Uint8Array.from(c.readPixels(0,0,{width:r.image.width,height:r.image.height,colorType:ck.ColorType.RGBA_8888,alphaType:ck.AlphaType.Unpremul,colorSpace:ck.ColorSpace.SRGB}));}finally{s.dispose();}}
test('actual paint-only ranges use the leading shaped source, preserving ffi and combining marks',async()=>{
 assert.equal(provider.capabilities.styledRuns,true);
 for(const direction of ['ltr','rtl'])for(const width of [75,260]){
  const input={text:'office a\u0301',direction,width,textGeometry:true};const plain=await prepare(input);
  for(const run of [{start:2,end:3,fillColor:0xff0000},{start:8,end:9,fillColor:0xff0000}]){const out=await prepare({...input,runs:[run]});assert.deepEqual(out.metrics,plain.metrics);assert.deepEqual(out.geometry,plain.geometry);assert.deepEqual(pixels(out),pixels(plain));}
  const authored=[{start:1,end:2,fillColor:0xff0000}],resolved=[{start:1,end:4,fillColor:0xff0000}];const out=await prepare({...input,runs:authored}),a=direct(input),b=direct(input,resolved);
  try{assert.deepEqual(glyphs(a),glyphs(b));assert.deepEqual(a.getLineMetrics(),b.getLineMetrics());assert.deepEqual(pixels(out),referencePixels(b,out,input));assert.notDeepEqual(pixels(out),pixels(plain));assert.deepEqual(out.geometry,plain.geometry);}finally{a.delete();b.delete();}
 }
 const expected=direct({text:'office',width:260});try{assert.deepEqual(glyphs(expected)[0].map(g=>[g.id,g.offset]),[[82,0],[1654,1],[70,4],[72,5]]);}finally{expected.delete();}
});
test('absolute UTF8 glyph starts preserve multibyte, bidi, soft-wrap spaces and paragraph context',async()=>{
 const fixtures=[{text:'中文 ABC 中文',runs:[{start:0,end:1,fillColor:0xff0000}]},{text:'مرحبا abc مرحبا',runs:[{start:0,end:2,fillColor:0xff0000}]},{text:'abc \u202Bمرحبا 123     \u202C xyz',runs:[{start:0,end:3,fillColor:0xff0000}]},{text:'ABC    DEF   GHI',runs:[{start:0,end:3,fillColor:0xff0000}]}];
 for(const f of fixtures)for(const direction of ['ltr','rtl'])for(const width of [90,280]){
  const input={...f,direction,width,textGeometry:true},plain=await prepare({...input,runs:undefined}),out=await prepare(input),a=direct(input),b=direct(input,f.runs);
  try{assert.deepEqual(glyphs(a),glyphs(b));assert.deepEqual(a.getLineMetrics(),b.getLineMetrics());assert.deepEqual(out.metrics,plain.metrics);assert.deepEqual(out.geometry,plain.geometry);assert.deepEqual(pixels(out),referencePixels(b,out,input));}finally{a.delete();b.delete();}
 }
});
test('font size and registered fallback changes share the actual final layout and UI height',async t=>{
 const input={text:'A larger 中文 مرحبا tail',width:150,runs:[{start:2,end:8,fontSize:40,fontFamilies:['Noto Sans'],fillColor:0x00ff00}],textGeometry:true};
 const out=await prepare(input),native=direct(input,input.runs);try{assert.deepEqual(pixels(out),referencePixels(native,out,input));assert.equal(out.metrics.height,native.getHeight());assert.deepEqual(out.metrics.lines.map(l=>[l.width,l.height]),native.getLineMetrics().map(l=>[l.width,l.height]));}finally{native.delete();}
 const full=await prepare({text:'ABC',runs:[{start:0,end:3,fontSize:40,fontFamilies:['Noto Sans'],fillColor:0xff0000}]}),uniform=await prepare({text:'ABC',fontSize:40,fontFamilies:['Noto Sans'],fillColor:0xff0000});assert.deepEqual(full.metrics,uniform.metrics);assert.deepEqual(pixels(full),pixels(uniform));
 const engine=await createEngine({host:host().adapter});t.after(()=>engine.dispose());const scope=engine.createScope(),cache=createParagraphCache(engine.assets,{provider});
 const tree=large=>({id:'column',kind:'column',explicitWidth:150,children:[{id:'text',kind:'leaf',content:{revision:large?2:1,async prepare(ctx){const n=createParagraph(engine,ctx.scope,cache);n.setRequest(request({...input,runs:large?input.runs:undefined,width:ctx.width}));const metrics=await n.prepare();return {content:n,measuredHeight:metrics.height};}}},{id:'footer',kind:'leaf',explicitHeight:8}]});
 const ui=createUiRoot({engine,scope,id:'styled-ui',viewport:{width:150,height:400},density:1,tree:tree(false)});ui.commit(await ui.prepare());const old=ui.snapshot().boxes.find(b=>b.id==='footer').y;ui.setTree(tree(true));const pending=await ui.prepare();assert.equal(ui.snapshot().boxes.find(b=>b.id==='footer').y,old);ui.commit(pending);assert.equal(ui.snapshot().boxes.find(b=>b.id==='footer').y,out.metrics.height);assert.ok(out.metrics.height>old);
});
test('styled CRLF and native ellipsis retain final source geometry and explicit synthetic color selection',async()=>{
 const cr=await prepare({text:'A\r\nB',runs:[{start:3,end:4,fillColor:0xff0000}],textGeometry:true}),lf=await prepare({text:'A\nB',runs:[{start:2,end:3,fillColor:0xff0000}],textGeometry:true});assert.deepEqual(pixels(cr),pixels(lf));assert.deepEqual(cr.metrics.lines.map(l=>[l.start,l.end]),[[0,1],[3,4]]);
 for(const direction of ['ltr','rtl'])for(const text of ['office office office','A\nB','\nB','中文中文中文中文']){
  const input={text,direction,width:75,maxLines:1,textGeometry:true,runs:[{start:0,end:text.length,fillColor:0xff0000}]};const a=await prepare(input),b=await prepare({...input,runs:undefined,fillColor:0xff0000});assert.equal(a.metrics.truncated,true);assert.deepEqual(a.metrics,b.metrics);assert.deepEqual(a.geometry,b.geometry);assert.deepEqual(pixels(a),pixels(b));assert.ok(a.geometry.clusters.every(c=>c.end<=a.geometry.lines.at(-1).end));
 }
 await assert.rejects(prepare({text:'ABC',width:.25,maxLines:1,runs:[{start:0,end:1,fillColor:0xff0000}]}),e=>e.code==='PARAGRAPH_ELLIPSIS_DOES_NOT_FIT');await prepare({text:'ABC',runs:[{start:0,end:1,fillColor:0xff0000}]});
});
test('unregistered styled fonts, discretionary synthetic hyphens and old native ports refuse explicitly',async()=>{
 await assert.rejects(prepare({text:'ABC',runs:[{start:0,end:1,fontFamilies:['Missing']}]}),e=>e.code==='PARAGRAPH_FONT_NOT_REGISTERED');
 await assert.rejects(prepare({text:'ab\u00adcd',runs:[{start:0,end:1,fillColor:1}]}),e=>e.code==='PARAGRAPH_FEATURE_UNSUPPORTED');
 const module=Object.create(ck);module.ParagraphBuilder={MakeFromFontProvider:ck.ParagraphBuilder.MakeFromFontProvider};const old=createCanvasKitParagraphProvider({canvasKit:module,fonts:fonts.slice(0,2)});try{assert.equal(old.capabilities.styledRuns,false);await old.prepare(request({text:'ABC',fontFamilies:fonts.slice(0,2).map(f=>f.family)}),{signal:new CancellationController().signal});await assert.rejects(old.prepare(request({text:'ABC',fontFamilies:fonts.slice(0,2).map(f=>f.family),runs:[{start:0,end:1,fillColor:1}]}),{signal:new CancellationController().signal}),e=>e.code==='PARAGRAPH_FEATURE_UNSUPPORTED');}finally{old.dispose();}
});

test('partial styled ellipsis uses the native resolved run while glyph placement and geometry remain unchanged',async()=>{
 for(const direction of ['ltr','rtl']){
  const input={text:'office office office',width:75,maxLines:1,direction,textGeometry:true},run={start:1,end:2,fillColor:0xff0000},resolved={start:1,end:4,fillColor:0xff0000};
  const plain=await prepare(input),out=await prepare({...input,runs:[run]}),a=direct(input),b=direct(input,[resolved]);
  try{assert.deepEqual(glyphs(a),glyphs(b));assert.deepEqual(a.getLineMetrics(),b.getLineMetrics());assert.deepEqual(out.metrics,plain.metrics);assert.deepEqual(out.geometry,plain.geometry);assert.deepEqual(pixels(out),referencePixels(b,out,input));}finally{a.delete();b.delete();}
 }
});

test('font-only and uniformly colored runs retain native discretionary hyphen support without source-paint inference',async()=>{
 const text='ab\u00adcd efgh',a=await prepare({text,width:40,runs:[{start:0,end:text.length,fontSize:30}]}),b=await prepare({text,width:40,fontSize:30});assert.deepEqual(a.metrics,b.metrics);assert.deepEqual(pixels(a),pixels(b));
 const c=await prepare({text,width:40,runs:[{start:0,end:text.length,fillColor:0xff0000}]}),d=await prepare({text,width:40,fillColor:0xff0000});assert.deepEqual(c.metrics,d.metrics);assert.deepEqual(pixels(c),pixels(d));
});
