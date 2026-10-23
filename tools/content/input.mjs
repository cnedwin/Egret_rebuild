// SPDX-License-Identifier: Apache-2.0
// Authenticate source identity before bounded allocation and recheck after EOF.
import {openSync,closeSync,readSync,fstatSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {logicalPath,samePhysicalPath} from '../lib/file-identity.mjs';
const CHUNK=65536,MAXIMUM=67108864;
const sameFile=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
function fault(code,message,cause){const error=new Error(message,cause===undefined?undefined:{cause});error.code='CONTENT_INPUT_'+code;return error;}
function locate(owner,relative){
  logicalPath(relative);
  if(typeof owner!=='string'||!path.isAbsolute(owner)||/[\x00-\x1f\x7f]/.test(owner))throw new TypeError('An absolute canonical source owner is required.');
  const root=lstatSync(owner);
  if(root.isSymbolicLink()||!root.isDirectory()||!samePhysicalPath(owner,realpathSync(owner)))throw new TypeError('Source owner must be a genuine canonical directory.');
  let current=owner,stat;
  const parts=relative.split('/');
  for(let index=0;index<parts.length;index++){
    if(!readdirSync(current).includes(parts[index]))throw new TypeError('Source spelling differs from its portable identity: '+relative);
    current=path.join(current,parts[index]);stat=lstatSync(current);
    if(stat.isSymbolicLink()||(index===parts.length-1?!stat.isFile():!stat.isDirectory())||!samePhysicalPath(current,realpathSync(current)))throw new TypeError('Source components must be genuine contained directories and a regular file: '+relative);
  }
  return {absolute:current,stat};
}
/** Return dedicated owned raw bytes after bounded identity checks and optional paired length/hash pins. */
export function readContentInput(owner,relative,options){
  let handle;
  try{
    if(options===null||typeof options!=='object'||Array.isArray(options))throw fault('INVALID','An input options record with optional paired length/SHA-256 pins is required.');
    const {expectedLength,expectedSha256,maximum=8388608}=options;
    const pinned=Object.hasOwn(options,'expectedLength')||Object.hasOwn(options,'expectedSha256');
    if(pinned&&(!Object.hasOwn(options,'expectedLength')||!Object.hasOwn(options,'expectedSha256')||!Number.isSafeInteger(expectedLength)||expectedLength<0||Object.is(expectedLength,-0)||typeof expectedSha256!=='string'||!/^[0-9a-f]{64}$/.test(expectedSha256)))throw fault('INVALID','Source pins require a nonnegative safe length and lowercase SHA-256.');
    if(!Number.isSafeInteger(maximum)||maximum<0||Object.is(maximum,-0)||maximum>MAXIMUM)throw fault('LIMIT','Source maximum must be a nonnegative safe integer at most 64 MiB.');
    if(pinned&&expectedLength>maximum)throw fault('LIMIT','Declared source length exceeds the selected input maximum.');
    const located=locate(owner,relative);handle=openSync(located.absolute,'r');
    const initial=fstatSync(handle);
    if(!initial.isFile()||!sameFile(initial,located.stat)||initial.mtimeMs!==located.stat.mtimeMs||initial.ctimeMs!==located.stat.ctimeMs)throw fault('INTEGRITY','Source identity changed before reading: '+relative);
    const size=initial.size;
    if(!Number.isSafeInteger(size)||size<0)throw fault('LIMIT','Actual source size must be a nonnegative safe integer.');
    if(size>maximum)throw fault('LIMIT','Actual source size exceeds the selected input maximum.');
    if(pinned&&size!==expectedLength)throw fault('INTEGRITY','Actual source length differs from its declared pin: '+relative);
    const buffer=Buffer.allocUnsafe(CHUNK),payload=Buffer.allocUnsafeSlow(size),digest=createHash('sha256');
    let offset=0;
    while(offset<size){
      const requested=Math.min(CHUNK,size-offset),count=readSync(handle,buffer,0,requested,offset);
      if(!Number.isInteger(count)||count<=0||count>requested)throw fault('INTEGRITY','Source became short or returned an invalid bounded read count: '+relative);
      const chunk=buffer.subarray(0,count);digest.update(chunk);payload.set(chunk,offset);offset+=count;
    }
    if(readSync(handle,buffer,0,1,size)!==0)throw fault('INTEGRITY','Source grew beyond its pinned byte length: '+relative);
    const final=fstatSync(handle);let named;
    try{named=locate(owner,relative);}catch(cause){throw fault('INTEGRITY','Named source changed during reading: '+relative,cause);}
    if(!final.isFile()||!sameFile(initial,final)||!sameFile(final,named.stat)||final.size!==size||named.stat.size!==size||final.mtimeMs!==initial.mtimeMs||final.ctimeMs!==initial.ctimeMs||named.stat.mtimeMs!==initial.mtimeMs||named.stat.ctimeMs!==initial.ctimeMs)throw fault('INTEGRITY','Source identity, size or modification state changed during reading: '+relative);
    if(pinned&&digest.digest('hex')!==expectedSha256)throw fault('INTEGRITY','Actual source SHA-256 differs from its declared pin: '+relative);
    return payload;
  }catch(cause){
    if(/^CONTENT_INPUT_(INVALID|INTEGRITY|LIMIT)$/.test(cause?.code))throw cause;
    throw fault('INVALID','Source must be an existing regular file under its exact canonical portable identity.',cause);
  }finally{if(handle!==undefined)closeSync(handle);}
}
