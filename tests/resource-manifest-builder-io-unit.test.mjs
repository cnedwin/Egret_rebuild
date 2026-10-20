// SPDX-License-Identifier: Apache-2.0
// Bounded tool-I/O UNIT; all source/artifact bytes and hashes remain genuine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseResourceManifest} from '@egret/project/resources';
import {snapshot} from './fixtures/resource-manifest.mjs';
import {ownerRelativePath} from '../tools/lib/file-identity.mjs';

const child=fileURLToPath(new URL('./resource-manifest-builder-io-child.mjs',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(action){
 const parent=fs.realpathSync(tmpdir()),root=fs.mkdtempSync(path.join(parent,'egret-manifest-io-'));
 fs.mkdirSync(path.join(root,'sources'));fs.mkdirSync(path.join(root,'assets'));
 const config={root,source:path.join(root,'sources/a.txt'),artifact:path.join(root,'assets/a.txt'),project:path.join(root,'project.json'),output:path.join(root,'manifest.json'),receipt:path.join(root,'receipt.json'),trace:path.join(root,'io-trace.json')};
 fs.writeFileSync(config.source,'abc');fs.writeFileSync(config.artifact,'');fs.writeFileSync(config.project,JSON.stringify(snapshot()));
 try{return action(config);}finally{const actual=fs.realpathSync(root);ownerRelativePath(parent,actual);assert.ok(path.basename(actual).startsWith('egret-manifest-io-'));fs.rmSync(actual,{recursive:true,force:true});}
}
function run(config){
 const configuration=path.join(config.root,'io-config.json');fs.writeFileSync(configuration,JSON.stringify(config));
 const result=spawnSync(process.execPath,[child,configuration],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
 assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(fs.existsSync(config.trace),true,'child must preserve observation and restoration receipt');
 const trace=JSON.parse(fs.readFileSync(config.trace,'utf8'));assert.equal(trace.restored,true);assert.deepEqual(trace.openHandles,[],'builder leaked input handles before child cleanup');
 return {result,trace};
}
function bounded(trace){
 for(const [label,stats] of Object.entries(trace.files)){
  assert.equal(stats.wholeReads,0,label+' must not use whole-file readFileSync');assert.equal(stats.readBeforeStat,0,label+' must inspect its opened handle before reading');
  assert.ok(stats.maxRequest<=65536,label+' exceeded the fixed 64 KiB read request bound');
  if(label!=='project')assert.ok(stats.maxBuffer<=65536,label+' allocated a resource read buffer over 64 KiB');
  assert.equal(stats.opens,stats.closes,label+' input opens and closes must balance');
 }
}
function noOutputs(config){assert.equal(fs.existsSync(config.output),false);assert.equal(fs.existsSync(config.receipt),false);}

// Break caught: tiny successful builds still perform hidden whole-file reads.
test('regular contained byte build uses opened-handle stat and bounded real reads',()=>fixture(config=>{
 const {result,trace}=run(config);assert.equal(result.status,0,result.stderr);bounded(trace);
 for(const label of ['project','source','artifact'])assert.ok(trace.files[label].stats>=1,label+' missing opened-handle size admission');
 assert.equal(trace.files.source.bytesRead,3);assert.equal(trace.files.artifact.bytesRead,0);assert.ok(trace.files.source.eofReads>=1);assert.ok(trace.files.artifact.eofReads>=1);
 const text=fs.readFileSync(config.output,'utf8');assert.equal(parseResourceManifest(text).ok,true);
 const receipt=JSON.parse(fs.readFileSync(config.receipt,'utf8'));assert.equal(receipt.manifest.sha256,sha(text));
}));

// Break caught: declared-length mismatch is noticed only after large allocation/read.
test('real sparse source mismatch refuses before reading any resource bytes',()=>fixture(config=>{
 const fd=fs.openSync(config.source,'r+');try{fs.ftruncateSync(fd,20*1024*1024);}finally{fs.closeSync(fd);}
 const {result,trace}=run(config);assert.notEqual(result.status,0);assert.match(result.stderr,/byte|length|size/i);bounded(trace);
 assert.ok(trace.files.source.stats>=1);assert.equal(trace.files.source.reads,0);assert.equal(trace.files.source.bytesRead,0);noOutputs(config);
}));

// Break caught: the project byte cap is enforced only after allocation/decoding.
test('real oversized project refuses before reading beyond its opened-handle size check',()=>fixture(config=>{
 const fd=fs.openSync(config.project,'r+');try{fs.ftruncateSync(fd,16777217);}finally{fs.closeSync(fd);}
 const {result,trace}=run(config);assert.notEqual(result.status,0);assert.match(result.stderr,/limit|exceed|size/i);bounded(trace);
 assert.ok(trace.files.project.stats>=1);assert.equal(trace.files.project.reads,0);assert.equal(trace.files.project.bytesRead,0);noOutputs(config);
}));

// Break caught: a builder hashes only the first chunk or buffers complete resources.
test('multi-chunk source and artifact hashes cover every actual byte through fixed buffers',()=>fixture(config=>{
 const source=Buffer.alloc(196645),artifact=Buffer.alloc(131081);for(let i=0;i<source.length;i++)source[i]=(i*17+3)%251;for(let i=0;i<artifact.length;i++)artifact[i]=(i*31+9)%253;
 fs.writeFileSync(config.source,source);fs.writeFileSync(config.artifact,artifact);
 const project=snapshot();project.files[0].sha256=sha(source);project.files[0].byteLength=source.length;project.files[1].sha256=sha(artifact);project.files[1].byteLength=artifact.length;fs.writeFileSync(config.project,JSON.stringify(project));
 const {result,trace}=run(config);assert.equal(result.status,0,result.stderr);bounded(trace);
 assert.equal(trace.files.source.bytesRead,source.length);assert.equal(trace.files.artifact.bytesRead,artifact.length);assert.ok(trace.files.source.positiveReads>=4);assert.ok(trace.files.artifact.positiveReads>=3);
 assert.ok(trace.files.source.eofReads>=1);assert.ok(trace.files.artifact.eofReads>=1);
 const receipt=JSON.parse(fs.readFileSync(config.receipt,'utf8'));assert.equal(receipt.files.find(x=>x.id==='f_source').sha256,sha(source));assert.equal(receipt.files.find(x=>x.id==='f_artifact').sha256,sha(artifact));
}));

// Break caught: a real file shrinks after fstat and short EOF is accepted.
test('actual child-owned truncation after size admission refuses and closes input handles',()=>fixture(config=>{
 config.mutation='shrink';const {result,trace}=run(config);assert.equal(trace.mutationApplied,true,'fixture must reach the real stat-to-read race');
 assert.equal(trace.mutation.before,3);assert.equal(trace.mutation.after,2);assert.equal(trace.mutation.closed,true);assert.notEqual(result.status,0);assert.match(result.stderr,/byte|length|short|changed/i);bounded(trace);noOutputs(config);
}));

// Break caught: a real file grows after fstat and the trailing byte is ignored.
test('actual child-owned growth after size admission refuses through EOF or final size proof',()=>fixture(config=>{
 config.mutation='grow';const {result,trace}=run(config);assert.equal(trace.mutationApplied,true,'fixture must reach the real stat-to-read race');
 assert.equal(trace.mutation.before,3);assert.equal(trace.mutation.after,4);assert.equal(trace.mutation.closed,true);assert.notEqual(result.status,0);assert.match(result.stderr,/byte|length|growth|changed/i);bounded(trace);noOutputs(config);
}));
