#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/wechat/export-wechat.mjs --esbuild <installed esbuild module> --game <game folder> --out <new folder>
//          [--entry src/main.mjs] [--appid <AppID>] [--orientation portrait|landscape] [--name <project name>] [--no-minify]
//          [--playwright <installed Playwright index.mjs>]
//
// Turns a browser game made with the engine into a WeChat mini game project: the folder that WeChat DevTools opens
// and that is uploaded to the WeChat platform. The game's own page (index.html) gives its import map, which names
// where each module of the engine is, and the elements its code looks up by id. The tool:
//
//  - bundles the game's entry and every module it reaches into one script, following that import map, with each
//    module's import.meta.url naming its file under https://game.local/ so `new URL('../x.json', import.meta.url)`
//    still finds the file;
//  - writes game.js: tools/wechat/adapter.js first (a window, a document, fetch, images, storage, sound and pointer
//    events made from wx), then the game, run with those names bound to the adapter's objects and every other name a
//    page has bound to nothing, so the game cannot reach what a mini game does not have;
//  - copies the game's other files (pictures, sounds, levels) whose kinds WeChat accepts, and writes game.json and
//    project.config.json; with --playwright, WebP pictures are written again as JPEG (or PNG where a pixel is not
//    opaque) by a headless Chromium, since WeChat on some phones does not decode WebP, and the adapter finds them
//    under their new names;
//  - reports the package's size against WeChat's limits (4 MB for the main package, 30 MB in all) and refuses files
//    WeChat will not upload.
//
// The result is checked in a headless browser with a stand-in for wx (tools/wechat/check-minigame.mjs). Uploading it
// needs the game's AppID and its upload key, from the WeChat platform: open the folder in WeChat DevTools and press
// Upload, or use miniprogram-ci with the key.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ORIGIN = 'https://game.local/';
export const MAIN_PACKAGE_LIMIT = 4 * 1024 * 1024;
export const TOTAL_LIMIT = 30 * 1024 * 1024;
/** The kinds of file WeChat uploads in a mini game package, from its documentation's whitelist (the common ones). */
export const UPLOADABLE = new Set(
  'png jpg jpeg gif svg webp bmp ico tif tiff mp3 wav ogg m4a aac silk mp4 m3u8 json xml csv txt tsv ttf otf woff woff2 fnt atlas bin glb gltf obj fbx dae wasm br unityweb pvr astc ktx ktx2 etc pkm basis plist skel cconb md'.split(
    ' '
  )
);
/** The names a page has that a mini game does not, which the game sees as the adapter's or as nothing. */
export const PAGE_NAMES = [
  'window',
  'self',
  'globalThis',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'fetch',
  'Response',
  'Request',
  'Headers',
  'performance',
  'URL',
  'URLSearchParams',
  'TextEncoder',
  'TextDecoder',
  'Image',
  'HTMLImageElement',
  'HTMLCanvasElement',
  'Text',
  'Document',
  'HTMLDocument',
  'CSSStyleDeclaration',
  'DOMRectReadOnly',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'EventTarget',
  'CustomEvent',
  'PointerEvent',
  'MouseEvent',
  'KeyboardEvent',
  'TouchEvent',
  'FocusEvent',
  'WheelEvent',
  'UIEvent',
  'InputEvent',
  'AbortController',
  'AbortSignal',
  'ResizeObserver',
  'MutationObserver',
  'IntersectionObserver',
  'matchMedia',
  'getComputedStyle',
  'devicePixelRatio',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'AudioContext',
  'webkitAudioContext',
  'structuredClone',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'screen',
  'history',
  'alert',
  'confirm',
  'prompt',
  'open',
  'OffscreenCanvas',
  'ImageBitmap',
  'createImageBitmap',
  'ImageData',
  'DOMException',
  'Blob',
  'File',
  'FileReader',
  'FontFace',
  'Worker',
  'SharedWorker',
  'indexedDB',
  'caches',
  'XMLHttpRequest',
  'WebSocket',
  'Audio',
  'HTMLAudioElement',
  'HTMLVideoElement',
  'HTMLMediaElement',
  'VideoFrame',
  'MediaSource',
  'BroadcastChannel',
  'MessageChannel',
  'visualViewport',
  'customElements',
  'DOMParser',
  'XMLSerializer',
  'Path2D',
  'DOMMatrix',
  'DOMRect',
  'GPU',
  'WebGL2RenderingContext',
  'WebGLRenderingContext',
  'GPUCanvasContext',
  'crypto',
  'reportError',
  'speechSynthesis',
  'SpeechSynthesisUtterance',
  'Notification',
  'ServiceWorker',
  'EventSource',
  'Gamepad',
  'GamepadEvent',
  // A canvas's 2D drawing and WebAssembly are not names of a mini game's global: WeChat gives a 2D context from
  // wx.createCanvas() with no class to name, and WXWebAssembly in place of WebAssembly. Code that needs them asks the
  // canvas, as the engine's text does.
  'CanvasRenderingContext2D',
  'OffscreenCanvasRenderingContext2D',
  'ImageBitmapRenderingContext',
  'CanvasGradient',
  'CanvasPattern',
  'TextMetrics',
  'WebAssembly',
  'CSS',
  'FontFaceSet',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'getSelection',
  'requestIdleCallback',
  'cancelIdleCallback'
];

