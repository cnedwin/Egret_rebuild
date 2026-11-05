// SPDX-License-Identifier: Apache-2.0
// Two original same-ID generations through the existing content builder.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {PNG} from 'pngjs';
import {runContentCLI} from '../../tools/build-content.mjs';
import {canonicalTextBytes,fingerprintFile,physicalPathKey,samePhysicalPath} from '../../tools/lib/file-identity.mjs';
export async function author(parent){
 physicalPathKey(parent);if(!fs.statSync(parent).isDirectory()||!samePhysicalPath(parent,fs.realpathSync(parent)))throw Error('Canonical existing parent required');
 const runRoot=fs.mkdtempSync(path.join(parent,'run-')),result={};
 for(const version of ['v1','v2']){
  const dir=path.join(runRoot,version);for(const part of ['sources','cache','build'])fs.mkdirSync(path.join(dir,part),{recursive:true});
  const original=new URL('../sequence-controls/sources/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',original),'utf8'));
  let png=fs.readFileSync(new URL('page.png',original));
  if(version==='v2'){const image=PNG.sync.read(png);image.data.set([0,255,255,255,255,0,255,255,0,0,255,255,255,255,255,255]);png=PNG.sync.write(image);for(const f of atlas.frames)f.duration=500;}
  const inputs=[['page.png','f_page','image/png',png],['atlas.json','f_atlas','application/json',canonicalTextBytes(JSON.stringify(atlas,null,2))]];
  const files=inputs.map(([name,id,mediaType,bytes])=>{fs.writeFileSync(path.join(dir,'sources',name),bytes,{flag:'wx'});return {id,path:'sources/'+name,role:'source',mediaType,sha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};});
  const project={projectSchemaVersion:'1.0',projectId:'p_sequence_reset',revision:0,name:'Sequence RESET '+version,versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files,retiredEntityIds:[],retiredFileIds:[]};
  const recipe=JSON.parse(fs.readFileSync(new URL('recipe.json',original),'utf8'));recipe.recipes=recipe.recipes.slice(0,3);
  fs.writeFileSync(path.join(dir,'project.json'),canonicalTextBytes(JSON.stringify(project,null,2)),{flag:'wx'});fs.writeFileSync(path.join(dir,'recipe.json'),canonicalTextBytes(JSON.stringify(recipe,null,2)),{flag:'wx'});
  const built=await runContentCLI(['--root',dir,'--project','project.json','--recipe','recipe.json','--cache',path.join(dir,'cache'),'--output',path.join(dir,'build'),'--snapshot-out','candidate.json','--receipt','receipt.json','--selector','e_generation','--transaction','t_sequence_reset_'+version]);
  if(built.status!=='adopted')throw Error('Content build refused; retain '+dir);
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8')),pin=fingerprintFile(dir,receipt.manifestPath);
  result[version]={base:version+'/',manifestPath:receipt.manifestPath,manifest:{sha256:pin.sha256,byteLength:pin.bytes},generationId:receipt.generationId};
 }
 if(result.v1.generationId===result.v2.generationId)throw Error('Generations aliased');
 fs.writeFileSync(path.join(runRoot,'config.json'),canonicalTextBytes(JSON.stringify(result,null,2)),{flag:'wx'});return {runRoot,config:result};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await author(path.resolve(process.argv[2]))));
