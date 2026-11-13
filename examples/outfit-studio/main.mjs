// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile} from '@egret/engine';
import {createParagraphCache} from '@egret/engine/paragraph';
import {createStudioAssets, fetchStudio} from './assets.mjs';
import {openStudioProject, outfits} from './project.mjs';
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
const closeButton = document.querySelector('#close');
const params = new URL(location.href).searchParams;
const backend = params.get('backend') ?? 'webgpu';
const profileName = params.get('profile');
const mode = params.get('load') ?? 'sparse';
const mobile = profileName === 'x-mtouch';
const viewport = document.querySelector('.viewport');
const landscape = () => screen.orientation?.type?.startsWith('landscape') ?? matchMedia('(orientation:landscape)').matches;
let profile = fixedProfile(profileName,landscape()), frame = frameOptions;
const timing = profile && params.get('trace') === '1' ? createStudioTiming(mode) : undefined;
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

const message = (en, zh) => { status.textContent = `${en} / ${zh}`; };
function report(error) {
  if (signal.aborted) return;
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
    cast:cast?.inspect() ?? retiredCast,ui:state === 'ready' ? ui.inspect() : undefined,replacement,nameRefusal,cleanup,errors:[...errors],
    interactive:performance.getEntriesByName('egret-studio-interactive')[0]?.startTime};
}

async function draw(readback = false, sample) {
  const uiStart = sample && performance.now();
  const vaultChanged = await view?.publish();
  const uiChanged = await ui.publish();
  signal.throwIfAborted();
  if (fixed && (uiChanged || vaultChanged || frames === 0)) fixed.sync(cast.root);
  if (view) { cast.applyView(touch.camera,selected,touch.holds); view.drawControls(); }
  const action = touch.lastAction;
  const captureStart = sample && performance.now();
  const reading = readback ? host.requestReadback() : undefined;
  void reading?.catch(() => {});
  const captured = engine.captureSharedFrame(frame);
  const hostStart = sample && performance.now();
  host.renderSharedFrame(captured);
  const submittedAt = sample && performance.now();
  const pixels = await reading;
  await host.whenIdle();
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
    if (!playing) return;
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
  }).then(schedule, error => { if (!signal.aborted) { playing = false; report(error); } });
}

function schedule() {
  if (state === 'ready' && playing && !raf) raf = requestAnimationFrame(animate);
}

