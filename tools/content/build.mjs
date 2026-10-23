// SPDX-License-Identifier: Apache-2.0
// The filesystem makes a generation ready; only the existing ProjectStore adopts it.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setImmediate as yieldTask} from 'node:timers/promises';
import {serializeProjectSnapshot,parseProjectSnapshot} from '@egret/project';
import {describeContentRecipes,bindContentArtifacts,createContentAdoption} from '@egret/project/resources';
import {evaluateResourceBuildKeys,serializeResourceManifest} from '@egret/contracts/resources';
import {ownerRelativePath,samePhysicalPath} from '../lib/file-identity.mjs';
import {readContentInput} from './input.mjs';
import {getContentProducer,buildContentResource} from './importers.mjs';
import {openContentStore} from './store.mjs';
const SOURCE_BUDGET=67108864,OUTPUT_BUDGET=134217728,SCANLINE_BUDGET=67108864;
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
function failure(code,message,cause){const error=new Error(message,cause===undefined?undefined:{cause});error.code=code;return error;}
function checked(result){if(!result.ok)throw failure('CONTENT_BUILD_ADMISSION','Content build admission refused.',result.diagnostics);return result.value;}
function cancelled(signal){return signal!==undefined&&Reflect.apply(aborted,signal,[]);}
function checkCancellation(signal){if(cancelled(signal))throw failure('CONTENT_BUILD_CANCELLED','Content build was cancelled before readiness.');}
const descriptor=file=>({name:file.name,mediaType:file.mediaType,sha256:sha(file.bytes),byteLength:file.bytes.length});
function boundedSum(before,amount,limit,name){if(!Number.isSafeInteger(amount)||amount<0||before+amount>limit)throw failure('CONTENT_BUILD_LIMIT',name+' budget exceeded.');return before+amount;}

/** Build sequentially from captured project data. Store ports are trusted callers;
 * source files, recipes and on-disk cache contents remain validated inputs. */
