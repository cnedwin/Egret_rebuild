// First-party Apache-2.0 public build/freeze preparation. No product evaluation or GPU work.
// Reuses the fixed tools/build.mjs route and the collector's closed graph/identity reader.
import { opendir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL_IDS, ENTRIES, REGISTRY, LIMITS, inputByteLimit, sha256, samePath, inside, directoryChain,
  readIdentity, requirePolicy, fault, collectPublicGraph, literalImports } from './textured-webgpu/native-files.mjs';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
requirePolicy(args.length===2&&args[0]==='--output'&&path.isAbsolute(args[1]),'FREEZE_EXPLICIT_OUTPUT');
const OUTPUT=path.resolve(args[1]);
requirePolicy(!inside(repository,OUTPUT)&&!inside(OUTPUT,repository),'FREEZE_EXTERNAL_OUTPUT');
const RECEIPT='build-receipt.json';
const TEMPLATE='tools/textured-webgpu/collection-inputs.json',RECIPES='tools/textured-webgpu/control-selectors.json';
const SELF='tools/freeze-textured-webgpu-inputs.mjs';
const HARNESS=['examples/textured-webgpu/main.mjs','examples/textured-webgpu/fixtures.mjs','examples/textured-webgpu/index.html',
  'tools/textured-webgpu/fixtures.mjs','tools/textured-webgpu/oracle.mjs','tools/textured-webgpu/native-window.mjs',
  'tools/textured-webgpu/calibration-manifest.json','tools/textured-webgpu/held-out-manifest.json','tools/textured-webgpu/sensitivity-plan.json'];
const OWN=['tools/verify-textured-webgpu.mjs','tools/textured-webgpu/collector.mjs','tools/textured-webgpu/native-files.mjs'];
const CHECKS=[
  [['N02-interpolation','interpolated-rgba']],
  [['N03-forward','blue-over-red'],['N04-empty','last-green-empty'],['N04-singular','last-green-singular']],
  [['N01-a128','alpha-128']],[['N01-a128','alpha-128']],
  [['N02-interpolation','interpolated-rgba'],['N06-diamond','clip-inside-left'],['N09-complement','visible-complement-transport']],
  [['N06-diamond','clip-outside-top']],[['N01-a128','alpha-128']],[['N05-palette','crop-green']],[['N05-palette','crop-green']],
  [['N07-diamond','TEXTURED_NATIVE_METADATA_INVALID']],[['N10-replay02','N10-reset-after','reset-after']],[['N06-diamond','clip-inside-top']]];
const PACKAGES=['contracts','runtime','engine','project'];
const REFERENCES=['./packages/contracts','./packages/runtime','./packages/engine','./packages/engine/tsconfig.rendering.json',
  './packages/engine/tsconfig.web.json','./packages/project'];
const ROOT_INPUTS=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json','source-origin.json',
  'tools/build.mjs','tools/generate-project-format.mjs',SELF,TEMPLATE,RECIPES,...HARNESS,...OWN];
const BUILD=Object.freeze({timeoutMs:120000,maxBufferBytes:33554432,inputBytes:536870912});
const INSTALLED=Object.freeze({entries:4096,fileBytes:134217728,totalBytes:536870912});
const LOADER_ENV=new Set(['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_REPL_EXTERNAL_MODULE',
  'NODE_TEST_CONTEXT','NODE_TEST_WORKER_ID','DOTNET_STARTUP_HOOKS']);
const sortRows=rows=>rows.sort((a,b)=>a.relative<b.relative?-1:a.relative>b.relative?1:0);
const stable=(before,after)=>JSON.stringify(before)===JSON.stringify(after);
const relativeOf=item=>{requirePolicy(inside(repository,item.path),'FREEZE_INPUT_CONTAINMENT');
  return path.relative(repository,item.path).split(path.sep).join('/');};
const rowOf=item=>({relative:relativeOf(item),bytes:item.bytes,sha256:item.sha256});
async function exact(relative,maxBytes=inputByteLimit(relative)){const requested=path.join(repository,relative),item=await readIdentity(requested,maxBytes);
  requirePolicy(samePath(requested,item.path),'FREEZE_EXACT_PATH',{relative});return item;}
