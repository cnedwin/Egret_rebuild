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
// These are reviewed source revisions, not caller-supplied parser permissions.
const inlineSources=[
 {
  "path": "tools/check-types.mjs",
  "bytes": 94916,
  "sha256": "13080da8e72418df9b8e8279d09b53e36839a5826953f84143c5787d1d1bff7a"
 },
 {
  "path": "tools/bitmap-resource-slot-types.mjs",
  "bytes": 10489,
  "sha256": "454abe1eb4fafc7c805e8c806d61e6f592e8c7a5345fd4a2d23316b5b500bf73"
 },
 {
  "path": "tools/bitmap-binding-ticket-types.mjs",
  "bytes": 13171,
  "sha256": "57ed148c4e654d1eb8da46991a9b7902123a6e1d673efe1de05a0c5657f02879"
 },
 {
  "path": "tools/linear-layout-types.mjs",
  "bytes": 10385,
  "sha256": "02a691c2e66eb7d817bcf8dea1a70f908337d9b064b36797f3fea0c2a06e73a8"
 },
 {
  "path": "tools/bitmap-button-types.mjs",
  "bytes": 16544,
  "sha256": "792ea25c61a5815f32df80bc5cfe5a1f646452ca927e0022ee7f43d6deaf1e4a"
 },
 {
  "path": "tools/display-anchor-offsets-types.mjs",
  "bytes": 15885,
  "sha256": "fee3a36afb7516c991775c052abc0889541f8a9cf9174ea526c428470fee56c1"
 },
 {
  "path": "tools/display-container-add-child-at-types.mjs",
  "bytes": 17991,
  "sha256": "267a68a830c4394dc63dfd7fde01c5b9f4ed5b773704bd31f90d2199898d7643"
 },
 {
  "path": "tools/display-container-child-index-types.mjs",
  "bytes": 16406,
  "sha256": "692faad618a5ffb05d6bcfbd98d97bc3f6806b87040a29cc6836345d3b9a6a6a"
 },
 {
  "path": "tools/display-container-remove-children-types.mjs",
  "bytes": 14624,
  "sha256": "b20a666a9ccaf770ef1b2d9dbc3c086809f45f35aefc02366388a50c09818578"
 },
 {
  "path": "tools/sequence-playback-types.mjs",
  "bytes": 17296,
  "sha256": "8b2d266f7aacd680f7a1581afb2ea1a1381f02fc44cd70b340ee8961c7584222"
 }
];
const inlineInventories=[
 ['mouseTypeExpectations','mouse-input',['positive','negative','import-negative','dom-free-negative']],
 ['spineTypeExpectations','spine-import-plan',['positive','negative','import-negative']]
];
function inlineMode(options={}){
 requireThat(exact(options,[])||exact(options,['inlinePolicies'])&&typeof options.inlinePolicies==='boolean','Unsupported compiler review options');return options.inlinePolicies===true;
}
export function parseCompilerOptions(args){
 const options={inlinePolicies:false};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--inline-policies'){requireThat(!options.inlinePolicies,'Duplicate inline policy mode');options.inlinePolicies=true;}
  else if(args[i]==='--check'){requireThat(!Object.hasOwn(options,'check')&&typeof args[i+1]==='string','Explicit check artifact required');options.check=args[++i];physicalPathKey(options.check);requireThat(path.extname(options.check)==='.json','Explicit JSON proposal required');}
  else throw Error('Unsupported compiler review option');
 }
 return options;
}
export function prepareCompilerReview(root,options={}){
 const includeInline=inlineMode(options);
 physicalPathKey(root);const selectedRoot=root;root=fs.realpathSync(root);
 const resolution=resolveOwners(root),{owners}=resolution,observed=new Map(),declarations=[],records=new Map();
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
  const value=decode(root,file,observe('repository',file)),kind=name.replaceAll('-','_').toUpperCase();records.set(name,value);
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
 let inlinePolicies=null;
 if(includeInline){
  const sources=[],texts=new Map(),literals=[],conditions=[],observations=[];
  // Authenticate the complete original bytes before examining any initializer.
  for(const expected of inlineSources){
   const current=observe('repository',expected.path);requireThat(equal(current,expected),'Unreviewed inline policy source: '+expected.path);
   const raw=fs.readFileSync(path.join(root,expected.path));requireThat(raw.length===expected.bytes&&createHash('sha256').update(raw).digest('hex')===expected.sha256,'Inline source changed while reading');
   texts.set(expected.path,new TextDecoder('utf-8',{fatal:true}).decode(raw));sources.push(current);
  }
  function span(owner,start,end){const text=texts.get(owner),raw=Buffer.from(text.slice(start,end));return {owner,startByte:Buffer.byteLength(text.slice(0,start)),endByte:Buffer.byteLength(text.slice(0,end)),bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};}
  // Only JSON initializers in authenticated revisions are supported. This is
  // not a general JavaScript parser and never evaluates a gate or condition.
  function literal(owner,binding){
   const text=texts.get(owner),matches=[...text.matchAll(new RegExp('^ *const '+binding+' *= *([^\\r\\n]+); *$','gm'))];
   requireThat(matches.length===1,'Missing or ambiguous reviewed literal: '+binding);
   const match=matches[0],start=match.index+match[0].indexOf('=')+1,leading=text.slice(start).match(/^ */)[0].length,a=start+leading,b=a+match[1].length;
   const value=uniqueJSON(match[1]);literals.push({binding,...span(owner,a,b)});return value;
  }
  for(const [binding,family,lanes]of inlineInventories){
   const owner='tools/check-types.mjs',value=literal(owner,binding),fixtures=lanes.map(lane=>'tests/types/'+family+'-'+lane+'.ts');
   requireThat(value.schemaVersion===1&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&exact(value.fixtureSHA256,[...fixtures]),'Unsupported reviewed inline inventory');
   for(const [key,filePath]of [['packageSHA256','node_modules/typescript/package.json'],['tscSHA256','node_modules/typescript/bin/tsc']])add(owner,binding+'.compiler.'+key,[{path:filePath,sha256:value.compiler?.[key]}],undefined,'sha256-only');
   add(owner,binding+'.fixtureSHA256',fixtures.map(filePath=>({path:filePath,sha256:value.fixtureSHA256[filePath]})),undefined,'sha256-only');
   const actual=dependencies.find(x=>x.owner==='compiler').metadata.version;
   observations.push({owner,binding,savedVersion:value.compiler.version,installedVersion:actual,versionAgreement:actual===value.compiler.version,admission:'not-evaluated'});
  }
  for(const name of nativeNames){
   const owner=gate(name),text=texts.get(owner),saved=records.get(name).originalCompilerObservation;
   const first=['bitmap-resource-slot','bitmap-binding-ticket','linear-layout'].includes(name);
   const prefix=first?'if(observed.platform===process.platform&&observed.arch===process.arch)':name==='bitmap-button'?'if(process.platform===originalCompiler.platform&&process.arch===originalCompiler.arch){':'if (process.platform === observedCompiler.platform && process.arch === observedCompiler.arch) {';
   const at=text.indexOf(prefix);requireThat(at>=0&&text.indexOf(prefix,at+1)<0,'Reviewed native condition missing or ambiguous');
   const end=first?text.indexOf('\n',at):text.indexOf('\n}',at)+2;requireThat(end>at,'Reviewed native branch end missing');
   const readerHost={platform:process.platform,arch:process.arch},savedHost={platform:saved.platform,arch:saved.arch};
   conditions.push({kind:'saved-native-host',gate:owner,inventory:inventoryPath(name),branch:span(owner,at,end),readerHost,savedHost,readerHostEqualsSavedHost:equal(readerHost,savedHost),conditionalSelectors:['originalCompilerObservation.nativeMetadataPin','originalCompilerObservation.nativeBinaryPin'],unconditionalSelector:'nativeLibraryPins',admission:'not-evaluated'});
  }
  for(const name of ['display-container-add-child-at','display-container-child-index','display-container-remove-children']){
   const owner=gate(name),historical=literal(owner,'historicalDeclaration'),current=literal(owner,'currentDeclarationRows'),value=records.get(name);
   add(owner,'historicalDeclaration',[historical]);add(owner,'currentDeclarationRows',current);
   conditions.push({kind:'container-successor',gate:owner,inventory:inventoryPath(name),historyAgreement:equal(historical,value.inputPins.find(x=>x.path===historical.path)),successorAgreement:equal(current,value.currentInputIdentitySuccessor.rows),selectors:['inputPins','currentInputIdentitySuccessor.rows'],admission:'not-evaluated'});
  }
  const sequence=gate('sequence-playback'),expected=literal(sequence,'expectedCurrentSourcePins');add(sequence,'expectedCurrentSourcePins',expected);
  conditions.push({kind:'sequence-negative-successor',gate:sequence,inventory:inventoryPath('sequence-playback'),lane:'negative',sourceAgreement:equal(expected,records.get('sequence-playback').currentDeclarationSuccessor.sourcePins),selector:'currentDeclarationSuccessor.sourcePins',admission:'not-evaluated'});
  inlinePolicies={sources,literals,observations,conditions,limits:['Raw data relationships only; original schema, kind, review hash, tuple, closure and execution obligations remain with their gates','Native host equality concerns saved metadata/binary pins only; libraries and current-host owner/version checks remain separate','Fixed Windows x64 bundle observations never select the actual host compiler or decide admission','Any gate-source byte change requires a separately reviewed registry update; no parser fallback or automatic fingerprint refresh']};
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
 return {schemaVersion:3,kind:'compiler-maintenance',status:'review-required',acceptance:'none',repository:root,resolution,coverage,dependencies,declarations,references,inputs,inlinePolicies,
  limits:['Explicit selectors in 17 registered diagnostic JSON records; unknown inventory names are coverage gaps','Observed Windows x64 dependency bundle; no host compatibility or compiler execution claim','Eight native library lists and fixed metadata/binary observations are compared under their explicit native owner',
   'Selected successor pins remain separate claims; other successor semantics, diagnostics, private receipts and provenance are byte-bound but not interpreted',
   'Digest-only expectations retain their original comparison strength; complete dependency inventory does not authenticate historical declarations','No baseline update, diagnostic replay, version admission, browser or device acceptance']};
}
export function verifyCompilerProposal(root,proposal,options={}){
 requireThat(proposal?.kind==='compiler-maintenance'&&proposal.schemaVersion===3,'Compiler proposal required');
 requireThat((proposal.inlinePolicies!==null)===inlineMode(options),'Explicit inline policy mode differs');
 requireThat(equal(proposal,prepareCompilerReview(root,options)),'Compiler proposal inputs or content changed');
 return {status:'current-inputs',acceptance:'none; independent review and complete gates remain required'};
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 requireThat(process.execArgv.length===0&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'Fresh Node CLI without preload or custom loader options required');
 const {check,...options}=parseCompilerOptions(process.argv.slice(2));let result;
 if(check===undefined)result=prepareCompilerReview(ROOT,options);
 else {
  const file=check,owner=path.dirname(file),name=path.basename(file);requireThat(fs.lstatSync(file).size<=16_777_216,'JSON artifact exceeds 16 MiB');
  const before=fingerprintFile(owner,name);result=verifyCompilerProposal(ROOT,decode(owner,name,before),options);
  requireThat(equal(before,fingerprintFile(owner,name)),'Proposal changed during recheck');
 }
 console.log(JSON.stringify(result,null,2));
}
