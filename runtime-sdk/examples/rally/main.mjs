// SPDX-License-Identifier: Apache-2.0
import { installWorld3DPlayerProject } from '@egret/android-player-world3d';
import { Scene3D, createPerspectiveCamera3D } from '@egret/engine/world3d';
import { createTrack } from './original/track.mjs';
import { createRace, idleControls } from './original/sim.mjs';
import { RACERS } from './original/data.mjs';
import { makeChase } from './original/camera.mjs';
import { createRollHud } from './hud.mjs';
import { createGrid, loadPanda, makePaint } from './cars.mjs';
import { createCourse } from './circuit.mjs';

const WIDTH = 873,
  HEIGHT = 325,
  SEED = 7;
// Rally separately randomizes its starting grid. This is the grid read from
// the pinned browser's comparison lap; the original seeded race runs onward.
const GRID = [3, 0, 6, 4, 5, 2, 7, 1];
const positions = {
  start: [436, 202],
  pause: [814, 33],
  left: [50, 282],
  right: [136, 282],
  brake: [636, 282],
  drift: [728, 282],
  item: [817, 282]
};
const keys = ['left', 'right', 'brake', 'drift', 'item'];
const names = { left: 'LEFT', right: 'RIGHT', brake: 'BRAKE', drift: 'DRIFT', item: 'ITEM' };
function target(x, y, mode) {
  const available = mode === 'ready' || mode === 'results' || mode === 'paused' ? ['start'] : ['pause', ...keys];
  return available.find((name) => {
    const [cx, cy] = positions[name];
    return Math.abs(cx - x) < (name === 'start' ? 97 : 39) && Math.abs(cy - y) < (name === 'start' ? 24 : 20);
  });
}

