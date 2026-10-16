// SPDX-License-Identifier: Apache-2.0
// Finite disposable closure preparation. Never mutates the selected development repository.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { absolute, authenticateIdentity, inventoryTree, readPinned, HASH, decode, requireThat, equal, PUBLIC_TEXT, APP,
  assignedMutation, BUILD_PACKAGES, WORKSPACE_ALIASES, validateBuildPackage, IMPORT_TEXT, importChildEnvironment, strictJSON, validateImportArtifacts } from './boundary.mjs';
import { PROFILES, KINDS, FIXTURE_ROUTE } from './scenario.mjs';
const ROOT_FILES=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json','AGENTS.md','LICENSE',
  'tools/build.mjs','tools/generate-project-format.mjs','tools/lib/file-identity.mjs','tests/helpers.mjs',...PUBLIC_TEXT,
  'tools/atlas-frame/author-assets.mjs','tools/atlas-frame/oracle.mjs','tests/atlas-frame-oracle-unit.test.mjs',
  APP+'assets/atlas.png',APP+'assets/provenance.json'];
// Fixed stdin bytes are independent of destination/backend; no dynamic data enters code.
export const IMPORT_PLANNER_STDIN = "import fs from 'node:fs';\nimport path from 'node:path';\nimport {fileURLToPath} from 'node:url';\nimport {createHash} from 'node:crypto';\nimport {fingerprintFile,samePhysicalPath,ownerRelativePath} from './tools/lib/file-identity.mjs';\nimport {METADATA,EXPECTED_PLAN,fixedInput,serialize,allFrozen} from './tools/atlas-import/scenario.mjs';\nconst assert=(value,message)=>{if(!value)throw Error(message);};\nconst equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);\nconst HASH=raw=>createHash('sha256').update(raw).digest('hex');\nconst H=fs.realpathSync(process.cwd()),D=fs.realpathSync(path.dirname(H)),inputRoot=path.join(D,'import-input');\nassert(path.basename(H)==='healthy'&&process.cwd()===H&&!fs.lstatSync(H).isSymbolicLink(),'Fixed canonical actual cwd');\nownerRelativePath(D,H);\nassert(process.argv.length===1&&samePhysicalPath(fs.realpathSync(process.argv[0]),fs.realpathSync(process.execPath)),'Exact actual executable argv');\nequal(process.execArgv,['--input-type=module'],'Exact actual execArgv');\nconst environment=Object.fromEntries(Object.keys(process.env).sort().map(key=>[key,process.env[key]]));\nif(process.platform==='win32'){\n  equal(Object.keys(environment),['HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','SYSTEMROOT','TEMP','USERDOMAIN','USERNAME','USERPROFILE','WINDIR'],'Complete actual Windows environment keys');\n  for(const key of Object.keys(environment))if(key!=='SYSTEMROOT')equal(environment[key],'','Forbidden actual environment selector');\n  const value=environment.SYSTEMROOT;\n  assert(typeof value==='string'&&path.win32.isAbsolute(value)&&!/[\\x00-\\x1f\\x7f]/.test(value)&&!/^(?:\\\\\\\\|\\/\\/)[?.]/.test(value)\n    &&!/[\\\\/](?:\\.{1,2})(?:[\\\\/]|$)/.test(value),'Canonical actual OS initialization directory');\n  const real=fs.realpathSync(value);assert(real===value&&samePhysicalPath(value,real,'win32'),'Actual canonical OS directory identity');\n  let current=path.parse(real).root;for(const part of real.slice(current.length).split(path.sep).filter(Boolean)){\n    assert(fs.readdirSync(current).includes(part),'Actual OS spelling');current=path.join(current,part);\n    assert(!fs.lstatSync(current).isSymbolicLink()&&fs.lstatSync(current).isDirectory(),'Actual OS symbolic member');\n  }\n}else equal(environment,{},'Zero actual non-Windows environment keys');\nassert(!fs.lstatSync(inputRoot).isSymbolicLink()&&fs.lstatSync(inputRoot).isDirectory()&&fs.realpathSync(inputRoot)===inputRoot,'Fixed input owner');\nconst read=(owner,key)=>{const raw=fs.readFileSync(path.join(owner,key)),pin=fingerprintFile(owner,key);\n  equal({bytes:raw.length,sha256:HASH(raw)},{bytes:pin.bytes,sha256:pin.sha256},'Owned actual bytes');return {raw,pin:{ownerRoot:owner,...pin}};};\nconst inputFile=read(inputRoot,'input.json'),metadata=read(inputRoot,'metadata.json'),originalPng=read(H,'examples/trimmed-atlas-playback/assets/atlas.png');\nassert(inputFile.raw.equals(Buffer.from(serialize(fixedInput())))&&metadata.raw.equals(Buffer.from(METADATA)),'Fixed complete original input bytes');\nassert(originalPng.raw.length===218&&HASH(originalPng.raw)==='35a3ecea0d79c5684d17a5dbfa56bf0cc5ebf52a34f6e8ceafe740c742a1437f','Original page raw identity');\nconst actualInput=JSON.parse(inputFile.raw.toString('utf8'));\nassert(actualInput.source.text===metadata.raw.toString('utf8')&&Buffer.from(actualInput.source.text).equals(metadata.raw),'Actual source text raw binding');\nconst resolved=fs.realpathSync(fileURLToPath(import.meta.resolve('@egret/project/atlas')));\nassert(ownerRelativePath(H,resolved)==='packages/project/dist/atlas/index.js','Actual public resolution');\nconst packagePin=fingerprintFile(H,'packages/project/package.json'),entryPin=fingerprintFile(H,'packages/project/dist/atlas/index.js');\nconst packageMeta=JSON.parse(fs.readFileSync(path.join(H,packagePin.path),'utf8'));\nequal(packageMeta.exports['./atlas'],{types:'./dist/atlas/index.d.ts',import:'./dist/atlas/index.js'},'Actual public package export metadata');\nconst {createAtlasImportPlan}=await import('@egret/project/atlas');\n// The next call consumes the complete owned actualInput recorded below; exactly one planner invocation.\nconst result=createAtlasImportPlan(actualInput);\nequal(result,{ok:true,value:EXPECTED_PLAN,diagnostics:[]},'Complete independent literal planner equality');\nconst freezeObservations={plan:Object.isFrozen(result.value),ownedContainers:allFrozen(result)&&result.value.page!==actualInput.page\n  &&result.value.page.provenance!==actualInput.page.provenance&&result.value.sourceDeclarations.metadata.provenance!==actualInput.source.provenance\n  &&result.value.spriteSheetFrames[0].layout!==result.value.sequenceInput.frames[0].layout};\nequal(freezeObservations,{plan:true,ownedContainers:true},'Actual live immutable owned plan');\nconst planBytes=Buffer.from(serialize(result.value));fs.writeFileSync(path.join(inputRoot,'plan.json'),planBytes,{flag:'wx'});\nconst saved=read(inputRoot,'plan.json');assert(saved.raw.equals(planBytes),'Saved complete serialization');\nequal(JSON.parse(saved.raw.toString('utf8')),result.value,'Saved complete actual live value');\nconst record={schemaVersion:1,kind:'ATLAS_IMPORT_NODE_CALL_RESULT_V1',platform:process.platform,environment,actualInput,\n  rawInputs:{input:inputFile.pin,metadata:metadata.pin,originalPng:originalPng.pin},\n  publicEntry:{specifier:'@egret/project/atlas',ownerRoot:H,resolutionBase:H,package:packagePin,entry:entryPin},result,freezeObservations,\n  planArtifact:{...saved.pin,serialization:'utf8-json-2space-lf-final-newline-v1'}};\nprocess.stdout.write(serialize(record));\n";
export async function prepareNative({repository,taskRoot,destination,playwrightRoot,profile,kind}){
  requireThat([repository,taskRoot,destination,playwrightRoot].every(absolute)&&PROFILES.includes(profile)&&(KINDS.includes(kind)||kind==='atlas-import-v1'),'Closed absolute preparation arguments required');
  const identity=await authenticateIdentity(repository);repository=fs.realpathSync(repository);taskRoot=fs.realpathSync(taskRoot);
  identity.ownerRelativePath(taskRoot,destination);
  const outside=target=>{requireThat(!identity.samePhysicalPath(repository,target),'External private target required');
    try{identity.ownerRelativePath(repository,target);throw new Error('Private target belongs to product');}catch(cause){if(!(cause instanceof RangeError))throw cause;}};
  outside(taskRoot);outside(destination);requireThat(!fs.existsSync(destination),'Fresh preparation directory required');
  requireThat(process.platform==='win32'&&process.arch==='x64','Only reviewed Windows x64 build toolchain admitted');
  fs.mkdirSync(destination);
  const importer=kind==='atlas-import-v1',rootFiles=importer?[...ROOT_FILES,...IMPORT_TEXT]:ROOT_FILES;
  if(importer)destination=path.join(fs.realpathSync(path.dirname(destination)),path.basename(destination));
  const stamp=new Date().toISOString(),roots={},builds=[];
  function copyFile(owner,key,targetRoot){const input=readPinned(identity,owner,key),target=path.join(targetRoot,key);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,input.raw,{flag:'wx'});}
  function copyTree(owner,targetRoot){for(const pin of inventoryTree(identity,owner))copyFile(owner,pin.path,targetRoot);}
  function clone(targetRoot){
    fs.mkdirSync(targetRoot);
    for(const relative of rootFiles)copyFile(repository,relative,targetRoot);
    for(const name of ['contracts','runtime','engine','project']){
      const base='packages/'+name;
      for(const entry of fs.readdirSync(path.join(repository,base)))if(entry==='package.json'||/^tsconfig(?:\.[a-z]+)?\.json$/.test(entry))copyFile(repository,base+'/'+entry,targetRoot);
      for(const directory of ['src','web','rendering','schema'])if(fs.existsSync(path.join(repository,base,directory)))
        for(const pin of inventoryTree(identity,repository,base+'/'+directory))copyFile(repository,pin.path,targetRoot);
    }
    for(const selected of BUILD_PACKAGES){
      const {alias,name,version}=selected,source=fs.realpathSync(path.join(repository,alias));
      const metadata=JSON.parse(decode(readPinned(identity,source,'package.json').raw));
      validateBuildPackage(selected,metadata);
      const target=path.join(targetRoot,alias);fs.mkdirSync(target,{recursive:true});copyTree(source,target);
      equal(inventoryTree(identity,target),inventoryTree(identity,source),'Complete original installed package copy differs '+alias);
    }
    // Match the actual retained root aliases. Project/runtime resolve through this root;
    // no invented package-local fallback aliases or broad dependency directories are copied.
    for(const {alias,workspace:name} of WORKSPACE_ALIASES){
      requireThat(identity.samePhysicalPath(fs.realpathSync(path.join(repository,alias)),path.join(repository,'packages',name)),'Actual root workspace alias differs '+alias);
      fs.mkdirSync(path.dirname(path.join(targetRoot,alias)),{recursive:true});
      fs.symlinkSync(path.join(targetRoot,'packages',name),path.join(targetRoot,alias),'junction');
    }
  }
  const sourcePins=owner=>{
    const result=[];
    for(const relative of rootFiles)result.push(readPinned(identity,owner,relative).pin);
    for(const name of ['contracts','runtime','engine','project']){
      const base='packages/'+name;
      for(const entry of fs.readdirSync(path.join(owner,base)))if(entry==='package.json'||/^tsconfig(?:\.[a-z]+)?\.json$/.test(entry))result.push(readPinned(identity,owner,base+'/'+entry).pin);
      for(const dir of ['src','web','rendering','schema'])if(fs.existsSync(path.join(owner,base,dir)))result.push(...inventoryTree(identity,owner,base+'/'+dir));
    }return result.sort((a,b)=>a.path.localeCompare(b.path));
  };
  for(const role of (kind==='ordinary'||kind==='atlas-import-v1')?['healthy']:['healthy','assigned']){
    const owner=path.join(destination,role);clone(owner);roots[role]=owner;
    let mutation=null;
    if(role==='assigned'){
      const relative='packages/runtime/src/bitmapAtlasPlacement.ts',input=readPinned(identity,owner,relative);
      const changed=Buffer.from(assignedMutation(decode(input.raw),kind));fs.writeFileSync(path.join(owner,relative),changed);
      mutation={path:relative,before:input.pin,after:readPinned(identity,owner,relative).pin};
    }
    const inputs=sourcePins(owner),compilerRoot=path.join(owner,'node_modules/typescript');
    const compiler=inventoryTree(identity,compilerRoot),nodeRaw=fs.readFileSync(process.execPath);
    const compilerPackages=BUILD_PACKAGES.map(selected=>({...selected,ownerRoot:path.join(owner,selected.alias),
      originalOwner:fs.realpathSync(path.join(repository,selected.alias)),files:inventoryTree(identity,path.join(owner,selected.alias))}));
    const nativeExecutable=readPinned(identity,path.join(owner,'node_modules/@typescript/typescript-win32-x64'),'lib/tsc.exe').pin;
    const started=new Date().toISOString();
    const env={...process.env};for(const name of ['NODE_OPTIONS','NODE_PATH','TS_NODE_PROJECT','TS_NODE_COMPILER_OPTIONS'])delete env[name];
    const run=spawnSync(process.execPath,['tools/build.mjs'],{cwd:owner,env,encoding:null,timeout:120000,maxBuffer:16_777_216});
    const finished=new Date().toISOString(),stdout=run.stdout??Buffer.alloc(0),stderr=run.stderr??Buffer.alloc(0);
    const build={role,owner,started,finished,command:{exe:process.execPath,args:['tools/build.mjs'],cwd:owner},
      node:{path:process.execPath,bytes:nodeRaw.length,sha256:HASH(nodeRaw)},compiler:{owner:compilerRoot,files:compiler,
        packages:compilerPackages,nativeExecutable:{owner:'compiler-native',...nativeExecutable}},
      inputs,mutation,exitCode:run.status,error:run.error?{code:run.error.code,message:run.error.message}:null,
      stdout:{bytes:stdout.length,sha256:HASH(stdout),base64:stdout.toString('base64')},
      stderr:{bytes:stderr.length,sha256:HASH(stderr),base64:stderr.toString('base64')}};
    builds.push(build);fs.writeFileSync(path.join(destination,'preparation-progress.json'),JSON.stringify({stamp,builds},null,2)+'\n');
    requireThat(!run.error&&run.status===0,'Actual disposable compiler failed; original logs retained');
    equal(sourcePins(owner),inputs,'Compiler/source inputs drifted during actual build');
    for(const selected of compilerPackages)equal(inventoryTree(identity,selected.ownerRoot),selected.files,'Actual compiler/dependency package drifted '+selected.alias);
    build.outputs=['contracts','runtime','engine','project'].flatMap(name=>[
      ...inventoryTree(identity,owner,'packages/'+name+'/dist'),
      ...fs.readdirSync(path.join(owner,'packages',name)).filter(entry=>/^tsconfig(?:\.[a-z]+)?\.tsbuildinfo$/.test(entry))
        .map(entry=>readPinned(identity,owner,'packages/'+name+'/'+entry).pin),
    ]);
  }
  const fixture=readPinned(identity,roots.healthy,importer?'tools/atlas-import/native-fixture.mjs':'tools/atlas-frame/native-fixture.mjs').pin;
  const oracle=readPinned(identity,roots.healthy,'tools/atlas-frame/oracle.mjs').pin;
  const importArtifacts=importer?await prepareImportInput(identity,roots.healthy,destination):null;
  const config={schemaVersion:importer?2:1,repositoryRoot:roots.healthy,taskRoot,snapshot:path.join(destination,'snapshot.json'),
    output:path.join(destination,'native-output'),playwrightRoot,nativeScenario:{profile,kind},
    closures:Object.entries(roots).map(([role,repositoryRoot])=>({role,repositoryRoot})),
    fixture:{path:path.join(roots.healthy,fixture.path),route:importer?'/tools/atlas-import/native-fixture.mjs':FIXTURE_ROUTE,exportName:importer?'runAtlasImportNativeFixture':'runAtlasFrameNativeFixture',bytes:fixture.bytes,sha256:fixture.sha256},
    ...(importer?importArtifacts:{oracle:{path:path.join(roots.healthy,oracle.path),bytes:oracle.bytes,sha256:oracle.sha256}})};
  const configPath=path.join(destination,'config.json'),raw=Buffer.from(JSON.stringify(config,null,2)+'\n');
  if(importer)await validateImportArtifacts(config,configPath,identity,IMPORT_PLANNER_STDIN);
  fs.writeFileSync(configPath,raw,{flag:'wx'});
  fs.writeFileSync(configPath+'.preparation.json',JSON.stringify({schemaVersion:1,kind,profile,config:{bytes:raw.length,sha256:HASH(raw)},builds},null,2)+'\n',{flag:'wx'});
  return {status:'PREPARED_NO_BROWSER',configPath,configSha256:HASH(raw),snapshotCommand:{exe:process.execPath,args:[path.join(roots.healthy,'tools/verify-atlas-frame.mjs'),'--config',configPath,'--config-sha256',HASH(raw),'--snapshot-only']}};
}
async function cli(){const selected=new Map();
  for(let i=2;i<process.argv.length;i++){const name=process.argv[i],value=process.argv[++i];requireThat(['--repository','--task-root','--destination','--playwright-root','--profile','--kind'].includes(name)&&!selected.has(name)&&value,'Unique exact preparation arguments required');selected.set(name,value);}
  requireThat(selected.size===6,'Complete preparation arguments required');
  console.log(JSON.stringify(await prepareNative({repository:selected.get('--repository'),taskRoot:selected.get('--task-root'),destination:selected.get('--destination'),playwrightRoot:selected.get('--playwright-root'),profile:selected.get('--profile'),kind:selected.get('--kind')})));
}
if(process.argv[1]&&pathToFileURL(fs.realpathSync(process.argv[1])).href===import.meta.url)await cli();

