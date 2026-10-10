import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// All IO belongs to this test loader. Evaluated production modules see denied hosts.
const root=fileURLToPath(new URL('../..',import.meta.url));
const packageDirectory=path.join(root,'packages/project');
const rootAudit=process.argv.includes('--project-root');
const authorityAudit=process.argv.includes('--audit-store-authority');
const directoryFlag=process.argv.indexOf('--built-directory');
const builtDirectory=realpathSync(directoryFlag<0?path.join(packageDirectory,'dist'):process.argv[directoryFlag+1]);
const packageRequire=createRequire(path.join(packageDirectory,'package.json'));
const publicRoot=realpathSync(packageRequire.resolve('jsonc-parser'));
const installedRoot=path.resolve(path.dirname(publicRoot),'../..');
const deniedHostAccesses=[];
const sandbox=Object.create(null);
const context=vm.createContext(sandbox,{codeGeneration:{strings:false,wasm:false}});
// Define getters on the real VM global: Node may swallow exceptions from sandbox-proxy getters.
const vmGlobal=vm.runInContext('globalThis',context);
for(const name of ['window','document','navigator','process','Buffer','fetch','XMLHttpRequest','WebSocket','setTimeout','clearTimeout','setInterval','clearInterval','setImmediate','clearImmediate','queueMicrotask','requestAnimationFrame','cancelAnimationFrame','Date','performance','crypto','console','ProjectStore']) Object.defineProperty(vmGlobal,name,{get(){deniedHostAccesses.push(name);throw Error(`Denied host access: ${name}`);},configurable:false});
const random=()=>{deniedHostAccesses.push('Math.random');throw Error('Denied host access: Math.random');};
Object.defineProperty(vm.runInContext('Math',context),'random',{get:random,configurable:false});
const cjsCache=new Map(),libraryGraph=[];
function loadCjs(file) {
  file=realpathSync(file);
  if(!file.toLowerCase().startsWith(installedRoot.toLowerCase()+path.sep)) throw Error('CJS graph escaped installed public package');
  if(cjsCache.has(file))return cjsCache.get(file).exports;
  const module={exports:{}};cjsCache.set(file,module);libraryGraph.push(path.relative(installedRoot,file).replaceAll(path.sep,'/'));
  const source=readFileSync(file,'utf8');
  const factory=new vm.Script(`(function(exports,require,module){${source}\n})`,{filename:file}).runInContext(context);
  const requireLocal=specifier=>{
    if(!specifier.startsWith('.'))throw Error(`Denied library external import: ${specifier}`);
    const resolved=path.resolve(path.dirname(file),specifier);
    return loadCjs(resolved.endsWith('.js')?resolved:resolved+'.js');
  };
  factory(module.exports,requireLocal,module);
  return module.exports;
}
const library=loadCjs(publicRoot);
const synthetic=new vm.SyntheticModule(Object.keys(library),function(){for(const [name,value]of Object.entries(library))this.setExport(name,value);},{context,identifier:'installed:jsonc-parser:public-root'});
const foundationGraph=[],esmCache=new Map(),storeAuthorityCalls=[];
const authorityEntries=[['state.js','createState'],['store.js','makeStore'],['commit.js','commitPrepared'],['history.js','openHistoryDocument']];
const instrumentedEntries=[];
if(authorityAudit) Object.defineProperty(vmGlobal,'__denyProjectAuthority',{value(name){storeAuthorityCalls.push(name);throw Error(`Denied store authority during import: ${name}`);},configurable:false,writable:false});
function loadEsm(file) {
  file=realpathSync(file);
  if(!file.toLowerCase().startsWith(builtDirectory.toLowerCase()+path.sep))throw Error('Foundation graph escaped built project');
  if(esmCache.has(file))return esmCache.get(file);
  let source=readFileSync(file,'utf8');
  if(authorityAudit) for(const [basename,name]of authorityEntries) if(path.basename(file)===basename) {
    const entry=new RegExp(`export function ${name}\\([^)]*\\) \\{`,'g');
    if([...source.matchAll(entry)].length!==1)throw Error(`Authority instrumentation entry mismatch: ${basename}:${name}`);
    source=source.replace(entry,match=>match+`\n globalThis.__denyProjectAuthority(${JSON.stringify(name)});`);
    instrumentedEntries.push(`${basename}:${name}`);
  }
  const module=new vm.SourceTextModule(source,{context,identifier:file});
  esmCache.set(file,module);foundationGraph.push('dist/'+path.relative(builtDirectory,file).replaceAll(path.sep,'/'));
  return module;
}
function linker(specifier,referrer) {
  if(specifier==='jsonc-parser')return synthetic;
  if(!specifier.startsWith('.'))throw Error(`Denied foundation external import: ${specifier}`);
  return loadEsm(path.resolve(path.dirname(referrer.identifier),specifier));
}
if(process.argv.includes('--probe-host')){
  const index=process.argv.indexOf('--probe-host'),name=process.argv[index+1]??'process';
  const probe=new vm.SourceTextModule(name==='Math.random'?'void Math.random;':`void globalThis[${JSON.stringify(name)}];`,{context});
  await probe.link(()=>{throw Error('Unexpected probe import');});await probe.evaluate();
}else if(rootAudit){
  const entry=realpathSync(path.join(builtDirectory,'index.js'));
  const project=loadEsm(entry);await project.link(linker);await project.evaluate();
  if(deniedHostAccesses.length)throw Error('Denied hosts were accessed');
  if(authorityAudit&&instrumentedEntries.length!==authorityEntries.length)throw Error('Incomplete store authority audit');
  // The primary run evaluates unmodified built source. The separate authority run
  // intercepts these four first-party entries only and discloses that instrumentation.
  const report={mode:authorityAudit?'built-root-authority-instrumented':'built-root-unmodified',entry,installedPublicRoot:publicRoot,environment:{node:process.version,platform:process.platform,arch:process.arch,moduleLoader:'VM SourceTextModule + actual installed public-root CJS graph'},libraryGraph,projectGraph:foundationGraph,projectExports:Object.keys(project.namespace).sort(),deniedHostAccesses};
  if(authorityAudit)Object.assign(report,{authorityEntries:authorityEntries.map(([file,name])=>`${file}:${name}`),storeAuthorityCalls});
  process.stdout.write(JSON.stringify(report)+'\n');
}else{
  const foundation=loadEsm(path.join(builtDirectory,'json-foundation.js'));
  await foundation.link(linker);await foundation.evaluate();
  // Exercise real closure code after evaluation as well as the eager import graph.
  const scanner=foundation.namespace.createScanner('"headless"',false);
  if(scanner.scan()!==10||scanner.getTokenValue()!=='headless')throw Error('Scanner audit failed');
  let literal;
  foundation.namespace.visit('true',{onLiteralValue(value){literal=value;},onError(){throw Error('Visitor audit error');}},{disallowComments:true,allowTrailingComma:false,allowEmptyContent:false});
  if(literal!==true)throw Error('Visitor audit failed');
  if(deniedHostAccesses.length)throw Error('Denied hosts were accessed');
  // This foundation has no project-store implementation. Record the actual authority surface,
  // rather than presenting a literal false as an allocation detector.
  const storeAuthorityExports=Object.keys(foundation.namespace).filter(name=>/Store|History|commit/.test(name));
  process.stdout.write(JSON.stringify({installedPublicRoot:publicRoot,libraryGraph,foundationGraph,foundationExports:Object.keys(foundation.namespace).sort(),deniedHostAccesses,storeAuthorityExports})+'\n');
}
