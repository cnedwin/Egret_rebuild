// SPDX-License-Identifier: Apache-2.0
// Checks the graphics example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/graphics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. Input is injected through the browser's
// automation protocol; no person pressed a key. Colours are read from screenshots of the canvas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)),
  [playwrightPath, out, renderer] = process.argv.slice(2);
if (
  !playwrightPath ||
  !out ||
  !path.isAbsolute(playwrightPath) ||
  !path.isAbsolute(out) ||
  fs.existsSync(out) ||
  ![undefined, 'software'].includes(renderer)
)
  throw new Error(
    'Usage: node examples/graphics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]'
  );
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown'
};
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404, { connection: 'close' });
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': types[path.extname(file)] ?? 'application/octet-stream',
    connection: 'close'
  });
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = {
  profile: 'graphics-example/1',
  node: process.version,
  input: 'injected through the automation protocol',
  renderer:
    renderer === 'software'
      ? 'bundled Chromium, headless, software rendering'
      : 'installed Edge, headed, default launch',
  backends: [],
  cases: []
};
const browser = await chromium.launch(
  renderer === 'software'
    ? {
        args: [
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--ignore-gpu-blocklist',
          '--enable-unsafe-webgpu',
          '--use-webgpu-adapter=swiftshader',
          '--enable-features=Vulkan',
          '--use-vulkan=swiftshader'
        ]
      }
    : { channel: 'msedge', headless: false }
);
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretGraphicsExample.readSnapshot());
const drawn = page => page.waitForTimeout(80);
async function at(page, [x, y]) {
  const box = await page.evaluate(() => {
    const bounds = document.querySelector('#scene').getBoundingClientRect();
    return [bounds.left, bounds.top, bounds.width, bounds.height];
  });
  return [box[0] + (x * box[2]) / 480, box[1] + (y * box[3]) / 270];
}
/** The colour the page shows at a place of the stage, read from a screenshot the page decodes itself. */
async function colour(page, place) {
  const [x, y] = await at(page, place);
  const shot = (await page.screenshot({ clip: { x: x - 2, y: y - 2, width: 4, height: 4 } })).toString('base64');
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob()),
      surface = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    surface.drawImage(bitmap, 0, 0);
    const [red, green, blue] = surface.getImageData(1, 1, 1, 1).data;
    return ((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0');
  }, shot);
}
const near = (actual, expected, tolerance, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    label + ': ' + actual + ' is not within ' + tolerance + ' of ' + expected
  );
async function scenario(name, context, body, query = '?backend=webgl2&manual') {
  const owned = await browser.newContext(context),
    page = await owned.newPage(),
    row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') row.errors.push(message.text());
  });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/graphics/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretGraphicsExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined, await page.textContent('#status'));
    assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) {
    row.status = 'FAIL';
    row.failure = String(error.stack ?? error);
    process.exitCode = 1;
  }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } },
  phone = { ...devices['Pixel 7'] };
// Colours worked out here in linear light, then shown as the page shows them.
const decode = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const linear = hex => [16, 8, 0].map(shift => decode(((hex >> shift) & 255) / 255));
const shown = rgb => rgb.map(v => Math.round(255 * encode(Math.min(1, v))));
const over = (top, alpha, under) => top.map((v, i) => v * alpha + under[i] * (1 - alpha));
const within = (actual, expected, label, tolerance = 2) => {
  const rgb = [16, 8, 0].map(shift => (parseInt(actual, 16) >> shift) & 255);
  for (let i = 0; i < 3; i++) near(rgb[i], expected[i], tolerance, label + ' channel ' + i + ' of ' + actual);
};

