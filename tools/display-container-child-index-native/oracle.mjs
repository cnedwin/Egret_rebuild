// SPDX-License-Identifier: Apache-2.0
// Literal independent palette rows; no Engine/tree/query/renderer imports.
const COLORS=Object.freeze({'.':[0,0,0,0],G:[0,255,0,255],R:[255,0,0,255],B:[0,0,255,255],Y:[255,255,0,255]});
const BEFORE=Object.freeze([
 '........................','........................','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..',
 '..GGRRRRYYYYYYYYGGGGGG..','..GGRRRRYYYYYYYYGGGGGG..',
 '..GGRRBBYYYYYYYYGGGGGG..','..GGRRBBYYYYYYYYGGGGGG..','..GGRRBBYYYYYYYYGGGGGG..',
 '..GGRRBBYYYYYYYYGGGGGG..','..GGRRBBYYYYYYYYGGGGGG..','..GGRRBBYYYYYYYYGGGGGG..',
 '..GGGGBBBBBBBBGGGGGGGG..','..GGGGBBBBBBBBGGGGGGGG..',
 '..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..',
 '..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..',
 '........................','........................']);
const AFTER=Object.freeze([
 '........................','........................','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..',
 '..GGRRRRRRRRYYYYGGGGGG..','..GGRRRRRRRRYYYYGGGGGG..',
 '..GGRRBBBBBBBBYYGGGGGG..','..GGRRBBBBBBBBYYGGGGGG..','..GGRRBBBBBBBBYYGGGGGG..',
 '..GGRRBBBBBBBBYYGGGGGG..','..GGRRBBBBBBBBYYGGGGGG..','..GGRRBBBBBBBBYYGGGGGG..',
 '..GGGGBBBBBBBBGGGGGGGG..','..GGGGBBBBBBBBGGGGGGGG..',
 '..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..',
 '..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..','..GGGGGGGGGGGGGGGGGGGG..',
 '........................','........................']);

export function inspectDisplayContainerChildIndexCapture(packet) {
 if(!packet||!['canvas','webgpu'].includes(packet.backend)||!['N1','N2','N3'].includes(packet.step)
  ||packet.raw?.length!==2304||packet.metadata?.width!==24||packet.metadata?.height!==24||packet.metadata?.byteLength!==2304
  ||packet.metadata?.format!=='rgba8unorm'||packet.metadata?.colorSpace!=='srgb'||packet.metadata?.origin!=='top-left'
  ||packet.metadata?.alphaMode!==(packet.backend==='canvas'?'straight':'premultiplied'))throw new TypeError('CGI_NATIVE_RAW_METADATA');
 const rows=packet.step==='N2'?AFTER:BEFORE,failures=[];
 if(rows.length!==24||rows.some(row=>row.length!==24))throw new TypeError('CGI_LITERAL_ROWS');
 for(let y=0;y<24;y++)for(let x=0;x<24;x++)for(let channel=0;channel<4;channel++) {
  const actual=packet.raw[(y*24+x)*4+channel],expected=COLORS[rows[y][x]][channel];
  if(!Number.isInteger(actual)||actual<0||actual>255||actual!==expected)if(failures.length<16)failures.push({x,y,channel,actual,expected});
 }
 const tree=packet.tree,css=packet.css,idle=packet.metadata.hostStatus;
 const treePass=tree?.allSceneNodesLive&&tree.rootChildren===3&&tree.allDirectParentsRetained
  &&JSON.stringify(tree.orderedIds)===JSON.stringify(packet.step==='N1'?['A','B','C']:['C','A','B'])
  &&JSON.stringify(tree.currentIndices)===JSON.stringify(packet.step==='N1'?[0,1,2]:[1,2,0])
  &&tree.queriedIndex===(packet.step==='N1'?null:0)&&tree.loads===1&&tree.disposals===0
  &&tree.leaseState?.live===true&&tree.leaseState.released===false&&tree.eventCalls===({N1:1,N2:2,N3:3})[packet.step];
 const metadataPass=packet.frame?.width===24&&packet.frame.height===24&&packet.frame.commands===4&&packet.frame.images===0&&packet.frame.frozen
  &&css?.width===24&&css.height===24&&css.backingWidth===24&&css.backingHeight===24&&css.devicePixelRatio===1
  &&packet.sameEngineAlive===true&&(packet.step!=='N3'||packet.exactSavedN1===true)
  &&(packet.backend==='canvas'?idle===null:idle?.pendingFrames===0&&idle.pendingUploadBytes===0&&idle.pendingReadbackBytes===0);
 return {pass:failures.length===0&&treePass&&metadataPass,failures,treePass,metadataPass,pixelsCompared:576,channelsCompared:2304,
  pixelTolerance:0,scope:'Original query/caller reorder/saved-frame replay with live Scope lease/listener; literal independent rows'};
}
