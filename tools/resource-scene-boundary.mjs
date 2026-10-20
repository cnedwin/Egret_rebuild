// SPDX-License-Identifier: Apache-2.0
// Bounded source collection only. No build, browser, Engine/host evaluation or HTML rewriting.
// Bootstrap, literal-module reader and dependency-owner admission are adapted from
// this repository's first-party tools/verify-bitmap-resource-slot.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const EXAMPLE='examples/resource-scene/';
const HELPER='tools/lib/file-identity.mjs';
const HELPER_SHA='999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569';
const MAP=Object.freeze({
  '@egret/engine':'../../packages/engine/dist/index.js',
  '@egret/engine/web':'../../packages/engine/dist/web/index.js',
  '@egret/engine/text':'../../packages/engine/dist/text.js',
  '@egret/engine/web/text':'../../packages/engine/dist/web/text.js',
  '@egret/engine/web/image':'../../packages/engine/dist/web/image.js',
  '@egret/engine/web/input':'../../packages/engine/dist/web/input.js',
  '@egret/engine/scene3d':'../../packages/engine/dist/rendering/scene3d.js',
  '@egret/engine/webgpu/scene3d':'../../packages/engine/dist/web/scene3d.js',
  '@egret/runtime':'../../packages/runtime/dist/index.js',
  '@egret/runtime/text':'../../packages/runtime/dist/text/index.js',
  '@egret/contracts':'../../packages/contracts/dist/index.js',
  '@egret/contracts/resources':'../../packages/contracts/dist/resources/index.js',
  '#egret-mouse-input':'../../packages/engine/dist/mouseInput.js',
  '#egret-textured-frame-state':'../../packages/engine/dist/internal/texturedFrameState.js',
  'robust-predicates':'../../packages/engine/node_modules/robust-predicates/index.js',
});
const PUBLIC=new Set(Object.keys(MAP).filter(key=>key.startsWith('@egret/engine')));
const APP_MODULES=new Set(['main.mjs','session.mjs','gpu-scene.mjs'].map(name=>EXAMPLE+name));
const APP_PUBLIC=new Map([
 [EXAMPLE+'main.mjs',new Set(['@egret/engine','@egret/engine/web','@egret/engine/web/image','@egret/engine/web/text','@egret/engine/web/input'])],
 [EXAMPLE+'session.mjs',new Set(['@egret/engine','@egret/engine/text'])],
 [EXAMPLE+'gpu-scene.mjs',new Set(['@egret/engine','@egret/engine/scene3d','@egret/engine/webgpu/scene3d'])],
]);
// Encoded originals are selected independently of the candidate's discovered files.
const FROZEN=[
 ['examples/resource-scene/assets/atlas-v1.png',130,'54f5a801227112caf56f4d3bef92d1018d19dddd85ca13b08099300a62532fdd'],
 ['examples/resource-scene/assets/atlas-v2.png',129,'006e69af587d0471da17b1fa5c40949ffc3f2ec21bab0ce4f73d77bd18e8fea2'],
 ['examples/resource-scene/assets/outfit-A.png',83,'376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960'],
 ['examples/resource-scene/assets/outfit-B.png',80,'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78'],
 ['examples/resource-scene/assets/outfit-C.png',81,'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66'],
 ['examples/resource-scene/assets/outfit-D.png',83,'d2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98'],
 ['tools/browser-png/assets/rgb-red-green.png',72,'917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d'],
 ['examples/canvas-text/assets/ahem.ttf',22572,'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc'],
 ['examples/canvas-text/assets/Ahem-README.txt',2456,'e5314468f94f7d9caf62bd8f6871ebf81c96827254043dac95814c943852d40e'],
 ['examples/canvas-text/assets/Ahem-COPYING.txt',1928,'3100f58a80de8fcd9dee4280dc4e52a45cc25a2084006e6b8fb5750708a388f8'],
 ['examples/resource-scene/assets/NotoSansSC-fixed.woff2',1796,'9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895'],
 ['examples/resource-scene/assets/NotoSansSC.source.css',348,'afa8bcf0f8a6d2e5b13ed4912a26083371abaad6163bbc564e6e3d88a83a24ed'],
 ['examples/resource-scene/assets/NotoSansSC-OFL.txt',4388,'1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9'],
];
const APP_EVIDENCE=[
 'tools/resource-scene-boundary.mjs','tools/resource-scene/oracle.mjs','tools/resource-scene/author-assets.mjs',
 'tests/resource-scene-boundary.test.mjs','tests/resource-scene-assets.test.mjs',
 'tests/resource-scene-session.test.mjs','tests/resource-scene-session-heldout.test.mjs',
 'tests/resource-scene-gpu.test.mjs','tests/resource-scene-browser-source.test.mjs',
];
function fail(code,message,cause){throw Object.assign(new Error(message,{cause}),{code});}
function absoluteInput(value){
  if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value))return false;
  if(process.platform!=='win32')return path.isAbsolute(value);
  return !/^(?:\\\\|\/\/)[?.](?:\\|\/)/.test(value)
    &&(/^[A-Za-z]:[\\/]/.test(value)||/^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(value));
}
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);

