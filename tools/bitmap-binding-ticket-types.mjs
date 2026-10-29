// SPDX-License-Identifier: Apache-2.0
// Adapted from the first-party BitmapResourceSlot strict replay gate.
// Complete actual observations are required; a pending authored inventory never passes.
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const fail=message=>{throw new Error('BitmapBindingTicket types: '+message);};
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const rawPin=raw=>({bytes:raw.length,sha256:hash(raw)});
const bootstrapFail=(_code,message)=>fail(message);
const declaredRoot=fileURLToPath(new URL('..',import.meta.url));
const root=realpathSync(declaredRoot);
const platform=process.platform==='win32'?'win32':process.platform;
const physicalAPI=platform==='win32'?path.win32:path.posix;
if(process.argv.length!==2)bootstrapFail('BBT_TYPES_INPUT','No arguments or external root override is accepted');
if(!physicalAPI.isAbsolute(root)||physicalAPI.relative(root,declaredRoot)!==''||lstatSync(root).isSymbolicLink())bootstrapFail('BBT_TYPES_INPUT','Canonical physical owner required');
// Builtins authenticate every exact helper path component and raw bytes first.
let helperFile=root;
for(const [index,part] of ['tools','lib','file-identity.mjs'].entries()){
 if(!readdirSync(helperFile).includes(part))bootstrapFail('BBT_TYPES_HELPER','Helper spelling differs');
 helperFile=physicalAPI.join(helperFile,part);const stat=lstatSync(helperFile);
 if(stat.isSymbolicLink()||(index<2?!stat.isDirectory():!stat.isFile()))bootstrapFail('BBT_TYPES_HELPER','Helper owner component differs');
}
if(physicalAPI.relative(root,realpathSync(helperFile)).replaceAll('\\','/')!=='tools/lib/file-identity.mjs')bootstrapFail('BBT_TYPES_HELPER','Helper has another physical owner');
const helperURL=pathToFileURL(helperFile),helperRaw=readFileSync(helperFile);
if(physicalAPI.relative(helperFile,fileURLToPath(helperURL))!==''||helperRaw.length!==5065||hash(helperRaw)!=='999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569')bootstrapFail('BBT_TYPES_HELPER','Shared helper raw bootstrap differs');
const {fingerprintFile,logicalPath,samePhysicalPath,ownerRelativePath}=await import(helperURL.href);
if(!samePhysicalPath(root,declaredRoot,platform))bootstrapFail('BBT_TYPES_INPUT','Physical owner differs');
const inventoryPin={"path":"tests/types/bitmap-binding-ticket-diagnostic-expectations.json","bytes":64561,"sha256":"23c64c1b550b2a375c27d8d46c1a4815f1a909971b3e571469dfdaacbd113e8c"};
if(!equal(fingerprintFile(root,inventoryPin.path),inventoryPin))fail('changed observed inventory');
const inventory=JSON.parse(readFileSync(path.join(root,inventoryPin.path),'utf8'));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(root, 'tools/lib/m13-strict-successor.mjs');
if (m13HelperPin.bytes !== 31911 || m13HelperPin.sha256 !== '0f6fecab6a25c7f7b1965463494fc144276d2b94416e25884cf2fb08a23c88ec') throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');
const m13 = selectM13StrictSuccessor(root, 'bitmap-binding-ticket', inventory);

