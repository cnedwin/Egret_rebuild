// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const url=new URL('../tools/content/input.mjs',import.meta.url);
const api=existsSync(url)?await import(url.href):{};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function read(...args){assert.equal(typeof api.readContentInput,'function','verified content input reader is absent');return api.readContentInput(...args);}
function fixture(t,bytes=Buffer.from([0,13,10,255])){const root=realpathSync(mkdtempSync(path.join(tmpdir(),'egret-content-input-')));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(path.join(root,'Sources'));writeFileSync(path.join(root,'Sources','Data.bin'),bytes);return {root,bytes,pin:{expectedLength:bytes.length,expectedSha256:sha(bytes)}};}
const refused=(run,code)=>assert.throws(run,error=>error instanceof Error&&error.code==='CONTENT_INPUT_'+code);
// Break caught: text decoding, incomplete reads or aliased source storage changes authenticated raw bytes.
test('verified reader returns independent exact bytes across fixed read chunks and empty files',t=>{for(const size of [0,4,65537,131079]){const bytes=Buffer.alloc(size);for(let i=0;i<size;i++)bytes[i]=i%251;const f=fixture(t,bytes);const output=read(f.root,'Sources/Data.bin',f.pin);assert.ok(Buffer.isBuffer(output));assert.equal(output.byteOffset,0);assert.equal(output.buffer.byteLength,size);assert.deepEqual(output,bytes);if(size)output[0]^=255;assert.deepEqual(read(f.root,'Sources/Data.bin',f.pin),bytes);}});
// Break caught: trusting stale length/digest pins permits changed source bytes.
test('reader refuses actual length, digest and same-length byte drift',t=>{const f=fixture(t);refused(()=>read(f.root,'Sources/Data.bin',{...f.pin,expectedLength:3}),'INTEGRITY');refused(()=>read(f.root,'Sources/Data.bin',{...f.pin,expectedSha256:'0'.repeat(64)}),'INTEGRITY');writeFileSync(path.join(f.root,'Sources','Data.bin'),Buffer.from([1,13,10,255]));refused(()=>read(f.root,'Sources/Data.bin',f.pin),'INTEGRITY');});
// Break caught: oversized files or unsafe numeric declarations reach payload allocation.
test('reader refuses caps and unsafe declared bounds',t=>{const f=fixture(t);refused(()=>read(f.root,'Sources/Data.bin',{...f.pin,maximum:3}),'LIMIT');for(const maximum of [-1,NaN,Infinity,1.5,67108865])refused(()=>read(f.root,'Sources/Data.bin',{...f.pin,maximum}),'LIMIT');for(const expectedLength of [-1,-0,NaN,1.5,Number.MAX_SAFE_INTEGER+1])refused(()=>read(f.root,'Sources/Data.bin',{...f.pin,expectedLength}),'INVALID');refused(()=>read(f.root,'Sources/Data.bin',{...f.pin,expectedSha256:'A'.repeat(64)}),'INVALID');refused(()=>read(f.root,'Sources/Data.bin',{expectedLength:4}),'INVALID');refused(()=>read(f.root,'Sources/Data.bin',{expectedSha256:f.pin.expectedSha256}),'INVALID');});
// Break caught: case aliases, missing components, device/path escapes or directories become sources.
test('reader authenticates portable paths and exact relative spelling',t=>{const f=fixture(t);for(const relative of ['sources/Data.bin','Sources/data.bin','Sources/Missing.bin','Sources','../Data.bin','Sources/../Sources/Data.bin','/Sources/Data.bin','Sources\\Data.bin','Sources/NUL','Sources/Data.bin.'])refused(()=>read(f.root,relative,f.pin),'INVALID');refused(()=>read(path.join(f.root,'missing'),'Sources/Data.bin',f.pin),'INVALID');refused(()=>read(path.join(f.root,'Sources','Data.bin'),'anything',f.pin),'INVALID');refused(()=>read('.','Sources/Data.bin',f.pin),'INVALID');});
// Break caught: a symlink source, intermediate component or owner bypasses genuine-file authentication.
test('reader rejects actual symbolic file, directory and owner aliases when host permits creation',t=>{const f=fixture(t);try{symlinkSync(path.join(f.root,'Sources','Data.bin'),path.join(f.root,'Link.bin'),'file');symlinkSync(path.join(f.root,'Sources'),path.join(f.root,'Alias'),'junction');}catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('Host refused creation of real symbolic-link fixture: '+error.code);return;}throw error;}refused(()=>read(f.root,'Link.bin',f.pin),'INVALID');refused(()=>read(f.root,'Alias/Data.bin',f.pin),'INVALID');refused(()=>read(path.join(f.root,'Alias'),'Data.bin',f.pin),'INVALID');});

// Existing genuine-directory behavior: Windows permits a junction fixture even without file-symlink privilege.
test('reader rejects genuine junction directory and owner aliases independently of file-symlink privilege',t=>{const f=fixture(t);try{symlinkSync(path.join(f.root,'Sources'),path.join(f.root,'Alias'),'junction');}catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('Host refused junction fixture: '+error.code);return;}throw error;}refused(()=>read(f.root,'Alias/Data.bin',f.pin),'INVALID');refused(()=>read(path.join(f.root,'Alias'),'Data.bin',f.pin),'INVALID');});

// Break caught: initial configuration reads either require unavailable pins or bypass finite preallocation limits.
test('unpinned initial configuration reads retain real-file capacity, identity and owned-byte checks',t=>{const f=fixture(t,Buffer.from('{"format":"fixture/1"}'));const bytes=read(f.root,'Sources/Data.bin',{maximum:f.bytes.length});assert.deepEqual(bytes,f.bytes);assert.equal(bytes.byteOffset,0);assert.equal(bytes.buffer.byteLength,f.bytes.length);refused(()=>read(f.root,'Sources/Data.bin',{maximum:f.bytes.length-1}),'LIMIT');refused(()=>read(f.root,'Sources/missing.bin',{maximum:1024}),'INVALID');assert.deepEqual(read(f.root,'Sources/Data.bin',{}),f.bytes);});
