// SPDX-License-Identifier: Apache-2.0
// Explicit finite byte builder. No importer discovery or executable asset inputs.
import {readSync,fstatSync,lstatSync,readdirSync,realpathSync,openSync,writeFileSync,closeSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseProjectSnapshot,DEFAULT_PROJECT_LIMITS} from '@egret/project';
import {describeResourceBuild} from '@egret/project/resources';
import {buildResourceManifest,serializeResourceManifest,getResourceManifestIdentityInputs} from '@egret/contracts/resources';
import {canonicalTextBytes,logicalPath,ownerRelativePath,samePhysicalPath} from './lib/file-identity.mjs';

const names=['--project','--root','--target','--out','--receipt'];
function argumentsForBuild(args){
  if(args.length!==10)throw new TypeError('Usage: build-resource-manifest --project <snapshot> --root <owner> --target <profile> --out <manifest> --receipt <receipt>');
  const out=new Map();for(let i=0;i<args.length;i+=2){if(!names.includes(args[i])||out.has(args[i])||!args[i+1])throw new TypeError('Exactly one of each builder argument is required.');out.set(args[i],args[i+1]);}return out;
}
function checked(result){if(!result.ok)throw new TypeError(JSON.stringify(result.diagnostics));return result.value;}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const READ_CHUNK_BYTES=65536;
function authenticatedInput(owner,relative){
  logicalPath(relative);
  let current=owner,stat;
  const components=relative.split('/');
  for(let index=0;index<components.length;index++){
    const component=components[index];
    if(!readdirSync(current).includes(component))throw new TypeError('File spelling differs from its portable identity: '+relative);
    current=path.join(current,component);stat=lstatSync(current);
    if(stat.isSymbolicLink()||(index===components.length-1?!stat.isFile():!stat.isDirectory()))throw new TypeError('Non-regular or symbolic input: '+relative);
    if(!samePhysicalPath(current,realpathSync(current)))throw new TypeError('Input has another physical owner: '+relative);
  }
  return {absolute:current,stat};
}
const sameFile=(first,second)=>first.dev===second.dev&&first.ino===second.ino;
function readInput(owner,relative,{expectedLength,project=false}={}){
  const located=authenticatedInput(owner,relative);
  const handle=openSync(located.absolute,'r');
  try{
    // Validate the opened object before allocating either the fixed resource
    // buffer or the bounded project payload. A length mismatch reads no bytes.
    const initial=fstatSync(handle);
    if(!initial.isFile()||!sameFile(initial,located.stat))throw new TypeError('Opened input file identity changed: '+relative);
    const size=initial.size;
    if(!Number.isSafeInteger(size)||size<0)throw new RangeError('Input file size is not a nonnegative safe integer.');
    if(project&&size>DEFAULT_PROJECT_LIMITS.maxSnapshotUtf8Bytes)throw new RangeError('Project input exceeds its byte limit.');
    if(expectedLength!==undefined&&size!==expectedLength)throw new TypeError('Actual file byte length mismatch: '+relative);
    const buffer=Buffer.allocUnsafe(READ_CHUNK_BYTES);
    const payload=project?Buffer.allocUnsafe(size):undefined;
    const digest=createHash('sha256');let offset=0;
    while(offset<size){
      const requested=Math.min(READ_CHUNK_BYTES,size-offset);
      const count=readSync(handle,buffer,0,requested,offset);
      if(count===0)throw new TypeError('Input file became short before its declared byte length: '+relative);
      if(!Number.isInteger(count)||count<0||count>requested)throw new TypeError('Invalid actual file read count: '+relative);
      const chunk=buffer.subarray(0,count);digest.update(chunk);if(payload)payload.set(chunk,offset);offset+=count;
    }
    // A pre-read size alone cannot prove EOF if a real file grows concurrently.
    if(readSync(handle,buffer,0,1,size)!==0)throw new TypeError('Input file byte length grew during reading: '+relative);
    const final=fstatSync(handle),named=authenticatedInput(owner,relative);
    if(!final.isFile()||!sameFile(initial,final)||!sameFile(final,named.stat)||final.size!==size
      ||final.mtimeMs!==initial.mtimeMs||final.ctimeMs!==initial.ctimeMs)throw new TypeError('Input file identity, size or bytes changed during reading: '+relative);
    return {path:relative,bytes:size,sha256:digest.digest('hex'),...(payload?{data:payload}:{})};
  }finally{closeSync(handle);}
}
function newOutput(owner,filename){
  const absolute=path.resolve(filename),relative=ownerRelativePath(owner,absolute);logicalPath(relative);
  let current=owner;const parts=relative.split('/');
  for(let i=0;i<parts.length-1;i++){
    if(!readdirSync(current).includes(parts[i]))throw new TypeError('Output parent spelling does not match its owner.');
    current=path.join(current,parts[i]);const state=lstatSync(current);
    if(!state.isDirectory()||state.isSymbolicLink()||!samePhysicalPath(current,realpathSync(current)))throw new TypeError('Output parent must be a genuine contained directory.');
  }
  // Include case aliases on Windows; an existing file is never output authority.
  const candidate=parts.at(-1),siblings=readdirSync(current);
  if(siblings.some(name=>process.platform==='win32'?name.toLowerCase()===candidate.toLowerCase():name===candidate))throw new TypeError('Existing output/receipt evidence cannot be overwritten.');
  return absolute;
}
function main(){
  const args=argumentsForBuild(process.argv.slice(2)),owner=path.resolve(args.get('--root'));
  const state=lstatSync(owner);if(!state.isDirectory()||state.isSymbolicLink()||!samePhysicalPath(owner,realpathSync(owner)))throw new TypeError('Canonical physical input owner required.');
  const projectPath=path.resolve(args.get('--project')),projectRelative=ownerRelativePath(owner,projectPath);
  // Read the bounded project once through the same authenticated open handle
  // whose actual bytes define its receipt. Resources are never retained whole.
  const projectPin=readInput(owner,projectRelative,{project:true});
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(projectPin.data);
  const snapshot=checked(parseProjectSnapshot(text)),description=checked(describeResourceBuild(snapshot,args.get('--target')));
  const files=new Map();for(const entry of description.entries)for(const file of [entry.source,entry.artifact])files.set(file.id,file);
  const verified=[];
  for(const [id,file] of [...files].sort(([a],[b])=>a<b?-1:a>b?1:0)){
    const pin=readInput(owner,file.path,{expectedLength:file.byteLength});
    if(pin.bytes!==file.byteLength||pin.sha256!==file.sha256)throw new TypeError('Actual file byte length or SHA-256 digest mismatch: '+file.path);
    verified.push({id,path:file.path,sha256:pin.sha256,byteLength:pin.bytes});
  }
  const manifest=checked(buildResourceManifest(description));
  for(const entry of manifest.entries){
    const input=getResourceManifestIdentityInputs(manifest,entry.id);
    if(sha(input.build)!==entry.buildKey||sha(input.runtime)!==entry.runtimeIdentity)throw new TypeError('Independent Node crypto disagrees with pure manifest identity.');
  }
  const outputBytes=canonicalTextBytes(checked(serializeResourceManifest(manifest)));
  const receipt={format:'egret.resource-build-receipt/1',project:{path:projectRelative,sha256:projectPin.sha256,byteLength:projectPin.bytes},targetProfile:description.targetProfile,manifest:{sha256:sha(outputBytes),byteLength:outputBytes.length},files:verified};
  const receiptBytes=canonicalTextBytes(JSON.stringify(receipt,null,2));
  const output=newOutput(owner,args.get('--out')),receiptPath=newOutput(owner,args.get('--receipt'));
  if(samePhysicalPath(output,receiptPath))throw new TypeError('Manifest and receipt require distinct output paths.');
  // Exclusive creation closes the preflight-to-write clobber race. Incomplete
  // outputs from an I/O failure remain evidence; never delete or replace them.
  let outputHandle,receiptHandle;
  try{
    outputHandle=openSync(output,'wx');receiptHandle=openSync(receiptPath,'wx');
    writeFileSync(outputHandle,outputBytes);writeFileSync(receiptHandle,receiptBytes);
  }finally{if(receiptHandle!==undefined)closeSync(receiptHandle);if(outputHandle!==undefined)closeSync(outputHandle);}
  process.stdout.write('Resource manifest and independent byte receipt written.\n');
}
try{main();}catch(error){process.stderr.write((error instanceof Error?error.message:'Resource manifest build failed.')+'\n');process.exitCode=1;}