installWorld3DPlayerProject({
  width: WIDTH,
  height: HEIGHT,
  async create(services) {
    const { scope, engine } = services;
    const panda = await loadPanda(services),
      track = createTrack();
    const scene = new Scene3D(),
      camera = createPerspectiveCamera3D({ fov: 60, near: 0.3, far: 1600 });
    scene.addChild(camera);
    const paint = makePaint(scope),
      course = createCourse(scene, track, paint, scope),
      hud = createRollHud(services);
    const contacts = new Map();
    let mode = 'ready',
      previousMode = 'race',
      race,
      grid,
      chase,
      lapLabel,
      placeLabel,
      speedLabel,
      inventory,
      countLabel,
      coinLabel,
      timeLabel;
    let elapsed = 0,
      frames = 0,
      round = 0,
      introTime = 0,
      resultsAt = 0,
      listed = -1,
      simulated = 0,
      lastReport = -Infinity,
      touchDriving = false,
      suspended = false;
    engine.clock.onTick(scope, (tick) => {
      elapsed += tick.deltaSeconds;
    });

    function show() {
      hud.reset();
      function button(id, word, width, height) {
        const [x, y] = positions[id];
        return hud.button(word, { x, y, width, height, size: id === 'start' ? 19 : 14, color: 0x24474d }, () => {});
      }
      if (mode === 'ready' || mode === 'paused' || mode === 'results') {
        hud.text(
          mode === 'results' ? 'FINISH  ' + race.human.place + ' / 8' : mode === 'paused' ? 'PAUSED' : 'JINXIU RALLY',
          { x: 436, y: 27, size: 29, color: 0xffffff, align: 'center' }
        );
        if (mode === 'results') {
          listed = race.finishedCount;
          race.results().forEach((row, i) => {
            const x = i < 4 ? 182 : 481,
              y = 82 + (i % 4) * 20;
            hud.text(i + 1 + '. ' + RACERS[row.kart.racer].id, { x, y, size: 16, color: 0xffe5ab });
            const elapsed =
              row.time === undefined
                ? '—'
                : Math.floor(row.time / 60) +
                  ':' +
                  String(Math.floor(row.time) % 60).padStart(2, '0') +
                  '.' +
                  String(Math.floor(row.time * 1000) % 1000).padStart(3, '0');
            // Reuse one raster page per character across finish times and successive rounds.
            for (const [index, char] of [...elapsed].entries())
              hud.text(char, { x: x + 105 + index * 11, y, size: 15, color: 0xffffff });
          });
        } else if (mode === 'ready') {
          hud.text('Tuan the Panda  /  Stroll  /  1 lap', {
            x: 436,
            y: 74,
            size: 19,
            color: 0xffe5ab,
            align: 'center'
          });
        }
        button('start', mode === 'ready' ? 'START' : mode === 'paused' ? 'RESUME' : 'RACE AGAIN', 194, 48);
      } else {
        lapLabel = hud.text('LAP 1/1', { x: 15, y: 10, size: 19, color: 0xffe5ab, bold: true });
        placeLabel = hud.text('8 / 8', { x: 15, y: 34, size: 20, color: 0xffffff, bold: true });
        coinLabel = hud.text('COINS 0', { x: 125, y: 12, size: 15, color: 0xffda7b });
        // Fixed digit slots avoid creating a new texture for every clock value.
        timeLabel = [0, 1, 2, 3, 4].map((_, i) => hud.text('', { x: 671 + i * 11, y: 12, size: 16, color: 0xffffff }));
        speedLabel = hud.text('0 km/h', { x: WIDTH / 2, y: 16, size: 16, color: 0xffffff, align: 'center' });
        inventory = hud.text('', { x: WIDTH / 2, y: 39, size: 14, color: 0xffe5ab, align: 'center' });
        countLabel = hud.text('', { x: WIDTH / 2, y: 85, size: 34, color: 0xffdc76, align: 'center', bold: true });
        button('pause', 'PAUSE', 78, 38);
        for (const key of keys) button(key, names[key], 78, 39);
      }
    }
    function reset() {
      grid?.remove();
      race = createRace({
        track,
        klass: 0,
        laps: 1,
        seed: SEED,
        entries: GRID.map((racer, i) => ({ racer, human: i === 7 }))
      });
      grid = createGrid(scene, race, paint, panda);
      chase = makeChase(camera, track);
      introTime = 0;
      resultsAt = 0;
      simulated = 0;
      round++;
      course.update(race);
      grid.update(0);
      chase(race.human, 1);
    }
    function change(next) {
      mode = next;
      contacts.clear();
      show();
    }
    reset();
    show();
    await hud.ready();

    function signal(now) {
      if (now - lastReport < 100) return;
      lastReport = now;
      const k = race.human;
      services.state({
        mode,
        frames,
        round,
        grid: GRID,
        controls: positions,
        touchDriving,
        stage: [WIDTH, HEIGHT],
        race: {
          state: race.state,
          time: race.time,
          lapLength: track.length,
          seed: SEED,
          laps: race.laps,
          finishedCount: race.finishedCount
        },
        car: {
          index: k.index,
          racer: k.racer,
          x: k.x,
          y: k.y,
          z: k.z,
          s: k.s,
          station: k.station,
          heading: k.heading,
          speed: k.speed,
          lateral: k.lateral,
          total: k.total,
          lap: k.lap,
          place: k.place,
          coins: k.coins,
          finished: k.finished,
          finishTime: k.finishTime,
          item: k.item ?? null,
          drifting: k.drifting,
          grass: k.grass,
          vx: k.vx,
          vz: k.vz
        },
        models: {
          loaded: ['panda-kart.glb', 'panda-driver.glb'],
          bodyMeshes: panda.body.parts.length,
          driverMeshes: panda.driver.parts.length
        },
        results:
          mode === 'results'
            ? race.results().map((row) => ({ racer: row.kart.racer, place: row.place, time: row.time ?? null }))
            : null
      });
    }
    function drive(dt) {
      const holds = new Set(contacts.values()),
        c = idleControls();
      c.brake = holds.has('brake') ? 1 : 0;
      c.throttle = touchDriving && !c.brake ? 1 : 0;
      c.steer = Number(holds.has('right')) - Number(holds.has('left'));
      c.drift = holds.has('drift');
      c.item = holds.has('item');
      if (race.state === 'countdown' && race.countdown > 0.15) c.throttle = 0;
      simulated += dt;
      race.update(dt, c);
      race.events.length = 0;
      if (mode === 'intro' && (introTime += dt) >= 3.2) {
        race.startCountdown();
        mode = 'race';
      }
      if (mode === 'race' && race.human.finished) {
        if (!resultsAt) resultsAt = simulated + 2.6;
        if (simulated >= resultsAt) change('results');
      }
      course.update(race);
      grid.update(dt);
      chase(race.human, dt);
      if (mode === 'results') {
        if (race.finishedCount !== listed) show();
        return;
      }
      const k = race.human;
      lapLabel.text = 'LAP 1/1';
      coinLabel.text = 'COINS ' + k.coins;
      const seconds = Math.floor(race.time);
      const clock =
        String(Math.floor(seconds / 60) % 100).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
      for (let i = 0; i < clock.length; i++) timeLabel[i].text = clock[i];
      placeLabel.text = k.place + ' / 8';
      speedLabel.text = Math.max(0, Math.round((Math.abs(k.speed) * 3.6) / 10) * 10) + ' km/h';
      inventory.text = (k.item ?? '') || '';
      countLabel.text =
        mode === 'intro'
          ? 'GET READY'
          : race.state === 'countdown'
            ? String(Math.ceil(race.countdown))
            : k.finished
              ? 'FINISH'
              : '';
    }
    return {
      world3D() {
        return { scene, camera };
      },
      update(now) {
        hud.check();
        const dt = Math.min(elapsed, 0.05);
        elapsed = 0;
        if (
          !suspended &&
          (mode === 'intro' || mode === 'race' || (mode === 'results' && race.state !== 'done')) &&
          dt > 0
        )
          drive(dt);
        frames++;
        signal(now);
      },
      input(e) {
        if (suspended) return;
        if (e.type === 'down' && !contacts.has(e.id)) {
          const id = target(e.x, e.y, mode);
          if (id) {
            contacts.set(e.id, id);
            // Like the browser, only the first driving contact enables automatic acceleration.
            if (keys.includes(id)) touchDriving = true;
          }
        }
        if (e.type === 'cancel') {
          contacts.delete(e.id);
          return;
        }
        if (e.type === 'up') {
          const id = contacts.get(e.id);
          contacts.delete(e.id);
          if (id !== target(e.x, e.y, mode)) return;
          if (id === 'start') {
            if (mode === 'paused') change(previousMode);
            else {
              if (mode === 'results') reset();
              change('intro');
            }
          } else if (id === 'pause' && (mode === 'race' || mode === 'intro')) {
            previousMode = mode;
            change('paused');
          }
        }
      },
      pause() {
        suspended = true;
        contacts.clear();
        elapsed = 0;
      },
      resume() {
        suspended = false;
        elapsed = 0;
      },
      close() {
        contacts.clear();
        grid.remove();
        scene.removeChildren();
        hud.clear();
      }
    };
  }
});
