// First-party Apache-2.0 private native collection support. No product evaluation.
// The restricted literal reader is adapted from tools/sequence-player/file-graph.mjs.
// B1's five-entry graph, six modes, budgets and S01-S04 policy remain unchanged.
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const ALIAS='#egret-textured-frame-state';
// Lexical recognition is separate from each collector's exact parent/target admission.
export const MANIFEST_ALIAS='#egret-manifest-resources';
export const REGISTRY='packages/engine/dist/internal/texturedFrameState.js';
export const REGISTRY_SOURCE='packages/engine/src/internal/texturedFrameState.ts';
export const ENTRIES=['packages/engine/dist/index.js','packages/engine/dist/web/webgpu.js'];
export const CONTROL_IDS=['C01-no-op-mesh','C02-reverse-painter','C03-omit-light-alpha','C04-omit-opacity','C05-detach-light','C06-remove-clip','C07-double-premultiply','C08-wrong-crop','C09-wrong-UV','C10-nominal-DPR','C11-wrong-clear','C12-channel-order'];
export const LIMITS=Object.freeze({modules:128,moduleBytes:1048576,graphBytes:4194304,artifactBytes:4194304,totalArtifactBytes:16777216,eventsPerWindow:128,requestsPerWindow:512});
// The growing source ledger is metadata, never a served JavaScript module.
export const inputByteLimit=relative=>relative==='source-origin.json'?4194304:LIMITS.moduleBytes;
const privateRefusals=new WeakSet();
const ownedGraphs=new WeakSet(),ownedCopies=new WeakSet(),ownedCaptures=new WeakSet();
export function incomplete(reason,details={},cause){const error=new Error('TEXTURED_COLLECTOR_INCOMPLETE:'+reason,{cause});
  Object.assign(error,{reason,details});privateRefusals.add(error);return error;}
export const isIncomplete=error=>privateRefusals.has(error);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const samePath=(a,b)=>(process.platform==='win32'?a.replaceAll('\\','/').toLowerCase():a)===(process.platform==='win32'?b.replaceAll('\\','/').toLowerCase():b);
export function inside(root,file){const tail=path.relative(root,file);return tail===''||(!path.isAbsolute(tail)&&tail!=='..'&&!tail.startsWith('..'+path.sep));}
export function requirePolicy(condition,reason,details={}){if(!condition)throw incomplete(reason,details);}
export const fault=error=>({name:typeof error?.name==='string'?error.name:'Unknown',message:typeof error?.message==='string'?error.message.slice(0,16000):'Non-error rejection',
  ...(isIncomplete(error)?{reason:error.reason,details:error.details}:{}),cause:typeof error?.cause?.message==='string'?error.cause.message.slice(0,16000):null});
export async function directoryChain(directory){for(let current=directory;;current=path.dirname(current)){
  const info=await lstat(current);requirePolicy(info.isDirectory()&&!info.isSymbolicLink()&&samePath(await realpath(current),current),'DIRECTORY_ALIAS',{path:current});
  if(path.dirname(current)===current)break;}}
export async function freshOutput(requested,repository){const output=path.resolve(requested);
  requirePolicy(path.isAbsolute(requested)&&samePath(requested,output)&&!inside(repository,output),'OUTPUT_PATH');
  try{await lstat(output);throw incomplete('OUTPUT_EXISTS');}catch(error){if(error?.code!=='ENOENT')throw error;}
  await directoryChain(path.dirname(output));return output;
}
export async function readIdentity(file,maxBytes=LIMITS.moduleBytes){
  const absolute=await realpath(file),info=await lstat(absolute);
  requirePolicy(info.isFile()&&info.size<=maxBytes,'FILE_BUDGET',{path:absolute,size:info.size,maxBytes});
  const body=await readFile(absolute);requirePolicy(body.length===info.size,'FILE_CHANGED_DURING_READ',{path:absolute});
  return {path:absolute,bytes:body.length,sha256:sha256(body),body};
}
export const descriptor=row=>({path:row.path,bytes:row.bytes,sha256:row.sha256});
// Compact JSON preserves every transferred field and byte within the fixed artifact caps.
export function jsonBytes(value){return Buffer.from(JSON.stringify(value)+'\n');}
export function artifactStore(output){let total=0;const records=new Map();
  return {records,async save(name,bytes){requirePolicy(typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name),'ARTIFACT_NAME');
    requirePolicy(!records.has(name)&&bytes.length<=LIMITS.artifactBytes&&total+bytes.length<=LIMITS.totalArtifactBytes,'ARTIFACT_BUDGET',{name,bytes:bytes.length,total});
    const file=path.join(output,name);await writeFile(file,bytes,{flag:'wx'});total+=bytes.length;
    const row={name,path:file,bytes:bytes.length,sha256:sha256(bytes)};records.set(name,row);return row;},
    async json(name,value){return this.save(name,jsonBytes(value));},
    async reread(){const observations=[];for(const before of records.values()){
      try{const after=descriptor(await readIdentity(before.path,LIMITS.artifactBytes));observations.push({before,after,stable:after.bytes===before.bytes&&after.sha256===before.sha256&&samePath(after.path,before.path)});}
      catch(error){observations.push({before,error:fault(error),stable:false});}}
      return {accepted:observations.every(row=>row.stable),observations};}};
}

