// SPDX-License-Identifier: Apache-2.0
// Finite generated-content proof: real authoring, frozen native SDK closure, literal pixel oracle.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonicalTextBytes,fingerprintFile,logicalPath,ownerRelativePath,physicalPathKey,samePhysicalPath} from './lib/file-identity.mjs';

/** Fixed authored pixel oracle; it never reads decoded pixels or SDK metadata. */
export function contentPixelOracle(color){
 assert.ok(color==='red'||color==='green','Fixed authored colour required.');
 const animated=color==='red'?[255,0,0,255]:[0,255,0,255],expected=Buffer.alloc(12*6*4);
 for(let y=0;y<6;y++)for(let x=0;x<12;x++)expected.set(x>=2&&x<4&&y>=2&&y<4?animated:x>=8&&x<10&&y>=2&&y<4?[0,0,255,255]:[17,24,39,255],(y*12+x)*4);
 return expected;
}
async function collect(){
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=new Map();
for(let index=2;index<process.argv.length;index+=2){
 const name=process.argv[index],value=process.argv[index+1];
 if(!['--playwright','--output'].includes(name)||args.has(name)||!value||value.startsWith('--'))throw new TypeError('Usage: node tools/verify-content-build.mjs --playwright <absolute-installed-package> --output <new-absolute-directory-outside-repository>');
 args.set(name,value);
}
if(args.size!==2)throw new TypeError('Both --playwright and --output are required.');
assert.equal(process.version,'v26.7.0','Node 26.7.0 required.');
assert.equal(process.execArgv.length,0,'Node launch injection refused.');
for(const [name,value]of Object.entries(process.env))if(/^(NODE_OPTIONS|NODE_PATH|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(name))assert.ok(!value,'Node environment injection refused.');
function directory(value){physicalPathKey(value);const state=fs.lstatSync(value);assert.ok(state.isDirectory()&&!state.isSymbolicLink()&&samePhysicalPath(value,fs.realpathSync(value)),'Canonical physical directory required.');return path.resolve(value);}
directory(root);
const pw=directory(args.get('--playwright'));
physicalPathKey(args.get('--output'));
const output=path.resolve(args.get('--output')),parent=directory(path.dirname(output));
logicalPath(path.basename(output));
let inside=samePhysicalPath(root,output);try{ownerRelativePath(root,output);inside=true;}catch(error){if(!(error instanceof RangeError))throw error;}
assert.ok(!inside,'Output must be outside the repository.');
assert.ok(!fs.readdirSync(parent).some(name=>process.platform==='win32'?name.toLowerCase()===path.basename(output).toLowerCase():name===path.basename(output)),'Output already exists; evidence is never overwritten.');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const core=directory(path.dirname(createRequire(pathToFileURL(path.join(pw,'index.mjs'))).resolve('playwright-core/package.json')));
const toolkit=[];
for(const [owner,name]of [[pw,'playwright'],[core,'playwright-core']]){
 const metadata=JSON.parse(fs.readFileSync(path.join(owner,'package.json')));assert.equal(metadata.name,name);assert.equal(metadata.version,'1.62.1');
 if(name==='playwright')assert.deepEqual(metadata.dependencies,{'playwright-core':'1.62.1'});
 toolkit.push({owner,name,files:['package.json','index.mjs'].map(file=>fingerprintFile(owner,file))});
}
const html='examples/content-build/index.html',main='examples/content-build/main.mjs';
const aliases={
 '@egret/engine':'../../packages/engine/dist/index.js','@egret/engine/web':'../../packages/engine/dist/web/index.js',
 '@egret/engine/resources':'../../packages/engine/dist/resources.js','@egret/engine/web/resources':'../../packages/engine/dist/web/resources.js',
 '@egret/runtime':'../../packages/runtime/dist/index.js','@egret/runtime/text':'../../packages/runtime/dist/text/index.js',
 '@egret/contracts':'../../packages/contracts/dist/index.js','@egret/contracts/resources':'../../packages/contracts/dist/resources/index.js',
 '#egret-mouse-input':'../../packages/engine/dist/mouseInput.js','#egret-textured-frame-state':'../../packages/engine/dist/internal/texturedFrameState.js',
 '#egret-manifest-resources':'../../packages/engine/dist/manifestResourceState.js','robust-predicates':'../../packages/engine/node_modules/robust-predicates/index.js'
};
const inputs=new Map(),files=new Map(),sources=new Map(),routes=new Map();let totalBytes=0;
function pin(owner,file){
 const key=owner+'|'+file;if(inputs.has(key))return inputs.get(key);
 assert.ok(inputs.size<1500,'Finite input count exceeded.');const identity=fingerprintFile(owner,file);assert.ok(identity.bytes<=4194304&&totalBytes+identity.bytes<=67108864,'Finite input bytes exceeded.');
 const bytes=fs.readFileSync(path.join(owner,file));assert.equal(sha(bytes),identity.sha256);assert.equal(bytes.length,identity.bytes);
 const row={owner,...identity,bytesRaw:bytes};inputs.set(key,row);totalBytes+=bytes.length;return row;
}
// Independently copied first-party restricted literal reader; no parser package executes.
function literalImports(file, source) {
  const tokens = [];
  let at = 0;
  while (at < source.length) {
    const char = source[at];
    if (/\s/.test(char)) { at++; continue; }
    if (source.slice(at, at + 2) === '//') { const end = source.indexOf('\n', at + 2); at = end < 0 ? source.length : end; continue; }
    if (source.slice(at, at + 2) === '/*') { const end = source.indexOf('*/', at + 2); if (end < 0) throw new Error('Unterminated comment'); at = end + 2; continue; }
    if (char === '"' || char === "'") {
      const quote = char, start = ++at;
      while (at < source.length && source[at] !== quote) { if (source[at] === '\\') at++; at++; }
      if (at >= source.length) throw new Error('Unterminated string');
      tokens.push({ kind: 'string', value: source.slice(start, at++) }); continue;
    }
    if (char === '`') {
      const start = ++at;
      while (at < source.length && source[at] !== '`') { if (source[at] === '\\') at++; at++; }
      if (at >= source.length || /\bimport\b/.test(source.slice(start, at))) throw new Error('Unsupported template import syntax');
      at++; tokens.push({ kind: 'template', value: '' }); continue;
    }
    if (char === '/' && ['(', '=', ':', ',', 'return', '[', '!', '?', '|', '&'].includes(tokens.at(-1)?.value)) {
      at++; let bracket = false, finished = false;
      while (at < source.length) {
        const next = source[at++];
        if (next === '\\') { at++; continue; }
        if (next === '[') bracket = true;
        if (next === ']') bracket = false;
        if (next === '/' && !bracket) { finished = true; break; }
      }
      if (!finished) throw new Error('Unterminated regular expression');
      while (/[A-Za-z]/.test(source[at] ?? '')) at++;
      tokens.push({ kind: 'regex', value: '' }); continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = at++;
      while (/[A-Za-z0-9_$]/.test(source[at] ?? '')) at++;
      tokens.push({ kind: 'word', value: source.slice(start, at) }); continue;
    }
    tokens.push({ kind: 'punctuation', value: char }); at++;
  }
  const result = [];
  function literal(token) {
    if (token?.kind !== 'string' || !token.value || (/[\\\s%?\0]/.test(token.value) || token.value.includes(':') && !/^node:[a-z_/]+$/.test(token.value))) throw new Error('Only simple literal imports are admitted in '+file+': '+JSON.stringify(token));
    result.push(token.value);
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind !== 'word') continue;
    if (token.value === 'import') {
      const next = tokens[index + 1];
      if (next?.value === '.') continue;
      if (next?.value === '(') {
        literal(tokens[index + 2]);
        if (tokens[index + 3]?.value !== ')') throw new Error('Nonliteral/options dynamic import refused');
      } else if (next?.kind === 'string') literal(next);
      else {
        let end = index + 1;
        while (end < tokens.length && !['from', ';'].includes(tokens[end].value)) end++;
        if (tokens[end]?.value !== 'from') throw new Error('Unresolved static import');
        literal(tokens[end + 1]);
      }
    } else if (token.value === 'export' && ['{', '*'].includes(tokens[index + 1]?.value)) {
      let end = index + 1;
      while (end < tokens.length && !['from', ';'].includes(tokens[end].value)) end++;
      if (tokens[end]?.value === 'from') literal(tokens[end + 1]);
    }
  }
  return result;
}
function addSource(file){if(sources.has(file))return;sources.set(file,pin(root,file));}
function copy(file){
 logicalPath(file);if(files.has(file))return;
 assert.ok(file===html||file===main||file==='examples/content-build/selection.mjs'||/^packages\/(engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(file)||/^packages\/engine\/node_modules\/robust-predicates\/(index|esm\/[\w.-]+)\.js$/.test(file),'Unadmitted browser module: '+file);
 assert.ok(files.size<512,'Finite browser module limit exceeded.');
 let row;
 if(file.includes('/node_modules/')){
  const prefix='packages/engine/node_modules/robust-predicates/',owner=directory(fs.realpathSync(path.join(root,prefix))),relative=file.slice(prefix.length);
  const metadata=JSON.parse(fs.readFileSync(path.join(owner,'package.json')));assert.equal(metadata.name,'robust-predicates');assert.equal(metadata.version,'3.0.3');
  for(const provenance of ['package.json','LICENSE']){const value=pin(owner,provenance);sources.set('dependency/robust-predicates/'+provenance,value);}
  row=pin(owner,relative);
 }else row=pin(root,file);
 files.set(file,row);routes.set('/'+file,{row,type:file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'});
 if(file===html)return;
 for(const specifier of literalImports(file,row.bytesRaw.toString('utf8'))){
  const next=specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)):aliases[specifier]?path.posix.normalize(path.posix.join(path.posix.dirname(html),aliases[specifier])):null;
  assert.ok(next,'Unmapped literal import '+specifier+' in '+file);copy(next);
 }
 if(file.startsWith('packages/')&&!file.includes('/node_modules/'))addSource(file.replace('/dist/web/','/web/').replace('/dist/rendering/','/rendering/').replace('/dist/','/src/').replace(/\.js$/,'.ts'));
}
function authorClosure(file){
 if(sources.has(file))return;addSource(file);
 for(const value of literalImports(file,sources.get(file).bytesRaw.toString('utf8')))if(value.startsWith('.')){
  const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),value));assert.ok(next.startsWith('tools/')&&next.endsWith('.mjs'),'Author tool closure escaped.');authorClosure(next);
 }
}
const htmlRaw=pin(root,html).bytesRaw;const maps=[...htmlRaw.toString('utf8').matchAll(/<script type="importmap">([^<]+)<\/script>/g)];
assert.equal(maps.length,1);assert.deepEqual(JSON.parse(maps[0][1]),{imports:aliases},'Fixed content example import map changed.');
copy(html);copy(main);authorClosure('tools/content/author-example.mjs');
for(const file of ['tools/verify-content-build.mjs','tools/lib/file-identity.mjs','package.json','pnpm-lock.yaml','tsconfig.json','tsconfig.base.json',
 'examples/content-build/sources/page.png','examples/content-build/sources/other.png','examples/content-build/sources/atlas.json','examples/content-build/sources/PROVENANCE.md',
 ...['engine','runtime','contracts','project'].flatMap(name=>['packages/'+name+'/package.json','packages/'+name+'/tsconfig.json']),
 'packages/engine/tsconfig.web.json','packages/engine/tsconfig.rendering.json'])addSource(file);
