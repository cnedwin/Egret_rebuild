// SPDX-License-Identifier: Apache-2.0
import {skeletonSource} from '../animation-outfits/content.mjs';
import {workload} from './workload.mjs';

/** Each original quilt tile uses every vertex and two bone influences per vertex. */
function weave(panel) {
  const uvs = [], vertices = [], triangles = [];
  for (let i = 0; i < 100; i++) {
    const cell = Math.floor(i/3), corner = i%3;
    const u = (cell%11+(corner === 1 ? .86 : .12))/11;
    const v = (Math.floor(cell/11)+(corner === 2 ? .85 : .1))/4;
    const px = -12 + (panel%5)*5 + u*4.5;
    const py = -27 + Math.floor(panel/5)*4 + v*3.5;
    const bone = 2 + (panel*11+i) % (workload.bones-2);
    uvs.push(u,1-v);
    vertices.push(2,0,px,py,.625,bone,px,py,.375);
    if (corner === 2) triangles.push(i-2,i-1,i);
  }
  triangles.push(96,98,99);
  return {type:'mesh',path:'cool',uvs,vertices,triangles};
}

export function buildStressSkeleton() {
  const value = skeletonSource();
  const attachment = value.skins[0].attachments;
  for (let i = 2; i < workload.bones; i++) value.bones.push({name:'trim-'+i,parent:'root'});
  const front = value.slots.splice(0);
  const weaveCount = workload.weightedVertices / 100;
  for (let i = 0; i < workload.slots - front.length; i++) {
    const name = 'panel-'+i;
    value.slots.push({name,bone:'trim-'+(i+2),attachment:name});
    attachment[name] = {[name]:i < weaveCount ? weave(i) :
      {path:'cool',x:-17+(i%37)*.9,y:21+Math.floor((i-weaveCount)/37)*1.5,width:.8,height:1.1}};
  }
  value.slots.push(...front);
  value.animations.trim = {bones:{'trim-2':{translate:[{time:0,y:0},{time:.35,y:2},{time:.7,y:0}]},
    'trim-3':{translate:[{time:0,x:0},{time:.35,x:-1},{time:.7,x:0}]}}};
  return value;
}