async function json(relative){return JSON.parse((await exact(relative)).body.toString('utf8'));}
async function save(relative,value){const body=Buffer.from(JSON.stringify(value)+'\n');
  requirePolicy(body.length<=LIMITS.moduleBytes,'FREEZE_JSON_BYTES',{relative,bytes:body.length});
  await writeFile(path.join(OUTPUT,relative),body,{flag:'wx'});const item=await readIdentity(path.join(OUTPUT,relative));return {relative,bytes:item.bytes,sha256:item.sha256};}

// Enumerate every .ts/.json compiler input in the four fixed referenced packages, including schemas/configs.
// Installed dependencies, emissions and incremental build state are separately excluded from this source inventory.
async function packageInputs(){const selected=[];let count=0,total=0;
  async function visit(directory){await directoryChain(directory);for await(const entry of await opendir(directory)){
    requirePolicy(++count<=4096&&!entry.isSymbolicLink(),'FREEZE_SOURCE_DIRECTORY');
    if(['node_modules','dist'].includes(entry.name)||entry.name.endsWith('.tsbuildinfo'))continue;
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await visit(file);else{requirePolicy(entry.isFile(),'FREEZE_SOURCE_KIND');
      if(!/\.(?:ts|json)$/.test(entry.name))continue;
      const item=await readIdentity(file);requirePolicy(samePath(item.path,file),'FREEZE_SOURCE_ALIAS');
      total+=item.bytes;requirePolicy(total<=BUILD.inputBytes,'FREEZE_SOURCE_BYTES');selected.push(rowOf(item));}}}
  for(const name of PACKAGES)await visit(path.join(repository,'packages',name));return sortRows(selected);}
// TypeScript 7 delegates to its selected native platform package. Bind those actual bytes
// and declarations separately; installed-file limits never expand browser module limits.
async function compilerInputs(){const selected=[];let count=0,total=0;
  const metadata=await readIdentity(path.join(repository,'node_modules/typescript/package.json'));
  requirePolicy(inside(repository,metadata.path),'FREEZE_COMPILER_CONTAINMENT');
  const compilerRoot=path.dirname(metadata.path),manifest=JSON.parse(metadata.body.toString('utf8'));
  requirePolicy(manifest.name==='typescript'&&manifest.version==='7.0.2'&&manifest.bin?.tsc==='./bin/tsc'
    &&manifest.imports?.['#getExePath']==='./lib/getExePath.js','FREEZE_COMPILER_LAYOUT');
  const nativeName='@typescript/typescript-'+process.platform+'-'+process.arch;
  const require=createRequire(path.join(compilerRoot,'lib/getExePath.js'));
  const nativeMetadata=await readIdentity(require.resolve(nativeName+'/package.json'));
  const nativeManifest=JSON.parse(nativeMetadata.body.toString('utf8'));
  requirePolicy(inside(repository,nativeMetadata.path)&&nativeManifest.name===nativeName&&nativeManifest.version==='7.0.2'
    &&manifest.optionalDependencies?.[nativeName]==='7.0.2','FREEZE_NATIVE_COMPILER_PROFILE');
  const nativeRoot=path.dirname(nativeMetadata.path);
  await readIdentity(path.join(nativeRoot,'lib',process.platform==='win32'?'tsc.exe':'tsc'),INSTALLED.fileBytes);
  async function visit(directory){await directoryChain(directory);for await(const entry of await opendir(directory)){
    requirePolicy(++count<=INSTALLED.entries&&!entry.isSymbolicLink(),'FREEZE_COMPILER_ENTRY_COUNT');
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await visit(file);else{requirePolicy(entry.isFile(),'FREEZE_COMPILER_FILE_KIND');
      const item=await readIdentity(file,INSTALLED.fileBytes);requirePolicy(samePath(file,item.path)&&inside(repository,item.path),'FREEZE_COMPILER_ALIAS');
      total+=item.bytes;requirePolicy(total<=INSTALLED.totalBytes,'FREEZE_COMPILER_BYTE_COUNT');selected.push(rowOf(item));}}}
  await visit(compilerRoot);await visit(nativeRoot);return sortRows(selected);}
