// First-party Apache-2.0 example. Ahem has separate retained rights in assets/.
import { createEngine } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';

const form = document.querySelector('#replace-form');
const input = document.querySelector('#source');
const replaceButton = document.querySelector('#replace');
const closeButton = document.querySelector('#close');
const status = document.querySelector('#status');
const committed = document.querySelector('#committed');
const surface = document.querySelector('#surface');
const FONT_SHA256 = 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc';

function admittedText(text) {
  const lines = text.split(/\r\n|\r|\n/);
  if (!/^[X \r\n]*$/.test(text) || lines.length > 4 || lines.some(line => line.length > 12)) {
    return false;
  }
  return true;
}

async function run() {
  let engine, scope, cache, field, canvas, face;
  let closing = false;
  let busy = true;
  let attached = false;
  let operation = Promise.resolve();
  let finish;
  const closedByCaller = new Promise(resolve => { finish = resolve; });
  // A boolean preserves even a native `throw undefined` as the first failure.
  let failed = false;
  let firstFailure;
  const laterFailures = [];
  const retain = cause => {
    if (!failed) { failed = true; firstFailure = cause; }
    else laterFailures.push(cause);
  };
  const requestClose = () => {
    if (closing) return;
    closing = true;
    replaceButton.disabled = true;
    closeButton.disabled = true;
    status.textContent = 'Closing; waiting for owned work… / 正在关闭，等待自有工作完成…';
    finish();
  };
  const fail = cause => { retain(cause); requestClose(); };
  const onPageHide = () => requestClose();
  let family;
  let cssFont;

  async function proveSelection(text) {
    // Readiness alone accepts fallback. Match this application's exact face,
    // using a unique family and the retained font's documented X/space subset.
    // FontFaceSet.load has no AbortSignal; shutdown observes its settlement.
    const matches = await document.fonts.load(cssFont, text + 'X');
    if (face.status !== 'loaded' || !document.fonts.has(face)
        || matches.length !== 1 || matches[0] !== face
        || !document.fonts.check(cssFont, text + 'X')) {
      throw new Error('Owned Ahem selection was not established');
    }
  }

  async function prepareAndRender(text) {
    await proveSelection(text);
    if (closing) return;
    field.setRequest({ text, fontFamily: family, fontSize: 20, fontWeight: 400,
      fontStyle: 'normal', lineHeight: 24, locale: 'en', direction: 'ltr',
      density: 1, fillColor: 0x164e99 });
    await field.prepare();
    if (closing) return;
    if (!attached) { engine.stage.addChild(field); attached = true; }
    engine.renderFrame({ width: 320, height: 160, clearColor: 0xffffff, clearAlpha: 1 });
    committed.textContent = text === '' ? '(empty) /（空）' : text;
    status.textContent = 'Owned Ahem selected; explicitly rendered. / 已选择自有 Ahem，已显式渲染。';
  }

  const onSubmit = event => {
    event.preventDefault();
    if (closing || busy) return;
    const text = input.value;
    if (!admittedText(text)) {
      status.textContent = 'Use X/spaces, at most 12 columns × 4 lines. / 请使用 X 与空格，最多 12 列 × 4 行。';
      return;
    }
    busy = true;
    replaceButton.disabled = true;
    status.textContent = 'Preparing replacement… / 正在准备替换…';
    // Exactly one explicit operation, no work queue or automatic retries.
    operation = prepareAndRender(text).catch(fail).finally(() => {
      busy = false;
      replaceButton.disabled = closing;
    });
  };

  form.addEventListener('submit', onSubmit);
  closeButton.addEventListener('click', requestClose);
  window.addEventListener('pagehide', onPageHide);
  try {
    const response = await fetch(new URL('./assets/ahem.ttf', import.meta.url));
    if (!response.ok) throw new Error(`Ahem HTTP status ${response.status}`);
    const fontBytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fontBytes));
    const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== FONT_SHA256) throw new Error('Retained Ahem byte identity mismatch');
    if (closing) return;
    family = `EgretWC1Example_${crypto.randomUUID()}`;
    cssFont = `normal 400 20px "${family}"`;
    face = new FontFace(family, fontBytes, { style: 'normal', weight: '400' });
    await face.load();
    if (closing) return;
    document.fonts.add(face);
    await proveSelection(input.value);
    if (closing) return;

    canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 160;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Ahem test blocks; source text appears above / Ahem 测试方块，原文见上方');
    surface.append(canvas);
    engine = await createEngine({ host: createCanvasHost({ canvas }) });
    if (closing) return;
    scope = engine.createScope();
    cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
    field = createTextField(engine, scope, cache);
    field.x = 24;
    field.y = 24;
    if (!admittedText(input.value)) throw new Error('Initial example text is outside the fixed subset');
    await prepareAndRender(input.value);
    busy = false;
    replaceButton.disabled = closing;
    if (!closing) await closedByCaller;
  } catch (cause) {
    retain(cause);
  } finally {
    requestClose();
    // Keep the font stable until preparation settles; every later cleanup is
    // attempted even after an earlier failure. Explicit Close awaits this path.
    const attempt = async action => { try { await action(); } catch (cause) { retain(cause); } };
    await attempt(() => operation);
    await attempt(() => field?.dispose());
    await attempt(() => scope?.dispose());
    await attempt(() => cache?.dispose());
    await attempt(() => cache?.whenIdle());
    await attempt(() => engine?.dispose());
    await attempt(() => { if (face !== undefined) document.fonts.delete(face); });
    await attempt(() => form.removeEventListener('submit', onSubmit));
    await attempt(() => closeButton.removeEventListener('click', requestClose));
    await attempt(() => window.removeEventListener('pagehide', onPageHide));
    await attempt(() => { if (canvas !== undefined) canvas.width = 0; });
    await attempt(() => { if (canvas !== undefined) canvas.height = 0; });
    await attempt(() => canvas?.remove());
    input.disabled = true;
    if (failed) {
      status.textContent = `Closed with an error; see the console (${laterFailures.length} later errors). / 已关闭但有错误；见控制台（另有 ${laterFailures.length} 个后续错误）。`;
      console.error('Canvas text example first failure:', firstFailure, 'Later failures:', laterFailures);
    } else {
      status.textContent = 'Closed: cache idle, Engine disposed, owned font and surface removed. / 已关闭：缓存空闲、Engine 已释放、自有字体与画布已移除。';
    }
  }
}

await run();
