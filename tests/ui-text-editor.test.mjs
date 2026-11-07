// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine,createImageData2D} from '@egret/engine';
import {createParagraphCache} from '@egret/engine/paragraph';
import {createUiTextEditor} from '@egret/engine/ui/editing';
import {createUiRoot} from '@egret/engine/ui';
import {host,deferred,flush} from './helpers.mjs';
const style={fontSet:'unit-fonts',fontFamilies:['Unit'],fontSize:16,locale:'und',direction:'ltr',fillColor:0xffffff};
// Literal host results prove SDK publication/lifetime only; real fonts are browser evidence.
function raster(input){const segments=input.text.split('\n'),height=segments.length*20,lines=[],geometryLines=[],clusters=[];let start=0;for(let i=0;i<segments.length;i++){const end=start+segments[i].length;lines.push({start,end,baseline:i*20+15,ascent:15,descent:5,height:20,width:20});geometryLines.push({start,end,left:0,right:20,top:i*20,bottom:(i+1)*20});if(end>start)clusters.push({start,end,lineIndex:i,direction:input.direction,left:0,right:20,top:i*20,bottom:(i+1)*20});start=end+1;}return {metrics:{width:input.width,height,truncated:false,lines},image:createImageData2D({width:2,height:2,pixels:new Uint8Array(16).fill(255)}),offsetX:0,offsetY:0,geometry:{lines:geometryLines,clusters}};}
async function setup(t){const engine=await createEngine({host:host().adapter});t.after(()=>engine.dispose());const scope=engine.createScope(),state={calls:[],hook:undefined};const cache=createParagraphCache(engine.assets,{provider:{identity:'unit.edit-paragraph/1',capabilities:{textGeometry:true,maxLines:true,textAlign:true,fontSets:true},hasFontSet:key=>key==='unit-fonts',async prepare(input,context){state.calls.push(input);return state.hook?state.hook(input,context):raster(input);}}});return {engine,scope,cache,state};}
async function commit(root){for(let i=0;i<20;i++){const prep=await root.prepare();if(prep.status==='pending'){await flush();continue;}const result=root.commit(prep);assert.ok(['committed','unchanged'].includes(result.kind));return result;}assert.fail('UI did not settle');}
const leaf=editor=>({kind:'column',id:'column',children:[{kind:'leaf',id:'editor',content:editor.content},{kind:'leaf',id:'tail',explicitHeight:10,fill:{color:0xff0000}}]});
const target={kind:'leaf',id:'editor'};
test('UI text editor uses committed paragraph geometry/height and selection does not reraster',async t=>{
 const s=await setup(t),changes=[],editor=createUiTextEditor({...s,mode:'multiline',value:'AB',style,minHeight:1,onChange:change=>changes.push(change)});
 const root=createUiRoot({engine:s.engine,scope:s.scope,id:'edit-root',viewport:{width:140,height:140},density:1,tree:leaf(editor)});await commit(root);
 assert.equal(root.snapshot().boxes.find(b=>b.id==='editor').height,36);assert.equal(editor.getTextGeometry(root,target).text,'AB');assert.equal(s.state.calls[0].width,124);
 editor.setSelection({anchor:0,focus:2});assert.equal(editor.content.revision,1);await commit(root);assert.equal(s.state.calls.length,1);assert.equal(changes.length,0);
 editor.setValue('A\nB');assert.equal(editor.content.revision,2);assert.equal(editor.getTextGeometry(root,target).text,'AB');root.setTree(leaf(editor));await commit(root);
 assert.equal(editor.getTextGeometry(root,target).text,'A\nB');assert.equal(root.snapshot().boxes.find(b=>b.id==='editor').height,56);assert.equal(changes.length,1);assert.equal(changes[0].source,'programmatic');
 root.dispose();await flush();assert.equal(editor.snapshot().livePresentations,0);assert.equal(s.cache.getStatus().callerLeases,0);
});
test('failed and superseded UI text preparation keep the previous committed content',async t=>{
 const s=await setup(t),editor=createUiTextEditor({...s,mode:'single-line',value:'original',style}),root=createUiRoot({engine:s.engine,scope:s.scope,id:'edit-failure',viewport:{width:140,height:140},density:1,tree:leaf(editor)});await commit(root);const original=editor.getTextGeometry(root,target);
 s.state.hook=()=>{throw Error('controlled provider failure');};editor.setValue('failed');root.setTree(leaf(editor));let failure;for(let i=0;i<12;i++){try{const prep=await root.prepare();if(prep.status!=='pending')root.commit(prep);}catch(cause){failure=cause;break;}await flush();}assert.ok(failure);assert.equal(editor.getTextGeometry(root,target),original);
 s.state.hook=undefined;editor.setValue('latest');root.setTree(leaf(editor));await commit(root);assert.equal(editor.getTextGeometry(root,target).text,'latest');assert.equal(editor.snapshot().livePresentations,1);
 const gate=deferred();s.state.hook=input=>input.text==='slow'?gate.promise.then(()=>raster(input)):raster(input);editor.setValue('slow');root.setTree(leaf(editor));const pending=root.prepare(),settled=pending.catch(cause=>cause);await flush();editor.setValue('newest');root.setTree(leaf(editor));gate.resolve();await settled;await commit(root);await flush();assert.equal(editor.getTextGeometry(root,target).text,'newest');assert.equal(editor.snapshot().livePresentations,1);
});
test('UI text editors authenticate Engine/Scope/root and retain old API boundaries',async t=>{
 const s=await setup(t),foreign=await createEngine({host:host().adapter});t.after(()=>foreign.dispose());assert.throws(()=>createUiTextEditor({...s,scope:foreign.createScope(),mode:'single-line',style}));
 const editor=createUiTextEditor({...s,mode:'single-line',value:'AB',style});assert.throws(()=>editor.setValue('line\nbreak'));assert.throws(()=>editor.setStyle({...style,fontFamilies:[]}));
 const root=createUiRoot({engine:s.engine,scope:s.scope,id:'auth-root',viewport:{width:100,height:100},density:1,tree:leaf(editor)});await commit(root);assert.throws(()=>editor.getTextGeometry({...root},target));
 const other=createUiRoot({engine:foreign,scope:foreign.createScope(),id:'foreign',viewport:{width:100,height:100},density:1,tree:{kind:'leaf',id:'none',explicitHeight:10}});assert.throws(()=>editor.getTextGeometry(other,target));
 editor.dispose();editor.dispose();assert.equal(editor.snapshot().value,'');assert.throws(()=>editor.setValue('closed'));root.dispose();await flush();assert.equal(s.cache.getStatus().callerLeases,0);
});
test('virtual UI editor reuses row ownership and real source generations',async t=>{
 const s=await setup(t),editor=createUiTextEditor({...s,mode:'multiline',value:'AB',style}),source=()=>({revision:editor.content.revision,records:[{key:'field',contentVersion:editor.content.revision,estimatedHeight:120,value:0}],bind:context=>editor.prepare(context),unbind(){}}),root=createUiRoot({engine:s.engine,scope:s.scope,id:'row-root',viewport:{width:140,height:140},density:1,tree:{kind:'virtualList',id:'rows',explicitWidth:140,explicitHeight:140,source:source()}});await commit(root);const rowTarget={kind:'row',listId:'rows',key:'field'};assert.equal(editor.getTextGeometry(root,rowTarget).text,'AB');
 editor.setValue('replacement');root.list('rows').setSource(source());await commit(root);assert.equal(editor.getTextGeometry(root,rowTarget).text,'replacement');assert.equal(editor.snapshot().livePresentations,1);s.scope.dispose();await flush();assert.equal(editor.snapshot().state,'closed');assert.equal(root.state,'closed');assert.equal(s.cache.getStatus().callerLeases,0);
});
