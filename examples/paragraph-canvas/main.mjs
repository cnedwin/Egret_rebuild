// SPDX-License-Identifier: Apache-2.0
// The same styled paragraph of Chinese and English laid out twice, with the same Noto fonts: once by the CanvasKit
// provider and once by the canvas provider that needs no WebAssembly. Each engine draws its own; the page compares
// their lines, the boxes of their characters, their selections and their hits, and says how far apart they are.
import { createEngineForProfile, Sprite } from '@egret/engine';
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { createCanvasKitParagraphProvider, createCanvasParagraphProvider } from '@egret/engine/web/paragraph';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';

const status = document.querySelector('#status');
const base = new URL('../paragraph-panel/vendor/', import.meta.url);
const text =
  '洗冤笔录·第一案：河边发现一具男尸，衣着整齐，袖口未湿。Inquest notes: the body lay by the river bank, its sleeves dry. ' +
  '仵作验得颈下有勒痕（约两指宽），死前曾挣扎；“此非溺亡”。The ferryman saw a lantern at midnight.';
const at = words => text.indexOf(words);
const request = {
  text,
  width: 420,
  fontFamilies: ['Noto Sans', 'Noto Sans CJK SC'],
  fontSize: 20,
  lineHeight: 30,
  locale: 'zh',
  direction: 'ltr',
  fillColor: 0xe8eefc,
  density: 1,
  textGeometry: true,
  runs: [
    { start: 0, end: at('：'), fillColor: 0xf0c060 },
    { start: at('Inquest'), end: at('Inquest') + 'Inquest notes'.length, fontSize: 24, fillColor: 0x9fd0ff },
    { start: at('勒痕'), end: at('勒痕') + 2, fillColor: 0xff8080 }
  ]
};

async function engineOn(canvas) {
  const host = createSharedWebGL2Host({ canvas, pixelRatio: 1, outputAlpha: 'opaque', enableReadback: true });
  const engine = await createEngineForProfile({ host }, 'egret.shared-frame2d/1');
  return { host, engine };
}
async function lay(canvas, provider, request) {
  const { engine } = await engineOn(canvas);
  const scope = engine.createScope();
  const cache = createParagraphCache(engine.assets, { provider });
  const paragraph = createParagraph(engine, scope, cache);
  paragraph.setRequest(request);
  const metrics = await paragraph.prepare();
  const holder = scope.use(new Sprite());
  holder.x = 30;
  holder.y = 30;
  holder.addChild(paragraph);
  engine.stage.addChild(holder);
  return { engine, metrics, geometry: paragraph.getStatus().geometry };
}

