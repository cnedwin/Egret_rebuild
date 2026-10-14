// SPDX-License-Identifier: Apache-2.0
// Portable opt-in CPU runner. No installation, alias creation, native actor or Core patches.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync,existsSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fingerprintFile,canonicalTextBytes,logicalPath,ownerRelativePath,samePhysicalPath,physicalPathKey } from '../../../tools/lib/file-identity.mjs';
const experiment=fileURLToPath(new URL('./',import.meta.url)),repository=fileURLToPath(new URL('../../../',import.meta.url)),require=createRequire(import.meta.url);
function argumentsForRun(){const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--spine-core'||args[2]!=='--output')throw new Error('Usage: node knowledge-base/experiments/spine-f2-core/run.mjs --spine-core <supplied-existing-package> --output <fresh-outside-repository>');return {sdk:realpathSync(resolve(args[1])),output:resolve(args[3])};}
function tree(owner){const rows=[];let total=0;function visit(relative=''){for(const name of readdirSync(join(owner,relative)).sort()){
  const key=relative?relative+'/'+name:name;logicalPath(key);const stat=lstatSync(join(owner,key));if(stat.isSymbolicLink())throw new Error('SYMLINK_IN_SOURCE_TREE');if(stat.isDirectory())visit(key);else if(stat.isFile()){const pin=fingerprintFile(owner,key);total+=pin.bytes;if(rows.length>=4096||total>268435456)throw new Error('SOURCE_TREE_CAP');rows.push(pin);}else throw new Error('NONREGULAR_SOURCE_TREE');
}}visit();rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);return {files:rows.length,bytes:total,sha256TupleTree:createHash('sha256').update(JSON.stringify(rows.map(row=>[row.path,row.bytes,row.sha256]))).digest('hex'),rows};}
function samePin(owner,pin){const actual=fingerprintFile(owner,pin.path);assert.equal(actual.bytes,pin.bytes,pin.path);assert.equal(actual.sha256,pin.sha256,pin.path);return actual;}
function failure(error,seen=new Set()){if(error===null||typeof error!=='object')return {value:String(error)};if(seen.has(error))return {cycle:true};seen.add(error);const result={name:error.name,code:error.code,message:error.message,stack:error.stack};if('cause'in error)result.cause=failure(error.cause,seen);if(Array.isArray(error.cleanupErrors))result.cleanupErrors=error.cleanupErrors.map(value=>failure(value,seen));return result;}
function child(file,args,cwd){const result=spawnSync(process.execPath,[file,...args],{cwd,windowsHide:true,timeout:120000,maxBuffer:16777216});const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0);return {exitStatus:result.status,signal:result.signal,stdout:stdout.toString('utf8'),stderr:stderr.toString('utf8'),stdoutBase64:stdout.toString('base64'),stderrBase64:stderr.toString('base64'),error:result.error?failure(result.error):null};}
async function run(){
  const args=argumentsForRun();physicalPathKey(args.output);assert.equal(existsSync(args.output),false,'fresh output required');assert.equal(samePhysicalPath(repository,args.output),false);let contained=false;try{ownerRelativePath(repository,args.output);contained=true;}catch{}assert.equal(contained,false,'output must be outside repository');mkdirSync(args.output,{recursive:true});assert.ok(samePhysicalPath(args.output,realpathSync(args.output)),'canonical output owner');
  const save=(name,value)=>writeFileSync(join(args.output,logicalPath(name)),canonicalTextBytes(JSON.stringify(value,null,2)),{flag:'wx'});
  const report={kind:'ACTUAL_F2C_CPU_RUN',phase:'source_qualification',actualMainExecutedCases:0,mainCases:[],namespace:'not_run',typeLanes:[],prerequisites:'not_run',native:{id:'F2C11',status:'TASK5_PENDING_NOT_RUN'},entitlement:'unknown',redistributionClearance:'unverified',clock:'excluded',performanceAcceptance:'none'};
  let primary;
  try{
    const manifest=JSON.parse(readFileSync(join(experiment,'manifest.json'),'utf8'));
    report.sourcePins=manifest.sourceFiles.map(pin=>samePin(experiment,pin));report.toolPins=manifest.toolFiles.map(pin=>samePin(repository,pin));
    const sdk=tree(args.sdk);assert.equal(sdk.files,manifest.sdk.files);assert.equal(sdk.sha256TupleTree,manifest.sdk.sha256TupleTree);const pkg=JSON.parse(readFileSync(join(args.sdk,'package.json'),'utf8'));assert.equal(pkg.name,'@esotericsoftware/spine-core');assert.equal(pkg.version,manifest.sdk.version);report.suppliedSDK={owner:args.sdk,version:pkg.version,...sdk};
    // Existing opt-in resolution must point into the exact supplied raw-byte owner.
    // Resolution does not evaluate Core. This runner creates no package alias.
    const resolvedCore=require.resolve('@esotericsoftware/spine-core');report.sdkResolvedEntry=ownerRelativePath(args.sdk,realpathSync(resolvedCore));
    const tsPath=require.resolve('typescript/package.json'),tsPkg=JSON.parse(readFileSync(tsPath,'utf8'));assert.equal(tsPkg.version,'7.0.2');report.compiler={version:tsPkg.version,package:fingerprintFile(dirname(tsPath),'package.json')};
    report.publicEmittedBefore={};for(const name of ['contracts','runtime','engine','project'])report.publicEmittedBefore[name]=tree(join(repository,'packages',name,'dist'));report.retainedF2Before=tree(join(repository,'knowledge-base/experiments/spine-f2/dist'));
    report.phase='build';report.build=child(join(dirname(tsPath),'bin/tsc'),['-p',join(experiment,'tsconfig.json')],repository);save('build.json',report.build);writeFileSync(join(args.output,'build.stdout.log'),Buffer.from(report.build.stdoutBase64,'base64'));writeFileSync(join(args.output,'build.stderr.log'),Buffer.from(report.build.stderrBase64,'base64'));assert.equal(report.build.exitStatus,0,'standalone build prerequisite');report.experimentBuilt=tree(join(experiment,'dist'));
    report.phase='types';const laneMetadata=JSON.parse(readFileSync(join(experiment,'type-tests/negative-lanes.json'),'utf8'));
    for(const lane of [{file:'positive.ts',expectedRule:'PUBLIC_SIGNATURE_POSITIVE'},...laneMetadata.lanes]){
      const result=child(join(experiment,'type-tests/check-lane.mjs'),[lane.file],repository),name=lane.file.slice(0,-3),observed={file:lane.file,expectedRule:lane.expectedRule,...result};
      // Save exact child bytes and settlement before JSON parsing or assertions.
      report.typeLanes.push(observed);save('type-'+name+'.child.json',observed);
      writeFileSync(join(args.output,'type-'+name+'.stdout.log'),Buffer.from(result.stdoutBase64,'base64'));writeFileSync(join(args.output,'type-'+name+'.stderr.log'),Buffer.from(result.stderrBase64,'base64'));
      let actual;try{actual=JSON.parse(result.stdout);}catch(error){throw new Error('TYPE_LANE_COLLECTOR_OUTPUT; raw child streams retained in type-'+name+'.child.json',{cause:error});}
      observed.collector=actual;save('type-'+name+'.json',observed);
      if(actual.cli){writeFileSync(join(args.output,'type-'+name+'.cli.stdout.log'),Buffer.from(actual.cli.stdoutBase64,'base64'));writeFileSync(join(args.output,'type-'+name+'.cli.stderr.log'),Buffer.from(actual.cli.stderrBase64,'base64'));}
      assert.equal(actual.compilerVersion,'7.0.2');assert.equal(actual.collectorFailure,null,'CLI collector refusal');assert.equal(actual.temporaryConfigCleanup,'removed');
      const positive=lane.file==='positive.ts';assert.equal(result.exitStatus,positive?0:1,'actual collector exit');assert.equal(actual.cli.exitStatus,positive?0:1,'actual CLI exit');assert.equal(actual.diagnosticTuples.length===0,positive,'actual unsuppressed diagnostics');
    }save('type-diagnostics.json',report.typeLanes);
    report.phase='prerequisites';const fixture=await import('./tests/fixture.mjs');report.prerequisites=await fixture.boundedWait(fixture.prerequisites(),'F2C00 prerequisite observation',25000);save('prerequisites.json',report.prerequisites);
    report.phase='namespace';const entry=await import('./dist/index.js');const checker=await import('./tests/namespace.mjs');checker.namespace(entry);report.namespace='PASS_ACTUAL_NAMESPACE_ONLY';
    report.phase='behavior';const {cpuCases}=await import('./tests/cpu.mjs');assert.deepEqual(cpuCases.map(row=>row.id),manifest.mainCpuIds);
    // These watchdogs bound test observations, never production time or performance.
    report.observationBoundsMs={mainCase:30000,contextBody:15000,settlementAndCleanup:5000};report.pendingMainCases=[];
    for(const row of cpuCases){
      const started=performance.now();let error;report.actualMainExecutedCases++;
      try{await fixture.boundedWait(Promise.resolve().then(()=>row.run()),row.id+' main case',30000);}catch(caught){error=caught;}
      const timedOut=fixture.isObservationTimeout(error),result={id:row.id,status:error?'FAIL':'PASS',timedOut,failure:error?failure(error):null,phaseTimesMonotonicMs:{started,finished:performance.now()}};
      report.mainCases.push(result);save('case-'+row.id+'.json',result);
      if(timedOut){report.pendingMainCases=cpuCases.slice(report.actualMainExecutedCases).map(value=>value.id);break;}
    }
    report.status=report.mainCases.some(row=>row.status==='FAIL')?'ACTUAL_CPU_RED':'ACTUAL_CPU_GREEN_BOUNDED';
  }catch(error){primary=error;report.status='PREREQUISITE_REFUSAL';report.failure=failure(error);}
  report.phaseAtCompletion=report.phase;save('cpu-report.json',report);console.log(JSON.stringify({status:report.status,actualMainExecutedCases:report.actualMainExecutedCases,output:args.output,native:'not_run'}));if(primary||report.status==='ACTUAL_CPU_RED')process.exitCode=1;
}
if (process.argv.length === 3 && process.argv[2] === '--help') {
  // Help returns before run() reads source metadata, assets or the supplied SDK.
  console.log('Usage: node knowledge-base/experiments/spine-f2-core/run.mjs --spine-core <supplied-existing-package> --output <fresh-outside-repository>');
  console.log('Opt-in bounded CPU/types runner; no install. SDK entitlement and redistribution clearance remain unverified.');
} else {
  await run();
}
