// SPDX-License-Identifier: Apache-2.0
// Exercise actual diagnostics and HTTP access boundaries without engine changes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {localPackage} from '../../tools/lib/local-package.mjs';
import {inspectEnvironment} from '../../tools/doctor.mjs';
import {createExampleServer} from '../../tools/serve-example.mjs';

test('doctor rejects contradictory pins and leaves fixture bytes unchanged',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret M0 中文 '));
 try {
  const content=JSON.stringify({engines:{node:process.versions.node},packageManager:'pnpm@11.25.0',devDependencies:{typescript:'7.0.2'}});
  fs.writeFileSync(path.join(root,'package.json'),content);
  fs.writeFileSync(path.join(root,'.node-version'),'0.0.0\n');
  fs.writeFileSync(path.join(root,'.nvmrc'),process.versions.node+'\n');
  const result=inspectEnvironment(root,{preinstall:true});
  assert.equal(result.ok,false);
  assert.ok(result.checks.some(c=>c.name==='.node-version'&&!c.ok));
  assert.equal(fs.readFileSync(path.join(root,'package.json'),'utf8'),content);
  assert.equal(result.node.parent,result.node.child);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('example server exposes only allowlisted files and handles missing/bad requests',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret server 中文 '));
 fs.mkdirSync(path.join(root,'examples/resource-scene'),{recursive:true});
 fs.writeFileSync(path.join(root,'examples/resource-scene/index.html'),'<h1>example</h1>');
 fs.writeFileSync(path.join(root,'.env'),'SECRET');
 const server=createExampleServer(root);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try {
  assert.equal(await (await fetch(url+'/')).text(),'<h1>example</h1>');
  assert.equal((await fetch(url+'/.env')).status,404);
  assert.equal((await fetch(url+'/package.json')).status,404);
  assert.equal((await fetch(url+'/examples/resource-scene/missing.mjs')).status,404);
  assert.equal((await fetch(url+'/%zz')).status,400);
  assert.equal((await fetch(url+'/',{method:'POST'})).status,405);
 } finally { await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true}); }
});


test('doctor rejects an incorrect package manager declaration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret doctor '));
 try{
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({engines:{node:process.versions.node},packageManager:'pnpm@0.0.0'}));
  for(const file of ['.node-version','.nvmrc'])fs.writeFileSync(path.join(root,file),process.versions.node);
  assert.ok(inspectEnvironment(root,{preinstall:true}).checks.some(c=>c.name==='pnpm'&&!c.ok));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('example server refuses internal asset aliases and foreign dependency owners',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret alias '));
 const foreign=fs.mkdtempSync(path.join(os.tmpdir(),'egret foreign '));
 fs.mkdirSync(path.join(root,'private'),{recursive:true});
 fs.writeFileSync(path.join(root,'private/secret.png'),'PRIVATE');
 fs.mkdirSync(path.join(root,'examples/resource-scene'),{recursive:true});
 fs.symlinkSync(path.join(root,'private'),path.join(root,'examples/resource-scene/assets'),process.platform==='win32'?'junction':'dir');
 fs.mkdirSync(path.join(root,'packages/engine/node_modules'),{recursive:true});
 fs.symlinkSync(foreign,path.join(root,'packages/engine/node_modules/robust-predicates'),process.platform==='win32'?'junction':'dir');
 fs.writeFileSync(path.join(foreign,'index.js'),'PRIVATE');
 const server=createExampleServer(root);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(url+'/examples/resource-scene/assets/secret.png')).status,404);
  assert.equal((await fetch(url+'/packages/engine/node_modules/robust-predicates/index.js')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});fs.rmSync(foreign,{recursive:true,force:true});}
});


test('package ownership rejects same-version foreign targets and accepts contained physical installs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret owner '));
 const foreign=fs.mkdtempSync(path.join(os.tmpdir(),'egret external '));
 const meta=JSON.stringify({name:'robust-predicates',version:'3.0.3'});
 try{
  fs.writeFileSync(path.join(foreign,'package.json'),meta);
  fs.mkdirSync(path.join(root,'node_modules/.pnpm/local'),{recursive:true});
  const alias=path.join(root,'node_modules/robust-predicates');
  fs.symlinkSync(foreign,alias,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>localPackage(root,alias,'robust-predicates','3.0.3'));
  fs.unlinkSync(alias);
  const owner=path.join(root,'node_modules/.pnpm/local');
  fs.writeFileSync(path.join(owner,'package.json'),meta);
  fs.symlinkSync(owner,alias,process.platform==='win32'?'junction':'dir');
  assert.equal(localPackage(root,alias,'robust-predicates','3.0.3'),fs.realpathSync(owner));
  assert.throws(()=>localPackage(root,alias,'robust-predicates','0.0.0'));
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(foreign,{recursive:true,force:true});}
});
