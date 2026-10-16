// SPDX-License-Identifier: Apache-2.0
// Portable fixed input and independently reviewed literal expectations. No product import.
export const METADATA = "{\n  \"frames\": [\n    {\n      \"filename\": \"A\",\n      \"frame\": {\n        \"x\": 0,\n        \"y\": 0,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"rotated\": false,\n      \"trimmed\": true,\n      \"spriteSourceSize\": {\n        \"x\": 1,\n        \"y\": 1,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"sourceSize\": {\n        \"w\": 4,\n        \"h\": 5\n      },\n      \"duration\": 125\n    },\n    {\n      \"filename\": \"B\",\n      \"frame\": {\n        \"x\": 3,\n        \"y\": 0,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"rotated\": false,\n      \"trimmed\": true,\n      \"spriteSourceSize\": {\n        \"x\": 1,\n        \"y\": 2,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"sourceSize\": {\n        \"w\": 4,\n        \"h\": 5\n      },\n      \"duration\": 250\n    }\n  ],\n  \"meta\": {\n    \"app\": \"https://www.aseprite.org/\",\n    \"version\": \"1.3.18.6\",\n    \"image\": \"atlas.png\",\n    \"format\": \"RGBA8888\",\n    \"size\": {\n      \"w\": 6,\n      \"h\": 6\n    },\n    \"scale\": \"1\"\n  }\n}\n";
const SOURCE_PROVENANCE = {
  origin: 'Original first-party synthetic atlas metadata fixture',
  license: 'Apache-2.0',
  notice: 'Synthetic metadata for finite public SDK composition; not an exporter output.',
};
const PAGE_PROVENANCE = {
  origin: 'Original first-party P04-TR1 atlas fixture',
  license: 'Apache-2.0',
  notice: 'Original first-party fixture reused as unrotated stored crops; not an exporter output.',
  sha256: '35a3ecea0d79c5684d17a5dbfa56bf0cc5ebf52a34f6e8ceafe740c742a1437f',
};
// These expected values and original UTF-16 spans are independent fixture literals.
// No SDK/planner result or capture is used to construct this expected plan.
export const EXPECTED_PLAN = {
  planVersion: 1,
  profile: 'aseprite-json-array-1.3.18.6-v1',
  exportVersion: '1.3.18.6',
  sourceDeclarations: { metadata: {
    id: 'atlas-import-v1-metadata',
    provenance: SOURCE_PROVENANCE,
    utf8Bytes: 934,
    hashVerification: 'declared_unverified',
  } },
  page: {
    pageName: 'atlas.png', assetId: 'egret.atlas-import.original-atlas', width: 6, height: 6,
    provenance: PAGE_PROVENANCE,
  },
  names: ['A', 'B'],
  spriteSheetFrames: [
    { name: 'A', x: 0, y: 0, width: 2, height: 3,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 } },
    { name: 'B', x: 3, y: 0, width: 2, height: 3,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 0 } },
  ],
  sequenceInput: { atlasWidth: 6, atlasHeight: 6, frames: [
    { x: 0, y: 0, width: 2, height: 3, durationSeconds: .125,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 } },
    { x: 3, y: 0, width: 2, height: 3, durationSeconds: .25,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 0 } },
  ] },
  origins: [
  {
    "index": 0,
    "pointer": "/frames/0",
    "name": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 40,
      "length": 3,
      "line": 4,
      "column": 19
    },
    "frame": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 60,
      "length": 72,
      "line": 5,
      "column": 16
    },
    "sourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 301,
      "length": 40,
      "line": 19,
      "column": 21
    },
    "spriteSourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 207,
      "length": 72,
      "line": 13,
      "column": 27
    },
    "duration": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 361,
      "length": 3,
      "line": 23,
      "column": 19
    }
  },
  {
    "index": 1,
    "pointer": "/frames/1",
    "name": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 396,
      "length": 3,
      "line": 26,
      "column": 19
    },
    "frame": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 416,
      "length": 72,
      "line": 27,
      "column": 16
    },
    "sourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 657,
      "length": 40,
      "line": 41,
      "column": 21
    },
    "spriteSourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 563,
      "length": 72,
      "line": 35,
      "column": 27
    },
    "duration": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 717,
      "length": 3,
      "line": 45,
      "column": 19
    }
  }
],
  acceptance: {
    exporterArtifact: 'unverified', assetPixels: 'not_run', runtimeComposition: 'not_run',
    rendering: 'not_run', licenseEntitlement: 'unverified',
  },
};

