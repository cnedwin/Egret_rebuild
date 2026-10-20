// SPDX-License-Identifier: Apache-2.0
// Closed source collection; never evaluates product modules or launches a browser.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
export const HASH=bytes=>createHash('sha256').update(bytes).digest('hex');
export const requireThat=(value,message)=>{if(!value)throw new Error(message);};
export const equal=(actual,expected,message)=>requireThat(JSON.stringify(actual)===JSON.stringify(expected),message);
export const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
export const decode=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
export function strictJSON(raw){
  const text=decode(raw);let at=0;
  const ws=()=>{while(/\s/.test(text[at]??'')&&at<text.length)at++;};
  function string(){const start=at++;while(at<text.length){if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(start,at));}throw new Error('Unterminated JSON string');}
  function visit(){ws();const next=text[at];
    if(next==='{'||next==='['){const object=next==='{',end=object?'}':']',keys=new Set();at++;ws();if(text[at]===end){at++;return;}
      while(at<text.length){if(object){ws();requireThat(text[at]==='"','JSON own key required');const key=string();requireThat(!keys.has(key),'Duplicate JSON own key');keys.add(key);ws();requireThat(text[at++]===':','JSON colon required');}
        visit();ws();if(text[at]===end){at++;return;}requireThat(text[at++]===',','JSON separator required');}
      throw new Error('Unterminated JSON collection');
    }
    if(next==='"'){string();return;}
    const start=at;while(at<text.length&&!/[\s,\]}]/.test(text[at]))at++;requireThat(at>start,'JSON value required');JSON.parse(text.slice(start,at));
  }
  visit();ws();requireThat(at===text.length,'Trailing JSON input');return JSON.parse(text);
}
export function parseCollectorArguments(args){
  const values=new Map();let snapshotOnly=false;
  for(let at=0;at<args.length;at++){
    const key=args[at];if(key==='--snapshot-only'){requireThat(!snapshotOnly,'Duplicate snapshot flag');snapshotOnly=true;continue;}
    requireThat(['--config','--config-sha256'].includes(key)&&!values.has(key)&&args[at+1]&&!args[at+1].startsWith('--'),'Exact unique collector arguments required');
    values.set(key,args[++at]);
  }
  requireThat(values.size===2&&absolute(values.get('--config'))&&/^[a-f0-9]{64}$/.test(values.get('--config-sha256')??''),'Pinned absolute config and raw SHA256 required');
  return {configPath:values.get('--config'),configSha256:values.get('--config-sha256'),snapshotOnly};
}
export function validateConfig(value){
  if(value?.schemaVersion===2)return validateImportConfig(value);
  requireThat(exactKeys(value,['schemaVersion','repositoryRoot','taskRoot','snapshot','output','playwrightRoot','nativeScenario','closures','fixture','oracle'])&&value.schemaVersion===1,'Exact config schema required');
  for(const key of ['repositoryRoot','taskRoot','snapshot','output','playwrightRoot'])requireThat(absolute(value[key]),'Absolute config path required '+key);
  requireThat(exactKeys(value.nativeScenario,['profile','kind'])&&['canvas-2d','webgpu-textured-2d'].includes(value.nativeScenario.profile)
    &&['ordinary','rotation-sign','trim-y-constant'].includes(value.nativeScenario.kind),'Exact scenario required');
  requireThat(exactKeys(value.fixture,['path','route','exportName','bytes','sha256'])&&absolute(value.fixture.path)
    &&value.fixture.route==='/tools/atlas-frame/native-fixture.mjs'&&value.fixture.exportName==='runAtlasFrameNativeFixture','Fixed fixture entry required');
  requireThat(exactKeys(value.oracle,['path','bytes','sha256'])&&absolute(value.oracle.path),'Exact oracle entry required');
  for(const record of [value.fixture,value.oracle])requireThat(Number.isSafeInteger(record.bytes)&&record.bytes>0&&/^[a-f0-9]{64}$/.test(record.sha256),'Exact raw file pin required');
  const roles=value.nativeScenario.kind==='ordinary'?['healthy']:['healthy','assigned'];
  requireThat(Array.isArray(value.closures)&&value.closures.length===roles.length,'Exact closure count required');
  value.closures.forEach((row,index)=>requireThat(exactKeys(row,['role','repositoryRoot'])&&row.role===roles[index]&&absolute(row.repositoryRoot),'Ordered fixed owner roles required'));
  requireThat(value.closures[0].repositoryRoot===value.repositoryRoot,'Top repository must be healthy');return value;
}
export const APP='examples/trimmed-atlas-playback/';
export const HELPER='tools/lib/file-identity.mjs';
export const HELPER_PIN={bytes:5065,sha256:'999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569'};
// Exact installed build owners only. Compiler-only packages never acquire HTTP routes.
export const BUILD_PACKAGES=Object.freeze([
  Object.freeze({alias:'node_modules/typescript',owner:'compiler',name:'typescript',version:'7.0.2',purpose:'compiler-wrapper'}),
  Object.freeze({alias:'node_modules/@typescript/typescript-win32-x64',owner:'compiler-native',name:'@typescript/typescript-win32-x64',version:'7.0.2',purpose:'compiler-native-win32-x64'}),
  Object.freeze({alias:'node_modules/jsonc-parser',owner:'project-json',name:'jsonc-parser',version:'3.3.1',purpose:'project-build-dependency'}),
  Object.freeze({alias:'packages/engine/node_modules/robust-predicates',owner:'foundation',name:'robust-predicates',version:'3.0.3',purpose:'engine-rendering-dependency'}),
]);
export const WORKSPACE_ALIASES=Object.freeze(['contracts','runtime','engine','project'].map(name=>
  Object.freeze({alias:'node_modules/@egret/'+name,workspace:name})));
