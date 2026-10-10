import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {cpus,totalmem,release,version,platform,arch} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import * as project from '@egret/project';

// Harness observations never grant product authority or a RAM/OOM threshold.
// Separate children include import, fixture allocation and API work in lifetime RSS.
const cases=['baseline-only','small-entity-count','small-file-count','near-snapshot-bytes','near-history-bytes','shared-live-alias-rejection','long-edit-journal','nested-restore-journal','adversarial-text'];
const args=process.argv.slice(2);
const child=args[0]==='--case';
if(child?args.length!==2||!cases.includes(args[1]):args.length!==2||args[0]!=='--output')throw Error('Use --output <private-result.json> or --case <known-case>.');
if(typeof globalThis.gc!=='function')throw Error('Measurement requires --expose-gc.');
const baseline=()=>({projectSchemaVersion:'1.0',projectId:'p_a',revision:0,name:'',versions:{engineVersion:'1',resourceFormatVersion:'1',toolProtocolVersion:'1.0'},roots:[],entities:[],files:[],retiredEntityIds:[],retiredFileIds:[]});
const entity=(id,data={})=>({id,kind:'scene',dataSchemaVersion:'1',name:'',data,references:[]});
const edit=(index,operations,scope)=>({command:'edit',toolProtocolVersion:'1.0',projectId:'p_a',transactionId:'t_'+index,baseRevision:index-1,source:{actorId:'a',actorKind:'tool',toolId:'a',toolVersion:'1',intent:''},scope,operations});
const metadata=index=>edit(index,[{op:'setMetadata',name:'',versions:baseline().versions}],{entityIds:[],fileIds:[],metadata:true,roots:false});
const restore=(index,targetRevision)=>({command:'restore',toolProtocolVersion:'1.0',projectId:'p_a',transactionId:'t_'+index,baseRevision:index-1,source:{actorId:'a',actorKind:'tool',toolId:'a',toolVersion:'1',intent:''},targetRevision});
const outcome=result=>({accepted:result.ok===true||result.status==='committed'||result.status==='replayed',status:result.status??(result.ok?'accepted':'rejected'),diagnosticCodes:result.diagnostics.map(item=>item.code)});
const environment=()=>({node:process.version,versions:process.versions,nodeExecutable:process.execPath,os:{platform:platform(),arch:arch(),release:release(),version:version()},hardware:{cpuModel:cpus()[0]?.model,logicalCpuCount:cpus().length,totalMemoryBytes:totalmem()}});

