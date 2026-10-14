// SPDX-License-Identifier: Apache-2.0
// Five frozen literal row oracles; no Engine/tree/renderer imports or computed expectation.
const COLORS=Object.freeze({'.':[0,0,0,0],R:[255,0,0,255]});
const N1=Object.freeze([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N2=Object.freeze([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '....RRRRRRRR............',
  '....RRRRRRRR............',
  '....RRRRRRRR............',
  '....RRRRRRRR............',
  '....RRRRRRRR............',
  '....RRRRRRRR............',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N3=Object.freeze([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  'RRRRRRRRRRRRRRRR........',
  'RRRRRRRRRRRRRRRR........',
  'RRRRRRRRRRRRRRRR........',
  'RRRRRRRRRRRRRRRR........',
  'RRRRRRRRRRRRRRRR........',
  'RRRRRRRRRRRRRRRR........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N4=Object.freeze([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  'RRRRRRRR................',
  'RRRRRRRR................',
  'RRRRRRRR................',
  'RRRRRRRR................',
  'RRRRRRRR................',
  'RRRRRRRR................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N5=Object.freeze([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........RRRRRRRR........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const ROWS=Object.freeze({N1,N2,N3,N4,N5});
const MATRICES=Object.freeze({
 N1:{a:1,b:0,c:0,d:1,tx:8,ty:8},N2:{a:1,b:0,c:0,d:1,tx:4,ty:5},
 N3:{a:2,b:0,c:0,d:1,tx:0,ty:5},N4:{a:2,b:0,c:0,d:1,tx:0,ty:5},
 N5:{a:1,b:0,c:0,d:1,tx:8,ty:8},C1:{a:1,b:0,c:0,d:1,tx:8,ty:8}
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const numbers=(actual,expected)=>!!actual&&Object.keys(expected).every(key=>actual[key]===expected[key]);
function inspect(packet,control=false) {
 if(!packet||!['canvas','webgpu'].includes(packet.backend)||!(control?packet.step==='C1'&&packet.backend==='canvas':['N1','N2','N3','N4','N5'].includes(packet.step))
  ||packet.raw?.length!==2304||packet.metadata?.width!==24||packet.metadata?.height!==24||packet.metadata?.byteLength!==2304
  ||packet.metadata?.format!=='rgba8unorm'||packet.metadata?.colorSpace!=='srgb'||packet.metadata?.origin!=='top-left'
  ||packet.metadata?.alphaMode!==(packet.backend==='canvas'?'straight':'premultiplied'))throw new TypeError('AO_NATIVE_RAW_METADATA');
 const rows=control?N2:ROWS[packet.step],failures=[];let mismatchedChannels=0,mismatchedPixels=0;
 for(let y=0;y<24;y++)for(let x=0;x<24;x++) {
  let different=false;
  for(let channel=0;channel<4;channel++) {
   const actual=packet.raw[(y*24+x)*4+channel],expected=COLORS[rows[y][x]][channel];
   if(!Number.isInteger(actual)||actual<0||actual>255)throw new TypeError('AO_NATIVE_RAW_BYTE');
   if(actual!==expected){different=true;mismatchedChannels++;if(failures.length<16)failures.push({x,y,channel,actual,expected});}
  }
  if(different)mismatchedPixels++;
 }
 const step=packet.step,tree=packet.tree,css=packet.css,idle=packet.metadata.hostStatus,clipped=step==='N4'||step==='N5';
 const zero=step==='N1'||step==='C1',scaled=step==='N3'||clipped;
 const treePass=tree?.allSceneNodesLive&&tree.scopeState==='open'&&same(tree.stageIds,['red'])&&tree.redParent==='stage'
  &&numbers(tree.stage,{x:0,y:0,scaleX:1,scaleY:1,rotation:0,anchorOffsetX:0,anchorOffsetY:0})
  &&numbers(tree.red,{x:8,y:8,scaleX:scaled?2:1,scaleY:1,rotation:0,anchorOffsetX:zero?0:4,anchorOffsetY:zero?0:3})
  &&same(tree.red.clipRect,clipped?{x:0,y:0,width:4,height:6}:null)
  &&numbers(tree.ownBounds,{x:0,y:0,width:8,height:6});
 const clips=packet.frame?.clips;
 const frameClipPass=Array.isArray(clips)&&(step==='N4'?clips.length===1&&clips[0].frozen
  &&numbers(clips[0].rect,{x:0,y:0,width:4,height:6})&&numbers(clips[0].matrix,MATRICES.N4):clips.length===0);
 const metadataPass=packet.frame?.width===24&&packet.frame.height===24&&packet.frame.commands===1&&packet.frame.images===0
  &&packet.frame.kind==='rect'&&packet.frame.frozen&&numbers(packet.frame.matrix,MATRICES[step])&&frameClipPass
  &&css?.width===24&&css.height===24&&css.backingWidth===24&&css.backingHeight===24&&css.devicePixelRatio===1
  &&packet.sameEngineAlive===true&&(step!=='N5'||packet.exactSavedN1===true)
  &&(packet.backend==='canvas'?idle===null:idle?.pendingFrames===0&&idle.pendingUploadBytes===0&&idle.pendingReadbackBytes===0);
 return {pass:(control?mismatchedPixels===72&&mismatchedChannels===144:mismatchedPixels===0&&mismatchedChannels===0)&&treePass&&metadataPass,
  failures,mismatchedPixels,mismatchedChannels,treePass,metadataPass,pixelsCompared:576,channelsCompared:2304,pixelTolerance:0,
  expectedClassification:control?'literal-mismatch':'exact-literal-match',
  scope:control?'Fresh genuine Canvas baseline and wrong zero pivot; exact72pixels144channels and zero main credit':'Public pivot/scale/local clip and exact same-live saved baseline; independent literal rows'};
}
export function inspectDisplayAnchorOffsetsCapture(packet){return inspect(packet);}
export function inspectDisplayAnchorOffsetsWrongPivotControl(packet){return inspect(packet,true);}