async function prepareImportInput(identity,H,D){
  const source=await import('../atlas-import/scenario.mjs'),inputRoot=path.join(D,'import-input'),oracleRoot=path.join(D,'oracle');
  fs.mkdirSync(inputRoot);fs.mkdirSync(oracleRoot);
  for(const [key,text] of [['input.json',source.serialize(source.fixedInput())],['metadata.json',source.METADATA]])
    fs.writeFileSync(path.join(inputRoot,key),Buffer.from(text),{flag:'wx'});
  const before=['input.json','metadata.json'].map(key=>readPinned(identity,inputRoot,key).pin);
  const scenarioBefore=readPinned(identity,H,'tools/atlas-import/scenario.mjs').pin,pngBefore=readPinned(identity,H,APP+'assets/atlas.png').pin;
  const environment=importChildEnvironment(identity),command={exe:process.execPath,args:['--input-type=module'],cwd:H,shell:false,windowsHide:true,
    timeoutMs:120000,maxBufferBytes:16777216,encoding:null,stdio:['pipe','pipe','pipe']};
  const nodeOwner=fs.realpathSync(path.dirname(process.execPath)),node={ownerRoot:nodeOwner,...readPinned(identity,nodeOwner,path.basename(process.execPath)).pin};
  const stdin=Buffer.from(IMPORT_PLANNER_STDIN),started=new Date().toISOString();
  const run=spawnSync(command.exe,command.args,{cwd:H,env:environment.environment,input:stdin,shell:false,windowsHide:true,timeout:120000,maxBuffer:16777216,encoding:null,stdio:['pipe','pipe','pipe']});
  const finished=new Date().toISOString(),channel=bytes=>({bytes:bytes.length,sha256:HASH(bytes),base64:bytes.toString('base64')});
  const execution={command,node,stdin:channel(stdin),...environment,started,finished,exitCode:run.status,signal:run.signal,
    timedOut:run.error?.code==='ETIMEDOUT',error:run.error?{code:run.error.code??null,message:run.error.message}:null,
    stdout:channel(run.stdout??Buffer.alloc(0)),stderr:channel(run.stderr??Buffer.alloc(0))};
  // Retain genuine failures as process-domain evidence before interpreting stdout or writing a successful receipt.
  fs.writeFileSync(path.join(D,'node-parser-attempt.json'),source.serialize(execution),{flag:'wx'});
  requireThat(run.status===0&&!run.error&&run.signal===null&&execution.stderr.bytes===0,'Actual fixed planner child failed; original process channels retained');
  const child=strictJSON(run.stdout);requireThat(child.platform===process.platform,'Actual child platform');
  equal(Object.keys(child.environment).sort(),Object.keys(environment.environment).sort(),'Complete actual child environment key set');
  for(const key of Object.keys(environment.environment))equal(child.environment[key],environment.environment[key],'Complete actual child environment value');
  equal(decode(run.stdout),source.serialize(child),'Canonical one-record child stdout');
  equal(child.actualInput,source.fixedInput(),'Complete actual child public-call input');
  equal(child.result,{ok:true,value:source.EXPECTED_PLAN,diagnostics:[]},'Complete actual child public-call result');
  equal(child.freezeObservations,{plan:true,ownedContainers:true},'Actual live owned/frozen plan');
  equal(['input.json','metadata.json'].map(key=>readPinned(identity,inputRoot,key).pin),before,'Original inputs unchanged across child');
  equal(readPinned(identity,H,'tools/atlas-import/scenario.mjs').pin,scenarioBefore,'Literal recipe source unchanged');
  equal(readPinned(identity,H,APP+'assets/atlas.png').pin,pngBefore,'Original page unchanged');
  equal(decode(readPinned(identity,inputRoot,'plan.json').raw),source.serialize(child.result.value),'Actual saved plan equals actual child result');
  fs.writeFileSync(path.join(inputRoot,'node-parser-receipt.json'),source.serialize({schemaVersion:1,kind:'ATLAS_IMPORT_NODE_PARSER_RECEIPT_V1',execution,child}),{flag:'wx'});
  for(const row of source.ORACLE.frames){const raw=Buffer.from(source.literalOracleBytes(row.id));
    equal({bytes:raw.length,sha256:HASH(raw)},{bytes:row.bytes,sha256:row.sha256},'Fixed independent literal pixel identity');
    fs.writeFileSync(path.join(oracleRoot,row.path),raw,{flag:'wx'});requireThat(fs.readFileSync(path.join(oracleRoot,row.path)).equals(raw),'Complete saved independent oracle');
    let opaque=0,transparent=0;for(let i=0;i<1536;i+=4){const pixel=raw.subarray(i,i+4);if(pixel[3]===255)opaque++;else{requireThat(pixel.every(n=>n===0),'Only literal opaque or zero RGBA');transparent++;}}
    requireThat(opaque===6&&transparent===378,'Complete independent margin domain');
  }
  fs.writeFileSync(path.join(oracleRoot,'oracle.json'),source.serialize(source.ORACLE),{flag:'wx'});
  const pin=(owner,key)=>({path:path.join(owner,key),...Object.fromEntries(Object.entries(readPinned(identity,owner,key).pin).filter(([name])=>name!=='path'))});
  return {importInput:{ownerRoot:inputRoot,input:pin(inputRoot,'input.json'),metadata:pin(inputRoot,'metadata.json'),receipt:pin(inputRoot,'node-parser-receipt.json'),plan:pin(inputRoot,'plan.json')},
    oracle:{ownerRoot:oracleRoot,source:pin(H,'tools/atlas-import/scenario.mjs'),manifest:pin(oracleRoot,'oracle.json'),
      frameA:pin(oracleRoot,'expected-frame-a.rgba'),frameB:pin(oracleRoot,'expected-frame-b.rgba')}};
}