// The retained reader deliberately admits only the selected literal ESM subset.
// It skips comments/strings/regexes and refuses computed/options dynamic imports.
function moduleImports(source){
  const tokens=[];let at=0;
  while(at<source.length){
    const char=source[at];
    if(/\s/.test(char)){at++;continue;}
    if(source.slice(at,at+2)==='//'){const end=source.indexOf('\n',at+2);at=end<0?source.length:end;continue;}
    if(source.slice(at,at+2)==='/*'){const end=source.indexOf('*/',at+2);if(end<0)fail('RS_IMPORT','Unterminated comment');at=end+2;continue;}
    if(char==='"'||char==="'"){
      const quote=char,start=++at;
      while(at<source.length&&source[at]!==quote){if(source[at]==='\\')at++;at++;}
      if(at>=source.length)fail('RS_IMPORT','Unterminated string');
      tokens.push({kind:'string',value:source.slice(start,at++)});continue;
    }
    if(char==='`'){
      const start=++at;
      while(at<source.length&&source[at]!=='`'){if(source[at]==='\\')at++;at++;}
      if(at>=source.length||/\bimport\b/.test(source.slice(start,at)))fail('RS_IMPORT','Unsupported template import syntax');
      at++;tokens.push({kind:'template',value:''});continue;
    }
    if(char==='/'&&['(', '=', ':', ',', 'return', '[', '!', '?', '|', '&'].includes(tokens.at(-1)?.value)){
      at++;let bracket=false,finished=false;
      while(at<source.length){const next=source[at++];if(next==='\\'){at++;continue;}
        if(next==='[')bracket=true;if(next===']')bracket=false;
        if(next==='/'&&!bracket){finished=true;break;}}
      if(!finished)fail('RS_IMPORT','Unterminated regular expression');
      while(/[A-Za-z]/.test(source[at]??''))at++;
      tokens.push({kind:'regex',value:''});continue;
    }
    if(/[A-Za-z_$]/.test(char)){const start=at++;while(/[A-Za-z0-9_$]/.test(source[at]??''))at++;
      tokens.push({kind:'word',value:source.slice(start,at)});continue;}
    tokens.push({kind:'punctuation',value:char});at++;
  }
  const result=[];
  function literal(token,dynamic){
    if(token?.kind!=='string'||!token.value||/[\\\s%?:\0]/.test(token.value))fail('RS_IMPORT','Only simple literal imports are admitted');
    result.push({specifier:token.value,dynamic});
  }
  for(let index=0;index<tokens.length;index++){
    const token=tokens[index];if(token.kind!=='word')continue;
    if(token.value==='import'){
      const next=tokens[index+1];if(next?.value==='.')continue;
      if(next?.value==='('){literal(tokens[index+2],true);if(tokens[index+3]?.value!==')')fail('RS_IMPORT','Nonliteral/options dynamic import refused');}
      else if(next?.kind==='string')literal(next,false);
      else{let end=index+1;while(end<tokens.length&&!['from',';'].includes(tokens[end].value))end++;
        if(tokens[end]?.value!=='from')fail('RS_IMPORT','Unresolved static import');literal(tokens[end+1],false);}
    }else if(token.value==='export'&&['{','*'].includes(tokens[index+1]?.value)){
      let end=index+1;while(end<tokens.length&&!['from',';'].includes(tokens[end].value))end++;
      if(tokens[end]?.value==='from')literal(tokens[end+1],false);
    }
  }
  return result;
}

