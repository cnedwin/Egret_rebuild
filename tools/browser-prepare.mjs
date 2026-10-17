// SPDX-License-Identifier: Apache-2.0
// Preparation records source identity only; a separate review precedes native execution.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assertBrowserEnvironment} from './browser-verify.mjs';
import {samePhysicalPath,ownerRelativePath,fingerprintFile} from './lib/file-identity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const matrix=JSON.parse(fs.readFileSync(new URL('./browser-tool-matrix.json',import.meta.url),'utf8'));
export function prepareBrowser(args){
 assertBrowserEnvironment(process.env);
 if(process.version!=='v'+matrix.node||process.execArgv.length||process.platform!==matrix.platform||process.arch!==matrix.architecture)throw Error('Selected Windows x64 / Node '+matrix.node+' without extra flags required');
 const options={};for(let i=0;i<args.length;i+=2){if(!['--suite','--output'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))throw Error('Expected unique --suite and --output');options[args[i]]=args[i+1];}
 const selected=matrix.current.find(row=>row.id===options['--suite']&&row.snapshot);
 if(!selected||!path.isAbsolute(options['--output']??''))throw Error('Declared snapshot suite and fresh absolute output file required');
 const output=path.resolve(options['--output']),parent=path.dirname(output);
 if(!samePhysicalPath(parent,fs.realpathSync.native(parent))||fs.existsSync(output))throw Error('Output needs canonical existing parent and absent file');
 let inside=samePhysicalPath(root,output);try{ownerRelativePath(root,output);inside=true;}catch{}if(inside)throw Error('Snapshot must be outside repository');
 const pins=['tools/browser-prepare.mjs','tools/browser-verify.mjs','tools/browser-tool-matrix.json',selected.script].map(file=>fingerprintFile(root,file));
 const child=spawnSync(process.execPath,[path.join(root,selected.script),'--repository',root,'--snapshot',output,'--snapshot-only'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024});
 if(child.error||child.status!==0)throw Error('Source preparation failed: '+(child.error?.message??child.stderr));
 if(!pins.every(pin=>JSON.stringify(fingerprintFile(root,pin.path))===JSON.stringify(pin)))throw Error('Preparation inputs changed');
 const result=JSON.parse(child.stdout),pin=fingerprintFile(parent,path.basename(output));
 if(result.status!=='SOURCE_SNAPSHOT_ONLY_NO_BROWSER'||result.sha256!==pin.sha256||result.bytes!==pin.bytes)throw Error('Incomplete source preparation receipt');
 const receipt={suite:selected.id,status:result.status,snapshot:output,bytes:pin.bytes,sha256:pin.sha256,reviewed:false,browserRun:false,inputs:pins};
 console.log(JSON.stringify(receipt,null,2));return receipt;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))prepareBrowser(process.argv.slice(2));