export async function buildContentProject({projectStore,projectRoot,recipe,cacheRoot,outputRoot,selectorId,transactionId,signal,adopt=true}){
  checkCancellation(signal);
  if(typeof adopt!=='boolean')throw failure('CONTENT_BUILD_INPUT','adopt must be a boolean.');
  const outputPrefix=ownerRelativePath(projectRoot,outputRoot),producer=getContentProducer();
  const snapshot=checked(parseProjectSnapshot(checked(serializeProjectSnapshot(projectStore.getSnapshot()))));
  const plan=checked(describeContentRecipes(snapshot,recipe,producer)),keys=checked(evaluateResourceBuildKeys(plan));
  const byId=new Map(keys.entries.map(entry=>[entry.id,entry])),sources=new Map(),built=new Map(),rows=[];
  let sourceBytes=0,outputBytes=0,scanlineBytes=0,cache,output,ready,result;
  const sourceFiles=new Map(keys.entries.map(entry=>[entry.source.id,entry.source]));
  // Verify all declared inputs before making any cache hit authoritative. Same
  // source-file identity is read once, including shared atlas/sequence metadata.
  for(const [id,file] of [...sourceFiles].sort(([a],[b])=>a<b?-1:a>b?1:0)){
    checkCancellation(signal);
    if(file.path===outputPrefix||file.path.startsWith(outputPrefix+'/'))throw failure('CONTENT_BUILD_INPUT','Generated output cannot own source files.');
    sourceBytes=boundedSum(sourceBytes,file.byteLength,SOURCE_BUDGET,'Verified source bytes');
    const bytes=readContentInput(projectRoot,file.path,{expectedLength:file.byteLength,expectedSha256:file.sha256,maximum:8388608});
    sources.set(id,bytes);await yieldTask();
  }
  try{
    checkCancellation(signal);cache=openContentStore(cacheRoot);output=samePhysicalPath(cacheRoot,outputRoot)?cache:openContentStore(outputRoot);
    const ordered=[],seen=new Set();
    function visit(entry){if(seen.has(entry.id))return;seen.add(entry.id);for(const id of entry.dependencies)visit(byId.get(id));ordered.push(entry);}
    for(const entry of keys.entries)visit(entry);
    for(const entry of ordered){
      checkCancellation(signal);
      const previous=cache.readRecord(entry.buildKey);let outputs,work=0;
      if(previous?.complete){
        outputs=previous.outputs.map(file=>{const bytes=cache.readBlob(file);if(bytes===null)throw failure('CONTENT_STORE_INTEGRITY','A verified cache blob disappeared.');return {name:file.name,mediaType:file.mediaType,bytes};});
      }else{
        const dependencies=entry.dependencies.map(id=>({entry:byId.get(id),outputs:built.get(id).outputs}));
        const generated=buildContentResource(entry,sources.get(entry.source.id),dependencies,{remainingScanlineBytes:SCANLINE_BUDGET-scanlineBytes,remainingOutputBytes:OUTPUT_BUDGET-outputBytes});
        outputs=generated.outputs;work=generated.scanlineBytes;
      }
      checkCancellation(signal);
      scanlineBytes=boundedSum(scanlineBytes,work,SCANLINE_BUDGET,'PNG scanline work');
      const files=outputs.map(descriptor).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
      if(previous&&canonical(previous.outputs)!==canonical(files))throw failure('CONTENT_CACHE_DETERMINISM','A build key produced a different complete output set.');
      for(const file of files)outputBytes=boundedSum(outputBytes,file.byteLength,OUTPUT_BUDGET,'Complete output bytes');
      for(const file of outputs){cache.putBlob(file.bytes);if(output!==cache)output.putBlob(file.bytes);}
      built.set(entry.id,{outputs,files});
      rows.push({resourceId:entry.id,buildKey:entry.buildKey,cache:previous?.complete?'hit':previous?'missing-blob':'miss',outputs:files});
      await yieldTask();
    }
    const intrinsic=[...built].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([resourceId,value])=>({resourceId,buildKey:byId.get(resourceId).buildKey,files:value.files}));
    const binding=checked(bindContentArtifacts(snapshot,plan,intrinsic,outputPrefix));
    const manifestBytes=Buffer.from(checked(serializeResourceManifest(binding.manifest)),'utf8');
    const manifestDescriptor={sha256:sha(manifestBytes),byteLength:manifestBytes.length};
    const generation={format:'egret.content-generation/1',manifest:manifestDescriptor,outputs:intrinsic};
    const generationId=sha(Buffer.from(canonical(generation)));
    // Construct and validate the complete transaction before filesystem readiness.
    // This does not commit the caller's store or promise its revision is locked.
    const transaction=checked(createContentAdoption(snapshot,binding,{generationId,manifest:manifestDescriptor,outputPrefix,selectorId,transactionId}));
    for(const file of sourceFiles.values()){
      checkCancellation(signal);
      readContentInput(projectRoot,file.path,{expectedLength:file.byteLength,expectedSha256:file.sha256,maximum:8388608});
    }
    checkCancellation(signal);
    ready=output.publishGeneration(generation,manifestBytes);
    if(ready.id!==generationId)throw failure('CONTENT_STORE_INTEGRITY','Published generation identity disagrees.');
    result={status:'ready',generationId,manifestPath:outputPrefix+'/'+ready.path,manifest:binding.manifest,adoption:{status:'not_requested'},receipt:{format:'egret.content-build-receipt/1',projectId:snapshot.projectId,baseRevision:snapshot.revision,targetProfile:plan.targetProfile,producer,generationId,manifest:manifestDescriptor,resources:rows.sort((a,b)=>a.resourceId<b.resourceId?-1:a.resourceId>b.resourceId?1:0),work:{sourceBytes,outputBytes,scanlineBytes}}};
    // Only a complete ready generation makes these outputs cache discoverable.
    for(const item of intrinsic)cache.publishRecord(item.buildKey,item.files);
    await yieldTask();
    if(!adopt)return result;
    if(cancelled(signal)){result.adoption={status:'cancelled'};return result;}
    const commit=projectStore.commit(transaction);result.adoption=commit;
    if(commit.status==='committed'||commit.status==='replayed')result.status='adopted';
    return result;
  }catch(error){
    if(!ready)throw error;
    // A later index/adoption failure cannot erase already published readiness.
    if(!result)result={status:'ready',generationId:ready.id,manifestPath:outputPrefix+'/'+ready.path};
    return {...result,adoption:{status:'not_adopted',code:error?.code??'CONTENT_BUILD_FAILED',message:error instanceof Error?error.message:'Content build failed after readiness.'}};
  }finally{
    if(output&&output!==cache)output.close();cache?.close();
  }
}
