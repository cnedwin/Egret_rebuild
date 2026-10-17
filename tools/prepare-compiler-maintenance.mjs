// SPDX-License-Identifier: Apache-2.0
// Read-only registered compiler inputs. Raw observations never replace strict gates.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,logicalPath,physicalPathKey,samePhysicalPath} from './lib/file-identity.mjs';
import {uniqueJSON} from './prepare-check-maintenance.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url)));
// Each adapter declares its own saved schema; no recursive pin discovery is allowed.
const strictNames=['atlas-import','atlas-frame','bitmap-resource-slot','bitmap-binding-ticket','linear-layout','bitmap-button','display-anchor-offsets','display-container-add-child-at','display-container-child-index','display-container-remove-children','nine-slice-bitmap'];
const nativeNames=new Set(['bitmap-resource-slot','bitmap-binding-ticket','linear-layout','bitmap-button','display-anchor-offsets','display-container-add-child-at','display-container-child-index','display-container-remove-children']);
const legacyNames=['browser-png','spritesheet','sequence-playback','byte-writer','nine-slice','scene3d'];
const registry=[...strictNames,...legacyNames];
const gate=name=>['byte-writer','nine-slice','scene3d'].includes(name)?'tools/check-types.mjs':'tools/'+name+'-types.mjs';
const inventoryPath=name=>'tests/types/'+name+'-diagnostic-expectations.json';
const nativeName='@typescript/typescript-win32-x64';
const sceneFixtures=['positive','web-positive','negative','web-negative','import-negative','web-dom-free-negative'].map(lane=>'tests/types/scene3d-'+lane+'.ts');
const packages=[['compiler','typescript'],['compiler-native','@typescript/typescript-win32-x64'],['project-json','jsonc-parser']];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const sort=(a,b)=>a<b?-1:a>b?1:0;
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),keys.sort());
function pin(value){
 requireThat(exact(value,['path','bytes','sha256'])&&Number.isSafeInteger(value.bytes)&&value.bytes>=0&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256),'Invalid raw identity');logicalPath(value.path);return value;
}
// A missing literal file is data. Aliases and nonregular descendants are errors.
function optionalPin(owner,file){
 logicalPath(file);let current=owner;const parts=file.split('/');
 for(let i=0;i<parts.length;i++){
  const entries=fs.readdirSync(current),part=parts[i];
  if(!entries.includes(part)){requireThat(!entries.some(x=>x.toLowerCase()===part.toLowerCase()),'Input spelling differs');return null;}
  current=path.join(current,part);const stat=fs.lstatSync(current);
  requireThat(!stat.isSymbolicLink()&&(i===parts.length-1?stat.isFile():stat.isDirectory()),'Nonregular compiler input');
 }
 return fingerprintFile(owner,file);
}
function inventory(owner){
 const rows=[];
 function walk(relative){
  for(const item of fs.readdirSync(path.join(owner,relative),{withFileTypes:true}).sort((a,b)=>sort(a.name,b.name))){
   const file=relative?relative+'/'+item.name:item.name;logicalPath(file);
   requireThat(!item.isSymbolicLink()&&(item.isDirectory()||item.isFile()),'Nonregular dependency inventory');
   if(item.isDirectory())walk(file);else rows.push(fingerprintFile(owner,file));
  }
 }
 walk('');return rows.sort((a,b)=>sort(a.path,b.path));
}
function decode(owner,file,identity){
 requireThat(identity!==null,'Required input missing: '+file);requireThat(identity.bytes<=16_777_216,'JSON artifact exceeds 16 MiB');
 const raw=fs.readFileSync(path.join(owner,file));
 requireThat(raw.length===identity.bytes&&createHash('sha256').update(raw).digest('hex')===identity.sha256,'Input changed during read');
 return uniqueJSON(new TextDecoder('utf-8',{fatal:true}).decode(raw));
}
function resolveOwners(root){
 const owners={repository:root};
 for(const [owner,name]of packages){const selected=fs.realpathSync(path.join(root,'node_modules',name));requireThat(fs.statSync(selected).isDirectory(),'Dependency owner directory required');owners[owner]=selected;}
 // Resolve metadata through the wrapper's Node search path, without importing it.
 const name='@typescript/typescript-win32-x64';
 const search=createRequire(path.join(owners.compiler,'package.json')).resolve.paths(name+'/package.json');
 // Inspect the fixed metadata subpath afresh: require.resolve caches earlier hits.
 const selected=search.map(base=>path.join(base,name,'package.json')).find(file=>fs.existsSync(file));
 requireThat(selected,'Wrapper native metadata missing');
 const native=fs.realpathSync(path.dirname(selected));
 requireThat(native===owners['compiler-native'],'Wrapper and repository native owners differ');
 return {owners,wrapperNative:native};
}
function target(file){
 logicalPath(file);
 for(const [owner,name]of packages){const prefix='node_modules/'+name+'/';if(file.startsWith(prefix))return {owner,path:logicalPath(file.slice(prefix.length))};}
 const allowed=/^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file)
  ||registry.some(name=>file===gate(name))||file==='tools/lib/file-identity.mjs'||/^tests\/types\/[A-Za-z0-9_.-]+\.(?:json|ts)$/.test(file)
  ||/^packages\/(?:contracts|engine|project|runtime)\/(?:(?:src|dist|web|rendering)\/.+\.(?:ts|js)|package\.json|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file);
 requireThat(allowed&&!file.split('/').some(x=>x.startsWith('.')||x==='node_modules'),'Unsupported compiler input owner: '+file);
 return {owner:'repository',path:file};
}
export function prepareCompilerReview(root){
 physicalPathKey(root);const selectedRoot=root;root=fs.realpathSync(root);
 const resolution=resolveOwners(root),{owners}=resolution,observed=new Map(),declarations=[];
 function observe(owner,file){const key=owner+':'+file;if(!observed.has(key))observed.set(key,{owner,path:file,identity:optionalPin(owners[owner],file)});return observed.get(key).identity;}
 for(const file of ['tools/prepare-compiler-maintenance.mjs','tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs'])requireThat(observe('repository',file),'Maintenance implementation missing');
 const dependencies=packages.map(([owner,name])=>{
  const files=inventory(owners[owner]),metadata=decode(owners[owner],'package.json',files.find(x=>x.path==='package.json')??null);
  requireThat(metadata.name===name,'Installed package name differs');
  if(owner==='compiler-native')requireThat(!Object.hasOwn(metadata,'exports')||equal(metadata.exports,{'./package.json':'./package.json'}),'Native metadata export mapping is outside this reader');
  return {owner,name,metadata,inventory:files};
 });
 // Membership is review data. Unknown records are listed, never parsed or followed.
 function coverageNow(){
  const discovered=fs.readdirSync(path.join(root,'tests/types')).filter(x=>/diagnostic-expectations\.json$/i.test(x)).map(x=>'tests/types/'+x).sort(sort);
  const registered=registry.map(inventoryPath).sort(sort);
  return {registered,unregistered:discovered.filter(x=>!registered.includes(x))};
 }
 const coverage=coverageNow();
 function add(file,selector,list,locate=expected=>target(expected.path),comparison='bytes-and-sha256'){
  requireThat(Array.isArray(list)&&list.length>0,'Registered input list required: '+selector);const seen=new Set();
  const rows=list.map(expected=>{
   if(comparison==='sha256-only')requireThat(exact(expected,['path','sha256'])&&typeof expected.sha256==='string'&&/^[a-f0-9]{64}$/.test(expected.sha256),'Invalid digest-only identity');else pin(expected);
   logicalPath(expected.path);requireThat(!seen.has(expected.path),'Duplicate declared input path');seen.add(expected.path);
   const location=locate(expected),current=observe(location.owner,location.path);
   const matches=current!==null&&current.sha256===expected.sha256&&(comparison==='sha256-only'||current.bytes===expected.bytes);
   return {...location,expected,current,comparison,identity:current===null?'missing':matches?'same':'different'};
  });
  declarations.push({owner:file,selector,rows});
 }
 function savedNative(value,packageKey){requireThat(value?.platform==='win32'&&value.arch==='x64'&&value[packageKey]===nativeName,'Unsupported saved native owner');}
 function nativeLocation(expected,allowed,prefix=''){
  const file=expected.path;requireThat(file.startsWith(prefix)&&allowed.includes(file.slice(prefix.length)),'Unsupported saved native input');
  return {owner:'compiler-native',path:file.slice(prefix.length)};
 }
 for(const name of registry){
  const file=inventoryPath(name);requireThat(observe('repository',gate(name)),'Registered strict gate missing');
  const value=decode(root,file,observe('repository',file)),kind=name.replaceAll('-','_').toUpperCase();
  const list=selector=>{let v=value;for(const key of selector.split('.'))v=v?.[key];return v;};
  const addList=(selector,locate)=>add(file,selector,list(selector),locate);
  const addOne=(selector,locate)=>add(file,selector,[list(selector)],locate);
  const noField=key=>!Object.hasOwn(value,key);
  if(strictNames.includes(name)){
   requireThat(value.kind===kind+'_ACTUAL_STRICT_DIAGNOSTICS'&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&(['atlas-import','atlas-frame'].includes(name)?noField('schemaVersion'):value.schemaVersion===1),'Unsupported registered diagnostic schema');
   addList('inputPins');
   if(name==='atlas-import')addList('sourcePolicy.jsoncPins',expected=>{const location=target(expected.path);requireThat(location.owner==='project-json','Atlas JSON parser owner required');return location;});
   if(nativeNames.has(name)){
    savedNative(value.originalCompilerObservation,'nativePackage');
    addList('nativeLibraryPins',expected=>{requireThat(/^lib\/lib\.(?:es[0-9a-z.]*|decorators(?:\.legacy)?)\.d\.ts$/.test(expected.path),'Unsupported native library path');return {owner:'compiler-native',path:expected.path};});
    addOne('originalCompilerObservation.nativeMetadataPin',expected=>nativeLocation(expected,['package.json']));
    addOne('originalCompilerObservation.nativeBinaryPin',expected=>nativeLocation(expected,['lib/tsc.exe']));
   }
   // These are additional claims, not replacements or effective gate decisions.
   if(name.startsWith('display-container-'))addList('currentInputIdentitySuccessor.rows');
  }else{
   requireThat(value.schemaVersion===1,'Unsupported legacy schema');
   if(['browser-png','spritesheet','sequence-playback'].includes(name)){
    requireThat(value.kind===kind+'_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS'&&(name==='sequence-playback'?value.status==='SAVED_ACTUAL_DATA_FROZEN_REUSABLE_GATE_NOT_RUN':noField('status')),'Unsupported legacy diagnostic kind/status');
    addList('compiler.pins');addList('configurationPins');
    const group=name==='browser-png'?'lanes':'groups',fields=name==='browser-png'?['sourcePin','configPin']:['fixture','config'];
    requireThat(Array.isArray(value[group])&&value[group].length>0,'Registered groups required');
    for(let i=0;i<value[group].length;i++)for(const field of fields)addOne(group+'.'+i+'.'+field);
    if(name==='browser-png')addList('productPins');
    if(name==='sequence-playback'){
     savedNative(value.compiler.observedNative,'package');
     const pins=value.compiler.observedNative.pins;requireThat(Array.isArray(pins)&&equal(pins.map(x=>x.path).sort(),['lib/tsc.exe','package.json']),'Native metadata and binary pair required');
     addList('compiler.observedNative.pins',expected=>nativeLocation(expected,['package.json','lib/tsc.exe']));
     addList('currentDeclarationSuccessor.sourcePins');addOne('currentDeclarationSuccessor.fixture');addOne('currentDeclarationSuccessor.config');
    }
   }else if(name==='scene3d'){
    requireThat(noField('kind')&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&exact(value.fixtureSHA256,[...sceneFixtures]),'Unsupported scene fixture schema');
    for(const [key,filePath]of [['packageSHA256','node_modules/typescript/package.json'],['tscSHA256','node_modules/typescript/bin/tsc']])add(file,'compiler.'+key,[{path:filePath,sha256:value.compiler?.[key]}],undefined,'sha256-only');
    add(file,'fixtureSHA256',sceneFixtures.map(filePath=>({path:filePath,sha256:value.fixtureSHA256[filePath]})),undefined,'sha256-only');
   }else{
    requireThat(noField('kind')&&noField('status')&&value.scope===(name==='byte-writer'?'BW1':'NS1')+' actual strict consumer diagnostic inventory','Unsupported legacy scope');
    for(const selector of ['positive.fixture','groups.negative.fixture','groups.import-negative.fixture'])addOne(selector);
    if(name==='nine-slice'){
     requireThat(value.compiler?.platform==='win32'&&value.compiler.arch==='x64','Unsupported saved native owner');addList('compiler.wrapperPins');addList('configurationPins');
     for(const [key,leaf]of [['package','package.json'],['executable','lib/tsc.exe']])addOne('compiler.nativePlatform.'+key,expected=>nativeLocation(expected,[leaf],nativeName+'/'));
    }
   }
  }
 }
 const reverse=new Map();
 for(const group of declarations)for(const row of group.rows){
  const key=row.owner+':'+row.path;if(!reverse.has(key))reverse.set(key,{owner:row.owner,path:row.path,current:row.current,references:[]});
  reverse.get(key).references.push({declaration:group.owner,selector:group.selector,expected:row.expected,comparison:row.comparison,matches:row.identity==='same'});
 }
 const references=[...reverse.values()].sort((a,b)=>sort(a.owner+':'+a.path,b.owner+':'+b.path));
 for(const row of references)row.identity=row.current===null?'missing':row.references.every(x=>x.matches)?'same':'different';
 const inputs=[...observed.values()].sort((a,b)=>sort(a.owner+':'+a.path,b.owner+':'+b.path));
 for(const row of inputs)requireThat(equal(row.identity,optionalPin(owners[row.owner],row.path)),'Compiler input changed during collection');
 for(const dependency of dependencies)requireThat(equal(dependency.inventory,inventory(owners[dependency.owner])),'Dependency inventory changed during collection');
 requireThat(fs.realpathSync(selectedRoot)===root&&equal(resolution,resolveOwners(root)),'Compiler owner resolution changed during collection');
 requireThat(equal(coverage,coverageNow()),'Diagnostic inventory membership changed during collection');
 return {schemaVersion:2,kind:'compiler-maintenance',status:'review-required',acceptance:'none',repository:root,resolution,coverage,dependencies,declarations,references,inputs,
  limits:['Explicit selectors in 17 registered diagnostic JSON records; unknown inventory names are coverage gaps','Observed Windows x64 dependency bundle; no host compatibility or compiler execution claim','Eight native library lists and fixed metadata/binary observations are compared under their explicit native owner',
   'Selected successor pins remain separate claims; other successor semantics, diagnostics, private receipts and provenance are byte-bound but not interpreted',
   'Digest-only expectations retain their original comparison strength; complete dependency inventory does not authenticate historical declarations','No baseline update, diagnostic replay, version admission, browser or device acceptance']};
}
export function verifyCompilerProposal(root,proposal){
 requireThat(proposal?.kind==='compiler-maintenance'&&proposal.schemaVersion===2,'Compiler proposal required');
 requireThat(equal(proposal,prepareCompilerReview(root)),'Compiler proposal inputs or content changed');
 return {status:'current-inputs',acceptance:'none; independent review and complete gates remain required'};
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 requireThat(process.execArgv.length===0&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'Fresh Node CLI without preload or custom loader options required');
 const args=process.argv.slice(2);let result;
 if(args.length===0)result=prepareCompilerReview(ROOT);
 else {
  requireThat(args.length===2&&args[0]==='--check','Only --check ABSOLUTE.json is supported');const file=args[1];physicalPathKey(file);requireThat(path.extname(file)==='.json','Explicit JSON proposal required');
  const owner=path.dirname(file),name=path.basename(file);requireThat(fs.lstatSync(file).size<=16_777_216,'JSON artifact exceeds 16 MiB');
  const before=fingerprintFile(owner,name);result=verifyCompilerProposal(ROOT,decode(owner,name,before));
  requireThat(equal(before,fingerprintFile(owner,name)),'Proposal changed during recheck');
 }
 console.log(JSON.stringify(result,null,2));
}
