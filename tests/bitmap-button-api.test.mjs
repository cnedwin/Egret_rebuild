// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '@egret/engine';
import { controlledBrowser } from './mouse-input.test.mjs';

export { sdk };
export const UP=Object.freeze({x:0,y:0,width:8,height:6});
export const PRESSED=Object.freeze({x:8,y:0,width:8,height:6});
export const DISABLED=Object.freeze({x:16,y:0,width:8,height:6});
export const AREA=Object.freeze({x:0,y:0,width:8,height:6});
export const FRAME=Object.freeze({width:100,height:80});
// Observe actual public accessors before any assigned ordinary shadow case.
export const original={
  apply:Reflect.apply,
  lease:Object.getOwnPropertyDescriptor(sdk.Bitmap.prototype,'textureLease'),
  crop:Object.getOwnPropertyDescriptor(sdk.Bitmap.prototype,'sourceRect'),
  hit:Object.getOwnPropertyDescriptor(sdk.DisplayObject.prototype,'hitArea'),
  touch:Object.getOwnPropertyDescriptor(sdk.DisplayObject.prototype,'touchEnabled'),
  disposed:Object.getOwnPropertyDescriptor(sdk.DisplayObject.prototype,'isDisposed'),
  bitmapDispose:sdk.Bitmap.prototype.dispose,
};
export const readOriginal=(name,node)=>original.apply(original[name].get,node,[]);
export const writeOriginal=(name,node,value)=>original.apply(original[name].set,node,[value]);
export function caught(action){try{return{threw:false,value:action()};}catch(cause){return{threw:true,cause};}}
export function code(action,expected,cause,checkCause=false){const r=caught(action);assert.equal(r.threw,true,expected);assert.equal(r.cause?.code,expected);if(checkCause){assert.ok(Object.hasOwn(r.cause,'cause'));assert.equal(r.cause.cause,cause);}return r.cause;}
export function override(object,key,descriptor){const old=Object.getOwnPropertyDescriptor(object,key);Object.defineProperty(object,key,{configurable:true,...descriptor});return()=>{if(old)Object.defineProperty(object,key,old);else assert.equal(Reflect.deleteProperty(object,key),true);};}
function atlas(){const pixels=new Uint8Array(24*6*4);for(let y=0;y<6;y++)for(let x=0;x<24;x++){const p=(y*24+x)*4;const rgba=x<8?[255,0,0,255]:x<16?[0,0,255,255]:[128,128,128,255];pixels.set(rgba,p);}return sdk.createTexture(sdk.createImageData2D({width:24,height:6,pixels}));}