export const FIXTURE_ROUTE='/tools/atlas-import/native-fixture.mjs';
export const HTML_ROUTE='/examples/atlas-import-playback/__native-fixture.html';
export const PLAN_ROUTE='/examples/atlas-import-playback/__atlas-import-plan-v1.json';
export const SEQUENCE=Object.freeze([{id:'frame-a',time:0},{id:'frame-b',time:.125}].map(Object.freeze));
export const serialize=value=>JSON.stringify(value,null,2)+'\n';
export function fixedInput(){return {profile:'aseprite-json-array-1.3.18.6-v1',
  source:{id:'atlas-import-v1-metadata',text:METADATA,provenance:{...SOURCE_PROVENANCE}},
  page:{pageName:'atlas.png',assetId:'egret.atlas-import.original-atlas',width:6,height:6,provenance:{...PAGE_PROVENANCE}}};}
export function deepFreeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
export function allFrozen(value){return !value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(allFrozen);}
deepFreeze(EXPECTED_PLAN);
export const ORACLE=deepFreeze({schemaVersion:1,kind:'ATLAS_IMPORT_LITERAL_RGBA_ORACLE_V1',width:24,height:16,dpr:1,byteLength:1536,
  order:'top-left-row-major-rgba8',backgroundRGBA:[0,0,0,0],frames:[
    {id:'frame-a',timeSeconds:0,path:'expected-frame-a.rgba',bytes:1536,sha256:'a50b6e7ac42cb37d10ca6a3682155ae65266600a463086e5b3bd1ef100c0937c',
      pixels:[{byteOffset:300,rgba:[255,0,0,255]},{byteOffset:304,rgba:[0,255,0,255]},{byteOffset:396,rgba:[0,0,255,255]},
        {byteOffset:400,rgba:[255,255,0,255]},{byteOffset:492,rgba:[255,0,255,255]},{byteOffset:496,rgba:[0,255,255,255]}]},
    {id:'frame-b',timeSeconds:.125,path:'expected-frame-b.rgba',bytes:1536,sha256:'97d20518293636cafd1f7a52346b46919c7a5f0abbefeb1b6e613c044610e411',
      pixels:[{byteOffset:396,rgba:[255,255,0,255]},{byteOffset:400,rgba:[255,0,0,255]},{byteOffset:492,rgba:[255,0,255,255]},
        {byteOffset:496,rgba:[0,255,0,255]},{byteOffset:588,rgba:[0,255,255,255]},{byteOffset:592,rgba:[0,0,255,255]}]},
  ]});
export function literalOracleBytes(id){const row=ORACLE.frames.find(row=>row.id===id);if(!row)throw Error('Exact oracle frame required');
  const bytes=new Uint8Array(1536);for(const pixel of row.pixels)bytes.set(pixel.rgba,pixel.byteOffset);return bytes;}
const assert=(value,message)=>{if(!value)throw Error(message);};
const equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
export function originalPixels(){const bytes=new Uint8Array(144);
  for(const [offset,rgba] of [[0,[255,0,0,255]],[4,[0,255,0,255]],[24,[0,0,255,255]],[28,[255,255,0,255]],
    [48,[255,0,255,255]],[52,[0,255,255,255]],[12,[255,255,0,255]],[16,[255,0,0,255]],
    [36,[255,0,255,255]],[40,[0,255,0,255]],[60,[0,255,255,255]],[64,[0,0,255,255]]])bytes.set(rgba,offset);return bytes;}
