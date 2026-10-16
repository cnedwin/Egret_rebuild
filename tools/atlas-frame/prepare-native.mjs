// SPDX-License-Identifier: Apache-2.0
// Finite disposable closure preparation. Never mutates the selected development repository.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { absolute, authenticateIdentity, inventoryTree, readPinned, HASH, decode, requireThat, equal, PUBLIC_TEXT, APP,
  assignedMutation, BUILD_PACKAGES, WORKSPACE_ALIASES, validateBuildPackage } from './boundary.mjs';
import { PROFILES, KINDS, FIXTURE_ROUTE } from './scenario.mjs';
const ROOT_FILES=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json','AGENTS.md','LICENSE',
  'tools/build.mjs','tools/generate-project-format.mjs','tools/lib/file-identity.mjs','tests/helpers.mjs',...PUBLIC_TEXT,
  'tools/atlas-frame/author-assets.mjs','tools/atlas-frame/oracle.mjs','tests/atlas-frame-oracle-unit.test.mjs',
  APP+'assets/atlas.png',APP+'assets/provenance.json'];
export async function prepareNative({repository,taskRoot,destination,playwrightRoot,profile,kind}){
  requireThat([repository,taskRoot,destination,playwrightRoot].every(absolute)&&PROFILES.includes(profile)&&KINDS.includes(kind),'Closed absolute preparation arguments required');
  const identity=await authenticateIdentity(repository);repository=fs.realpathSync(repository);taskRoot=fs.realpathSync(taskRoot);
  identity.ownerRelativePath(taskRoot,destination);
  const outside=target=>{requireThat(!identity.samePhysicalPath(repository,target),'External private target required');
    try{identity.ownerRelativePath(repository,target);throw new Error('Private target belongs to product');}catch(cause){if(!(cause instanceof RangeError))throw cause;}};
  outside(taskRoot);outside(destination);requireThat(!fs.existsSync(destination),'Fresh preparation directory required');
  requireThat(process.platform==='win32'&&process.arch==='x64','Only reviewed Windows x64 build toolchain admitted');
  fs.mkdirSync(destination);
  const stamp=new Date().toISOString(),roots={},builds=[];
  function copyFile(owner,key,targetRoot){const input=readPinned(identity,owner,key),target=path.join(targetRoot,key);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,input.raw,{flag:'wx'});}
  function copyTree(owner,targetRoot){for(const pin of inventoryTree(identity,owner))copyFile(owner,pin.path,targetRoot);}
  function clone(targetRoot){
    fs.mkdirSync(targetRoot);
    for(const relative of ROOT_FILES)copyFile(repository,relative,targetRoot);
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
    for(const relative of ROOT_FILES)result.push(readPinned(identity,owner,relative).pin);
    for(const name of ['contracts','runtime','engine','project']){
      const base='packages/'+name;
      for(const entry of fs.readdirSync(path.join(owner,base)))if(entry==='package.json'||/^tsconfig(?:\.[a-z]+)?\.json$/.test(entry))result.push(readPinned(identity,owner,base+'/'+entry).pin);
      for(const dir of ['src','web','rendering','schema'])if(fs.existsSync(path.join(owner,base,dir)))result.push(...inventoryTree(identity,owner,base+'/'+dir));
    }return result.sort((a,b)=>a.path.localeCompare(b.path));
  };
  for(const role of kind==='ordinary'?['healthy']:['healthy','assigned']){
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
  const fixture=readPinned(identity,roots.healthy,'tools/atlas-frame/native-fixture.mjs').pin;
  const oracle=readPinned(identity,roots.healthy,'tools/atlas-frame/oracle.mjs').pin;
  const config={schemaVersion:1,repositoryRoot:roots.healthy,taskRoot,snapshot:path.join(destination,'snapshot.json'),
    output:path.join(destination,'native-output'),playwrightRoot,nativeScenario:{profile,kind},
    closures:Object.entries(roots).map(([role,repositoryRoot])=>({role,repositoryRoot})),
    fixture:{path:path.join(roots.healthy,fixture.path),route:FIXTURE_ROUTE,exportName:'runAtlasFrameNativeFixture',bytes:fixture.bytes,sha256:fixture.sha256},
    oracle:{path:path.join(roots.healthy,oracle.path),bytes:oracle.bytes,sha256:oracle.sha256}};
  const configPath=path.join(destination,'config.json'),raw=Buffer.from(JSON.stringify(config,null,2)+'\n');
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
