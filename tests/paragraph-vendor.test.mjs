// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../examples/paragraph-panel/vendor/',import.meta.url);
test('optional paragraph resources retain exact runtime, font, source and legal bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.defaultSdkRuntimeDependency,false);assert.equal(manifest.automaticNetworkAccess,false);
 assert.equal(manifest.runtime.finalSoftWrappedLineL1Integrated,true);
 assert.equal(manifest.files.length,53);const names=new Set();
 for(const row of manifest.files){assert.match(row.path,/^[A-Za-z0-9._/-]+$/);assert.ok(!row.path.split('/').includes('..'));assert.ok(!names.has(row.path));names.add(row.path);const bytes=fs.readFileSync(new URL(row.path,root));assert.equal(bytes.length,row.bytes,row.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.path);}
 for(const font of manifest.fonts){assert.ok(names.has(font.path));for(const notice of font.notices)assert.ok(names.has(notice));}
 for(const file of ['canvaskit.js','canvaskit.wasm'])assert.ok(names.has('runtime/'+file));
 assert.ok(names.has(manifest.runtime.glue));assert.ok(names.has(manifest.runtime.wasm));
 assert.equal(manifest.payloadBytes.runtime,8696178);assert.equal(manifest.payloadBytes.runtime+manifest.payloadBytes.fonts,25844890);
});
