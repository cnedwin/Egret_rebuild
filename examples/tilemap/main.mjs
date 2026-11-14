// SPDX-License-Identifier: Apache-2.0
// A map made in Tiled, read from its JSON and drawn in chunks of meshes, seen through the 2D camera.
// The images of the two tilesets are painted by the page, so the repository carries no picture.
import { createAssetRef, createAssetType, createEngineForProfile, createImageData2D, createTexture, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createCamera2D } from '@egret/engine/camera';
import { createTileMap, importTiledMap } from '@egret/engine/tilemap';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270, SPEED = 120;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
let failure;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };

const map = importTiledMap(await (await fetch('./courtyard.tmj')).json());
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: map.backgroundColor ?? 0, clearAlpha: 1 });

// The colours of the terrain tiles, in the order of their ids.
const TERRAIN = ['#5f8f4e', '#6a9a56', '#578746', '#6f9f5c', '#c8b07a', '#bda46c', '#3f74a8', '#36689a', '#7b2d26', '#9a3c32', '#b9a37a', '#2b2b2b', '#e46b8a', '#9a9a9a', '#8a5a36', '#4d3a2e'];
function paint(width, height, draw) {
  const surface = document.createElement('canvas');
  surface.width = width; surface.height = height;
  const context = surface.getContext('2d', { willReadFrequently: true });
  draw(context);
  return createTexture(createImageData2D({ width, height, pixels: new Uint8Array(context.getImageData(0, 0, width, height).data) }));
}
const images = {
  terrain: paint(128, 64, context => {
    TERRAIN.forEach((colour, id) => {
      const x = (id % 8) * 16, y = Math.floor(id / 8) * 16;
      context.fillStyle = colour; context.fillRect(x, y, 16, 16);
      // A mark in one corner, so that a tile turned by its flags can be told from one that is not.
      context.fillStyle = 'rgba(255,255,255,0.35)'; context.fillRect(x + 1, y + 1, 4, 4);
    });
  }),
  trees: paint(32, 32, context => {
    for (const [x, leaf] of [[0, '#2f6b3a'], [16, '#3d7d2c']]) {
      context.fillStyle = '#5a3a22'; context.fillRect(x + 6, 20, 4, 12);
      context.fillStyle = leaf; context.fillRect(x + 1, 2, 14, 20);
    }
  }),
};
const leases = {};
for (const [name, texture] of Object.entries(images)) {
  const type = createAssetType('example-tileset-' + name, value => value === texture);
  engine.assets.register(type, { load: async () => texture, dispose: () => texture.dispose() });
  leases[name] = scope.use(await engine.assets.acquire(createAssetRef(type, name)));
}

const world = engine.stage.addChild(scope.use(new Sprite()));
const tiles = scope.use(createTileMap({ map, textures: leases, chunkSize: 16 }));
world.addChild(tiles.display);
// The disciple stands where the map's spawn point is, between the details and the trees.
const spawn = map.layers.find(layer => layer.type === 'object').objects.find(object => object.type === 'spawn');
const hero = scope.use(new Sprite());
hero.graphics.beginFill(0xf2f2f2).drawRect(-6, -10, 12, 14).endFill();
hero.graphics.beginFill(0x1f3a93).drawRect(-4, -8, 8, 8).endFill();
hero.x = spawn.x; hero.y = spawn.y;
tiles.display.addChildAt(hero, tiles.display.getChildIndex(tiles.layer('above/trees').display));
const bounds = { x: 0, y: 0, width: map.width * map.tileWidth, height: map.height * map.tileHeight };
const camera = scope.use(createCamera2D({ world, width: WIDTH, height: HEIGHT, center: { x: hero.x, y: hero.y }, bounds, zoom: 2, minZoom: 0.5, maxZoom: 4, roundToPixel: true }));
camera.follow(hero, { smoothing: 0.15, deadZone: { width: 40, height: 24 } });

