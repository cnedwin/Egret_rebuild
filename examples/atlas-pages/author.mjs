// SPDX-License-Identifier: Apache-2.0
// First-party source authoring and actual existing content build/adoption.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';
import {createProjectStore} from '@egret/project';import {buildContentProject} from '../../tools/content/build.mjs';
import {firstPixels,secondPixels,atlasPagesSource,provenance} from './fixture.mjs';
const {PNG}=createRequire(import.meta.url)('pngjs'),repository=path.resolve(import.meta.dirname,'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createAtlasPagesProject(parent){
 const owner=fs.realpathSync(parent);if(!fs.statSync(owner).isDirectory())throw Error('Atlas example parent must be a directory');
 const runRoot=fs.mkdtempSync(path.join(owner,'run-'));for(const name of ['sources','cache','build'])fs.mkdirSync(path.join(runRoot,name));
 const first=PNG.sync.write({width:4,height:2,data:Buffer.from(firstPixels)},{colorType:6,inputColorType:6,bitDepth:8});
 const second=PNG.sync.write({width:4,height:2,data:Buffer.from(secondPixels)},{colorType:6,inputColorType:6,bitDepth:8});
 const metadata=Buffer.from(JSON.stringify(atlasPagesSource(),null,2)+'\n');
 const sources=[['first.png','f_first',first,'image/png'],['second.png','f_second',second,'image/png'],['pages.json','f_pages',metadata,'application/json']];
 const files=sources.map(([name,id,bytes,mediaType])=>{fs.writeFileSync(path.join(runRoot,'sources',name),bytes,{flag:'wx'});return {id,path:'sources/'+name,role:'source',mediaType,sha256:sha(bytes),byteLength:bytes.length};});
 const snapshot={projectSchemaVersion:'1.0',projectId:'p_atlas_pages',revision:0,name:'Authored atlas pages',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files,retiredEntityIds:[],retiredFileIds:[]};
 const recipe=(resourceId,sourceFileId,id,format,dependencies=[])=>({resourceId,sourceFileId,importer:{id,version:'1.0.0'},artifactFormatVersion:format,dependencies,settings:{},provenance});
 const recipes={format:'egret.content-build-recipe/1',targetProfile:'web-shared/1',recipes:[recipe('e_first','f_first','egret.png','png/1'),recipe('e_second','f_second','egret.png','png/1'),recipe('e_pages','f_pages','egret.atlas-pages','egret.atlas-pages/1',['e_first','e_second'])]};
 const parsed=createProjectStore(snapshot);if(!parsed.ok)throw Error(JSON.stringify(parsed.diagnostics));const store=parsed.value;
 return {runRoot,store,recipes,snapshot,first,second,metadata,options:{projectStore:store,projectRoot:runRoot,recipe:recipes,cacheRoot:path.join(runRoot,'cache'),outputRoot:path.join(runRoot,'build'),selectorId:'e_generation',transactionId:'t_atlas_pages'}};
}
export async function authorAtlasPagesExample(parent){
 if(parent===undefined){parent=path.join(repository,'work/atlas-pages');fs.mkdirSync(parent,{recursive:true});}
 const f=createAtlasPagesProject(parent),result=await buildContentProject(f.options);if(result.status!=='adopted')throw Error('Atlas example was not adopted');
 const candidate=Buffer.from(JSON.stringify(f.store.getSnapshot(),null,2)+'\n');fs.writeFileSync(path.join(f.runRoot,'candidate.json'),candidate,{flag:'wx'});
 const config={format:'egret.content-example/1',projectBaseUrl:'./',snapshotPath:'candidate.json',snapshot:{sha256:sha(candidate),byteLength:candidate.length},selectorId:'e_generation',manifestPath:result.manifestPath,manifest:result.receipt.manifest,generationId:result.generationId};
 const configuration=path.join(f.runRoot,'browser-config.json');fs.writeFileSync(configuration,JSON.stringify(config,null,2)+'\n',{flag:'wx'});return {...f,result,configuration};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const f=await authorAtlasPagesExample();console.log(JSON.stringify({runRoot:f.runRoot,configuration:f.configuration,status:f.result.status}));}catch(error){console.error(error);process.exitCode=1;}}
