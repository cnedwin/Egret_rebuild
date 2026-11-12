// SPDX-License-Identifier: Apache-2.0
// Jelly Pandas: a fifteen-minute stand against a candy horde on a toy
// island, built on Egret's World3D. This file wires the pieces together:
// Engine clock and renderer, the simulation, the view, input, sound and the
// page around the canvas.
import { createEngine } from '@egret/engine';
import { Scene3D, createFollowCamera3D, createPerspectiveCamera3D } from '@egret/engine/world3d';
import { createAudio } from './audio.mjs';
import { createHud } from './hud.mjs';
import { createInput } from './input.mjs';
import { createIslandGeometry } from './island.mjs';
import { createGame } from './sim.mjs';
import { createView } from './view.mjs';

const params = new URLSearchParams(location.search);
const useWebGPU = params.get('backend') === 'webgpu';
const backend = await (useWebGPU ? import('@egret/engine/webgpu/world3d') : import('@egret/engine/webgl2/world3d'));
const { createWorld3DHost, createWorld3DView, startWorld3DLoop } = backend;

const canvas = document.querySelector('#stage');
const fail = (cause) => { const box = document.querySelector('#error'); box.textContent = 'Error / 出错了: ' + (cause?.message ?? cause); box.hidden = false; probe.error = String(cause?.stack ?? cause); };
const probe = { error: '', frames: 0 };

function loadSettings() {
  const defaults = { skin: 0, party: 1, muted: false, jelly: params.get('jelly') !== '0' };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('jelly-pandas') ?? '{}') }; } catch { return defaults; }
}
function saveSettings(settings) { try { localStorage.setItem('jelly-pandas', JSON.stringify(settings)); } catch { /* private windows may refuse storage */ } }

