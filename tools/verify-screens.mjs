// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/verify-screens.mjs <absolute Playwright index.mjs> <game.html> <new output directory> [screen,...]
// Opens one game page on the screens of several devices, in headless Chromium with software rendering, and says, for
// each, what an agent cannot see from one window: whether the page scrolls or is blank, how much of the screen bars
// take, whether the controls of a play game lie in the safe part, are at least 44 CSS pixels square and keep apart,
// and what the engine warned of. It writes report.json and a picture of each screen, the parts a notch or a home bar
// covers tinted red, and exits with 1 when a screen has an error.
//
// A headless browser has no notch: the page is given `globalThis.__egretAgent.insets`, which the engine takes as the
// window's safe-area insets. The controls are those a `play` game takes taps on, which it reports to
// `globalThis.__egretAgent.controls`; a game of its own reports none, and their checks are then not run.
// Screens are named: SCREENS lists them; a comma-separated list of names picks some.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserBuildTypes, loadPng, pictureStats } from './verify-game.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The screens, in CSS pixels, with the device's pixel ratio and the insets its notch and home bar make. */
export const SCREENS = Object.freeze({
  'phone-small': { width: 375, height: 667, scale: 2, touch: true, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'phone-notch': { width: 393, height: 852, scale: 3, touch: true, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
  'phone-notch-wide': {
    width: 852,
    height: 393,
    scale: 3,
    touch: true,
    insets: { top: 0, right: 59, bottom: 21, left: 59 }
  },
  'phone-tall': { width: 360, height: 800, scale: 3, touch: true, insets: { top: 24, right: 0, bottom: 0, left: 0 } },
  tablet: { width: 768, height: 1024, scale: 2, touch: true, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'tablet-wide': { width: 1024, height: 768, scale: 2, touch: true, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  foldable: { width: 884, height: 1104, scale: 2.5, touch: true, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  desktop: { width: 1920, height: 1080, scale: 1, touch: false, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
});
/** The least width and height of a control, in CSS pixels: Apple's 44 points. */
export const TOUCH_TARGET = 44;

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const inside = (a, b, slack = 1) =>
  a.x >= b.x - slack &&
  a.y >= b.y - slack &&
  a.x + a.width <= b.x + b.width + slack &&
  a.y + a.height <= b.y + b.height + slack;
const round = r => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  width: Math.round(r.width),
  height: Math.round(r.height)
});

/**
 * What is wrong with the controls of one screen: those reaching outside the safe part, those smaller than a finger,
 * and pairs that cover each other without one holding the other. A control is named by its name, or its place.
 */
export function controlFindings(controls, safe, touch) {
  const found = [];
  const label = c => (c.name ? c.name : `the control at ${Math.round(c.x)}, ${Math.round(c.y)}`);
  for (const control of controls) {
    if (!inside(control, safe))
      found.push({ check: 'inSafeArea', severity: 'error', control: label(control), rect: round(control) });
    if (touch && (control.width < TOUCH_TARGET - 0.5 || control.height < TOUCH_TARGET - 0.5))
      found.push({
        check: 'touchTarget',
        severity: 'warning',
        control: label(control),
        size: [Math.round(control.width), Math.round(control.height)]
      });
  }
  for (let a = 0; a < controls.length; a++)
    for (let b = a + 1; b < controls.length; b++) {
      const one = controls[a],
        other = controls[b];
      if (inside(one, other, 0.5) || inside(other, one, 0.5)) continue;
      if (overlap(one, other) > 1)
        found.push({ check: 'apart', severity: 'warning', controls: [label(one), label(other)] });
    }
  return found;
}

/** Tints the parts of a picture that the insets cover, so a person sees what a notch or a home bar hides. */
function tintInsets(png, insets, scale) {
  const { width, height, data } = png;
  const covered = (x, y) =>
    y < insets.top * scale ||
    x >= width - insets.right * scale ||
    y >= height - insets.bottom * scale ||
    x < insets.left * scale;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (covered(x, y)) {
        const i = (y * width + x) * 4;
        data[i] = Math.round(data[i] * 0.5 + 255 * 0.5);
        data[i + 1] = Math.round(data[i + 1] * 0.5);
        data[i + 2] = Math.round(data[i + 2] * 0.5);
      }
}

export async function verifyScreens({ chromium, PNG, file, out, names = Object.keys(SCREENS), settle = 1500 }) {
  const inCheckout = !path.relative(root, file).startsWith('..'),
    base = inCheckout ? root : path.dirname(file);
  const server = http.createServer((request, response) => {
    let wanted, content;
    try {
      wanted = path.join(base, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
      const relative = path.relative(base, wanted);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(wanted).isFile())
        throw new Error('Not a file within the serving directory');
      content = fs.readFileSync(wanted);
    } catch {
      response.writeHead(404, { connection: 'close' });
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': browserBuildTypes[path.extname(wanted)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      connection: 'close'
    });
    response.end(content);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const origin = 'http://127.0.0.1:' + server.address().port + '/',
    address = origin + path.relative(base, file).split(path.sep).join('/');
  let browser;
  const screens = [];
  try {
    browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    });
    for (const name of names) {
      const screen = SCREENS[name];
      if (screen === undefined) throw new Error(`No screen ${name}: ${Object.keys(SCREENS).join(', ')}`);
      const context = await browser.newContext({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.scale,
        isMobile: screen.touch,
        hasTouch: screen.touch
      });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(String(error.message ?? error).slice(0, 400)));
      tab.on('console', message => {
        if (message.type() === 'error' && !/GPU stall due to ReadPixels|GL Driver Message/.test(message.text()))
          errors.push(message.text().slice(0, 400));
      });
      tab.on('response', response => {
        if (response.status() >= 400) errors.push(response.url() + ' ' + response.status());
      });
      // Nothing is reached but this server, as in verify-game.
      await tab.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        errors.push('external request ' + url);
        return route.abort();
      });
      await tab.addInitScript(insets => {
        const told = { warnings: [], controls: undefined, screen: undefined };
        globalThis.__egretScreens = told;
        globalThis.__egretAgent = {
          insets,
          warning: warning => {
            if (told.warnings.length < 50) told.warnings.push({ code: warning.code, message: warning.message });
          },
          controls: (controls, screen) => {
            told.controls = controls;
            told.screen = screen;
          }
        };
      }, screen.insets);
      try {
        await tab.goto(address);
        await tab.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
        await tab.waitForTimeout(settle);
        const seen = await tab.evaluate(() => {
          const canvases = [...document.querySelectorAll('canvas')].map(canvas => {
            const box = canvas.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          });
          const page = document.scrollingElement ?? document.documentElement;
          return {
            ...globalThis.__egretScreens,
            canvases,
            scrolls: page.scrollWidth > innerWidth + 1 || page.scrollHeight > innerHeight + 1
          };
        });
        const target = path.join(out, name + '.png'),
          bytes = await tab.screenshot();
        const png = PNG.sync.read(bytes);
        const stats = pictureStats(png);
        tintInsets(png, screen.insets, screen.scale);
        fs.writeFileSync(target, PNG.sync.write(png));
        // How much of the window the largest canvas shows, within the window.
        const window = { x: 0, y: 0, width: screen.width, height: screen.height };
        const shown = Math.max(0, ...seen.canvases.map(c => overlap(c, window))) / (screen.width * screen.height);
        const findings = [];
        if (errors.length) findings.push({ check: 'noErrors', severity: 'error', errors: errors.slice(0, 5) });
        if (seen.canvases.length === 0) findings.push({ check: 'canvas', severity: 'error' });
        if (stats.colors < 3 || stats.dominant > 0.995) findings.push({ check: 'drawn', severity: 'error' });
        if (seen.scrolls) findings.push({ check: 'noScroll', severity: 'error' });
        if (shown < 0.75) findings.push({ check: 'fills', severity: 'warning', shown: Math.round(shown * 100) / 100 });
        if (seen.controls !== undefined)
          findings.push(...controlFindings(seen.controls, seen.screen.safe, screen.touch));
        screens.push({
          name,
          size: [screen.width, screen.height],
          insets: screen.insets,
          pass: !findings.some(finding => finding.severity === 'error'),
          shown: Math.round(shown * 100) / 100,
          controls: seen.controls === undefined ? null : seen.controls.length,
          // The safe part of the canvas as the engine took it, in CSS pixels of the window, for a play game.
          safe: seen.screen === undefined ? null : round(seen.screen.safe),
          findings,
          engineWarnings: seen.warnings ?? [],
          picture: target
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
  return {
    profile: 'verify-screens/1',
    page: file,
    pass: screens.every(screen => screen.pass),
    screens
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [playwright, page, output, list] = process.argv.slice(2);
  if (!playwright || !page || !output || !path.isAbsolute(playwright) || process.argv.length > 6)
    throw new Error(
      'Usage: node tools/verify-screens.mjs <absolute Playwright index.mjs> <game.html> <new output directory> [screen,...]'
    );
  const file = path.resolve(page),
    out = path.resolve(output);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('There is no page at ' + file);
  if (fs.existsSync(out)) throw new Error('The output directory must not exist yet: ' + out);
  const names = list === undefined ? Object.keys(SCREENS) : list.split(',').filter(Boolean);
  for (const name of names)
    if (!(name in SCREENS)) throw new Error(`No screen ${name}: ${Object.keys(SCREENS).join(', ')}`);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = loadPng();
  const report = await verifyScreens({ chromium, PNG, file, out, names });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  for (const screen of report.screens)
    console.log(
      `${screen.pass ? 'ok  ' : 'FAIL'} ${screen.name.padEnd(17)} ${screen.size.join('x').padEnd(10)} shown ${screen.shown}` +
        (screen.controls === null ? '' : `, ${screen.controls} controls`) +
        (screen.findings.length
          ? ': ' +
            screen.findings
              .map(f => f.check + (f.control ? ' ' + f.control : f.controls ? ' ' + f.controls.join(' / ') : ''))
              .join('; ')
          : '') +
        (screen.engineWarnings.length ? '; engine: ' + screen.engineWarnings.map(w => w.code).join(', ') : '')
    );
  console.log(`The report (report.json) and a picture of each screen are in ${out}.`);
  process.exit(report.pass ? 0 : 1);
}
