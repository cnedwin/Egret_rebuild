// First-party Apache-2.0 prospective native collector. Cooperative API closure is not OS retirement.
// Lifecycle/output patterns follow existing first-party B1 and SequencePlayer bounded collectors.
import { readFile, realpath, lstat, readdir, mkdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { CASES, CALIBRATION, HELD_OUT, definition } from './fixtures.mjs';
import { verifyTexturedPixels, verifyTransparentReset, TexturedPixelAssertion } from './oracle.mjs';
import { ALIAS, REGISTRY, REGISTRY_SOURCE, ENTRIES, CONTROL_IDS, LIMITS, inputByteLimit, sha256, descriptor, incomplete, isIncomplete, requirePolicy, fault,
  inside, samePath, freshOutput, directoryChain, readIdentity, artifactStore, chosenMap, collectPublicGraph, makeCopy,
  captureRegistry, rereadRegistry, rereadAll } from './native-files.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),repositoryCandidate=path.resolve(here,'../..');
const HARNESS=['examples/textured-webgpu/main.mjs','examples/textured-webgpu/fixtures.mjs','examples/textured-webgpu/index.html',
  'tools/textured-webgpu/fixtures.mjs','tools/textured-webgpu/oracle.mjs','tools/textured-webgpu/native-window.mjs',
  'tools/textured-webgpu/calibration-manifest.json','tools/textured-webgpu/held-out-manifest.json','tools/textured-webgpu/sensitivity-plan.json'];
const OWN_FILES=['tools/verify-textured-webgpu.mjs','tools/textured-webgpu/collector.mjs','tools/textured-webgpu/native-files.mjs'];
const CONTROL_CHECKS=[
  [['N02-interpolation','interpolated-rgba']],
  [['N03-forward','blue-over-red'],['N04-empty','last-green-empty'],['N04-singular','last-green-singular']],
  [['N01-a128','alpha-128']],[['N01-a128','alpha-128']],
  [['N02-interpolation','interpolated-rgba'],['N06-diamond','clip-inside-left'],['N09-complement','visible-complement-transport']],
  [['N06-diamond','clip-outside-top']],[['N01-a128','alpha-128']],[['N05-palette','crop-green']],[['N05-palette','crop-green']],
  [['N07-diamond','TEXTURED_NATIVE_METADATA_INVALID']],[['N10-replay02','N10-reset-after','reset-after']],[['N06-diamond','clip-inside-top']]];
const budgets=Object.freeze({perOperationMs:20000,operationMs:240000,closeMs:280000,hardMs:295000,
  windows:37,positiveCases:21,positiveObservations:27,controlWindows:16,controlObservations:19,inputBytes:536870912,...LIMITS,modules:132});

function options(args){requirePolicy(args.length===8,'CLI_OPTIONS');const result=Object.create(null);
  for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];requirePolicy(['--playwright','--channel','--output','--freeze'].includes(key)&&!Object.hasOwn(result,key)
    &&typeof value==='string'&&value.length>0&&value.length<=32768,'CLI_OPTIONS');result[key]=value;}
  requirePolicy(result['--channel']==='msedge'&&path.isAbsolute(result['--playwright'])&&path.isAbsolute(result['--output'])&&path.isAbsolute(result['--freeze']),'CLI_PROFILE');
  requirePolicy(process.version==='v26.7.0'&&process.execArgv.length===0,'NODE_PROFILE');return result;}
function expectedRoles(id){return definition(id).scenario==='retained'?['reset-before','replay-first','replay-second','reset-after']:['sample'];}
function publicCleanup(window){const close=window?.scene?.cleanup;
  return window?.status==='SCENE_COMPLETED'&&window.deviceAcquired&&window.cleanup.deviceDestroyed&&window.cleanup.lossSettled&&window.cleanup.failures.length===0
    &&window.uncaptured.length===0&&!window.eventOverflow&&!window.unexpectedDeviceLoss&&close?.status?.state==='closed'&&close.status.cleanupOutcome==='safe'&&close.failures.length===0;}