function refuse(message) {
  return Object.assign(new Error(message), { code: 'WECHAT_EXPORT' });
}

/** The import map of a game's index.html, as absolute file paths by specifier. */
export function readImportMap(gameDir) {
  const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
  const match = /<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(html);
  if (!match) throw refuse(path.join(gameDir, 'index.html') + ' has no import map');
  const imports = JSON.parse(match[1]).imports ?? {};
  return Object.fromEntries(Object.entries(imports).map(([spec, target]) => [spec, path.resolve(gameDir, target)]));
}

/**
 * The elements of the page's body that the game may look up: every element, with its tag, id, classes and text,
 * nested as in the page. Scripts, styles and noscript are left out.
 */
export function readPageSkeleton(gameDir) {
  const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html) ?? [])[1] ?? '';
  const cleaned = body.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const root = { children: [] },
    stack = [root];
  const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'col', 'embed', 'wbr', 'track']);
  const token = /<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  for (let m; (m = token.exec(cleaned)); ) {
    if (m[3] !== undefined) {
      const text = m[3].trim();
      if (text) stack[stack.length - 1].text = ((stack[stack.length - 1].text ?? '') + ' ' + text).trim();
      continue;
    }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith('</')) {
      while (stack.length > 1 && stack.pop().tag !== tag);
      continue;
    }
    const attrs = m[2];
    const node = { tag, children: [] };
    const id = /\bid="([^"]*)"/.exec(attrs);
    const cls = /\bclass="([^"]*)"/.exec(attrs);
    if (id) node.id = id[1];
    if (cls) node.className = cls[1];
    stack[stack.length - 1].children.push(node);
    if (!VOID.has(tag) && !attrs.trim().endsWith('/')) stack.push(node);
  }
  const prune = node => ({
    tag: node.tag,
    ...(node.id ? { id: node.id } : {}),
    ...(node.className ? { className: node.className } : {}),
    ...(node.text ? { text: node.text } : {}),
    ...(node.children.length ? { children: node.children.map(prune) } : {})
  });
  return { body: root.children.map(prune) };
}

