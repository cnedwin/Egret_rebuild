// SPDX-License-Identifier: Apache-2.0
// Adapted from the first-party linear-layout strict replay gate.
// Complete actual observations are required; a pending authored inventory never passes.
import {spawnSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const fail=message=>{throw new Error('BitmapResourceSlot types: '+message);};
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const rawPin=raw=>({bytes:raw.length,sha256:hash(raw)});
if(process.argv.length!==2)fail('this replay gate accepts no arguments');
const helper=readFileSync(path.join(root,'tools/lib/file-identity.mjs'));
if(helper.length!==5065||hash(helper)!=='999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569')fail('shared identity helper changed before import');
const {fingerprintFile,logicalPath,ownerRelativePath,samePhysicalPath}=await import(pathToFileURL(path.join(root,'tools/lib/file-identity.mjs')).href);
if(process.platform==='win32'&&!samePhysicalPath(fileURLToPath(new URL('..',import.meta.url)),root,'win32'))fail('physical Windows owner differs');
const inventory=JSON.parse(readFileSync(path.join(root,'tests/types/bitmap-resource-slot-diagnostic-expectations.json'),'utf8'));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(root, 'tools/lib/m13-strict-successor.mjs');
if (m13HelperPin.bytes !== 16190 || m13HelperPin.sha256 !== '6410f814c90eaf001850a35ff74e826ca994e39cea7434b10a94dda165a01b88') throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');
const m13 = selectM13StrictSuccessor(root, 'bitmap-resource-slot', inventory);

if(inventory.schemaVersion!==1||inventory.kind!=='BITMAP_RESOURCE_SLOT_ACTUAL_STRICT_DIAGNOSTICS'||inventory.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS')fail('actual original compiler observation is pending or malformed');
if(!equal(inventory.tupleFormat,['file','line','column','code','message'])||!equal(inventory.groups?.map(row=>row.lane),['positive','negative']))fail('malformed lane inventory');
const requiredInputs=['tools/lib/file-identity.mjs','node_modules/typescript/package.json','node_modules/typescript/bin/tsc','node_modules/typescript/lib/tsc.js','node_modules/typescript/lib/getExePath.js','package.json','pnpm-lock.yaml','tsconfig.base.json','tests/types/bitmap-resource-slot-positive.ts','tests/types/bitmap-resource-slot-negative.ts','tests/types/tsconfig.bitmap-resource-slot-positive.json','tests/types/tsconfig.bitmap-resource-slot-negative.json','packages/contracts/package.json','packages/runtime/package.json','packages/engine/package.json','packages/engine/dist/bitmapResourceSlot.d.ts','packages/engine/dist/Engine.d.ts','packages/engine/dist/index.d.ts'];
if(!Array.isArray(inventory.inputPins)||new Set(inventory.inputPins.map(row=>row.path)).size!==inventory.inputPins.length||requiredInputs.some(key=>!inventory.inputPins.some(row=>row.path===key)))fail('incomplete exact input closure');
for(const pin of m13?.inputPins ?? inventory.inputPins)if(logicalPath(pin.path)!==pin.path||!equal(fingerprintFile(root,pin.path),pin))fail('changed original input '+pin.path);
for(const name of ['contracts','runtime','engine'])if(!samePhysicalPath(realpathSync(path.join(root,'node_modules/@egret',name)),realpathSync(path.join(root,'packages',name)),process.platform))fail('foreign public alias '+name);
const wrapperOwner=realpathSync(path.join(root,'node_modules/typescript'));
const wrapper=JSON.parse(readFileSync(path.join(wrapperOwner,'package.json'),'utf8'));
if(wrapper.name!=='typescript'||wrapper.version!=='7.0.2')fail('stock compiler wrapper/version differs');
const nativeName='@typescript/typescript-'+process.platform+'-'+process.arch;
const nativeOwner=realpathSync(path.dirname(createRequire(path.join(wrapperOwner,'package.json')).resolve(nativeName+'/package.json')));
const native=JSON.parse(readFileSync(path.join(nativeOwner,'package.json'),'utf8'));
if(native.name!==nativeName||native.version!==wrapper.version||!samePhysicalPath(nativeOwner,realpathSync(path.join(root,'node_modules',nativeName)),process.platform))fail('foreign native compiler');
const {default:getExePath}=await import(pathToFileURL(path.join(wrapperOwner,'lib/getExePath.js')).href);
let executable=getExePath();
if(process.platform==='win32'&&executable.startsWith(String.fromCharCode(92,92,63,92))){const ordinary=executable.slice(4);executable=ordinary.startsWith('UNC'+String.fromCharCode(92))?String.fromCharCode(92,92)+ordinary.slice(4):ordinary;}
const binary='lib/tsc'+(process.platform==='win32'?'.exe':'');
if(ownerRelativePath(nativeOwner,realpathSync(executable),process.platform)!==binary)fail('stock executable leaves native owner');
const observed=inventory.originalCompilerObservation;
if(!observed||observed.version!==wrapper.version||observed.nativePackage!=='@typescript/typescript-'+observed.platform+'-'+observed.arch)fail('missing original compiler provenance');
if(observed.platform===process.platform&&observed.arch===process.arch)for(const pin of [observed.nativeMetadataPin,observed.nativeBinaryPin])if(!equal(fingerprintFile(nativeOwner,pin.path),pin))fail('original native artifact changed');
if(!Array.isArray(inventory.nativeLibraryPins)||inventory.nativeLibraryPins.length===0||new Set(inventory.nativeLibraryPins.map(pin=>pin.path)).size!==inventory.nativeLibraryPins.length)fail('missing exact standard library closure');
for(const pin of inventory.nativeLibraryPins)if(logicalPath(pin.path)!==pin.path||!/^lib\/lib\.(?:es[0-9]|decorators)/.test(pin.path)||!equal(fingerprintFile(nativeOwner,pin.path),pin))fail('foreign/changed DOM-free standard library');
function tuplesFrom(raw){
 const output=new TextDecoder('utf-8',{fatal:true}).decode(raw),tuples=[];
 for(const line of output.replaceAll('\r\n','\n').split('\n')){
  if(line==='')continue;
  const match=/^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
  if(match){const absolute=path.isAbsolute(match[1])?match[1]:path.resolve(root,match[1]);tuples.push([ownerRelativePath(root,absolute,process.platform),Number(match[2]),Number(match[3]),Number(match[4]),match[5]]);}
  else if(/^ {2,}\S/.test(line)&&tuples.length)tuples.at(-1)[4]+='\n'+line;
  else fail('unlocated/unconsumed compiler output');
 }
 return tuples;
}
for(const group of inventory.groups){
 m13?.recheck();
 const lane=group.lane,file='tests/types/bitmap-resource-slot-'+lane+'.ts',config='tests/types/tsconfig.bitmap-resource-slot-'+lane+'.json';
 const source=readFileSync(path.join(root,file),'utf8');
 if(/@ts-(?:expect-error|ignore|nocheck)\b/.test(source))fail('suppressed diagnostics');
 const options=JSON.parse(readFileSync(path.join(root,config),'utf8')).compilerOptions;
 if(!equal(options.lib,['ES2022'])||!equal(options.types,[])||options.skipLibCheck!==false)fail('consumer config is not DOM/Node-free');
 const expectedExit=lane==='positive'?0:1;
 if(group.expectedExit!==expectedExit||group.observedExecution?.exitCode!==expectedExit||group.observedExecution.timeout!==false||typeof group.originalStdout!=='string'||!Array.isArray(group.tuples))fail('missing actual lane observation');
 const original=Buffer.from(group.originalStdout,'utf8');
 if(!equal(rawPin(original),group.observedExecution.stdout)||!equal(tuplesFrom(original),group.tuples)||group.observedExecution.stderr?.bytes!==0)fail('original raw output/tuples differ');
 if(lane==='positive'&&(original.length!==0||group.tuples.length!==0))fail('positive original was not diagnostic-free');
 if(lane==='negative'){
  const lines=source.split('\n'),cases=[];
  for(let index=0;index<lines.length;index++)if(lines[index].startsWith('// BITMAP_RESOURCE_SLOT_CASE '))cases.push({name:lines[index].slice('// BITMAP_RESOURCE_SLOT_CASE '.length),line:index+2});
  cases.sort((left,right)=>left.line-right.line);
  if(!equal(group.cases,cases)||cases.length===0||!equal(group.tuples.map(tuple=>tuple[1]),cases.map(row=>row.line))||group.tuples.some(tuple=>tuple[0]!==file||tuple[3]===2307))fail('incomplete/extra/unrelated negative lane diagnostics');
 }
 const args=['node_modules/typescript/bin/tsc','--noEmit','--project',config,'--pretty','false'];
 const result=spawnSync(process.execPath,args,{cwd:root,timeout:60000,maxBuffer:4*1024*1024,windowsHide:true});
 if(result.error||result.signal!==null||result.status!==expectedExit||!Buffer.isBuffer(result.stdout)||!Buffer.isBuffer(result.stderr)||result.stderr.length!==0||!equal(tuplesFrom(result.stdout),m13?.group(lane).tuples ?? group.tuples))fail('actual replay setup/exit/output mismatch');
 // Discover the actual declaration and standard-library closure independently.
 const listed=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project',config,'--listFilesOnly','--pretty','false'],{cwd:root,timeout:60000,maxBuffer:4*1024*1024,windowsHide:true});
 if(listed.error||listed.signal!==null||listed.status!==0||listed.stderr.length!==0)fail('actual closure listing failed');
 const dts=[],libraries=[];
 for(const physical of listed.stdout.toString('utf8').replaceAll('\r\n','\n').split('\n').filter(Boolean)){
  const absolute=realpathSync(path.isAbsolute(physical)?physical:path.resolve(root,physical));
  let libraryKey;try{libraryKey=ownerRelativePath(nativeOwner,absolute,process.platform);}catch(cause){if(!(cause instanceof RangeError))throw cause;}
  if(libraryKey!==undefined){libraries.push(fingerprintFile(nativeOwner,libraryKey));}
  else {const key=ownerRelativePath(root,absolute,process.platform);if(key.endsWith('.d.ts'))dts.push(fingerprintFile(root,key));else if(key!==file)fail('unexpected source in compiler closure');}
 }
 dts.sort((left,right)=>left.path.localeCompare(right.path));libraries.sort((left,right)=>left.path.localeCompare(right.path));
 if(!equal(dts,m13?.group(lane).declarationPins ?? group.declarationPins)||!equal(libraries,[...inventory.nativeLibraryPins].sort((left,right)=>left.path.localeCompare(right.path))))fail('changed complete declaration/library closure');
 for(const pin of dts)if(!(m13?.inputPins ?? inventory.inputPins).some(input=>equal(input,pin)))fail('declaration absent from authenticated inventory');
 m13?.verifyClosure(lane,listed);
 console.log('BitmapResourceSlot exact strict lane receipt: '+JSON.stringify({lane,args,exitCode:result.status,timeout:false,stdout:rawPin(result.stdout),stderr:rawPin(result.stderr),tuples:m13?.group(lane).tuples ?? group.tuples,declarationCount:dts.length,compiler:{version:native.version,platform:process.platform,arch:process.arch,nativePackage:nativeName,nativeMetadataPin:fingerprintFile(nativeOwner,'package.json'),nativeBinaryPin:fingerprintFile(nativeOwner,binary)}}));
}
console.log('BitmapResourceSlot strict public consumers PASS; source, runtime, browser and delivery remain separate.');
