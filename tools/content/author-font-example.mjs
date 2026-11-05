// SPDX-License-Identifier: Apache-2.0
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createProjectStore} from '@egret/project';
import {buildContentProject} from './build.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Reuses bundled OFL fonts unchanged; each run publishes a new immutable build. */
export async function authorFontExample(){
 const parent=path.join(root,'work/font-resources');mkdirSync(parent,{recursive:true});
 const runRoot=mkdtempSync(path.join(parent,'run-'));for(const name of ['sources','cache','build'])mkdirSync(path.join(runRoot,name));
 const definitions=[['latin','NotoSans-Regular.ttf','Noto Sans','truetype'],['arabic','NotoSansArabic-Regular.ttf','Noto Sans Arabic','truetype'],['cjk','NotoSansCJKsc-Regular.otf','Noto Sans CJK SC','opentype'],['alternate','NotoSansCJKsc-Regular.otf','Noto Sans','opentype']];
 const files=[],recipes=[];
 for(const [id,file,family,flavor]of definitions){
  const bytes=readFileSync(path.join(root,'examples/paragraph-panel/vendor/fonts',file));
  const sourceId='f_'+(id==='alternate'?'cjk':id);
  if(id!=='alternate'){writeFileSync(path.join(runRoot,'sources',file),bytes,{flag:'wx'});files.push({id:sourceId,path:'sources/'+file,role:'source',mediaType:flavor==='truetype'?'font/ttf':'font/otf',sha256:sha(bytes),byteLength:bytes.length});}
  recipes.push({resourceId:'e_'+id,sourceFileId:sourceId,importer:{id:'egret.font',version:'1.0.0'},settings:{family,flavor},artifactFormatVersion:'egret.font/1',dependencies:[],provenance:{origin:'Bundled Noto font; see examples/paragraph-panel/vendor/manifest.json',license:'OFL-1.1',notice:'Unmodified font bytes; family is a runtime alias. See third-party notices and bundled OFL licenses.',sha256:sha(bytes)}});
 }
 const snapshot={projectSchemaVersion:'1.0',projectId:'p_font_example',revision:0,name:'Font resource generations',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files,retiredEntityIds:[],retiredFileIds:[]};
 const admitted=createProjectStore(snapshot);if(!admitted.ok)throw Error(JSON.stringify(admitted.diagnostics));
 const result=await buildContentProject({projectStore:admitted.value,projectRoot:runRoot,recipe:{format:'egret.content-build-recipe/1',targetProfile:'web-shared/1',recipes},cacheRoot:path.join(runRoot,'cache'),outputRoot:path.join(runRoot,'build'),selectorId:'e_fonts',transactionId:'t_fonts'});
 if(result.status!=='adopted')throw Error('FONT_EXAMPLE_ADOPTION');
 const manifestBytes=readFileSync(path.join(runRoot,result.manifestPath));
 const config={format:'egret.font-example/1',manifestPath:result.manifestPath,manifestSha256:sha(manifestBytes),initial:['e_latin','e_arabic','e_cjk'],alternate:['e_alternate','e_arabic']};
 writeFileSync(path.join(runRoot,'browser-config.json'),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
 return {runRoot,configPath:path.relative(root,path.join(runRoot,'browser-config.json')).split(path.sep).join('/'),generationId:result.generationId};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(await authorFontExample()));