/** The game bundled into one script with top-level awaits, following the page's import map. */
export async function bundleGame({ esbuild, gameDir, entry, importMap }) {
  const map = importMap ?? readImportMap(gameDir);
  const result = await esbuild.build({
    entryPoints: [path.resolve(gameDir, entry)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    mainFields: ['module', 'main'],
    plugins: [
      {
        name: 'import-map',
        setup(build) {
          build.onResolve({ filter: /^[^./]/ }, args => {
            if (map[args.path]) return { path: map[args.path] };
            throw refuse('The page has no import map entry for ' + args.path + ' (imported by ' + args.importer + ')');
          });
          build.onLoad({ filter: /\.(m?js)$/ }, args => {
            let text = fs.readFileSync(args.path, 'utf8');
            if (text.includes('import.meta.url')) {
              const name = ORIGIN + path.relative(gameDir, args.path).split(path.sep).join('/');
              text = text.replaceAll('import.meta.url', JSON.stringify(name));
            }
            return { contents: text, loader: 'js' };
          });
        }
      }
    ]
  });
  const code = result.outputFiles[0].text.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  return { code, warnings: result.warnings };
}

/** game.js: the adapter, then the game run as an async function of the page's names. */
export function gameScript({ adapter, page, bundle }) {
  const names = PAGE_NAMES;
  return [
    '// Made by tools/wechat/export-wechat.mjs of the Egret engine: the adapter, then the game.',
    "var __G = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;",
    adapter,
    `var __egret = installEgretWechatAdapter(__G, ${JSON.stringify(page)});`,
    `var __names = __egret.globals;`,
    `(async function (${names.join(', ')}) {`,
    bundle,
    `})(${names.map(name => `__names[${JSON.stringify(name)}]`).join(', ')}).catch(function (error) {`,
    "  console.error('The game stopped:', error && error.stack ? error.stack : error);",
    '  if (__G.__egretFailed) __G.__egretFailed(error);',
    '});',
    ''
  ].join('\n');
}

/** Every file of the game besides its code and pages, which the package carries as they are. */
export function assetFiles(gameDir) {
  const skip = new Set(['vendor', 'src', 'test', 'tests', 'tools', 'node_modules', '.git', 'dist']);
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name),
        rel = path.relative(gameDir, full);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) || dir !== gameDir) walk(full);
        continue;
      }
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (dir === gameDir && ['html', 'css', 'md', 'mjs', 'js', 'json', 'txt'].includes(ext)) continue;
      if (['mjs', 'js', 'ts', 'map', 'html', 'css'].includes(ext)) continue;
      out.push({ rel, full, ext, uploadable: UPLOADABLE.has(ext), bytes: fs.statSync(full).size });
    }
  };
  walk(gameDir);
  return out;
}

/** Formats written again by a transcoder: WebP is not decoded by every phone's WeChat. */
export const TRANSCODED = new Set(['webp']);

/**
 * A transcoder that decodes each picture in a headless Chromium and writes it as JPEG (quality 0.9) where every pixel
 * is opaque and as PNG otherwise. Call close() when done.
 */
export async function chromiumTranscoder(chromium) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const transcode = async (bytes, ext) => {
    const result = await page.evaluate(
      async ({ data, type }) => {
        const binary = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([binary], { type }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
          context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        let opaque = true;
        for (let i = 3; i < pixels.length && opaque; i += 4) opaque = pixels[i] === 255;
        const blob = await canvas.convertToBlob(opaque ? { type: 'image/jpeg', quality: 0.9 } : { type: 'image/png' });
        const out = new Uint8Array(await blob.arrayBuffer());
        let text = '';
        for (let i = 0; i < out.length; i += 0x8000) text += String.fromCharCode(...out.subarray(i, i + 0x8000));
        return { data: btoa(text), ext: opaque ? 'jpg' : 'png' };
      },
      { data: Buffer.from(bytes).toString('base64'), type: 'image/' + ext }
    );
    return { bytes: Buffer.from(result.data, 'base64'), ext: result.ext };
  };
  return { transcode, close: () => browser.close() };
}