async function nodeIdentity(){const item=await readIdentity(process.execPath,INSTALLED.fileBytes);
  return {bytes:item.bytes,sha256:item.sha256};}
async function buildInputs(){const selected=new Map();
  for(const row of await packageInputs())selected.set(row.relative,row);
  for(const relative of ROOT_INPUTS){const row=rowOf(await exact(relative));selected.set(row.relative,row);}
  for(const row of await compilerInputs())selected.set(row.relative,row);
  const rows=sortRows([...selected.values()]);requirePolicy(rows.length<=4096&&rows.reduce((sum,row)=>sum+row.bytes,0)<=BUILD.inputBytes,'FREEZE_BUILD_INPUT_BUDGET');
  return rows;}
async function emittedInventory(){const rows=[];let count=0,total=0;
  async function visit(directory){try{const info=await lstat(directory);requirePolicy(info.isDirectory()&&!info.isSymbolicLink(),'FREEZE_EMITTED_DIRECTORY');}
    catch(error){if(error?.code==='ENOENT')return;throw error;}
    await directoryChain(directory);for await(const entry of await opendir(directory)){
      requirePolicy(++count<=4096&&!entry.isSymbolicLink(),'FREEZE_EMITTED_COUNT_OR_LINK');const file=path.join(directory,entry.name);
      if(entry.isDirectory())await visit(file);else{requirePolicy(entry.isFile(),'FREEZE_EMITTED_KIND');const item=await readIdentity(file);
        requirePolicy(samePath(item.path,file),'FREEZE_EMITTED_ALIAS');total+=item.bytes;
        requirePolicy(total<=BUILD.inputBytes,'FREEZE_EMITTED_BYTES');rows.push(rowOf(item));}}}
  for(const name of PACKAGES)await visit(path.join(repository,'packages',name,'dist'));return sortRows(rows);}
async function profile(){requirePolicy(process.argv.length===4&&process.execArgv.length===0&&process.version==='v26.7.0','FREEZE_NODE_PROFILE');
  for(const [key,value]of Object.entries(process.env))requirePolicy(!LOADER_ENV.has(key.toUpperCase())||!value,'FREEZE_LOADER_ENV',{key});
  await directoryChain(repository);
  const root=await json('package.json'),compiler=JSON.parse((await readIdentity(path.join(repository,'node_modules/typescript/package.json'))).body.toString('utf8'));
  requirePolicy(root.packageManager==='pnpm@11.25.0'&&root.engines?.node==='26.7.0'&&root.devDependencies?.typescript==='7.0.2'
    &&compiler.name==='typescript'&&compiler.version==='7.0.2','FREEZE_BUILD_PROFILE');
  const config=await json('tsconfig.json');requirePolicy(JSON.stringify(config.references?.map(row=>row.path))===JSON.stringify(REFERENCES),'FREEZE_FIXED_BUILD_REFERENCES');
  const template=await json(TEMPLATE),recipes=await json(RECIPES);
  requirePolicy(template.schemaVersion===1&&template.ready===false&&JSON.stringify(template.entries)===JSON.stringify(ENTRIES)
    &&Array.isArray(template.files)&&template.files.length===0&&template.buildReceipt===null&&template.shader===null,'FREEZE_TRACKED_TEMPLATE');
  requirePolicy(recipes.schemaVersion===1&&recipes.ready===false&&Array.isArray(recipes.controls)
    &&JSON.stringify(recipes.controls.map(row=>row.id))===JSON.stringify(CONTROL_IDS),'FREEZE_TRACKED_RECIPES');
  for(let i=0;i<CONTROL_IDS.length;i++)requirePolicy(JSON.stringify(recipes.controls[i].checks)===JSON.stringify(CHECKS[i]),'FREEZE_ASSIGNED_CHECKS');
  return recipes;}