async function main() {
  const engine = await createEngine({ host: createWorld3DHost(canvas) });
  const scope = engine.createScope();
  const renderer = useWebGPU
    ? await backend.createWebGPURenderer3D({ canvas, antialias: true, toneMapping: 'aces', onDeviceLost: (message) => fail(message || 'device lost') })
    : backend.createWebGL2Renderer3D({ canvas, antialias: true, toneMapping: 'aces' });
  scope.use(renderer);
  if (params.get('post') !== '0') Object.assign(renderer.postProcess, { enabled: true, bloom: true, bloomThreshold: 1.3, bloomIntensity: 0.35, fxaa: true, saturation: 1.1, vignette: 0.15 });
  if (params.get('shadows') === '0') renderer.shadowsEnabled = false;

  const scene = new Scene3D();
  const camera = createPerspectiveCamera3D({ fov: 55, near: 0.3, far: 400 });
  scene.addChild(camera);
  const settings = loadSettings();
  const view = createView(scene, { jelly: settings.jelly, shadowSize: Number(params.get('shadowSize')) || 2048, reflect: params.get('reflect') !== '0' });
  const islandGeometry = createIslandGeometry();
  view.attachIsland(islandGeometry);

  const input = createInput(canvas), audio = createAudio(), hud = createHud(document.querySelector('#ui'), { lang: params.get('lang') ?? undefined });
  audio.setMuted(settings.muted);
  const target = [0, 1, 0], follow = createFollowCamera3D(camera, target, { distance: 12, minDistance: 5, maxDistance: 22, height: 1.3, pitch: 0.5, minPitch: 0.08, maxPitch: 1.35 });
  const moveScratch = [0, 0, 0], simInput = { moveX: 0, moveZ: 0, jump: false, slam: false, roll: false }, screenScratch = [0, 0, 0];

  let mode = 'title', game, human, cardsShown = false, endAt = 0, now = 0;
  const newGame = (party, seed) => {
    game = createGame({ party, seed, islandGeometry });
    human = game.pandas.find((panda) => panda.human) ?? game.pandas[0];
    view.jelly = settings.jelly;
    view.attach(game);
    target[0] = human.x; target[1] = human.y; target[2] = human.z;
    probe.game = game;
  };
  /** A still scene behind the title: the chosen panda and its friends on the island. */
  const preview = () => {
    newGame(Array.from({ length: settings.party }, (_, index) => ({ skin: (settings.skin + index) % 8, human: index === 0 })), 1);
    follow.distance = 7.5; follow.pitch = 0.32;
  };
  const showTitle = () => {
    mode = 'title'; input.release(); cardsShown = false;
    preview();
    hud.showTitle(settings, { onPlay: start, onChange: () => { saveSettings(settings); audio.setMuted(settings.muted); audio.unlock(); audio.play('click'); preview(); } });
  };
  function start() {
    audio.unlock(); audio.play('levelup');
    const others = [0, 1, 2, 3, 4, 5, 6, 7].filter((index) => index !== settings.skin).sort(() => Math.random() - 0.5);
    newGame(Array.from({ length: settings.party }, (_, index) => ({ skin: index === 0 ? settings.skin : others[index - 1], human: index === 0 })), Number(params.get('seed')) || (Date.now() & 0xffffff));
    mode = 'play'; cardsShown = false; endAt = 0;
    follow.distance = 12; follow.pitch = 0.5;
    hud.startPlay();
    canvas.focus();
    canvas.requestPointerLock?.()?.catch?.(() => {});
  }
  const closeCards = () => { cardsShown = false; hud.hideCards(); canvas.requestPointerLock?.()?.catch?.(() => {}); };
  const openCards = () => {
    cardsShown = true; input.release();
    hud.showCards(human, {
      onPick: (index) => { if (game.choose(human.index, index)) { audio.play('click'); if (game.waitingForChoice()) openCards(); else closeCards(); } },
      onReroll: () => { if (game.reroll(human.index)) { audio.play('click'); openCards(); } },
    });
  };
  const setPaused = (on) => {
    if (mode !== 'play' && mode !== 'paused') return;
    mode = on ? 'paused' : 'play';
    if (on) input.release(); else canvas.requestPointerLock?.()?.catch?.(() => {});
    hud.showMenu(on, { onResume: () => setPaused(false), onRestart: () => { hud.showMenu(false); start(); }, onQuit: () => { hud.showMenu(false); showTitle(); } });
  };
  input.onCommand = (command) => {
    audio.unlock();
    if (command === 'menu') { if (!cardsShown) setPaused(mode === 'play'); return; }
    if (mode !== 'play' || !cardsShown) return;
    if (command === 'reroll') { if (game.reroll(human.index)) openCards(); return; }
    const index = Number(command.slice(4)) - 1;
    if (game.choose(human.index, index)) { audio.play('click'); if (game.waitingForChoice()) openCards(); else closeCards(); }
  };
  // Leaving pointer capture mid-run (Esc) opens the menu.
  document.addEventListener('pointerlockchange', () => { if (!input.captured && mode === 'play' && !cardsShown && game?.state === 'play' && game.t > 0.5 && document.hasFocus() && probe.autoPause !== false) setPaused(true); });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  /** Page position of a world point, or undefined when it is behind the camera or off screen. */
  const project = (x, y, z) => {
    const m = camera.matrixWorld, dx = x - m[12], dy = y - m[13], dz = z - m[14];
    if (dx * -m[8] + dy * -m[9] + dz * -m[10] <= 0.3) return undefined;
    screenScratch[0] = x; screenScratch[1] = y; screenScratch[2] = z;
    const ndc = camera.worldToScreenPoint(screenScratch, screenScratch);
    if (Math.abs(ndc[0]) > 1.05 || Math.abs(ndc[1]) > 1.05) return undefined;
    return [(ndc[0] + 1) / 2 * canvas.clientWidth, (1 - ndc[1]) / 2 * canvas.clientHeight];
  };

  const worldView = createWorld3DView(engine, scope, {
    renderer, scene, camera, maxPixelRatio: Number(params.get('ratio')) || 1.5,
    onUpdate(deltaSeconds) {
      const dt = Math.min(deltaSeconds, 1 / 20);
      now += dt; probe.frames++;
      // Automated checks may run extra simulation steps per frame to reach later parts of a run.
      for (let extra = (probe.speed ?? 1) - 1; extra > 0 && mode === 'play' && game.state === 'play' && !game.waitingForChoice(); extra--) { game.update(1 / 30, probe.autoInput ?? simInput); if (probe.fastForward) game.events.length = 0; }
      const pad = input.poll();
      follow.yaw -= pad.lookX * 0.0032; follow.pitch += pad.lookY * 0.0026; follow.distance += pad.zoom * 1.2;
      if (mode === 'title') follow.yaw += dt * 0.2;
      else if (mode === 'play') {
        if (game.state === 'play' && game.waitingForChoice()) { if (!cardsShown) openCards(); }
        else if (game.state === 'play') {
          const wish = follow.moveDirection(pad.forward, pad.right, moveScratch);
          simInput.moveX = wish[0]; simInput.moveZ = wish[2]; simInput.jump = pad.jump; simInput.slam = pad.slam; simInput.roll = pad.roll;
          game.update(dt, simInput);
        }
        if (game.state !== 'play' && !endAt) { endAt = now + 1.6; audio.play(game.state === 'won' ? 'won' : 'lost'); }
        if (endAt && now >= endAt && mode === 'play') {
          mode = 'over'; input.release(); cardsShown = false;
          hud.showEnd(game, { onRestart: start, onQuit: showTitle });
        }
      }
      const events = game.events;
      if (events.length) {
        view.consume(events);
        if (mode !== 'title') { hud.consume(events, game, project, now); for (const event of events) audio.play(event.type, event); }
        events.length = 0;
      }
      view.update(mode === 'paused' ? 0 : dt, game, camera);
      // Follow the player, or a standing friend while the player is down.
      const watched = human.down ? game.pandas.find((panda) => !panda.down) ?? human : human;
      const ease = Math.min(1, dt * 12);
      // On the title the panda stands left of centre, clear of the panel.
      const aside = mode === 'title' ? 2.3 : 0, goalX = watched.x + Math.cos(follow.yaw) * aside, goalZ = watched.z - Math.sin(follow.yaw) * aside;
      target[0] += (goalX - target[0]) * ease; target[2] += (goalZ - target[2]) * ease; target[1] += (watched.y - target[1]) * Math.min(1, dt * 5);
      follow.update(dt);
      if (view.shake > 0) { const p = camera.position, k = view.shake * view.shake * 0.35; camera.setPosition(p[0] + (Math.random() - 0.5) * k, p[1] + (Math.random() - 0.5) * k, p[2] + (Math.random() - 0.5) * k); }
      camera.updateWorldMatrix(); camera.updateViewMatrices();
      view.renderReflection(renderer, camera);
      if (mode !== 'title') hud.update(game, project, now, input.captured);
    },
    onError: fail,
  });
  showTitle();
  const loop = startWorld3DLoop(engine, fail);

  // Read-only probe for automated checks of this example.
  Object.defineProperties(probe, Object.getOwnPropertyDescriptors({
    backend: useWebGPU ? 'webgpu' : 'webgl2', renderer,
    get mode() { return mode; },
    get info() { return { ...renderer.info }; },
    start, showTitle, settings,
    choose: (index) => input.onCommand('pick' + (index + 1)),
    async dispose() { loop.dispose(); worldView.dispose(); input.dispose(); await engine.dispose(); },
  }));
}

globalThis.__jellyPandas = probe;
main().catch(fail);
