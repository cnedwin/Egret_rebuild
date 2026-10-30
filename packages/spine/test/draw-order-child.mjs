// SPDX-License-Identifier: Apache-2.0
// Parent timeout contains a regression in a synchronous vendor loop.
import assert from 'node:assert/strict';
import {createEngine} from '@egret/engine';import {createSpineContentLoader} from '@egret/spine';
import {host} from '../../../tests/helpers.mjs';import {fixture,ports,source,codes} from './fixtures.mjs';
const order=offsets=>({drawOrder:[{time:0,offsets}]}),offset=(slot,delta=0)=>({slot,offset:delta});
const cases=[order([offset('second'),offset('first')]),order([offset('first'),offset('first')]),order([offset('first',1),offset('second')]),order([offset('first',2)]),{drawOrderFolder:[{slots:['first','second'],keys:[{time:0,offsets:[offset('second'),offset('first')]}]}]},{drawOrderFolder:[{slots:['second','first'],keys:[]}]}];
for(const animation of cases){const value=source();value.animations.idle=animation;const engine=await createEngine({host:host().adapter}),data=fixture(),p=ports(data,{replace:{e_json:JSON.stringify(value)}}),loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,p.factory),group=loader.load(engine.createScope(),['e_json']);try{await assert.rejects(group.ready,e=>codes(e).includes('SPINE_JSON_DRAW_ORDER_FAILED'));}finally{await loader.close();await engine.dispose();}}
console.log(JSON.stringify({status:'PASS',refused:cases.length}));
