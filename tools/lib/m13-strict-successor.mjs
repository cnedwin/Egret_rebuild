// SPDX-License-Identifier: Apache-2.0
// One finite successor for twelve existing strict consumers. No product evaluation.
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fingerprintFile,ownerRelativePath,samePhysicalPath} from './file-identity.mjs';
const DATA={path:'tools/m13-strict-successors.json',bytes:449376,sha256:'c7843db0289d7535c0196379631e5da9ba1b6a1edef7ac996a3793900f7139c7'};
const M15_DATA={"path":"tools/m15-strict-successors.json","bytes":467926,"sha256":"f130ab6234fc6fa3f27424c4152f68f243ff3c3921b93324ba92d5fd14a49724"};
const M15_SELECTION=['packages/contracts/dist/ResourceManifest.d.ts','packages/engine/dist/manifestResourceTypes.d.ts'];
const IDS=['atlas-frame','atlas-import','bitmap-resource-slot','bitmap-binding-ticket','linear-layout','bitmap-button',
 'display-anchor-offsets','display-container-add-child-at','display-container-child-index','display-container-remove-children',
 'nine-slice-bitmap','sequence-playback'];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const fail=message=>{throw Error('M1.3 strict successor: '+message);};
const text=raw=>typeof raw==='string'?raw:new TextDecoder('utf-8',{fatal:true}).decode(raw);
function tuples(raw){
 const rows=[];
 for(const line of raw.replaceAll('\r\n','\n').split('\n')){
  if(line==='')continue;
  const match=/^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
  if(match)rows.push([match[1].replaceAll('\\','/'),+match[2],+match[3],+match[4],match[5]]);
  else if(/^ {2,}\S/.test(line)&&rows.length)rows.at(-1)[4]+='\n'+line;
  else fail('unconsumed saved compiler observation');
 }
 return rows;
}

// Only the two explicit WebGL2 exports may select this reviewed package revision.
const m14EnginePackageBase = {"path":"packages/engine/package.json","bytes":1567,"sha256":"e01d48a51c0845783afeec93ffcc7674c7980797cd6a9c58cc74ec3f13d2e0c5"};
const m14EnginePackageCurrent = {"path":"packages/engine/package.json","bytes":1799,"sha256":"c106c84b479f88ac1570418a21672b6148b1bdd0b870631198c359d467f2f0c7"};
function m14EnginePackagePin(owner, expected) {
 if (!equal(expected, m14EnginePackageBase)) return expected;
 const actual = fingerprintFile(owner, expected.path);
 if (!equal(actual, m14EnginePackageCurrent)) return expected;
 const raw = readFileSync(path.join(owner, expected.path));
 if (raw.length !== actual.bytes || hash(raw) !== actual.sha256) throw Error('M1.4 engine package changed during read');
 const value = JSON.parse(raw);
 delete value.exports['./webgl2']; delete value.exports['./webgl2/scene3d'];
 const predecessor = Buffer.from(JSON.stringify(value, null, 2) + '\n');
 if (predecessor.length !== expected.bytes || hash(predecessor) !== expected.sha256) throw Error('M1.4 engine package predecessor differs');
 return actual;
}

// M12-NINE-SLICE-SOURCE-BEGIN
// This one source identity leaves the retained declaration and compiler observations unchanged.
const m12NineSliceHostSource = {"base":{"path":"packages/engine/web/WebGPUHost.ts","bytes":189815,"sha256":"f84a1de242e8b3efefc1bb4ccb344cb02b659d355b512c071cfccf7c1943bf10"},"current":{"path":"packages/engine/web/WebGPUHost.ts","bytes":190117,"sha256":"f3d324c1357ecce0f2f4067d017d2ae88886c5e26fe7458df0b5d16e59fdfb93"}};
function m12NineSliceHostPin(root,selected,id,row){
 if(selected!==M15_DATA||id!=='nine-slice-bitmap'||!equal(row,m12NineSliceHostSource.base))return row;
 return equal(fingerprintFile(root,row.path),m12NineSliceHostSource.current)?m12NineSliceHostSource.current:row;
}
// M12-NINE-SLICE-SOURCE-END

