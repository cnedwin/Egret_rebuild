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
const registry=[['atlas-import','ATLAS_IMPORT'],['bitmap-resource-slot','BITMAP_RESOURCE_SLOT'],['bitmap-binding-ticket','BITMAP_BINDING_TICKET'],['linear-layout','LINEAR_LAYOUT']];
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
  ||registry.some(([name])=>file==='tools/'+name+'-types.mjs')||file==='tools/lib/file-identity.mjs'||/^tests\/types\/[A-Za-z0-9_.-]+\.(?:json|ts)$/.test(file)
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
 for(const [name,kind]of registry){
  const file='tests/types/'+name+'-diagnostic-expectations.json';
  requireThat(observe('repository','tools/'+name+'-types.mjs'),'Registered strict gate missing');
  const value=decode(root,file,observe('repository',file));
  requireThat(value.kind===kind+'_ACTUAL_STRICT_DIAGNOSTICS'&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&(name==='atlas-import'?!Object.hasOwn(value,'schemaVersion'):value.schemaVersion===1),'Unsupported registered diagnostic schema');
  for(const selector of name==='atlas-import'?['inputPins','sourcePolicy.jsoncPins']:['inputPins']){
   let list=value;for(const key of selector.split('.'))list=list?.[key];requireThat(Array.isArray(list)&&list.length>0,'Registered input list required');const seen=new Set();
   const rows=list.map(expected=>{
    pin(expected);requireThat(!seen.has(expected.path),'Duplicate declared input path');seen.add(expected.path);const location=target(expected.path);
    if(selector==='sourcePolicy.jsoncPins')requireThat(location.owner==='project-json','Atlas JSON parser owner required');
    const current=observe(location.owner,location.path),matches=current!==null&&current.bytes===expected.bytes&&current.sha256===expected.sha256;
    return {...location,expected,current,identity:current===null?'missing':matches?'same':'different'};
   });
   declarations.push({owner:file,selector,rows});
  }
 }
 const reverse=new Map();
 for(const group of declarations)for(const row of group.rows){
  const key=row.owner+':'+row.path;if(!reverse.has(key))reverse.set(key,{owner:row.owner,path:row.path,current:row.current,references:[]});
  reverse.get(key).references.push({declaration:group.owner,selector:group.selector,expected:row.expected,matches:row.identity==='same'});
 }
 const references=[...reverse.values()].sort((a,b)=>sort(a.owner+':'+a.path,b.owner+':'+b.path));
 for(const row of references)row.identity=row.current===null?'missing':row.references.every(x=>x.matches)?'same':'different';
 const inputs=[...observed.values()].sort((a,b)=>sort(a.owner+':'+a.path,b.owner+':'+b.path));
 for(const row of inputs)requireThat(equal(row.identity,optionalPin(owners[row.owner],row.path)),'Compiler input changed during collection');
 for(const dependency of dependencies)requireThat(equal(dependency.inventory,inventory(owners[dependency.owner])),'Dependency inventory changed during collection');
 requireThat(fs.realpathSync(selectedRoot)===root&&equal(resolution,resolveOwners(root)),'Compiler owner resolution changed during collection');
 return {schemaVersion:1,kind:'compiler-maintenance',status:'review-required',acceptance:'none',repository:root,resolution,dependencies,declarations,references,inputs,
  limits:['Four registered strict JSON inputPins lists and Atlas sourcePolicy.jsoncPins only','Observed Windows x64 dependency bundle; no host compatibility or compiler execution claim','Other JSON fields including nativeLibraryPins, compiler observations and diagnostics are byte-bound but not interpreted','No baseline update, diagnostic replay, version admission, browser or device acceptance']};
}
export function verifyCompilerProposal(root,proposal){
 requireThat(proposal?.kind==='compiler-maintenance'&&proposal.schemaVersion===1,'Compiler proposal required');
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