/** Writes the mini game project; returns what it wrote and how its size compares with WeChat's limits. */
export async function exportWechat({
  esbuild,
  gameDir,
  out,
  entry = 'src/main.mjs',
  appid = 'touristappid',
  orientation = 'portrait',
  name,
  minify = true,
  transcode
}) {
  if (!fs.existsSync(path.join(gameDir, 'index.html'))) throw refuse('There is no index.html in ' + gameDir);
  if (fs.existsSync(out) && fs.readdirSync(out).length > 0)
    throw refuse('The output folder must be new or empty: ' + out);
  if (!['portrait', 'landscape'].includes(orientation)) throw refuse('orientation must be portrait or landscape');
  const page = readPageSkeleton(gameDir);
  const assets = assetFiles(gameDir);
  // Pictures in a format a phone's WeChat may not decode are written again in one it does, when a transcoder is given;
  // the adapter finds them under their new names.
  const converted = new Map();
  if (transcode)
    for (const asset of assets.filter(a => TRANSCODED.has(a.ext))) {
      const result = await transcode(fs.readFileSync(asset.full), asset.ext);
      const rel = asset.rel.slice(0, -asset.ext.length) + result.ext;
      converted.set(asset.rel, { rel, bytes: result.bytes });
      (page.renamed ??= {})[asset.rel.split(path.sep).join('/')] = rel.split(path.sep).join('/');
    }
  const { code, warnings } = await bundleGame({ esbuild, gameDir, entry });
  const adapter = fs.readFileSync(path.join(here, 'adapter.js'), 'utf8');
  // One last pass for every WeChat: syntax down to ES2017, which every supported WeChat runs.
  const script = (
    await esbuild.transform(gameScript({ adapter, page, bundle: code }), {
      loader: 'js',
      target: 'es2017',
      minify,
      legalComments: 'inline',
      charset: 'utf8'
    })
  ).code;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'game.js'), script);
  fs.writeFileSync(
    path.join(out, 'game.json'),
    JSON.stringify(
      {
        deviceOrientation: orientation,
        showStatusBar: false,
        // WebGL2 on iOS: high-performance mode runs the game in a WebKit with WebGL2. It must also be enabled for the
        // AppID on the WeChat platform.
        iOSHighPerformance: true,
        networkTimeout: { request: 10000, downloadFile: 10000 }
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(out, 'project.config.json'),
    JSON.stringify(
      {
        description: 'Exported from an Egret engine game by tools/wechat/export-wechat.mjs',
        compileType: 'game',
        appid,
        projectname: name ?? path.basename(path.resolve(gameDir)),
        setting: { es6: true, enhance: true, minified: true, postcss: false, urlCheck: true, minifyWXSS: true },
        packOptions: { ignore: [] }
      },
      null,
      2
    ) + '\n'
  );
  const refused = assets.filter(a => !a.uploadable).map(a => a.rel);
  for (const asset of assets.filter(a => a.uploadable)) {
    const done = converted.get(asset.rel),
      target = path.join(out, done ? done.rel : asset.rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (done) fs.writeFileSync(target, done.bytes);
    else fs.copyFileSync(asset.full, target);
  }
  let total = 0;
  const sizeOf = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) sizeOf(full);
      else total += fs.statSync(full).size;
    }
  };
  sizeOf(out);
  return {
    out,
    gameJsBytes: Buffer.byteLength(script),
    totalBytes: total,
    mainPackageLimit: MAIN_PACKAGE_LIMIT,
    withinMainPackage: total <= MAIN_PACKAGE_LIMIT,
    withinTotal: total <= TOTAL_LIMIT,
    assets: assets.filter(a => a.uploadable).length,
    refused,
    transcoded: [...converted].map(([from, to]) => from + ' -> ' + to.rel),
    webp: transcode ? [] : assets.filter(a => a.ext === 'webp').map(a => a.rel),
    warnings: warnings.map(w => w.text)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--no-minify') options.minify = false;
    else if (
      ['--playwright', '--esbuild', '--game', '--out', '--entry', '--appid', '--orientation', '--name'].includes(key) &&
      args[i + 1] !== undefined
    )
      options[key.slice(2)] = args[++i];
    else throw refuse('Unknown or incomplete option ' + key);
  }
  if (!options.esbuild || !options.game || !options.out)
    throw refuse(
      'Usage: node tools/wechat/export-wechat.mjs --esbuild <esbuild> --game <game folder> --out <new folder> [--entry src/main.mjs] [--appid <AppID>] [--orientation portrait|landscape] [--playwright <Playwright index.mjs: writes .webp pictures as .jpg or .png>]'
    );
  const require = createRequire(import.meta.url);
  const esbuild = require(path.resolve(options.esbuild));
  const transcoder = options.playwright
    ? await chromiumTranscoder((await import(pathToFileURL(path.resolve(options.playwright)).href)).chromium)
    : undefined;
  const report = await exportWechat({
    esbuild,
    gameDir: path.resolve(options.game),
    out: path.resolve(options.out),
    entry: options.entry,
    appid: options.appid,
    orientation: options.orientation,
    name: options.name,
    minify: options.minify,
    transcode: transcoder?.transcode
  }).finally(() => transcoder?.close());
  console.log(JSON.stringify(report, null, 2));
  if (!report.withinMainPackage)
    console.error(
      "The package is larger than WeChat's 4 MB main package: move assets to a subpackage or load them from a CDN."
    );
  if (report.webp.length)
    console.error(
      'WeChat on some phones does not decode WebP; give --playwright to write these as JPEG or PNG: ' +
        report.webp.join(', ')
    );
  if (report.refused.length) console.error('WeChat will not upload these files: ' + report.refused.join(', '));
  process.exit(report.withinTotal ? 0 : 1);
}
