// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile} from '@egret/engine';
import {createParagraphCache} from '@egret/engine/paragraph';
import {createStudioAssets, fetchStudio} from './assets.mjs';
import {openStudioProject, outfits} from './project.mjs';
import {createStudioScene, frameOptions} from './scene.mjs';
import {createStudioUi} from './ui.mjs';

const canvas = document.querySelector('canvas');
const status = document.querySelector('#status');
const pause = document.querySelector('#pause');
const download = document.querySelector('#download');
const closeButton = document.querySelector('#close');
const backend = new URL(location.href).searchParams.get('backend') ?? 'webgpu';
const lifetime = new AbortController();
const {signal} = lifetime;
const errors = [];
let host, engine, scope, assets, cache, cast, ui, project, selected, draftId, upload, cleanup;
let state = 'loading', elapsed = 0, playing = true, raf = 0, lastFrame;
let pendingActions = 0, palettePending = false, paintQueued = false;
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

function inspect() {
  return {state,backend,playing,selected,revision:project?.revision,characters:project?.characters(),
    cast:cast?.inspect(),ui:state === 'ready' ? ui.inspect() : undefined,replacement,nameRefusal,cleanup,errors:[...errors],
    interactive:performance.getEntriesByName('egret-studio-interactive')[0]?.startTime};
}

async function draw(readback = false) {
  await ui.publish();
  signal.throwIfAborted();
  const reading = readback ? host.requestReadback() : undefined;
  void reading?.catch(() => {});
  host.renderSceneSharedFrame(cast.scene, engine.captureSharedFrame(frameOptions));
  const pixels = await reading;
  await host.whenIdle();
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
    const delta = lastFrame === undefined ? 0 : Math.min(.05, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time;
    if (delta) advance(delta);
    await draw();
  }).then(schedule, error => { if (!signal.aborted) { playing = false; report(error); } });
}

function schedule() {
  if (state === 'ready' && playing && !raf) raf = requestAnimationFrame(animate);
}

function requestDraw() {
  if (state !== 'ready' || playing || paintQueued) return;
  paintQueued = true;
  void enqueue(() => draw()).catch(report).finally(() => { paintQueued = false; });
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
    upload = host.stageSceneSharedFrame(cast.scene, ticket.capture(frameOptions));
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
    if (key === 'hero-0' || key === 'hero-1') {
      selected = project.characters()[Number(key.at(-1))].id;
      message(project.character(selected).name, '已选择角色');
    } else if (key === 'skin') {
      const outfit = outfits[(outfits.indexOf(current.outfit) + 1) % outfits.length];
      project.edit(selected, {outfit});
      cast.setOutfit(selected, outfit);
      advance(1 / 120);
      message('Outfit applied', '已应用装扮');
    } else if (key === 'palette') await replacePalette(current);
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
  ui.update(project.characters(), selected);
  await draw();
}

function onAction(key) {
  if (state !== 'ready' || pendingActions >= 8 || (key === 'palette' && palettePending)) return;
  const sourceLayer = ui.layer;
  pendingActions++;
  if (key === 'palette') palettePending = true;
  // Apply queued input only while its originating layer still owns the action.
  void enqueue(() => { if (ui.layer === sourceLayer) return act(key); }).catch(report).finally(() => {
    pendingActions--;
    if (key === 'palette') palettePending = false;
  });
}

async function open() {
  if (backend !== 'webgpu' && backend !== 'webgl2') throw new Error('Choose WebGPU or WebGL2');
  const hostModule = backend === 'webgpu'
    ? import('@egret/engine/webgpu/scene3d').then(module => module.createSharedSceneWebGPUHost)
    : import('@egret/engine/webgl2/scene3d').then(module => module.createSharedSceneWebGL2Host);
  const [config, authored, factory] = await Promise.all([
    fetchStudio(new URL('config.json', import.meta.url), signal).then(response => response.json()),
    fetchStudio(new URL('project.json', import.meta.url), signal).then(response => response.text()),
    hostModule
  ]);
  project = openStudioProject(authored);
  const characters = project.characters();
  selected = characters[0].id;
  host = factory({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true});
  engine = await createEngineForProfile({host}, 'egret.shared-frame2d/1');
  signal.throwIfAborted();
  scope = engine.createScope();
  assets = createStudioAssets(engine, scope, signal);
  loads = [
    assets.fonts(config.fontConfig), assets.sequence(),
    Promise.all([...new Set(characters.map(row => row.palette))].map(async key => [key,await assets.spine(key)])).then(rows => new Map(rows))
  ];
  const [fonts, sequence, spineAssets] = await Promise.all(loads);
  signal.throwIfAborted();
  cache = scope.use(createParagraphCache(engine.assets, {provider:fonts.paragraphProvider,maxImageBytes:8 * 1024 * 1024}));
  cast = createStudioScene(engine, scope, characters, spineAssets, sequence);
  engine.advanceTime(0);
  ui = await createStudioUi({engine,scope,canvas,cache,fonts:fonts.set,initial:{characters,selected},onAction,onError:report,requestDraw,signal});
  await draw(true);
  signal.throwIfAborted();
  state = 'ready';
  pause.disabled = false;
  download.disabled = false;
  performance.mark('egret-studio-interactive');
  message('Choose a character to begin', '请选择角色');
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
    await attempt(() => scope?.dispose());
    await Promise.allSettled([ready,tail,...loads]);
    await attempt(() => assets?.close());
    await attempt(() => engine ? engine.dispose() : host?.close());
    cleanup = {scope:scope?.state,fonts:assets?.fontStatus(),cache:cache?.getStatus(),host:host?.getSessionStatus(),failures};
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
  pixels(points) { return enqueue(async () => {
    const result = await draw(true);
    return points.map(([x,y]) => Array.from(result.bytes.subarray((y * result.width + x) * 4, (y * result.width + x) * 4 + 4)));
  }); }
});
