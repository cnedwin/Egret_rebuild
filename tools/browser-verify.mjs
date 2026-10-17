// SPDX-License-Identifier: Apache-2.0
// Fixed current browser entry; absent capabilities and child failures never pass.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {fingerprintFile,samePhysicalPath,ownerRelativePath,canonicalTextBytes} from './lib/file-identity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const matrix=JSON.parse(fs.readFileSync(new URL('./browser-tool-matrix.json',import.meta.url),'utf8'));
export function parseBrowserOptions(args){
 const result={};for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--suite','--playwright','--output'].includes(key)||Object.hasOwn(result,key.slice(2))||!args[i+1])throw Error('Expected unique --suite, --playwright and --output values');result[key.slice(2)]=args[i+1];}
 if(Object.keys(result).length!==3||!matrix.current.some(row=>row.id===result.suite))throw Error('A declared current suite is required');return result;
}

/** Refuse inherited loaders before creating outputs or spawning a collector. */
export function assertBrowserEnvironment(env){
 for(const key of Object.keys(env))if(['NODE_OPTIONS','NODE_PATH'].includes(key.toUpperCase())&&env[key])throw Error('Inherited Node loader configuration is not accepted: '+key);
}
/** A zero exit is necessary, but never substitutes for a suite completion receipt. */
export function readCompletion(suite,output,stdout){
 const receipt=suite==='canvas'?JSON.parse(stdout):JSON.parse(fs.readFileSync(path.join(output,'result.json'),'utf8'));
 if(suite==='canvas'){
  if(!receipt.browser||receipt.playwright!==matrix.playwright||receipt.channel!==matrix.channel||receipt.headless!==true||receipt.pointerPixelsChanged!==true||!receipt.checks?.length||receipt.counterexample?.failed!==true||receipt.unexpectedErrors?.length!==0)throw Error('Incomplete Canvas receipt');
  for(const name of ['example-before.png','example-after.png','acceptance.png'])if(!fs.statSync(path.join(output,name)).isFile()||fs.statSync(path.join(output,name)).size===0)throw Error('Missing Canvas artifact');
 }else if(suite==='webgpu'){
  if(receipt.status!=='PASS'||!receipt.browser||receipt.originalProductPreserved!==true||receipt.fixtureFailures?.length!==0||!(receipt.counts?.rawChecks>0)||!(receipt.counts?.counterexamples>0))throw Error('Incomplete WebGPU receipt');
 }else if(suite==='b1'){
  if(receipt.status!=='PASS'||receipt.exitCode!==0||!receipt.browserVersion||receipt.cleanupFailures?.length!==0||receipt.counts?.positiveFrames!==7||receipt.counts?.counterexamples!==5)throw Error('Incomplete B1 receipt');
 }else if(suite==='text'){
  if(receipt.status!=='PASS_WC1_CANVAS_SUBSET'||receipt.exitCode!==0||receipt.identitiesStable!==true)throw Error('Incomplete text subset receipt');
 }else throw Error('Unknown completion suite');
 return {status:receipt.status??'PASS_CANVAS_SUBSET',browser:receipt.browser??receipt.browserVersion??null};
}

export function runBrowser(args){
 assertBrowserEnvironment(process.env);
 const options=parseBrowserOptions(args);
 if(process.version!=='v'+matrix.node||process.execArgv.length||process.platform!==matrix.platform||process.arch!==matrix.architecture)throw Error('Selected Windows x64 / Node '+matrix.node+' without extra flags required');
 if(fs.readFileSync(path.join(root,'.node-version'),'utf8').trim()!==matrix.node)throw Error('Browser and repository Node versions differ');
 if(!path.isAbsolute(options.playwright)||!path.isAbsolute(options.output))throw Error('Absolute installed package and fresh output paths required');
 const installed=fs.realpathSync.native(options.playwright),output=path.resolve(options.output);
 const parent=path.dirname(output);
 if(!samePhysicalPath(parent,fs.realpathSync.native(parent))||fs.existsSync(output))throw Error('Output requires a canonical existing parent and absent child');
 for(const owner of [root,installed]){
  if(samePhysicalPath(owner,output))throw Error('Output overlaps an input owner');
  let inside=false;try{ownerRelativePath(owner,output);inside=true;}catch{}if(inside)throw Error('Output is inside an input owner');
 }
 const packagePin=fingerprintFile(installed,'package.json'),meta=JSON.parse(fs.readFileSync(path.join(installed,'package.json')));
 const require=createRequire(path.join(installed,'package.json')),core=path.dirname(require.resolve('playwright-core/package.json'));
 const corePin=fingerprintFile(core,'package.json'),coreMeta=JSON.parse(fs.readFileSync(path.join(core,'package.json')));
 if(meta.name!=='playwright'||meta.version!==matrix.playwright||coreMeta.name!=='playwright-core'||coreMeta.version!==matrix.playwright)throw Error('Exact installed Playwright/core '+matrix.playwright+' required');
 let overlapsCore=samePhysicalPath(core,output);try{ownerRelativePath(core,output);overlapsCore=true;}catch{}if(overlapsCore)throw Error('Output overlaps the installed core');
 const selected=matrix.current.find(row=>row.id===options.suite);
 const pins=[fingerprintFile(root,'tools/browser-verify.mjs'),fingerprintFile(root,'tools/browser-tool-matrix.json'),fingerprintFile(root,selected.script)];
 fs.mkdirSync(output);const childOutput=path.join(output,'artifacts');
 const childArgs=[path.join(root,selected.script),'--playwright',installed,...(selected.channel?['--channel',matrix.channel]:[]),'--output',childOutput];
 const started=new Date().toISOString();
 const result=spawnSync(process.execPath,childArgs,{cwd:root,windowsHide:true,encoding:'utf8',timeout:300000,maxBuffer:64*1024*1024});
 fs.writeFileSync(path.join(output,'stdout.log'),result.stdout??'');fs.writeFileSync(path.join(output,'stderr.log'),result.stderr??'');
 const stable=pins.every(pin=>JSON.stringify(fingerprintFile(root,pin.path))===JSON.stringify(pin))&&JSON.stringify(fingerprintFile(installed,'package.json'))===JSON.stringify(packagePin)&&JSON.stringify(fingerprintFile(core,'package.json'))===JSON.stringify(corePin);
 let completion=null,completionError=null;try{completion=readCompletion(options.suite,childOutput,result.stdout??'');}catch(error){completionError=error.message;}
 const report={completion,completionError,schemaVersion:1,suite:options.suite,node:process.version,playwright:matrix.playwright,channel:matrix.channel,started,finished:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.message??null,inputs:pins,stable,status:!result.error&&result.status===0&&stable&&completion?'PASS':'INCOMPLETE',limits:['Only the selected suite and its recorded domain.','No phone, performance, complete engine or independent OS process-retirement acceptance.','Advanced and historical collectors retain separate obligations.']};
 fs.writeFileSync(path.join(output,'result.json'),canonicalTextBytes(JSON.stringify(report,null,2)));
 console.log(JSON.stringify(report));if(report.status!=='PASS')throw Error('Browser suite did not pass; inspect retained stdout/stderr and child artifacts');return report;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))runBrowser(process.argv.slice(2));
