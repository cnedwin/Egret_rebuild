// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile} from '@egret/engine';
import {createParagraphCache} from '@egret/engine/paragraph';
import {createStudioAssets, fetchStudio} from './assets.mjs';
import {expandStudioProject, maxProjectBytes, openStudioProject, outfits} from './project.mjs';
import {createStudioScene, frameOptions} from './scene.mjs';
import {createStudioUi} from './ui.mjs';
import {createStudioWorkload,createStudioReferenceView} from './reference.mjs';
import {fixedProfile,workload} from './workload.mjs';
import {studioTouchState} from './touch.mjs';
import {createStudioTiming} from './timing.mjs';

const canvas = document.querySelector('canvas');
const status = document.querySelector('#status');
const pause = document.querySelector('#pause');
const download = document.querySelector('#download');
const openButton = document.querySelector('#open');
const projectFile = document.querySelector('#project-file');
const closeButton = document.querySelector('#close');
const params = new URL(location.href).searchParams;
const backend = params.get('backend') ?? 'webgpu';
const profileName = params.get('profile');
const mode = params.get('load') ?? 'sparse';
const mobile = profileName === 'x-mtouch' || profileName === 'x-mtouch-2';
const viewport = document.querySelector('.viewport');
const landscape = () => screen.orientation?.type?.startsWith('landscape') ?? matchMedia('(orientation:landscape)').matches;
let profile = fixedProfile(profileName,landscape()), frame = frameOptions;
const timing = profile && params.get('trace') === '1' ? createStudioTiming(mode) : undefined;
const backgroundCanvas = profile?.mixed ? document.createElement('canvas') : undefined;
if (backgroundCanvas) {
  backgroundCanvas.className = 'studio-background';
  backgroundCanvas.setAttribute('aria-hidden','true');
  viewport.append(backgroundCanvas);
  viewport.classList.add('studio-waiting');
  viewport.inert = true;
  document.documentElement.classList.add('studio-mixed');
}
const touch = studioTouchState(), selection = {scroll:0,drawer:0};
let viewScope,view,fixed,fonts,layoutRevision = 0,reflowQueued = false,frames = 0,presented;
let retiredCast,retiredWorkload;
if (profile) {
  document.documentElement.classList.add(mobile ? 'studio-phone' : 'studio-fixed');
  for (const link of document.querySelectorAll('[data-backend]')) {
    const search = new URLSearchParams(params); search.set('backend',link.dataset.backend);
    link.href = '?' + search;
  }
}
const lifetime = new AbortController();
const {signal} = lifetime;
const errors = [];
let host, engine, scope, assets, cache, cast, ui, project, selected, draftId, upload, cleanup;
let state = 'loading', elapsed = 0, playing = true, raf = 0, lastFrame;
let pendingActions = 0, palettePending = false, paintQueued = false, paintDirty = false;
let replacement, nameRefusal, closing, loads = [], tail = Promise.resolve();
let opening, opened, mixed, restoreCanvasFocus = false;

const message = (en, zh) => { status.textContent = `${en} / ${zh}`; };
function report(error) {
  if (signal.aborted || (state === 'recovering' && isGraphicsInterruption(error))) return;
  errors.push({code:error?.code ?? error?.name ?? 'Error',message:String(error?.message ?? error)});
  if (errors.length > 32) errors.shift();
  message('The action could not finish. Try again.', '操作未完成，请重试。');
}

function enqueue(operation) {
  const pending = tail.then(() => { signal.throwIfAborted(); return operation(); });
  tail = pending.catch(() => {});
  return pending;
}

