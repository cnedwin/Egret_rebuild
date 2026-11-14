// SPDX-License-Identifier: Apache-2.0
// One row of a managed list is a text editor that holds the focus while its font arrives late or the theme
// changes. The geometry of the rows, the focus, the editor's own geometry and the semantic tree must stay
// in step. A literal paragraph provider stands for the fonts; the native element and real fonts are the
// browser's part and are not in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,createImageData2D,DisplayObjectContainer} from '@egret/engine';
import {createKeyboardInput} from '@egret/engine/input';
import {createParagraphCache} from '@egret/engine/paragraph';
import {createUiTextEditor} from '@egret/engine/ui/editing';
import {createUiRoot,createUiTheme} from '@egret/engine/ui';
import {createUiListSemantics,createUiSemantics} from '@egret/engine/ui/semantics';
import {host,deferred,flush} from './helpers.mjs';

const base={fontSet:'unit-fonts',fontFamilies:['Unit'],fontSize:16,locale:'und',direction:'ltr',fillColor:0xffffff};
const late={...base,fontSet:'late-fonts',fontFamilies:['Late'],fontSize:26};
const themes={dark:createUiTheme({id:'dark',colors:{ink:0xffffff}}),light:createUiTheme({id:'light',colors:{ink:0x101010}})};
/** A line is four units higher than its font size, so a change of font changes the height of the row. */
function raster(input){
 const segments=input.text.split('\n'),line=input.fontSize+4,lines=[],geometryLines=[],clusters=[];let start=0;
 for(let index=0;index<segments.length;index++){const end=start+segments[index].length;
  lines.push({start,end,baseline:index*line+input.fontSize,ascent:input.fontSize,descent:4,height:line,width:20});geometryLines.push({start,end,left:0,right:20,top:index*line,bottom:(index+1)*line});
  if(end>start)clusters.push({start,end,lineIndex:index,direction:input.direction,left:0,right:20,top:index*line,bottom:(index+1)*line});start=end+1;}
 return {metrics:{width:input.width,height:segments.length*line,truncated:false,lines},image:createImageData2D({width:2,height:2,pixels:new Uint8Array(16).fill(255)}),offsetX:0,offsetY:0,geometry:{lines:geometryLines,clusters}};
}
/** Five rows at (10, 20): two plain rows of 20, the editor, two plain rows. The editor row holds the focus. */
async function fixture(t){
 const engine=await createEngine({host:host().adapter});t.after(()=>engine.dispose());
 const scope=engine.createScope(),keyboard=createKeyboardInput({engine,scope}),calls=[],gates=new Map(),bound=[];
 const cache=createParagraphCache(engine.assets,{provider:{identity:'unit.editor-row/1',capabilities:{textGeometry:true,maxLines:true,textAlign:true,fontSets:true},hasFontSet:()=>true,
  async prepare(input){calls.push(input);const gate=gates.get(input.fontSet);if(gate!==undefined)await gate.promise;return raster(input);}}});
 const editor=createUiTextEditor({engine,scope,cache,mode:'single-line',value:'Li Bai',style:base,minHeight:1});
 let revision=0;
 const source=()=>({revision:++revision,records:['a','b','field','c','d'].map(key=>({key,contentVersion:key==='field'?editor.content.revision:0,estimatedHeight:20,value:key})),
  bind(context){bound.push(context.key+':'+context.bindingGeneration+':'+(context.theme?.id??'none'));
   return context.key==='field'?editor.prepare(context):{content:context.scope.use(new DisplayObjectContainer()),measuredHeight:20};},unbind(){}});
 const root=createUiRoot({engine,scope,id:'form',theme:themes.dark,viewport:{width:200,height:200},origin:{x:10,y:20},density:1,keyboard:{input:keyboard,idPrefix:'form'},
  tree:{kind:'virtualList',id:'rows',explicitWidth:200,explicitHeight:200,source:source()}});
 const list=root.list('rows'),target={kind:'row',listId:'rows',key:'field'},semantics=createUiSemantics();
 const row=key=>root.snapshot().rows.find(found=>found.key===key);
 const nodes=createUiListSemantics({semantics,root,list:'rows',id:'form',role:'list',name:'Profile',focusable:true,
  // The text box is a node inside its row: its value is the editor's, and its place is the row's.
  onRowAdded:(key,id)=>{if(key==='field')semantics.add({id:id+'/box',role:'textbox',parent:id,describe:()=>{const box=row('field').box;return {name:'Name',value:editor.snapshot().value,bounds:{x:10+box.x,y:20+box.y,width:box.width,height:box.height}};}});}});
 const commit=async()=>{for(let round=0;round<20;round++){const preparation=await root.prepare();if(preparation.status==='pending'){await flush();continue;}return root.commit(preparation);}assert.fail('The UI did not settle');};
 const publish=()=>semantics.publish(nodes.sync());
 const named=(snapshot,id)=>snapshot.nodes.find(node=>node.id===id);
 /** Everything that must stay in step, as one value. */
 const state=()=>{const snapshot=publish(),field=row('field');
  return {theme:root.snapshot().theme?.id,heights:['a','b','field','c','d'].map(key=>row(key).box.height),tops:['a','b','field','c','d'].map(key=>row(key).box.y),generation:field.bindingGeneration,
   focusKey:list.getFocus().key,focusId:keyboard.getSnapshot().focusedId,semanticFocus:snapshot.focused,text:editor.getTextGeometry(root,target)?.text,
   lineBottom:editor.getTextGeometry(root,target)?.lines[0].bottom,box:named(snapshot,'form/field/box').bounds,value:named(snapshot,'form/field/box').value,after:named(snapshot,'form/c').bounds.y,live:editor.snapshot().livePresentations};};
 await commit();list.focus('field',{visible:true});
 return {engine,scope,keyboard,cache,calls,gates,bound,editor,root,list,source,semantics,commit,publish,state,named};
}
const settled={theme:'dark',heights:[20,20,36,20,20],tops:[0,20,40,76,96],focusKey:'field',focusId:'form:field',semanticFocus:'form/field',text:'Li Bai',lineBottom:20,
 box:{x:10,y:60,width:200,height:36},value:'Li Bai',after:96,live:1};