function tokens(text){const out=[];let index=0;while(index<text.length){const start=index,char=text[index];
  if(/\s/.test(char)){index++;continue;}if(text.startsWith('//',index)){index=text.indexOf('\n',index+2);if(index<0)break;continue;}
  if(text.startsWith('/*',index)){const end=text.indexOf('*/',index+2);requirePolicy(end>=0,'MODULE_COMMENT');index=end+2;continue;}
  // These exact expression prefixes cannot end a division operand. The logical-or
  // pair must be contiguous punctuation; quoted lookalikes retain ordinary scanning.
  const previous=out.at(-1),beforePrevious=out.at(-2);
  const regexpStart=previous?.kind==='punctuation'&&(['(','!'].includes(previous.value)
    ||previous.value==='|'&&beforePrevious?.kind==='punctuation'&&beforePrevious.value==='|'&&beforePrevious.end===previous.start);
  if(char==='/'&&regexpStart){
    index++;let inClass=false,closed=false;
    while(index<text.length){const value=text[index++];
      requirePolicy(!/[\r\n\u2028\u2029]/.test(value),'MODULE_REGEXP');
      if(value==='\\'){requirePolicy(index<text.length&&!/[\r\n\u2028\u2029]/.test(text[index]),'MODULE_REGEXP');index++;continue;}
      if(value==='[')inClass=true;else if(value===']')inClass=false;
      else if(value==='/'&&!inClass){closed=true;break;}
    }
    requirePolicy(closed&&!inClass,'MODULE_REGEXP');const flags=new Set();
    while(index<text.length&&/[A-Za-z]/.test(text[index])){const flag=text[index++];
      requirePolicy('dgimsuy'.includes(flag)&&!flags.has(flag),'MODULE_REGEXP');flags.add(flag);}
    out.push({kind:'regexp',value:'',start,end:index});continue;
  }
  if(char==='"'||char==="'"){index++;while(index<text.length&&text[index]!==char){if(text[index]==='\\')index++;index++;}
    requirePolicy(index<text.length,'MODULE_STRING');index++;out.push({kind:'string',value:text.slice(start+1,index-1),start,end:index});continue;}
  if(char==='`'){index++;while(index<text.length&&text[index]!=='`'){if(text[index]==='\\')index++;index++;}
    requirePolicy(index<text.length,'MODULE_TEMPLATE');const body=text.slice(start+1,index++);requirePolicy(!/\bimport\b/.test(body),'MODULE_TEMPLATE_IMPORT');continue;}
  if(/[A-Za-z_$]/.test(char)){index++;while(index<text.length&&/[A-Za-z0-9_$]/.test(text[index]))index++;
    out.push({kind:'word',value:text.slice(start,index),start,end:index});continue;}index++;out.push({kind:'punctuation',value:char,start,end:index});}
  return out;
}
export function literalImports(text){const lexical=tokens(text),result=[];
  const admit=token=>{requirePolicy(token?.kind==='string'&&token.value.length>0&&!/[\\\s?%:\0]/.test(token.value),'MODULE_IMPORT_LITERAL');
    requirePolicy(!token.value.includes('#')||token.value===ALIAS||token.value===MANIFEST_ALIAS,'MODULE_PRIVATE_ALIAS_UNKNOWN',{specifier:token.value});result.push(token.value);};
  for(let index=0;index<lexical.length;index++){const token=lexical[index];if(token.kind!=='word')continue;
    if(token.value==='import'){const next=lexical[index+1];requirePolicy(next?.value!=='.','MODULE_IMPORT_META');
      if(next?.value==='('){admit(lexical[index+2]);requirePolicy(lexical[index+3]?.value===')','MODULE_DYNAMIC_IMPORT');}
      else if(next?.kind==='string')admit(next);else{let cursor=index+1;while(cursor<lexical.length&&![';','from'].includes(lexical[cursor].value))cursor++;
        requirePolicy(lexical[cursor]?.value==='from','MODULE_STATIC_IMPORT');admit(lexical[cursor+1]);}}
    else if(token.value==='export'&&['{','*'].includes(lexical[index+1]?.value)){let cursor=index+1;while(cursor<lexical.length&&![';','from'].includes(lexical[cursor].value))cursor++;
      if(lexical[cursor]?.value==='from')admit(lexical[cursor+1]);}}
  return result;
}
const HOSTS=['packages/engine/dist/web/CanvasHost.js','packages/engine/dist/web/WebGPUHost.js'];
const ENGINE='packages/engine/dist/Engine.js';
export function sourceCounterpart(relative){const match=/^packages\/(contracts|runtime|engine)\/dist\/(.+)\.js$/.exec(relative);
  if(!match)return null;const [,name,tail]=match;return `packages/${name}/${name==='engine'&&/^(web|rendering)\//.test(tail)?'':'src/'}${tail}.ts`;}