// Only the finite author tool is executed; no shell command, cache reuse or test fixture fabrication.
fs.mkdirSync(output);const work=path.join(output,'generation');fs.mkdirSync(work);
let generated;
const report={format:'egret.content-build-browser/1',status:'RUNNING',startedAt:new Date().toISOString(),environment:{node:process.version,nodeExecutable:process.execPath,platform:process.platform,architecture:process.arch,playwright:'1.62.1',channel:'msedge',headless:true,extraFlags:[],viewport:{width:900,height:700},deviceScaleFactor:1,physicalDevice:false},toolkit,checks:[],errors:[],cleanup:{application:false,context:false,browser:false,server:false},snapshotIntegrity:false,sourceIntegrity:false,rawFrames:[],negativeBrowserCase:false,scope:'Canvas desktop correctness and logical lifecycle only; no shared GPU, physical device, memory or timing acceptance',replacements:[]};
const snapshot=path.join(output,'snapshot'),sourceSnapshot=path.join(output,'source');fs.mkdirSync(snapshot);fs.mkdirSync(sourceSnapshot);
const publicRow=({bytesRaw,...row})=>row;
function save(owner,relative,row){logicalPath(relative);const destination=path.join(owner,relative);assert.equal(ownerRelativePath(owner,destination),relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,row.bytesRaw,{flag:'wx'});const actual=fingerprintFile(owner,relative);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
function jsonAt(owner,file){return JSON.parse(pin(owner,file).bytesRaw.toString('utf8'));}
const record=(name,details={})=>report.checks.push({name,pass:true,...details});
async function bounded(task,label){let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Deadline: '+label)),15000);})]);}finally{clearTimeout(timer);}}
function assertRetired(row){
 assert.equal(row.dataScope,'closed');assert.equal(row.loaderDisposed,true);
 for(const key of ['animationScope','displayScope'])assert.ok(row[key]===null||row[key]==='closed');
 for(const key of ['controller','sheet','bitmap','other'])assert.ok(row[key]===null||row[key]===true);
 assert.ok(row.textures.every(Boolean));
 for(const status of [row.status.source,row.status.provider]){assert.equal(status.saturated,false);assert.ok(Object.values(status.current).every(value=>value===0),'Native public counters must drain.');}
}
function assertClosed(closed){
 assert.equal(closed.state,'closed');assert.equal(closed.clock,'closed');assert.deepEqual(closed.diagnostics,[]);assert.equal(closed.pending,null);
 assert.equal(closed.retirement.animationScope,'closed');assert.equal(closed.retirement.displayScope,'closed');
 for(const key of ['controller','sheet','bitmap','other'])assert.equal(closed.retirement[key],true);
 assert.deepEqual(closed.retirement.textures,[true,true]);assertRetired(closed.retirement);for(const row of closed.retired)assertRetired(row);
}
let browser,context,page,server,heldResponse;let resolveHeld;const heldEntered=new Promise(resolve=>{resolveHeld=resolve;});
const finiteVariants=new Map();
try{
 const {authorContentExample}=await import('./content/author-example.mjs');generated=await authorContentExample(work);assert.equal(generated.status,'adopted');
 const replacement=await authorContentExample(work);assert.equal(replacement.status,'adopted');
 const variantAtlas=JSON.parse(fs.readFileSync(path.join(replacement.runRoot,'sources/atlas.json'),'utf8'));variantAtlas.frames.reverse();
 const atlasBytes=canonicalTextBytes(JSON.stringify(variantAtlas,null,2));fs.writeFileSync(path.join(replacement.runRoot,'sources/reversed-atlas.json'),atlasBytes,{flag:'wx'});
 const variantProject=JSON.parse(fs.readFileSync(path.join(replacement.runRoot,'project.json'),'utf8')),atlasFile=variantProject.files.find(row=>row.id==='f_atlas');atlasFile.path='sources/reversed-atlas.json';atlasFile.byteLength=atlasBytes.length;atlasFile.sha256=sha(atlasBytes);
 fs.writeFileSync(path.join(replacement.runRoot,'variant-project.json'),canonicalTextBytes(JSON.stringify(variantProject,null,2)),{flag:'wx'});
 const {runContentCLI}=await import('./build-content.mjs');
 const rebuilt=await runContentCLI(['--root',replacement.runRoot,'--project','variant-project.json','--recipe','recipe.json','--cache',path.join(replacement.runRoot,'cache'),'--output',path.join(replacement.runRoot,'build'),'--snapshot-out','candidate-2.json','--receipt','receipt-2.json','--selector','e_generation','--transaction','t_replacement']);assert.equal(rebuilt.status,'adopted');
 const replacementReceipt=JSON.parse(fs.readFileSync(path.join(replacement.runRoot,'receipt-2.json'),'utf8')),replacementCandidate=fs.readFileSync(path.join(replacement.runRoot,'candidate-2.json'));
 const replacementConfig={format:'egret.content-example/1',projectBaseUrl:'./',snapshotPath:'candidate-2.json',snapshot:{sha256:sha(replacementCandidate),byteLength:replacementCandidate.length},selectorId:'e_generation',manifestPath:replacementReceipt.manifestPath,manifest:replacementReceipt.receipt.manifest,generationId:replacementReceipt.generationId};
 fs.writeFileSync(path.join(replacement.runRoot,'browser-config-2.json'),canonicalTextBytes(JSON.stringify(replacementConfig,null,2)),{flag:'wx'});
 const replacementManifest=JSON.parse(fs.readFileSync(path.join(replacement.runRoot,replacementConfig.manifestPath),'utf8'));
 const replacementFiles=new Set(['browser-config-2.json','candidate-2.json','receipt-2.json','variant-project.json','recipe.json','sources/page.png','sources/other.png','sources/reversed-atlas.json',replacementConfig.manifestPath,...replacementManifest.entries.map(row=>row.artifact.path)]);
 report.replacementGeneration={generationId:replacementConfig.generationId,configuration:replacementConfig,files:[]};
 for(const file of replacementFiles){const row=pin(replacement.runRoot,file);save(snapshot,'replacement/'+file,row);routes.set('/replacement/'+file,{row,type:file.endsWith('.png')?'image/png':'application/json; charset=utf-8'});report.replacementGeneration.files.push(publicRow(row));}

 const config=jsonAt(generated.runRoot,'browser-config.json');assert.equal(config.projectBaseUrl,'./');assert.equal(config.snapshotPath,'candidate.json');
 const candidate=pin(generated.runRoot,'candidate.json');assert.equal(candidate.bytes,config.snapshot.byteLength);assert.equal(candidate.sha256,config.snapshot.sha256);
 const manifestRow=pin(generated.runRoot,config.manifestPath);assert.equal(manifestRow.bytes,config.manifest.byteLength);assert.equal(manifestRow.sha256,config.manifest.sha256);
 const manifest=JSON.parse(manifestRow.bytesRaw);assert.equal(manifest.entries.length,4);
 const byId=new Map(manifest.entries.map(entry=>[entry.id,entry]));assert.deepEqual([...byId.keys()].sort(),['e_atlas','e_other','e_page','e_sequence']);
 assert.deepEqual(byId.get('e_page').dependencies,[]);assert.deepEqual(byId.get('e_other').dependencies,[]);assert.deepEqual(byId.get('e_atlas').dependencies,['e_page']);assert.deepEqual(byId.get('e_sequence').dependencies,['e_atlas']);
 const generatedFiles=new Set(['browser-config.json','candidate.json','receipt.json','project.json','recipe.json',config.manifestPath,'sources/page.png','sources/other.png','sources/atlas.json']);
 for(const entry of manifest.entries){logicalPath(entry.artifact.path);const row=pin(generated.runRoot,entry.artifact.path);assert.equal(row.sha256,entry.artifact.sha256);assert.equal(row.bytes,entry.artifact.byteLength);generatedFiles.add(entry.artifact.path);}
 assert.notEqual(replacementConfig.generationId,config.generationId);
 report.generation={runRoot:generated.runRoot,config,files:[...generatedFiles].map(file=>publicRow(pin(generated.runRoot,file)))};
 for(const file of generatedFiles){const row=pin(generated.runRoot,file);save(snapshot,'content/'+file,row);routes.set('/content/'+file,{row,type:file.endsWith('.png')?'image/png':'application/json; charset=utf-8'});}
 for(const label of ['bad','held'])for(const file of generatedFiles){
  let row=pin(generated.runRoot,file);
  if(label==='bad'&&file===byId.get('e_sequence').artifact.path){const changed=Buffer.from(row.bytesRaw);changed[0]^=1;row={owner:'finite-negative-response',path:file,bytes:changed.length,sha256:sha(changed),bytesRaw:changed};report.badResponse={path:label+'/'+file,bytes:row.bytes,sha256:row.sha256,manifestSha256:byId.get('e_sequence').artifact.sha256};assert.notEqual(row.sha256,report.badResponse.manifestSha256);}
  save(snapshot,label+'/'+file,row);routes.set('/'+label+'/'+file,{row,type:file.endsWith('.png')?'image/png':'application/json; charset=utf-8'});finiteVariants.set(label+'/'+file,row);
 }
 for(const [file,row]of files)save(snapshot,file,row);
 for(const [file,row]of sources)save(sourceSnapshot,file,row);
 report.variantResponses=[...finiteVariants].map(([route,row])=>({route,...publicRow(row)}));
 report.files=[...files].map(([route,row])=>({route,...publicRow(row)}));report.source=[...sources].map(([snapshotPath,row])=>({snapshotPath,...publicRow(row)}));report.sourceFreeze={beforeBrowserLaunch:true,files:inputs.size,bytes:totalBytes};
 fs.writeFileSync(path.join(output,'source-freeze.json'),canonicalTextBytes(JSON.stringify({files:report.files,source:report.source,generation:report.generation,replacementGeneration:report.replacementGeneration,variantResponses:report.variantResponses,toolkit},null,2)),{flag:'wx'});
 record('real generated candidate, exact four resources and pinned bytes',{generationId:config.generationId});
 const served=new Set();report.served=[];
 server=http.createServer((req,res)=>{
  try{
   const route=req.url==='/'+html+'?config=/content/browser-config.json'?'/'+html:req.url;
   const selected=['GET','HEAD'].includes(req.method)&&req.url?.length<=2048?routes.get(route):undefined;
   if(!selected){res.writeHead(404);res.end();return;}
   const {row,type}=selected;const disk=fs.readFileSync(path.join(snapshot,route.slice(1)));assert.equal(disk.length,row.bytes);assert.equal(sha(disk),row.sha256);
   served.add(req.url);
   if(route==='/held/'+byId.get('e_sequence').artifact.path){assert.equal(heldResponse,undefined);heldResponse={res,bytes:disk,closed:false,responded:false};res.once('close',()=>{heldResponse.closed=true;});resolveHeld();return;}
   res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:disk);
  }catch(error){report.errors.push('server: '+String(error));res.writeHead(500);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const {chromium}=await import(pathToFileURL(path.join(pw,'index.mjs')).href);browser=await chromium.launch({channel:'msedge',headless:true,timeout:15000});report.environment.browser=browser.version();
 context=await browser.newContext({viewport:{width:900,height:700},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push('page: '+String(error)));
 // Query is permitted only for the exact entry navigation; the serving lookup stays query-free.
 await page.goto('http://127.0.0.1:'+server.address().port+'/'+html+'?config=/content/browser-config.json');
 await page.waitForFunction(()=>!!window.contentBuildExample);report.startup=await bounded(page.evaluate(()=>window.contentBuildExample.ready),'native ready');
 const call=(method,...values)=>bounded(page.evaluate(({method,values})=>window.contentBuildExample[method](...values),{method,values}),'native '+method);
 async function frame(label,color){
  const read=await page.locator('#scene').evaluate(canvas=>({width:canvas.width,height:canvas.height,rgba:Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data),png:canvas.toDataURL('image/png').split(',')[1]}));
  const bytes=Buffer.from(read.rgba),name=label+'.rgba';fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});fs.writeFileSync(path.join(output,label+'-canvas.png'),Buffer.from(read.png,'base64'),{flag:'wx'});await page.screenshot({path:path.join(output,label+'-page.png')});
  const row={label,width:read.width,height:read.height,path:name,bytes:bytes.length,sha256:sha(bytes)};report.rawFrames.push(row);const saved=fs.readFileSync(path.join(output,name));assert.equal(sha(saved),row.sha256);assert.equal(read.width,12);assert.equal(read.height,6);
  const expected=contentPixelOracle(color[0]===255?'red':'green');
  assert.deepEqual(saved,expected,'All 72 independent authored pixel values: '+label);record(label+' all 72 native Canvas pixels',{rgba:row});
 }
 assert.equal(report.startup.state,'ready');assert.deepEqual(report.startup.diagnostics,[]);assert.equal(report.startup.generationId,config.generationId);await frame('startup-red',[255,0,0,255]);
 report.advanced=await call('advance',0.125);assert.equal(report.advanced.state,'ready');await frame('advanced-green',[0,255,0,255]);
 report.completed=await call('advance',0.375);assert.equal(report.completed.playbackState,'completed');await frame('completed-green',[0,255,0,255]);
 const oldGeneration=config.generationId;
 report.failedReplacement=await call('replace','/bad/browser-config.json');assert.equal(report.failedReplacement.state,'ready');assert.equal(report.failedReplacement.generationId,oldGeneration);assert.equal(report.failedReplacement.attempts.at(-1).status,'failed');assert.ok(report.failedReplacement.attempts.at(-1).error.code);for(const row of report.failedReplacement.retired)assertRetired(row);await frame('failed-replacement-keeps-green',[0,255,0,255]);report.negativeBrowserCase=true;record('actual bad metadata bytes refuse without replacing usable generation',{error:report.failedReplacement.attempts.at(-1).error,response:report.badResponse});
 await page.evaluate(()=>{window.pendingContentReplacement=window.contentBuildExample.replace('/held/browser-config.json');return true;});await bounded(heldEntered,'actual held metadata request');
 report.beforeCancellation=await call('cancelReplacement');assert.equal(report.beforeCancellation.pending.cancelled,true);
 heldResponse.responded=true;heldResponse.res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});heldResponse.res.end(heldResponse.bytes);
 report.cancelledReplacement=await bounded(page.evaluate(()=>window.pendingContentReplacement),'cancelled replacement settlement');assert.equal(report.cancelledReplacement.generationId,oldGeneration);assert.equal(report.cancelledReplacement.attempts.at(-1).status,'cancelled');for(const row of report.cancelledReplacement.retired)assertRetired(row);await frame('cancelled-replacement-keeps-green',[0,255,0,255]);report.heldRequest={actualRequestEntered:true,cancelIssued:true,lateResponseIssued:heldResponse.responded,transportClosed:heldResponse.closed};record('actual pending HTTP cancellation rejects late generation and drains',{heldRequest:report.heldRequest});
 report.replaced=await call('replace','/replacement/browser-config-2.json');assert.equal(report.replaced.state,'ready');assert.equal(report.replaced.generationId,replacementConfig.generationId);assert.equal(report.replaced.attempts.at(-1).status,'ready');for(const row of report.replaced.retired)assertRetired(row);await frame('replacement-starts-green',[0,255,0,255]);
 report.replacementAdvanced=await call('advance',0.625);await frame('replacement-advances-red',[255,0,0,255]);report.replacementCompleted=await call('advance',0.75);assert.equal(report.replacementCompleted.playbackState,'completed');await frame('replacement-completes-red',[255,0,0,255]);record('same logical IDs select coherent newly built generation',{previousGeneration:oldGeneration,nextGeneration:replacementConfig.generationId});
 report.closed=await call('close');const closed=report.closed;assertClosed(closed);
 report.cleanup.application=true;record('native public ownership cleanup and zero outstanding counters',{retirement:closed.retirement,source:closed.source,provider:closed.provider});
 report.served=[...served].sort();assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure={name:error?.name??'Error',message:String(error?.message??error),stack:error?.stack};}
