// SPDX-License-Identifier: Apache-2.0
// First-party fixture authoring: every invocation keeps previous runs intact.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,realpathSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runContentCLI} from '../build-content.mjs';
const repository=path.resolve(import.meta.dirname,'../..');
const provenance={origin:'first-party synthetic fixture',license:'Apache-2.0',notice:'Original authored pixels and synthetic metadata; not an Aseprite exporter qualification.'};
export async function authorContentExample(parent){
 if(parent===undefined){parent=path.join(repository,'work/content-build-example');mkdirSync(parent,{recursive:true});}
 if(!path.isAbsolute(parent)||!lstatSync(parent).isDirectory()||lstatSync(parent).isSymbolicLink())throw new TypeError('Existing absolute parent directory required.');
 const runRoot=mkdtempSync(path.join(realpathSync(parent),'run-'));for(const name of ['sources','cache','build'])mkdirSync(path.join(runRoot,name));
 const files=[['page.png','f_page','image/png'],['other.png','f_other','image/png'],['atlas.json','f_atlas','application/json']].map(([name,id,mediaType])=>{
  const bytes=readFileSync(path.join(repository,'examples/content-build/sources',name));writeFileSync(path.join(runRoot,'sources',name),bytes,{flag:'wx'});
  return {id,path:'sources/'+name,role:'source',mediaType,sha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};
 });
 const snapshot={projectSchemaVersion:'1.0',projectId:'p_content_example',revision:0,name:'Generated content example',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files,retiredEntityIds:[],retiredFileIds:[]};
 const recipe=(resourceId,sourceFileId,id,artifactFormatVersion,dependencies=[],settings={})=>({resourceId,sourceFileId,importer:{id,version:'1.0.0'},settings,artifactFormatVersion,dependencies,provenance});
 const recipes={format:'egret.content-build-recipe/1',targetProfile:'web-shared/1',recipes:[recipe('e_page','f_page','egret.png','png/1'),recipe('e_other','f_other','egret.png','png/1'),recipe('e_atlas','f_atlas','egret.aseprite-atlas','egret.atlas/1',['e_page'],{pageName:'page.png'}),recipe('e_sequence','f_atlas','egret.sequence','egret.sequence/1',['e_atlas'])]};
 for(const [name,value] of [['project.json',snapshot],['recipe.json',recipes]])writeFileSync(path.join(runRoot,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const result=await runContentCLI(['--root',runRoot,'--project','project.json','--recipe','recipe.json','--cache',path.join(runRoot,'cache'),'--output',path.join(runRoot,'build'),'--snapshot-out','candidate.json','--receipt','receipt.json','--selector','e_generation','--transaction','t_example']);
 if(result.status!=='adopted')throw new Error('Example generation is ready but was not adopted. Inspect receipt.json.');
 const receipt=JSON.parse(readFileSync(path.join(runRoot,'receipt.json'),'utf8')),configuration=path.join(runRoot,'browser-config.json');
 const candidateBytes=readFileSync(path.join(runRoot,'candidate.json'));
 writeFileSync(configuration,JSON.stringify({format:'egret.content-example/1',projectBaseUrl:'./',snapshotPath:'candidate.json',snapshot:{sha256:createHash('sha256').update(candidateBytes).digest('hex'),byteLength:candidateBytes.length},selectorId:'e_generation',manifestPath:receipt.manifestPath,manifest:receipt.receipt.manifest,generationId:receipt.generationId},null,2)+'\n',{flag:'wx'});
 return {runRoot,configuration,status:result.status};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const args=process.argv.slice(2);if(args.length!==0&&(args.length!==2||args[0]!=='--parent'))throw new TypeError('Only optional --parent absolute-directory is accepted.');process.stdout.write(JSON.stringify(await authorContentExample(args[1]))+'\n');}catch(error){process.stderr.write(String(error?.stack??error)+'\n');process.exitCode=1;}}
