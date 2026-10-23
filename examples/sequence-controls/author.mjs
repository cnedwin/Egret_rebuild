// SPDX-License-Identifier: Apache-2.0
// Original fixture authoring through the existing content CLI; no repository build.
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runContentCLI} from '../../tools/build-content.mjs';
import {canonicalTextBytes,fingerprintFile,physicalPathKey,samePhysicalPath} from '../../tools/lib/file-identity.mjs';
const sources=new URL('./sources/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const recipeBytes=fs.readFileSync(new URL('recipe.json',sources));
export const recipes=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(recipeBytes));
export async function authorSequenceExample(parent){
 physicalPathKey(parent);const state=fs.lstatSync(parent);if(!state.isDirectory()||state.isSymbolicLink()||!samePhysicalPath(parent,fs.realpathSync(parent)))throw Error('Existing canonical absolute parent required.');
 const runRoot=fs.mkdtempSync(path.join(parent,'run-'));for(const folder of ['sources','cache','build'])fs.mkdirSync(path.join(runRoot,folder));
 const files=[['page.png','f_page','image/png'],['atlas.json','f_atlas','application/json'],['decimal-atlas.json','f_decimal','application/json']].map(([name,id,mediaType])=>{const bytes=fs.readFileSync(new URL(name,sources));fs.writeFileSync(path.join(runRoot,'sources',name),bytes,{flag:'wx'});return {id,path:'sources/'+name,role:'source',mediaType,sha256:sha(bytes),byteLength:bytes.length};});
 const project={projectSchemaVersion:'1.0',projectId:'p_sequence_controls',revision:0,name:'Original sequence controls',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files,retiredEntityIds:[],retiredFileIds:[]};
 fs.writeFileSync(path.join(runRoot,'project.json'),canonicalTextBytes(JSON.stringify(project,null,2)),{flag:'wx'});
 fs.writeFileSync(path.join(runRoot,'recipe.json'),recipeBytes,{flag:'wx'});
 const result=await runContentCLI(['--root',runRoot,'--project','project.json','--recipe','recipe.json','--cache',path.join(runRoot,'cache'),'--output',path.join(runRoot,'build'),'--snapshot-out','candidate.json','--receipt','receipt.json','--selector','e_generation','--transaction','t_sequence_example']);
 if(result.status!=='adopted')throw Error('Inspect preserved generation receipt: content not adopted.');
 const receipt=JSON.parse(fs.readFileSync(path.join(runRoot,'receipt.json'),'utf8')),snapshot=fingerprintFile(runRoot,'candidate.json');
 const config={format:'egret.sequence-controls-content/1',projectBaseUrl:'./',snapshotPath:'candidate.json',snapshot:{sha256:snapshot.sha256,byteLength:snapshot.bytes},selectorId:'e_generation',generationId:receipt.generationId,manifestPath:receipt.manifestPath,manifest:receipt.receipt.manifest};
 fs.writeFileSync(path.join(runRoot,'browser-config.json'),canonicalTextBytes(JSON.stringify(config,null,2)),{flag:'wx'});return {runRoot,config,status:result.status};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){if(process.argv.length!==4||process.argv[2]!=='--parent')throw Error('Use --parent existing-absolute-directory');console.log(JSON.stringify(await authorSequenceExample(process.argv[3])));}