function characters() { return profile ? project.characters() : project.characters().slice(0,2); }
function inspect() {
  const bounds = canvas.getBoundingClientRect();
  return {state,backend,playing,selected,revision:project?.revision,characters:project?.characters(),
    ...(profile ? {profile:profile.id,mode,layoutRevision,scene:fixed?.inspect() ?? retiredWorkload,reference:viewScope?.state === 'open' ? view?.inspect() : undefined,
      surface:{width:frame.width,height:frame.height,ratio:profile.ratio,dpr:devicePixelRatio,
        backing:[canvas.width,canvas.height],css:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}},
      frames,presented,resources:state === 'ready' ? host.getSharedStatus().resources : undefined} : {}),
    ...(mixed ? {mixed:mixed.inspect(state,host?.getSessionStatus().generation ?? cleanup?.host?.generation)} : {}),
    cast:cast?.inspect() ?? retiredCast,ui:state === 'ready' ? ui.inspect() : undefined,replacement,nameRefusal,opened,cleanup,errors:[...errors],
    interactive:performance.getEntriesByName('egret-studio-interactive')[0]?.startTime};
}

const waitForMixed = pending => mixed ? mixed.wait(pending) : pending;

function mixedInterrupted() {
  return Object.assign(new Error('Studio mixed frame expired'), {code:'STUDIO_MIXED_INTERRUPTED'});
}

function isGraphicsInterruption(error) {
  return ['STUDIO_MIXED_INTERRUPTED','WEBGL2_CONTEXT_LOST','WEBGL2_CONTEXT_RESTORING','WEBGPU_DEVICE_LOST'].includes(error?.code);
}

async function draw(readback = false, sample, recovering = false) {
  const epoch = mixed?.epoch;
  function checkMixed() {
    if (mixed && (mixed.epoch !== epoch || (state === 'recovering' && !recovering))) throw mixedInterrupted();
  }
  checkMixed();
  const uiStart = sample && performance.now();
  const vaultChanged = await view?.publish();
  const uiChanged = await ui.publish();
  signal.throwIfAborted();
  checkMixed();
  if (fixed && (uiChanged || vaultChanged || frames === 0)) fixed.sync(cast.root);
  if (view) { cast.applyView(touch.camera,selected,touch.holds); view.drawControls(); }
  const action = touch.lastAction;
  const captureStart = sample && performance.now();
  const captured = engine.captureSharedFrame(frame);
  const hostStart = sample && performance.now();
  const receipt = mixed?.begin(layoutRevision,host.getSessionStatus().generation);
  let pixels, submittedAt;
  try {
    const reading = readback ? host.requestReadback() : undefined;
    void reading?.catch(() => {});
    host.renderSharedFrame(captured);
    submittedAt = sample && performance.now();
    pixels = await waitForMixed(reading);
    await waitForMixed(host.whenIdle());
    signal.throwIfAborted();
    checkMixed();
  } catch (error) {
    if (receipt) mixed.partial();
    throw error;
  }
  if (receipt) mixed.complete(receipt);
  const completedAt = performance.now();
  frames++;
  if (action && presented?.action !== action.number) {
    presented = {action:action.number,eventAt:action.at,completedAt,frame:frames,latencyMs:completedAt-action.at};
  }
  if (sample) timing.record({...sample,completedAt,submittedAt,uiMs:captureStart-uiStart,
    captureMs:hostStart-captureStart,hostMs:submittedAt-hostStart,dpr:devicePixelRatio,
    visible:document.visibilityState === 'visible',focused:document.hasFocus(),layoutRevision});
  return pixels;
}

function advance(delta) {
  elapsed += delta;
  engine.advanceTime(elapsed);
}

function animate(time) {
  raf = 0;
  if (state !== 'ready' || !playing) return;
  void enqueue(async () => {
    if (state !== 'ready' || !playing || reflowQueued) return;
    const mutationStart = timing && performance.now();
    fixed?.mutate(mode);
    const animationStart = timing && performance.now();
    const delta = profile ? (mode === 'static' ? 0 : workload.clockStep) :
      lastFrame === undefined ? 0 : Math.min(.05, Math.max(0, (time-lastFrame)/1000));
    lastFrame = time;
    if (delta) { view?.touch.step(); advance(delta); }
    const sample = timing ? {raf:time,mutationMs:animationStart-mutationStart,
      animationMs:performance.now()-animationStart,frame:frames+1} : undefined;
    await draw(false,sample);
  }).then(schedule, error => {
    if (signal.aborted || (mixed && isGraphicsInterruption(error))) return;
    playing = false;
    report(error);
  });
}

