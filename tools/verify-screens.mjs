// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/verify-screens.mjs <absolute Playwright index.mjs> <game.html> <new output directory> [screen,...] [prepare.mjs | --prepare prepare.mjs] [--play play.mjs]
// Opens one game page on the screens of several devices, in headless Chromium with software rendering, and says, for
// each, what an agent cannot see from one window: whether the page scrolls or is blank, how much of the screen bars
// take, whether native play or World3D overlay controls lie in the safe part, are at least 44 CSS pixels square and keep apart,
// and what the engine warned of. It writes report.json and a picture of each screen, the parts a notch or a home bar
// covers tinted red, and exits with 1 when a screen has an error.
//
// A headless browser has no notch: the page is given `globalThis.__egretAgent.insets`, which the engine takes as the
// window's safe-area insets. Play and World3D overlay controls report native touch geometry to
// `globalThis.__egretAgent.controls`; a game with no reporter still gets only the page-level checks.
// Screens are named: SCREENS lists them; a comma-separated list of names picks some.
// With an explicitly named local preparation module, run its default(player, screen) on each fresh page first.
// It asserts the desired state and returns its nonempty scene name. The asynchronous preparation has 20 seconds.
// A trusted play script then uses the same driver as verify-game, once in a fresh context for each named screen.
// Await player.checkpoint(name) at each stable interface state: it writes a tinted picture and the same findings
// as the final screen. The screen and the run fail if any checkpoint fails or the script itself fails.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserBuildTypes, counters, driver, loadPng, pictureStats, recordScriptFailure } from './verify-game.mjs';

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

/** Execute a trusted local preparation callback, reporting rather than swallowing its failure. */
export async function prepareScreen(prepare, player, screen, timeoutMs = 20000) {
  let timer;
  try {
    const scene = await Promise.race([
      Promise.resolve().then(() => prepare(player, screen)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Scene preparation exceeded ' + timeoutMs + ' ms')), timeoutMs);
      })
    ]);
    if (typeof scene !== 'string' || !scene.trim())
      throw new Error('Preparation must return the nonempty scene name it reached.');
    return { pass: true, scene: scene.trim() };
  } catch (error) {
    return { pass: false, error: String(error?.message ?? error).slice(0, 1200) };
  } finally {
    clearTimeout(timer);
  }
}

