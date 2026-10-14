// SPDX-License-Identifier: Apache-2.0
// Independent literal rectangle rows. No engine, source pixels or geometry imports.
const COLORS=Object.freeze({'.':[0,0,0,0],R:[255,0,0,255],G:[0,255,0,255],B:[0,0,255,255],Y:[255,255,0,255],M:[255,0,255,255],
  C:[0,255,255,255],W:[255,255,255,255],H:[128,128,128,255],K:[0,0,0,255]});
const A=Object.freeze([
  '........................','........................','..RRGGGGGGGGGGGGBB......','..RRGGGGGGGGGGGGBB......',
  '..YYMMMMMMMMMMMMCC......','..YYMMMMMMMMMMMMCC......','..YYMMMMMMMMMMMMCC......','..YYMMMMMMMMMMMMCC......',
  '..YYMMMMMMMMMMMMCC......','..YYMMMMMMMMMMMMCC......','..YYMMMMMMMMMMMMCC......','..YYMMMMMMMMMMMMCC......',
  '..WWHHHHHHHHHHHHKK......','..WWHHHHHHHHHHHHKK......','........................','........................',
  '........................','........................','........................','........................',
  '........................','........................','........................','........................']);
const B=Object.freeze([
  '........................','........................','..RRGGGGGGGGBB..........','..RRGGGGGGGGBB..........',
  '..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........',
  '..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........',
  '..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........','..YYMMMMMMMMCC..........',
  '..WWHHHHHHHHKK..........','..WWHHHHHHHHKK..........','........................','........................',
  '........................','........................','........................','........................']);
export function inspectNineSliceBitmapCapture(packet) {
  if(!packet||packet.backend!=='webgpu'||!['N1','N2','N3'].includes(packet.step)||packet.raw?.length!==2304
    ||packet.metadata?.width!==24||packet.metadata?.height!==24||packet.metadata?.byteLength!==2304||packet.metadata?.format!=='rgba8unorm'
    ||packet.metadata?.colorSpace!=='srgb'||packet.metadata?.alphaMode!=='premultiplied'||packet.metadata?.origin!=='top-left')throw new TypeError('NLB_NATIVE_RAW_METADATA');
  const rows=packet.step==='N2'?B:A;const failures=[];
  if(rows.length!==24||rows.some(row=>row.length!==24))throw new TypeError('NLB_LITERAL_ORACLE_ROWS');
  for(let y=0;y<24;y++)for(let x=0;x<24;x++)for(let channel=0;channel<4;channel++){
    const actual=packet.raw[(y*24+x)*4+channel],expected=COLORS[rows[y][x]][channel];
    if(!Number.isInteger(actual)||actual<0||actual>255||actual!==expected){if(failures.length<16)failures.push({x,y,channel,actual,expected});}
  }
  const idle=packet.metadata.hostStatus;
  const metadataPass=idle?.pendingFrames===0&&idle.pendingUploadBytes===0&&idle.pendingReadbackBytes===0
    &&packet.frame?.commands===1&&packet.frame?.images===1&&packet.frame?.geometries===1
    &&(packet.step==='N3'?packet.exactSavedN1===true&&packet.originRetired===true:packet.sameBorrowedLease===true);
  return {pass:failures.length===0&&metadataPass,failures,metadataPass,pixelsCompared:576,channelsCompared:2304,pixelTolerance:0,
    scope:'NineSliceBitmap original cropped literal panel; no PNG decode or geometry-derived oracle'};
}
