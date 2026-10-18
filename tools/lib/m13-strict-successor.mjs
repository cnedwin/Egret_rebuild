// SPDX-License-Identifier: Apache-2.0
// One finite successor for twelve existing strict consumers. No product evaluation.
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fingerprintFile,ownerRelativePath,samePhysicalPath} from './file-identity.mjs';
const DATA={path:'tools/m13-strict-successors.json',bytes:449376,sha256:'c7843db0289d7535c0196379631e5da9ba1b6a1edef7ac996a3793900f7139c7'};
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

/** Old inventories remain immutable; only a complete recorded group selects new rows. */
export function selectM13StrictSuccessor(root,id,inventory){
 if(!IDS.includes(id))fail('unknown owner');
 const helperPin=fingerprintFile(root,'tools/lib/m13-strict-successor.mjs');
 const dataPin=fingerprintFile(root,DATA.path);if(!equal(dataPin,DATA))fail('changed successor data');
 const data=JSON.parse(readFileSync(path.join(root,DATA.path),'utf8'));
 if(data.schemaVersion!==1||data.kind!=='M13_FINITE_STRICT_DECLARATION_SUCCESSORS'
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
 const pin=file=>{const row=pins.get(file);if(!row)fail('unregistered selected input '+file);return row;};
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
  :owner.replacementPaths.includes(row.path)?pin(row.path):row).map(row=>m14EnginePackagePin(root,row));
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
 const sourcePins=owner.sourcePaths.map(pin),selectedPins=owner.inputPaths.map(pin);
 const libraryPaths=[...new Set(owner.groups.flatMap(group=>group.nativeLibraryClosure))];
 function recheck(){
  if(!equal(fingerprintFile(root,'tools/lib/m13-strict-successor.mjs'),helperPin)
   ||!equal(fingerprintFile(root,DATA.path),DATA)||!equal(fingerprintFile(root,owner.inventory.path),owner.inventory))fail('successor/history changed during replay');
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
 return {inputPins,pin,group,recheck,verifyClosure};
}