// M12-CAPTURE-SOURCE-BEGIN
// All twelve existing consumers retain their declarations and compiler observations.
const m12CaptureSource = {"base":{"path":"packages/runtime/src/texturedFrameCapture.ts","bytes":14886,"sha256":"47f633f1f8507c61c3fea359ae390e26ee584f1adbffd522b9ef7ebe86e9bf6d"},"current":{"path":"packages/runtime/src/texturedFrameCapture.ts","bytes":15606,"sha256":"b245c0df9d3a05455a56e69e96352d6f98193e6c8bc3b7f644c3aeec70329734"}};
function m12CaptureSourcePin(root,selected,row){
 if(selected!==M15_DATA||!equal(row,m12CaptureSource.base))return row;
 return equal(fingerprintFile(root,row.path),m12CaptureSource.current)?m12CaptureSource.current:row;
}
// M12-CAPTURE-SOURCE-END

// M33-POINTER-INPUT-CURRENT-BEGIN
// The approved optional input entries and private close port preserve every
// recorded consumer diagnostic and complete compiler closure. Historical rows
// stay immutable; only an exact reviewed owner/path/base/current pair can map.
const m33PointerInputCurrent = [
 {base:{path:'packages/runtime/package.json',bytes:327,sha256:'b9294c479d38614dd8866adcd8775f5d6f43c787d9b08c8ef54371e426cb5032'},current:{path:'packages/runtime/package.json',bytes:471,sha256:'97b2d4678df4fd137b681a54511ce625935accfc3014da4800902f4a241c8db1'},owners:IDS.slice(0,10)},
 {base:{path:'packages/engine/package.json',bytes:2167,sha256:'be2a5a1e13136e99111ebc0fdfa657e4067fbba79647eeb93431395210516143'},current:{path:'packages/engine/package.json',bytes:2494,sha256:'65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951'},owners:IDS.slice(0,10)},
 {base:{path:'packages/engine/src/mouseInput.ts',bytes:21978,sha256:'b8ada0f5e3a2a5f22e53e8dec494d612818404463dfe112c737504ee5e840fe0'},current:{path:'packages/engine/src/mouseInput.ts',bytes:22563,sha256:'83ca7db6c00c65b88c093b787c82093984c98bfa1b6053643527f8adb7e7e5bd'},owners:['linear-layout','bitmap-button']},
 {base:{path:'packages/engine/dist/mouseInput.d.ts',bytes:4458,sha256:'453cab6df05b0baf3e42d11f158ec13706e5c963231930f7f43b80b8cf46e44d'},current:{path:'packages/engine/dist/mouseInput.d.ts',bytes:4505,sha256:'04c38e9fec56d089f56a4fafb2bd02c47313856dd83ce3bc3ed139ab18706b85'},owners:['linear-layout','bitmap-button']},
];
function m33PointerInputPin(root,selected,id,row){
 if(selected!==M15_DATA)return row;
 const revision=m33PointerInputCurrent.find(pair=>pair.owners.includes(id)&&equal(pair.base,row));
 if(!revision)return row;
 return equal(fingerprintFile(root,row.path),revision.current)?revision.current:row;
}
// M33-POINTER-INPUT-CURRENT-END

