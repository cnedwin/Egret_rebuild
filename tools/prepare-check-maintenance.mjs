// SPDX-License-Identifier: Apache-2.0
// Review preparation only. No baseline, catalog, gate or historical evidence is written.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,logicalPath,samePhysicalPath} from './lib/file-identity.mjs';

const repository=fileURLToPath(new URL('..',import.meta.url));
const names=['contracts','engine','project','runtime'];
const schedules=['tools/prepush.mjs','tools/test.mjs','tools/verify.mjs'];
const catalogFile='tools/incremental-test-catalog.json';
const registrations=[
 ['tools/spritesheet-boundary.mjs','graphPins'],
 ['tools/spritesheet-boundary.mjs','configurationPins'],
 ['tools/spritesheet-boundary.mjs','ss1AtlasGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','acceptedSnapshot','graph'],
 ['tools/browser-png-boundary.mjs','acceptedSnapshot','stablePins'],
 ['tools/browser-png-boundary.mjs','atlasGraphSuccessor'],
 ['tools/sequence-playback-boundary.mjs','seqpbPackages'],
 ['tools/sequence-playback-boundary.mjs','seqpbStableEntries'],
 ['tools/sequence-playback-boundary.mjs','seqpbConfigurations']
];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const samePin=(a,b)=>a===null||b===null?a===b:a.path===b.path&&a.bytes===b.bytes&&a.sha256===b.sha256;
function validPin(pin){
 if(!pin||!equal(Object.keys(pin).sort(),['bytes','path','sha256'])||!Number.isSafeInteger(pin.bytes)||pin.bytes<0||!/^[a-f0-9]{64}$/.test(pin.sha256))throw Error('Malformed raw identity');
 logicalPath(pin.path);return pin;
}
// Absence is data; spelling aliases, links and nonregular owners are always errors.
function present(root,file){
 logicalPath(file);let current=root;
 const parts=file.split('/');
 for(let i=0;i<parts.length;i++){
  const entries=fs.readdirSync(current),part=parts[i];
  if(!entries.includes(part)){
   if(entries.some(x=>x.toLowerCase()===part.toLowerCase()))throw Error('File spelling differs: '+file);
   return false;
  }
  current=path.join(current,part);const stat=fs.lstatSync(current);
  if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()))throw Error('Nonregular maintenance input: '+file);
 }
 return true;
}
function reader(root){
 const inputs=new Map();
 function pin(file){if(!inputs.has(file))inputs.set(file,present(root,file)?fingerprintFile(root,file):null);return inputs.get(file);}
 function text(file){
  const identity=pin(file);if(!identity)throw Error('Missing required maintenance input: '+file);
  const raw=fs.readFileSync(path.join(root,file));
  if(raw.length!==identity.bytes||createHash('sha256').update(raw).digest('hex')!==identity.sha256)throw Error('Input changed while reading '+file);
  return raw.toString('utf8');
 }
 function finish(){
  const rows=[...inputs].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,identity])=>({path:file,identity}));
  for(const row of rows)if(!equal(row.identity,present(root,row.path)?fingerprintFile(root,row.path):null))throw Error('Input changed during preparation: '+row.path);
  return rows;
 }
 for(const file of ['tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs'])text(file);
 return {pin,text,finish};
}
// This is a bounded preamble reader, not a JavaScript parser. Ambiguous raw
// occurrences and unsupported prefix syntax are refused, never evaluated.
function declaration(text,name){
 const matches=[...text.matchAll(new RegExp('\\bconst\\s+'+name+'\\b','g'))];
 if(matches.length!==1)throw Error('Missing or ambiguous declaration: '+name);
 const at=matches[0].index,prefix=text.slice(0,at),stack=[];
 const refuse=()=>{throw Error('Unsupported declaration preamble: '+name);};
 for(let i=0;i<prefix.length;){
  const c=prefix[i];
  if(prefix.startsWith('//',i)){const end=prefix.indexOf('\n',i+2);if(end<0)refuse();i=end+1;continue;}
  if(prefix.startsWith('/*',i)){const end=prefix.indexOf('*/',i+2);if(end<0)refuse();i=end+2;continue;}
  if(c==='"'||c==="'"){
   const quote=c;let closed=false;i++;
   for(;i<prefix.length;i++){
    if(prefix[i]==='\\'){i++;continue;}
    if(prefix[i]===quote){i++;closed=true;break;}
    if(prefix[i]==='\n'||prefix[i]==='\r')refuse();
   }
   if(!closed)refuse();continue;
  }
  // Regex, division, templates and escaped identifiers need a real parser;
  // these registered preambles do not use them outside ordinary literals.
  if(c==='/'||c===String.fromCharCode(96)||c==='\\')refuse();
  if('({['.includes(c))stack.push(c);
  if(')}]'.includes(c)&&stack.pop()!=={')':'(', '}':'{', ']':'['}[c])refuse();
  i++;
 }
 if(stack.length||!/^\s*$/.test(prefix.slice(prefix.lastIndexOf('\n')+1)))refuse();
 const match=text.slice(at).split(/\r?\n/,1)[0].match(new RegExp('^const\\s+'+name+'\\s*=\\s*(.*);\\s*$'));
 if(!match)throw Error('Unsupported JSON declaration: '+name);
 try{return JSON.parse(match[1]);}catch{throw Error('Unsupported JSON declaration: '+name);}
}
function codeInventory(root){
 const result=[];
 function walk(relative){
  // A synthetic child checks every directory component with the same path rules.
  present(root,relative+'/__egret_inventory_probe__');
  for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
   const file=relative+'/'+entry.name;logicalPath(file);
   if(entry.isSymbolicLink()||(!entry.isDirectory()&&!entry.isFile()))throw Error('Nonregular package inventory: '+file);
   if(entry.isDirectory())walk(file);else if(/\.(ts|js)$/.test(file))result.push(file);
  }
 }
 for(const name of names)for(const area of ['src','dist',...(name==='engine'?['web','rendering']:[])])walk('packages/'+name+'/'+area);
 return result.sort();
}
export function prepareBaselineReview(root){
 const read=reader(root),owners=new Map(),declarations=[];
 for(const [owner,binding,member]of registrations){
  if(!owners.has(owner))owners.set(owner,read.text(owner));
  const value=declaration(owners.get(owner),binding),pins=member?value[member]:value;
  if(!Array.isArray(pins))throw Error('Expected declared pin array: '+binding);
  const seen=new Set(),rows=pins.map(expected=>{
   validPin(expected);if(seen.has(expected.path))throw Error('Duplicate declared path: '+expected.path);seen.add(expected.path);
   const current=read.pin(expected.path);
   return {expected,current,identity:current===null?'missing':samePin(expected,current)?'same':'different'};
  });
  declarations.push({owner,binding:binding+(member?'.'+member:''),rows});
 }
 const inventory=codeInventory(root);for(const file of inventory)read.pin(file);
 const graphCoverage=[
  ['tools/spritesheet-boundary.mjs','graphPins','ss1AtlasGraphSuccessor'],
  ['tools/browser-png-boundary.mjs','acceptedSnapshot.graph','atlasGraphSuccessor']
 ].map(([owner,baseBinding,successorBinding])=>{
  const declared=new Set(declarations.filter(x=>x.owner===owner&&(x.binding===baseBinding||x.binding===successorBinding)).flatMap(x=>x.rows.map(row=>row.expected.path)));
  return {owner,baseBinding,successorBinding,unlisted:inventory.filter(file=>!declared.has(file)).map(file=>read.pin(file))};
 });
 const inputs=read.finish();if(!equal(inventory,codeInventory(root)))throw Error('Package inventory changed during preparation');
 return {schemaVersion:1,kind:'source-baseline',status:'review-required',scope:'Registered repository-owned declarations only; raw differences are not gate failures.',excluded:['Compiler dependency owners','Host base/current successor-pair evaluation','BRS/BBT/resource/atlas and other policies','Semantic/public/type/native acceptance'],declarations,graphCoverage,inventory,inputs};
}
function testNames(root){
 present(root,'tests/__egret_inventory_probe__');
 return fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x).sort();
}
export function prepareCatalogReview(root){
 const read=reader(root),old=JSON.parse(read.text(catalogFile));
 if(old.schemaVersion!==1||!equal(Object.keys(old.packages??{}).sort(),names)||!Array.isArray(old.tests)||!Array.isArray(old.policy)||!equal(old.policy.map(x=>x.path).sort(),schedules))throw Error('Unsupported catalog');
 const packages={},graph={};let stable=true;
 for(const name of names){
  const before=old.packages[name],file='packages/'+name+'/package.json';validPin(before.manifest);
  if(before.manifest.path!==file||!Array.isArray(before.dependencies))throw Error('Invalid package owner');
  const manifest=JSON.parse(read.text(file)),dependencies=Object.keys(manifest.dependencies??{}).filter(x=>x.startsWith('@egret/')).map(x=>x.slice(7)).sort();
  if(manifest.name!=='@egret/'+name||dependencies.some(x=>!names.includes(x)))throw Error('Unsupported package graph');
  packages[name]={manifest:read.pin(file),dependencies};graph[name]=dependencies;
  stable&&=samePin(before.manifest,read.pin(file))&&equal([...before.dependencies].sort(),dependencies);
 }
 const visiting=new Set(),visited=new Set();
 function visit(name){if(visiting.has(name))throw Error('Cyclic package graph');if(visited.has(name))return;visiting.add(name);graph[name].forEach(visit);visiting.delete(name);visited.add(name);}
 names.forEach(visit);
 const policy=old.policy.map(pin=>{validPin(pin);const current=read.pin(pin.path);if(!current)throw Error('Missing complete runner');stable&&=samePin(pin,current);return current;});
 const previous=new Map();
 for(const row of old.tests){
  validPin(row.file);if(!/^tests\/[A-Za-z0-9_-]+\.test\.mjs$/.test(row.file.path)||previous.has(row.file.path)||!Array.isArray(row.support))throw Error('Invalid test membership');
  if(row.packages!==null&&(!Array.isArray(row.packages)||!row.packages.length||new Set(row.packages).size!==row.packages.length||row.packages.some(x=>!names.includes(x))))throw Error('Invalid test ownership');
  const seen=new Set();for(const pin of row.support){validPin(pin);if(!pin.path.startsWith('tests/')||!pin.path.endsWith('.mjs')||seen.has(pin.path))throw Error('Invalid support owner');seen.add(pin.path);read.pin(pin.path);}
  previous.set(row.file.path,row);
 }
 const inventory=testNames(root),changes=[],tests=inventory.map(file=>{
  const current=read.pin(file);if(!current)throw Error('Test inventory changed');
  const before=previous.get(file),support=(before?.support??[]).map(pin=>read.pin(pin.path));
  const unchanged=before&&samePin(current,before.file)&&before.support.every((pin,i)=>samePin(pin,support[i]));
  const keep=stable&&unchanged;
  if(!keep)changes.push({path:file,reason:!stable?'package-or-schedule-changed':!before?'new-test':!samePin(current,before.file)?'test-changed':'support-changed-or-missing'});
  return {file:current,packages:keep?before.packages:null,support:support.filter(Boolean)};
 });
 const inputs=read.finish();if(!equal(inventory,testNames(root)))throw Error('Test inventory changed during preparation');
 return {schemaVersion:1,kind:'test-catalog',status:'review-required',catalog:{...old,packages,tests,policy},changes,removed:[...previous.keys()].filter(x=>!inventory.includes(x)).sort(),unavailable:inputs.filter(x=>x.identity===null).map(x=>x.path),inventory,inputs};
}
export function verifyMaintenanceProposal(root,proposal){
 if(proposal?.status!=='review-required')throw Error('Invalid maintenance proposal');
 const current=proposal.kind==='source-baseline'?prepareBaselineReview(root):proposal.kind==='test-catalog'?prepareCatalogReview(root):null;
 if(!current||!equal(current,proposal))throw Error('Maintenance proposal inputs or content changed');return true;
}
export function runMaintenance(args){
 if(args.length===1&&args[0]==='--baselines')return prepareBaselineReview(repository);
 if(args.length===1&&args[0]==='--catalog')return prepareCatalogReview(repository);
 if(args.length===2&&args[0]==='--check'){
  verifyMaintenanceProposal(repository,JSON.parse(fs.readFileSync(args[1],'utf8')));
  return {status:'current-inputs',acceptance:'none; independent review and complete gates remain required'};
 }
 throw Error('Usage: node tools/prepare-check-maintenance.mjs --baselines | --catalog | --check <proposal.json>');
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))console.log(JSON.stringify(runMaintenance(process.argv.slice(2)),null,2));