/** Whether a point of the map may be walked on: not on water, a wall or a tree. */
function walkable(x, y) {
  const { column, row } = tiles.cellAt(x, y);
  for (const layer of ['ground', 'above/details', 'above/trees']) {
    const tile = tiles.tileAt(layer, column, row);
    if (tile !== undefined && (tile.properties.solid === true || tile.properties.water === true)) return false;
  }
  return column >= 0 && row >= 0 && column < map.width && row < map.height;
}
const held = new Set(), KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
addEventListener('keydown', event => { if (KEYS[event.code]) { held.add(event.code); event.preventDefault(); } });
addEventListener('keyup', event => held.delete(event.code));
addEventListener('blur', () => held.clear());
let zoomGoal = 2;
const zoomBy = factor => { zoomGoal = Math.min(4, Math.max(0.5, zoomGoal * factor)); camera.zoomTo(zoomGoal, 0.25); };
document.querySelector('#zoom-in').addEventListener('click', () => zoomBy(2));
document.querySelector('#zoom-out').addEventListener('click', () => zoomBy(0.5));
const treesButton = document.querySelector('#trees');
treesButton.addEventListener('click', () => { const layer = tiles.layer('above/trees').display; layer.visible = !layer.visible; treesButton.setAttribute('aria-pressed', String(layer.visible)); });
// A click plants flowers on grass, or takes away what was planted.
const FLOWERS = 13, planted = [];
function plant(stageX, stageY) {
  const point = camera.screenToWorld(stageX, stageY), { column, row } = tiles.cellAt(point.x, point.y);
  const ground = tiles.tileAt('ground', column, row);
  if (ground === undefined || ground.gid > 4) return;
  const now = tiles.tileAt('above/details', column, row);
  tiles.setTile('above/details', column, row, now?.gid === FLOWERS ? 0 : FLOWERS);
  planted.push([column, row]);
}
canvas.addEventListener('pointerdown', event => {
  const box = canvas.getBoundingClientRect();
  try { plant((event.clientX - box.left) * WIDTH / box.width, (event.clientY - box.top) * HEIGHT / box.height); } catch (cause) { fail(cause); }
});

function step(seconds) {
  let dx = 0, dy = 0;
  for (const code of held) { dx += KEYS[code][0]; dy += KEYS[code][1]; }
  const length = Math.hypot(dx, dy) || 1, nx = hero.x + dx / length * SPEED * seconds, ny = hero.y + dy / length * SPEED * seconds;
  // Across and down apart, so that the disciple slides along a wall.
  if (walkable(nx, hero.y)) hero.x = nx;
  if (walkable(hero.x, ny)) hero.y = ny;
  camera.update(seconds);
}
let shown = 0;
function show() {
  shown = tiles.cull(camera.snapshot().view);
  const picture = camera.snapshot();
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Chunks drawn / 绘制的区块 ' + shown + ' / ' + tiles.layers.reduce((n, layer) => n + layer.chunks.length, 0) + ' · zoom / 缩放 ' + picture.zoom;
  stateView.textContent = JSON.stringify({ hero: { x: Math.round(hero.x), y: Math.round(hero.y), cell: tiles.cellAt(hero.x, hero.y) }, view: picture.view, shown }, null, 2);
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
const manual = new URLSearchParams(location.search).has('manual');
let last;
function tick(now) {
  try { if (!manual) step(last === undefined ? 0 : Math.min(0.1, (now - last) / 1000)); last = now; show(); } catch (cause) { fail(cause); }
  if (scope.state === 'open') requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

globalThis.__egretTileMapExample = {
  run(seconds, keys = [], fps = 60) { for (let t = 0; t < seconds - 1e-9; t += 1 / fps) { held.clear(); for (const key of keys) held.add(key); step(1 / fps); } held.clear(); show(); },
  readSnapshot: () => ({ hero: { x: hero.x, y: hero.y }, cell: tiles.cellAt(hero.x, hero.y), onScreen: camera.worldToScreen(hero.x, hero.y), view: camera.snapshot().view, zoom: camera.zoom, shown,
    chunks: tiles.layers.reduce((n, layer) => n + layer.chunks.length, 0), toScreen: (x, y) => camera.worldToScreen(x, y), planted: planted.length, failure,
    detail: (column, row) => tiles.tileAt('above/details', column, row)?.gid ?? 0, title: map.properties.title }),
  screenOf: (x, y) => camera.worldToScreen(x, y),
  cellCenter: (column, row) => camera.worldToScreen((column + 0.5) * map.tileWidth, (row + 0.5) * map.tileHeight),
};
show();