/** Optional prepare is the explicitly supplied local module (or programmatic callback). */
export async function verifyScreens({
  chromium,
  PNG,
  file,
  out,
  names = Object.keys(SCREENS),
  settle = 1500,
  prepare,
  prepareTimeout = 20000,
  script
}) {
  const scenario = typeof prepare === 'function' ? prepare : prepare?.default;
  if (prepare !== undefined && typeof scenario !== 'function')
    throw new Error('The preparation script must have a default function.');
  if (!Number.isFinite(prepareTimeout) || prepareTimeout <= 0)
    throw new Error('Preparation timeout must be a positive number.');
  const procedural = scenario !== undefined || script !== undefined;
  if (script !== undefined && typeof script.default !== 'function')
    throw new TypeError('The play script needs a default function');
  if (new Set(names).size !== names.length) throw new TypeError('Each screen must be named only once');
  for (const name of names)
    if (!Object.hasOwn(SCREENS, name)) throw new Error(`No screen ${name}: ${Object.keys(SCREENS).join(', ')}`);
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
      if (script !== undefined)
        tab.on('requestfailed', request => errors.push(request.url() + ' ' + (request.failure()?.errorText ?? '')));
      // Nothing is reached but this server, as in verify-game.
      await tab.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        errors.push('external request ' + url);
        return route.abort();
      });
      if (script !== undefined) await tab.addInitScript(counters, screen.insets);
      else
        await tab.addInitScript(insets => {
          const told = { warnings: [], controls: undefined, screen: undefined, receipts: 0 };
          globalThis.__egretScreens = told;
          globalThis.__egretAgent = {
            insets,
            warning: warning => {
              if (told.warnings.length < 50) told.warnings.push({ code: warning.code, message: warning.message });
            },
            controls: (controls, screen) => {
              told.controls = controls;
              told.screen = screen;
              told.receipts++;
            }
          };
        }, screen.insets);
      let hadControls = false,
        observed;
      const capture = async (target, prepared) => {
        let previous,
          fresh = true;
        if (procedural) {
          previous = await tab.evaluate(() => globalThis.__egretScreens?.receipts ?? 0);
          hadControls ||= previous > 0;
          if (hadControls || prepared?.pass) {
            // The Play end-of-frame callback reports even while simulation is paused. Wait for a new actual
            // receipt rather than assuming 300ms of wall time included a rendered frame on a slow browser.
            try {
              await tab.waitForFunction(previous => (globalThis.__egretScreens?.receipts ?? 0) > previous, previous, {
                timeout: 5000
              });
            } catch {
              if (hadControls) fresh = false;
            }
          } else await tab.waitForTimeout(300);
        }
        const seen = (observed = await tab.evaluate(() => {
          const canvases = [...document.querySelectorAll('canvas')].map(canvas => {
            const box = canvas.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          });
          const page = document.scrollingElement ?? document.documentElement;
          return {
            ...globalThis.__egretScreens,
            canvases,
            rejections: globalThis.__verify?.rejections ?? [],
            scrolls: page.scrollWidth > innerWidth + 1 || page.scrollHeight > innerHeight + 1
          };
        }));
        const bytes = await tab.screenshot();
        const png = PNG.sync.read(bytes);
        const stats = pictureStats(png);
        tintInsets(png, screen.insets, screen.scale);
        fs.writeFileSync(target, PNG.sync.write(png));
        // How much of the window the largest canvas shows, within the window.
        const window = { x: 0, y: 0, width: screen.width, height: screen.height };
        const shown = Math.max(0, ...seen.canvases.map(c => overlap(c, window))) / (screen.width * screen.height);
        const findings = [];
        const viewport = tab.viewportSize();
        if (procedural && (viewport?.width !== screen.width || viewport?.height !== screen.height))
          findings.push({
            check: 'viewport',
            severity: 'error',
            expected: [screen.width, screen.height],
            actual: viewport === null ? null : [viewport.width, viewport.height]
          });
        if (procedural && hadControls && (seen.receipts ?? 0) <= previous) fresh = false;
        if (!fresh)
          findings.push({ check: 'controlsFresh', severity: 'error', previous, received: seen.receipts ?? 0 });
        hadControls ||= (seen.receipts ?? 0) > 0;
        const failures = [...errors, ...seen.rejections];
        if (failures.length) findings.push({ check: 'noErrors', severity: 'error', errors: failures.slice(0, 5) });
        if (seen.canvases.length === 0) findings.push({ check: 'canvas', severity: 'error' });
        if (stats.colors < 3 || stats.dominant > 0.995) findings.push({ check: 'drawn', severity: 'error' });
        if (seen.scrolls) findings.push({ check: 'noScroll', severity: 'error' });
        if (shown < 0.75) findings.push({ check: 'fills', severity: 'warning', shown: Math.round(shown * 100) / 100 });
        if (prepared && !prepared.pass) findings.push({ check: 'prepare', severity: 'error', error: prepared.error });
        const hasControls = fresh && Array.isArray(seen.controls) && !!seen.screen?.safe;
        if (prepared?.pass && (!hasControls || seen.controls.length === 0))
          findings.push({ check: 'noControls', severity: 'error' });
        if (hasControls) findings.push(...controlFindings(seen.controls, seen.screen.safe, screen.touch));
        return {
          pass: !findings.some(finding => finding.severity === 'error'),
          shown: Math.round(shown * 100) / 100,
          controls: hasControls ? seen.controls.length : null,
          // The safe part of the canvas as the engine took it, in CSS pixels of the window, for a play game.
          safe: hasControls ? round(seen.screen.safe) : null,
          ...(!procedural
            ? {}
            : { controlReceipt: { before: previous, after: seen.receipts ?? 0, fresh: hadControls ? fresh : null } }),
          findings,
          engineWarnings: seen.warnings ?? [],
          picture: target
        };
      };
      const checkpoints = [];
      let played, folder, prepared, preparedState;
      const target = path.join(out, name + '.png');
      if (script !== undefined) {
        folder = path.join(out, name);
        fs.mkdirSync(folder);
        played = { pass: false, pictures: [], checkpoints: [] };
      }
      try {
        await tab.goto(address);
        if (scenario) {
          const player = driver(tab, PNG, out, prepare?.stage, {
            picturePrefix: 'prepared-' + name + '-',
            uniquePictures: true,
            warnings: () => tab.evaluate(() => globalThis.__egretScreens.warnings),
            sounds: async () => {
              throw new Error('Audio is not measured by --screens; use --play for that.');
            }
          });
          const info = Object.freeze({ name, ...screen, insets: Object.freeze({ ...screen.insets }) });
          prepared = await prepareScreen(scenario, player, info, prepareTimeout);
        }
        await tab.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
        await tab.waitForTimeout(settle);
        if (played !== undefined) {
          hadControls ||= (await tab.evaluate(() => globalThis.__egretScreens?.receipts ?? 0)) > 0;
          if (prepared !== undefined) preparedState = await capture(path.join(folder, 'prepared.png'), prepared);
          if (prepared && !prepared.pass) {
            recordScriptFailure(played, new Error('Preparation failed: ' + prepared.error), 'VERIFY_SCREEN_PREPARE');
          } else {
            const player = driver(tab, PNG, folder, script.stage, { uniquePictures: true }),
              keep = player.picture;
            player.picture = async picture => {
              const target = await keep(picture);
              played.pictures.push(target);
              return target;
            };
            // Checkpoints are ordered and their filenames are ordinal, never derived from labels supplied by a script.
            // Waiting for the next normal control report (about four per second) avoids inspecting a stale layout.
            let pending = Promise.resolve();
            player.checkpoint = label => {
              if (typeof label !== 'string' || !label.trim() || /[\x00-\x1f\x7f]/.test(label))
                throw new TypeError('A checkpoint needs a non-empty name without control characters');
              const checkpoint = label.trim();
              if (played.checkpoints.includes(checkpoint))
                throw new TypeError('Repeated checkpoint name: ' + checkpoint);
              played.checkpoints.push(checkpoint);
              const index = played.checkpoints.length;
              pending = pending.then(async () => {
                const observation = await capture(path.join(folder, 'checkpoint-' + index + '.png'));
                checkpoints.push({ name: checkpoint, ...observation });
                return observation;
              });
              // As in one-window play, older scripts may record a step without awaiting it. Keep the failure for
              // the report even then; awaiting the checkpoint is required to inspect it before the next input.
              pending.catch(() => {});
              return pending;
            };
            try {
              await script.default(player);
              await pending;
              played.pass = true;
            } catch (error) {
              await pending.catch(() => {});
              recordScriptFailure(played, error, 'VERIFY_GAME_SCRIPT');
              await tab.screenshot({ path: path.join(folder, 'failed.png') }).catch(() => {});
            }
          }
        }
        const final = await capture(target, played === undefined ? prepared : undefined);
        screens.push({
          name,
          size: [screen.width, screen.height],
          insets: screen.insets,
          ...final,
          ...(prepared === undefined ? {} : { prepared }),
          ...(preparedState === undefined ? {} : { preparedState }),
          ...(played === undefined
            ? {}
            : {
                pass:
                  final.pass &&
                  played.pass &&
                  (preparedState?.pass ?? true) &&
                  checkpoints.every(checkpoint => checkpoint.pass),
                played,
                checkpoints
              })
        });
      } catch (error) {
        // A script or page may make its final capture impossible (navigation failed, page closed).
        // In scripted mode retain earlier pictures/findings, report the error and still try the next screen.
        if (!procedural) throw error;
        if (played !== undefined) {
          if (played.diagnostic === undefined) recordScriptFailure(played, error, 'VERIFY_SCREEN_CAPTURE');
          played.pass = false;
        }
        const findings = [
          { check: 'capture', severity: 'error', error: String(error?.message ?? error).slice(0, 1200) }
        ];
        if (prepared && !prepared.pass) findings.push({ check: 'prepare', severity: 'error', error: prepared.error });
        if (errors.length) findings.push({ check: 'noErrors', severity: 'error', errors: errors.slice(0, 5) });
        screens.push({
          name,
          size: [screen.width, screen.height],
          insets: screen.insets,
          pass: false,
          shown: null,
          controls: null,
          safe: null,
          findings,
          engineWarnings: observed?.warnings ?? [],
          picture: fs.existsSync(target) ? target : null,
          ...(prepared === undefined ? {} : { prepared }),
          ...(preparedState === undefined ? {} : { preparedState }),
          ...(played === undefined ? {} : { played, checkpoints })
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
  const [playwright, page, output, ...options] = process.argv.slice(2);
  if (!playwright || !page || !output || !path.isAbsolute(playwright))
    throw new Error(
      'Usage: node tools/verify-screens.mjs <absolute Playwright index.mjs> <game.html> <new output directory> [screen,...] [prepare.mjs | --prepare prepare.mjs] [--play play.mjs]'
    );
  const list = options[0] !== undefined && !options[0].startsWith('--') ? options.shift() : undefined;
  // The previous direct entry accepted preparation as its fifth positional argument.
  let prepareFile = options[0] !== undefined && !options[0].startsWith('--') ? options.shift() : undefined,
    play;
  while (options.length) {
    const option = options.shift();
    if (option !== '--prepare' && option !== '--play') throw new Error('Unknown option ' + option);
    const value = options.shift();
    if (!value || value.startsWith('--')) throw new Error(option + ' takes a script path.');
    if (option === '--prepare') {
      if (prepareFile !== undefined) throw new Error('Name one preparation script.');
      prepareFile = value;
    } else {
      if (play !== undefined) throw new Error('Name one play script.');
      play = value;
    }
  }
  const file = path.resolve(page),
    out = path.resolve(output);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('There is no page at ' + file);
  if (fs.existsSync(out)) throw new Error('The output directory must not exist yet: ' + out);
  const names = list === undefined ? Object.keys(SCREENS) : list.split(',').filter(Boolean);
  for (const name of names)
    if (!Object.hasOwn(SCREENS, name)) throw new Error(`No screen ${name}: ${Object.keys(SCREENS).join(', ')}`);
  if (new Set(names).size !== names.length) throw new TypeError('Each screen must be named only once');
  const preparePath = prepareFile === undefined ? undefined : path.resolve(prepareFile);
  if (preparePath !== undefined && !fs.statSync(preparePath, { throwIfNoEntry: false })?.isFile())
    throw new Error('There is no preparation script at ' + preparePath);
  if (play !== undefined && !fs.statSync(path.resolve(play), { throwIfNoEntry: false })?.isFile())
    throw new Error('There is no script at ' + path.resolve(play));
  const prepare = preparePath === undefined ? undefined : await import(pathToFileURL(preparePath).href);
  const script = play === undefined ? undefined : await import(pathToFileURL(path.resolve(play)).href);
  if (script !== undefined && typeof script.default !== 'function')
    throw new TypeError('The play script needs a default function');
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = loadPng();
  const report = await verifyScreens({ chromium, PNG, file, out, names, prepare, script });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const describe = screen =>
    (screen.controls === null ? '' : `, ${screen.controls} controls`) +
    (screen.prepared?.pass ? ' scene ' + screen.prepared.scene : '') +
    (screen.findings.length
      ? ': ' +
        screen.findings
          .map(f => f.check + (f.control ? ' ' + f.control : f.controls ? ' ' + f.controls.join(' / ') : ''))
          .join('; ')
      : '') +
    (screen.engineWarnings.length ? '; engine: ' + screen.engineWarnings.map(w => w.code).join(', ') : '');
  for (const screen of report.screens) {
    console.log(
      `${screen.pass ? 'ok  ' : 'FAIL'} ${screen.name.padEnd(17)} ${screen.size.join('x').padEnd(10)} shown ${screen.shown}` +
        describe(screen)
    );
    if (screen.played) {
      if (screen.preparedState)
        console.log(
          `     ${screen.preparedState.pass ? 'ok  ' : 'FAIL'} preparation: shown ${screen.preparedState.shown}` +
            describe(screen.preparedState)
        );
      for (const checkpoint of screen.checkpoints)
        console.log(
          `     ${checkpoint.pass ? 'ok  ' : 'FAIL'} ${checkpoint.name}: shown ${checkpoint.shown}` +
            describe(checkpoint)
        );
      if (!screen.played.pass) console.log('     FAIL script: ' + screen.played.diagnostic.message);
    }
  }
  console.log(`The report (report.json) and a picture of each screen are in ${out}.`);
  process.exit(report.pass ? 0 : 1);
}