async function main(){const recipes=await profile();
  // Never overwrite a previous successful or failed attempt, and never write ready:true into tracked templates.
  await directoryChain(path.dirname(OUTPUT));const output=OUTPUT;await mkdir(output);await directoryChain(output);
  const sourceBefore=await buildInputs(),emittedBefore=await emittedInventory(),nodeBefore=await nodeIdentity(),startedAtUTC=new Date().toISOString(),began=Date.now();
  // Preserve necessary OS variables only after the loader-affecting profile has been admitted.
  const admittedEnvironment={...process.env};
  for(const key of Object.keys(admittedEnvironment))if(LOADER_ENV.has(key.toUpperCase()))delete admittedEnvironment[key];
  const result=spawnSync(process.execPath,['tools/build.mjs'],{cwd:repository,env:admittedEnvironment,shell:false,windowsHide:true,timeout:BUILD.timeoutMs,maxBuffer:BUILD.maxBufferBytes,stdio:'pipe'});
  const stdout=Buffer.isBuffer(result.stdout)?result.stdout:Buffer.alloc(0),stderr=Buffer.isBuffer(result.stderr)?result.stderr:Buffer.alloc(0);
  await writeFile(path.join(output,'build.stdout.bin'),stdout,{flag:'wx'});await writeFile(path.join(output,'build.stderr.bin'),stderr,{flag:'wx'});
  let sourceAfter=null,emittedAfter=null,nodeAfter=null;const observationFailures=[];
  try{sourceAfter=await buildInputs();}catch(error){observationFailures.push({phase:'source-after',...fault(error)});}
  try{emittedAfter=await emittedInventory();}catch(error){observationFailures.push({phase:'emitted-after',...fault(error)});}
  try{nodeAfter=await nodeIdentity();}catch(error){observationFailures.push({phase:'node-after',...fault(error)});}
  const successfulExecution=result.status===0&&result.signal===null&&!result.error&&sourceAfter!==null&&emittedAfter!==null
    &&stable(sourceBefore,sourceAfter)&&stable(nodeBefore,nodeAfter)&&observationFailures.length===0;
  const receipt={schemaVersion:'textured-public-build/1',successfulExecution,startedAtUTC,finishedAtUTC:new Date().toISOString(),elapsedMs:Date.now()-began,
    command:['node','tools/build.mjs'],cwdRelative:'.',runtime:{node:process.version,compiler:'7.0.2',packageManager:'pnpm@11.25.0',nodeExecutable:nodeAfter},bounds:BUILD,installedBounds:INSTALLED,
    exitCode:result.status,signal:result.signal,error:result.error?{...fault(result.error),code:result.error.code??null}:null,
    rawCaptureComplete:!result.error,sourceStable:sourceAfter!==null&&stable(sourceBefore,sourceAfter),sourceBefore,sourceAfter,emittedBefore,emittedAfter,observationFailures,
    stdout:{name:'build.stdout.bin',bytes:stdout.length,sha256:sha256(stdout)},stderr:{name:'build.stderr.bin',bytes:stderr.length,sha256:sha256(stderr)},
    scope:'Actual fixed bounded build only; no tests, native execution or OS descendant-retirement claim'};
  const buildReceipt=await save(RECEIPT,receipt);requirePolicy(successfulExecution,'FREEZE_BUILD_FAILED',{receipt:RECEIPT});
  const retained=new Map();let total=0;
  const retain=item=>{const row=rowOf(item),prior=retained.get(row.relative);
    requirePolicy(!prior||prior.bytes===row.bytes&&prior.sha256===row.sha256,'FREEZE_CHANGED_DURING_GRAPH');
    if(!prior){total+=row.bytes;requirePolicy(total<=BUILD.inputBytes,'FREEZE_GRAPH_INPUT_BYTES');retained.set(row.relative,row);}};
  const graph=await collectPublicGraph(repository,retain,'m15-textured');
  for(const relative of [...HARNESS,...OWN,'pnpm-lock.yaml','source-origin.json',SELF,TEMPLATE,RECIPES])retain(await exact(relative));
  const controls=recipes.controls.map((recipe,index)=>{const {id,checks,target,before,after}=recipe;
    requirePolicy(id===CONTROL_IDS[index]&&typeof target==='string'&&target.startsWith('packages/engine/dist/')&&target!==REGISTRY
      &&graph.modules.has(target)&&typeof before==='string'&&before.length>0&&typeof after==='string'&&after.length>0&&before!==after,'FREEZE_ONE_FILE_RECIPE');
    const original=graph.modules.get(target),text=original.body.toString('utf8');requirePolicy(text.split(before).length===2,'FREEZE_RECIPE_OCCURRENCE',{id});
    const changed=text.replace(before,after);requirePolicy(changed.split(after).length===2&&changed.replace(after,before)===text,'FREEZE_RECIPE_INVERSE',{id});
    requirePolicy(JSON.stringify(literalImports(changed))===JSON.stringify(literalImports(text)),'FREEZE_RECIPE_IMPORT_GRAPH',{id});
    return {id,checks,target,before,after,originalSHA256:original.sha256,changedSHA256:sha256(Buffer.from(changed))};});
  const sourceRelative='packages/engine/web/webgpuTexturedPass.ts',emissionRelative='packages/engine/dist/web/webgpuTexturedPass.js';
  const source=(await exact(sourceRelative)).body.toString('utf8'),marker='const SHADER = '+String.fromCharCode(96);
  requirePolicy(source.split(marker).length===2,'FREEZE_SHADER_SOURCE');const tail=source.slice(source.indexOf(marker)+marker.length),end=tail.indexOf(String.fromCharCode(96));
  requirePolicy(end>0,'FREEZE_SHADER_SOURCE');const literal=tail.slice(0,end);
  requirePolicy(!literal.includes('${')&&!literal.includes('\\')&&source.split(literal).length===2&&Buffer.byteLength(literal)<=LIMITS.moduleBytes
    &&graph.modules.has(emissionRelative)&&graph.modules.get(emissionRelative).body.toString('utf8').split(literal).length===2,'FREEZE_SHADER_EXACT_LITERAL');
  const shader={sourceRelative,emissionRelative,literal,sha256:sha256(Buffer.from(literal))};
  requirePolicy(retained.has(sourceRelative)&&retained.size>0&&retained.size<=512,'FREEZE_FINAL_FILE_COUNT');
  requirePolicy(stable(sourceAfter,await buildInputs())&&stable(emittedAfter,await emittedInventory())&&stable(nodeAfter,await nodeIdentity()),'FREEZE_BUILD_OUTPUT_CHANGED');
  for(const expected of retained.values()){const actual=rowOf(await readIdentity(path.join(repository,expected.relative),inputByteLimit(expected.relative)));
    requirePolicy(stable(expected,actual),'FREEZE_FINAL_READBACK',{relative:expected.relative});}
  const receiptRead=await readIdentity(path.join(OUTPUT,RECEIPT));const currentReceipt={relative:RECEIPT,bytes:receiptRead.bytes,sha256:receiptRead.sha256};requirePolicy(stable(buildReceipt,currentReceipt),'FREEZE_RECEIPT_CHANGED');
  await save('control-selectors.json',{schemaVersion:1,ready:true,controls,nativeExecuted:false});
  // Publish the ready collection manifest last. Its own hash is never recursively included in files.
  await save('collection-inputs.json',{schemaVersion:1,ready:true,entries:ENTRIES,files:sortRows([...retained.values()]),buildReceipt,shader,
    nativeExecuted:false,sourceBuildAttestedHere:false,issuer:SELF});
  process.stdout.write('Actual build succeeded; native collection inputs are ready in '+OUTPUT+'/. Native has not run.\n');
}
try{await main();}catch(error){process.stderr.write(JSON.stringify(fault(error))+'\n');process.exitCode=1;}
