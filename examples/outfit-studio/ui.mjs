// SPDX-License-Identifier: Apache-2.0
import {createUiLayerManager, createUiRoot} from '@egret/engine/ui';
import {createUiTextEditor} from '@egret/engine/ui/editing';
import {createBrowserTextEditor} from '@egret/engine/web/editing';
import {createBrowserKeyboardInput} from '@egret/engine/web/keyboard';
import {createBrowserPointerInput} from '@egret/engine/web/pointer';
import {frameOptions} from './scene.mjs';
import {fixedPickOptions} from './reference.mjs';
import {workload} from './workload.mjs';

const outfitLabels = {default:'Classic', 'cool-coat':'Cool coat', 'warm-hat':'Warm hat', both:'Coat and hat'};

export async function createStudioUi({engine,scope,canvas,cache,fonts,initial,onAction,onError,requestDraw,signal,profile}) {
  const {width,height} = profile ?? frameOptions;
  const viewport = {x:0,y:0,width,height};
  const mobile = profile?.ratio === 2;
  const ratio = profile?.ratio ?? 1;
  const padding = mobile ? 5 : 8, rowHeight = mobile ? 28 : 44;
  const rosterBounds = profile?.roster ?? {x:28,y:106,width:300,height:250};
  const draftWidth = Math.min(width-16,360);
  const readonly = new Set(['profile','summary']);
  const keyboard = createBrowserKeyboardInput({engine,scope});
  const input = createBrowserPointerInput({engine,scope,width,height,...(profile ? fixedPickOptions : {})});
  const models = new Map();
  const panels = [];
  const presses = new WeakMap();
  let revision = 0;
  let dirty = true, layoutDirty = false;
  let native;
  const invalidate = () => { dirty = true; };
  function activate(point) {
    if (native?.snapshot().state === 'settling') { onAction('draft'); return; }
    try { native?.activate(point); }
    catch (error) { onError(error); }
  }

  function model(key, value, color = 0x213452) {
    const editor = createUiTextEditor({engine,scope,cache,mode:'single-line',value,padding,
      ...(profile ? {minHeight:rowHeight-2*padding} : {}),
      ...(key === 'draft' ? {maxLength:40} : {}),
      onChange(change) { if (key !== 'draft' || change.source !== 'native') invalidate(); },
      style:{fontSet:fonts.key,fontFamilies:fonts.fontFamilies,fontSize:mobile ? 13 : 17,lineHeight:mobile ? 18 : 28,locale:'und',
        direction:'ltr',fillColor:0xf0f5ff,backgroundColor:color}});
    models.set(key, editor);
    return editor;
  }

  for (let index = 0; index < initial.characters.length; index++) model('hero-'+index,'');
  model('skin', 'Change outfit / 更换装扮');
  model('palette', 'Swap palette / 切换配色');
  model('details', 'Details / 查看详情', 0x264c69);
  model('profile', '');
  if (profile) model('summary',workload.text);
  model('rename', 'Rename / 重命名');
  model('back', 'Back / 返回');
  const draft = model('draft', '');
  let draftVersion = draft.content.revision;
  let refusedDraftVersion;
  model('save', 'Save / 保存', 0x24595b);
  model('cancel', 'Cancel / 取消');

  function source(keys) {
    return {
      revision,
      records:keys.map(key => ({key,contentVersion:key === 'draft' ? draftVersion : models.get(key).content.revision,estimatedHeight:rowHeight,value:key})),
      async bind(context) {
        const row = await models.get(context.key).prepare(context);
        if (!readonly.has(context.key)) row.content.on(keyboard.events.keyDown, event => {
          if (event.payload.key === 'Enter' && !event.payload.repeat) {
            event.preventDefault();
            if (context.key === 'draft') activate();
            else onAction(context.key);
          }
        });
        return row;
      },
      unbind() {}
    };
  }

  function panel(id, listId, keys, origin, width, height) {
    const root = createUiRoot({engine,scope,id,origin,viewport:{width,height},density:ratio,input,
      keyboard:{input:keyboard,idPrefix:id},
      tree:{kind:'virtualList',id:listId,explicitWidth:width,explicitHeight:height,source:source(keys)},
      limits:{overscan:1,residentCap:8,retainedCap:2},
      onRowPointer(notification) {
        const {key,kind,event,target} = notification;
        const {session,buttons,globalX,globalY} = event.payload;
        if (kind === 'begin' && buttons === 1) presses.set(session,{target,x:globalX,y:globalY});
        const pressed = presses.get(session);
        if (kind === 'move' && pressed && Math.hypot(globalX-pressed.x,globalY-pressed.y) >= workload.dragThreshold) {
          pressed.dragged = true;
          if (mobile && listId === 'edit') {
            pressed.scroll ??= root.snapshot().scrollOffset;
            root.list(listId).setScrollOffset(pressed.scroll+pressed.y-globalY);
            layoutDirty = true;
            requestDraw();
          }
        }
        if (kind === 'cancel') presses.delete(session);
        if (kind !== 'end') return;
        presses.delete(session);
        if (pressed?.target !== target || pressed.dragged) return;
        // A captured release can arrive outside the pressed row. Pick the committed scene again.
        let hit = engine.stage.hitTest(globalX,globalY,profile ? fixedPickOptions : undefined);
        while (hit && hit !== target) hit = hit.parent;
        if (!hit) return;
        if (key === 'draft') {
          // Let the canvas's native mouse-down focus settle before focusing the editor.
          activate({x:globalX,y:globalY});
        } else if (!readonly.has(key)) onAction(key);
      }
    });
    panels.push({root,listId,keys});
    return root;
  }

  const roster = panel('studio-roster','roster',['hero-0','hero-1','skin','palette','details'],
    {x:rosterBounds.x,y:rosterBounds.y},rosterBounds.width,rosterBounds.height);
  const detailKeys = profile ? ['profile','summary','rename','back'] : ['profile','rename','back'];
  const editKeys = profile ? ['draft','save','cancel','summary'] : ['draft','save','cancel'];
  const details = panel('studio-detail','detail',detailKeys,{x:0,y:0},Math.min(width-16,316),
    mobile ? 128 : profile ? rowHeight*4+10 : 142);
  const modal = panel('studio-rename','edit',editKeys,{x:0,y:0},draftWidth,
    mobile ? rowHeight*3+12 : profile ? rowHeight*4+10 : 154);
  const layers = createUiLayerManager({engine,scope,input,keyboard,viewport,onInvalidate:requestDraw});
  layers.register({id:'roster',root:roster,kind:'base'});
  layers.register({id:'details',root:details,kind:'popup',anchor:{root:roster,target:{kind:'row',listId:'roster',key:'details'}},
    initialFocus:{listId:'detail',key:'rename'}});
  layers.register({id:'rename',root:modal,kind:'modal',initialFocus:{listId:'edit',key:'draft'}});

  function update(characters, selected) {
    const values = new Map(characters.map((row,index) => [`hero-${index}`, `${row.id === selected ? '› ' : '  '}${row.name}`]));
    const current = characters.find(row => row.id === selected);
    values.set('profile', current.name);
    values.set('skin', `${outfitLabels[current.outfit]} · Change outfit`);
    values.set('palette', current.palette === 'studio' ? 'Studio palette · Swap' : 'Alternate palette · Swap');
    for (const [key,value] of values) {
      const editor = models.get(key);
      if (editor.snapshot().value !== value) editor.setValue(value);
    }
  }

  async function prepareText(editor, text, width) {
    const style = editor.snapshot().style;
    const prepared = await cache.acquire({...style,text,width:width-2*padding,density:ratio,maxLines:1,textGeometry:true}, {signal:scope.signal});
    prepared.lease.release();
  }

  async function settleDraft() {
    const version = draft.content.revision;
    if (native?.snapshot().state !== 'settling' || layers.snapshot().desiredStack.at(-1) !== 'rename' ||
        version === draftVersion || version === refusedDraftVersion) return;
    try {
      await prepareText(draft,draft.snapshot().value,draftWidth);
      signal.throwIfAborted();
      if (draft.content.revision === version) { draftVersion = version; invalidate(); }
    } catch (error) {
      signal.throwIfAborted();
      if (draft.content.revision === version) refusedDraftVersion = version;
    }
  }

  async function publish() {
    await settleDraft();
    // Layout, overlay authority and the native editor all consume one committed revision.
    let pending = dirty || layoutDirty, changed = false;
    for (let n = 0; (dirty || pending || layoutDirty) && n < 40; n++) {
      signal.throwIfAborted();
      pending = layoutDirty = false;
      if (dirty) {
        dirty = false;
        revision++;
        for (const item of panels) item.root.list(item.listId).setSource(source(item.keys));
      }
      for (const {root} of panels) {
        const token = await root.prepare();
        signal.throwIfAborted();
        if (token.status === 'pending') { pending = true; continue; }
        const result = root.commit(token);
        if (result.kind === 'stale') pending = true;
        else if (result.kind === 'committed') changed = true;
        else if (result.kind !== 'unchanged') throw new Error('Studio layout publication failed');
      }
      if (dirty || pending || layoutDirty) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (dirty || pending || layoutDirty) throw new Error('Studio layout is still pending');
    const result = layers.sync();
    if ((result.kind !== 'committed' && result.kind !== 'unchanged') || result.postCommitErrors.length) {
      throw new Error('Studio layer publication failed', {cause:result.postCommitErrors[0]});
    }
    native?.sync();
    return changed || result.kind === 'committed';
  }

  update(initial.characters, initial.selected);
  await publish();
  native = createBrowserTextEditor({editor:draft,root:modal,target:{kind:'row',listId:'edit',key:'draft'},canvas,fonts,keyboard,
    logicalWidth:viewport.width,logicalHeight:viewport.height,label:'Character name / 角色名称',
    onInvalidate:requestDraw,onError});
  scope.use(native);

  function resetDraft(name) {
    // The native field keeps draft text until Save admits it or the user cancels.
    draft.setValue(name);
    draftVersion = draft.content.revision;
    refusedDraftVersion = undefined;
    invalidate();
  }

  return {
    update,publish,input,
    get layer() { return layers.snapshot().desiredStack.at(-1) ?? 'roster'; },
    details() { layers.open('details'); },
    back() { layers.close('details'); },
    rename(name) { resetDraft(name); layers.open('rename'); },
    draft() { native.finish(); return draft.snapshot().value; },
    resetDraft,
    prepareName(name) { return prepareText(models.get('hero-0'),'› '+name,4096); },
    async resumeDraft(savedName) {
      // The native bridge can start a new session once the previous value has matching geometry.
      await publish();
      if (refusedDraftVersion === draft.content.revision) {
        resetDraft(savedName);
        await publish();
      }
      signal.throwIfAborted();
      if (layers.snapshot().desiredStack.at(-1) === 'rename') native.activate();
    },
    closeRename() { layers.close('rename'); },
    cancelRename() { native.cancel(); layers.close('rename'); },
    inspect() {
      return {layers:layers.snapshot(),roster:roster.snapshot(),details:details.snapshot(),rename:modal.snapshot(),
        editor:native.snapshot(),keyboard:keyboard.getSnapshot()};
    }
  };
}
