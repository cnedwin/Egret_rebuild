// SPDX-License-Identifier: Apache-2.0
// The name a skin gives to the state of a control.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createUiTheme,selectUiSkin} from '@egret/engine/ui';
import {spawnSync} from 'node:child_process';

const coded=code=>error=>error?.code===code;
const names=['disabled','pressed','checked','selected','expanded','focus','hover'];
const full={default:'idle',hover:'over',pressed:'down',disabled:'off',focus:'ring',checked:'on',selected:'picked',expanded:'open'};
const theme=createUiTheme({id:'dark',skins:{button:full,plain:{default:'idle'},toggle:{default:'idle',hover:'over',checked:'on',disabled:'off'}}});

test('SK01 a control at rest has the default name, and each state alone has its own',()=>{
 const skin=theme.skins.button;
 assert.equal(selectUiSkin(skin),'idle');assert.equal(selectUiSkin(skin,{}),'idle');
 assert.equal(selectUiSkin(skin,Object.fromEntries(names.map(name=>[name,false]))),'idle');
 for(const name of names)assert.equal(selectUiSkin(skin,{[name]:true}),full[name],name);
 // The skin of a theme and a plain object of the same shape are read alike.
 assert.equal(selectUiSkin({default:'a',hover:'b'},{hover:true}),'b');
});

test('SK02 when several states hold, the one a player reads first wins: unavailable, held, set, focused, pointed at',()=>{
 const skin=theme.skins.button;
 // Each state beats every state after it and loses to every state before it.
 for(let first=0;first<names.length;first++)for(let second=first+1;second<names.length;second++)
  assert.equal(selectUiSkin(skin,{[names[first]]:true,[names[second]]:true}),full[names[first]],names[first]+' over '+names[second]);
 assert.equal(selectUiSkin(skin,Object.fromEntries(names.map(name=>[name,true]))),'off');
 assert.equal(selectUiSkin(skin,{pressed:true,checked:true,hover:true,focus:true}),'down');
 assert.equal(selectUiSkin(skin,{checked:true,hover:true,focus:true}),'on','a set control stays set under the pointer');
 assert.equal(selectUiSkin(skin,{hover:true,focus:true}),'ring','the keyboard is not hidden by the pointer');
});

test('SK03 a state the skin has no name for falls to the next that holds, and then to the default',()=>{
 assert.equal(selectUiSkin(theme.skins.plain,Object.fromEntries(names.map(name=>[name,true]))),'idle');
 const skin=theme.skins.toggle;
 assert.equal(selectUiSkin(skin,{pressed:true,hover:true}),'over','held has no name here, pointed at has');
 assert.equal(selectUiSkin(skin,{pressed:true,checked:true,hover:true}),'on');
 assert.equal(selectUiSkin(skin,{focus:true,selected:true,expanded:true}),'idle');
 assert.equal(selectUiSkin(skin,{disabled:true,checked:true}),'off');
});

test('SK04 an application gives its own order, and a state left out of it is never chosen',()=>{
 const skin=theme.skins.button;
 assert.equal(selectUiSkin(skin,{hover:true,checked:true},['hover','checked']),'over');
 assert.equal(selectUiSkin(skin,{hover:true,checked:true},['checked','hover']),'on');
 assert.equal(selectUiSkin(skin,{disabled:true,hover:true},['hover']),'over','disabled is not in the order');
 assert.equal(selectUiSkin(skin,{disabled:true},['hover']),'idle');
 assert.equal(selectUiSkin(skin,Object.fromEntries(names.map(name=>[name,true])),[]),'idle');
 assert.equal(selectUiSkin(skin,{pressed:true,disabled:true},[...names].reverse()),'down');
 // The order is read, not kept or changed.
 const order=Object.freeze(['focus','hover']);assert.equal(selectUiSkin(skin,{hover:true,focus:true},order),'ring');assert.deepEqual(order,['focus','hover']);
});

test('SK05 what is not a skin, a state or an order is refused',()=>{
 const skin=theme.skins.button;
 for(const bad of [undefined,null,7,'idle',{},{default:7},{hover:'over'}])assert.throws(()=>selectUiSkin(bad,{}),coded('UI_THEME_INVALID'),String(JSON.stringify(bad)));
 for(const bad of [null,7,'hover',...names.map(name=>({[name]:1})),...names.map(name=>({[name]:'yes'})),...names.map(name=>({[name]:null}))])
  assert.throws(()=>selectUiSkin(skin,bad),coded('UI_THEME_INVALID'),String(JSON.stringify(bad)));
 for(const bad of [null,7,'hover',{length:0},['default'],['hovered'],['hover','hover'],[7],['hover',undefined],['pressed','hover','pressed']])
  assert.throws(()=>selectUiSkin(skin,{hover:true},bad),coded('UI_THEME_INVALID'),String(JSON.stringify(bad)));
 // A state that is not one of the seven is not read.
 assert.equal(selectUiSkin(skin,{dragged:true,default:true}),'idle');
});

test('SK06 the entry has the function, the default entry does not, and a strict consumer compiles',async()=>{
 assert.equal(Object.keys(await import('@egret/engine/ui')).includes('selectUiSkin'),true);
 assert.equal('selectUiSkin' in await import('@egret/engine'),false);
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-skin-states.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