test('ER01 the editor row is a row like the others: it has its height, the focus, its geometry and a text box in the tree',async t=>{
 const f=await fixture(t);
 const {generation,...first}=f.state();assert.deepEqual(first,settled);assert.ok(generation>0);
 assert.deepEqual(f.publish().nodes.map(node=>node.id),['form','form/a','form/b','form/field','form/field/box','form/c','form/d']);
 assert.deepEqual([f.calls.length,f.calls[0].fontSet,f.calls[0].width],[1,'unit-fonts',184]);
});

test('ER02 a theme changed under the focused editor binds every row again and moves nothing',async t=>{
 const f=await fixture(t),before=f.state(),told=f.semantics.snapshot;
 // The application gives the editor the ink of the new theme, and the root the theme.
 f.editor.setStyle({...base,fillColor:themes.light.colors.ink});f.root.setTheme(themes.light);f.list.setSource(f.source());
 // Until it is committed the old theme is what shows, whole.
 assert.deepEqual(f.state(),before);
 await f.commit();await flush();
 const after=f.state();
 assert.deepEqual({...after,generation:0},{...settled,theme:'light',generation:0});
 assert.ok(after.generation>before.generation,'the editor row was bound again');
 assert.deepEqual(f.bound.filter(entry=>entry.endsWith(':light')).map(entry=>entry.split(':')[0]).sort(),['a','b','c','d','field'],'and so was every other row');
 assert.equal(f.calls.at(-1).fillColor,0x101010);
 // A reader is told of the same nodes, in the same places, with the same one focused. Only the layout they belong to is a later one.
 const now=f.semantics.snapshot;
 assert.deepEqual([now.nodes,now.focused],[told.nodes,told.focused]);assert.ok(now.layoutRevision>told.layoutRevision);
 assert.equal(f.editor.snapshot().value,'Li Bai');
});

test('ER03 a font that arrives late leaves the committed rows, focus and tree as they were until it has arrived',async t=>{
 const f=await fixture(t),before=f.state(),gate=deferred();f.gates.set('late-fonts',gate);
 f.editor.setStyle(late);f.list.setSource(f.source());
 const attempt=f.root.prepare(),outcome=attempt.then(preparation=>preparation,cause=>cause);
 await flush();await flush();
 // The font has not arrived. What is committed is the old paragraph in the old row, with the focus on it.
 // The editor holds two presentations meanwhile: the one that shows and the one that waits for its font.
 assert.deepEqual(f.state(),{...before,live:2});assert.equal(f.calls.at(-1).fontSet,'late-fonts');
 assert.equal(f.keyboard.keyDown({code:'KeyA',key:'a'}),false,'the row still takes its keys, and this one is nobody\'s');f.keyboard.keyUp({code:'KeyA',key:'a'});
 // It arrives: one commit makes the row higher, moves the rows after it, and the tree follows.
 gate.resolve();f.gates.delete('late-fonts');
 const preparation=await outcome;if(preparation?.status==='ready')f.root.commit(preparation);else await f.commit();
 await flush();
 const after=f.state();
 assert.deepEqual({...after,generation:0},{...settled,heights:[20,20,46,20,20],tops:[0,20,40,86,106],lineBottom:30,box:{x:10,y:60,width:200,height:46},after:106,generation:0});
 assert.ok(after.generation>before.generation);
});

test('ER04 a late font, a new theme and a new value together end as the newest of each, with one presentation',async t=>{
 const f=await fixture(t),gate=deferred();f.gates.set('late-fonts',gate);
 f.editor.setStyle(late);f.list.setSource(f.source());
 const stale=f.root.prepare().then(preparation=>preparation,cause=>cause);
 await flush();
 // While the font is awaited the theme and the text change. The preparation that was under way is of neither.
 f.editor.setStyle({...late,fillColor:themes.light.colors.ink});f.editor.setValue('Du Fu');f.root.setTheme(themes.light);f.list.setSource(f.source());
 gate.resolve();f.gates.delete('late-fonts');
 const first=await stale;
 assert.equal(first?.code,'UI_STALE','the preparation that was overtaken is refused, and commits nothing');
 await f.commit();await flush();
 const after=f.state();
 assert.deepEqual({...after,generation:0},{...settled,theme:'light',heights:[20,20,46,20,20],tops:[0,20,40,86,106],lineBottom:30,box:{x:10,y:60,width:200,height:46},after:106,text:'Du Fu',value:'Du Fu',generation:0});
 assert.equal(f.calls.at(-1).text,'Du Fu');assert.equal(f.calls.at(-1).fillColor,0x101010);
 // Closing lets go of everything the editor row held.
 f.root.dispose();await flush();
 assert.deepEqual([f.editor.snapshot().livePresentations,f.cache.getStatus().callerLeases,f.keyboard.getSnapshot().focusedId],[0,0,undefined]);
});