// M2.1 adds only the selected resource plan metadata, key functions and pngjs dev pin.
// Historical inputs, compiler closures and diagnostic observations remain intact.
const m21ResourceCurrent = [
 {"base":{"path":"package.json","bytes":1108,"sha256":"16a969b9a50653b1733893c59ee4cd1d29845208c11bd182036bc585372834d0"},"current":{"path":"package.json","bytes":1130,"sha256":"716cda606f58987f784aee2a64e46cf0c2e0130e84157d2a869879b4c3ae7c40"}},
 {"base":{"path":"pnpm-lock.yaml","bytes":9017,"sha256":"79383095fd4bb2bb4682a12f9651d9a876a01fc6dc1326d09bc0ad587db23084"},"current":{"path":"pnpm-lock.yaml","bytes":9271,"sha256":"061742afdc492e6e1721798dcc1b1539f8e4fd9d0274fa7c5fd9091917e57338"}},
 {
  "base": {
   "path": "packages/contracts/dist/ResourceManifest.d.ts",
   "bytes": 2165,
   "sha256": "9deb851da529346c2ddeeb33a6cdc052941f08528d38e1c48ccc0569159d17b4"
  },
  "current": {
   "path": "packages/contracts/dist/ResourceManifest.d.ts",
   "bytes": 2890,
   "sha256": "8e8ab318a772ffc6be3a04cead885f5f3f625de0d6b87088a2a9b32b4031e8d4"
  }
 },
 {
  "base": {
   "path": "packages/contracts/dist/resources/index.d.ts",
   "bytes": 503,
   "sha256": "73963d013dcb1cc360d77841e21b13116c01286fa2bfe221eb9879bcca5de737"
  },
  "current": {
   "path": "packages/contracts/dist/resources/index.d.ts",
   "bytes": 669,
   "sha256": "7d150a28016365de169fe8f61a74c8a1d6ab8f11ebfb0fe53a2bb653eb647adc"
  }
 },
 {
  "base": {
   "path": "packages/contracts/dist/resources/manifestAdmission.d.ts",
   "bytes": 935,
   "sha256": "c770ee9adc1a2ed2c10de9a18e3adb53b17a7f765a7d2f452f6b8bd164289c31"
  },
  "current": {
   "path": "packages/contracts/dist/resources/manifestAdmission.d.ts",
   "bytes": 1259,
   "sha256": "880db4a26ec673f0704dfe68378d8ecead13fe08d09bf11307879df4794e9e57"
  }
 },
 {
  "base": {
   "path": "packages/contracts/src/ResourceManifest.ts",
   "bytes": 2059,
   "sha256": "ff2fa4e6e494507b5d58528b8dabdd033eb5369f577d309fcce566a690e15585"
  },
  "current": {
   "path": "packages/contracts/src/ResourceManifest.ts",
   "bytes": 2762,
   "sha256": "a916c212cf9101e69f36f3781e08298928e0761c5cfa9d767302afcba3d070d3"
  }
 },
 {
  "base": {
   "path": "packages/contracts/src/resources/index.ts",
   "bytes": 507,
   "sha256": "a2df37b06a9c313f2c1bb44464f4c96e1c4ef7c7bde1ae234668bc252b561d3a"
  },
  "current": {
   "path": "packages/contracts/src/resources/index.ts",
   "bytes": 673,
   "sha256": "1da43be85f42ab602c6809cbc7e047de351e3c2b6da15b148ab1109d88cd6e0a"
  }
 },
 {
  "base": {
   "path": "packages/contracts/src/resources/manifestAdmission.ts",
   "bytes": 15728,
   "sha256": "14df641417569f885e8658561da45dc6c5508380ab2c84f37f22b2ea734c1860"
  },
  "current": {
   "path": "packages/contracts/src/resources/manifestAdmission.ts",
   "bytes": 18245,
   "sha256": "432b0ae0ff4e493010a4abd829398aea44d2cb23ba3d18b8507b045fb942d6be"
  }
 }
];
function m21ResourcePin(root,selected,id,row){
 if(selected!==M15_DATA||!IDS.includes(id))return row;
 const revision=m21ResourceCurrent.find(pair=>equal(pair.base,row));
 if(!revision)return row;
 return equal(fingerprintFile(root,row.path),revision.current)?revision.current:row;
}

