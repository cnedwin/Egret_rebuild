// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {PNG}=createRequire(import.meta.url)('pngjs');
import {schedule,expectedEvent,decimalLiterals,colors,fixedPixels} from './fixture.mjs';
test('literal sequence schedule freezes every state, exact marker order and terminal exclusion',()=>{
 assert.equal(schedule.length,11);assert.deepEqual(schedule.map(r=>r.clock),[0,0.25,0.5,0.75,1,1,1.25,1.5,1.5,1.75,2]);
 const all=schedule.flatMap(r=>r.events.map(expectedEvent));assert.equal(all.filter(r=>r.owner==='A').length,9);assert.equal(all.filter(r=>r.owner==='B').length,13);
 assert.deepEqual(all.filter(r=>r.owner==='A').map(r=>r.kind==='complete'?'complete':r.id+':'+r.playIndex),['zero:0','half:0','halfAgain:0','end:0','zero:1','half:1','halfAgain:1','end:1','complete']);
 assert.deepEqual(schedule.at(-1).B,[1.25,0.25,1,1,'running',2,'infinite',13]);assert.equal(colors.length,4);assert.equal(fixedPixels.length,8);
 assert.deepEqual(decimalLiterals[1],[1,5,0,0]);assert.deepEqual(decimalLiterals[3],[0.6,2,0.19999999999999996,1]);
});
test('example declares a public content-backed Engine application and a finite collector',()=>{
 const main=fs.readFileSync(new URL('./main.mjs',import.meta.url),'utf8');
 for(const required of ['@egret/engine/animation','createManifestTextureProvider','createManifestByteSource','createManifestGroup','createSequenceController','captureSharedFrame','renderSharedFrame','requestReadback'])assert.ok(main.includes(required),required);
 assert.ok(!main.includes("getContext('2d')"),'native texture provider owns decode; scene is genuine Engine output');
 const verifier=fs.readFileSync(new URL('./verify.mjs',import.meta.url),'utf8');for(const required of ['msedge','webgpu','webgl2','source-freeze.json','fixture.mjs'])assert.ok(verifier.includes(required),required);
});

test('original source PNG and both atlas duration sets match the independent literal reference',()=>{
 const page=PNG.sync.read(fs.readFileSync(new URL('./sources/page.png',import.meta.url)));assert.equal(page.width,4);assert.equal(page.height,1);assert.deepEqual([...page.data],colors.flat());
 const atlas=JSON.parse(fs.readFileSync(new URL('./sources/atlas.json',import.meta.url),'utf8')),decimal=JSON.parse(fs.readFileSync(new URL('./sources/decimal-atlas.json',import.meta.url),'utf8'));
 assert.deepEqual(atlas.frames.map(f=>[f.filename,f.frame.x,f.duration]),[['red',0,250],['green',1,250],['blue',2,250],['yellow',3,250]]);assert.deepEqual(decimal.frames.map(f=>[f.filename,f.frame.x,f.duration]),[['red',0,100],['green',1,100]]);
 const recipe=JSON.parse(fs.readFileSync(new URL('./sources/recipe.json',import.meta.url),'utf8'));assert.equal(recipe.format,'egret.content-build-recipe/1');assert.deepEqual(recipe.recipes.map(r=>[r.resourceId,r.dependencies]),[['e_page',[]],['e_atlas',['e_page']],['e_sequence',['e_atlas']],['e_decimal_atlas',['e_page']],['e_decimal_sequence',['e_decimal_atlas']]]);
});