export function validateBuildPackage(selected,metadata){
  requireThat(BUILD_PACKAGES.includes(selected)&&metadata?.name===selected.name&&metadata.version===selected.version,'Exact reviewed installed build package required');
  requireThat(Object.keys(metadata.dependencies??{}).length===0,'Unreviewed installed build transitive dependency');
  if(selected.owner==='compiler')requireThat(metadata.optionalDependencies?.['@typescript/typescript-win32-x64']==='7.0.2','Wrapper-selected native compiler version differs');
  if(selected.owner==='compiler-native'){
    equal(metadata.os,['win32'],'Native compiler OS differs');equal(metadata.cpu,['x64'],'Native compiler architecture differs');
  }
  if(selected.owner==='project-json')requireThat(metadata.main==='./lib/umd/main.js'&&metadata.typings==='./lib/umd/main.d.ts','Selected jsonc runtime/type entries differ');
}
export const IMPORTS=Object.freeze({
  '@egret/engine':'../../packages/engine/dist/index.js',
  '@egret/engine/web':'../../packages/engine/dist/web/index.js',
  '@egret/engine/webgpu':'../../packages/engine/dist/web/webgpu.js',
  '@egret/runtime':'../../packages/runtime/dist/index.js',
  '@egret/contracts':'../../packages/contracts/dist/index.js',
  '@egret/contracts/resources':'../../packages/contracts/dist/resources/index.js',
  '#egret-mouse-input':'../../packages/engine/dist/mouseInput.js',
  '#egret-textured-frame-state':'../../packages/engine/dist/internal/texturedFrameState.js',
  'robust-predicates':'../../packages/engine/node_modules/robust-predicates/index.js',
});
// Fixed authored entry policy is shared by source collection and metadata refusal controls.
export function validateAtlasFrameEntries(rootMetadata){
  const aliasTargets=new Map(Object.entries(IMPORTS).map(([name,target])=>[name,name==='robust-predicates'?['foundation','index.js']:
    ['repository',path.posix.normalize(path.posix.join(APP,target))]]));
  for(const [name,target]of aliasTargets){
    if(name==='robust-predicates')continue;
    const packageName=name.startsWith('#')?'engine':name.split('/')[1];
    const subpath=name==='@egret/'+packageName?'.':'./'+name.slice(('@egret/'+packageName+'/').length);
    const metadata=name.startsWith('#')?rootMetadata.engine.imports?.[name]:rootMetadata[packageName].exports?.[subpath];
    const expected='./'+target[1].slice(('packages/'+packageName+'/').length);
    requireThat(metadata?.import===expected&&metadata?.types===expected.replace(/\.js$/,'.d.ts'),'Public entry/alias declaration differs '+name);
  }
  return aliasTargets;
}
export const PUBLIC_TEXT=Object.freeze([
  APP+'session.mjs',APP+'image.mjs',APP+'main.mjs',APP+'index.html',APP+'README.md',APP+'README.zh-CN.md',
  'tools/verify-atlas-frame.mjs','tools/atlas-frame/boundary.mjs','tools/atlas-frame/scenario.mjs',
  'tools/atlas-frame/native-fixture.mjs','tools/atlas-frame/prepare-native.mjs',
  'tests/atlas-frame-native-source.test.mjs','tests/atlas-frame-boundary.test.mjs',
  'tests/atlas-frame-session.test.mjs',
]);
const ASSETS=[
  ['tools/atlas-frame/author-assets.mjs',4365,'83e56a9f0d855d545d787a4bfa88c46df055709ff20d99c95141575a53422d44'],
  ['tools/atlas-frame/oracle.mjs',4036,'7d5e5f1418bd030d455024de4f31499fd6bd34b5bc5779baac06d792c9ab2c16'],
  ['tests/atlas-frame-oracle-unit.test.mjs',7646,'8fa63ee86daf2b38cb1fc890075eb465ef81c5ab436d895ecd64650b1b189e8b'],
  [APP+'assets/atlas.png',218,'35a3ecea0d79c5684d17a5dbfa56bf0cc5ebf52a34f6e8ceafe740c742a1437f'],
  [APP+'assets/provenance.json',2092,'da7ffd5e9a2650522ed55922ba3f72c14af58216c13118f53a7820e624430f3c'],
];
export function absolute(value){return typeof value==='string'&&path.isAbsolute(value)&&!/[\x00-\x1f\x7f]/.test(value)
  &&(process.platform!=='win32'||!/^(?:\\\\|\/\/)[?.]/.test(value));}