// Validate the actual transferred records; absent evidence never becomes an oracle verdict.
function actualNativeMetadata(window){
  const issues=[],record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const field=(value,key,predicate,label)=>{if(!record(value)||!Object.hasOwn(value,key)||!predicate(value[key]))issues.push(label+'.'+key);};
  const text=value=>typeof value==='string';
  const features=value=>Array.isArray(value)&&value.every(text)&&new Set(value).size===value.length;
  const limitKeys=['maxTextureDimension2D','maxBufferSize','maxVertexBuffers','maxVertexAttributes','maxVertexBufferArrayStride',
    'maxColorAttachments','maxColorAttachmentBytesPerSample','maxBindGroups','maxBindingsPerBindGroup','maxSampledTexturesPerShaderStage',
    'maxSamplersPerShaderStage','maxUniformBuffersPerShaderStage','maxUniformBufferBindingSize','maxBindGroupsPlusVertexBuffers','maxInterStageShaderVariables'];
  const limits=(value,label)=>{
    if(!record(value)||Object.keys(value).length===0){issues.push(label);return;}
    for(const key of limitKeys)if(!Object.hasOwn(value,key))issues.push(label+'.'+key);
    for(const [key,number] of Object.entries(value))if(!Number.isSafeInteger(number)||number<0)issues.push(label+'.'+key);
  };
  if(window?.deviceAcquired!==true)issues.push('deviceAcquired');
  const adapter=window?.adapter,device=window?.device,environment=window?.environment;
  field(adapter,'info',record,'adapter');
  for(const key of ['vendor','architecture','device','description'])field(adapter?.info,key,text,'adapter.info');
  field(adapter,'isFallbackAdapter',value=>value===null||typeof value==='boolean','adapter');
  field(adapter,'features',features,'adapter');field(adapter,'limits',record,'adapter');limits(adapter?.limits,'adapter.limits');
  field(device,'label',text,'device');field(device,'features',features,'device');field(device,'limits',record,'device');limits(device?.limits,'device.limits');
  field(environment,'userAgent',text,'environment');field(environment,'platform',text,'environment');
  field(environment,'browserDPR',value=>typeof value==='number'&&Number.isFinite(value)&&value>0,'environment');
  field(environment,'isSecureContext',value=>typeof value==='boolean','environment');
  field(environment,'preferredFormat',value=>value==='rgba8unorm'||value==='bgra8unorm','environment');
  return {accepted:issues.length===0,issues};
}
function numericChecks(row,id){const value=definition(id),readback=row.readback;
  // Caller-controlled public code/status strings never classify a native failure. Only this oracle invocation does.
  const invoke=operation=>{try{return {accepted:true,result:operation()};}catch(error){
    if(error instanceof TexturedPixelAssertion)return {accepted:false,kind:'pixel',failure:{name:error.name,caseId:error.caseId,assertion:error.assertion,
      x:error.x,y:error.y,expected:error.expected,bounds:error.bounds,actual:error.actual,channels:error.channels}};
    if(['TEXTURED_NATIVE_METADATA_INVALID','TEXTURED_NATIVE_BYTES_INVALID','TEXTURED_RESET_METADATA_INVALID'].includes(error?.message))
      return {accepted:false,kind:'oracle-schema',failure:{assertion:error.message}};
    throw incomplete('ORACLE_INVOCATION',{caseId:id,role:row.role},error);}};
  if(row.role.startsWith('reset-')){const size=row.role==='reset-before'?value.resetBefore:[value.width,value.height];
    return [invoke(()=>verifyTransparentReset(readback,'N10-'+row.role,Math.ceil(size[0]*value.pixelRatio),Math.ceil(size[1]*value.pixelRatio)))];}
  const reference=value.scenario==='retained'?value.replayOf:id;
  return definition(reference).samples.map(sample=>invoke(()=>verifyTexturedPixels(readback,reference,sample.name)));
}

