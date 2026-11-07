// SPDX-License-Identifier: Apache-2.0
// UNIT: bounded source/session state only; no shaping, native IME or browser claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextEditState} from '@egret/runtime/ui/editing';
const code=expected=>cause=>cause?.code==='TEXT_EDIT_'+expected;
const sample=(value,anchor=value.length,focus=anchor)=>({value,selection:{anchor,focus}});
test('UNIT native edit source admission is bounded, UTF16-safe and mode-specific',()=>{
 const state=createTextEditState({mode:'multiline',value:'A\r\n中文\rB'});assert.equal(state.snapshot().value,'A\n中文\nB');
 for(const value of ['A\nB','A\rB','\ud800','\udc00','\0'])assert.throws(()=>createTextEditState({mode:'single-line',value}),code('VALUE'));
 for(const maxLength of [0,8193,1.1,NaN])assert.throws(()=>createTextEditState({mode:'single-line',maxLength}),code('OPTIONS'));
 assert.throws(()=>state.setValue('x'.repeat(8193)),code('VALUE'));state.setValue('😀B');
 assert.throws(()=>state.setSelection({anchor:1,focus:2}),code('SELECTION'));state.setSelection({anchor:3,focus:2,affinity:'upstream'});assert.equal(state.snapshot().selection.focus,2);
 assert.ok(Object.isFrozen(state.snapshot())&&Object.isFrozen(state.snapshot().selection));
});
test('UNIT session/revision guards discard stale host samples before getters run',()=>{
 const state=createTextEditState({mode:'single-line',value:'A'}),old=state.begin();assert.throws(()=>state.begin(),code('ACTIVE'));
 assert.equal(state.observe(old,0,sample('AB')),'changed');assert.equal(state.snapshot().revision,1);
 const forbidden={get value(){throw Error('STALE_SAMPLE_READ');}};assert.equal(state.observe(old,0,forbidden),'stale');
 assert.equal(state.end(old,0,'commit',forbidden),'stale');assert.equal(state.snapshot().state,'idle');
 const next=state.begin();assert.notEqual(next,old);assert.equal(state.observe(old,1,forbidden),'stale');assert.equal(state.end(next,1,'cancel'),'unchanged');
 assert.equal(state.end(undefined,1,'cancel'),'stale');assert.throws(()=>state.setValue('C',undefined,0),code('STALE'));
});
test('UNIT provisional composition commits once and duplicate final input is idempotent',()=>{
 const state=createTextEditState({mode:'multiline',value:'A'}),token=state.begin();assert.equal(state.beginComposition(token,0),true);
 assert.equal(state.updateComposition(token,0,sample('A\ud800')),true);assert.equal(state.snapshot().value,'A');assert.equal(state.snapshot().revision,0);assert.equal(state.snapshot().state,'composing');
 assert.throws(()=>state.setValue('remote'),code('COMPOSING'));assert.throws(()=>state.setSelection({anchor:0,focus:0}),code('COMPOSING'));
 assert.equal(state.endComposition(token,0,sample('A中文')),'changed');assert.equal(state.snapshot().revision,1);
 assert.equal(state.observe(token,1,sample('A中文')),'unchanged');assert.equal(state.endComposition(token,1,sample('A中文')),'stale');
 assert.equal(state.end(token,1,'commit',sample('A中文')),'unchanged');assert.equal(state.snapshot().state,'idle');
});
test('UNIT explicit composition cancellation invalidates the old session and retains committed ordinary edits',()=>{
 const state=createTextEditState({mode:'single-line',value:'A'}),token=state.begin();state.observe(token,0,sample('AB'));state.beginComposition(token,1);state.updateComposition(token,1,sample('AB中'));
 state.end(token,1,'cancel');assert.equal(state.snapshot().value,'AB');assert.equal(state.snapshot().draft,undefined);
 const next=state.begin();state.beginComposition(next,1);state.updateComposition(next,1,sample('AB文'));state.setValue('remote',undefined,1,true);
 assert.equal(state.snapshot().state,'idle');assert.equal(state.snapshot().value,'remote');assert.equal(state.endComposition(next,2,sample('late')),'stale');
});
test('UNIT failed final composition preserves provisional state; dispose forgets source',()=>{
 const state=createTextEditState({mode:'single-line',maxLength:3}),token=state.begin();state.beginComposition(token,0);state.updateComposition(token,0,sample('long'));
 assert.throws(()=>state.endComposition(token,0,sample('long')),code('VALUE'));assert.equal(state.snapshot().state,'composing');assert.equal(state.snapshot().value,'');
 state.dispose();state.dispose();assert.equal(state.snapshot().state,'closed');assert.equal(state.snapshot().value,'');assert.equal(state.snapshot().draft,undefined);assert.equal(state.observe(token,0,sample('X')),'stale');assert.throws(()=>state.begin(),code('CLOSED'));
});
