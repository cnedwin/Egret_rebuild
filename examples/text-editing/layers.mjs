// SPDX-License-Identifier: Apache-2.0
// This optional example uses the same public UI, paragraph cache and view Scope as the form.
import {createUiRoot,createUiLayerManager} from '@egret/engine/ui';
import {createUiTextEditor} from '@egret/engine/ui/editing';
import {createBrowserTextEditor} from '@egret/engine/web/editing';

export async function createFormLayers({engine,scope,base,input,keyboard,canvas,cache,fonts,viewport,density,getName,setName,request,onError,previous}){
 let disposed=false,settingUp=true,version=1,renameBinding;const roots=[],models=new Map();
 const style={fontSet:fonts.key,fontFamilies:fonts.fontFamilies,fontSize:20,lineHeight:30,locale:'und',direction:'ltr',fillColor:0xffffff,backgroundColor:0x29415a};
 function changed(){if(disposed)return;version++;for(const item of roots)item.root.list(item.listId).setSource(source(item.listId,item.keys));if(!settingUp)request();}
 const model=(key,value,mode='single-line')=>{const item=createUiTextEditor({engine,scope,cache,mode,value,style,onChange:changed});models.set(key,item);return item;};
 model('details','Profile: '+getName(),'multiline');model('rename','Rename / 修改名称');
 const draft=model('draft',previous?.draft?.value??getName());model('save','Save / 保存');model('cancel','Cancel / 取消');
 if(previous?.draft?.selection)draft.setSelection(previous.draft.selection);
 function source(listId,keys){return {revision:version,records:keys.map(key=>({key,contentVersion:models.get(key).content.revision,estimatedHeight:48,value:key})),bind:context=>models.get(context.key).prepare(context),unbind(){}};}
 const w=Math.min(360,viewport.width-24),detailsWidth=Math.min(320,viewport.width-24);
 function panel(id,listId,keys,width,height){
  const root=createUiRoot({engine,scope,id,viewport:{width,height},origin:{x:0,y:0},density,input,keyboard:{input:keyboard,idPrefix:id},tree:{kind:'virtualList',id:listId,explicitWidth:width,explicitHeight:height,source:source(listId,keys)},onRowPointer(notification){
   if(notification.kind==='begin'&&notification.key==='draft')renameBinding?.activate({x:notification.event.payload.globalX,y:notification.event.payload.globalY});
   if(notification.kind==='end'&&['rename','save','cancel'].includes(notification.key))action(notification.key);
  },limits:{overscan:1,residentCap:8,retainedCap:2}});
  roots.push({root,listId,keys});return root;
 }
 const details=panel('profile-details','detail-items',['details','rename'],detailsWidth,150),rename=panel('profile-rename','rename-items',['draft','save','cancel'],w,210);
 const layers=createUiLayerManager({engine,scope,input,keyboard,viewport,onInvalidate:()=>{if(!settingUp&&!disposed)request();}});
 layers.register({id:'form',root:base,kind:'base'});
 layers.register({id:'details',root:details,kind:'popup',anchor:{root:base,target:{kind:'row',listId:'fields',key:'name'}},initialFocus:{listId:'detail-items',key:'rename'}});
 layers.register({id:'rename',root:rename,kind:'modal',initialFocus:{listId:'rename-items',key:'draft'}});
 const prepare=async()=>{
  if(disposed)return;
  const detailValue='Profile: '+getName();if(models.get('details').snapshot().value!==detailValue)models.get('details').setValue(detailValue);
  for(const {root}of roots){let done=false;for(let n=0;n<40;n++){const candidate=await root.prepare();if(candidate.status==='pending'){await new Promise(resolve=>setTimeout(resolve,0));continue;}const result=root.commit(candidate);if(['committed','unchanged'].includes(result.kind)){done=true;break;}if(result.kind!=='stale')throw Error('EXAMPLE_LAYER_COMMIT');}if(!done)throw Error('EXAMPLE_LAYER_PENDING');}
  const result=layers.sync();if(!['committed','unchanged'].includes(result.kind)||result.postCommitErrors.length)throw Error('EXAMPLE_LAYER_PUBLISH',{cause:result.postCommitErrors[0]});renameBinding?.sync();
 };
 await prepare();
 renameBinding=createBrowserTextEditor({editor:draft,root:rename,target:{kind:'row',listId:'rename-items',key:'draft'},canvas,fonts,logicalWidth:viewport.width,logicalHeight:viewport.height,keyboard,label:'Rename profile / 修改名称',onInvalidate:request,onError});
 if(previous)for(const name of previous.stack)layers.open(name);
 settingUp=false;await prepare();
 function action(kind){
  if(disposed)throw Error('EXAMPLE_LAYER_CLOSED');
  if(kind==='details')layers.open('details');
  else if(kind==='rename'){if(!layers.snapshot().desiredStack.includes('details'))throw Error('EXAMPLE_LAYER_ORDER');draft.setValue(getName());layers.open('rename');}
  else if(kind==='save'){renameBinding.finish();setName(draft.snapshot().value);layers.close('rename');}
  else if(kind==='cancel'){renameBinding.cancel();layers.close('rename');}
  else if(kind==='dismiss')layers.close(layers.snapshot().desiredStack.at(-1)??'details');
  else if(kind==='list')layers.close('details');
  else throw Error('EXAMPLE_LAYER_ACTION');request();
 }
 return Object.freeze({prepare,action,activate:()=>renameBinding.activate(),inspect:()=>({manager:layers.snapshot(),details:details.snapshot(),rename:rename.snapshot(),draft:draft.snapshot(),binding:renameBinding.snapshot()}),saveView:()=>({stack:layers.snapshot().desiredStack,draft:draft.snapshot()}),replaceFonts(set){renameBinding.setFontSet(set);for(const [key,item]of models)if(key!=='draft')item.setStyle({...item.snapshot().style,fontSet:set.key,fontFamilies:set.fontFamilies});},dispose(){if(disposed)return;disposed=true;layers.dispose();renameBinding.dispose();for(const {root}of roots)root.dispose();for(const item of models.values())item.dispose();}});
}