if(!equal(inventory.messageProjection,{kind:'EXACT_QUOTED_AUTHENTICATED_OWNER_NAMESPACE',literalSuffix:'packages/engine/dist/index',replacement:'<repo>',originalRawPreserved:true,scope:'Only the exact double-quoted authenticated repository owner prefix in the selected root namespace message; all other diagnostic bytes and paths remain significant.'}))fail('unknown diagnostic projection');
function projectNamespace(output){
 // Authenticate the complete selected declaration before replacing its exact quoted owner.
 const selected=(m13?.inputPins ?? inventory.inputPins).find(pin=>pin.path==='packages/engine/dist/index.d.ts');
 if(!selected||!equal(fingerprintFile(root,selected.path),selected))fail('namespace declaration owner differs');
 // Accept only the compiler's spelling of this authenticated, quoted namespace.
 // Leave every other diagnostic byte, suffix and owner significant.
 const owner=root.replaceAll('\\','/');
 const escaped=owner.replace(/[^\x20-\x7e]/g,unit=>'\\u'+unit.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
 for(const spelling of new Set([owner,escaped])){
  const prefix='"'+spelling+'/packages/engine/dist/index"';
  output=output.replaceAll(prefix,'"<repo>/packages/engine/dist/index"');
 }
 return output;
}
if(inventory.schemaVersion!==1||inventory.kind!=='BITMAP_BINDING_TICKET_ACTUAL_STRICT_DIAGNOSTICS'||inventory.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS')fail('actual original compiler observation is pending or malformed');
if(!equal(inventory.tupleFormat,['file','line','column','code','message'])||!equal(inventory.groups?.map(row=>row.lane),['positive','negative']))fail('malformed lane inventory');
const requiredInputs=['tools/lib/file-identity.mjs','node_modules/typescript/package.json','node_modules/typescript/bin/tsc','node_modules/typescript/lib/tsc.js','node_modules/typescript/lib/getExePath.js','package.json','pnpm-lock.yaml','tsconfig.base.json','tests/types/bitmap-binding-ticket-positive.ts','tests/types/bitmap-binding-ticket-negative.ts','tests/types/tsconfig.bitmap-binding-ticket-positive.json','tests/types/tsconfig.bitmap-binding-ticket-negative.json','packages/contracts/package.json','packages/runtime/package.json','packages/engine/package.json','packages/engine/dist/bitmapBindingTicket.d.ts','packages/engine/dist/Engine.d.ts','packages/engine/dist/index.d.ts'];
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
 const output=projectNamespace(new TextDecoder('utf-8',{fatal:true}).decode(raw)),tuples=[];
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
 const lane=group.lane,file='tests/types/bitmap-binding-ticket-'+lane+'.ts',config='tests/types/tsconfig.bitmap-binding-ticket-'+lane+'.json';
 const source=readFileSync(path.join(root,file),'utf8');
 if(/@ts-(?:expect-error|ignore|nocheck)\b/.test(source))fail('suppressed diagnostics');
 const options=JSON.parse(readFileSync(path.join(root,config),'utf8')).compilerOptions;
 if(!equal(options.lib,['ES2022'])||!equal(options.types,[])||options.skipLibCheck!==false)fail('consumer config is not DOM/Node-free');
 const expectedExit=lane==='positive'?0:1;
 if(group.expectedExit!==expectedExit||group.observedExecution?.exitCode!==expectedExit||group.observedExecution.timeout!==false||typeof group.projectedOriginalStdout!=='string'||!Array.isArray(group.tuples))fail('missing actual lane observation');
 const original=Buffer.from(group.projectedOriginalStdout,'utf8');
 if(!equal(rawPin(original),group.projectedOriginalStdoutPin)||!equal(tuplesFrom(original),group.tuples)||group.observedExecution.stderr?.bytes!==0)fail('original projected output/tuples differ');
 if(lane==='positive'&&(original.length!==0||group.tuples.length!==0))fail('positive original was not diagnostic-free');
 if(lane==='negative'){
  const lines=source.split('\n'),cases=[];
  for(let index=0;index<lines.length;index++)if(lines[index].startsWith('// BITMAP_BINDING_TICKET_CASE '))cases.push({name:lines[index].slice('// BITMAP_BINDING_TICKET_CASE '.length),line:index+2});
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
 console.log('BitmapBindingTicket exact strict lane receipt: '+JSON.stringify({lane,args,exitCode:result.status,timeout:false,stdout:rawPin(result.stdout),stderr:rawPin(result.stderr),tuples:m13?.group(lane).tuples ?? group.tuples,declarationCount:dts.length,compiler:{version:native.version,platform:process.platform,arch:process.arch,nativePackage:nativeName,nativeMetadataPin:fingerprintFile(nativeOwner,'package.json'),nativeBinaryPin:fingerprintFile(nativeOwner,binary)}}));
}
console.log('BitmapBindingTicket strict public consumers PASS; source, runtime, browser and delivery remain separate.');