function schedule() {
  if (state === 'ready' && playing && !raf) raf = requestAnimationFrame(animate);
}

function requestDraw() {
  if (state !== 'ready' || playing) return;
  paintDirty = true;
  if (paintQueued) return;
  paintQueued = true;
  void enqueue(async () => { paintDirty = false; if (state === 'ready') await draw(); }).catch(report).finally(() => {
    paintQueued = false;
    if (paintDirty) requestDraw();
  });
}

async function replacePalette(character) {
  const palette = character.palette === 'studio' ? 'alternate' : 'studio';
  replacement = {id:character.id,palette,phase:'loading'};
  message('Loading palette…', '正在加载配色…');
  let ticket;
  let committed = false;
  const epoch = mixed?.epoch;
  try {
    // Admit the authored edit privately before publishing the live candidate.
    const nextProject = openStudioProject(project.serialize());
    nextProject.edit(character.id, {palette});
    const {loader} = await waitForMixed(assets.library(palette));
    signal.throwIfAborted();
    ticket = cast.requestPalette(character, palette, loader);
    await waitForMixed(ticket.ready);
    signal.throwIfAborted();

    // This queue owns the final capture window. The previous frame stays visible through loading and staging.
    upload = host.stageSharedFrame(ticket.capture(frame));
    const staged = await waitForMixed(upload.ready);
    signal.throwIfAborted();
    const session = host.getSessionStatus();
    if (mixed?.epoch !== epoch) throw mixedInterrupted();
    if (session.state !== 'ready' || session.generation !== staged.generation) throw new Error('Studio palette generation expired');
    try { ticket.commit(); }
    finally {
      if (ticket.state === 'committed') {
        committed = true;
        project = nextProject;
        cast.retireBorrowed(character.id);
      }
    }
    if (mixed) {
      // The staged proof admitted the palette. Only the paired draw presents it on /2.
      upload.dispose();
      upload = undefined;
    } else {
      await upload.submit().completed;
      await host.whenIdle();
    }
    replacement = {...replacement,phase:'ready'};
    message('Palette applied', '已应用配色');
  } catch (error) {
    replacement = {...replacement,phase:committed ? 'presentation-failed' : 'failed',reason:String(error?.code ?? error?.message ?? error)};
    if (!signal.aborted && state !== 'recovering') {
      if (committed) message('Palette saved. Refresh the preview to show it.', '配色已保存，请刷新预览。');
      else message('Palette unavailable. Your previous outfit is still active.', '配色无法加载，原装扮仍可使用。');
    }
  } finally {
    upload?.dispose();
    upload = undefined;
    ticket?.dispose();
    lastFrame = undefined;
  }
}

const openFailures = {
  STUDIO_OPEN_CHARACTERS:['This file holds other characters. Your project is unchanged.', '该文件的角色与当前工程不同，当前工程未改变。'],
  STUDIO_OPEN_VERSIONS:['This file was saved with other versions. Your project is unchanged.', '该文件由其他版本保存，当前工程未改变。'],
  STUDIO_OPEN_FILE:['This is not an Outfit Studio project file. Your project is unchanged.', '这不是换装工作室的工程文件，当前工程未改变。'],
  STUDIO_OPEN_NAME:['A name in this file could not be displayed. Your project is unchanged.', '该文件中有无法显示的名称，当前工程未改变。']
};

/**
 * Opens an exported project over the live one. Everything that can fail or be cancelled happens first, on
 * private candidates, while the previous frame stays on screen. Only then do the project, the cast and the
 * interface change, together and without a pause between them.
 */