// Fixed authored entry policy is shared by source collection and metadata refusal controls.
export function validateResourceSceneEntries(metadata){
  for(const [name,target]of Object.entries(MAP)){
    if(name==='robust-predicates')continue;
    const internal=name.startsWith('#'),packageName=internal?'engine':name.split('/')[1];
    const prefix='../../packages/'+packageName+'/';
    const subpath=name==='@egret/'+packageName?'.':'./'+name.slice(('@egret/'+packageName+'/').length);
    const declaration=internal?metadata.engine.imports?.[name]:metadata[packageName].exports?.[subpath];
    const expected='./'+target.slice(prefix.length);
    if(!target.startsWith(prefix)||declaration?.import!==expected||declaration?.types!==expected.replace(/\.js$/,'.d.ts'))fail('RS_PACKAGE','Selected public/internal entry differs: '+name);
  }
}

/** Collect exact original bytes; callers must separately review the resulting snapshot. */
export async function collectResourceSceneSource({repository,applicationRoot=repository}={}){
  if(!absoluteInput(repository)||!absoluteInput(applicationRoot))fail('RS_OWNER','Full absolute input owners required');
  repository=fs.realpathSync(repository);applicationRoot=fs.realpathSync(applicationRoot);
  const physicalAPI=process.platform==='win32'?path.win32:path.posix;
  for(const root of [repository,applicationRoot]){
    const stat=fs.lstatSync(root);
    if(!stat.isDirectory()||stat.isSymbolicLink()||physicalAPI.relative(root,fs.realpathSync(root))!=='')fail('RS_OWNER','Canonical physical owner required');
  }
  // Authenticate the complete helper spelling and original raw bytes before import.
  let helperPath=repository;
  for(const [index,part]of HELPER.split('/').entries()){
    if(!fs.readdirSync(helperPath).includes(part))fail('RS_BOOTSTRAP','Helper spelling differs');
    helperPath=physicalAPI.join(helperPath,part);const stat=fs.lstatSync(helperPath);
    if(stat.isSymbolicLink()||(index<2?!stat.isDirectory():!stat.isFile()))fail('RS_BOOTSTRAP','Helper owner component differs');
  }
  if(physicalAPI.relative(repository,fs.realpathSync(helperPath)).split(physicalAPI.sep).join('/')!==HELPER)fail('RS_BOOTSTRAP','Helper has another physical owner');
  const helperURL=pathToFileURL(helperPath),helperRaw=fs.readFileSync(helperPath);
  if(physicalAPI.relative(helperPath,fileURLToPath(helperURL))!==''||helperRaw.length!==5065||hash(helperRaw)!==HELPER_SHA)fail('RS_BOOTSTRAP','File-identity bootstrap drift before import');
  const identity=await import(helperURL.href);
  const owners=new Map([['sdk',repository],['application',applicationRoot]]),inventory=new Map(),modules=new Map(),routes=new Map();
  let moduleBytes=0,routeBytes=0,foundationAdmission;
  function pinned(owner,relative,role){
    const root=owners.get(owner);let pin;
    try{pin=identity.fingerprintFile(root,relative);}catch(cause){fail('RS_INPUT','Missing or foreign input: '+owner+':'+relative,cause);}
    const bytes=fs.readFileSync(path.join(root,relative));
    if(bytes.length!==pin.bytes||hash(bytes)!==pin.sha256)fail('RS_INPUT','Input changed during read: '+relative);
    const key=owner+':'+relative,prior=inventory.get(key);
    if(prior&&(prior.bytes!==pin.bytes||prior.sha256!==pin.sha256))fail('RS_INPUT','Input drift: '+key);
    const roles=[...new Set([...(prior?.roles??[]),role])].sort();
    const record={owner,...pin,roles};inventory.set(key,record);return {pin:record,bytes};
  }
  function frozen(relative,bytes,sha256,role){
    const value=pinned('application',relative,role);
    if(value.pin.bytes!==bytes||value.pin.sha256!==sha256)fail('RS_FROZEN_INPUT','Frozen original differs: '+relative);
    return value;
  }
  function addRoute(url,bytes,contentType){
    if(routes.has(url))fail('RS_ROUTE','Duplicate route: '+url);
    routeBytes+=bytes.length;if(routeBytes>8_388_608)fail('RS_BUDGET','Served byte budget exceeded');
    routes.set(url,{bytes,contentType});
  }
  const routeFor=(owner,relative)=>'/'+(owner==='foundation'?'packages/engine/node_modules/robust-predicates/':'')+relative.split('/').map(encodeURIComponent).join('/');
  const html=pinned('application',EXAMPLE+'index.html','original-authored-html'),htmlText=decode(html.bytes);
  const scripts=[...htmlText.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const maps=scripts.filter(match=>/\btype\s*=\s*(?:"importmap"|'importmap'|importmap)(?:\s|$)/i.test(match[1]));
  if(maps.length!==1||maps[0][1]!==' type="importmap"')fail('RS_IMPORT_MAP','One canonical original import map required');
  let importMap;try{importMap=JSON.parse(maps[0][2]);}catch(cause){fail('RS_IMPORT_MAP','Invalid original import-map JSON',cause);}
  if(!exactKeys(importMap,['imports'])||!exactKeys(importMap.imports,Object.keys(MAP)))fail('RS_IMPORT_MAP','Import-map keys or scopes differ');
  for(const [name,value]of Object.entries(MAP))if(importMap.imports[name]!==value)fail('RS_IMPORT_MAP','Authored import-map target differs: '+name);
  // Selected names/values have no whitespace or escapes. This refuses duplicate keys.
  if(maps[0][2].replace(/\s/g,'')!==JSON.stringify(importMap))fail('RS_IMPORT_MAP','Import-map duplicate key or spelling differs');
  if(scripts.length!==2||scripts.filter(match=>match[1]===' type="module" src="./main.mjs"'&&match[2]==='').length!==1)fail('RS_HTML','Unselected application script authority');
  addRoute('/'+EXAMPLE+'index.html',html.bytes,'text/html; charset=utf-8');

  const metadata={};
  for(const name of ['engine','runtime','contracts']){
    metadata[name]=JSON.parse(pinned('sdk',`packages/${name}/package.json`,'package-dependency-contract').bytes);
    if(metadata[name].name!=='@egret/'+name)fail('RS_PACKAGE','Package identity differs: '+name);
  }
  const dependencies={engine:{'@egret/contracts':'workspace:*','@egret/runtime':'workspace:*','robust-predicates':'3.0.3'},runtime:{'@egret/contracts':'workspace:*'},contracts:{}};
  for(const name of Object.keys(metadata)){
    const actual=metadata[name].dependencies??{},expected=dependencies[name];
    if(!exactKeys(actual,Object.keys(expected))||Object.keys(expected).some(key=>actual[key]!==expected[key]))fail('RS_PACKAGE','Dependency contract differs: '+name);
  }
  validateResourceSceneEntries(metadata);
  for(const key of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json',
    'packages/engine/tsconfig.json','packages/engine/tsconfig.web.json','packages/engine/tsconfig.rendering.json',
    'packages/runtime/tsconfig.json','tools/build.mjs',HELPER,'LICENSE'])pinned('sdk',key,'build-or-source-provenance');
  const aliases=new Map(Object.entries(MAP).filter(([name])=>name!=='robust-predicates').map(([name,target])=>[name,['sdk',path.posix.normalize(path.posix.join(EXAMPLE,target))]]));
  function admitFoundation(){
    if(owners.has('foundation'))return;
    const alias='packages/engine/node_modules/robust-predicates';let physical=repository;
    for(const [index,part]of alias.split('/').entries()){
      if(!fs.readdirSync(physical).includes(part))fail('RS_FOUNDATION','Declared dependency spelling differs');
      physical=physicalAPI.join(physical,part);const stat=fs.lstatSync(physical);
      if(index<3&&(stat.isSymbolicLink()||!stat.isDirectory()))fail('RS_FOUNDATION','Dependency alias parent differs');
    }
    const root=fs.realpathSync(physical),stat=fs.lstatSync(root);
    if(!stat.isDirectory()||stat.isSymbolicLink()||physicalAPI.relative(root,fs.realpathSync(root))!=='')fail('RS_FOUNDATION','Canonical foundational owner required');
    owners.set('foundation',root);
    const info=JSON.parse(pinned('foundation','package.json','original-dependency-package').bytes);
    if(info.name!=='robust-predicates'||info.version!=='3.0.3')fail('RS_FOUNDATION','Unselected robust-predicates identity');
    pinned('foundation','LICENSE','original-dependency-rights');
    foundationAdmission={declaredBy:'sdk:packages/engine/package.json',alias,physicalOwner:root,name:info.name,version:info.version};
    aliases.set('robust-predicates',['foundation','index.js']);
  }
  function visit(owner,relative){
    identity.logicalPath(relative);const key=owner+':'+relative;if(modules.has(key))return modules.get(key);
    if(modules.size>=192||!(owner==='application'?APP_MODULES.has(relative):relative.endsWith('.js')))fail('RS_IMPORT','Unselected module: '+key);
    const input=pinned(owner,relative,'original-browser-module');moduleBytes+=input.bytes.length;
    if(moduleBytes>8_388_608)fail('RS_BUDGET','Browser module byte budget exceeded');
    const record={owner,path:relative,route:routeFor(owner,relative),bytes:input.pin.bytes,sha256:input.pin.sha256,edges:[]};modules.set(key,record);
    if(owner==='sdk'){
      const match=/^packages\/(engine|runtime|contracts)\/dist\/(.+)\.js$/.exec(relative);
      if(!match)fail('RS_IMPORT','Unselected first-party module location: '+relative);
      const tail=match[1]==='engine'&&/^(web|rendering)\//.test(match[2])?match[2]:'src/'+match[2];
      pinned('sdk',`packages/${match[1]}/${tail}.ts`,'first-party-source-counterpart');
      pinned('sdk',relative.replace(/\.js$/,'.d.ts'),'actual-emitted-declaration');
    }
    for(const edge of moduleImports(decode(input.bytes))){
      const {specifier,dynamic}=edge;let next;
      if(dynamic){
        const mainRecipe=owner==='application'&&relative===EXAMPLE+'main.mjs'&&specifier==='./gpu-scene.mjs';
        const sdkProtocol=owner==='sdk'&&relative==='packages/engine/dist/web/WebGPUHost.js'&&(specifier==='./b1.js'||specifier==='./sharedB1.js');
        if(!mainRecipe&&!sdkProtocol)fail('RS_IMPORT','Unselected dynamic import: '+key+' -> '+specifier);
      }
      if(/^\.\.?\//.test(specifier)){
        const file=path.resolve(owners.get(owner),path.dirname(relative),specifier);let target;
        try{target=identity.ownerRelativePath(owners.get(owner),file);}catch(cause){fail('RS_IMPORT','Relative module leaves its physical owner: '+specifier,cause);}
        next=[owner,target];
      }else{
        if(owner==='application'&&(!PUBLIC.has(specifier)||!APP_PUBLIC.get(relative).has(specifier)))fail('RS_IMPORT','Nonpublic or unselected application import: '+specifier);
        if(owner==='foundation')fail('RS_IMPORT','Foreign foundational bare import: '+specifier);
        if(specifier==='robust-predicates')admitFoundation();next=aliases.get(specifier);
      }
      if(!next)fail('RS_IMPORT','Unselected bare import: '+specifier);
      const dependency=visit(...next);record.edges.push({...edge,target:next.join(':'),route:dependency.route});
    }
    addRoute(record.route,input.bytes,'text/javascript; charset=utf-8');return record;
  }
  const main=visit('application',EXAMPLE+'main.mjs');
  const dynamic=main.edges.filter(edge=>edge.dynamic);
  if(dynamic.length!==1||dynamic[0].target!=='application:'+EXAMPLE+'gpu-scene.mjs')fail('RS_IMPORT','One explicit dynamic GPU recipe required');
  function closure(seed,includeDynamic){
    const found=new Set();function walk(record){const key=record.owner+':'+record.path;if(found.has(key))return;found.add(key);
      for(const edge of record.edges)if(includeDynamic||!edge.dynamic)walk(modules.get(edge.target));}
    walk(seed);return [...found].sort();
  }
  const closures={canvas:closure(main,false),gpu:closure(modules.get(dynamic[0].target),true),webgpu:closure(main,true)};
  if(closures.canvas.some(key=>key.startsWith('foundation:')||/gpu-scene\.mjs|WebGPU|webgpu|\/scene3d\.js|\/b1\.js/.test(key)))fail('RS_IMPORT','Static Canvas closure crossed a GPU/foundational boundary');
  for(const [name,target]of Object.entries(MAP)){
    const url=path.posix.normalize('/'+EXAMPLE+target);
    if(!routes.has(url))fail('RS_ROUTE','Original import-map target has no collected route: '+name);
  }
  for(const key of APP_EVIDENCE)pinned('application',key,'first-party-example-tool-or-test');
  const implementationOwner=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
  const implementation=identity.fingerprintFile(implementationOwner,'tools/resource-scene-boundary.mjs');
  const projectedImplementation=inventory.get('application:tools/resource-scene-boundary.mjs');
  if(implementation.bytes!==projectedImplementation.bytes||implementation.sha256!==projectedImplementation.sha256)fail('RS_INPUT','Projected collector source differs from the executing collector');
  frozen('tools/resource-scene/author-assets.mjs',9481,'b404bfdf936ffc6caffe0a99ba9fb1ae0288890ce9dce9649518462bb9f1c03f','selected-independent-asset-author');
  frozen('tools/resource-scene/oracle.mjs',5536,'cbe5e58f681d032eecfb726bbe6e18945d4488b818f7b932f3f4606cd2e0c887','selected-independent-asset-oracle');
  // Retained direct-Canvas references are tool evidence, never Main fetch routes.
  frozen('tools/resource-scene/reference/left.rgba',12288,'f972dbeb2c4d4f314b4ab922a4ec9afd7569ec156eb90c4757cf3a728bcee394','selected-raw-font-reference');
  frozen('tools/resource-scene/reference/right.rgba',12288,'941dc2c181e97c65da54d60969c27b140a8431abd75c4da8a10ff08d3569092b','selected-raw-font-reference');
  frozen('tools/resource-scene/reference/manifest.json',4364,'3fd92da19b29877da856e104d857b606305745baf280a9f3258d41a166247e8a','selected-font-reference-provenance');
  const provenance=frozen(EXAMPLE+'assets/provenance.json',6685,'5d1776c591bb05605ac19186736096d679908243fe64efa1ceafc1c4520d5b5c','unchanged-art-font-rights-provenance');
  addRoute('/'+EXAMPLE+'assets/provenance.json',provenance.bytes,'application/json; charset=utf-8');
  for(const [relative,size,sha]of FROZEN){
    const input=frozen(relative,size,sha,'selected-original-asset-or-rights');
    const type=relative.endsWith('.png')?'image/png':relative.endsWith('.ttf')?'font/ttf':relative.endsWith('.woff2')?'font/woff2':relative.endsWith('.css')?'text/css; charset=utf-8':'text/plain; charset=utf-8';
    addRoute('/'+relative,input.bytes,type);
  }
  // Final independent raw readback closes input mutation during collection.
  for(const before of inventory.values()){
    const after=identity.fingerprintFile(owners.get(before.owner),before.path);
    if(after.bytes!==before.bytes||after.sha256!==before.sha256)fail('RS_INPUT','Input changed before snapshot closure: '+before.owner+':'+before.path);
  }
  const snapshot={schemaVersion:1,kind:'RESOURCE_SCENE_SOURCE_SNAPSHOT_NO_BROWSER',sourceOnly:true,
    owners:Object.fromEntries(owners),helperBootstrap:{ownerRoot:repository,path:HELPER,bytes:5065,sha256:HELPER_SHA,physicalOwnerVerified:true,urlRoundTripVerified:true},
    collectorImplementation:{ownerRoot:implementationOwner,...implementation},
    foundationAdmission,authoredImportMap:importMap,servedOriginalHTML:{path:EXAMPLE+'index.html',bytes:html.pin.bytes,sha256:html.pin.sha256,rewritten:false},
    inventory:[...inventory.values()].sort((a,b)=>(a.owner+':'+a.path).localeCompare(b.owner+':'+b.path)),
    modules:[...modules.values()].sort((a,b)=>(a.owner+':'+a.path).localeCompare(b.owner+':'+b.path)),closures,
    routes:[...routes].map(([url,value])=>({url,bytes:value.bytes.length,sha256:hash(value.bytes),contentType:value.contentType})).sort((a,b)=>a.url.localeCompare(b.url)),
    limits:{modules:192,moduleBytes:8_388_608,servedBytes:8_388_608},moduleBytes,routeBytes,
    acceptance:{independentSourceReviewRequired:true,browserExecuted:false,nativeOrPerformanceAcceptance:false,conditionalImportControlFlowProven:false}};
  return {snapshot,routes};
}

