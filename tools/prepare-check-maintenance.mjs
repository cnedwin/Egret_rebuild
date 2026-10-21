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
 ['tools/spritesheet-boundary.mjs','m11WarmSubmissionGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','m11WarmSubmissionGraphSuccessor'],
 ['tools/atlas-import-boundary.mjs','m11WarmSubmissionGraphSuccessor'],
 ['tools/spritesheet-boundary.mjs','m12IncrementalRenderingGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','m12IncrementalRenderingGraphSuccessor'],
 ['tools/atlas-import-boundary.mjs','m12IncrementalRenderingGraphSuccessor'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m12IncrementalOwnershipSuccessor'],
 ['tools/spritesheet-boundary.mjs','m13SharedRenderingGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','m13SharedRenderingGraphSuccessor'],
 ['tools/atlas-import-boundary.mjs','m13SharedRenderingGraphSuccessor'],
 ['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceRawSuccessor'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceRawSuccessor'],
 ['tools/sequence-playback-boundary.mjs','seqpbPackages'],
 ['tools/sequence-playback-boundary.mjs','seqpbStableEntries'],
 ['tools/sequence-playback-boundary.mjs','seqpbConfigurations']
];

// Only these complete reviewed source revisions permit post-preamble JSON reads.
const m13SourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":149677,"sha256":"5f4885f894b2b6d304a1f6c5fb685a86d28fbb510eb0335c615e71e2f65a4bae"},{"path":"tools/browser-png-boundary.mjs","bytes":151624,"sha256":"3a3db5f44bd79bc9f2ba11b393facd85533b52e93dbd17213076b8d6754d7ad4"},{"path":"tools/atlas-import-boundary.mjs","bytes":54233,"sha256":"6646d8fbf1a9baf248d4122195e5f3023c7c385470d876e106942ef828d2558b"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":29569,"sha256":"5bd40db8add4af6a15b0c5ce7415a77b663620984d074104c0849b6595390c6a"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":33706,"sha256":"65b356be737202f018b2c5cb1813538762e07af19c950b782fbbde782dbaa556"},{"path":"tools/sequence-playback-boundary.mjs","bytes":35428,"sha256":"898af8561932a01f5ba9b6de243feb6340557342e8d0a4afa171530e2ee531cd"}];
// Exact M1.4 source revisions preserve the previous sealed owners above.
const m14SourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":161018,"sha256":"ef34a3adf751069637682833caddd72efb7f1940a2d23e5cf2f1652eef5ecc75"},{"path":"tools/sequence-playback-boundary.mjs","bytes":36688,"sha256":"3a5cbef25992645aae0d3060a4680b1a496b0bb48a5ab10e671d0739932838d5"},{"path":"tools/browser-png-boundary.mjs","bytes":163335,"sha256":"ed175200cc2957f671b83b7082e98e6598018a9e636050ac9d305c8a3e8f0569"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":30824,"sha256":"ceedb70bb26730fd8bc44990d169f7ea5f25b8362daf4557ee853e46e592a277"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":34961,"sha256":"f57422e49f5197cd5c5ef66c76bc8cde2c6a36571b8bae5de9f89c24832591ab"},{"path":"tools/atlas-import-boundary.mjs","bytes":65640,"sha256":"d3994b788efa4e9eafeeed4a37f6ed4935af2946e7efc42ed35b9d9e4d5c6239"},{"path":"tools/browser-png-boundary.mjs","bytes":163653,"sha256":"0fa3391e5831ab6c2c9889622ffd51e36b678d2aa93822ff69b51b30679b4e33"}];
const m14GraphRegistrations = [["tools/spritesheet-boundary.mjs","m14WebGL2GraphSuccessor"],["tools/browser-png-boundary.mjs","m14WebGL2GraphSuccessor"],["tools/atlas-import-boundary.mjs","m14WebGL2GraphSuccessor"]];
const m13PairRegistrations = [
 ['tools/sequence-playback-boundary.mjs','m13SequenceInterfaceSuccessor','raw-pair-observation-only'],
 ['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceProjectedSuccessor','transformed-pair-raw-observation-only'],
 ['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceStableSuccessor','raw-pair-observation-only'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceProjectedSuccessor','transformed-pair-raw-observation-only'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceStableSuccessor','raw-pair-observation-only']
];
// Exact M1.5 sources and fixed JSON roles; historical owners remain unchanged.
const m15SourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":185549,"sha256":"d93ec76d594db2b7ca2173c933b80ff3d83630442619c9ae127db7ed9d51ff35"},{"path":"tools/browser-png-boundary.mjs","bytes":191515,"sha256":"d916154a3c50433ecb3faff4dd061fc51e7b772a4c6ab64e43d83920555f93bd"},{"path":"tools/atlas-import-boundary.mjs","bytes":90249,"sha256":"e3758e91108fe4b1f11dff391100f3de72e57032b96992bf69dd00d1d50fb4ac"},{"path":"tools/sequence-playback-boundary.mjs","bytes":43012,"sha256":"2d95757ddd9c3a6d1762fd44ba02461ef92504690f2e1e4c342a5f6d71f10a62"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":38244,"sha256":"1a4046d1bd5003714ca030ade053f412c98ca1f787d35357b823a12005e791a3"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":44823,"sha256":"690d56e1eb726d55990d6a8cd37b2215b1f3bb44430ca5c54abc67cdcffe8026"}];
// Exact cancellation-order successors retain all prior M1.5 source owners above.
const m15CancellationSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":185549,"sha256":"bfb4fb02f29cd66442a6f5124c1e209d87b305550ec5a48978c104f09163fb3f"},{"path":"tools/browser-png-boundary.mjs","bytes":191515,"sha256":"f04e493805cd21c45e753c4cf2ac3f876f2b16d9f5c9b2f9193293d662036094"},{"path":"tools/atlas-import-boundary.mjs","bytes":90249,"sha256":"4dee83aecfeb345647356ee3a8f5aef36e6b984333dcd8699ff40bfd7de6d581"}];
// Exact diagnostic-path successor; historical and cancellation-order owners remain unchanged.
const m15DiagnosticSourceOwners = [{"path":"tools/browser-png-boundary.mjs","bytes":191467,"sha256":"ce40f1363774bec52a053a5a0b2001aab2f3e4701b49e822e1a61097c7a4299d"}];
// Exact current preparation owners; every older source authority stays intact.
const m12PreparationSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":192441,"sha256":"ecab5b53ef95905ccc0d497d22ae21f0fdcdb722af9a131fcdc8f33a28322345"},{"path":"tools/browser-png-boundary.mjs","bytes":198282,"sha256":"76ff8a040936e5eace5eff3c94f3da733d512328f0fde507b958c8d32012413e"},{"path":"tools/atlas-import-boundary.mjs","bytes":97146,"sha256":"67b80c84cbfd35c511e739c6afb2d64c80ebe9abf03ecf54cdc68b3f3dc3c5f5"}];
const m12PreparationGraphRegistrations = [["tools/spritesheet-boundary.mjs","m12PreparationHotPathGraphSuccessor"],["tools/browser-png-boundary.mjs","m12PreparationHotPathGraphSuccessor"],["tools/atlas-import-boundary.mjs","m12PreparationHotPathGraphSuccessor"]];
const m15GraphRegistrations = [["tools/spritesheet-boundary.mjs","m15ResourceRecoveryGraphSuccessor"],["tools/browser-png-boundary.mjs","m15ResourceRecoveryGraphSuccessor"],["tools/atlas-import-boundary.mjs","m15ResourceRecoveryGraphSuccessor"]];
const m15PairRegistrations = [["tools/spritesheet-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15SequenceInterfaceSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15InterfaceRawSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15InterfaceProjectedSuccessor","transformed-pair-raw-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15InterfaceRawSuccessor","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15InterfaceProjectedSuccessor","transformed-pair-raw-observation-only"]];
// Explicit selectors keep historical transforms and third-party owners separate.
const policyRegistrations=[
 {owner:'tools/bitmap-resource-slot-boundary.mjs',binding:'policyPin',target:'tools/bitmap-resource-slot-policy.json',kind:'BITMAP_RESOURCE_SLOT_FINITE_INTERFACE_POLICY',selectors:['packages','configurations','stableEntries','oldRootPins','oldEngineDeclarationPin','workspacePins']},
 {owner:'tools/bitmap-binding-ticket-boundary.mjs',binding:'policyPin',target:'tools/bitmap-binding-ticket-policy.json',kind:'BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY',selectors:['packages','configurations','stableEntries','oldRootPins','oldEngineDeclarationPin','workspacePins','selectedProductPins']},
 {owner:'tools/atlas-import-boundary.mjs',binding:'inventoryPin',target:'tests/types/atlas-import-diagnostic-expectations.json',kind:'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS',selectors:['sourcePolicy.modules','sourcePolicy.configurationPins']}
];
// Parse JSON once, then reject duplicate decoded object keys at every depth.
export function uniqueJSON(text){
 const value=JSON.parse(text),tokens=text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g);let at=0;
 function visit(depth){
  if(depth>128)throw Error('Unsupported JSON nesting');
  const token=tokens[at++];
  if(token==='{'||token==='['){
   const end=token==='{'?'}':']',keys=new Set();
   while(tokens[at]!==end){
    if(token==='{'){const key=JSON.parse(tokens[at++]);if(keys.has(key))throw Error('Duplicate JSON key');keys.add(key);at++;}
    visit(depth+1);if(tokens[at]===',')at++;
   }at++;
  }
 }
 visit(0);return value;
}
function repositoryPin(pin){
 validPin(pin);const file=pin.path;
 const allowed=/^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file)
  ||/^tests\/types\/[A-Za-z0-9_.-]+\.json$/.test(file)
  ||/^packages\/(?:contracts|engine|project|runtime)\/(?:(?:src|dist|web|rendering|tests)\/.+\.(?:ts|js)|package\.json|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file);
 if(!allowed||file.split('/').some(x=>x.toLowerCase()==='node_modules'||x.startsWith('.')))throw Error('Unsupported repository pin owner: '+file);
 return pin;
}

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
 try{return uniqueJSON(match[1]);}catch{throw Error('Unsupported JSON declaration: '+name);}
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
 const read=reader(root),owners=new Map(),declarations=[],policyLinks=[],successorPairs=[];
 const ownerText=file=>{if(!owners.has(file))owners.set(file,read.text(file));return owners.get(file);};
 function registeredDeclaration(owner,binding){
  const text=ownerText(owner);
  try{return declaration(text,binding);}catch(cause){
   const allowed=registrations.some(row=>row[0]===owner&&row[1]===binding&&binding.startsWith('m13'))
    || m13PairRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m14GraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m15GraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m12PreparationGraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m15PairRegistrations.some(row=>row[0]===owner&&row[1]===binding);
   const reviewed=[...m13SourceOwners,...m14SourceOwners,...m15SourceOwners,...m15CancellationSourceOwners,...m15DiagnosticSourceOwners,...m12PreparationSourceOwners].filter(row=>row.path===owner);
   if(!allowed||!reviewed.some(row=>samePin(read.pin(owner),row)))throw cause;
   // Raw source authority precedes extraction; no caller-selected parser fallback.
   const lines=text.split(/\r?\n/).filter(line=>line.startsWith('const '+binding+' = '));
   if(lines.length!==1||!lines[0].endsWith(';'))throw Error('Missing or ambiguous reviewed M1.3 declaration');
   return uniqueJSON(lines[0].slice(('const '+binding+' = ').length,-1));
  }
 }
 const row=expected=>{const current=read.pin(expected.path);return {expected,current,identity:current===null?'missing':samePin(expected,current)?'same':'different'};};
 function add(owner,binding,pins,comparison='raw-identity'){
  if(!Array.isArray(pins))throw Error('Expected declared pin array: '+binding);
  const seen=new Set();for(const pin of pins){repositoryPin(pin);if(seen.has(pin.path))throw Error('Duplicate declared path: '+pin.path);seen.add(pin.path);}
  declarations.push({owner,binding,comparison,rows:pins.map(row)});
 }
 for(const [owner,binding,member]of registrations){
  if(!owners.has(owner))owners.set(owner,read.text(owner));
  const value=registeredDeclaration(owner,binding),pins=member?value[member]:value;
  if(!Array.isArray(pins))throw Error('Expected declared pin array: '+binding);
  const seen=new Set(),rows=pins.map(expected=>{
   validPin(expected);if(seen.has(expected.path))throw Error('Duplicate declared path: '+expected.path);seen.add(expected.path);
   const current=read.pin(expected.path);
   return {expected,current,identity:current===null?'missing':samePin(expected,current)?'same':'different'};
  });
  declarations.push({owner,binding:binding+(member?'.'+member:''),rows});
 }
 for(const spec of policyRegistrations){
  const expected=validPin(declaration(ownerText(spec.owner),spec.binding));
  if(expected.path!==spec.target)throw Error('Registered policy target path differs');
  policyLinks.push({owner:spec.owner,binding:spec.binding,row:row(expected)});
  const value=uniqueJSON(read.text(spec.target));
  if(value.kind!==spec.kind||(spec.binding==='policyPin'?value.schemaVersion!==1:value.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS'))throw Error('Unsupported policy schema: '+spec.target);
  for(const selector of spec.selectors){
   let pins=value;for(const part of selector.split('.')){if(!pins||!Object.hasOwn(pins,part))throw Error('Missing policy selector: '+selector);pins=pins[part];}
   const transformed=selector==='oldRootPins'||selector==='oldEngineDeclarationPin';
   add(spec.target,selector,selector==='oldEngineDeclarationPin'?[pins]:pins,transformed?'transformed-baseline-raw-observation':'raw-identity');
  }
 }
 for(const owner of ['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs']){
  const binding='imageResidencySuccessors',pairs=declaration(ownerText(owner),binding),seen=new Set();
  if(!Array.isArray(pairs))throw Error('Expected successor pair array');
  const rows=pairs.map(pair=>{
   if(!pair||!equal(Object.keys(pair).sort(),['base','current','path']))throw Error('Malformed successor pair');
   for(const arm of ['base','current'])if(!pair[arm]||!equal(Object.keys(pair[arm]).sort(),['bytes','sha256']))throw Error('Malformed successor arm');
   const base=repositoryPin({path:pair.path,...pair.base}),successor=repositoryPin({path:pair.path,...pair.current});
   if(seen.has(pair.path))throw Error('Duplicate successor path');seen.add(pair.path);
   const current=read.pin(pair.path),baseMatches=samePin(base,current),successorMatches=samePin(successor,current);
   return {path:pair.path,base,successor,current,identity:current===null?'missing':baseMatches&&successorMatches?'both':baseMatches?'base':successorMatches?'current':'neither'};
  });
  successorPairs.push({owner,binding,comparison:'raw-pair-observation-only',rows});
 }
 for(const [owner,binding,comparison]of [...m13PairRegistrations,...m15PairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding))]){
  const pairs=registeredDeclaration(owner,binding),seen=new Set();
  if(!Array.isArray(pairs))throw Error('Expected registered M1.3 pair array');
  const rows=pairs.map(pair=>{
   if(!pair||!equal(Object.keys(pair).sort(),['base','current']))throw Error('Malformed M1.3 successor pair');
   const base=repositoryPin(pair.base),successor=repositoryPin(pair.current);
   if(base.path!==successor.path||seen.has(base.path))throw Error('M1.3 successor path differs or repeats');seen.add(base.path);
   const current=read.pin(base.path),baseMatches=samePin(base,current),successorMatches=samePin(successor,current);
   return {path:base.path,base,successor,current,identity:current===null?'missing':baseMatches&&successorMatches?'both':baseMatches?'base':successorMatches?'current':'neither'};
  });
  successorPairs.push({owner,binding,comparison,rows});
 }
 // Historical owners without this later declaration remain readable as history.
 // Current post-preamble extraction still requires one exact reviewed raw owner.
 for(const [owner,binding]of [...m14GraphRegistrations,...m15GraphRegistrations,...m12PreparationGraphRegistrations]){
  if(!ownerText(owner).includes('const '+binding))continue;
  add(owner,binding,registeredDeclaration(owner,binding));
 }
 const inventory=codeInventory(root);for(const file of inventory)read.pin(file);
 const graphCoverage=[
  ['tools/spritesheet-boundary.mjs','graphPins','ss1AtlasGraphSuccessor','tools/spritesheet-boundary.mjs'],
  ['tools/browser-png-boundary.mjs','acceptedSnapshot.graph','atlasGraphSuccessor','tools/browser-png-boundary.mjs'],
  ['tests/types/atlas-import-diagnostic-expectations.json','sourcePolicy.modules',null,'tools/atlas-import-boundary.mjs']
 ].map(([owner,baseBinding,successorBinding,warmOwner])=>{
  const warmSuccessor={owner:warmOwner,binding:'m11WarmSubmissionGraphSuccessor'};
  const incrementalSuccessor={owner:warmOwner,binding:'m12IncrementalRenderingGraphSuccessor'};
  const sharedSuccessor={owner:warmOwner,binding:'m13SharedRenderingGraphSuccessor'};
  const webglSuccessor={owner:warmOwner,binding:'m14WebGL2GraphSuccessor'};
   const resourceRecoverySuccessor={owner:warmOwner,binding:'m15ResourceRecoveryGraphSuccessor'};
   const preparationHotPathSuccessor={owner:warmOwner,binding:'m12PreparationHotPathGraphSuccessor'};
  const declared=new Set(declarations.filter(x=>x.owner===owner&&(x.binding===baseBinding||x.binding===successorBinding)
   || x.owner===warmSuccessor.owner&&x.binding===warmSuccessor.binding
   || x.owner===incrementalSuccessor.owner&&x.binding===incrementalSuccessor.binding
   || x.owner===sharedSuccessor.owner&&x.binding===sharedSuccessor.binding
   || x.owner===webglSuccessor.owner&&x.binding===webglSuccessor.binding
    || x.owner===resourceRecoverySuccessor.owner&&x.binding===resourceRecoverySuccessor.binding
    || x.owner===preparationHotPathSuccessor.owner&&x.binding===preparationHotPathSuccessor.binding).flatMap(x=>x.rows.map(row=>row.expected.path)));
  return {owner,baseBinding,successorBinding,warmSuccessor,incrementalSuccessor,sharedSuccessor,webglSuccessor,resourceRecoverySuccessor,preparationHotPathSuccessor,unlisted:inventory.filter(file=>!declared.has(file)).map(file=>read.pin(file))};
 });
 // Many declarations can reference one path; retain every selector and pair arm.
 const byPath=new Map();
 function reference(expected,owner,binding,branch,comparison){
  if(!byPath.has(expected.path))byPath.set(expected.path,{path:expected.path,current:read.pin(expected.path),references:[]});
  byPath.get(expected.path).references.push({owner,binding,branch,comparison,expected});
 }
 for(const group of declarations)for(const item of group.rows)reference(item.expected,group.owner,group.binding,'expected',group.comparison??'raw-identity');
 for(const group of policyLinks)reference(group.row.expected,group.owner,group.binding,'expected','policy-owner-link');
 for(const group of successorPairs)for(const item of group.rows){reference(item.base,group.owner,group.binding,'base',group.comparison);reference(item.successor,group.owner,group.binding,'current',group.comparison);}
 const references=[...byPath.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const inputs=read.finish();if(!equal(inventory,codeInventory(root)))throw Error('Package inventory changed during preparation');
 return {schemaVersion:1,kind:'source-baseline',status:'review-required',scope:'Registered repository-owned declarations only; raw differences are not gate failures.',excluded:['Compiler and third-party dependency owners including Atlas inputPins/jsoncPins','Host group admission and inverse transforms, including package inverse evaluation','Resource-scene/atlas-frame multi-owner snapshots and other unregistered policies','Semantic/public/type/native acceptance'],declarations,policyLinks,successorPairs,graphCoverage,references,inventory,inputs};
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