async function openProject(file, control) {
  const stop = () => control.abort();
  signal.addEventListener('abort', stop, {once:true});
  if (signal.aborted) stop();
  // Cancel may arrive before this turn of the queue, or at any wait below.
  const cancelled = new Promise((resolve, reject) => {
    const refuse = () => reject(Object.assign(new Error('Opening cancelled'), {code:'STUDIO_OPEN_CANCELLED'}));
    if (control.signal.aborted) refuse(); else control.signal.addEventListener('abort', refuse, {once:true});
  });
  void cancelled.catch(() => {});
  const wait = promise => Promise.race([promise, cancelled]);
  const coded = (code, action) => { try { return action(); } catch (error) { throw Object.assign(error, {code:error.code ?? code}); } };
  const tickets = [];
  let published = false;
  const epoch = mixed?.epoch;
  opened = {file:file.name,phase:'loading',revision:project.revision};
  try {
    await wait(Promise.resolve());
    if (file.size > maxProjectBytes) throw Object.assign(new Error('The file is too long'), {code:'STUDIO_OPEN_FILE'});
    let text = await wait(file.text());
    // The fixed routes show eight characters. A two-character export gains the same six as at start-up.
    if (profile) text = coded('STUDIO_OPEN_FILE', () => expandStudioProject(text));
    // Admit the file privately: one edit transaction on a copy of the live project.
    const next = openStudioProject(project.serialize());
    const changes = coded('STUDIO_OPEN_FILE', () => next.adopt(text));
    if (next.revision === project.revision) {
      opened = {...opened,phase:'unchanged',changed:[]};
      message('This project is already open', '工程内容与当前一致');
      return;
    }
    // A saved name must remain renderable with this example's own font set.
    for (const {before,after} of changes) {
      if (before.name !== after.name) await wait(ui.prepareName(after.name)).catch(error => { throw Object.assign(error, {code:error.code === 'STUDIO_OPEN_CANCELLED' ? error.code : 'STUDIO_OPEN_NAME'}); });
    }
    for (const {before,after} of changes) {
      if (before.palette === after.palette) continue;
      const {loader} = await wait(assets.library(after.palette));
      const ticket = cast.requestPalette(after, after.palette, loader);
      tickets.push({ticket,id:after.id});
      await wait(ticket.ready);
    }
    // This queue owns the final window: the clock stands still from the first capture to the last commit.
    // The Host takes each candidate before anything is published. Nothing is submitted here.
    for (const {ticket} of tickets) {
      upload = host.stageSharedFrame(ticket.capture(frame));
      const staged = await wait(upload.ready);
      const session = host.getSessionStatus();
      if (session.state !== 'ready' || session.generation !== staged.generation) throw new Error('Studio project generation expired');
      upload.dispose();
      upload = undefined;
    }
    await wait(Promise.resolve());

    if (control.signal.aborted) await cancelled;
    if (mixed?.epoch !== epoch) throw mixedInterrupted();

    // End cancellation at the synchronous publication boundary.
    openButton.disabled = true;
    openButton.textContent = 'Presenting project… / 正在呈现工程…';
    // Publication. Nothing below waits until the project, the cast and the interface have changed together.
    try {
      for (const {ticket,id} of tickets) { ticket.commit(); cast.retireBorrowed(id); }
    } catch (error) {
      // A candidate that held a moment ago was refused. The cast no longer matches either project.
      if (tickets.some(({ticket}) => ticket.state === 'committed')) { opened = {...opened,phase:'inconsistent'}; void close('failed'); }
      throw error;
    }
    for (const {before,after} of changes) if (before.outfit !== after.outfit) cast.setOutfit(after.id, after.outfit);
    if (ui.layer === 'rename') ui.cancelRename();
    draftId = nameRefusal = undefined;
    project = next;
    published = true;
    ui.update(characters(), selected);
    if (changes.some(({before,after}) => before.outfit !== after.outfit || (profile && before.palette !== after.palette))) advance(1 / 120);
    opened = {...opened,phase:'published',revision:project.revision,changed:changes.map(row => row.id)};
    await draw();
    opened = {...opened,phase:'ready'};
    message(`Project opened. Characters updated: ${changes.length}`, `已打开工程，更新了 ${changes.length} 个角色`);
  } catch (error) {
    const code = String(error?.code ?? error?.name ?? 'Error');
    if (published) {
      opened = {...opened,phase:'presentation-failed',reason:code};
      if (!signal.aborted && state !== 'recovering') message('Project opened. Refresh the preview to show it.', '工程已打开，请刷新预览。');
    } else if (opened.phase !== 'inconsistent') {
      const cancel = code === 'STUDIO_OPEN_CANCELLED';
      opened = {...opened,phase:cancel ? 'cancelled' : 'failed',reason:code,detail:String(error?.message ?? error).slice(0,200)};
      if (signal.aborted || state === 'recovering') return;
      if (cancel) message('Opening cancelled. Your project is unchanged.', '已取消打开，当前工程未改变。');
      else message(...(openFailures[code] ?? ['The project could not be loaded. Your project is unchanged. Try again.', '工程加载失败，当前工程未改变，可以重试。']));
    }
  } finally {
    upload?.dispose();
    upload = undefined;
    // A ticket that was not committed gives back its candidate; a committed one has nothing left to give.
    for (const {ticket} of tickets) ticket.dispose();
    opened = {...opened,candidates:tickets.map(({ticket}) => ticket.state)};
    signal.removeEventListener('abort', stop);
    lastFrame = undefined;
  }
}