async function cli(){
  if(process.argv.length===2){
    // Default verification neither persists nor approves a source snapshot.
    const repository=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
    const {snapshot}=await collectResourceSceneSource({repository});
    console.log(JSON.stringify({status:'SOURCE_BOUNDARY_PASS',modules:snapshot.modules.length,
      inputFiles:snapshot.inventory.length,canvasModules:snapshot.closures.canvas.length,
      gpuModules:snapshot.closures.gpu.length,routes:snapshot.routes.length,sourceOnly:true,snapshotWritten:false}));
    return;
  }
  const args=new Map();
  for(let index=2;index<process.argv.length;index++){
    const key=process.argv[index],value=process.argv[++index];
    if(!['--repository','--application-root','--snapshot'].includes(key)||args.has(key)||!absoluteInput(value))fail('RS_CLI','Unique full absolute named arguments required');
    args.set(key,value);
  }
  if(!args.has('--repository')||!args.has('--snapshot'))fail('RS_CLI','--repository and --snapshot required');
  const {snapshot}=await collectResourceSceneSource({repository:args.get('--repository'),applicationRoot:args.get('--application-root')??args.get('--repository')});
  const target=path.join(fs.realpathSync(path.dirname(args.get('--snapshot'))),path.basename(args.get('--snapshot')));
  const helperRaw=fs.readFileSync(path.join(snapshot.owners.sdk,HELPER));
  if(helperRaw.length!==5065||hash(helperRaw)!==HELPER_SHA)fail('RS_BOOTSTRAP','Helper drift before CLI output validation');
  const identity=await import(pathToFileURL(path.join(snapshot.owners.sdk,HELPER)).href);
  for(const root of Object.values(snapshot.owners)){
    if(identity.samePhysicalPath(root,target))fail('RS_CLI','Snapshot output belongs to an input owner');
    let inside=false;try{identity.ownerRelativePath(root,target);inside=true;}catch{}
    if(inside)fail('RS_CLI','Snapshot output belongs to an input owner');
  }
  fs.writeFileSync(target,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
  const bytes=fs.readFileSync(target);
  console.log(JSON.stringify({status:'SOURCE_SNAPSHOT_ONLY_NO_BROWSER',path:target,bytes:bytes.length,sha256:hash(bytes),modules:snapshot.modules.length}));
}
if(process.argv[1]&&pathToFileURL(fs.realpathSync(process.argv[1])).href===import.meta.url){
  try{await cli();}catch(cause){console.error(cause);process.exitCode=1;}
}
