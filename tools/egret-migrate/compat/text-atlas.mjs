// SPDX-License-Identifier: Apache-2.0
function invalid(message) {
  return Object.assign(new Error(message), { code: 'LEGACY_TEXT_ATLAS_UNSUPPORTED' });
}
const rgb = n => '#' + n.toString(16).padStart(6, '0');
const whole = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

// Keep a snapshot of the text records. Business code can immediately detach and
// recycle the source fields after drawToTexture returns.
export function captureTextAtlas(root, clip, scale, readField, isContainer) {
  if (
    scale !== 1 ||
    !clip ||
    !whole(clip.x, -4096, 4096) ||
    !whole(clip.y, -4096, 4096) ||
    !whole(clip.width, 0, 2048) ||
    !whole(clip.height, 0, 2048)
  )
    throw invalid('Supply a unit-scale integer clip up to 2048 on each side.');
  if (!clip.width || !clip.height) return false;
  const runs = [];
  let visits = 0,
    units = 0;
  const pending = [[root, -clip.x, -clip.y, true]];
  while (pending.length) {
    const [node, ox, oy, isRoot] = pending.pop();
    if (++visits > 1024 || !node || node.isDisposed) throw invalid('Invalid or oversized text subtree.');
    if (!node.visible) continue;
    if (
      node.alpha !== 1 ||
      node.rotation ||
      node.skewX ||
      node.skewY ||
      node.scaleX !== 1 ||
      node.scaleY !== 1 ||
      node.anchorOffsetX ||
      node.anchorOffsetY ||
      node.mask ||
      node.clipRect ||
      node.renderEffect ||
      node.filters?.length ||
      node.blendMode !== 'normal'
    )
      throw invalid('Text atlas capture supports translated, opaque fields and containers.');
    const x = ox + (isRoot ? 0 : node.x),
      y = oy + (isRoot ? 0 : node.y);
    const plan = readField(node);
    if (!plan) {
      if (!isContainer(node)) throw invalid('Only text fields and plain display containers can be captured.');
      if (pending.length + node.numChildren + visits > 1024) throw invalid('Too many nodes in text atlas.');
      for (let i = node.numChildren - 1; i >= 0; i--) pending.push([node.getChildAt(i), x, y, false]);
      continue;
    }
    for (const part of plan.fragments) {
      if (part.underline) throw invalid('Underlined atlas fragments require a decoration pass.');
      if (runs.length >= 256 || (units += part.text.length) > 8192)
        throw invalid('Text atlas exceeds its run or character limit.');
      const a = part.style;
      runs.push({
        text: part.text,
        x: x + part.x,
        y: y + part.y,
        size: a.fontSize,
        weight: a.fontWeight,
        italic: a.italic,
        fontFamily: a.fontFamily,
        color: rgb(a.color),
        strokeWidth: a.strokeWidth,
        strokeColor: rgb(a.strokeColor),
        maxWidth: Math.max(1, Math.ceil(part.width))
      });
    }
  }
  return { width: clip.width, height: clip.height, runs };
}
export function logicalCrop(page, frame) {
  const { width, height, sourceWidth, sourceHeight, x, y, offsetX, offsetY } = frame;
  if (
    !whole(width, 1, 2048) ||
    !whole(height, 1, 2048) ||
    !whole(x, 0, page.width - width) ||
    !whole(y, 0, page.height - height) ||
    !whole(sourceWidth, 1, 2048) ||
    !whole(sourceHeight, 1, 2048) ||
    sourceWidth * sourceHeight > 1048576 ||
    !whole(offsetX, 0, sourceWidth - width) ||
    !whole(offsetY, 0, sourceHeight - height)
  )
    throw invalid('Invalid or oversized text atlas crop.');
  if (offsetX !== 0 || offsetY !== 0 || sourceWidth !== width || sourceHeight !== height)
    throw invalid('The logical text atlas supports untrimmed child frames.');
  const top = page.height - y - height;
  return page.runs
    .filter(run => {
      // Include possible italic overhang and outline on each side of the pen origin.
      const margin = run.size + run.strokeWidth;
      return (
        run.x + run.maxWidth + margin > x &&
        run.y + run.size + margin > top &&
        run.x - margin < x + width &&
        run.y - margin < top + height
      );
    })
    .map(run => ({ ...run, x: run.x - x, y: run.y - top }));
}
export function browserAtlasRaster(doc, game, width, height, runs) {
  const c = doc.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw invalid('Canvas text raster is unavailable.');
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const r of runs) {
    ctx.font = (r.italic ? 'italic ' : '') + r.weight + ' ' + r.size + 'px ' + r.fontFamily;
    const y = r.y + r.size / 2;
    if (r.strokeWidth) {
      ctx.strokeStyle = r.strokeColor;
      ctx.lineWidth = r.strokeWidth * 2;
      ctx.strokeText(r.text, r.x, y, r.maxWidth);
    }
    ctx.fillStyle = r.color;
    ctx.fillText(r.text, r.x, y, r.maxWidth);
  }
  return game.textureFromCanvas(c);
}
export function nativeAtlasRaster(raster, width, height, runs) {
  const metrics = raster.measureTextInk(runs);
  return raster.acquireText(
    width,
    height,
    runs.map((r, i) => ({ ...r, y: r.y + r.size / 2 - (metrics[i].ascent + metrics[i].descent) / 2 }))
  );
}