async function act(key) {
  const epoch = mixed?.epoch;
  const current = project.character(selected);
  const layer = ui.layer;
  if (layer === 'roster') {
    if (/^hero-[0-7]$/.test(key)) {
      selected = characters()[Number(key.at(-1))].id;
      message(project.character(selected).name, '已选择角色');
    } else if (key === 'skin') {
      const outfit = outfits[(outfits.indexOf(current.outfit) + 1) % outfits.length];
      project.edit(selected, {outfit});
      cast.setOutfit(selected, outfit);
      advance(1 / 120);
      message('Outfit applied', '已应用装扮');
    } else if (key === 'palette') {
      await replacePalette(current);
      if (profile && replacement.phase === 'ready') advance(1/120);
    }
    else if (key === 'details') ui.details();
  } else if (layer === 'details') {
    if (key === 'rename') { draftId = selected; nameRefusal = undefined; ui.rename(current.name); }
    else if (key === 'back') ui.back();
  } else if (layer === 'rename' && draftId) {
    if (key === 'draft') await ui.resumeDraft(project.character(draftId).name);
    else if (key === 'save') {
      const name = ui.draft();
      if (!name.trim() || name.length > 40) {
        message('Enter a name from 1 to 40 characters.', '请输入 1 至 40 字符的名称。');
        ui.resetDraft(project.character(draftId).name);
        await draw();
        return;
      }
      try {
        // A saved snapshot must remain renderable with this example's own font set.
        await waitForMixed(ui.prepareName(name));
        signal.throwIfAborted();
        if (mixed?.epoch !== epoch) throw mixedInterrupted();
        project.edit(draftId, {name});
      } catch (error) {
        if (signal.aborted || mixed?.epoch !== epoch) throw error;
        nameRefusal = {revision:project.revision,code:error?.code ?? error?.name};
        ui.resetDraft(project.character(draftId).name);
        message('This name could not be displayed. Try a different name.', '这个名称无法显示，请换一个名称。');
        await draw();
        return;
      }
      nameRefusal = undefined;
      ui.closeRename();
      draftId = undefined;
      message('Name saved to the project', '名称已保存到工程');
    } else if (key === 'cancel') {
      ui.cancelRename();
      draftId = undefined;
      message('Rename cancelled', '已取消重命名');
    }
  }
  signal.throwIfAborted();
  ui.update(characters(),selected);
  await draw();
}

function onAction(key) {
  if (state !== 'ready' || reflowQueued || opening || pendingActions >= 8 || (key === 'palette' && palettePending)) return;
  const source = ui, sourceLayer = source.layer, epoch = mixed?.epoch;
  pendingActions++;
  if (key === 'palette') palettePending = true;
  // Apply queued input only while its originating layer still owns the action.
  void enqueue(() => { if (state === 'ready' && mixed?.epoch === epoch && ui === source && !reflowQueued && source.layer === sourceLayer) return act(key); }).catch(report).finally(() => {
    pendingActions--;
    if (key === 'palette') palettePending = false;
  });
}