export function assertImportObservation(view,id){
  const index=SEQUENCE.findIndex(row=>row.id===id);assert(index>=0,'Exact importer observation');const row=SEQUENCE[index],session=view.session,actor=session.actor;
  equal([session.state,session.sourceSeconds,session.gameSeconds,session.tickId],['ready',row.time,row.time,index],'Actual importer clock');
  equal(session.ticks,index?[{tickId:1,elapsedSeconds:.125,deltaSeconds:.125}]:[],'Actual importer ticks');
  equal(session.diagnostics,[],'No actual diagnostic');equal(session.cleanupErrors,[],'No cleanup failure');
  equal([actor.mode,actor.state,actor.elapsed,actor.isDisposed,actor.bitmapDisposed],['once','running',row.time,false,false],'Actual once playback');
  const region=EXPECTED_PLAN.sequenceInput.frames[index],crop={x:region.x,y:region.y,width:region.width,height:region.height};
  equal(actor.sample,{frameIndex:index,region:{...crop,layout:region.layout},positionSeconds:row.time,atEnd:false,stopped:false},'Actual public sample');
  equal([actor.naturalWidth,actor.naturalHeight],[4,5],'Logical natural dimensions');equal(actor.bounds,{x:0,y:0,width:4,height:5},'Logical bounds');
  equal(actor.sourceRect,crop,'Original crop');
  equal(actor.parent,{x:2,y:2,rotation:0,scaleX:1,scaleY:1,anchorOffsetX:0,anchorOffsetY:0,clipRect:null},'Original parent');
  equal(view.displayBasis,[{x:2,y:2},{x:3,y:2},{x:2,y:3}],'Parent/display matrix basis');
  assert(view.commands.length===1&&view.images.length===1,'One original image command');
  const command=view.commands[0];equal(command.kind,'image','Image command');equal(command.alpha,1,'Image alpha');equal(command.imageIndex,0,'Original image index');
  equal(command.rect,{x:0,y:0,width:2,height:3},'Original draw rect');equal(command.sourceRect,crop,'Original source crop');
  equal(command.matrix,index?{a:1,b:0,c:0,d:1,tx:3,ty:4}:{a:1,b:0,c:0,d:1,tx:3,ty:3},'Literal image matrix');equal(command.clips,[],'No clip');
  equal(view.images,[{width:6,height:6,byteLength:144,pixels:Array.from(originalPixels())}],'Complete original image');
  equal(view.factories,{sequenceInput:EXPECTED_PLAN.sequenceInput,spriteSheetFrames:EXPECTED_PLAN.spriteSheetFrames,
    clip:{atlasWidth:6,atlasHeight:6,frameCount:2,durationSeconds:.375},sheet:{atlasWidth:6,atlasHeight:6,frameCount:2,names:['A','B']},
    fullAtlas:{x:0,y:0,width:6,height:6},sameOriginalTexture:true,immutable:true},'Public factory composition observations');
  assert(view.importIdentity?.plan?.sha256&&view.importIdentity.metadata.sha256&&view.importIdentity.receipt.sha256,'Sealed import identity references');
  return true;
}
export function assertImportRetirement(view){
  assert(view?.state==='closed'&&view.stage===true&&view.clock==='closed','Original terminal owners');
  equal(view.scopes,['closed','closed'],'Original Scopes');
  for(const key of ['controllers','bitmaps','parents','sheets','leases','textures'])equal(view[key],[true],'Original retirement '+key);
  equal(view.provider,{loads:1,disposalAttempts:1,disposals:1,exactOriginals:[true]},'Exact original provider disposal');
  equal(view.cleanupErrors,0,'No cleanup failure');equal(view.cleanupFailures,[],'No cleanup failures');equal(view.diagnostics,[],'No cleanup diagnostics');return true;
}
