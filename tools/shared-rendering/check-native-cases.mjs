// SPDX-License-Identifier: Apache-2.0
// Fixed input-to-reference reconstruction. No SDK, browser or product test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as O from './oracle.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const input=fs.readFileSync(new URL('./native-cases.json',import.meta.url));
const catalog=JSON.parse(input),pages=new Map(),regions=new Map(catalog.regions.map(r=>[r.id,r]));
const caseSchedule=['A00-endpoints','A01-alpha-flat','A02-alpha-opaque','B00-black-white',
  'B01-nongray-equal-alpha','B02-nongray-vary-alpha','B03-two-color-alpha',
  'C00-singleton-trim','C01-one-by-five','C02-odd-all-rotations','C03-opposite-contact',
  'D00-domain-choice','D01-address-seams','D02-nearest-floor','E00-region-interpolation',
  'E01-page-seam-interpolation','E02-nine-slice-seams','E03-nine-slice-zero-center','E04-clip-coverage',
  'F00-blends-transparent','F01-blends-opaque','F02-order-and-factor','F03-mixed-opaque',
  'G00-linear-b1-ui0','G01-linear-b1-ui1','G02-linear-b1-ui2','G03-linear-b1-ui3',
  'H00-size-pair','H01-size-pair','H02-size-pair'];
const negativeSchedule=['N01-encoded-average','N02-missing-source-decode','N03-missing-dark',
  'N04-double-pma','N05-no-trim-coverage','N06-page-clamp-for-region','N07-css-multiply',
  'N08-skip-transparent-resolve','N09-b1-decode-after-interpolation','N10-rgba-bgra-swap','N11-painter-reorder'];
