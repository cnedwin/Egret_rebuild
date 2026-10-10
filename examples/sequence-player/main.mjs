import {createEngine,createImageData2D,createTexture,createAssetType,createAssetRef,isTexture,Bitmap,createSequenceClip,SequencePlayer} from '@egret/engine';

const query=new URL(location.href).searchParams;
const backend=query.get('backend')==='webgpu'?'webgpu':'canvas';
const mode=query.get('mode')==='loop'?'loop':'once';
const status=document.querySelector('#status'),canvas=document.querySelector('#scene');
document.querySelector('#backend').value=backend;document.querySelector('#mode').value=mode;
for(const id of ['backend','mode'])document.querySelector(`#${id}`).addEventListener('change',event=>{
  const url=new URL(location.href);url.searchParams.set(id,event.target.value);location.href=url.href;
});
const options={width:192,height:112,clearColor:0x202020,clearAlpha:1};
let engine,bitmap,lease,player,renderHost,saved,retired=false,closed=false,loads=0;
function show(message){status.textContent=message;}
function guard(operation){try{operation();}catch(error){show(`${error.code??error.name}: ${error.message}`);}}
function select(seconds){
  const sample=player.applyAt(seconds);engine.renderFrame(options);
  show(`${backend} / ${mode}\n${JSON.stringify(sample,null,2)}\nAtlas loads / 图集加载: ${loads}`);
}
function saveGreen(){select(0.125);saved=engine.captureFrame(options);document.querySelector('#replay').disabled=false;}
function replay(){if(saved){renderHost.renderFrame(saved);show(`Saved green frame / 保存绿帧\n${retired?'Borrow retired / 借用已释放':'Borrow live / 借用存活'}`);}}
async function close(){
  if(closed)return;closed=true;
  // The caller owns cleanup; disposing a player never disposes its borrow.
  player?.dispose();bitmap?.dispose();lease?.release();await engine?.dispose();
  for(const button of document.querySelectorAll('button'))button.disabled=true;
  show('Closed / 已关闭');
}
try{
  const entry=backend==='webgpu'?await import('@egret/engine/webgpu'):await import('@egret/engine/web');
  renderHost=backend==='webgpu'?entry.createWebGPUHost({canvas}):entry.createCanvasHost({canvas});
  engine=await createEngine({host:renderHost});
  const pixels=new Uint8Array([
    255,0,0,255,255,0,0,255,0,255,0,255,0,0,255,255,0,0,255,255,0,0,255,255,
    255,0,0,255,255,0,0,255,0,255,0,255,0,0,0,255,0,0,0,255,0,0,0,255,
  ]);
  const image=createImageData2D({width:6,height:2,pixels}),texture=createTexture(image);
  const type=createAssetType('example-sequence-atlas',isTexture);
  engine.assets.register(type,{load:async()=>{loads++;return texture;},dispose:t=>t.dispose()});
  lease=await engine.assets.acquire(createAssetRef(type,'inline-atlas'));
  bitmap=engine.stage.addChild(new Bitmap(lease));Object.assign(bitmap,{x:16,y:16,scaleX:32,scaleY:32});
  const clip=createSequenceClip({atlasWidth:6,atlasHeight:2,frames:[
    {x:0,y:0,width:2,height:2,durationSeconds:0.125},
    {x:2,y:0,width:1,height:2,durationSeconds:0.25},
    {x:3,y:0,width:3,height:1,durationSeconds:0.125},
  ]});
  player=new SequencePlayer(bitmap,clip,mode);select(0);
  for(const button of document.querySelectorAll('[data-time]'))button.addEventListener('click',()=>guard(()=>select(Number(button.dataset.time))));
  document.querySelector('#save').addEventListener('click',()=>guard(saveGreen));
  document.querySelector('#replay').addEventListener('click',()=>guard(replay));
  document.querySelector('#retire').addEventListener('click',()=>guard(()=>{
    if(!saved)saveGreen();player.dispose();bitmap.dispose();lease.release();retired=true;
    for(const button of document.querySelectorAll('[data-time],#save,#retire'))button.disabled=true;
    replay();
  }));
  document.querySelector('#close').addEventListener('click',()=>{void close().catch(error=>show(error.message));});
  window.addEventListener('pagehide',()=>{void close().catch(()=>{});},{once:true});
}catch(error){await close();show(`Unavailable or failed / 不可用或失败: ${error.code??error.name}: ${error.message}`);}