finally{
 if(heldResponse&&!heldResponse.responded){heldResponse.responded=true;heldResponse.res.end(heldResponse.bytes);}
 if(page&&!report.cleanup.application)try{report.failedRunClose=await bounded(page.evaluate(()=>window.contentBuildExample?.close()),'failed run close');assertClosed(report.failedRunClose);report.cleanup.application=true;}catch(error){report.errors.push('application close: '+String(error));}
 try{await context?.close();report.cleanup.context=true;}catch(error){report.errors.push('context: '+String(error));}
 try{await browser?.close();report.cleanup.browser=true;}catch(error){report.errors.push('browser: '+String(error));}
 try{if(server?.listening)await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});report.cleanup.server=true;}catch(error){report.errors.push('server: '+String(error));}
 try{
  for(const [file,row]of files){const actual=fingerprintFile(snapshot,file);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
  for(const [file,row]of sources){const actual=fingerprintFile(sourceSnapshot,file);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
  for(const [file,row]of finiteVariants){const actual=fingerprintFile(snapshot,file);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
  if(report.replacementGeneration)for(const row of report.replacementGeneration.files){const actual=fingerprintFile(snapshot,'replacement/'+row.path);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
  if(report.generation)for(const row of report.generation.files){const actual=fingerprintFile(snapshot,'content/'+row.path);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
  report.snapshotIntegrity=!!report.sourceFreeze;
  for(const row of inputs.values()){const actual=fingerprintFile(row.owner,row.path);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
  for(const tool of toolkit)for(const row of tool.files)assert.deepEqual(fingerprintFile(tool.owner,row.path),row);
  report.sourceIntegrity=true;
 }catch(error){report.errors.push('integrity: '+String(error));}
 if(report.errors.length||!Object.values(report.cleanup).every(Boolean)||!report.snapshotIntegrity||!report.sourceIntegrity)report.status='FAIL';
 report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'result.json'),canonicalTextBytes(JSON.stringify(report,null,2)),{flag:'wx'});
 console.log(JSON.stringify({output,status:report.status,checks:report.checks.length,rawFrames:report.rawFrames.length,failure:report.failure,errors:report.errors,cleanup:report.cleanup,snapshotIntegrity:report.snapshotIntegrity,sourceIntegrity:report.sourceIntegrity}));if(report.status!=='PASS')process.exitCode=1;
}

}
if(process.argv[1]&&samePhysicalPath(fileURLToPath(import.meta.url),path.resolve(process.argv[1])))await collect();