export function aliases(){return {[ALIAS]:'/'+REGISTRY,'@egret/engine':'/'+ENTRIES[0],'@egret/engine/webgpu':'/'+ENTRIES[1],
  '@egret/contracts':'/packages/contracts/dist/index.js','@egret/contracts/resources':'/packages/contracts/dist/resources/index.js','@egret/runtime':'/packages/runtime/dist/index.js','robust-predicates':'/packages/engine/node_modules/robust-predicates/index.js'};}
export function chosenMap(mode){requirePolicy(mode==='baseline'||CONTROL_IDS.includes(mode),'MAP_MODE');const imports=aliases(),scopes={};
  if(mode!=='baseline'){const prefix='/copy/'+mode+'/';scopes[prefix]={[ALIAS]:prefix+REGISTRY,'@egret/engine':prefix+ENTRIES[0],'@egret/engine/webgpu':prefix+ENTRIES[1]};}
  return {imports,scopes};
}
export function resolveSelected(specifier,parent,mode,map){const selectedPrefix=mode==='baseline'?'/':'/copy/'+mode+'/';
  const scoped=mode!=='baseline'&&parent.startsWith(selectedPrefix),prefix=scoped?selectedPrefix:'/';
  const effective={...map.imports,...(scoped?map.scopes[selectedPrefix]:{})};
  const expected=chosenMap(mode);requirePolicy(JSON.stringify(map)===JSON.stringify(expected),'MAP_EXACT_SELECTED');
  if(specifier.startsWith('#')){requirePolicy(specifier===ALIAS,'PRIVATE_ALIAS_UNKNOWN',{specifier});
    const parentPath=parent.startsWith(prefix)?parent.slice(prefix.length):parent.slice(1);
    requirePolicy(HOSTS.includes(parentPath),'PRIVATE_ALIAS_PARENT',{parent,specifier});
    requirePolicy(effective[ALIAS]===prefix+REGISTRY,'PRIVATE_ALIAS_SELECTED',{parent,actual:effective[ALIAS]});return effective[ALIAS];}
  if(specifier.startsWith('./')||specifier.startsWith('../')){requirePolicy(specifier.endsWith('.js')||specifier.endsWith('.mjs'),'RELATIVE_MODULE_EXTENSION',{specifier});
    const url=new URL(specifier,'http://collector.invalid'+parent).pathname;
    requirePolicy(url.startsWith(prefix)&&!url.includes('%'),'RELATIVE_MODULE_ESCAPE',{parent,specifier,url});return url;}
  requirePolicy(Object.hasOwn(effective,specifier),'BARE_IMPORT_UNKNOWN',{parent,specifier});return effective[specifier];
}
export async function collectPublicGraph(repository,retain,sourceProfile='historical'){
  // Named consumers opt into bounded source successors; the historical default
  // and every byte, import, registry and containment check remain unchanged.
  requirePolicy(['historical','m15-textured','m12-recipe5','m31-textured'].includes(sourceProfile),'GRAPH_SOURCE_PROFILE');
  // The UI successor adds only the eager ownership bridge and managed markers.
  // Historical profiles retain their original finite admission budgets.
  const moduleLimit=sourceProfile==='historical'?LIMITS.modules:sourceProfile==='m31-textured'?134:132;
  const root=await realpath(repository),modules=new Map();let total=0,sourceRegistry;
  const map=chosenMap('baseline'),robustRoot=await realpath(path.join(root,'packages/engine/node_modules/robust-predicates'));
  async function visit(relative){const logical=path.join(root,relative),physical=await realpath(logical);
    requirePolicy(inside(root,physical)&&relative.endsWith('.js'),'GRAPH_CONTAINMENT',{relative,physical});
    if(/^packages\/(engine|runtime|contracts)\/dist\//.test(relative))requirePolicy(samePath(physical,logical),'EMISSION_EXACT_PATH',{relative,physical});
    requirePolicy(!/(?:^|\/)CanvasHost\.js$|(?:^|\/)canvas\.js$/.test(relative),'TEXTURED_CANVAS_MODULE',{relative});
    if(modules.has(relative))return;requirePolicy(modules.size<moduleLimit,'GRAPH_MODULE_COUNT');
    const item=await readIdentity(logical);total+=item.bytes;requirePolicy(total<=LIMITS.graphBytes,'GRAPH_TOTAL_BYTES');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(item.body),record={relative,url:'/'+relative,...item,edges:[]};modules.set(relative,record);retain(item,'original-emission');
    const source=sourceCounterpart(relative);if(source!==null){
      let sourceIdentity;try{sourceIdentity=await readIdentity(path.join(root,source));}catch(error){
        if(relative===REGISTRY&&error?.code==='ENOENT')throw incomplete('REGISTRY_EXACT_SOURCE_MISSING',{path:REGISTRY_SOURCE},error);throw error;}
      requirePolicy(samePath(sourceIdentity.path,path.join(root,source)),'SOURCE_EXACT_PATH',{source,actual:sourceIdentity.path});retain(sourceIdentity,'original-source');
      if(relative===REGISTRY)sourceRegistry=descriptor(sourceIdentity);
    }else requirePolicy(inside(robustRoot,physical),'FOUNDATIONAL_CLOSURE',{relative,physical});
    for(const specifier of literalImports(text)){const url=resolveSelected(specifier,record.url,'baseline',map);record.edges.push({specifier,url});await visit(url.slice(1));}}
  for(const entry of ENTRIES)await visit(entry);
  requirePolicy(modules.has(ENGINE)&&modules.has(HOSTS[1])&&modules.has(REGISTRY),'PUBLIC_CONSUMER_GRAPH');
  const result={root,modules,totalBytes:total,map,sourceRegistry};ownedGraphs.add(result);return result;
}
export async function makeCopy({graph,output,control,retain}){
  requirePolicy(ownedGraphs.has(graph),'GRAPH_ORIGIN');
  requirePolicy(CONTROL_IDS.includes(control.id)&&typeof control.target==='string'&&graph.modules.has(control.target)&&control.target.startsWith('packages/engine/dist/'),'COPY_TARGET');
  requirePolicy(control.target!==REGISTRY&&typeof control.before==='string'&&control.before.length>0&&typeof control.after==='string'&&control.after!==control.before,'COPY_ONE_FILE_PATCH');
  const target=graph.modules.get(control.target);requirePolicy(target.sha256===control.originalSHA256,'COPY_TARGET_SOURCE_HASH',{id:control.id});
  const text=target.body.toString('utf8'),count=text.split(control.before).length-1;
  requirePolicy(count===1,'COPY_LITERAL_OCCURRENCE',{id:control.id,count});
  const changed=Buffer.from(text.replace(control.before,control.after));requirePolicy(sha256(changed)===control.changedSHA256,'COPY_PATCH_HASH',{id:control.id});
  requirePolicy(JSON.stringify(literalImports(changed.toString('utf8')))===JSON.stringify(literalImports(text)),'COPY_IMPORT_GRAPH_CHANGED',{id:control.id});
  const prefix='/copy/'+control.id+'/',directory=path.join(output,'copy',control.id),rows=[];
  await mkdir(directory,{recursive:true});await directoryChain(directory);
  for(const module of graph.modules.values()){if(!module.relative.startsWith('packages/engine/dist/'))continue;
    const body=module.relative===control.target?changed:module.body,file=path.join(directory,module.relative);await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,body,{flag:'wx'});const item=await readIdentity(file);requirePolicy(samePath(item.path,file),'COPY_EXACT_PATH');retain(item,'selected-copy');
    rows.push({relative:module.relative,url:prefix+module.relative,...descriptor(item),originalSHA256:module.sha256,changed:module.relative===control.target});}
  requirePolicy(rows.filter(row=>row.changed).length===1,'COPY_CHANGED_FILES');
  requirePolicy(rows.find(row=>row.relative===REGISTRY)?.sha256===graph.modules.get(REGISTRY).sha256,'COPY_REGISTRY_CHANGED');
  const result={id:control.id,directory,prefix,changedFiles:1,target:control.target,rows,control};ownedCopies.add(result);return result;
}
export async function captureRegistry({repository,graph,copy=null,map}){
  requirePolicy(ownedGraphs.has(graph)&&samePath(await realpath(repository),graph.root)&&(!copy||ownedCopies.has(copy)),'REGISTRY_CAPTURE_ORIGIN');
  const mode=copy?.id??'baseline',prefix=copy?.prefix??'/',selectedFile=copy?path.join(copy.directory,REGISTRY):path.join(repository,REGISTRY);
  const source=await readIdentity(path.join(repository,REGISTRY_SOURCE)),original=await readIdentity(path.join(repository,REGISTRY)),selected=await readIdentity(selectedFile);
  for(const [item,expected]of[[source,path.join(repository,REGISTRY_SOURCE)],[original,path.join(repository,REGISTRY)],[selected,selectedFile]])
    requirePolicy(samePath(item.path,expected),'REGISTRY_AUTHORITY_PATH',{expected,actual:item.path});
  requirePolicy(source.sha256===graph.sourceRegistry.sha256&&source.bytes===graph.sourceRegistry.bytes,'REGISTRY_SOURCE_CAPTURE_CHANGED');
  requirePolicy(original.sha256===graph.modules.get(REGISTRY).sha256&&original.bytes===graph.modules.get(REGISTRY).bytes,'REGISTRY_EMISSION_CAPTURE_CHANGED');
  requirePolicy(selected.sha256===original.sha256&&selected.bytes===original.bytes,'REGISTRY_COPY_CAPTURE_CHANGED');
  const consumers=[];for(const parent of[ENGINE,HOSTS[1]]){const module=graph.modules.get(parent);
    const registryEdges=module.edges.filter(edge=>edge.url==='/'+REGISTRY);requirePolicy(registryEdges.length===1,'REGISTRY_CONSUMER_EDGE',{parent});
    const specifier=registryEdges[0].specifier,url=resolveSelected(specifier,prefix+parent,mode,map);
    requirePolicy(url===prefix+REGISTRY,'REGISTRY_SINGLETON_URL',{parent,url,expected:prefix+REGISTRY});
    consumers.push({parent:prefix+parent,specifier,url,moduleCollected:true,scope:'Actual selected-map resolver; browser request/load evidence recorded separately'});}
  if(copy){const retained=copy.rows.find(row=>row.relative===REGISTRY);
    requirePolicy(retained&&retained.path===selected.path&&retained.bytes===selected.bytes&&retained.sha256===selected.sha256,'REGISTRY_COPY_RETAINED_MANIFEST');}
  const roles=[{role:'originalSource',before:descriptor(source)},{role:'originalEmitted',before:descriptor(original)},{role:'selectedEmitted',before:descriptor(selected)}]
    .map(row=>Object.freeze({...row,before:Object.freeze(row.before)}));
  const result=Object.freeze({mode,selectedURL:prefix+REGISTRY,consumers:Object.freeze(consumers.map(row=>Object.freeze(row))),roles:Object.freeze(roles)});
  ownedCaptures.add(result);return result;
}
export async function rereadRegistry(captured){const observations=[];
  requirePolicy(ownedCaptures.has(captured),'REGISTRY_REREAD_ORIGIN');
  // Read all three even after a source/emission/copy difference or missing file; preserve retained before.
  for(const row of captured.roles){try{const after=descriptor(await readIdentity(row.before.path));observations.push({...row,after,
    stable:samePath(after.path,row.before.path)&&after.bytes===row.before.bytes&&after.sha256===row.before.sha256});}
    catch(error){observations.push({...row,error:fault(error),stable:false});}}
  const firstFailure=observations.find(row=>!row.stable),lost=observations.filter(row=>row.error);
  // An earlier failed read has priority and supplies no invented change diagnosis.
  const reason=firstFailure?.after?{code:({originalSource:'REGISTRY_SOURCE_CHANGED',originalEmitted:'REGISTRY_EMISSION_CHANGED',selectedEmitted:'REGISTRY_COPY_CHANGED'})[firstFailure.role],role:firstFailure.role,
    before:firstFailure.before,after:firstFailure.after}:null;
  return {mode:captured.mode,accepted:observations.every(row=>row.stable),reason,readFailures:lost,observations};
}
export async function rereadAll(identities){const observations=[];for(const before of identities.values()){
  try{const after=descriptor(await readIdentity(before.path,Math.max(before.bytes,LIMITS.moduleBytes)));observations.push({before,after,
    stable:samePath(after.path,before.path)&&after.bytes===before.bytes&&after.sha256===before.sha256});}
  catch(error){observations.push({before,error:fault(error),stable:false});}}
  return {accepted:observations.every(row=>row.stable),observations};
}