function fitSurface() {
  if (!profile) return;
  const viewportHeight = window.visualViewport?.height ?? innerHeight;
  const top = Math.max(0,viewport.getBoundingClientRect().top-(window.visualViewport?.offsetTop ?? 0));
  const scale = mobile ? Math.min(viewport.clientWidth/profile.width,Math.max(96,viewportHeight-top-58)/profile.height) : 1;
  const width = profile.width*scale+'px', height = profile.height*scale+'px';
  if (canvas.style.width === width && canvas.style.height === height) return;
  if (ui?.input.state === 'active') ui.input.cancelAll('viewport');
  canvas.style.width = width;
  canvas.style.height = height;
  if (backgroundCanvas) {
    backgroundCanvas.style.width = width;
    backgroundCanvas.style.height = height;
  }
}

async function mountView() {
  signal.throwIfAborted();
  viewScope = engine.createScope();
  ui = await createStudioUi({engine,scope:viewScope,canvas,cache,fonts:fonts.set,initial:{characters:characters(),selected},
    onAction,onError:report,requestDraw,signal,profile});
  view = profile ? createStudioReferenceView({engine,scope:viewScope,input:ui.input,profile,state:touch,selection,onAction,invalidate:requestDraw}) : undefined;
  if (mixed && (state !== 'ready' || reflowQueued)) suspendMixedInput();
  layoutRevision++;
}

function setFrameSize() {
  const alpha = backgroundCanvas ? {clearAlpha:0,outputAlpha:'premultiplied'} : {};
  if (profile) frame = {...frameOptions,...alpha,width:profile.width,height:profile.height};
  mixed?.resize(profile);
}

async function changeOrientation() {
  // The new view consumes one geometry revision while the authored scene and resources stay live.
  if (ui.layer === 'rename') ui.cancelRename();
  draftId = undefined;
  viewScope.dispose();
  ui = view = undefined;
  profile = fixedProfile(profileName,landscape());
  setFrameSize();
  fitSurface();
  fixed.layout(profile);
  cast.layout(profile);
  await mountView();
}

function suspendMixedInput() {
  restoreCanvasFocus ||= document.activeElement === canvas;
  ui?.setInteractive(false);
  viewport.inert = true;
  viewport.classList.add('studio-waiting');
  viewport.setAttribute('aria-busy','true');
  pause.disabled = download.disabled = openButton.disabled = true;
}

function restoreMixedInput() {
  ui.setInteractive(true);
  viewport.inert = false;
  viewport.classList.remove('studio-waiting');
  viewport.removeAttribute('aria-busy');
  if (restoreCanvasFocus && document.activeElement === document.body) canvas.focus({preventScroll:true});
  restoreCanvasFocus = false;
  pause.disabled = download.disabled = false;
  openButton.disabled = Boolean(opening);
}

function recoverMixed() {
  if (state !== 'ready' || signal.aborted) return;
  state = 'recovering';
  cancelAnimationFrame(raf);
  raf = 0;
  lastFrame = undefined;
  opening?.abort();
  suspendMixedInput();
  message('Recovering graphics…', '正在恢复图形…');
  void enqueue(async () => {
    // A second loss can supersede the first recovery without replacing the editable scene.
    for (;;) {
      const epoch = mixed.epoch;
      try {
        await mixed.restore(host);
        signal.throwIfAborted();
        if (mixed.epoch !== epoch) continue;
        if (mobile && fixedProfile(profileName,landscape()) !== profile) {
          await changeOrientation();
        }
        fitSurface();
        if (mixed.epoch !== epoch) continue;
        await draw(false,undefined,true);
        if (mixed.epoch !== epoch) continue;
        state = 'ready';
        restoreMixedInput();
        message('Graphics restored', '图形已恢复');
        reflow();
        schedule();
        return;
      } catch (error) {
        if (signal.aborted || mixed.epoch === epoch) throw error;
      }
    }
  }).catch(error => {
    if (signal.aborted) return;
    state = 'failed';
    report(error);
    message('Graphics could not recover. Reload to retry.', '图形恢复失败，请重新载入。');
    void close('failed');
  });
}

