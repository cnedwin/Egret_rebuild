// SPDX-License-Identifier: Apache-2.0
// Original scalar/pixel fixture, independent of SDK sampling and rendering.
export const firstPixels=Object.freeze([255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255,255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255]);
export const secondPixels=Object.freeze([0,0,255,255,0,255,255,255,0,255,255,255,0,255,255,255,255,255,0,255,255,0,255,255,255,0,255,255,255,0,255,255]);
const frame=(name,x,y,width,height,layout)=>({name,x,y,width,height,layout});
export function atlasPagesSource(){return {format:'egret.atlas-pages-source/1',pages:[
 {name:'characters',frames:[frame('idle',0,0,2,2,{sourceWidth:2,sourceHeight:2,trimX:0,trimY:0,packedRotation:0}),frame('green',2,0,2,2,{sourceWidth:2,sourceHeight:2,trimX:0,trimY:0,packedRotation:0})]},
 {name:'effects',frames:[frame('idle',0,0,1,2,{sourceWidth:4,sourceHeight:3,trimX:1,trimY:1,packedRotation:90}),frame('cyan',1,0,2,1,{sourceWidth:2,sourceHeight:1,trimX:0,trimY:0,packedRotation:0})]},
]};}
export const provenance=Object.freeze({origin:'first-party authored atlas-pages fixture',license:'Apache-2.0',notice:'Original authored pixels, source page names and frame geometry; not an exporter or Spine qualification.'});
// Render layout: red at(20,20), green at(100,20), rotated/trimmed at(180,20).
// The blue/yellow packed vertical pair becomes a horizontal logical pair at
// trim(1,1), with scale20. Cyan is at(300,20). Background is fixed(20,32,51).
export const referencePixels=Object.freeze([[25,25,[255,0,0,255]],[105,25,[0,255,0,255]],[205,45,[0,0,255,255]],[235,45,[255,255,0,255]],[185,25,[20,32,51,255]],[305,25,[0,255,255,255]],[420,100,[20,32,51,255]]]);