export async function main(argv){
  const began=Date.now(),operationDeadline=began+budgets.operationMs,closeDeadline=began+budgets.closeMs;
  const report={schemaVersion:'textured-native-result/1',status:'INCOMPLETE',startedAtUTC:new Date(began).toISOString(),budgets,
    launch:{channel:'msedge',headless:true,callerAddedFlags:[],freshContextPerWindow:true,deviceScaleFactor:1},
    environment:{node:process.version,os:{platform:os.platform(),release:os.release(),architecture:os.arch()}},
    calibration:[],heldOut:[],controls:[],requests:[],browserEvents:[],registryCaptures:[],registryRereads:[],registryFailures:[],
    cleanupFailures:[],failure:null,artifacts:[],counts:null,
    lifecycle:{browserClosed:false,serverClosed:false,contextsClosed:0,identitiesStable:false,artifactsStable:false,standaloneCleanupObserved:false,
      cleanupScope:'standalone-cooperative-api',osDescendantRetirement:'UNBOUND'},
    scope:{rawNumeric:'Frozen one-device calibration/held-out and copied sensitivity only',pngs:'Native canvas black/white composition observations, separate from raw numeric verdict',
      legacyGates:'Canvas, old WebGPU, B1 and SequencePlayer require their separate fresh receipts',publicAdoption:false,wholeA2:false,performance:false,phone:false}};
  const pending=new Set(),acquisitions=[],openPages=new Set(),openContexts=new Set(),sockets=new Set(),identities=new Map(),captures=[];
  const observe=promise=>{if(!pending.has(promise)){pending.add(promise);const settle=()=>pending.delete(promise);promise.then(settle,settle);}return promise;};
  async function bounded(promise,label,cleanup=false){observe(promise);const remaining=Math.min(budgets.perOperationMs,(cleanup?closeDeadline:operationDeadline)-Date.now());
    if(remaining<=0)throw incomplete('DEADLINE',{label});let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(incomplete('TIMEOUT',{label})),remaining);})]);}
    finally{clearTimeout(timer);}}
  const acquire=(promise,label,assign)=>{const row={label,settled:false,promise:null};row.promise=observe(promise.then(value=>{row.settled=true;assign(value);return value;},
    error=>{row.settled=true;throw error;}));acquisitions.push(row);return row.promise;};
  let totalInputBytes=0;
  const retain=(item,role)=>{const key=process.platform==='win32'?item.path.toLowerCase():item.path,before=identities.get(key);
    requirePolicy(!before||(before.bytes===item.bytes&&before.sha256===item.sha256),'INPUT_CHANGED_DURING_COLLECTION',{path:item.path});
    if(!before){totalInputBytes+=item.bytes;requirePolicy(totalInputBytes<=budgets.inputBytes,'AGGREGATE_INPUT_BYTES',{totalInputBytes});}
    identities.set(key,{...descriptor(item),roles:[...new Set([...(before?.roles??[]),role])]});};
  let output,store,repository,browser,server,origin,browserCloseRequested=false,currentWindow=null,fatalIncomplete=false,numericFailure=false,unsupported=false;
  const markIncomplete=(reason,details={},cause)=>{fatalIncomplete=true;const error=incomplete(reason,details,cause);report.cleanupFailures.push(fault(error));return error;};
  const hardTimer=setTimeout(()=>{report.status='INCOMPLETE';report.cleanupFailures.push({name:'HardDeadline',message:'Cleanup and pending native operations unproven'});
    report.lifecycle.pendingApiOperations=pending.size;
    if(output)try{writeFileSync(path.join(output,'hard-abort.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}catch{}
    process.stderr.write('Textured native collection INCOMPLETE: hard deadline\n');process.exit(1);},budgets.hardMs);
  async function pin(file,role,maxBytes=LIMITS.moduleBytes){const item=await readIdentity(file,maxBytes);retain(item,role);return item;}
  async function loadJSON(file,role){return JSON.parse((await pin(file,role)).body.toString('utf8'));}
  async function bindInstalledTree(input,role){const root=await realpath(input);let count=0,total=0;
    async function visit(directory){for(const entry of(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      requirePolicy(++count<=4096&&!entry.isSymbolicLink(),'INSTALLED_TREE_COUNT_OR_LINK',{root});const file=path.join(directory,entry.name);
      if(entry.isDirectory())await visit(file);else{requirePolicy(entry.isFile(),'INSTALLED_TREE_KIND',{file});
        const item=await pin(file,role,134217728);requirePolicy(inside(root,item.path),'INSTALLED_TREE_CONTAINMENT');total+=item.bytes;
        requirePolicy(total<=536870912,'INSTALLED_TREE_BYTES',{root});}}}
    await visit(root);return {root,count,totalBytes:total};}
  async function registryReread(phase,capture){try{const result=await bounded(rereadRegistry(capture),'registry-'+phase,true);report.registryRereads.push({phase,...result});
    if(!result.accepted){fatalIncomplete=true;report.registryFailures.push({phase,mode:capture.mode,reason:result.reason,readFailures:result.readFailures});}}
    catch(error){fatalIncomplete=true;report.registryFailures.push({phase,mode:capture.mode,reason:null,observationFailure:fault(error)});}}
  try{
    const cli=options(argv);repository=await realpath(repositoryCandidate);output=await freshOutput(cli['--output'],repository);
    await mkdir(output);await directoryChain(output);store=artifactStore(output);
    report.environment.nodeExecutable=descriptor(await pin(process.execPath,'actual-node-executable',134217728));
    report.environment.browserExecutableIdentity='UNBOUND by public channel API; separate outer process/executable evidence may bind it';
    const installed=await realpath(cli['--playwright']),pw=await loadJSON(path.join(installed,'package.json'),'installed-playwright-metadata');
    requirePolicy(pw.name==='playwright'&&pw.version==='1.62.1','PLAYWRIGHT_PROFILE');const require=createRequire(path.join(installed,'package.json'));
    const coreMetadataPath=await realpath(require.resolve('playwright-core/package.json')),core=await loadJSON(coreMetadataPath,'installed-playwright-core-metadata');
    requirePolicy(core.name==='playwright-core'&&core.version==='1.62.1','PLAYWRIGHT_CORE_PROFILE');
    const root=await loadJSON(path.join(repository,'package.json'),'repository-profile'),ts=await loadJSON(path.join(repository,'node_modules/typescript/package.json'),'compiler-profile');
    requirePolicy(root.packageManager==='pnpm@11.25.0'&&root.devDependencies?.typescript==='7.0.2'&&ts.version==='7.0.2','REPOSITORY_PROFILE');
    const robust=await loadJSON(path.join(repository,'packages/engine/node_modules/robust-predicates/package.json'),'foundational-metadata');
    requirePolicy(robust.name==='robust-predicates'&&robust.version==='3.0.3','FOUNDATIONAL_PROFILE');
    report.installedTrees=[await bounded(bindInstalledTree(installed,'installed-playwright-tree'),'pin-playwright'),
      await bounded(bindInstalledTree(path.dirname(coreMetadataPath),'installed-playwright-core-tree'),'pin-playwright-core')];
    const freezeDirectory=await realpath(cli['--freeze']);requirePolicy(!inside(repository,freezeDirectory)&&!inside(freezeDirectory,repository),'FREEZE_OWNER');await directoryChain(freezeDirectory);
    const frozen=await loadJSON(path.join(freezeDirectory,'collection-inputs.json'),'collection-freeze'),selectors=await loadJSON(path.join(freezeDirectory,'control-selectors.json'),'control-freeze');
    await store.json('collection-freeze.json',frozen);await store.json('control-freeze.json',selectors);
    requirePolicy(frozen.schemaVersion===1&&frozen.ready===true&&selectors.schemaVersion===1&&selectors.ready===true,'FINAL_SOURCE_CONTROL_FREEZE_PENDING');
    requirePolicy(JSON.stringify(frozen.entries)===JSON.stringify(ENTRIES)&&Array.isArray(frozen.files)&&frozen.files.length<=512&&frozen.files.length>0,'FROZEN_GRAPH_SCHEMA');
    requirePolicy(Array.isArray(selectors.controls)&&JSON.stringify(selectors.controls.map(row=>row.id))===JSON.stringify(CONTROL_IDS),'CONTROL_IDS');
    for(let i=0;i<CONTROL_IDS.length;i++)requirePolicy(JSON.stringify(selectors.controls[i].checks)===JSON.stringify(CONTROL_CHECKS[i]),'CONTROL_ASSIGNED_CHECKS',{id:CONTROL_IDS[i]});
    const freezePaths=new Set();for(const expected of frozen.files){
      requirePolicy(typeof expected.relative==='string'&&!path.isAbsolute(expected.relative)&&!expected.relative.includes('\\')&&!expected.relative.split('/').includes('..')
        &&!freezePaths.has(expected.relative)&&Number.isSafeInteger(expected.bytes)&&expected.bytes>=0&&/^[a-f0-9]{64}$/.test(expected.sha256),'FROZEN_FILE_SCHEMA');
      freezePaths.add(expected.relative);const item=await pin(path.join(repository,expected.relative),'root-frozen-final-input',inputByteLimit(expected.relative));
      requirePolicy(inside(repository,item.path)&&item.bytes===expected.bytes&&item.sha256===expected.sha256,'FROZEN_FILE_CHANGED',{relative:expected.relative});}
    for(const relative of[...HARNESS,...OWN_FILES,'pnpm-lock.yaml','source-origin.json'])requirePolicy(freezePaths.has(relative),'FROZEN_REQUIRED_FILE',{relative});
    const selectedBuildReceipt='build-receipt.json';
    requirePolicy(frozen.buildReceipt?.relative===selectedBuildReceipt&&Number.isSafeInteger(frozen.buildReceipt.bytes)&&frozen.buildReceipt.bytes>0
      &&/^[a-f0-9]{64}$/.test(frozen.buildReceipt.sha256),'BUILD_RECEIPT_SCHEMA');
    const build=await pin(path.join(freezeDirectory,selectedBuildReceipt),'root-selected-build-receipt');
    requirePolicy(samePath(build.path,path.join(freezeDirectory,selectedBuildReceipt))&&inside(freezeDirectory,build.path)
      &&build.bytes===frozen.buildReceipt.bytes&&build.sha256===frozen.buildReceipt.sha256,'BUILD_RECEIPT_CHANGED');
    const actualBuild=JSON.parse(build.body.toString('utf8'));
    requirePolicy(actualBuild.schemaVersion==='textured-public-build/1'&&actualBuild.successfulExecution===true&&actualBuild.exitCode===0
      &&actualBuild.signal===null&&actualBuild.error===null&&actualBuild.rawCaptureComplete===true&&actualBuild.sourceStable===true
      &&JSON.stringify(actualBuild.command)===JSON.stringify(['node','tools/build.mjs']),'BUILD_RECEIPT_SCHEMA');
    requirePolicy(actualBuild.runtime?.node==='v26.7.0'&&actualBuild.runtime?.compiler==='7.0.2'
      &&actualBuild.runtime?.packageManager==='pnpm@11.25.0'
      &&actualBuild.runtime.nodeExecutable?.bytes===report.environment.nodeExecutable.bytes
      &&actualBuild.runtime.nodeExecutable?.sha256===report.environment.nodeExecutable.sha256,'BUILD_RUNTIME_CHANGED');
    // Current build-only inputs are not browser modules. Reread their finite canonical
    // vectors under the existing installed-file bound, then retain them for final closure.
    for(const [label,rows]of [['source',actualBuild.sourceAfter],['emitted',actualBuild.emittedAfter]]){
      requirePolicy(Array.isArray(rows)&&rows.length>0&&rows.length<=4096,'BUILD_VECTOR_SCHEMA',{label});
      const seen=new Set();let vectorBytes=0;
      for(const expected of rows){
        const relative=expected.relative;
        requirePolicy(typeof relative==='string'&&relative.length>0&&!path.isAbsolute(relative)&&!/[\\:\0]/.test(relative)
          &&relative.split('/').every(part=>part.length>0&&part!=='.'&&part!=='..')
          &&Number.isSafeInteger(expected.bytes)&&expected.bytes>=0&&/^[a-f0-9]{64}$/.test(expected.sha256),'BUILD_INPUT_SCHEMA');
        const key=process.platform==='win32'?relative.toLowerCase():relative;
        requirePolicy(!seen.has(key),'BUILD_INPUT_DUPLICATE');seen.add(key);
        const installed=label==='source'&&relative.startsWith('node_modules/');
        const maximum=installed?134217728:inputByteLimit(relative);
        vectorBytes+=expected.bytes;
        requirePolicy(expected.bytes<=maximum&&vectorBytes<=budgets.inputBytes,'BUILD_VECTOR_BYTES');
        const requested=path.join(repository,relative),current=await pin(requested,'actual-build-'+label,maximum);
        requirePolicy(samePath(current.path,requested)&&inside(repository,current.path)
          &&current.bytes===expected.bytes&&current.sha256===expected.sha256,'BUILD_INPUT_CHANGED',{relative});
      }
      if(label==='source')for(const required of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json',
        'tools/build.mjs','tools/generate-project-format.mjs','tools/freeze-textured-webgpu-inputs.mjs','source-origin.json'])
        requirePolicy(seen.has(required),'BUILD_REQUIRED_INPUT',{relative:required});
    }
    const graph=await bounded(collectPublicGraph(repository,retain,'m31-textured'),'collect-public-graph');
    for(const item of identities.values())if(item.roles.some(role=>role==='original-emission'||role==='original-source')){
      const relative=path.relative(repository,item.path).replaceAll(path.sep,'/');
      // Foundational physical paths may use the pnpm store; freeze their physical relative path too.
      requirePolicy(freezePaths.has(relative),'FROZEN_GRAPH_INPUT_MISSING',{relative});}
    const shader=frozen.shader;
    requirePolicy(shader&&typeof shader.literal==='string'&&shader.literal.length>0&&shader.literal.length<=LIMITS.moduleBytes
      &&freezePaths.has(shader.sourceRelative)&&graph.modules.has(shader.emissionRelative)&&/^[a-f0-9]{64}$/.test(shader.sha256),'FINAL_SHADER_FREEZE_PENDING');
    const shaderModule=graph.modules.get(shader.emissionRelative);
    requirePolicy(shaderModule.body.toString('utf8').split(shader.literal).length===2&&sha256(Buffer.from(shader.literal))===shader.sha256,'FROZEN_SHADER_LITERAL');
    report.shaderWitness={sourceRelative:shader.sourceRelative,emissionRelative:shader.emissionRelative,emissionSHA256:shaderModule.sha256,
      literalSHA256:shader.sha256,literalBytes:Buffer.byteLength(shader.literal),scope:'Frozen exact source/emitted literal and served module; public collector does not introspect native shader descriptors'};
    await store.json('shader-witness.json',{...report.shaderWitness,literal:shader.literal});
    const harness=new Map();for(const relative of HARNESS)harness.set(relative,await pin(path.join(repository,relative),'first-party-harness'));
    const calibration=JSON.parse(harness.get('tools/textured-webgpu/calibration-manifest.json').body),heldOut=JSON.parse(harness.get('tools/textured-webgpu/held-out-manifest.json').body);
    requirePolicy(JSON.stringify(calibration.cases)===JSON.stringify(CALIBRATION)&&JSON.stringify(heldOut.cases)===JSON.stringify(HELD_OUT),'FIXED_NATIVE_SPLITS');
    await store.json('oracle-manifest.json',{cases:CASES,calibration,heldOut,authority:'Frozen literal/rational oracle; no product/shader/native expected pixels'});
    const copies=new Map();for(const control of selectors.controls){const copy=await bounded(makeCopy({graph,output,control,retain}),'copy-'+control.id);copies.set(control.id,copy);}
    await store.json('copy-manifests.json',[...copies.values()].map(({control,...row})=>({...row,control:{...control}})));
    await store.json('module-graph.json',{entries:ENTRIES,modules:[...graph.modules.values()].map(row=>({relative:row.relative,url:row.url,...descriptor(row),edges:row.edges})),
      sourceBuildAttestedHere:false,copyScope:'Selected engine closure only; runtime/contracts/foundational modules remain original'});
    const allModes=['baseline',...CONTROL_IDS];const registryByMode=new Map();for(const mode of allModes){
      const capture=await captureRegistry({repository,graph,copy:copies.get(mode)??null,map:chosenMap(mode)});captures.push(capture);registryByMode.set(mode,capture);report.registryCaptures.push(capture);}
    await store.json('identity-before.json',[...identities.values()]);await store.json('registry-before.json',report.registryCaptures);
    const routes=new Map(),route=(url,body,contentType,source)=>{requirePolicy(!routes.has(url),'ROUTE_DUPLICATE',{url});
      routes.set(url,{body,contentType,source,bytes:body.length,sha256:sha256(body)});};
    for(const module of graph.modules.values())route(module.url,module.body,'text/javascript; charset=utf-8',{role:'original-emission',...descriptor(module)});
    for(const copy of copies.values())for(const row of copy.rows){const item=await readIdentity(row.path);requirePolicy(item.sha256===row.sha256&&item.bytes===row.bytes,'COPY_BEFORE_SERVE_CHANGED');
      route(row.url,item.body,'text/javascript; charset=utf-8',{role:'selected-copy',...row});}
    const htmlTemplate=harness.get('examples/textured-webgpu/index.html').body.toString('utf8');
    const match=/<script type="importmap">([^<]+)<\/script>/.exec(htmlTemplate);
    requirePolicy(match&&htmlTemplate.split('<script type="importmap">').length===2,'HARNESS_IMPORT_MAP');
    for(const mode of allModes){const prefix=mode==='baseline'?'/':'/copy/'+mode+'/',map=chosenMap(mode),html=Buffer.from(htmlTemplate.replace(match[0],'<script type="importmap">'+JSON.stringify(map)+'</script>'));
      route(prefix+'examples/textured-webgpu/index.html?harness',html,'text/html; charset=utf-8',{role:'generated-selected-map-html',mode,templateSHA256:harness.get('examples/textured-webgpu/index.html').sha256,map});
      for(const relative of['examples/textured-webgpu/main.mjs','examples/textured-webgpu/fixtures.mjs','tools/textured-webgpu/fixtures.mjs'])
        route(prefix+relative,harness.get(relative).body,'text/javascript; charset=utf-8',{role:'unchanged-first-party-harness',mode,...descriptor(harness.get(relative))});}
    route('/tools/textured-webgpu/native-window.mjs',harness.get('tools/textured-webgpu/native-window.mjs').body,'text/javascript; charset=utf-8',{role:'native-device-tooling',...descriptor(harness.get('tools/textured-webgpu/native-window.mjs'))});
    route('/examples/canvas-scene/favicon.svg',Buffer.alloc(0),'image/svg+xml',{role:'empty-favicon',status:204});
    await store.json('served-manifest.json',[...routes].map(([url,row])=>({url,bytes:row.bytes,sha256:row.sha256,source:row.source})));
    server=createServer((request,response)=>{
      const row=routes.get(request.url),admitted=request.method==='GET'&&row&&origin&&request.headers.host===new URL(origin).host&&currentWindow!==null;
      if(!currentWindow||currentWindow.requests.length>=LIMITS.requestsPerWindow){fatalIncomplete=true;report.requestOverflow=true;response.writeHead(429);response.end();return;}
      const record={windowId:currentWindow.id,method:request.method,url:request.url,admitted:Boolean(admitted),
        ...(row?{servedBytes:row.bytes,servedSHA256:row.sha256,source:row.source}:{})};currentWindow.requests.push(record);report.requests.push(record);
      if(!admitted){fatalIncomplete=true;report.unselectedRequest=true;response.writeHead(404,{'Cache-Control':'no-store'});response.end();return;}
      response.writeHead(row.source.status??200,{'Content-Type':row.contentType,'Content-Length':row.bytes,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'none';script-src 'self' 'unsafe-inline';style-src 'unsafe-inline';img-src 'self';connect-src 'none';base-uri 'none'"});response.end(row.body);});
    server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
    server.on('error',error=>{fatalIncomplete=true;report.serverFailure=fault(error);});
    await bounded(observe(new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);})), 'server-start');
    origin='http://127.0.0.1:'+server.address().port;
    const playwright=await import(pathToFileURL(path.join(installed,'index.mjs')).href);
    browser=await bounded(acquire(playwright.chromium.launch({channel:'msedge',headless:true}),'browser',value=>{
      browser=value;value.on('disconnected',()=>{if(!browserCloseRequested){fatalIncomplete=true;report.unexpectedBrowserDisconnect=true;}});}), 'browser-launch');
    report.environment.browserVersion=browser.version();

    async function runWindow(phase,mode,id,assigned=null){
      requirePolicy(report.calibration.length+report.heldOut.length+report.controls.length<budgets.windows,'WINDOW_BUDGET');
      const number=report.calibration.length+report.heldOut.length+report.controls.length+1,prefix=mode==='baseline'?'/':'/copy/'+mode+'/';
      const record={id:'w'+String(number).padStart(2,'0')+'-'+id,phase,mode,caseId:id,assigned,observations:[],requests:[],events:[],native:null,status:'INCOMPLETE'};
      (phase==='calibration'?report.calibration:phase==='held-out'?report.heldOut:report.controls).push(record);currentWindow=record;
      let context,page;
      const addEvent=value=>{if(record.events.length>=LIMITS.eventsPerWindow){fatalIncomplete=true;record.eventOverflow=true;return;}record.events.push(value);};
      try{
        context=await bounded(acquire(browser.newContext({viewport:{width:128,height:128},deviceScaleFactor:1}),'context-'+record.id,value=>{context=value;openContexts.add(value);}), 'context-'+record.id);
        page=await bounded(acquire(context.newPage(),'page-'+record.id,value=>{page=value;openPages.add(value);}), 'page-'+record.id);
        page.on('pageerror',error=>addEvent({kind:'pageerror',...fault(error)}));
        page.on('console',message=>{if(['warning','error'].includes(message.type()))addEvent({kind:'console',level:message.type(),text:message.text().slice(0,16000),location:message.location()});});
        page.on('requestfailed',request=>addEvent({kind:'requestfailed',url:request.url(),text:request.failure()?.errorText??'unknown'}));
        page.on('response',response=>{if(response.status()>=400)addEvent({kind:'HTTP',url:response.url(),status:response.status()});});
        await bounded(observe(page.exposeBinding('__retainTexturedObservation',(source,packet)=>observe((async()=>{
          requirePolicy(source.page===page&&packet?.caseId===id&&expectedRoles(id)[record.observations.length]===packet.role,'OBSERVATION_IDENTITY');
          const row=packet.row;requirePolicy(row&&row.role===packet.role&&Array.isArray(row.readback?.bytes)&&row.readback.bytes.length<=4*48*48,'OBSERVATION_SCHEMA');
          // Raw and metadata are retained before any comparator or screenshot classification.
          requirePolicy(row.readback.bytes.every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255),'DELIVERED_BYTE_SCHEMA');
          const name=record.id+'-'+packet.role,raw=await bounded(observe(store.save(name+'.rgba',Buffer.from(row.readback.bytes))),'save-raw-'+name);
          const metadata={...row,readback:{...row.readback,bytes:undefined,rawArtifact:raw}};
          await bounded(observe(store.json(name+'-metadata.json',metadata)),'save-metadata-'+name);
          const observation={role:packet.role,raw,metadata,checks:[],pngs:[],pngScope:'Native canvas composition only; not reconstructed from raw pixels'};record.observations.push(observation);
          try{
            const style=await bounded(observe(page.evaluate(()=>({html:document.documentElement.style.background,body:document.body.style.background}))), 'png-style-'+name);
            try{for(const background of['black','white']){
              await bounded(observe(page.evaluate(color=>{document.documentElement.style.background=color;document.body.style.background=color;},background)),'png-background-'+name);
              const png=await bounded(observe(page.locator('#scene').screenshot({type:'png',omitBackground:false})),'png-'+name+'-'+background);
              requirePolicy(png.length>=24&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'NATIVE_PNG_SIGNATURE');
              const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
              requirePolicy(width===row.readback.width&&height===row.readback.height,'NATIVE_PNG_BACKING',{width,height});
              observation.pngs.push({background,width,height,...await bounded(observe(store.save(name+'-'+background+'.png',png)),'save-png-'+name)});
            }}finally{await bounded(observe(page.evaluate(value=>{document.documentElement.style.background=value.html;document.body.style.background=value.body;},style)),'png-style-restore-'+name);}
          }catch(error){fatalIncomplete=true;observation.pngFailure=fault(error);}
          // A fixed oracle rejection is stored and acknowledged; it does not suppress later reset/replay/cleanup.
          observation.checks=numericChecks(row,id);
          return {retained:true};
        })()))), 'observation-binding-'+record.id);
        await bounded(observe(page.goto(origin+prefix+'examples/textured-webgpu/index.html?harness')),'page-start-'+record.id);
        await bounded(observe(page.waitForFunction(()=>globalThis.ready===true)),'fixture-ready-'+record.id);
        record.native=await bounded(observe(page.evaluate(async caseId=>{const module=await import('/tools/textured-webgpu/native-window.mjs');return module.runNativeCase(caseId);},id)), 'native-'+record.id);
        await bounded(observe(store.json(record.id+'-native.json',record.native)),'save-native-'+record.id);
        if(record.native.status==='UNSUPPORTED'){
          unsupported=true;if(number!==1)throw incomplete('CAPABILITY_CHANGED_AFTER_BASELINE');record.status='UNSUPPORTED';return;}
        requirePolicy(publicCleanup(record.native),'NATIVE_STRUCTURAL_OR_CLEANUP_FAILURE',{id,failure:record.native.failure,cleanup:record.native.cleanup});
        record.metadataValidation=actualNativeMetadata(record.native);
        requirePolicy(record.metadataValidation.accepted,'NATIVE_METADATA_INCOMPLETE',{id,issues:record.metadataValidation.issues});
        requirePolicy(JSON.stringify(record.observations.map(row=>row.role))===JSON.stringify(expectedRoles(id)),'NATIVE_OBSERVATION_ROLES');
        requirePolicy(record.native.scene.devicePolicy==='borrow','ACTUAL_DEVICE_BINDING');
        requirePolicy(record.observations.every(row=>row.metadata.status.pendingFrames===0&&row.metadata.status.pendingUploadBytes===0&&row.metadata.status.pendingReadbackBytes===0
          &&row.metadata.texturedStatus.pendingGeometryBytes===0&&!row.metadata.status.firstFailure),'VISIBLE_LEDGER_RETIREMENT');
        if(definition(id).scenario==='retained'){
          const scene=record.native.scene,first=record.observations[1].metadata.readback,second=record.observations[2].metadata.readback;
          requirePolicy(scene.authorRetiredBeforeReplay&&scene.retainedIdentityPreserved&&first.frameId===second.frameId&&first.serial!==second.serial,'RETAINED_REPLAY_IDENTITY');}
        const failed=record.observations.flatMap(row=>row.checks.filter(check=>!check.accepted).map(check=>({role:row.role,...check})));
        if(assigned){const [caseId,assertion,role]=assigned;requirePolicy(caseId===id,'CONTROL_CASE');
          const hit=failed.some(check=>(!role||check.role===role)&&check.failure.assertion===assertion&&
            (assertion==='TEXTURED_NATIVE_METADATA_INVALID'?check.kind==='oracle-schema':check.kind==='pixel'));
          record.assignedBehavioralFailureObserved=hit;record.status=hit?'EXPECTED_BEHAVIORAL_FAILURE':'CONTROL_NOT_SENSITIVE';if(!hit)numericFailure=true;
        }else{record.status=failed.length?'PIXEL_OR_SCHEMA_FAILURE':'PASSED';if(failed.length)numericFailure=true;}
      }catch(error){fatalIncomplete=true;record.failure=fault(error);
        if(page)try{record.partialNative=await bounded(observe(page.evaluate(async()=>{const module=await import('/tools/textured-webgpu/native-window.mjs');return module.lastNativeWindow();})),'partial-native-'+record.id,true);}
          catch(partialError){record.partialFailure=fault(partialError);}}
      finally{
        if(page)try{await bounded(observe(page.close().then(()=>openPages.delete(page))),'page-close-'+record.id,true);}catch(error){markIncomplete('PAGE_CLOSE',{id},error);}
        if(context)try{await bounded(observe(context.close().then(()=>{openContexts.delete(context);report.lifecycle.contextsClosed++;})),'context-close-'+record.id,true);}catch(error){markIncomplete('CONTEXT_CLOSE',{id},error);}
        // Late warnings/errors and request isolation are checked after page/context closure.
        if(record.events.length||record.eventOverflow){fatalIncomplete=true;record.unexpectedBrowserEvents=true;}
        const requested=new Set(record.requests.filter(row=>row.admitted).map(row=>row.url));
        const selected=registryByMode.get(mode),otherRegistry=[...requested].filter(url=>url.endsWith('/internal/texturedFrameState.js')&&url!==selected.selectedURL);
        const wrongEngine=[...requested].filter(url=>url.includes('packages/engine/dist/')&&!url.startsWith(prefix+'packages/engine/dist/'));
        record.moduleRequestEvidence={selectedRegistryURL:selected.selectedURL,selectedRegistryRequested:requested.has(selected.selectedURL),
          actualEngineRequested:requested.has(prefix+'packages/engine/dist/Engine.js'),actualHostRequested:requested.has(prefix+'packages/engine/dist/web/WebGPUHost.js'),
          otherRegistry,wrongEngine,canvasRequests:[...requested].filter(url=>/CanvasHost\.js|\/canvas\.js/.test(url)),scope:'Observed admitted HTTP requests; ESM identity follows this exact selected map, not bytes alone'};
        if(!record.moduleRequestEvidence.selectedRegistryRequested||!record.moduleRequestEvidence.actualEngineRequested||!record.moduleRequestEvidence.actualHostRequested
          ||otherRegistry.length||wrongEngine.length||record.moduleRequestEvidence.canvasRequests.length)fatalIncomplete=true;
        report.browserEvents.push(...record.events.map(row=>({windowId:record.id,...row})));
        await registryReread('window-'+record.id,selected);currentWindow=null;
        try{await bounded(observe(store.json(record.id+'-window.json',record)),'save-window-'+record.id,true);}catch(error){markIncomplete('WINDOW_SAVE',{id},error);}
      }
    }
    for(const id of CALIBRATION){await runWindow('calibration','baseline',id);if(unsupported||fatalIncomplete)break;}
    // No fit or mutation between splits. Numeric failures remain failures while held-out evidence is retained.
    if(!unsupported&&!fatalIncomplete)for(const id of HELD_OUT){await runWindow('held-out','baseline',id);if(fatalIncomplete)break;}
    if(!unsupported&&!fatalIncomplete&&!numericFailure){controlWindows:for(let i=0;i<CONTROL_IDS.length;i++)for(const check of CONTROL_CHECKS[i]){
      await runWindow('control',CONTROL_IDS[i],check[0],check);if(fatalIncomplete)break controlWindows;}}
    if(!unsupported&&!fatalIncomplete&&!numericFailure)report.status='PASS';
    else if(unsupported&&!fatalIncomplete)report.status='UNSUPPORTED';else if(!fatalIncomplete)report.status='FAIL';
  }catch(error){report.failure=fault(error);fatalIncomplete=true;report.status='INCOMPLETE';}
  finally{
    // Assign and retire late acquisition handles; timeout never cancels the started operation.
    for(const record of acquisitions)if(!record.settled)try{await bounded(record.promise,'late-'+record.label,true);}catch(error){markIncomplete('LATE_ACQUISITION',{label:record.label},error);}
    for(const page of[...openPages])try{await bounded(observe(page.close().then(()=>openPages.delete(page))),'remaining-page-close',true);}catch(error){markIncomplete('PAGE_CLOSE',{},error);}
    for(const context of[...openContexts])try{await bounded(observe(context.close().then(()=>{openContexts.delete(context);report.lifecycle.contextsClosed++;})),'remaining-context-close',true);}catch(error){markIncomplete('CONTEXT_CLOSE',{},error);}
    if(browser)try{browserCloseRequested=true;await bounded(observe(browser.close().then(()=>{report.lifecycle.browserClosed=true;})),'browser-close',true);}catch(error){markIncomplete('BROWSER_CLOSE',{},error);}
    if(server)try{server.closeAllConnections();for(const socket of sockets)socket.destroy();await bounded(observe(new Promise((done,reject)=>server.close(error=>error?reject(error):done()))),'server-close',true);report.lifecycle.serverClosed=sockets.size===0;}catch(error){markIncomplete('SERVER_CLOSE',{},error);}
    try{if(pending.size)await bounded(observe(Promise.allSettled([...pending])),'api-drain',true);}catch(error){markIncomplete('API_DRAIN',{},error);}
    // Always read every retained registry selection and every original/copy/tool identity after earlier refusal.
    for(const capture of captures)await registryReread('final',capture);
    try{const after=await bounded(rereadAll(identities),'identity-final',true);report.identitiesAfter={accepted:after.accepted,count:after.observations.length};report.lifecycle.identitiesStable=after.accepted;if(!after.accepted)fatalIncomplete=true;
      if(store)report.identitiesAfter.artifact=await bounded(observe(store.json('identity-after.json',after)),'save-identity-after',true);}catch(error){markIncomplete('FINAL_IDENTITIES',{},error);}
    report.lifecycle.pendingApiOperations=pending.size;report.lifecycle.unsettledAcquisitions=acquisitions.filter(row=>!row.settled).map(row=>row.label);
    report.lifecycle.standaloneCleanupObserved=pending.size===0&&openPages.size===0&&openContexts.size===0&&report.lifecycle.unsettledAcquisitions.length===0
      &&(!browser||report.lifecycle.browserClosed)&&(!server||report.lifecycle.serverClosed);
    if(!report.lifecycle.standaloneCleanupObserved||report.serverFailure||report.unexpectedBrowserDisconnect)fatalIncomplete=true;
    report.counts={calibrationCases:report.calibration.length,heldOutCases:report.heldOut.length,controlWindows:report.controls.length,
      controlsSensitive:CONTROL_IDS.filter(id=>report.controls.filter(row=>row.mode===id).length===CONTROL_CHECKS[CONTROL_IDS.indexOf(id)].length
        &&report.controls.filter(row=>row.mode===id).every(row=>row.status==='EXPECTED_BEHAVIORAL_FAILURE')).length,
      positiveObservations:[...report.calibration,...report.heldOut].reduce((sum,row)=>sum+row.observations.length,0),controlObservations:report.controls.reduce((sum,row)=>sum+row.observations.length,0)};
    if(report.status==='PASS'&&(report.counts.calibrationCases!==11||report.counts.heldOutCases!==10||report.counts.controlWindows!==16||report.counts.controlsSensitive!==12
      ||report.counts.positiveObservations!==27||report.counts.controlObservations!==19)){numericFailure=true;report.status='FAIL';report.countFailure='Required finite windows/observations missing';}
    if(store)try{const requestCount=report.requests.length,requestArtifact=await bounded(observe(store.json('requests.json',report.requests)),'save-requests',true);
      report.requests={count:requestCount,artifact:requestArtifact};
      await bounded(observe(store.json('registry-after.json',{captures:report.registryCaptures,rereads:report.registryRereads,failures:report.registryFailures})),'save-registry-after',true);
      const artifactsAfter=await bounded(store.reread(),'artifact-final',true);report.lifecycle.artifactsStable=artifactsAfter.accepted;
      await bounded(observe(store.json('artifact-readback.json',artifactsAfter)),'save-artifact-readback',true);
      if(!artifactsAfter.accepted)fatalIncomplete=true;
    }catch(error){markIncomplete('FINAL_ARTIFACTS',{},error);}
    if(fatalIncomplete)report.status='INCOMPLETE'; // This priority survives every count/numeric branch.
    report.elapsedMs=Date.now()-began;report.exitCode=report.status==='PASS'?0:report.status==='UNSUPPORTED'?2:1;
    if(store)try{report.artifacts=[...store.records.values()];await bounded(observe(store.json('result.json',report)),'save-result',true);
      const final=await bounded(store.reread(),'result-readback',true);if(!final.accepted)throw incomplete('FINAL_RESULT_READBACK',{observations:final.observations});
      const seal=await bounded(observe(store.json('collection-seal.json',{schemaVersion:1,status:report.status,exitCode:report.exitCode,
        artifacts:final.observations.map(row=>row.before),stableFinalReadback:true,selfIdentity:'Reported separately; no circular self-hash',
        boundaries:report.scope})),'save-collection-seal',true);
      const sealAfter=await bounded(readIdentity(seal.path,LIMITS.artifactBytes),'collection-seal-readback',true);
      requirePolicy(sealAfter.bytes===seal.bytes&&sealAfter.sha256===seal.sha256,'COLLECTION_SEAL_READBACK');report.finalSeal=seal;}
      catch(error){report.status='INCOMPLETE';report.exitCode=1;console.error(JSON.stringify({evidenceSaveFailure:fault(error)}));
        if(output)try{writeFileSync(path.join(output,'final-save-failure.json'),JSON.stringify({status:'INCOMPLETE',failure:fault(error)})+'\n',{flag:'wx'});}catch{}}
    if(report.lifecycle.standaloneCleanupObserved)clearTimeout(hardTimer);process.exitCode=report.exitCode;
    console.log(JSON.stringify({status:report.status,exitCode:report.exitCode,counts:report.counts,lifecycle:report.lifecycle,finalSeal:report.finalSeal,failure:report.failure}));
  }
}