function reflow() {
  if (!mobile || state !== 'ready' || reflowQueued) return;
  if (fixedProfile(profileName,landscape()) === profile) { fitSurface(); return; }
  reflowQueued = true;
  ui.input.cancelAll('viewport');
  if (mixed) suspendMixedInput(); else ui.input.setInteractive(false);
  void enqueue(async () => {
    if (state !== 'ready') return;
    await changeOrientation();
    await draw();
    if (mixed && state === 'ready') restoreMixedInput();
  }).catch(error => {
    if (state === 'recovering' || signal.aborted) return;
    report(error);
    void close('failed');
  }).finally(() => { reflowQueued = false; reflow(); schedule(); });
}

async function open() {
  if (profile && !Object.hasOwn(workload.mutations,mode)) throw new Error('Choose static, sparse or full');
  setFrameSize();
  fitSurface();
  if (backend !== 'webgpu' && backend !== 'webgl2') throw new Error('Choose WebGPU or WebGL2');
  const hostModule = backend === 'webgpu'
    ? import('@egret/engine/webgpu').then(module => module.createSharedWebGPUHost)
    : import('@egret/engine/webgl2').then(module => module.createSharedWebGL2Host);
  const [config, authored, factory] = await Promise.all([
    fetchStudio(new URL('config.json', import.meta.url), signal).then(response => response.json()),
    fetchStudio(new URL(profile ? 'project-x.json' : 'project.json', import.meta.url), signal).then(response => response.text()),
    hostModule
  ]);
  project = openStudioProject(authored);
  selected = characters()[0].id;
  if (backgroundCanvas) {
    const {createMixedPreview} = await import('./mixed-preview.mjs');
    signal.throwIfAborted();
    mixed = createMixedPreview({canvas:backgroundCanvas,backend,signal,onLost:recoverMixed});
  }
  host = factory({canvas,pixelRatio:profile?.ratio ?? 1,outputAlpha:frame.outputAlpha,enableReadback:true,
    ...(profile ? {enableEffects:true} : {}),
    ...(mixed ? {onDiagnostic:mixed.onOverlayDiagnostic,...(backend === 'webgpu' ? {recovery:{mode:'manual'}} : {})} : {})});
  engine = await createEngineForProfile({host}, 'egret.shared-frame2d/1');
  signal.throwIfAborted();
  if (mixed) { await mixed.start(); setFrameSize(); }
  scope = engine.createScope();
  assets = createStudioAssets(engine,scope,signal,Boolean(profile));
  loads = [
    assets.fonts(config.fontConfig), assets.sequence(),
    Promise.all([...new Set(characters().map(row => row.palette))].map(async key => [key,await assets.spineGroup(key)])).then(rows => new Map(rows))
  ];
  const [initialFonts,sequence,spineGroups] = await Promise.all(loads);
  fonts = initialFonts;
  signal.throwIfAborted();
  cache = scope.use(createParagraphCache(engine.assets, {provider:fonts.paragraphProvider,maxImageBytes:8 * 1024 * 1024}));
  if (profile) { fixed = await createStudioWorkload(engine,scope); fixed.layout(profile); }
  cast = createStudioScene(engine,scope,characters(),spineGroups,sequence,profile);
  engine.advanceTime(0);
  if (profile) advance(workload.clockStep);
  await mountView();
  await draw(!mixed);
  signal.throwIfAborted();
  state = 'ready';
  if (mixed) restoreMixedInput();
  pause.disabled = false;
  download.disabled = false;
  openButton.disabled = false;
  performance.mark('egret-studio-interactive');
  message('Choose a character to begin', '请选择角色');
  if (mobile) {
    window.addEventListener('resize',reflow,{signal});
    window.visualViewport?.addEventListener('resize',reflow,{signal});
    screen.orientation?.addEventListener('change',reflow,{signal});
    reflow();
  }
  schedule();
  return inspect();
}

