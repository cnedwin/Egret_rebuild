// Private collector console classification; no browser, product or environment dependency.
// This exact Canvas suggestion is recorded, never interpreted as performance evidence.
const canvasReadbackAdvisory = "Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently";
export function classifyConsoleMessage(backend, level, text) {
  if (backend === 'canvas' && level === 'warning' && text === canvasReadbackAdvisory) return 'advisory';
  return level === 'warning' || level === 'error' ? 'fatal' : 'unrecorded';
}