// Reuse only the existing ordinary WebIDL fixture, never its SDK loader or picker.
// The optional module is a namespace and is loaded after the genuine eager SDK.
export async function withScene(run,{beforeOptional}={}){
  const browser=controlledBrowser(),trace=[],timers=new Set(),renders=[],diagnostics=[];
  const counts={loads:0,disposals:0},restorers=[],buttons=[];
  let engine,resourceScope,scope,input,lease,texture,inputAPI,failure={threw:false};
  const host={surface:browser.canvas,start(){trace.push('start');},stop(){trace.push('stop');},async close(){trace.push('close');},renderFrame(frame){renders.push(frame);},setTimeout(callback,delayMs){const timer={callback,delayMs};timers.add(timer);return()=>timers.delete(timer);}};
  browser.install();
  try{
    await beforeOptional?.({sdk,restorers});
    inputAPI=await import('@egret/engine/web/input');
    engine=await sdk.createEngine({host,onDiagnostic:d=>diagnostics.push(d)});
    resourceScope=engine.createScope();scope=engine.createScope();
    const type=sdk.createAssetType('bitmap-button-fixture-atlas',sdk.isTexture);
    engine.assets.register(type,{async load(){counts.loads++;texture=atlas();return texture;},dispose(value){assert.equal(value,texture);counts.disposals++;value.dispose();}});
    lease=resourceScope.use(await engine.assets.acquire(sdk.createAssetRef(type,'original-three-colors'),{signal:resourceScope.signal}));
    assert.ok(engine instanceof sdk.Engine);assert.ok(scope instanceof sdk.Scope);assert.ok(lease instanceof sdk.AssetLease);assert.equal(lease.value,texture);
    input=inputAPI.createMouseInput({engine,scope,width:100,height:80});
    const options=(extra={})=>({engine,scope,input,textureLease:lease,skins:{up:UP,pressed:PRESSED,disabled:DISABLED},onActivate(){},...extra});
    const addButton=(extra={})=>{const button=inputAPI.createBitmapButton(options(extra));buttons.push(button);return button;};
    const attach=(button,x=12,y=12)=>{Object.assign(button.display,{x,y,anchorOffsetX:4,anchorOffsetY:3});engine.stage.addChild(button.display);return button;};
    const point=(x,y,value={})=>({clientX:10+x*2,clientY:20+y*2,...value});
    const down=(x=12,y=12,value={})=>browser.emit(browser.canvas,'pointerdown',point(x,y,value));
    const up=(x=12,y=12,value={})=>browser.emit(browser.window,'pointerup',point(x,y,value));
    await run({sdk,inputAPI,browser,engine,stage:engine.stage,scope,resourceScope,input,lease,texture,counts,trace,timers,renders,diagnostics,restorers,buttons,options,addButton,attach,down,up});
  }catch(cause){failure={threw:true,cause};}
  finally{
    const cleanup=[];
    for(const restore of restorers.reverse())try{restore();}catch(error){cleanup.push(error);}
    browser.hooks.add=undefined;browser.hooks.remove=undefined;browser.hooks.field=undefined;browser.hooks.style=undefined;browser.hooks.rect=undefined;
    try{scope?.dispose();resourceScope?.dispose();await engine?.dispose();}catch(error){cleanup.push(error);}
    try{if(engine){assert.equal(input?.state,'closed');assert.equal(scope.state,'closed');assert.equal(resourceScope.state,'closed');assert.equal(engine.stage.isDisposed,true);assert.equal(browser.active().length,0);assert.deepEqual(trace,['start','stop','close']);}if(texture){assert.equal(texture.isDisposed,true);assert.equal(counts.loads,1);assert.equal(counts.disposals,1);code(()=>lease.value,'ASSET_LEASE_RELEASED');}assert.equal(timers.size,0);}catch(error){cleanup.push(error);}
    browser.recover();browser.restore();
    if(cleanup.length)throw new AggregateError(failure.threw?[failure.cause,...cleanup]:cleanup,'Button fixture cleanup failed',{cause:failure.threw?failure.cause:cleanup[0]});
  }
  if(failure.threw)throw failure.cause;
}
async function baselineFirstAPI(){
  let namespace,saved,image;
  await withScene(f=>{
    namespace=f.inputAPI;
    const sheet=f.resourceScope.use(sdk.createSpriteSheet(f.lease,[{name:'up',...UP},{name:'pressed',...PRESSED},{name:'disabled',...DISABLED}]));
    const bitmap=f.resourceScope.use(sheet.createBitmap('up'));
    Object.assign(bitmap,{x:12,y:12,anchorOffsetX:4,anchorOffsetY:3,touchEnabled:true,hitArea:AREA});f.stage.addChild(bitmap);
    assert.ok(bitmap instanceof sdk.Bitmap);assert.equal(bitmap.textureLease,f.lease);assert.deepEqual(bitmap.sourceRect,UP);
    assert.deepEqual(bitmap.getBounds(),AREA);assert.deepEqual(f.stage.getBounds(),{x:8,y:9,width:8,height:6});assert.equal(f.stage.hitTest(12,12),bitmap);
    const route=[];for(const phase of ['begin','end','activate'])bitmap.on(f.input.events[phase],()=>route.push([phase,f.input.state]));
    f.down();f.up();assert.deepEqual(route,[['begin','pressed'],['end','idle'],['activate','idle']]);
    saved=f.engine.captureFrame(FRAME);assert.equal(saved.commands.length,1);assert.deepEqual(saved.commands[0].sourceRect,UP);assert.equal(Object.isFrozen(saved),true);
    image=f.texture.imageData;assert.equal(sdk.copyImageData2DPixels(image).length,24*6*4);
    f.engine.renderFrame(FRAME);assert.equal(f.renders.length,1);assert.deepEqual(f.diagnostics,[]);
  });
  // All genuine old operations AND complete fixture cleanup precede this assertion.
  assert.deepEqual(saved.commands[0].sourceRect,UP);assert.equal(sdk.copyImageData2DPixels(image)[0],255);
  assert.equal(typeof namespace.createBitmapButton,'function','BITMAP_BUTTON_REQUIRED');
  assert.deepEqual(Object.keys(namespace).sort(),['createBitmapButton','createMouseInput']);
  assert.equal(Object.hasOwn(sdk,'createBitmapButton'),false);
}
// Direct execution registers BB00; sibling files import only this public fixture.
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))test('BB00 genuine shipped baseline and cleanup before Button public API',baselineFirstAPI);