function close(finalState = 'closed') {
  if (closing) return closing;
  state = 'closing';
  playing = false;
  cancelAnimationFrame(raf);
  lifetime.abort();
  pause.disabled = true;
  download.disabled = true;
  openButton.disabled = true;
  closeButton.disabled = true;
  closing = (async () => {
    const failures = [];
    const attempt = async action => { try { await action(); } catch (error) { failures.push(String(error?.message ?? error)); } };
    // Cancel owned requests and UI before waiting for work already in progress.
    await attempt(() => upload?.dispose());
    await attempt(() => ui?.input.state === 'active' && ui.input.cancelAll('owner'));
    // Wake the recovery waiters before waiting on the application queue.
    if (mixed) {
      await attempt(() => mixed.close());
      await attempt(() => host?.stop());
    }
    await attempt(() => viewScope?.dispose());
    await attempt(() => scope?.dispose());
    await Promise.allSettled([ready,tail,...loads]);
    await attempt(() => assets?.close());
    await attempt(() => engine ? engine.dispose() : host?.close());
    cleanup = {scope:scope?.state,view:viewScope?.state,fonts:assets?.fontStatus(),cache:cache?.getStatus(),
      host:host?.getSessionStatus(),failures};
    retiredCast = cast?.inspect();
    retiredWorkload = fixed?.inspect();
    // Retain scalar receipts after Close and release the authored tree and resource owners.
    cast = fixed = view = ui = viewScope = scope = assets = fonts = cache = engine = host = undefined;
    loads = [];
    state = finalState;
    if (finalState === 'closed') message(failures.length ? 'Close reported an error' : 'Studio closed', failures.length ? '关闭时发生错误' : '场景已关闭');
    return inspect();
  })();
  return closing;
}

const ready = open();
void ready.catch(error => {
  if (!signal.aborted) {
    report(error);
    message('Studio could not start. Reload to retry.', '场景启动失败，请重新载入。');
    void close('failed');
  }
});

pause.addEventListener('click', () => {
  if (state !== 'ready' || pause.disabled) return;
  playing = !playing;
  lastFrame = undefined;
  pause.textContent = playing ? 'Pause preview / 暂停预览' : 'Resume preview / 继续预览';
  schedule();
});
canvas.addEventListener('wheel',event => {
  if (!view || state !== 'ready' || reflowQueued || ui.layer !== 'roster') return;
  const {x,y,width,height} = canvas.getBoundingClientRect();
  const logicalX = (event.clientX-x)*frame.width/width, logicalY = (event.clientY-y)*frame.height/height;
  const region = view.inspect().vault;
  if (logicalX < region.x || logicalX >= region.x+region.width || logicalY < region.y || logicalY >= region.y+region.height) return;
  event.preventDefault();
  const delta = event.deltaY*(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? region.height : 1);
  view.scrollBy(delta);
},{passive:false,signal});
download.addEventListener('click', () => {
  if (state !== 'ready' || download.disabled) return;
  const url = URL.createObjectURL(new Blob([project.serialize()], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'outfit-studio.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
openButton.addEventListener('click', () => {
  if (openButton.disabled) return;
  if (opening) opening.abort();
  else if (state === 'ready') projectFile.click();
});
projectFile.addEventListener('change', () => {
  const file = projectFile.files[0];
  // The same file may be chosen again after a failure.
  projectFile.value = '';
  if (!file || state !== 'ready' || reflowQueued || opening || openButton.disabled) return;
  const control = opening = new AbortController();
  openButton.textContent = 'Cancel opening / 取消打开';
  message('Opening project…', '正在打开工程…');
  void enqueue(() => openProject(file, control)).catch(report).finally(() => {
    if (opening !== control) return;
    opening = undefined;
    openButton.textContent = 'Open project / 打开工程';
    openButton.disabled = state !== 'ready' || reflowQueued;
  });
});
closeButton.addEventListener('click', () => { void close(); });
window.addEventListener('pagehide', () => { void close(); }, {once:true});

// Inspect the real example and read only selected points from its actual completed frame.
globalThis.__egretOutfitStudio = Object.freeze({ready,inspect,close,
  ...(timing ? {timings:timing.read} : {}),
  pixels(points) { return enqueue(async () => {
    const result = await draw(true);
    return points.map(([x,y]) => Array.from(result.bytes.subarray((y * result.width + x) * 4, (y * result.width + x) * 4 + 4)));
  }); }
});