function requestDraw() {
  if (state !== 'ready' || playing) return;
  paintDirty = true;
  if (paintQueued) return;
  paintQueued = true;
  void enqueue(async () => { paintDirty = false; await draw(); }).catch(report).finally(() => {
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
  try {
    // Admit the authored edit privately before publishing the live candidate.
    const nextProject = openStudioProject(project.serialize());
    nextProject.edit(character.id, {palette});
    const {loader} = await assets.library(palette);
    signal.throwIfAborted();
    ticket = cast.requestPalette(character, palette, loader);
    await ticket.ready;
    signal.throwIfAborted();

    // This queue owns the final capture window. The previous frame stays visible through loading and staging.
    upload = host.stageSharedFrame(ticket.capture(frame));
    const staged = await upload.ready;
    signal.throwIfAborted();
    const session = host.getSessionStatus();
    if (session.state !== 'ready' || session.generation !== staged.generation) throw new Error('Studio palette generation expired');
    try { ticket.commit(); }
    finally {
      if (ticket.state === 'committed') {
        committed = true;
        project = nextProject;
        cast.retireBorrowed(character.id);
      }
    }
    await upload.submit().completed;
    await host.whenIdle();
    replacement = {...replacement,phase:'ready'};
    message('Palette applied', '已应用配色');
  } catch (error) {
    replacement = {...replacement,phase:committed ? 'presentation-failed' : 'failed',reason:String(error?.code ?? error?.message ?? error)};
    if (!signal.aborted) {
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

async function act(key) {
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
        await ui.prepareName(name);
        signal.throwIfAborted();
        project.edit(draftId, {name});
      } catch (error) {
        if (signal.aborted) throw error;
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
  if (state !== 'ready' || reflowQueued || pendingActions >= 8 || (key === 'palette' && palettePending)) return;
  const source = ui, sourceLayer = source.layer;
  pendingActions++;
  if (key === 'palette') palettePending = true;
  // Apply queued input only while its originating layer still owns the action.
  void enqueue(() => { if (ui === source && !reflowQueued && source.layer === sourceLayer) return act(key); }).catch(report).finally(() => {
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
}

async function mountView() {
  signal.throwIfAborted();
  viewScope = engine.createScope();
  ui = await createStudioUi({engine,scope:viewScope,canvas,cache,fonts:fonts.set,initial:{characters:characters(),selected},
    onAction,onError:report,requestDraw,signal,profile});
  view = profile ? createStudioReferenceView({engine,scope:viewScope,input:ui.input,profile,state:touch,selection,onAction,invalidate:requestDraw}) : undefined;
  layoutRevision++;
}

function reflow() {
  if (!mobile || state !== 'ready' || reflowQueued) return;
  if (fixedProfile(profileName,landscape()) === profile) { fitSurface(); return; }
  reflowQueued = true;
  ui.input.cancelAll('viewport');
  ui.input.setInteractive(false);
  void enqueue(async () => {
    // Geometry ownership changes as one session. The authored project and shared assets stay live.
    if (ui.layer === 'rename') ui.cancelRename();
    draftId = undefined;
    const previous = viewScope;
    previous.dispose();
    ui = view = undefined;
    profile = fixedProfile(profileName,landscape());
    frame = {...frameOptions,width:profile.width,height:profile.height};
    fitSurface();
    fixed.layout(profile);
    cast.layout(profile);
    await mountView();
    await draw();
  }).catch(error => { report(error); if (!signal.aborted) void close('failed'); })
    .finally(() => { reflowQueued = false; reflow(); });
}

async function open() {
  if (profile && !Object.hasOwn(workload.mutations,mode)) throw new Error('Choose static, sparse or full');
  if (profile) frame = {...frameOptions,width:profile.width,height:profile.height};
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
  host = factory({canvas,pixelRatio:profile?.ratio ?? 1,outputAlpha:'opaque',enableReadback:true,...(profile ? {enableEffects:true} : {})});
  engine = await createEngineForProfile({host}, 'egret.shared-frame2d/1');
  signal.throwIfAborted();
  scope = engine.createScope();
  assets = createStudioAssets(engine,scope,signal,Boolean(profile));
  loads = [
    assets.fonts(config.fontConfig), assets.sequence(),
    Promise.all([...new Set(characters().map(row => row.palette))].map(async key => [key,await assets.spine(key)])).then(rows => new Map(rows))
  ];
  const [initialFonts,sequence,spineAssets] = await Promise.all(loads);
  fonts = initialFonts;
  signal.throwIfAborted();
  cache = scope.use(createParagraphCache(engine.assets, {provider:fonts.paragraphProvider,maxImageBytes:8 * 1024 * 1024}));
  if (profile) { fixed = await createStudioWorkload(engine,scope); fixed.layout(profile); }
  cast = createStudioScene(engine,scope,characters(),spineAssets,sequence,profile);
  engine.advanceTime(0);
  if (profile) advance(workload.clockStep);
  await mountView();
  await draw(true);
  signal.throwIfAborted();
  state = 'ready';
  pause.disabled = false;
  download.disabled = false;
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
  closeButton.disabled = true;
  closing = (async () => {
    const failures = [];
    const attempt = async action => { try { await action(); } catch (error) { failures.push(String(error?.message ?? error)); } };
    // Cancel owned requests and UI before waiting for work already in progress.
    await attempt(() => upload?.dispose());
    await attempt(() => ui?.input.state === 'active' && ui.input.cancelAll('owner'));
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
  playing = !playing;
  lastFrame = undefined;
  pause.textContent = playing ? 'Pause preview / 暂停预览' : 'Resume preview / 继续预览';
  schedule();
});
canvas.addEventListener('wheel',event => {
  if (!view || state !== 'ready' || ui.layer !== 'roster') return;
  const {x,y,width,height} = canvas.getBoundingClientRect();
  const logicalX = (event.clientX-x)*frame.width/width, logicalY = (event.clientY-y)*frame.height/height;
  const region = view.inspect().vault;
  if (logicalX < region.x || logicalX >= region.x+region.width || logicalY < region.y || logicalY >= region.y+region.height) return;
  event.preventDefault();
  const delta = event.deltaY*(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? region.height : 1);
  view.scrollBy(delta);
},{passive:false,signal});
download.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([project.serialize()], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'outfit-studio.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
