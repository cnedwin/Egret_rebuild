// SPDX-License-Identifier: Apache-2.0
// What a shared frame draws, row by row, for tests that assert what the display tree shows.
// Barriers are left out. A rectangle's alpha is its opacity times its fill alpha, in that order,
// which is the arithmetic of the capture. An image or mesh names its page and the packed
// rectangle of its region. Every row also carries its command of the frame as `shared`, which
// is not enumerable, so a row still compares equal to a literal of the members above.
const freeze = Object.freeze;

/** Rows of the draws of a captured shared frame, with the images its pages hold. */
export function drawnFrame(frame) {
  const commands = [];
  for (const command of frame.commands) {
    if (command.kind === 'barrier') continue;
    const { kind, matrix, clips } = command;
    let row;
    if (kind === 'rect') row = { kind, matrix, rect: command.rect, color: command.fillColor, alpha: command.opacity * command.fillAlpha, clips };
    else {
      const region = frame.regions[command.regionIndex];
      const place = { alpha: command.opacity, clips, imageIndex: region.pageIndex, sourceRect: region.packed };
      row = kind === 'image' ? { kind, matrix, rect: command.rect, ...place } : { kind, matrix, ...place, geometryIndex: command.geometryIndex };
    }
    Object.defineProperty(row, 'shared', { value: command });
    commands.push(freeze(row));
  }
  return freeze({
    frameId: frame.frameId, width: frame.width, height: frame.height, clearColor: frame.clearColor, clearAlpha: frame.clearAlpha,
    commands: freeze(commands), images: freeze(frame.pages.map(page => page.source)), geometries: frame.geometries, frame,
  });
}

/** Capture the Stage of an Engine and describe what it draws. */
export function captureDrawn(engine, options) {
  return drawnFrame(engine.captureSharedFrame(options));
}
