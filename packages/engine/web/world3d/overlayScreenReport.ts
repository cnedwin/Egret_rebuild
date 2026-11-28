// SPDX-License-Identifier: Apache-2.0
// World3D UI control geometry for the same native screen-tool protocol used by play.
import type { BrowserGame } from '../game.js';
import type { ScreenRect } from '../screen.js';
import { screenSemanticsFor } from '../screenControlReportState.js';
import { collectNativeScreenControls, screenIntersection, usefulScreenRect } from '../screenControlGeometry.js';
import type { NativeScreenControl } from '../screenControlGeometry.js';

interface ScreenAgent {
  readonly insets?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  readonly controls?: (controls: readonly NativeScreenControl[], screen: { safe: ScreenRect; canvas: ScreenRect }) => void;
}
const tool = (): ScreenAgent | undefined => (globalThis as { readonly __egretAgent?: ScreenAgent }).__egretAgent;
function asRect(box: DOMRect): ScreenRect {
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}
function report(game: BrowserGame, surface: HTMLCanvasElement, scene: HTMLCanvasElement, agent: ScreenAgent): void {
  const canvas = asRect(surface.getBoundingClientRect());
  if (!usefulScreenRect(canvas)) return;
  const stage = game.screen;
  const across = canvas.width / stage.width,
    down = canvas.height / stage.height;
  const page = (r: ScreenRect): ScreenRect => ({
    x: canvas.x + r.x * across,
    y: canvas.y + r.y * down,
    width: r.width * across,
    height: r.height * down
  });
  const claims = screenSemanticsFor(surface)?.snapshot.nodes;
  const controls = collectNativeScreenControls({
    stage: game.stage,
    pointer: game.pointer,
    page,
    canvas,
    rawTargets: true,
    ...(claims === undefined ? {} : { claims })
  });
  let safe = screenIntersection(page(stage.safe), asRect(scene.getBoundingClientRect()));
  const view = surface.ownerDocument.defaultView,
    insets = agent.insets;
  if (
    view !== null &&
    insets !== undefined &&
    [insets.left, insets.top, insets.right, insets.bottom].every(Number.isFinite)
  ) {
    safe = screenIntersection(safe, {
      x: insets.left,
      y: insets.top,
      width: Math.max(0, view.innerWidth - insets.left - insets.right),
      height: Math.max(0, view.innerHeight - insets.top - insets.bottom)
    });
  }
  agent.controls?.(controls, { safe, canvas });
}
/** The tool needs fresh receipts even while an unchanged on-demand overlay has no draw to submit. */
export function createOverlayScreenReporter(
  game: BrowserGame,
  surface: HTMLCanvasElement,
  scene: HTMLCanvasElement
): () => void {
  try {
    const view = surface.ownerDocument.defaultView;
    if (view === null || typeof tool()?.controls !== 'function') return () => {};
    const signal = game.scope.signal;
    let interval: number | undefined,
      stopped = false;
    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      if (interval !== undefined) view.clearInterval(interval);
      signal.removeEventListener('abort', stop);
    };
    const tell = (): void => {
      if (stopped) return;
      try {
        const agent = tool();
        if (agent && typeof agent.controls === 'function' && surface.isConnected) report(game, surface, scene, agent);
      } catch {
        // A tooling observation must never fail the native interface or its cleanup.
      }
    };
    try {
      interval = view.setInterval(tell, 250);
      signal.addEventListener('abort', stop, { once: true });
      if (signal.aborted) stop();
      else tell();
    } catch {
      stop();
    }
    return stop;
  } catch {
    // A page with a refused tool adapter still gets an ordinary working overlay.
    return () => {};
  }
}