/** Old inventories remain immutable; only a complete recorded group selects new rows. */
export function selectM13StrictSuccessor(root,id,inventory){
 if(!IDS.includes(id))fail('unknown owner');
 const helperPin=fingerprintFile(root,'tools/lib/m13-strict-successor.mjs');
 const selected=M15_SELECTION.some(file=>existsSync(path.join(root,file)))?M15_DATA:DATA;
 if(!equal(fingerprintFile(root,DATA.path),DATA))fail('changed successor data');
 const dataPin=fingerprintFile(root,selected.path);if(!equal(dataPin,selected))fail('changed successor data');
 const data=JSON.parse(readFileSync(path.join(root,selected.path),'utf8'));
 if(selected===M15_DATA&&(!equal(data.predecessor,DATA)||!equal(data.selectionPaths,M15_SELECTION)))fail('changed M1.5 predecessor or selection');
 if(data.schemaVersion!==1||data.kind!==(selected===M15_DATA?'M15_FINITE_STRICT_DECLARATION_SUCCESSORS':'M13_FINITE_STRICT_DECLARATION_SUCCESSORS')
  ||data.status!=='ACTUAL_OBSERVATIONS_PENDING_GATE_REPLAY'||!equal(data.owners.map(row=>row.id),IDS)
  ||data.evidence.identitiesStable!==true||data.evidence.lanes!==28)fail('unobserved or incomplete successor');
 const owner=data.owners.find(row=>row.id===id);
 if(!equal(fingerprintFile(root,owner.inventory.path),owner.inventory)
  ||!equal(JSON.parse(readFileSync(path.join(root,owner.inventory.path),'utf8')),inventory))fail('historical inventory changed');
 // Partial new declarations cannot select an old route. Every selected input and
 // its source must match before any new tuple is eligible for replay.
 if(!data.selectionPaths.some(file=>existsSync(path.join(root,file))))return null;
 const pins=new Map(data.inputs.map(row=>[row.path,row]));
 const nativePins=new Map(data.nativeLibraries.map(row=>[row.path,row]));
 const pin=file=>{const row=pins.get(file);if(!row)fail('unregistered selected input '+file);return m21ResourcePin(root,selected,id,m33PointerInputPin(root,selected,id,row));};
 // Only these two predecessor inventories included their own gate bytes.
 // Their immutable historical rows remain provenance. The outer compiler
 // maintenance closure pins the current gate; this snapshot also rejects
 // changes during replay without creating a helper/gate raw-hash cycle.
 const historicalGate=[
  {path:'tools/bitmap-resource-slot-types.mjs',bytes:10489,sha256:'454abe1eb4fafc7c805e8c806d61e6f592e8c7a5345fd4a2d23316b5b500bf73'},
  {path:'tools/linear-layout-types.mjs',bytes:10385,sha256:'02a691c2e66eb7d817bcf8dea1a70f908337d9b064b36797f3fea0c2a06e73a8'},
 ].find(row=>row.path==='tools/'+id+'-types.mjs');
 if(historicalGate&&!equal(inventory.inputPins.find(row=>row.path===historicalGate.path),historicalGate))fail('historical self-gate row changed');
 const currentGate=historicalGate?fingerprintFile(root,historicalGate.path):undefined;
 let inputPins=(inventory.inputPins??[]).map(row=>row.path===historicalGate?.path?currentGate
  :owner.replacementPaths.includes(row.path)?pin(row.path):row).map(row=>m14EnginePackagePin(root,row)).map(row=>m33PointerInputPin(root,selected,id,row)).map(row=>m21ResourcePin(root,selected,id,row));
 for(const file of new Set(owner.groups.flatMap(group=>group.repositoryClosure.filter(file=>file.endsWith('.d.ts')))))
  if(!inputPins.some(row=>row.path===file))inputPins.push(pin(file));
 const wrapperOwner=realpathSync(path.join(root,'node_modules/typescript'));
 for(const row of data.compiler.wrapper)if(!equal(fingerprintFile(wrapperOwner,row.path),row))fail('compiler wrapper changed');
 const wrapper=JSON.parse(readFileSync(path.join(wrapperOwner,'package.json'),'utf8'));
 const nativeName='@typescript/typescript-'+process.platform+'-'+process.arch;
 const nativeOwner=realpathSync(path.dirname(createRequire(path.join(wrapperOwner,'package.json')).resolve(nativeName+'/package.json')));
 const native=JSON.parse(readFileSync(path.join(nativeOwner,'package.json'),'utf8'));
 if(wrapper.name!=='typescript'||wrapper.version!==data.compiler.version||native.name!==nativeName||native.version!==wrapper.version
  ||!equal(native.os,[process.platform])||!equal(native.cpu,[process.arch])||wrapper.optionalDependencies?.[nativeName]!==wrapper.version
  ||!samePhysicalPath(nativeOwner,realpathSync(path.join(root,'node_modules',nativeName))))fail('compiler owner/version changed');
 // Atlas import originally captured the entire observed Windows native package.
 // Preserve those records, but select the real platform owner in this successor.
 const observedNativePrefix='node_modules/@typescript/typescript-win32-x64/';
 const atlasNative=id==='atlas-import'?inputPins.filter(row=>row.path.startsWith(observedNativePrefix)):[];
 const observedHost=process.platform===data.compiler.observedPlatform&&process.arch===data.compiler.observedArch;
 const atlasPortable=atlasNative.flatMap(row=>{
  const file=row.path.slice(observedNativePrefix.length);
  if(['package.json','README.md','lib/tsc.exe'].includes(file))return [];
  if(!['LICENSE','NOTICE.txt','lib/lib.d.ts'].includes(file)&&!/^lib\/lib\.[a-z0-9.]+\.d\.ts$/.test(file))fail('unexpected historical native artifact');
  return [{...row,path:file}];
 });
 if(!observedHost&&atlasNative.length)inputPins=inputPins.filter(row=>!row.path.startsWith(observedNativePrefix));
 const currentNativePins=['package.json','lib/tsc'+(process.platform==='win32'?'.exe':'')].map(file=>fingerprintFile(nativeOwner,file));
 const sourcePins=owner.sourcePaths.map(pin).map(row=>m12NineSliceHostPin(root,selected,id,row)).map(row=>m12CaptureSourcePin(root,selected,row)),selectedPins=owner.inputPaths.map(pin);
 const libraryPaths=[...new Set(owner.groups.flatMap(group=>group.nativeLibraryClosure))];
 function recheck(){
  if(!equal(fingerprintFile(root,'tools/lib/m13-strict-successor.mjs'),helperPin)
   ||!equal(fingerprintFile(root,DATA.path),DATA)||!equal(fingerprintFile(root,selected.path),selected)||!equal(fingerprintFile(root,owner.inventory.path),owner.inventory))fail('successor/history changed during replay');
  for(const row of [...inputPins,...selectedPins,...sourcePins])if(!equal(fingerprintFile(root,row.path),row))fail('source/config/compiler identity changed: '+row.path);
  for(const row of data.compiler.wrapper)if(!equal(fingerprintFile(wrapperOwner,row.path),row))fail('compiler wrapper changed during replay');
  for(const row of [...currentNativePins,...atlasPortable])if(!equal(fingerprintFile(nativeOwner,row.path),row))fail('selected native artifact changed');
  if(observedHost)
   for(const row of data.compiler.native)if(!equal(fingerprintFile(nativeOwner,row.path),row))fail('observed native compiler changed');
  for(const file of libraryPaths)if(!equal(fingerprintFile(nativeOwner,file),nativePins.get(file)))fail('native library changed: '+file);
  for(const name of ['contracts','runtime','engine',...(owner.inputPaths.some(file=>file.startsWith('packages/project/'))?['project']:[])])
   if(!samePhysicalPath(realpathSync(path.join(root,'node_modules/@egret',name)),realpathSync(path.join(root,'packages',name))))fail('foreign SDK alias '+name);
 }
 if(!equal(owner.groups.map(row=>row.lane),inventory.groups.map(row=>row.lane)))fail('lane membership changed');
 for(const group of owner.groups){
  const old=inventory.groups.find(row=>row.lane===group.lane),historical=old.tuples??old.cases.map(row=>row.tuple);
  const raw=Buffer.from(group.comparisonText,'utf8');
  if(group.expectedExit!==(group.lane==='positive'?0:1)||group.observed.stderr.bytes!==0||group.observed.listFilesExit!==0
   ||group.observed.listStderr.bytes!==0||!equal({bytes:raw.length,sha256:hash(raw)},group.comparisonTextPin)
   ||!equal(tuples(group.comparisonText),group.tuples)||group.tuples.length!==historical.length
   ||group.tuples.some((tuple,index)=>!equal(tuple.slice(0,4),historical[index].slice(0,4))))fail('complete observation or assigned source position changed');
  // Only BitmapBindingTicket retains its already-authorized exact quoted-owner projection.
  if(id!=='bitmap-binding-ticket'&&!equal(group.comparisonTextPin,group.observed.stdout))fail('unexpected diagnostic projection');
 }
 recheck();
 function group(lane){
  const selected=owner.groups.find(row=>row.lane===lane);if(!selected)fail('unknown lane');
  return {...selected,declarationPins:selected.repositoryClosure.filter(file=>file.endsWith('.d.ts')).map(pin).sort((a,b)=>a.path.localeCompare(b.path)),
   closure:[...selected.repositoryClosure,...selected.nativeLibraryClosure.map(file=>ownerRelativePath(root,path.join(nativeOwner,file)))].sort()};
 }
 function verifyClosure(lane,listed){
  recheck();const selected=group(lane);
  if(!listed){
   const env={...process.env};
   for(const key of Object.keys(env))if(/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key))delete env[key];
   listed=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project',selected.config,'--listFilesOnly','--pretty','false'],
    {cwd:root,env,timeout:60000,maxBuffer:4194304,windowsHide:true});
  }
  if(listed.error||listed.signal!==null||listed.status!==0||text(listed.stderr)!=='')fail('actual compiler closure listing failed');
  const repository=[],libraries=[];
  for(const line of text(listed.stdout).replaceAll('\r\n','\n').split('\n').filter(Boolean)){
   const absolute=realpathSync(path.isAbsolute(line)?line:path.resolve(root,line));
   let nativeFile;try{nativeFile=ownerRelativePath(nativeOwner,absolute);}catch(error){if(!(error instanceof RangeError))throw error;}
   if(nativeFile!==undefined)libraries.push(nativeFile);else repository.push(ownerRelativePath(root,absolute));
  }
  repository.sort();libraries.sort();
  if(!equal(repository,selected.repositoryClosure)||!equal(libraries,selected.nativeLibraryClosure))fail('actual complete compiler closure changed');
  recheck();
 }
 const compilerPins=inventory.compiler?.pins?.map(row=>m21ResourcePin(root,selected,id,row));
 return {inputPins,compilerPins,pin,group,recheck,verifyClosure};
}
