// SPDX-License-Identifier: Apache-2.0
// Public behavior controls for M1.5 admission work-order repairs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateResourceBuildDescription} from '@egret/contracts/resources';
import {describeResourceBuild,parseResourceManifest} from '@egret/project/resources';
import {description,entry,snapshot} from './fixtures/resource-manifest.mjs';
const failure=result=>{assert.equal(result.ok,false);return result.diagnostics[0];};

// Break caught: diagnostic escaping expands an already oversized caller key.
test('oversized metadata key refuses at its bounded parent before key expansion',()=>{
 const input=description();input.entries[0].settings={['/~'.repeat(2097153)]:0};
 const diagnostic=failure(validateResourceBuildDescription(input));
 assert.equal(diagnostic.code,'RESOURCE_LIMIT_EXCEEDED');
 assert.ok(diagnostic.pointer==='/entries/0/settings','oversized key must use the bounded parent pointer');
});

// Break caught: the parser scans beyond its cheap raw length ceiling first.
test('oversized manifest text refuses by raw length before malformed Unicode scanning',()=>{
 const diagnostic=failure(parseResourceManifest(' '.repeat(4194304)+'\ud800'));
 assert.equal(diagnostic.code,'PROJECT_LIMIT_EXCEEDED');assert.equal(diagnostic.jsonPointer,'');
 assert.equal(failure(parseResourceManifest({toString(){throw Error('must not coerce');}})).code,'PROJECT_INPUT_INVALID');
});

// Break caught: resource joins run before a selected-target count refusal.
test('selected resource count refuses before any selected domain reference joins',()=>{
 const records=Array.from({length:4097},(_,i)=>entry('e_'+String(i).padStart(5,'0'))),input=snapshot(records);
 delete input.entities[0].data.provenance;
 const diagnostic=failure(describeResourceBuild(input,'web-shared/1'));
 assert.equal(diagnostic.code,'PROJECT_LIMIT_EXCEEDED');assert.equal(diagnostic.jsonPointer,'/entities');
});

// Break caught: preserved source indices become selected-array indices after filtering.
test('selected domain diagnostics retain original index after a large unrelated prefix',()=>{
 const input=snapshot([entry('e_z_resource')]);delete input.entities[0].data.provenance;
 const prefix=Array.from({length:1024},(_,i)=>({id:'e_a'+String(i).padStart(5,'0'),kind:'example.scene',dataSchemaVersion:'1',name:'',data:{},references:[]}));
 input.entities.unshift(...prefix);
 const diagnostic=failure(describeResourceBuild(input,'web-shared/1'));
 assert.equal(diagnostic.code,'PROJECT_INPUT_INVALID');assert.equal(diagnostic.jsonPointer,'/entities/1024/data');
});

// Break caught: the early bound is applied to all project entities or another target.
test('the 4096 bound counts selected resources and permits the exact limit',()=>{
 const input=snapshot(Array.from({length:4096},(_,i)=>entry('e_'+String(i).padStart(5,'0'))));
 input.entities.push({id:'e_z_unrelated',kind:'example.scene',dataSchemaVersion:'1',name:'',data:{},references:[]});
 const other=snapshot([entry('e_z_other')]).entities[0];other.data.targetProfile='other/1';input.entities.push(other);
 const result=describeResourceBuild(input,'web-shared/1');assert.equal(result.ok,true,JSON.stringify(result.diagnostics));assert.equal(result.value.entries.length,4096);
});
