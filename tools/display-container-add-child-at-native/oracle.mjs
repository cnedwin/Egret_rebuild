// SPDX-License-Identifier: Apache-2.0
// Five independent literal row oracles; no Engine/tree/renderer imports.
const COLORS=Object.freeze({'.':[0,0,0,0],R:[255,0,0,255],G:[0,255,0,255],B:[0,0,255,255],Y:[255,255,0,255]});
const N1=Object.freeze([
  '........................',
  '........................',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N2=Object.freeze([
  'BBBBBBBBBB..............',
  'BBBBBBBBBB..............',
  'BBRRRRRRRRRRRRRRRRRR....',
  'BBRRRRRRRRRRRRRRRRRR....',
  'BBRRRRRRRRRRRRRRRRRR....',
  'BBRRRRRRRRRRRRRRRRRR....',
  'BBRRRRRRRRRRRRRRRRRR....',
  'BBRRRRRRRRRRRRRRRRRR....',
  'BBRRRRRRGGGGGGGGGGGG....',
  'BBRRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N3=Object.freeze([
  'BBBBBBBBBB..............',
  'BBBBBBBBBB..............',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBGGGGGGGGGG....',
  'BBBBBBBBBBGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N4=Object.freeze([
  'BBBBBBBBBB..............',
  'BBBBBBBBBB..............',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRRRRR....',
  'BBBBBBBBBBRRRRRRYYYY....',
  'BBBBBBBBBBRRRRRRYYYY....',
  'BBBBBBBBBBRRRRRRYYYY....',
  'BBBBBBBBBBRRRRRRYYYY....',
  'BBBBBBBBBBGGGGGGGGGG....',
  'BBBBBBBBBBGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const N5=Object.freeze([
  '........................',
  '........................',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRRRRRRRRRRRRR....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '..RRRRRRGGGGGGGGGGGG....',
  '........................',
  '........................',
  '........................',
  '........................'
]);
const ROWS=Object.freeze({N1,N2,N3,N4,N5});
function inspect(packet,control=false) {
 if(!packet||!['canvas','webgpu'].includes(packet.backend)||!(control?packet.step==='C1'&&packet.backend==='canvas':['N1','N2','N3','N4','N5'].includes(packet.step))
  ||packet.raw?.length!==2304||packet.metadata?.width!==24||packet.metadata?.height!==24||packet.metadata?.byteLength!==2304
  ||packet.metadata?.format!=='rgba8unorm'||packet.metadata?.colorSpace!=='srgb'||packet.metadata?.origin!=='top-left'
  ||packet.metadata?.alphaMode!==(packet.backend==='canvas'?'straight':'premultiplied'))throw new TypeError('ADI_NATIVE_RAW_METADATA');
 const rows=control?N2:ROWS[packet.step],failures=[];let mismatchedChannels=0;
 for(let y=0;y<24;y++)for(let x=0;x<24;x++)for(let channel=0;channel<4;channel++) {
  const actual=packet.raw[(y*24+x)*4+channel],expected=COLORS[rows[y][x]][channel];
  if(!Number.isInteger(actual)||actual<0||actual>255)throw new TypeError('ADI_NATIVE_RAW_BYTE');
  if(actual!==expected){mismatchedChannels++;if(failures.length<16)failures.push({x,y,channel,actual,expected});}
 }
 const step=packet.step,tree=packet.tree,css=packet.css,idle=packet.metadata.hostStatus;
 const target=control?['red','green','blue']:({N1:['red','green'],N2:['blue','red','green'],N3:['red','green','blue'],N4:['red','yellow','green','blue'],N5:['red','yellow','green','blue']})[step];
 const moved=step==='N4'||step==='N5';
 const treePass=tree?.allSceneNodesLive&&tree.scopeState==='open'&&JSON.stringify(tree.targetIds)===JSON.stringify(target)
  &&JSON.stringify(tree.sourceIds)===JSON.stringify(moved?[]:['yellow'])&&JSON.stringify(tree.stageIds)===JSON.stringify(['target','source'])
  &&tree.yellowParent===(moved?'target':'source')&&tree.blueParent===(step==='N1'?'detached':'target');
 const metadataPass=packet.frame?.width===24&&packet.frame.height===24&&packet.frame.commands===(step==='N1'||step==='N5'?3:4)&&packet.frame.images===0&&packet.frame.frozen
  &&css?.width===24&&css.height===24&&css.backingWidth===24&&css.backingHeight===24&&css.devicePixelRatio===1
  &&packet.sameEngineAlive===true&&(step!=='N5'||packet.exactSavedN1===true)
  &&(packet.backend==='canvas'?idle===null:idle?.pendingFrames===0&&idle.pendingUploadBytes===0&&idle.pendingReadbackBytes===0);
 return {pass:(control?mismatchedChannels>0:mismatchedChannels===0)&&treePass&&metadataPass,failures,mismatchedChannels,treePass,metadataPass,
  pixelsCompared:576,channelsCompared:2304,pixelTolerance:0,expectedClassification:control?'literal-mismatch':'exact-literal-match',
  scope:control?'Fresh genuine Canvas baseline and wrong public index; zero main credit':'Public indexed insertion/reparent and exact same-live saved baseline; independent literal rows'};
}
export function inspectDisplayContainerAddChildAtCapture(packet){return inspect(packet);}
export function inspectDisplayContainerAddChildAtWrongIndexControl(packet){return inspect(packet,true);}