if(child){
 const name=args[1],intervalMs=10,start=performance.now(),samples=[];
 let largestGapMs=0,last=start;
 const sample=label=>{const now=performance.now(),usage=process.memoryUsage();largestGapMs=Math.max(largestGapMs,now-last);last=now;samples.push({elapsedMs:now-start,label,...usage});};
 globalThis.gc();sample('post-import-gc');const timer=setInterval(()=>sample('interval'),intervalMs);
 const config={...project.DEFAULT_PROJECT_LIMITS},fixture={},outcomes=[];
 const accept=(label,result)=>{outcomes.push({label,...outcome(result)});sample(label);return result.ok?result.value:undefined;};
 const storeFor=base=>accept('create',project.createProjectStore(base,config));
 const commit=(store,command)=>{const result=store.commit(command);outcomes.push({label:command.transactionId,...outcome(result)});sample(command.transactionId);return result;};
 const finishStore=store=>{
  const exported=store.exportHistory();fixture.historyUtf8Bytes=exported.ok?Buffer.byteLength(exported.value):null;
  accept('export',exported);if(exported.ok)accept('reopen',project.openProjectHistory(exported.value,config));
 };
 try{
  if(name==='baseline-only'){fixture.snapshotUtf8Bytes=238;fixture.recordCount=0;const store=storeFor(baseline());if(store)finishStore(store);}
  else if(name==='small-entity-count'||name==='small-file-count'){
   const base=baseline(),entities=name==='small-entity-count',count=entities?config.maxEntities:config.maxFiles;
   if(entities)base.entities=Array.from({length:count},(_,index)=>entity('e_'+index));
   else base.files=Array.from({length:count},(_,index)=>({id:'f_'+index,path:index+'.txt',role:'other',mediaType:'text/plain',sha256:'a'.repeat(64),byteLength:0}));
   fixture.recordCount=count;fixture.snapshotUtf8Bytes=Buffer.byteLength(JSON.stringify(base));sample('fixture');
   const store=storeFor(base);if(store)finishStore(store);
   if(entities)base.entities.push(entity('e_over'));else base.files.push({id:'f_over',path:'over.txt',role:'other',mediaType:'text/plain',sha256:'a'.repeat(64),byteLength:0});
   accept('count-plus-one',project.createProjectStore(base,config));
  }else if(name==='near-snapshot-bytes'){
   const base=baseline();base.entities=[entity('e_blob',{chunks:Array.from({length:255},()=> 'x'.repeat(65536))})];
   const overhead=Buffer.byteLength(JSON.stringify(base));base.entities[0].data.tail='x'.repeat(Math.max(0,config.maxSnapshotUtf8Bytes-overhead-10));
   fixture.snapshotUtf8Bytes=Buffer.byteLength(JSON.stringify(base));fixture.chunkCount=255;fixture.chunkUtf8Bytes=65536;sample('fixture');
   accept('parse-near-limit',project.parseProjectSnapshot(JSON.stringify(base),config));
   base.entities[0].data.tail+='x';fixture.oneOverSnapshotUtf8Bytes=Buffer.byteLength(JSON.stringify(base));
   accept('parse-over-limit',project.parseProjectSnapshot(JSON.stringify(base),config));
  }else if(name==='near-history-bytes'){
   const store=storeFor(baseline());fixture.chunkCount=63;fixture.chunkUtf8Bytes=65536;fixture.attemptedCommands=17;
   if(store){for(let index=1;index<=17;index++){
    const command=edit(index,[{op:'putEntity',entity:entity('e_blob',{chunks:Array.from({length:63},()=> 'x'.repeat(65536))})}],{entityIds:['e_blob'],fileIds:[],metadata:false,roots:false});
    fixture.transactionUtf8Bytes=Buffer.byteLength(JSON.stringify(command));commit(store,command);await yieldTurn();
   }finishStore(store);}
  }else if(name==='shared-live-alias-rejection'){
   config.maxSnapshotUtf8Bytes=1024;const shared={text:'x'.repeat(256)},base=baseline();base.entities=[entity('e_alias',{left:shared,right:shared,third:shared})];
   fixture.sharedOccurrenceCount=3;fixture.expandedSnapshotUtf8Bytes=Buffer.byteLength(JSON.stringify(base));accept('expanded-alias',project.createProjectStore(base,config));
  }else if(name==='long-edit-journal'){
   const store=storeFor(baseline());fixture.attemptedCommands=config.maxTransactions+1;
   if(store){for(let index=1;index<=config.maxTransactions+1;index++){commit(store,metadata(index));await yieldTurn();}finishStore(store);}
  }else if(name==='nested-restore-journal'){
   const store=storeFor(baseline());let prefix=27,accepted=0;fixture.independentPrefixCosts=[27];
   if(store){for(let index=1;index<=32;index++){
    const command=index===1?metadata(index):restore(index,index-1);
    const projected=index===1?prefix+48+27:prefix+25+27+prefix;
    const result=commit(store,command);fixture.independentPrefixCosts.push(projected);
    if(result.status!=='committed')break;prefix=projected;accepted++;await yieldTurn();
   }fixture.acceptedCommands=accepted;finishStore(store);}
  }else{
   const baseText=JSON.stringify(baseline()),depth='['.repeat(20000)+'0'+']'.repeat(20000);
   const exponent=baseText.replace('"revision":0','"revision":1e'+'9'.repeat(4096));
   const duplicate=baseText.replace('"name":""','"name":"","na\\u006de":""');
   fixture.textUtf8Bytes={depth:Buffer.byteLength(depth),exponent:Buffer.byteLength(exponent),duplicate:Buffer.byteLength(duplicate)};
   accept('depth',project.parseProjectSnapshot(depth,config));accept('exponent',project.parseProjectSnapshot(exponent,config));accept('duplicate',project.parseProjectSnapshot(duplicate,config));
  }
 }finally{clearInterval(timer);sample('before-final-gc');globalThis.gc();sample('after-final-gc');}
 const wallTimeMs=performance.now()-start;
 const observed={maxHeapUsedBytes:Math.max(...samples.map(item=>item.heapUsed)),maxRssBytes:Math.max(...samples.map(item=>item.rss)),osLifetimeMaxRssKiB:process.resourceUsage().maxRSS};
 console.log(JSON.stringify({name,environment:environment(),config,fixture,outcomes,wallTimeMs,intervalMs,largestGapMs,observed,samples,coverage:'Observed samples only; synchronous calls block interval polling. Lifetime RSS includes imports and fixtures. GC does not certify transient peaks or OOM safety.'}));
}else{
 const output=path.resolve(args[1]);await mkdir(path.dirname(output),{recursive:true});
 const results=[];
 for(const name of cases){
  const startedAtUtc=new Date().toISOString();
  const result=spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--case',name],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:300000});
  const rawPath=path.join(path.dirname(output),'memory-'+name+'.txt');await writeFile(rawPath,(result.stdout??'')+(result.stderr??''));
  let measured;try{measured=JSON.parse(result.stdout);}catch{}
  results.push({name,startedAtUtc,finishedAtUtc:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.message,rawPath,measured,coverage:measured&&result.status===0?'observed':'missing'});
  console.log(JSON.stringify({name,exitCode:result.status,coverage:results.at(-1).coverage,wallTimeMs:measured?.wallTimeMs,observed:measured?.observed}));
  await writeFile(output,JSON.stringify({schemaVersion:1,harness:'separate-process public API observations',environment:environment(),limitations:'Polling and GC observations can miss transient peaks; no RAM threshold, performance acceptance or OOM guarantee. Failed/unmeasured cases remain missing.',results},null,2)+'\n');
 }
 if(results.some(item=>item.coverage==='missing'))process.exitCode=1;
}