globalThis.__paragraphCanvas = (async () => {
  const manifest = await (await fetch(new URL('manifest.json', base))).json();
  const fonts = [];
  for (const row of manifest.fonts) {
    if (!request.fontFamilies.includes(row.family)) continue;
    const data = new Uint8Array(await (await fetch(new URL(row.path, base))).arrayBuffer());
    fonts.push({ family: row.family, data, identity: row.sha256 });
    // The same bytes, for the canvas: a page font of the same family name.
    const face = new FontFace(row.family, data);
    document.fonts.add(await face.load());
  }
  const ck = await globalThis.CanvasKitInit({ locateFile: () => new URL(manifest.runtime.wasm, base).href });
  const native = createCanvasKitParagraphProvider({
    canvasKit: ck,
    fonts,
    buildIdentity: manifest.runtime.buildIdentity
  });
  const plain = createCanvasParagraphProvider({
    families: request.fontFamilies,
    buildIdentity: 'noto-' + fonts.map(f => f.identity.slice(0, 8)).join('-')
  });
  const cases = [
    ['styled, with a minimum line height', request],
    ['centred, natural line heights', { ...request, lineHeight: undefined, textAlign: 'center', runs: undefined }],
    ['three lines at most, with an ellipsis', { ...request, maxLines: 3 }]
  ];
  const results = [];
  for (const [name, one] of cases) {
    const clean = Object.fromEntries(Object.entries(one).filter(([, v]) => v !== undefined));
    results.push({ name, ...(await compare(clean)) });
  }
  status.textContent = JSON.stringify(results.map(r => [r.name, r.lineCounts, r.clusterGap.most]));
  return results;
  async function compare(request) {
    const a = await lay(document.createElement('canvas'), native, request);
    const b = await lay(document.createElement('canvas'), plain, request);
    // The two layouts side by side.
    const lines = [a, b].map(side => side.metrics.lines.map(line => text.slice(line.start, line.end)));
    const clusterGap = (() => {
      const byStart = new Map(b.geometry.clusters.map(c => [c.start, c]));
      let most = 0,
        matched = 0;
      for (const c of a.geometry.clusters) {
        const other = byStart.get(c.start);
        if (!other || other.lineIndex !== c.lineIndex) continue;
        matched++;
        most = Math.max(
          most,
          Math.abs(c.left - other.left),
          Math.abs(c.right - other.right),
          Math.abs(c.top - other.top),
          Math.abs(c.bottom - other.bottom)
        );
      }
      return { most, matched, of: a.geometry.clusters.length };
    })();
    const ranges = [
      [0, at('：')],
      [at('Inquest'), at('Inquest') + 13],
      [at('勒痕'), at('挣扎')],
      [at('“'), at('”') + 1],
      [0, text.length]
    ];
    const selections = ranges.map(([start, end]) => {
      const one = a.geometry.getSelectionRects(start, end),
        two = b.geometry.getSelectionRects(start, end);
      let most = 0;
      for (let i = 0; i < Math.min(one.length, two.length); i++)
        for (const key of ['left', 'right', 'top', 'bottom'])
          most = Math.max(most, Math.abs(one[i][key] - two[i][key]));
      return { start, end, rects: [one.length, two.length], most };
    });
    // Hits at the middle of every character the CanvasKit layout has, and between lines.
    let hitsSame = 0,
      hitsNear = 0,
      hitsTotal = 0;
    const hitMisses = [];
    for (const c of a.geometry.clusters) {
      const x = (c.left + c.right) / 2 + 0.25,
        y = (c.top + c.bottom) / 2;
      const one = a.geometry.hitTest(x, y),
        two = b.geometry.hitTest(x, y);
      hitsTotal++;
      if (one.offset === two.offset) hitsSame++;
      else if (Math.abs(one.x - two.x) <= 2) hitsNear++;
      else hitMisses.push({ x, y, canvasKit: one.offset, canvas: two.offset });
    }
    const sample = [0, 4, at('Inquest'), at('勒痕'), at('“'), at('；')].map(start => ({
      start,
      canvasKit: a.geometry.clusters.find(c => c.start === start),
      canvas: b.geometry.clusters.find(c => c.start === start)
    }));
    const differ = a.geometry.clusters
      .map(c => ({ c, o: b.geometry.clusters.find(x => x.start === c.start) }))
      .filter(({ c, o }) => o && Math.abs(c.right - c.left - (o.right - o.left)) > 0.5)
      .map(({ c, o }) => ({ ch: text.slice(c.start, c.end), canvasKit: c.right - c.left, canvas: o.right - o.left }));
    const result = {
      differ,
      sample,
      metricLines: [a.metrics.lines, b.metrics.lines],
      lines,
      lineCounts: [lines[0].length, lines[1].length],
      sameLines: JSON.stringify(lines[0]) === JSON.stringify(lines[1]),
      heights: [a.metrics.height, b.metrics.height],
      clusterGap,
      selections,
      hits: { same: hitsSame, near: hitsNear, total: hitsTotal, misses: hitMisses.slice(0, 8) }
    };
    result.truncated = [a.metrics.truncated, b.metrics.truncated];
    return result;
  }
})();