assert.deepEqual(catalog.cases.map(row=>row.id),caseSchedule,'fixed case schedule');
assert.deepEqual(catalog.negatives.map(row=>row.id),negativeSchedule,'fixed negative schedule');
const oracleBytes=fs.readFileSync(new URL('./oracle.mjs',import.meta.url));
assert.equal(catalog.reference.path,'tools/shared-rendering/oracle.mjs');
assert.equal(catalog.reference.version,O.REFERENCE_VERSION);
assert.deepEqual([catalog.reference.bytes,catalog.reference.sha256],[oracleBytes.length,hash(oracleBytes)],'reference raw identity');
const close=(a,b,label)=>{assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<1e-12,label+':'+i);};
for(const page of catalog.pages){
  const bytes=new Uint8Array(page.width*page.height*4),p=page.pattern;
  if(p.kind==='pixels')bytes.set(p.bytes);
  else{
    for(let y=0;y<page.height;y++)for(let x=0;x<page.width;x++){
      const localX=x-p.packedX,localY=y-p.packedY;
      let color=p.color??p.background;
      if(p.kind==='rotated-content'){
        // Inverse discrete transform, unlike the author's forward placement loop.
        const [u,v]=p.quarterTurn===0?[localX,localY]:p.quarterTurn===1?[localY,p.contentHeight-1-localX]:
          p.quarterTurn===2?[p.contentWidth-1-localX,p.contentHeight-1-localY]:[p.contentWidth-1-localY,localX];
        if(u>=0&&u<p.contentWidth&&v>=0&&v<p.contentHeight){const offset=4*(v*p.contentWidth+u);color=p.contentBytes.slice(offset,offset+4);}
      }
      bytes.set(color,4*(y*page.width+x));
    }
  }
  assert.equal(bytes.length,page.sourceByteLength);assert.equal(hash(bytes),page.sourceSha256,page.id);
  const canonical=O.canonicalPage(page.width,page.height,bytes);assert.equal(hash(canonical.bytes),page.canonicalSha256,page.id);
  pages.set(page.id,canonical);
}
function weights(p,a,b,c){
  const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(det===0)return null;
  const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/det;
  const v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/det;
  const w=1-u-v;return Math.min(u,v,w)>=-1e-12?[u,v,w]:null;
}
function findTriangle(draw,point){
  for(let i=0;i<draw.indices.length;i+=3){
    const ids=draw.indices.slice(i,i+3),corners=ids.map(index=>draw.positions.slice(2*index,2*index+2));
    const w=weights(point,...corners);if(w)return {ids,corners,w};
  }
  return null;
}
function shadeDraw(draw,point){
  for(const clip of draw.clipChain??[]){const r=clip.rect;if(point[0]<r.x||point[0]>=r.x+r.width||point[1]<r.y||point[1]>=r.y+r.height)return null;}
  let uv;
  const region=regions.get(draw.regionId),page=pages.get(region.pageId);
  if(draw.kind==='shared-mesh'){
    const hit=findTriangle(draw,point);if(!hit)return null;
    uv=[0,1].map(k=>hit.ids.reduce((sum,index,j)=>sum+hit.w[j]*Math.fround(draw.uvs[2*index+k]),0));
  }else{
    assert.equal(draw.kind,'nine-slice');
    if(point[0]<draw.x||point[0]>=draw.x+draw.width||point[1]<draw.y||point[1]>=draw.y+draw.height)return null;
    function axis(value,start,size,extent,first,last){
      const d=[start,start+first,start+size-last,start+size],s=[0,first,extent-last,extent];
      for(let i=0;i<3;i++)if(d[i+1]>d[i]&&value>=d[i]&&value<d[i+1])return (s[i]+(value-d[i])*(s[i+1]-s[i])/(d[i+1]-d[i]))/extent;
      throw Error('Nine-slice point unassigned');
    }
    uv=[axis(point[0],draw.x,draw.width,region.logicalWidth,draw.insets.left,draw.insets.right),
      axis(point[1],draw.y,draw.height,region.logicalHeight,draw.insets.top,draw.insets.bottom)];
  }
  const m=draw.material,extent=m.samplingDomain==='page'?[page.width,page.height]:[region.logicalWidth,region.logicalHeight];
  const q=uv.map((value,k)=>value*extent[k]);
  const sample=m.samplingDomain==='page'?O.samplePage(page,...q,m):O.sampleRegion(page,region,...q,m.filter);
  const source=O.shadeTwoColor(sample,{vertexLight:draw.light??[1,1,1,1],vertexDark:draw.dark??[0,0,0],
    materialLight:m.light,materialDark:m.dark,opacity:draw.opacity*(draw.parentOpacity??1)});
  return {source,blend:m.blend,q,sample,regionId:region.id};
}
function sceneLayers(def,point){
  if(!def.scene)return [];
  const projection=def.scene.projection;assert.equal(projection.kind,'orthographic');
  let depth=0,layer=null;
  for(const draw of def.scene.draws){
    assert.deepEqual(draw.modelView,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    const g=draw.geometry,screen=[],zs=[];
    for(let i=0;i<g.positions.length;i+=3){
      screen.push((g.positions[i]-projection.left)/(projection.right-projection.left)*def.width,
        (projection.top-g.positions[i+1])/(projection.top-projection.bottom)*def.height);
      zs.push((projection.far+g.positions[i+2])/(projection.far-projection.near));
    }
    const hit=findTriangle({positions:screen,indices:g.indices},point);if(!hit)continue;
    const z=hit.ids.reduce((sum,index,j)=>sum+hit.w[j]*zs[index],0);if(z<=depth)continue;
    depth=z;
    layer={source:[...[0,1,2].map(k=>hit.ids.reduce((sum,index,j)=>sum+hit.w[j]*Math.fround(O.decodeSrgb(g.colors[3*index+k])),0)),1],blend:'normal'};
  }
  return layer?[layer]:[];
}
const allModels=new Map();let totalPoints=0,channels=0,bleed=0,color=0,coverage=0;
for(const def of catalog.cases){
  for(const point of def.points){
    const p=[point.x+.5,point.y+.5],layers=sceneLayers(def,p);
    for(const draw of def.draws){const layer=shadeDraw(draw,p);if(layer)layers.push(layer);}
    assert.equal(layers.length,point.maxEffectiveWrites,def.id+'/'+point.id+' effective writes');
    assert.equal(layers.length,point.reference.layers.length);
    layers.forEach((l,i)=>{close(l.source,point.reference.layers[i].source,def.id+'/'+point.id+' source');assert.equal(l.blend,point.reference.layers[i].blend);});
    const result=O.renderPixel({...def,layers});
    assert.deepEqual(result.rgba,point.expectedRGBA,def.id+'/'+point.id+' target');
    assert.deepEqual(result.targetWrites,point.reference.targetWrites,def.id+'/'+point.id+' writes');
    if(point.bleed){assert.ok(result.rgba[point.bleed.channel]<=point.bleed.max);bleed++;}
    allModels.set(def.id+'/'+point.id,{def,point,layers,result});
    totalPoints++;channels+=point.channels.length;if(point.coverageOnly)coverage++;else color++;
  }
}
// Independent recomputation of the declared wrong models, from the draw-derived
// layers above rather than the stored numeric model layers.
for(const negative of catalog.negatives){
  const {def,point,layers,result}=allModels.get(negative.caseId+'/'+negative.pointId);
  let wrong;
  const rendered=ls=>O.renderPixel({...def,layers:ls}).rgba;
  switch(negative.id.slice(0,3)){
    case 'N01':wrong=rendered([{source:[O.decodeSrgb(.5),O.decodeSrgb(.5),O.decodeSrgb(.5),1]}]);break;
    case 'N02':wrong=rendered([{source:[32/255,128/255,224/255,1]}]);break;
    case 'N03':wrong=rendered([{source:[0,0,0,1]}]);break;
    case 'N04':wrong=rendered([{source:layers[0].source.map((v,k)=>k===3?v:v*layers[0].source[3])}]);break;
    case 'N05':wrong=rendered([{source:[1,0,0,1]}]);break;
    case 'N06':wrong=rendered([{source:O.samplePage(pages.get('H-16x16'),12,13,{filter:'linear'})}]);break;
    case 'N07':wrong=rendered([{source:[1,1,1,1]},{source:[1,1,1,1]}]);break;
    case 'N08':wrong=result.target;break;
    case 'N09':{
      const g=def.scene.draws[0].geometry,hit=findTriangle({positions:[0,0,256,0,0,256],indices:g.indices},[point.x+.5,point.y+.5]);
      wrong=rendered([{source:[...[0,1,2].map(k=>O.decodeSrgb(hit.ids.reduce((sum,index,j)=>sum+g.colors[3*index+k]*hit.w[j],0))),1]}]);break;
    }
    case 'N10':wrong=[result.rgba[2],result.rgba[1],result.rgba[0],result.rgba[3]];break;
    case 'N11':wrong=rendered([layers[0],layers[2],layers[1]]);break;
    default:throw Error('Unreviewed negative');
  }
  assert.deepEqual(wrong,negative.expectedWrongRGBA,negative.id);
  const delta=Math.abs(result.rgba[negative.channel]-wrong[negative.channel]);
  assert.equal(delta,negative.delta);assert.ok(delta>=Math.max(16,4*negative.T+4));
}
assert.deepEqual([totalPoints,channels,bleed,color,coverage],[321,1236,104,299,22]);
assert.deepEqual(catalog.counts,{cases:caseSchedule.length,namedPoints:totalPoints,colorPoints:color,
  coverageOnlyPoints:coverage,comparedChannels:channels,bleedChecks:bleed,negativeNumericModels:negativeSchedule.length,
  groupCounts:Object.fromEntries('ABCDEFGH'.split('').map(group=>[group,{
    cases:catalog.cases.filter(c=>c.group===group).length,
    points:catalog.cases.filter(c=>c.group===group).reduce((sum,c)=>sum+c.points.length,0),
  }]))},'declared schedule counts');
console.log(JSON.stringify({status:'SOURCE_AND_REFERENCE_REVIEW_PASS',input:{bytes:input.length,sha256:hash(input)},
  cases:catalog.cases.length,totalPoints,channels,bleed,color,coverage,negatives:catalog.negatives.length,
  boundary:'Scalar oracle reused; scene coverage, interpolation, draw selection, page inverse rotation and input-to-reference relation independently reconstructed. No SDK/native execution.'},null,2));
