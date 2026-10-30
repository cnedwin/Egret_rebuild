// SPDX-License-Identifier: Apache-2.0
// Finite validator for this example's pinned CLI export, not general Project admission.
const expected=['e_first','e_pages','e_second'];
function check(value,message){if(!value)throw new Error('Candidate selection: '+message);}
function indexed(rows){check(Array.isArray(rows),'expected a record array');const map=new Map(rows.map(row=>[row?.id,row]));check(map.size===rows.length&&!map.has(undefined),'duplicate or missing record identity');return map;}
export function selectExampleGeneration(snapshot,config){
 check(snapshot?.projectSchemaVersion==='1.0'&&snapshot.projectId==='p_atlas_pages'&&snapshot.revision===1,'expected the committed first example revision');
 check(config.selectorId==='e_generation','expected the explicit example selector');
 const entities=indexed(snapshot.entities),files=indexed(snapshot.files),selector=entities.get(config.selectorId);
 check(selector?.kind==='egret.content-build-generation'&&selector.dataSchemaVersion==='1','missing generation selector');
 const data=selector.data;check(data?.targetProfile==='web-shared/1'&&data.generationId===config.generationId&&data.manifestFileId==='f_content_manifest_'+data.generationId,'generation identity differs');
 check(Array.isArray(data.resourceIds)&&JSON.stringify([...data.resourceIds].sort())===JSON.stringify(expected),'resource coverage differs');
 check(Array.isArray(selector.references),'missing selector references');const refs=new Map(selector.references.map(row=>[row.slot,row]));check(refs.size===selector.references.length,'duplicate selector reference');
 const manifestRef=refs.get('manifest');check(manifestRef?.target==='file'&&manifestRef.id===data.manifestFileId&&manifestRef.expectedRole==='configuration','manifest reference differs');
 const manifestFile=files.get(data.manifestFileId);check(manifestFile?.role==='configuration'&&manifestFile.mediaType==='application/json'&&manifestFile.path===config.manifestPath&&manifestFile.sha256===config.manifest.sha256&&manifestFile.byteLength===config.manifest.byteLength,'manifest file differs from its selected pin');
 for(const [index,id] of data.resourceIds.entries()){
  const resource=entities.get(id),ref=refs.get('resource:'+index);check(ref?.target==='entity'&&ref.id===id&&ref.expectedKind==='egret.resource','resource reference differs');
  check(resource?.kind==='egret.resource'&&resource.dataSchemaVersion==='1'&&resource.data.targetProfile===data.targetProfile,'resource target differs');
  const file=files.get(resource.data.artifactFileId);check(file?.role==='asset'&&selector.references.some(r=>r.target==='file'&&r.id===file.id&&r.expectedRole==='asset'&&r.slot.startsWith('artifact:')),'resource artifact is not selected');
 }
 check(selector.references.filter(row=>row.slot.startsWith('resource:')).length===expected.length,'extra resource reference');
 return {snapshot,manifestFile,entities,files,resourceIds:[...data.resourceIds],targetProfile:data.targetProfile,generationId:data.generationId};
}
export function matchExampleManifest(selection,manifest){
 check(manifest.projectId===selection.snapshot.projectId&&manifest.targetProfile===selection.targetProfile,'manifest project or target differs');
 check(JSON.stringify(manifest.versions)===JSON.stringify(selection.snapshot.versions),'manifest versions differ');
 check(JSON.stringify(manifest.entries.map(row=>row.id).sort())===JSON.stringify(expected),'manifest resource coverage differs');
 for(const entry of manifest.entries){
  const resource=selection.entities.get(entry.id),file=selection.files.get(resource.data.artifactFileId);
  for(const key of ['id','path','role','mediaType','sha256','byteLength'])check(entry.artifact[key]===file[key],'manifest artifact differs from the committed file');
  check(JSON.stringify(entry.dependencies)===JSON.stringify(resource.data.dependencies),'manifest dependencies differ');
 }
 return manifest;
}
