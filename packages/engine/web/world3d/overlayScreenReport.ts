// SPDX-License-Identifier: Apache-2.0
// World3D UI control geometry for the same native screen-tool protocol used by play.
import { DisplayObjectContainer } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { BrowserGame } from '../game.js';
import type { ScreenRect } from '../screen.js';
import { screenSemanticsFor } from '../screenControlReportState.js';
import type { ScreenControlSemanticNode } from '../screenControlReportState.js';

interface Candidate {
  readonly node: DisplayObject;
  readonly hit: ScreenRect;
  readonly visual?: ScreenRect;
  readonly shown: boolean;
}

interface ControlRect extends ScreenRect {
  readonly name: string;
}

interface ScreenAgent {
  readonly insets?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  readonly controls?: (controls: readonly ControlRect[], screen: { safe: ScreenRect; canvas: ScreenRect }) => void;
}

const tool = (): ScreenAgent | undefined => (globalThis as { readonly __egretAgent?: ScreenAgent }).__egretAgent;
const useful = (rect: ScreenRect): boolean =>
  Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
function intersection(a: ScreenRect, b: ScreenRect): ScreenRect {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y)
  };
}
function onStage(node: DisplayObject, local: ScreenRect): ScreenRect {
  const right = local.x + local.width,
    bottom = local.y + local.height;
  const corners = [
    node.localToGlobal(local.x, local.y),
    node.localToGlobal(right, local.y),
    node.localToGlobal(local.x, bottom),
    node.localToGlobal(right, bottom)
  ];
  const xs = corners.map(point => point.x),
    ys = corners.map(point => point.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const actionable = (node: ScreenControlSemanticNode): boolean =>
  node.actions.includes('activate') ||
  (['slider', 'scrollbar', 'spinbutton', 'textbox'].includes(node.role) && node.actions.includes('focus'));
const sameRect = (one: ScreenRect, other: ScreenRect): boolean =>
  Math.abs(one.x - other.x) <= 1e-6 &&
  Math.abs(one.y - other.y) <= 1e-6 &&
  Math.abs(one.width - other.width) <= 1e-6 &&
  Math.abs(one.height - other.height) <= 1e-6;

/**
 * Native targets, in back-to-front order. An explicit hit area is authoritative even when a focus
 * outline or a shadow makes the drawn bounds larger. Clip rectangles restrict the area, and
 * touchChildren:false prevents descendants from being picked. For transformed/implicit content,
 * the report is the axis-aligned envelope of the actual authored/local geometry.
 */
function candidates(stage: DisplayObjectContainer, withSemantics: boolean): Candidate[] {
  const seen: Candidate[] = [];
  const pending: { node: DisplayObject; clipped?: ScreenRect; shown: boolean }[] = [{ node: stage, shown: true }];
  while (pending.length) {
    const { node, clipped: parentClip, shown: parentShown } = pending.pop()!;
    if (node.isDisposed || !node.visible) continue;
    let clipped = parentClip;
    const clip = node.clipRect;
    if (clip !== undefined) {
      const stageClip = onStage(node, clip);
      clipped = clipped === undefined ? stageClip : intersection(clipped, stageClip);
      if (!useful(clipped)) continue;
    }
    const shown = parentShown && node.alpha > 0;
    if (node !== stage && node.touchEnabled) {
      const bounds = node.hitArea ?? node.getBounds();
      // A zero authored area stays unpickable, rather than silently substituting the artwork.
      if (useful(bounds)) {
        const stageHit = onStage(node, bounds);
        const hit = clipped === undefined ? stageHit : intersection(stageHit, clipped);
        if (useful(hit)) {
          const visual = withSemantics ? onStage(node, node.getBounds()) : undefined;
          seen.push({ node, hit, shown, ...(visual === undefined ? {} : { visual }) });
        }
      }
    }
    if (node instanceof DisplayObjectContainer && node.touchChildren !== false)
      for (let index = node.numChildren - 1; index >= 0; index--)
        pending.push({ node: node.getChildAt(index), ...(clipped === undefined ? {} : { clipped }), shown });
  }
  return seen;
}

function asRect(box: DOMRect): ScreenRect {
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

function report(game: BrowserGame, surface: HTMLCanvasElement, scene: HTMLCanvasElement, agent: ScreenAgent): void {
  const canvas = asRect(surface.getBoundingClientRect());
  if (!useful(canvas)) return;
  const stage = game.screen;
  const across = canvas.width / stage.width,
    down = canvas.height / stage.height;
  const page = (r: ScreenRect): ScreenRect => ({
    x: canvas.x + r.x * across,
    y: canvas.y + r.y * down,
    width: r.width * across,
    height: r.height * down
  });
  const claims = screenSemanticsFor(surface)?.snapshot.nodes.filter(actionable);
  const seen = candidates(game.stage, claims !== undefined);
  const whole = (r: ScreenRect): boolean => {
    const rect = page(r);
    return (
      rect.x <= canvas.x + 1 &&
      rect.y <= canvas.y + 1 &&
      rect.x + rect.width >= canvas.x + canvas.width - 1 &&
      rect.y + rect.height >= canvas.y + canvas.height - 1
    );
  };
  // A full-stage pointer surface (for example a modal backdrop) is not itself a button, but it blocks
  // the scene and everything below it. A later child/foreground control stays in the report.
  let barrier = -1;
  for (let index = 0; index < seen.length; index++) if (whole(seen[index]!.hit)) barrier = index;
  const controls: ControlRect[] = [];
  for (let index = barrier + 1; index < seen.length; index++) {
    const item = seen[index]!;
    if (!item.shown || whole(item.hit)) continue;
    // semanticBoundsOf() describes the actual node's painted AABB. Match that geometry only for names
    // and modal/disabled state; size and position below always come from the native hit area.
    const matches =
      claims?.filter(
        claim => (item.visual !== undefined && sameRect(claim.bounds, item.visual)) || sameRect(claim.bounds, item.hit)
      ) ?? [];
    const match = matches.length === 1 ? matches[0] : undefined;
    if (match?.inert || match?.disabled) continue;
    // A semantic interface tells which native targets are controls; anonymous pointer-only panels are
    // intentionally not reported as buttons. Native named targets still report without a semantic claim.
    if (claims !== undefined && claims.length > 0 && match === undefined && item.node.name === '') continue;
    controls.push({ name: match?.name ?? item.node.name, ...page(item.hit) });
  }
  let safe = intersection(page(stage.safe), asRect(scene.getBoundingClientRect()));
  const view = surface.ownerDocument.defaultView,
    insets = agent.insets;
  if (
    view !== null &&
    insets !== undefined &&
    [insets.left, insets.top, insets.right, insets.bottom].every(Number.isFinite)
  ) {
    safe = intersection(safe, {
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
