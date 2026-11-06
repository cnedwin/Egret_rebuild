// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentCopy} from '../examples/paragraph-panel/styled-copy.mjs';

test('equipment ranges use only the captured font set while keeping authored text and offsets',()=>{
 const original=equipmentCopy(20,2),families=['Noto Sans','Noto Sans Arabic'];
 const replacement=equipmentCopy(20,2,families);
 assert.equal(replacement.text,original.text);
 assert.deepEqual(replacement.runs.map(({fontFamilies,...run})=>run),original.runs.map(({fontFamilies,...run})=>run));
 const explicit=replacement.runs.filter(run=>run.fontFamilies);
 assert.ok(explicit.length>0);
 for(const run of explicit)assert.ok(run.fontFamilies.every(family=>families.includes(family)),'range must not reference a missing family');
 families[0]='caller changed';
 assert.deepEqual(explicit[0].fontFamilies,['Noto Sans','Noto Sans Arabic']);
 assert.ok(Object.isFrozen(explicit[0].fontFamilies));
});

test('default and registered named CJK family retain the original fixture',()=>{
 const original=equipmentCopy(20,0);
 assert.deepEqual(equipmentCopy(20,0,['Noto Sans','Noto Sans CJK SC']),original);
 assert.deepEqual(original.runs.find(run=>run.fontFamilies).fontFamilies,['Noto Sans CJK SC']);
});