export async function authenticateIdentity(repository){
  requireThat(absolute(repository),'Absolute repository owner required');
  requireThat(!fs.lstatSync(repository).isSymbolicLink()&&fs.lstatSync(repository).isDirectory(),'Regular physical owner required');
  let current=repository;
  for(const [index,part] of HELPER.split('/').entries()){
    requireThat(fs.readdirSync(current).includes(part),'Bootstrap authored spelling differs');current=path.join(current,part);
    const stat=fs.lstatSync(current);requireThat(!stat.isSymbolicLink()&&(index<2?stat.isDirectory():stat.isFile()),'Bootstrap component refused');
  }
  const raw=fs.readFileSync(current);equal({bytes:raw.length,sha256:HASH(raw)},HELPER_PIN,'Authenticated helper raw bytes differ');
  const identity=await import(pathToFileURL(current).href);
  requireThat(identity.samePhysicalPath(repository,fs.realpathSync(repository))&&identity.samePhysicalPath(current,fs.realpathSync(current)),'Bootstrap real owner differs');
  return identity;
}
export function readPinned(identity,owner,relative,pin){
  const actual=identity.fingerprintFile(owner,relative),raw=fs.readFileSync(path.join(owner,relative));
  equal({bytes:raw.length,sha256:HASH(raw)},{bytes:actual.bytes,sha256:actual.sha256},'Input drift while reading '+relative);
  if(pin)equal({bytes:actual.bytes,sha256:actual.sha256},{bytes:pin.bytes,sha256:pin.sha256},'Frozen bytes differ '+relative);
  return {pin:actual,raw};
}
export function inventoryTree(identity,owner,relative=''){
  const files=[];
  function visit(key){for(const entry of fs.readdirSync(path.join(owner,key),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const next=key?key+'/'+entry.name:entry.name;
    requireThat(!entry.isSymbolicLink(),'Symbolic package/input member refused '+next);
    if(entry.isDirectory())visit(next);else{requireThat(entry.isFile(),'Nonregular package/input member '+next);files.push(readPinned(identity,owner,next).pin);}
  }}visit(relative);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
function refuse(message){throw new Error(message);}
export function moduleImports(source){
  const tokens=[];let at=0;
  while(at<source.length){
    const char=source[at];
    if(/\s/.test(char)){at++;continue;}
    if(source.slice(at,at+2)==='//'){const end=source.indexOf('\n',at+2);at=end<0?source.length:end;continue;}
    if(source.slice(at,at+2)==='/*'){const end=source.indexOf('*/',at+2);if(end<0)refuse('Unterminated comment');at=end+2;continue;}
    if(char==='"'||char==="'"){
      const quote=char,start=++at;
      while(at<source.length&&source[at]!==quote){if(source[at]==='\\')at++;at++;}
      if(at>=source.length)refuse('Unterminated string');
      tokens.push({kind:'string',value:source.slice(start,at++)});continue;
    }
    if(char==='`'){
      const start=++at;
      while(at<source.length&&source[at]!=='`'){if(source[at]==='\\')at++;at++;}
      if(at>=source.length||/\bimport\b/.test(source.slice(start,at)))refuse('Unsupported template import syntax');
      at++;tokens.push({kind:'template',value:''});continue;
    }
    if(char==='/'&&['(', '=', ':', ',', 'return', '[', '!', '?', '|', '&'].includes(tokens.at(-1)?.value)){
      at++;let bracket=false,finished=false;
      while(at<source.length){const next=source[at++];if(next==='\\'){at++;continue;}
        if(next==='[')bracket=true;if(next===']')bracket=false;
        if(next==='/'&&!bracket){finished=true;break;}}
      if(!finished)refuse('Unterminated regular expression');
      while(/[A-Za-z]/.test(source[at]??''))at++;
      tokens.push({kind:'regex',value:''});continue;
    }
    if(/[A-Za-z_$]/.test(char)){const start=at++;while(/[A-Za-z0-9_$]/.test(source[at]??''))at++;
      tokens.push({kind:'word',value:source.slice(start,at)});continue;}
    tokens.push({kind:'punctuation',value:char});at++;
  }
  const result=[];
  function literal(token,dynamic){
    if(token?.kind!=='string'||!token.value||/[\\\s%?:\0]/.test(token.value))refuse('Only simple literal imports are admitted');
    result.push({specifier:token.value,dynamic});
  }
  for(let index=0;index<tokens.length;index++){
    const token=tokens[index];if(token.kind!=='word')continue;
    if(['eval','Function','Worker','SharedWorker','importScripts','require'].includes(token.value)&&tokens[index+1]?.value==='(')
      refuse('Unbounded code/module construction refused');
    if(token.value==='import'){
      const next=tokens[index+1];if(next?.value==='.')continue;
      if(next?.value==='('){literal(tokens[index+2],true);if(tokens[index+3]?.value!==')')refuse('Nonliteral/options dynamic import refused');}
      else if(next?.kind==='string')literal(next,false);
      else{let end=index+1;while(end<tokens.length&&!['from',';'].includes(tokens[end].value))end++;
        if(tokens[end]?.value!=='from')refuse('Unresolved static import');literal(tokens[end+1],false);}
    }else if(token.value==='export'&&['{','*'].includes(tokens[index+1]?.value)){
      let end=index+1;while(end<tokens.length&&!['from',';'].includes(tokens[end].value))end++;
      if(tokens[end]?.value==='from')literal(tokens[end+1],false);
    }
  }
  return result;
}
export async function collectAtlasFrameSource(repository,kind='ordinary'){
  const importer=kind==='atlas-import-v1';
  requireThat(importer||['ordinary','rotation-sign','trim-y-constant'].includes(kind),'Exact collection selector');
  const identity=await authenticateIdentity(repository),owners=new Map([['repository',repository]]),files=new Map(),routes=new Map(),modules=new Map();
  const aliases=[],read=(owner,relative,pin)=>{const value=readPinned(identity,owners.get(owner),relative,pin);files.set(owner+':'+relative,{owner,...value.pin});return value;};
  const addRoute=(route,raw,contentType)=>{
    requireThat(!routes.has(route),'Duplicate selected route '+route);routes.set(route,{bytes:raw,contentType});
  };
  const rootMetadata={};
  for(const key of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json','tools/build.mjs',
    'tools/generate-project-format.mjs',HELPER,'AGENTS.md','LICENSE',...PUBLIC_TEXT,...(importer?IMPORT_TEXT:[])])read('repository',key);
  read('repository','tests/helpers.mjs',{bytes:997,sha256:'20e7dd30f54b3a81d35f666c8370e7f014e4559c68222727bc88fd377efc1af7'});
  for(const name of ['contracts','runtime','engine','project']){
    const base='packages/'+name;
    rootMetadata[name]=JSON.parse(decode(read('repository',base+'/package.json').raw));
    for(const entry of fs.readdirSync(path.join(repository,base)))if(/^tsconfig(?:\.[a-z]+)?\.json$/.test(entry))read('repository',base+'/'+entry);
    for(const entry of fs.readdirSync(path.join(repository,base)))if(/^tsconfig(?:\.[a-z]+)?\.tsbuildinfo$/.test(entry))read('repository',base+'/'+entry);
    for(const directory of ['src','web','rendering','schema','dist']){
      if(!fs.existsSync(path.join(repository,base,directory)))continue;
      for(const pin of inventoryTree(identity,repository,base+'/'+directory))files.set('repository:'+pin.path,{owner:'repository',...pin});
    }
  }
  equal(rootMetadata.engine.dependencies,{'@egret/contracts':'workspace:*','@egret/runtime':'workspace:*','robust-predicates':'3.0.3'},'Engine dependency contract differs');
  equal(rootMetadata.runtime.dependencies,{'@egret/contracts':'workspace:*'},'Runtime dependency contract differs');
  equal(rootMetadata.contracts.dependencies??{},{},'Contracts dependency contract differs');
  equal(rootMetadata.project.dependencies,{'@egret/contracts':'workspace:*','jsonc-parser':'3.3.1'},'Project build dependency contract differs');
  function externalPackage(alias,owner,name,version){
    // Only these named package aliases can cross physical owners; their entire resolved package is sealed.
    identity.logicalPath(alias);let current=repository;
    for(const [index,part] of alias.split('/').entries()){
      requireThat(fs.readdirSync(current).includes(part),'Dependency alias spelling differs '+alias);current=path.join(current,part);
      if(index<alias.split('/').length-1)requireThat(!fs.lstatSync(current).isSymbolicLink()&&fs.lstatSync(current).isDirectory(),'Alias parent is symbolic');
    }
    const physicalOwner=fs.realpathSync(current);requireThat(!fs.lstatSync(physicalOwner).isSymbolicLink(),'Resolved package link refused');owners.set(owner,physicalOwner);
    const packageInput=read(owner,'package.json'),meta=JSON.parse(decode(packageInput.raw));
    requireThat(meta.name===name&&meta.version===version,'Exact package name/version differs '+alias);
    for(const pin of inventoryTree(identity,physicalOwner))files.set(owner+':'+pin.path,{owner,...pin});
    aliases.push({alias,physicalOwner,name,version,link:fs.lstatSync(current).isSymbolicLink()});return meta;
  }
  requireThat(process.platform==='win32'&&process.arch==='x64','Only reviewed installed Windows x64 compiler closure admitted');
  const packageMetadata=new Map();
  for(const entry of BUILD_PACKAGES){const meta=externalPackage(entry.alias,entry.owner,entry.name,entry.version);validateBuildPackage(entry,meta);packageMetadata.set(entry.owner,meta);}
  requireThat(packageMetadata.get('compiler').optionalDependencies?.['@typescript/typescript-win32-x64']==='7.0.2','Wrapper-selected native compiler version differs');
  equal(packageMetadata.get('compiler-native').os,['win32'],'Native compiler OS differs');
  equal(packageMetadata.get('compiler-native').cpu,['x64'],'Native compiler architecture differs');
  requireThat(packageMetadata.get('project-json').main==='./lib/umd/main.js'&&packageMetadata.get('project-json').typings==='./lib/umd/main.d.ts'
    &&Object.keys(packageMetadata.get('project-json').dependencies??{}).length===0,'Selected jsonc package entry/dependencies differ');
  const buildResolutions=[];
  for(const selected of [
    {from:'node_modules/typescript/lib/getExePath.js',specifier:'@typescript/typescript-win32-x64/package.json',owner:'compiler-native',entry:'package.json'},
    {from:'packages/project/src/json-foundation.ts',specifier:'jsonc-parser',owner:'project-json',entry:'lib/umd/main.js'},
    {from:'packages/engine/rendering/packedOrientation.ts',specifier:'robust-predicates',owner:'foundation',entry:'index.js'},
  ]){
    const resolved=fs.realpathSync(createRequire(pathToFileURL(path.join(repository,selected.from))).resolve(selected.specifier));
    requireThat(identity.samePhysicalPath(resolved,path.join(owners.get(selected.owner),selected.entry)),'Actual installed build resolution differs '+selected.specifier);
    buildResolutions.push({...selected,resolved,physicalOwner:owners.get(selected.owner),pin:read(selected.owner,selected.entry).pin});
  }
  read('compiler-native','lib/tsc.exe');read('project-json','lib/umd/main.d.ts');
  for(const {alias,workspace:name} of WORKSPACE_ALIASES){
    const target=path.join(repository,alias);
    requireThat(fs.existsSync(target)&&identity.samePhysicalPath(fs.realpathSync(target),path.join(repository,'packages',name)),'Clone-owned workspace alias differs '+alias);
    aliases.push({alias,physicalOwner:fs.realpathSync(target),workspace:name});
  }
  for(const [relative,bytes,sha256] of ASSETS){const input=read('repository',relative,{bytes,sha256});
    if(relative.startsWith(APP+'assets/')&&(!importer||relative.endsWith('.png')))addRoute('/'+relative,input.raw,relative.endsWith('.png')?'image/png':'application/json; charset=utf-8');}
  const htmlInput=read('repository',APP+'index.html'),html=decode(htmlInput.raw);
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  requireThat(scripts.length===2&&scripts[0][1]===' type="importmap"'&&scripts[1][1]===' type="module" src="./main.mjs"'&&scripts[1][2]==='','Fixed authored HTML scripts required');
  const importMap=JSON.parse(scripts[0][2]);equal(importMap,{imports:IMPORTS},'Authored fixed import map differs');
  requireThat(scripts[0][2].replace(/\s/g,'')===JSON.stringify(importMap),'Duplicate map key or noncanonical import spelling');
  const aliasTargets=validateAtlasFrameEntries(rootMetadata);
  const appModules=new Set(importer?['examples/atlas-import-playback/session.mjs',APP+'image.mjs','tools/atlas-import/native-fixture.mjs','tools/atlas-import/scenario.mjs']:[APP+'main.mjs',APP+'session.mjs',APP+'image.mjs','tools/atlas-frame/native-fixture.mjs','tools/atlas-frame/scenario.mjs']);
  function visit(owner,relative){
    identity.logicalPath(relative);const key=owner+':'+relative;if(modules.has(key))return modules.get(key);
    requireThat(modules.size<256,'Closed module count exceeded');
    requireThat(owner==='foundation'?relative.endsWith('.js'):appModules.has(relative)||/^packages\/(?:engine|runtime|contracts)\/dist\/.+\.js$/.test(relative),'Unregistered module '+key);
    const input=read(owner,relative),route=owner==='foundation'?'/packages/engine/node_modules/robust-predicates/'+relative:'/'+relative;
    if(owner==='repository'&&relative.startsWith('packages/')){
      const match=/^packages\/(engine|runtime|contracts)\/dist\/(.+)\.js$/.exec(relative);
      requireThat(match,'Selected SDK emission required');
      const source=match[1]==='engine'&&/^(?:web|rendering)\//.test(match[2])?match[2]:'src/'+match[2];
      read(owner,'packages/'+match[1]+'/'+source+'.ts');read(owner,relative.replace(/\.js$/,'.d.ts'));
    }
    const record={owner,path:relative,route,bytes:input.pin.bytes,sha256:input.pin.sha256,edges:[]};modules.set(key,record);
    for(const edge of moduleImports(decode(input.raw))){
      const {specifier,dynamic}=edge;
      requireThat(!dynamic||(owner==='repository'&&relative==='packages/engine/dist/web/WebGPUHost.js'&&(specifier==='./b1.js'||specifier==='./sharedB1.js')),'Unregistered dynamic module edge '+key);
      let next;
      if(/^\.\.?\//.test(specifier)){
        const target=identity.ownerRelativePath(owners.get(owner),path.resolve(owners.get(owner),path.dirname(relative),specifier));next=[owner,target];
        if(appModules.has(relative))requireThat(appModules.has(target),'Application private module edge refused');
      }else{
        if(appModules.has(relative))requireThat(['@egret/engine','@egret/engine/web','@egret/engine/webgpu'].includes(specifier),'Application private bare import refused');
        requireThat(owner!=='foundation','Foundation bare import refused');next=aliasTargets.get(specifier);
      }
      requireThat(next,'Unregistered bare import '+specifier);const found=visit(...next);record.edges.push({...edge,target:next.join(':'),route:found.route});
    }
    addRoute(route,input.raw,'text/javascript; charset=utf-8');return record;
  }
  if(importer)visit('repository','tools/atlas-import/native-fixture.mjs');
  else {visit('repository',APP+'main.mjs');visit('repository','tools/atlas-frame/native-fixture.mjs');
    addRoute('/'+APP+'index.html',htmlInput.raw,'text/html; charset=utf-8');}
  const bytes=[...routes.values()].reduce((sum,row)=>sum+row.bytes.length,0);requireThat(bytes<16_777_216,'Closed route byte budget exceeded');
  for(const pin of files.values())equal(readPinned(identity,owners.get(pin.owner),pin.path).pin,{path:pin.path,bytes:pin.bytes,sha256:pin.sha256},'Input drift before closure');
  return {identity,routes,snapshot:{schemaVersion:1,sourceOnly:true,owners:Object.fromEntries(owners),aliases,buildResolutions,importMap,
    inventory:[...files.values()].sort((a,b)=>(a.owner+':'+a.path).localeCompare(b.owner+':'+b.path)),
    modules:[...modules.values()].sort((a,b)=>(a.owner+':'+a.path).localeCompare(b.owner+':'+b.path)),
    routes:[...routes].map(([route,row])=>({route,bytes:row.bytes.length,sha256:HASH(row.bytes),contentType:row.contentType})).sort((a,b)=>a.route.localeCompare(b.route))}};
}
export function assignedMutation(source,kind){
  requireThat(['rotation-sign','trim-y-constant'].includes(kind),'Exact assigned source mutation required');
  const from=kind==='rotation-sign'?'b: -1':'ty: layout.trimY + width';
  const to=kind==='rotation-sign'?'b: 1':'ty: 1 + width';
  requireThat(source.split(from).length===2,'Assigned source expression must be unique');return source.replace(from,to);
}
function metadataSourceIdentity(snapshot,metadataPath,fileNames,identity){
  const authoredLogicalPath='packages/runtime/src/bitmapAtlasPlacement.ts';
  requireThat(identity&&typeof identity.samePhysicalPath==='function'&&typeof identity.ownerRelativePath==='function','Authenticated identity helper required for compiler metadata');
  identity.logicalPath(metadataPath);identity.logicalPath(authoredLogicalPath);
  const ownerRoot=snapshot.owners?.repository;
  requireThat(typeof ownerRoot==='string'&&path.win32.isAbsolute(ownerRoot)&&!/[\x00-\x1f\x7f]/.test(ownerRoot),'Explicit Windows physical role owner required');
  const authoredPhysicalFile=path.win32.resolve(ownerRoot,authoredLogicalPath);
  const pins=snapshot.inventory.filter(pin=>pin.owner==='repository'
    &&identity.samePhysicalPath(path.win32.resolve(ownerRoot,pin.path),authoredPhysicalFile,'win32'));
  requireThat(pins.length===1&&pins[0].path===authoredLogicalPath&&Number.isSafeInteger(pins[0].bytes)&&pins[0].bytes>0
    &&/^[a-f0-9]{64}$/.test(pins[0].sha256),'Unique authenticated authored logical source pin required');
  requireThat(Array.isArray(fileNames)&&fileNames.length>0,'Original compiler file names required');
  const matches=[];
  for(const [index,serializedReference]of fileNames.entries()){
    requireThat(typeof serializedReference==='string'&&serializedReference.length>0&&!/[\x00-\x1f\x7f]/.test(serializedReference)
      &&!path.win32.isAbsolute(serializedReference)&&!/^[A-Za-z]:/.test(serializedReference),'Relative compiler physical reference required');
    const resolvedPhysicalFile=path.win32.resolve(ownerRoot,path.win32.dirname(metadataPath),serializedReference);
    // Containment and equality use explicit Windows physical semantics; raw references and logical pin spelling remain untouched.
    identity.ownerRelativePath(ownerRoot,resolvedPhysicalFile,'win32');
    if(identity.samePhysicalPath(resolvedPhysicalFile,authoredPhysicalFile,'win32'))matches.push({index,serializedReference,resolvedPhysicalFile});
  }
  requireThat(matches.length===1,'Exactly one complete role-owned compiler source reference required');
  return {ownerRoot,authoredLogicalPath,sourcePin:{path:pins[0].path,bytes:pins[0].bytes,sha256:pins[0].sha256},...matches[0]};
}
export function verifyAssignedDiff(healthy,assigned,kind,readText,identity){
  const left=healthy.inventory.filter(row=>row.owner==='repository'),right=assigned.inventory.filter(row=>row.owner==='repository');
  equal(left.map(row=>row.path),right.map(row=>row.path),'Closure file sets differ');
  const differences=left.filter((row,index)=>row.bytes!==right[index].bytes||row.sha256!==right[index].sha256).map(row=>row.path);
  const semantic=['packages/runtime/dist/bitmapAtlasPlacement.js','packages/runtime/src/bitmapAtlasPlacement.ts'];
  const mapPath='packages/runtime/dist/bitmapAtlasPlacement.js.map';
  const metadata=differences.filter(relative=>/^packages\/(?:contracts|runtime|engine|project)\/tsconfig(?:\.[a-z]+)?\.tsbuildinfo$/.test(relative));
  equal(differences.filter(relative=>relative!==mapPath&&!metadata.includes(relative)),semantic,'Only assigned source/actual emission and reviewed compiler derivatives may differ');
  for(const relative of semantic){const original=readText('healthy',relative),actual=readText('assigned',relative);
    equal(actual,assignedMutation(original,kind),'Assigned expression diff differs '+relative);}
  equal(healthy.inventory.filter(row=>row.owner!=='repository'),assigned.inventory.filter(row=>row.owner!=='repository'),'Compiler/dependency package bytes differ');
  const rawDiff=relative=>({path:relative,healthy:readText('healthy',relative),assigned:readText('assigned',relative)});
  let sourceMap=null;
  if(differences.includes(mapPath)){
    sourceMap=rawDiff(mapPath);const before=strictJSON(Buffer.from(sourceMap.healthy)),after=strictJSON(Buffer.from(sourceMap.assigned));
    equal({...before,mappings:null},{...after,mappings:null},'Source-map identity/names/sources changed');
    requireThat(before.version===3&&before.file==='bitmapAtlasPlacement.js'&&before.sourceRoot===''
      &&Array.isArray(before.sources)&&before.sources.length===1
      &&path.posix.normalize(path.posix.join(path.posix.dirname(mapPath),before.sources[0]))==='packages/runtime/src/bitmapAtlasPlacement.ts'
      &&typeof before.mappings==='string'&&typeof after.mappings==='string','Corresponding complete source-map identity differs');
  }
  const buildMetadata=metadata.map(relative=>{
    const raw=rawDiff(relative),before=strictJSON(Buffer.from(raw.healthy)),after=strictJSON(Buffer.from(raw.assigned));
    equal(before.fileNames,after.fileNames,'Build-metadata owner-relative file names changed');
    const entries=[];
    function walk(left,right,pointer){
      if(JSON.stringify(left)===JSON.stringify(right))return;
      if(left!==null&&right!==null&&typeof left==='object'&&typeof right==='object'&&Array.isArray(left)===Array.isArray(right)){
        equal(Object.keys(left),Object.keys(right),'Build-metadata shape changed '+pointer);
        for(const key of Object.keys(left))walk(left[key],right[key],pointer+'/'+key);return;
      }
      entries.push({pointer,healthy:left,assigned:right});
    }
    walk(before,after,'');
    const healthySource=metadataSourceIdentity(healthy,relative,before.fileNames,identity);
    const assignedSource=metadataSourceIdentity(assigned,relative,after.fileNames,identity);
    equal(healthySource.index,assignedSource.index,'Role-specific compiler source indices differ');
    for(const [role,source]of [['healthy',healthySource],['assigned',assignedSource]]){
      const text=readText(role,source.authoredLogicalPath),raw=Buffer.from(text);
      equal({bytes:raw.length,sha256:HASH(raw)},{bytes:source.sourcePin.bytes,sha256:source.sourcePin.sha256},'Actual authored source raw pin differs from metadata binding');
    }
    const sourceIndex=healthySource.index;
    // Unknown dependency bookkeeping stays a refusal until its exact output receives a new source review.
    requireThat(sourceIndex>=0&&entries.length===1&&entries[0].pointer==='/fileInfos/'+sourceIndex+'/version'
      &&typeof entries[0].healthy==='string'&&typeof entries[0].assigned==='string','Unexplained actual compiler metadata derivative');
    return {...raw,entries,sourceIdentity:{authoredLogicalPath:healthySource.authoredLogicalPath,healthy:healthySource,assigned:assignedSource}};
  });
  return {kind,differences,semanticDifferences:semantic,sourceMap,buildMetadata,
    derivativeRule:'Proposed native-build-derivative-clarification-r1; independent approval required before preparation/browser execution',
    sourceExpression:kind==='rotation-sign'?{from:'b: -1',to:'b: 1'}:{from:'ty: layout.trimY + width',to:'ty: 1 + width'}};
}
async function cli(){
  requireThat(process.argv.length===2,'Source boundary CLI accepts no arguments');
  const repository=fs.realpathSync(fileURLToPath(new URL('../..',import.meta.url)));
  const identity=await authenticateIdentity(repository),self=fileURLToPath(import.meta.url);
  requireThat(identity.samePhysicalPath(fs.realpathSync(process.argv[1]),self)
    &&identity.ownerRelativePath(repository,self)==='tools/atlas-frame/boundary.mjs','Exact physical boundary main and owner required');
  const {snapshot}=await collectAtlasFrameSource(repository);
  console.log(JSON.stringify({status:'SOURCE_BOUNDARY_PASS',sourceOnly:true,browserExecuted:false,snapshotWritten:false,
    modules:snapshot.modules.length,inputFiles:snapshot.inventory.length,routes:snapshot.routes.length}));
}
// Full physical main comparison gates CLI work. Importing this module never collects inputs or starts a product/browser.
if(process.argv[1]&&fs.existsSync(process.argv[1])){
  const physical=process.platform==='win32'?path.win32:path.posix;
  if(physical.relative(fs.realpathSync(process.argv[1]),fileURLToPath(import.meta.url))==='')await cli();
}

// The importer has a separate exact schema. The schema-1 validator above is intentionally retained.
export const IMPORT_TEXT=Object.freeze(['examples/atlas-import-playback/session.mjs','tests/atlas-import-composition.test.mjs',
  'tools/atlas-import/native-fixture.mjs','tools/atlas-import/scenario.mjs']);
function validateImportConfig(value){
  requireThat(exactKeys(value,['schemaVersion','repositoryRoot','taskRoot','snapshot','output','playwrightRoot','nativeScenario','closures','fixture','importInput','oracle'])&&value.schemaVersion===2,'Exact importer config schema');
  for(const key of ['repositoryRoot','taskRoot','snapshot','output','playwrightRoot'])requireThat(absolute(value[key]),'Absolute importer owner '+key);
  requireThat(exactKeys(value.nativeScenario,['profile','kind'])&&['canvas-2d','webgpu-textured-2d'].includes(value.nativeScenario.profile)&&value.nativeScenario.kind==='atlas-import-v1','Exact versioned importer case');
  requireThat(Array.isArray(value.closures)&&value.closures.length===1&&exactKeys(value.closures[0],['role','repositoryRoot'])
    &&value.closures[0].role==='healthy'&&value.closures[0].repositoryRoot===value.repositoryRoot,'Importer healthy closure only');
  requireThat(exactKeys(value.fixture,['path','route','exportName','bytes','sha256'])&&value.fixture.route==='/tools/atlas-import/native-fixture.mjs'
    &&value.fixture.exportName==='runAtlasImportNativeFixture','Fixed importer fixture');
  const pin=record=>requireThat(exactKeys(record,['path','bytes','sha256'])&&absolute(record.path)&&Number.isSafeInteger(record.bytes)&&record.bytes>0&&/^[a-f0-9]{64}$/.test(record.sha256),'Exact importer raw pin');
  pin({path:value.fixture.path,bytes:value.fixture.bytes,sha256:value.fixture.sha256});
  requireThat(exactKeys(value.importInput,['ownerRoot','input','metadata','receipt','plan'])&&absolute(value.importInput.ownerRoot),'Exact input owner');
  for(const key of ['input','metadata','receipt','plan'])pin(value.importInput[key]);
  requireThat(exactKeys(value.oracle,['ownerRoot','source','manifest','frameA','frameB'])&&absolute(value.oracle.ownerRoot),'Exact oracle owner');
  for(const key of ['source','manifest','frameA','frameB'])pin(value.oracle[key]);return value;
}
export const IMPORT_ENV_KEYS=Object.freeze(['HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','SYSTEMROOT','TEMP','USERDOMAIN','USERNAME','USERPROFILE','WINDIR']);
export function canonicalSystemDirectory(value,identity){
  requireThat(absolute(value)&&!/[\\/](?:\.{1,2})(?:[\\/]|$)/.test(value),'Canonical OS directory path required');
  const real=fs.realpathSync(value);requireThat(identity.samePhysicalPath(value,real,'win32'),'OS directory aliases refused');
  let current=path.parse(real).root;
  for(const part of real.slice(current.length).split(path.sep).filter(Boolean)){
    requireThat(fs.readdirSync(current).includes(part),'OS directory spelling');current=path.join(current,part);
    requireThat(!fs.lstatSync(current).isSymbolicLink()&&fs.lstatSync(current).isDirectory(),'OS directory symbolic member refused');
  }
  requireThat(fs.lstatSync(real).isDirectory()&&!fs.lstatSync(real).isSymbolicLink(),'Physical OS directory required');return real;
}
export function importChildEnvironment(identity){
  if(process.platform!=='win32')return {environmentPolicy:'empty-v1',systemRootSource:null,environment:{}};
  const selected=Object.entries(process.env).filter(([key])=>key.toUpperCase()==='SYSTEMROOT');
  requireThat(selected.length===1&&typeof selected[0][1]==='string'&&selected[0][1].length>0,'One parent SYSTEMROOT OS value required');
  const [key,value]=selected[0],canonicalDirectory=canonicalSystemDirectory(value,identity);
  return {environmentPolicy:'win32-os-init-v1',systemRootSource:{key,value,canonicalDirectory},
    environment:Object.fromEntries(IMPORT_ENV_KEYS.map(key=>[key,key==='SYSTEMROOT'?canonicalDirectory:'']))};
}
export async function validateImportArtifacts(config,configPath,identity,fixedStdin){
  const H=fs.realpathSync(config.repositoryRoot),D=fs.realpathSync(path.dirname(H));
  requireThat(path.basename(H)==='healthy'&&!fs.lstatSync(H).isSymbolicLink(),'Fixed healthy owner');
  const fixed=(actual,expected)=>requireThat(actual===expected&&identity.samePhysicalPath(actual,expected),'Exact importer physical destination');
  fixed(configPath,path.join(D,'config.json'));fixed(config.snapshot,path.join(D,'snapshot.json'));fixed(config.output,path.join(D,'native-output'));
  fixed(config.importInput.ownerRoot,path.join(D,'import-input'));fixed(config.oracle.ownerRoot,path.join(D,'oracle'));
  identity.ownerRelativePath(config.taskRoot,D);
  const source=await import('../atlas-import/scenario.mjs');
  const IMPORT_PLANNER_STDIN=fixedStdin??(await import('./prepare-native.mjs')).IMPORT_PLANNER_STDIN;
  const read=(root,key,record)=>{fixed(record.path,path.join(root,key));return readPinned(identity,root,key,record);};
  const input=read(config.importInput.ownerRoot,'input.json',config.importInput.input),metadata=read(config.importInput.ownerRoot,'metadata.json',config.importInput.metadata);
  equal(decode(input.raw),source.serialize(source.fixedInput()),'Complete fixed input bytes');equal(decode(metadata.raw),source.METADATA,'Complete metadata bytes');
  const receipt=read(config.importInput.ownerRoot,'node-parser-receipt.json',config.importInput.receipt),plan=read(config.importInput.ownerRoot,'plan.json',config.importInput.plan);
  equal(decode(plan.raw),source.serialize(source.EXPECTED_PLAN),'Actual complete normalized plan artifact');
  const r=strictJSON(receipt.raw);equal(decode(receipt.raw),source.serialize(r),'Canonical actual receipt bytes');
  requireThat(exactKeys(r,['schemaVersion','kind','execution','child'])&&r.schemaVersion===1&&r.kind==='ATLAS_IMPORT_NODE_PARSER_RECEIPT_V1','Closed Node receipt');
  const e=r.execution,c=r.child;
  requireThat(exactKeys(e,['command','node','stdin','environmentPolicy','systemRootSource','environment','started','finished','exitCode','signal','timedOut','error','stdout','stderr']),'Closed execution receipt');
  const command={exe:process.execPath,args:['--input-type=module'],cwd:H,shell:false,windowsHide:true,timeoutMs:120000,maxBufferBytes:16777216,encoding:null,stdio:['pipe','pipe','pipe']};
  equal(e.command,command,'Exact actual child command/options');
  const nodeOwner=fs.realpathSync(path.dirname(process.execPath)),node={ownerRoot:nodeOwner,...readPinned(identity,nodeOwner,path.basename(process.execPath)).pin};
  equal(e.node,node,'Actual child Node executable identity');
  const channel=(record,bytes)=>{requireThat(exactKeys(record,['bytes','sha256','base64']),'Closed actual byte channel');equal(record,{bytes:bytes.length,sha256:HASH(bytes),base64:bytes.toString('base64')},'Exact actual byte channel');};
  channel(e.stdin,Buffer.from(IMPORT_PLANNER_STDIN));channel(e.stdout,Buffer.from(e.stdout.base64,'base64'));channel(e.stderr,Buffer.alloc(0));
  requireThat(e.exitCode===0&&e.signal===null&&e.timedOut===false&&e.error===null&&new Date(e.started).toISOString()===e.started
    &&new Date(e.finished).toISOString()===e.finished&&e.finished>=e.started,'Actual successful UTC child receipt');
  equal(e.child,undefined,'No alternate child selector');
  requireThat(exactKeys(c,['schemaVersion','kind','platform','environment','actualInput','rawInputs','publicEntry','result','freezeObservations','planArtifact'])
    &&c.schemaVersion===1&&c.kind==='ATLAS_IMPORT_NODE_CALL_RESULT_V1','Closed child result');
  equal(decode(Buffer.from(e.stdout.base64,'base64')),source.serialize(c),'Actual child stdout only');
  requireThat(c.platform===process.platform,'Actual child platform differs');
  if(c.platform==='win32'){
    equal(Object.keys(e.environment).sort(),IMPORT_ENV_KEYS,'Passed environment raw key set');
    requireThat(exactKeys(e.systemRootSource,['key','value','canonicalDirectory'])&&e.systemRootSource.key.toUpperCase()==='SYSTEMROOT','Recorded sole OS source');
    requireThat(canonicalSystemDirectory(e.systemRootSource.value,identity)===e.systemRootSource.canonicalDirectory,'Recorded parent canonical OS directory');
    requireThat(e.environmentPolicy==='win32-os-init-v1'&&e.environment.SYSTEMROOT===e.systemRootSource.canonicalDirectory,'Actual OS initialization value');
    for(const key of IMPORT_ENV_KEYS)if(key!=='SYSTEMROOT')equal(e.environment[key],'','No extra environment selector');
    requireThat(canonicalSystemDirectory(c.environment.SYSTEMROOT,identity)===c.environment.SYSTEMROOT,'Actual child canonical OS directory');
  }else{equal(e.environmentPolicy,'empty-v1','Non-Windows policy');equal(e.systemRootSource,null,'No OS value');equal(e.environment,{},'Empty environment');}
  equal(Object.keys(c.environment).sort(),Object.keys(e.environment).sort(),'Complete actual child environment keys');
  for(const key of Object.keys(e.environment))equal(c.environment[key],e.environment[key],'Complete actual child environment value '+key);
  equal(c.actualInput,source.fixedInput(),'Complete actual public planner argument');equal(c.result,{ok:true,value:source.EXPECTED_PLAN,diagnostics:[]},'Complete actual planner result');
  equal(c.freezeObservations,{plan:true,ownedContainers:true},'Live public plan ownership observations');
  const png=readPinned(identity,H,APP+'assets/atlas.png'),owned=(root,pin)=>({ownerRoot:root,...pin});
  equal(c.rawInputs,{input:owned(config.importInput.ownerRoot,input.pin),metadata:owned(config.importInput.ownerRoot,metadata.pin),originalPng:owned(H,png.pin)},'Raw input identities actually consumed');
  equal(c.publicEntry,{specifier:'@egret/project/atlas',ownerRoot:H,resolutionBase:H,
    package:readPinned(identity,H,'packages/project/package.json').pin,entry:readPinned(identity,H,'packages/project/dist/atlas/index.js').pin},'Actual public export closure');
  equal(c.planArtifact,{ownerRoot:config.importInput.ownerRoot,...plan.pin,serialization:'utf8-json-2space-lf-final-newline-v1'},'Actual saved plan identity');
  const oracleSource=read(H,'tools/atlas-import/scenario.mjs',config.oracle.source),manifest=read(config.oracle.ownerRoot,'oracle.json',config.oracle.manifest);
  equal(decode(manifest.raw),source.serialize(source.ORACLE),'Portable literal oracle manifest');
  const frames={};for(const [index,key] of ['frameA','frameB'].entries()){
    const row=source.ORACLE.frames[index],actual=read(config.oracle.ownerRoot,row.path,config.oracle[key]);
    equal({bytes:actual.raw.length,sha256:HASH(actual.raw)},{bytes:row.bytes,sha256:row.sha256},'Fixed independent oracle identity');
    requireThat(actual.raw.equals(Buffer.from(source.literalOracleBytes(row.id))),'Complete independent literal oracle bytes');frames[row.id]=actual.raw;
  }
  return {source,receipt:r,pins:{input:input.pin,metadata:metadata.pin,receipt:receipt.pin,plan:plan.pin,oracleSource:oracleSource.pin,oracleManifest:manifest.pin,
    frameA:readPinned(identity,config.oracle.ownerRoot,'expected-frame-a.rgba').pin,frameB:readPinned(identity,config.oracle.ownerRoot,'expected-frame-b.rgba').pin},
    frames,importIdentity:{input:input.pin,metadata:metadata.pin,receipt:receipt.pin,plan:plan.pin}};
}
