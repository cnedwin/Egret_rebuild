// SPDX-License-Identifier: Apache-2.0
// Produce actual source/build facts for the original admission schema; never approve a review.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {historyPin,verifyHistoryPins} from './browser-history.mjs';
import {samePhysicalPath,ownerRelativePath,canonicalTextBytes} from './lib/file-identity.mjs';
import {assertBrowserEnvironment} from './browser-verify.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url))),check=(ok,text)=>{if(!ok)throw Error(text);};
const CONFIG=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json','tools/build.mjs','tools/generate-project-format.mjs','packages/contracts/schema/project-format.schema.json',...['contracts','runtime','engine','project'].flatMap(n=>['packages/'+n+'/package.json','packages/'+n+'/tsconfig.json']),'packages/engine/tsconfig.rendering.json','packages/engine/tsconfig.web.json','node_modules/typescript/bin/tsc','node_modules/typescript/package.json'];
const PRODUCTS={'sequence-playback':['packages/engine/src/sequencePlaybackTypes.ts','packages/engine/src/sequencePlayback.ts','packages/engine/src/Engine.ts','packages/engine/src/index.ts'],spritesheet:['packages/runtime/src/spriteSheet.ts','packages/runtime/src/Bitmap.ts','packages/runtime/src/index.ts','packages/engine/src/index.ts']};
const logical=file=>({...historyPin(path.join(ROOT,file)),path:file});
function inventory(kind){const files=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){check(!entry.isSymbolicLink(),'SDK input links refused');const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(entry.isFile()&&(kind==='source'?entry.name.endsWith('.ts'):/\.js$|\.d\.ts$/.test(entry.name)))files.push(logical(path.relative(ROOT,file).replaceAll(path.sep,'/')));check(files.length<=2048,'SDK inventory budget');}}for(const name of ['contracts','runtime','engine','project'])for(const dir of kind==='source'?['src',...(name==='engine'?['web','rendering']:[])]:['dist'])visit(path.join(ROOT,'packages',name,dir));return files;}
function save(file,value){fs.writeFileSync(file,canonicalTextBytes(JSON.stringify(value,null,2)),{flag:'wx'});return historyPin(file);}
export function prepareHistoryBuild(args){
 check(args.length===4&&args[0]==='--suite'&&Object.hasOwn(PRODUCTS,args[1])&&args[2]==='--output'&&path.isAbsolute(args[3]),'Expected --suite sequence-playback|spritesheet --output absolute-fresh-directory');
 assertBrowserEnvironment(process.env);check(process.version==='v26.7.0'&&process.platform==='win32'&&process.arch==='x64'&&!process.execArgv.length,'Fixed Node26.7 Windows x64 required');const suite=args[1],out=path.resolve(args[3]);check(samePhysicalPath(path.dirname(out),fs.realpathSync(path.dirname(out)))&&!fs.existsSync(out),'Fresh canonical output required');let inside=false;try{ownerRelativePath(ROOT,out);inside=true;}catch{}check(!inside&&!samePhysicalPath(ROOT,out),'External output required');fs.mkdirSync(out);
 const sdkSourcePins=inventory('source'),configurationPins=CONFIG.map(logical),runtimePin=historyPin(process.execPath);
 const compilerOwnerPins=[...['package.json','bin/tsc','lib/tsc.js','lib/getExePath.js'].map(n=>historyPin(path.join(ROOT,'node_modules/typescript',n))),...['package.json','lib/tsc.exe'].map(n=>historyPin(path.join(ROOT,'node_modules/@typescript/typescript-win32-x64',n))),runtimePin];
 const sourcePins=[...sdkSourcePins,...configurationPins].map(x=>({...x,path:path.join(ROOT,x.path)}));
 const git=arg=>{const r=spawnSync('git',arg,{cwd:ROOT,encoding:'utf8'});check(r.status===0,'Git source identity failed');return r.stdout.trim();};
 const sourceBase={head:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}'])};
 const name='actual-sdk-build',command={name,exe:process.execPath,args:['tools/build.mjs'],cwd:ROOT};const jobPin=save(path.join(out,'job.json'),{commands:[command]});
 const startedAtUtc=new Date().toISOString(),r=spawnSync(command.exe,command.args,{cwd:ROOT,windowsHide:true,timeout:120000,maxBuffer:64*1024*1024});const finishedAtUtc=new Date().toISOString();
 fs.writeFileSync(path.join(out,'stdout.bin'),r.stdout??Buffer.alloc(0),{flag:'wx'});fs.writeFileSync(path.join(out,'stderr.bin'),r.stderr??Buffer.alloc(0),{flag:'wx'});
 const stdoutPin=historyPin(path.join(out,'stdout.bin')),stderrPin=historyPin(path.join(out,'stderr.bin'));
 const receiptPin=save(path.join(out,'build-receipt.json'),[{name,exe:command.exe,cwd:ROOT,args:command.args,exitCode:r.status,signal:r.signal,error:r.error?.message??null,timeout:r.error?.code==='ETIMEDOUT',startedAtUtc,finishedAtUtc,stdout:stdoutPin.path,stdoutSHA256:stdoutPin.sha256,stderr:stderrPin.path,stderrSHA256:stderrPin.sha256}]);
 check(!r.error&&r.status===0&&r.signal===null,'Actual build failed; raw attempt retained');verifyHistoryPins(sourcePins);verifyHistoryPins(compilerOwnerPins);
 check(JSON.stringify(inventory('source'))===JSON.stringify(sdkSourcePins),'Source membership drift');
 const workspaceAliases=['contracts','runtime','engine','project'].map(n=>{const logical=path.join(ROOT,'node_modules/@egret',n),physical=path.join(ROOT,'packages',n);check(samePhysicalPath(fs.realpathSync(logical),physical),'Workspace owner differs');return {name:'@egret/'+n,logical,physical,packagePin:historyPin(path.join(physical,'package.json'))};});
 const facts={repositoryRoot:ROOT,sourceBase,runtimePin,sdkSourcePins,sdkEmittedPins:inventory('emitted'),configurationPins,compilerOwnerPins,productSourcePins:PRODUCTS[suite].map(logical),...(suite==='spritesheet'?{workspaceAliases}:{})};
 const build={receiptPin,jobPin,stdoutPin,stderrPin,runtimePin,commandName:name};
 const inventoryPin=save(path.join(out,'inventory.json'),{schemaVersion:suite+'-sdk-build-inventory/1',status:suite==='spritesheet'?'CURRENT_SDK_INVENTORY_DATA_PENDING_INDEPENDENT_ACTUAL_REVIEW':'ROOT_FROZEN_ACTUAL_SDK_BUILD_INVENTORY',state:'ACTUAL_BUILD_PENDING_REVIEW',originalActualReviewPin:null,...facts,build});
 const draft=save(path.join(out,'admission.pending.json'),{schemaVersion:suite+'-native-admission/1',status:'PENDING_INDEPENDENT_REVIEW',...facts,build:{...build,inventoryPin},reviews:{}});
 return {status:'ACTUAL_BUILD_PENDING_REVIEW',draft,inventoryPin,receiptPin,reviewed:false,browserRun:false};
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))console.log(JSON.stringify(prepareHistoryBuild(process.argv.slice(2)),null,2));
