// SPDX-License-Identifier: Apache-2.0
// Local in-memory adoption plus exclusive candidate export; never an atomic disk-current replacement.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {lstatSync,readdirSync,realpathSync,openSync,writeFileSync,closeSync} from 'node:fs';
import {visit,parseTree} from 'jsonc-parser';
import {parseProjectSnapshot,serializeProjectSnapshot,createProjectStore} from '@egret/project';
import {logicalPath,samePhysicalPath} from './lib/file-identity.mjs';
import {readContentInput} from './content/input.mjs';
import {buildContentProject} from './content/build.mjs';
const FLAGS=['root','project','recipe','cache','output','snapshot-out','receipt','selector','transaction'];
const fail=(code,message)=>Object.assign(new Error(message),{code:'CONTENT_CLI_'+code});
function args(values){
 const result=Object.create(null);
 for(let i=0;i<values.length;i+=2){const flag=values[i];if(!flag.startsWith('--')||!FLAGS.includes(flag.slice(2))||Object.hasOwn(result,flag.slice(2))||!values[i+1]||values[i+1].startsWith('--'))throw fail('ARGUMENT','Expected exactly one value for each supported flag.');result[flag.slice(2)]=values[i+1];}
 if(FLAGS.some(key=>!Object.hasOwn(result,key)))throw fail('ARGUMENT','All nine explicit flags are required.');
 for(const key of ['root','cache','output'])if(!path.isAbsolute(result[key]))throw fail('ARGUMENT',key+' must be absolute.');
 for(const key of ['project','recipe','snapshot-out','receipt'])try{logicalPath(result[key]);}catch{throw fail('ARGUMENT',key+' must be a canonical owner-relative path.');}
 if(!/^e_[A-Za-z0-9_-]+$/.test(result.selector)||!/^t_[A-Za-z0-9_-]+$/.test(result.transaction))throw fail('ARGUMENT','Explicit selector e_* and transaction t_* identifiers required.');
 return result;
}
function directory(target){const stat=lstatSync(target);if(!stat.isDirectory()||stat.isSymbolicLink()||!samePhysicalPath(target,realpathSync(target)))throw fail('OUTPUT','An existing genuine directory is required.');}
function destination(owner,relative){
 directory(owner);let parent=owner;const parts=relative.split('/');
 for(const part of parts.slice(0,-1)){if(!readdirSync(parent).includes(part))throw fail('OUTPUT','Output parent spelling must exist exactly.');parent=path.join(parent,part);directory(parent);}
 const name=parts.at(-1);if(readdirSync(parent).some(entry=>process.platform==='win32'?entry.toLowerCase()===name.toLowerCase():entry===name))throw fail('OUTPUT','Refusing existing output: '+relative);
 return path.join(parent,name);
}
function text(owner,relative){try{return new TextDecoder('utf-8',{fatal:true}).decode(readContentInput(owner,relative,{maximum:4194304}));}catch(error){if(error instanceof TypeError)throw fail('UTF8','Configuration must be valid UTF-8.');throw error;}}
function strictRecipe(source){
 const stack=[];let depth=0;
 const begin=object=>{if(++depth>32)throw fail('JSON','Recipe nesting exceeds 32.');stack.push(object?new Set():null);};
 const end=()=>{depth--;stack.pop();};
 visit(source,{onObjectBegin(){begin(true);},onArrayBegin(){begin(false);},onObjectEnd:end,onArrayEnd:end,onObjectProperty(key){const keys=stack.at(-1);if(keys.has(key))throw fail('JSON','Duplicate recipe key: '+key);keys.add(key);},onError(){throw fail('JSON','Strict JSON recipe required.');}},{disallowComments:true,allowTrailingComma:false});
 const errors=[];parseTree(source,errors,{disallowComments:true,allowTrailingComma:false});if(errors.length)throw fail('JSON','Strict JSON recipe required.');
 try{return JSON.parse(source);}catch{throw fail('JSON','Strict JSON recipe required.');}
}
function checked(result,code){if(!result.ok)throw fail(code,JSON.stringify(result.diagnostics));return result.value;}
function exclusive(owner,relative,content){const file=destination(owner,relative),handle=openSync(file,'wx');try{writeFileSync(handle,content,{encoding:'utf8'});}finally{closeSync(handle);}}
export async function runContentCLI(values){
 const options=args(values);for(const key of ['root','cache','output'])directory(options[key]);
 const targets=['snapshot-out','receipt'].map(key=>destination(options.root,options[key]));
 if(samePhysicalPath(targets[0],targets[1]))throw fail('OUTPUT','Candidate and receipt require different new filenames.');
 const snapshot=checked(parseProjectSnapshot(text(options.root,options.project)),'SNAPSHOT'),recipe=strictRecipe(text(options.root,options.recipe));
 const projectStore=checked(createProjectStore(snapshot),'SNAPSHOT');
 const result=await buildContentProject({projectStore,projectRoot:options.root,recipe,cacheRoot:options.cache,outputRoot:options.output,selectorId:options.selector,transactionId:options.transaction});
 const report={...result,manifest:undefined,export:{kind:'new-candidate',atomicDiskReplacement:false,snapshotPath:result.status==='adopted'?options['snapshot-out']:null}};
 // Readiness without adoption is recorded faithfully and does not export an adopted snapshot.
 if(result.status==='adopted')exclusive(options.root,options['snapshot-out'],checked(serializeProjectSnapshot(projectStore.getSnapshot()),'SNAPSHOT'));
 exclusive(options.root,options.receipt,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:result.status==='adopted'?0:1,generationId:result.generationId,receiptPath:options.receipt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const result=await runContentCLI(process.argv.slice(2));process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.exitCode;}
 catch(error){process.stderr.write(JSON.stringify({code:error?.code??'CONTENT_CLI_FAILED',message:error instanceof Error?error.message:String(error)})+'\n');process.exitCode=1;}
}
