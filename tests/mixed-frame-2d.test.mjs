import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageData2D} from '../packages/contracts/dist/index.js';
import {copyFrame2D,FrameCopyError,FrameInputReadError} from '../packages/engine/dist/rendering/copyFrame2D.js';
import {GeometryPreparationError} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
let copyMixedFrame2D, MixedImageBudget, moduleFault;
try {
 ({copyMixedFrame2D}=await import('../packages/engine/dist/rendering/copyMixedFrame2D.js'));
 ({MixedImageBudget}=await import('../packages/engine/dist/rendering/imageFrameBudget.js'));
} catch(error) {moduleFault=error;}
const options={pixelRatio:1.5,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144};
const matrix=()=>({a:1,b:-0,c:0,d:1,tx:-0,ty:0});
const rect=(x=-0,y=-0,width=2,height=3)=>({x,y,width,height});
const clip=()=>({matrix:matrix(),rect:rect(0,0,1,1)});
const rectangle=()=>({kind:'rect',matrix:matrix(),rect:rect(),color:0x123456,alpha:0.5,clips:[clip()]});
const region=(x=-0,y=-0,width=1,height=1)=>({x,y,width,height});
const imageCommand=(imageIndex=-0,sourceRect=region())=>({kind:'image',matrix:matrix(),rect:rect(),alpha:1,clips:[],imageIndex,sourceRect});
const frame=(commands=[rectangle()],images)=>({frameId:1,width:10.25,height:8,clearColor:0x010203,clearAlpha:0.25,commands,...(images===undefined?{}:{images})});
const image=(width=1,height=1)=>createImageData2D({width,height,pixels:new Uint8Array(4*width*height)});
const copy=(input,overrides={})=>copyMixedFrame2D(input,{...options,...overrides});
const reason=expected=>error=>error instanceof FrameCopyError&&error.reason===expected;
const readFault=cause=>error=>error instanceof FrameInputReadError&&error.cause===cause;
function mixed(name,body){test(name,()=>{assert.equal(typeof copyMixedFrame2D,'function',`mixed copier module required: ${moduleFault}`);body();});}
function tracked(value,label,log){return new Proxy(value,{get(target,key,receiver){log.push(`${label}.${String(key)}`);return Reflect.get(target,key,receiver);}});}
function tracedRectangle(){
 const log=[];const c=rectangle();c.matrix=tracked(c.matrix,'matrix',log);c.rect=tracked(c.rect,'rect',log);
 c.clips[0].matrix=tracked(c.clips[0].matrix,'clip.matrix',log);c.clips[0].rect=tracked(c.clips[0].rect,'clip.rect',log);
 c.clips[0]=tracked(c.clips[0],'clip',log);c.clips=tracked(c.clips,'clips',log);
 const f=frame([tracked(c,'command',log)]);f.commands=tracked(f.commands,'commands',log);
 Object.defineProperty(f,'images',{get(){throw Error('rectangle images read');}});
 return {log,input:tracked(f,'frame',log),opts:tracked({...options},'options',log)};
}
const rectangleTrace=[
 'options.pixelRatio','options.maxBackingPixels','options.maxCommands','options.maxClipRectangles',
 'frame.frameId','frame.width','frame.height','frame.clearColor','frame.clearAlpha','frame.commands','commands.length','commands.0','command.kind',
 'command.matrix','matrix.a','matrix.b','matrix.c','matrix.d','matrix.tx','matrix.ty',
 'command.rect','rect.x','rect.y','rect.width','rect.height','command.color','command.alpha','command.clips','clips.length','clips.0',
 'clip.matrix','clip.matrix.a','clip.matrix.b','clip.matrix.c','clip.matrix.d','clip.matrix.tx','clip.matrix.ty','clip.rect','clip.rect.x','clip.rect.y','clip.rect.width','clip.rect.height',
];
const rectangleOutput={frame:{frameId:1,width:10.25,height:8,clearColor:0x010203,clearAlpha:0.25,commands:[{kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:2,height:3},color:0x123456,alpha:0.5,clips:[{matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:1,height:1}}]}]},width:16,height:12};
test('legacy literal option/header/rectangle/clip trace and output are pinned before extraction',()=>{
 const {log,input,opts}=tracedRectangle();assert.deepEqual(copyFrame2D(input,opts),rectangleOutput);assert.deepEqual(log,rectangleTrace);
});
test('legacy priority and array-check origins are pinned before extraction',()=>{
 const f=frame();Object.defineProperty(f,'commands',{get(){throw Error('commands late');}});f.width=0;
 assert.throws(()=>copyFrame2D(f,options),reason('invalid'));f.width=Number.MAX_VALUE;
 assert.throws(()=>copyFrame2D(f,options),reason('backing'));
 const p=Proxy.revocable([],{});p.revoke();
 assert.throws(()=>copyFrame2D(frame(p.proxy),options),e=>e instanceof TypeError&&!(e instanceof FrameInputReadError));
 const c=rectangle();c.clips=p.proxy;assert.throws(()=>copyFrame2D(frame([c]),options),e=>e instanceof TypeError&&!(e instanceof FrameInputReadError));
 const log=[];c.clips=tracked([clip()],'clips',log);assert.throws(()=>copyFrame2D(frame([c]),{...options,maxClipRectangles:0}),reason('budget'));assert.deepEqual(log,['clips.length']);
 const cause=new FrameCopyError('budget');Object.defineProperty(c,'matrix',{get(){throw cause;}});assert.throws(()=>copyFrame2D(frame([c]),options),readFault(cause));
});
mixed('mixed module is present',()=>assert.equal(typeof MixedImageBudget,'function'));
mixed('rectangle-only mixed copy equals literal old output and exact getter trace with zero images reads',()=>{
 const legacy=tracedRectangle(),modern=tracedRectangle();const out=copyMixedFrame2D(modern.input,modern.opts);
 assert.deepEqual(out,rectangleOutput);assert.deepEqual(out,copyFrame2D(legacy.input,legacy.opts));assert.deepEqual(modern.log,rectangleTrace);assert.deepEqual(legacy.log,rectangleTrace);
 for(const images of [null,{},[undefined]])assert.deepEqual(copy(frame([rectangle()],images)),rectangleOutput);
});
mixed('mixed order duplicate table indices and owned frozen descriptor snapshots retain authentic identities',()=>{
 const value=image();const c=imageCommand(1),f=frame([rectangle(),c,rectangle()],[value,value]);const out=copy(f);
 assert.deepEqual(out.frame.commands.map(c=>c.kind),['rect','image','rect']);assert.equal(out.frame.images[0],value);assert.equal(out.frame.images[1],value);assert.equal(out.frame.commands[1].imageIndex,1);
 for(const obj of [out.frame,out.frame.commands,out.frame.images,out.frame.commands[1],out.frame.commands[1].matrix,out.frame.commands[1].rect,out.frame.commands[1].clips,out.frame.commands[1].sourceRect,out.frame.commands[0].clips[0],out.frame.commands[0].clips[0].rect])assert.ok(Object.isFrozen(obj));
 c.matrix.a=9;c.rect.width=9;c.sourceRect.width=9;f.commands.length=0;f.images.length=0;assert.equal(out.frame.commands[1].matrix.a,1);assert.equal(out.frame.commands[1].rect.width,2);assert.equal(out.frame.commands[1].sourceRect.width,1);assert.equal(out.frame.images.length,2);
 const zero=copy(frame([imageCommand()],[value])).frame.commands[0];for(const x of [zero.imageIndex,zero.sourceRect.x,zero.sourceRect.y,zero.matrix.b,zero.rect.x])assert.ok(Object.is(x,0));
 assert.equal(copy(frame([imageCommand(0),imageCommand(1)],[value,value])).frame.commands.length,2);
});
mixed('command/table/clip proxies capture each length and index once and never iterators or unknown command fields',()=>{
 const log=[],value=image(),c=imageCommand();c.clips=tracked([clip()],'clips',log);const item=tracked(c,'item',log);
 const f=frame(tracked([rectangle(),item,rectangle()],'commands',log),tracked([value,value],'images',log));copy(f);
 for(const prefix of ['commands','images']){assert.equal(log.filter(x=>x===`${prefix}.length`).length,1);for(let i=0;i<(prefix==='commands'?3:2);i++)assert.equal(log.filter(x=>x===`${prefix}.${i}`).length,1);}
 assert.equal(log.filter(x=>x==='clips.length').length,1);assert.equal(log.filter(x=>x==='clips.0').length,1);
 assert.equal(log.some(x=>x.includes('Symbol')),false);assert.deepEqual(log.filter(x=>x.startsWith('item.')),['item.kind','item.matrix','item.rect','item.alpha','item.clips','item.imageIndex','item.sourceRect']);
});
mixed('table missing null nonarray holes undefined forged unreferenced and proxied values are invalid',()=>{
 const value=image();for(const table of [undefined,null,{},new Array(1),[undefined],[value,{}],[new Proxy(value,{get(){throw Error('must authenticate without reads');}})]])assert.throws(()=>copy(frame([imageCommand()],table)),reason('invalid'));
});
mixed('oversized table capacity now precedes authentication even with an invalid unused entry',()=>{
 const value=image();assert.throws(()=>copy(frame([imageCommand()],Array(65).fill(value))),reason('budget'));
 const table=Array(65).fill(value);table[64]={};assert.throws(()=>copy(frame([imageCommand()],table)),reason('budget'));
});
mixed('table bytes count each identity once including unused entries',()=>{
 const values=Array.from({length:5},()=>image(1024,1024));assert.equal(copy(frame([imageCommand()],values.slice(0,4))).frame.images.length,4);
 assert.throws(()=>copy(frame([imageCommand()],values)),reason('budget'));
 assert.equal(copy(frame([imageCommand()],Array(64).fill(values[0]))).frame.images.length,64);
});
mixed('128 distinct views pass 129 fail while repeated views charge once',()=>{
 const value=image(129,1),commands=Array.from({length:128},(_,x)=>imageCommand(0,region(x,0)));
 assert.equal(copy(frame([...commands,imageCommand(0,region())],[value])).frame.commands.length,129);
 assert.throws(()=>copy(frame([...commands,imageCommand(0,region(128,0))],[value])),reason('budget'));
});
mixed('Task3 projection fixture charges unique views separately from table payload',()=>{
 const value=image(1024,1024);const regions=[region(0,0,1024,1023),region(0,1,1024,1023),region(0,0,1023,1024),region(1,0,1023,1024)];
 const commands=regions.map(r=>imageCommand(0,r));assert.equal(copy(frame([...commands,imageCommand(0,regions[0])],[value])).frame.commands.length,5);
 assert.throws(()=>copy(frame([...commands,imageCommand(0,region(0,0,1024,1024))],[value])),reason('budget'));
});
mixed('header backing and prior malformed rectangle precede lazy table reads',()=>{
 for(const [field,value,expected] of [['frameId',0,'invalid'],['width',Number.MAX_VALUE,'backing']]){const f=frame([imageCommand()]);f[field]=value;Object.defineProperty(f,'images',{get(){throw Error('late table');}});assert.throws(()=>copy(f),reason(expected));}
 const c=rectangle();c.alpha=2;const f=frame([c,imageCommand()]);Object.defineProperty(f,'images',{get(){throw Error('late table');}});assert.throws(()=>copy(f),reason('invalid'));
});
mixed('first image validates table before matrix and reads images exactly once',()=>{
 const log=[],c=imageCommand();Object.defineProperty(c,'matrix',{get(){log.push('matrix');throw Error('late matrix');}});const f=frame([c]);Object.defineProperty(f,'images',{get(){log.push('images');return null;}});
 assert.throws(()=>copy(f),reason('invalid'));assert.deepEqual(log,['images']);
 let count=0;const good=frame([imageCommand(),imageCommand()]);Object.defineProperty(good,'images',{get(){count++;return [image()];}});copy(good);assert.equal(count,1);
});
mixed('image matrix rectangle alpha clips index region reads have exact literal order',()=>{
 const log=[],c=imageCommand();c.matrix=tracked(c.matrix,'matrix',log);c.rect=tracked(c.rect,'rect',log);c.clips=tracked([tracked({matrix:tracked(matrix(),'clip.matrix',log),rect:tracked(rect(0,0,1,1),'clip.rect',log)},'clip',log)],'clips',log);c.sourceRect=tracked(c.sourceRect,'region',log);
 copy(frame([tracked(c,'item',log)],[image()]));assert.deepEqual(log,[
 'item.kind','item.matrix','matrix.a','matrix.b','matrix.c','matrix.d','matrix.tx','matrix.ty','item.rect','rect.x','rect.y','rect.width','rect.height','item.alpha','item.clips','clips.length','clips.0','clip.matrix','clip.matrix.a','clip.matrix.b','clip.matrix.c','clip.matrix.d','clip.matrix.tx','clip.matrix.ty','clip.rect','clip.rect.x','clip.rect.y','clip.rect.width','clip.rect.height','item.imageIndex','item.sourceRect','region.x','region.y','region.width','region.height']);
});
mixed('earlier image validation wins at every ordered boundary',()=>{
 const phases=['matrix','rect','alpha','clips','imageIndex','sourceRect'];const bad=[null,null,2,null,-1,null];
 for(let i=0;i<phases.length;i++){const log=[],c=imageCommand();c[phases[i]]=bad[i];if(i+1<phases.length)Object.defineProperty(c,phases[i+1],{get(){log.push('later');throw Error('later');}});assert.throws(()=>copy(frame([c],[image()])),reason('invalid'));assert.deepEqual(log,[]);}
});
mixed('suppressed destination alpha and empty clip still validate remaining clips index and region',()=>{
 for(const suppress of [c=>c.rect.width=0,c=>c.alpha=0,c=>c.clips=[{matrix:matrix(),rect:rect(0,0,0,0)}]]){
  const c=imageCommand();suppress(c);c.imageIndex=-1;assert.throws(()=>copy(frame([c],[image()])),reason('invalid'));c.imageIndex=0;c.sourceRect=null;assert.throws(()=>copy(frame([c],[image()])),reason('invalid'));
  c.sourceRect=region();c.clips.push({matrix:null,rect:rect()});assert.throws(()=>copy(frame([c],[image()])),reason('invalid'));
 }
});
mixed('index string fraction negative unsafe and out of range are invalid',()=>{
 for(const index of ['0',0.5,-1,1,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>copy(frame([imageCommand(index)],[image()])),reason('invalid'));
});
mixed('source region snapshots all four fields before semantics and validates safe integer containment',()=>{
 for(const value of [null,region(0.5,0),region(-1,0),region(0,0,0),region(0,0,-0),region(0,0,2),region(Number.MAX_SAFE_INTEGER,0,2),region(0,0,Infinity),region(0,0,1,0.5)])assert.throws(()=>copy(frame([imageCommand(0,value)],[image()])),reason('invalid'));
 const sentinel=Error('last region read'),log=[],r=tracked({x:-1,y:0,width:1,get height(){throw sentinel;}},'region',log);
 assert.throws(()=>copy(frame([imageCommand(0,r)],[image()])),readFault(sentinel));assert.deepEqual(log,['region.x','region.y','region.width','region.height']);
});
mixed('known getter faults preserve exact cause regardless of semantic-looking class',()=>{
 for(const cause of [Error('getter'),new FrameCopyError('budget'),new GeometryPreparationError('precision')]){
  for(const field of ['kind','matrix','rect','alpha','clips','imageIndex','sourceRect']){const c=imageCommand();Object.defineProperty(c,field,{get(){throw cause;}});assert.throws(()=>copy(frame([c],[image()])),readFault(cause));}
  const f=frame([imageCommand()]);Object.defineProperty(f,'images',{get(){throw cause;}});assert.throws(()=>copy(f),readFault(cause));
  const table=new Proxy([image()],{get(t,k,r){if(k==='length'||k==='0')throw cause;return Reflect.get(t,k,r);}});assert.throws(()=>copy(frame([imageCommand()],table)),readFault(cause));
 }
});
mixed('new revoked table and image clips checks wrap cause while legacy header and rect clips stay raw',()=>{
 const p=Proxy.revocable([],{});p.revoke();for(const input of [frame([imageCommand()],p.proxy),frame([{...imageCommand(),clips:p.proxy}],[image()])])assert.throws(()=>copy(input),e=>e instanceof FrameInputReadError&&e.cause instanceof TypeError);
 for(const input of [frame(p.proxy),frame([{...rectangle(),clips:p.proxy}])])assert.throws(()=>copy(input),e=>e instanceof TypeError&&!(e instanceof FrameInputReadError));
});
mixed('clip budget failure precedes clip index reads on image commands',()=>{
 const log=[],c=imageCommand();c.clips=tracked([clip()],'clips',log);assert.throws(()=>copy(frame([c],[image()]),{maxClipRectangles:0}),reason('budget'));assert.deepEqual(log,['clips.length']);
});
mixed('getter reentry creates independent copies and failed ledgers never survive',()=>{
 const value=image();let inner;const c=imageCommand();Object.defineProperty(c,'matrix',{get(){inner=copy(frame([imageCommand()],[value]));return matrix();}});const outer=copy(frame([c],[value]));assert.notEqual(outer.frame,inner.frame);assert.notEqual(outer.frame.images,inner.frame.images);
 assert.throws(()=>copy(frame([imageCommand()],Array(65).fill(value))),reason('budget'));assert.equal(copy(frame([imageCommand()],[value])).frame.images.length,1);
});
mixed('ledger owns per-instance table/view accounting with fixed caps and no pixel copying',()=>{
 const value=image(129,1),a=new MixedImageBudget(),b=new MixedImageBudget();a.registerTable([value,value]);b.registerTable([value]);for(let x=0;x<128;x++)a.registerView(value,region(x,0));a.registerView(value,region());assert.throws(()=>a.registerView(value,region(128,0)),reason('budget'));b.registerView(value,region(128,0));
});
// Oversized-length admission intentionally supersedes the former native RangeError priority.
for(const length of [65,1024,2**32,Number.MAX_SAFE_INTEGER])mixed('oversized virtual table '+length+' rejects before allocation indices or iterator',()=>{
 let lengths=0,indices=0,iterators=0;const sentinel=new FrameCopyError('invalid');
 const table=new Proxy([],{get(target,key,receiver){if(key==='length'){lengths++;return length;}if(key===Symbol.iterator){iterators++;throw sentinel;}if(typeof key==='string'&&/^\d+$/.test(key)){indices++;throw sentinel;}return Reflect.get(target,key,receiver);}});
 assert.throws(()=>copy(frame([imageCommand()],table)),reason('budget'));assert.equal(lengths,1);assert.equal(indices,0);assert.equal(iterators,0);
});
mixed('admitted 64 slots authenticate every index once including unused entries before payload and geometry',()=>{
 const value=image(),log=[];const table=tracked(Array(64).fill(value),'images',log);assert.equal(copy(frame([imageCommand()],table)).frame.images.length,64);
 assert.deepEqual(log,['images.length',...Array.from({length:64},(_,i)=>'images.'+i)]);
 const overPayload=Array.from({length:5},()=>image(1024,1024));const invalid=Array(64).fill(value);for(let i=0;i<5;i++)invalid[i]=overPayload[i];invalid[63]={};
 const c=imageCommand();Object.defineProperty(c,'matrix',{get(){throw Error('geometry must follow full authentication');}});
 assert.throws(()=>copy(frame([c],invalid)),reason('invalid'));
});
mixed('admitted table index-only read fault retains exact sentinel after successful length',()=>{
 const sentinel=new FrameCopyError('budget'),log=[];const table=new Proxy(Array(64).fill(image()),{get(t,k,r){log.push(String(k));if(k==='63')throw sentinel;return Reflect.get(t,k,r);}});
 assert.throws(()=>copy(frame([imageCommand()],table)),readFault(sentinel));assert.deepEqual(log,['length',...Array.from({length:64},(_,i)=>String(i))]);
});
