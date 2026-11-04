// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile,Sprite} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createBrowserKeyboardInput} from '@egret/engine/web/keyboard';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';
const canvas=document.querySelector('#scene'),backend=new URL(location.href).searchParams.get('backend')??'webgpu';
if(!['webgpu','webgl2'].includes(backend))throw Error('FIXTURE_BACKEND');
const events=[],errors=[];let host,engine,scope,input,root,pixels,closed=false;
const frame={width:320,height:200,clearColor:0x172033,clearAlpha:1,outputAlpha:'opaque'};
export const inspect=()=>({ui:root.snapshot(),focus:root.list('list').getFocus(),keyboard:input.getSnapshot(),events:[...events],errors:[...errors]});
async function publish(){for(let i=0;i<8;i++){const token=await root.prepare();if(token.status==='pending')continue;const result=root.commit(token);if(result.kind!=='committed'&&result.kind!=='unchanged'||result.postCommitErrors.length)throw Error('FIXTURE_COMMIT');return result;}throw Error('FIXTURE_UNSTABLE');}
export async function draw(){const read=host.requestReadback();host.renderSharedFrame(engine.captureSharedFrame(frame));const result=await read;await host.whenIdle();pixels=new Uint8Array(result.bytes);return inspect();}
export function readback(){return Array.from(pixels);}
export async function navigate(key,align='center'){root.list('list').reveal(key,{align});const result=await publish();if(result.revision===root.snapshot().desiredRevision&&root.snapshot().rows.some(row=>row.key===key&&row.visible))root.list('list').focus(key,{visible:true});return draw();}
export async function close(){if(closed)return {closed:true};closed=true;document.querySelector('#jump').removeEventListener('click',jump);root.dispose();const keyboard=input.getSnapshot();scope.dispose();await host.whenIdle();await engine.dispose();return {closed:true,keyboard,errors:[...errors]};}
export const ready=(async()=>{
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true});engine=await createEngineForProfile({host,onDiagnostic:d=>errors.push(d.code)},'egret.shared-frame2d/1');scope=engine.createScope();input=createBrowserKeyboardInput({engine,scope});
 const source={revision:0,records:Array.from({length:50000},(_,i)=>({key:'k'+i,contentVersion:0,estimatedHeight:20,value:i})),bind(c){const content=c.scope.use(new Sprite()),height=c.index===40000?80:20,color=c.index===40000?0xcc4422:0x2266aa;const paint=focused=>{content.graphics.clear();content.graphics.beginFill(color).drawRect(0,0,c.width,height).endFill();if(focused)content.graphics.beginFill(0xffffff).drawRect(0,0,c.width,4).endFill();};paint(false);
 for(const kind of ['keyDown','keyUp','cancel','focusIn','focusOut'])content.on(input.events[kind],event=>{events.push({key:c.key,kind,reason:event.payload.reason,revision:root.snapshot().committedRevision,attached:content.parent!==null});if(kind==='focusIn'||kind==='focusOut')paint(kind==='focusIn');});return {content,measuredHeight:height};},unbind(){}};
 root=createUiRoot({engine,scope,id:'navigation',viewport:{width:200,height:120},origin:{x:20,y:20},density:1,tree:{id:'list',kind:'virtualList',source,explicitWidth:200,explicitHeight:120},keyboard:{input,idPrefix:'navigation'},limits:{overscan:0,residentCap:16}});await publish();return draw();
})();
function jump(){void ready.then(()=>navigate('k40000')).then(()=>{canvas.focus();document.querySelector('#status').textContent=JSON.stringify(inspect().focus);}).catch(error=>{document.querySelector('#status').textContent=String(error);});}
document.querySelector('#jump').addEventListener('click',jump);