await scenario(
  'webgl2: every shape is filled and lined in its own colours, inside its outline and not outside it',
  desktop,
  async page => {
    const now = await read(page),
      C = now.colours,
      clear = linear(C.clear);
    assert.equal(now.backend, 'webgl2');
    // The circle: its colour at the centre and near its edge, the background just outside it.
    within(await colour(page, [60, 60]), shown(linear(C.circle)), 'circle centre');
    within(await colour(page, [60, 28]), shown(linear(C.circle)), 'circle top, inside');
    within(await colour(page, [60, 19]), shown(clear), 'above the circle');
    within(await colour(page, [29, 29]), shown(clear), 'the corner a square would fill');
    // The ellipse is wider than it is tall.
    within(await colour(page, [185, 60]), shown(linear(C.ellipse)), 'ellipse, far right inside');
    within(await colour(page, [150, 35]), shown(clear), 'above the ellipse');
    // The rounded rectangle: fill inside, line on its edge, background in the corner the rounding leaves.
    within(await colour(page, [300, 60]), shown(linear(C.panel)), 'panel fill');
    within(await colour(page, [300, 30]), shown(linear(C.line)), 'panel line, top edge');
    within(await colour(page, [241, 31]), shown(clear), 'panel corner');
    // The translucent disc over the panel and over the background.
    within(await colour(page, [340, 80]), shown(over(linear(C.glass), 0.5, linear(C.panel))), 'glass over the panel');
    within(await colour(page, [372, 100]), shown(over(linear(C.glass), 0.5, clear)), 'glass over the background');
    // The arrow: filled, and not in its notch.
    within(await colour(page, [50, 170]), shown(linear(C.arrow)), 'arrow, left wing');
    within(await colour(page, [100, 170]), shown(linear(C.arrow)), 'arrow, right wing');
    within(await colour(page, [75, 205]), shown(clear), 'arrow notch');
    // The line: four units wide, with a corner.
    within(await colour(page, [180, 160]), shown(linear(C.stroke)), 'line, first run');
    within(await colour(page, [220, 190]), shown(linear(C.stroke)), 'line, second run');
    within(await colour(page, [180, 166]), shown(clear), 'beside the line');
    within(await colour(page, [220, 160]), shown(linear(C.stroke)), 'line corner');
    // The curve passes under its control point, halfway to it.
    within(await colour(page, [300, 200]), shown(linear(C.stroke)), 'curve middle');
    // The gradient: its first colour up to its start, its last from its end, and halfway the two mixed as sRGB values.
    within(await colour(page, [394, 30]), shown(linear(C.from)), 'gradient, before its start');
    within(await colour(page, [466, 30]), shown(linear(C.to)), 'gradient, after its end');
    within(await colour(page, [430, 30]), [128, 0, 128], 'gradient, halfway', 6);
    // The frame is filled and its hole is not.
    within(await colour(page, [400, 95]), shown(linear(C.frame)), 'frame');
    within(await colour(page, [430, 95]), shown(clear), 'the hole in the frame');
    // The image fill: squares of eight units in two colours in turn, the image starting at (140, 104) and repeating.
    within(await colour(page, [160, 108]), shown(linear(C.tileA)), 'tile, first square of the second repeat');
    within(await colour(page, [168, 108]), shown(linear(C.tileB)), 'tile, the square beside it');
    within(await colour(page, [160, 116]), shown(linear(C.tileB)), 'tile, the square under it');
    within(await colour(page, [216, 132]), shown(linear(C.tileA)), 'tile, far along and in its second row');
    within(await colour(page, [141, 105]), shown(clear), 'the rounded corner of the image fill');
    // The dashed line: a dash from 20 to 36, a gap to 48 that the round ends reach three units into.
    within(await colour(page, [28, 252]), shown(linear(C.dash)), 'first dash');
    within(await colour(page, [42, 252]), shown(clear), 'first gap');
    within(await colour(page, [56, 252]), shown(linear(C.dash)), 'second dash');
  },
  '?backend=webgl2'
);

await scenario(
  'webgl2: the wedges are drawn with arcs, and drawn again when they turn',
  desktop,
  async page => {
    const C = (await read(page)).colours;
    // Four wedges of a ring round (400, 190): right, bottom, left, top, in two colours in turn.
    const places = [
      [430, 205],
      [385, 220],
      [370, 175],
      [415, 160]
    ];
    for (let i = 0; i < 4; i++)
      within(await colour(page, places[i]), shown(linear(i % 2 === 0 ? C.wedgeA : C.wedgeB)), 'wedge ' + i);
    within(await colour(page, [400, 190]), shown(linear(C.clear)), 'the hole of the ring');
    await page.click('#spin');
    await drawn(page);
    assert.equal((await read(page)).turns, 1);
    for (let i = 0; i < 4; i++)
      within(await colour(page, places[i]), shown(linear(i % 2 === 0 ? C.wedgeB : C.wedgeA)), 'turned wedge ' + i);
  },
  '?backend=webgl2'
);

await scenario(
  'webgl2: three hundred discs of different sizes are three hundred drawings in one frame',
  desktop,
  async page => {
    const now = await read(page);
    assert.equal(now.many, 300);
    // The first, the last of the first row and the last of all, each at its own place in rows of thirty.
    for (const i of [0, 29, 299])
      within(
        await colour(page, [8 + 16 * (i % 30), 8 + 16 * Math.floor(i / 30)]),
        shown(linear(now.colours.dash)),
        'disc ' + i
      );
  },
  '?backend=webgl2&many=300'
);

await scenario(
  'webgl2: a smoothed disc fades at its edge between its colour and what is under it, and the other does not',
  desktop,
  async page => {
    const C = (await read(page)).colours,
      red = async place => parseInt((await colour(page, place)).slice(0, 2), 16),
      full = C.circle >> 16,
      under = C.clear >> 16;
    // The plain disc: its colour inside its edge, and what is under it just outside.
    near(await red([200 + 27, 135]), full, 3, 'inside the plain disc');
    near(await red([200 + 33, 135]), under, 3, 'outside the plain disc');
    // The smoothed disc: its colour inside, in between in the middle of its band of four units, and nothing past the band.
    near(await red([290 + 27, 135]), full, 3, 'inside the smoothed disc');
    for (const [dx, dy] of [
      [32, 0],
      [-32, 0],
      [0, 32],
      [0, -32]
    ]) {
      const middle = await red([290 + dx, 135 + dy]);
      assert.ok(middle > under + 20 && middle < full - 20, 'the band at ' + dx + ',' + dy + ' is ' + middle);
    }
    near(await red([290 + 37, 135]), under, 3, 'past the band');
  },
  '?backend=webgl2&smooth'
);

await scenario(
  'on a phone the page draws the shapes and a tap turns the wedges',
  phone,
  async page => {
    const C = (await read(page)).colours;
    within(await colour(page, [60, 60]), shown(linear(C.circle)), 'circle centre', 3);
    await page.tap('#spin');
    await drawn(page);
    assert.equal((await read(page)).turns, 1);
  },
  '?backend=webgl2'
);

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  report.cases
    .map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : ''))
    .join('\n')
);
await browser.close();
server.close();
process.exit(process.exitCode ?? 0);
