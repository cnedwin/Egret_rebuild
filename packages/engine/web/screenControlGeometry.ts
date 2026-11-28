// SPDX-License-Identifier: Apache-2.0
// Shared diagnostics for Play and World3D native interfaces. No effect on
// drawing, input ownership or frame maintenance outside a tooling receipt.
import { DisplayObjectContainer } from '@egret/runtime';
import { screenControlFor, screenOccludersFor } from '#egret-pointer-input';
import type { DisplayObject } from '@egret/runtime';
import type { BrowserGame } from './game.js';
import type { ScreenRect } from './screen.js';
import type { ScreenControlSemanticNode } from './screenControlReportState.js';

export interface NativeScreenControl extends ScreenRect {
  readonly name: string;
  /** Receipt-local identity and actual native display ancestors. */
  readonly id: string;
  readonly ancestors: readonly string[];
  /** Full authored hit envelope when an actual native clip trims the visible target. */
  readonly authored?: ScreenRect;
  /** A different native input surface was picked inside the overlap. */
  readonly blockedBy?: string;
  /** Explicit, unrelated painted faces drawn later over this target. Not pixel-level proof. */
  readonly coveredBy?: readonly string[];
}
interface Candidate {
  readonly node: DisplayObject;
  readonly id: string;
  readonly ancestors: readonly string[];
  readonly order: number;
  readonly local: ScreenRect;
  readonly hit: ScreenRect;
  readonly authored: ScreenRect;
  readonly clip?: ScreenRect;
  readonly shown: boolean;
}
interface Paint {
  readonly id: string;
  readonly ancestors: readonly string[];
  readonly order: number;
  readonly name: string;
  readonly rect: ScreenRect;
}

export const usefulScreenRect = (rect: ScreenRect): boolean =>
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;
export function screenIntersection(a: ScreenRect, b: ScreenRect): ScreenRect {
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
    ys = corners.map(point => point.y),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
const same = (a: ScreenRect, b: ScreenRect): boolean =>
  Math.abs(a.x - b.x) <= 1e-6 &&
  Math.abs(a.y - b.y) <= 1e-6 &&
  Math.abs(a.width - b.width) <= 1e-6 &&
  Math.abs(a.height - b.height) <= 1e-6;
const related = (
  a: { id: string; ancestors: readonly string[] },
  b: { id: string; ancestors: readonly string[] }
): boolean => a.id === b.id || a.ancestors.includes(b.id) || b.ancestors.includes(a.id);
const area = (r: ScreenRect): number => r.width * r.height;
const actionableRoles = new Set([
  'button',
  'checkbox',
  'switch',
  'radio',
  'option',
  'slider',
  'scrollbar',
  'spinbutton',
  'textbox',
  'tab',
  'menuitem'
]);
const structuralRoles = new Set(['gridcell', 'columnheader', 'treeitem']);
const actionable = (node: ScreenControlSemanticNode): boolean =>
  node.actions.includes('activate') || actionableRoles.has(node.role);

function walk(stage: BrowserGame['stage']): { candidates: Candidate[]; paints: Paint[] } {
  const candidates: Candidate[] = [],
    paints: Paint[] = [];
  const pending: {
    node: DisplayObject;
    id: string;
    ancestors: readonly string[];
    clipped?: ScreenRect;
    alpha: number;
    pickable: boolean;
  }[] = [{ node: stage, id: '0', ancestors: [], alpha: 1, pickable: true }];
  let order = 0;
  while (pending.length > 0) {
    const { node, id, ancestors, clipped: parentClip, alpha: parentAlpha, pickable } = pending.pop()!;
    if (node.isDisposed || !node.visible) continue;
    const alpha = parentAlpha * node.alpha,
      here = order++;
    let clipped = parentClip;
    const clip = node.clipRect;
    if (clip !== undefined) {
      const stageClip = onStage(node, clip);
      clipped = clipped === undefined ? stageClip : screenIntersection(clipped, stageClip);
      if (!usefulScreenRect(clipped)) continue;
    }
    if (alpha > 0)
      for (const claim of screenOccludersFor(node)) {
        const transformed = onStage(node, claim.rect),
          rect = clipped === undefined ? transformed : screenIntersection(transformed, clipped);
        if (usefulScreenRect(rect)) paints.push({ id, ancestors, order: here, name: claim.name, rect });
      }
    if (node !== stage && pickable && node.touchEnabled) {
      const local = node.hitArea ?? node.getBounds();
      if (usefulScreenRect(local)) {
        const authored = onStage(node, local),
          hit = clipped === undefined ? authored : screenIntersection(authored, clipped);
        if (usefulScreenRect(hit))
          candidates.push({
            node,
            id,
            ancestors,
            order: here,
            local,
            hit,
            authored,
            ...(clipped === undefined ? {} : { clip: clipped }),
            shown: alpha > 0
          });
      }
    }
    // Non-pickable descendants can still paint an explicitly declared face.
    if (node instanceof DisplayObjectContainer)
      for (let index = node.numChildren - 1; index >= 0; index--)
        pending.push({
          node: node.getChildAt(index),
          id: id + '/' + index,
          ancestors: [...ancestors, id],
          ...(clipped === undefined ? {} : { clipped }),
          alpha,
          pickable: pickable && node.touchChildren !== false
        });
  }
  return { candidates, paints };
}
function matchingClaims(
  item: Candidate,
  claims: readonly ScreenControlSemanticNode[] | undefined
): readonly ScreenControlSemanticNode[] {
  if (claims === undefined) return [];
  // Use the semantic painted extent only to find the name/state. The actual
  // report uses the native hit extent, even for a larger focus outline.
  const visual = onStage(item.node, item.node.getBounds()),
    exposed = item.clip === undefined ? visual : screenIntersection(visual, item.clip);
  return claims.filter(
    claim =>
      same(claim.bounds, item.hit) ||
      same(claim.bounds, item.authored) ||
      same(claim.bounds, visual) ||
      same(claim.bounds, exposed)
  );
}
function contains(node: DisplayObject, local: ScreenRect, x: number, y: number): boolean {
  try {
    const p = node.globalToLocal(x, y);
    return p.x >= local.x && p.x < local.x + local.width && p.y >= local.y && p.y < local.y + local.height;
  } catch {
    return false;
  }
}
function clipAllows(node: DisplayObject, x: number, y: number): boolean {
  for (let at: DisplayObject | undefined = node; at !== undefined; at = at.parent) {
    const clip = at.clipRect;
    if (clip !== undefined && !contains(at, clip, x, y)) return false;
  }
  return true;
}

export function collectNativeScreenControls(options: {
  readonly stage: BrowserGame['stage'];
  readonly pointer: BrowserGame['pointer'];
  readonly claims?: readonly ScreenControlSemanticNode[];
  readonly page: (rect: ScreenRect) => ScreenRect;
  readonly canvas: ScreenRect;
  /** Controls installed through the older Play onTap/gesture entry. */
  readonly legacyName?: (node: DisplayObject) => string | undefined;
  /** Old overlay code may set a raw named touch target without a control object. */
  readonly rawTargets?: boolean;
}): readonly NativeScreenControl[] {
  const { stage, pointer, claims, page, canvas } = options;
  const { candidates, paints } = walk(stage);
  const whole = (r: ScreenRect): boolean => {
    const rect = page(r);
    return (
      rect.x <= canvas.x + 1 &&
      rect.y <= canvas.y + 1 &&
      rect.x + rect.width >= canvas.x + canvas.width - 1 &&
      rect.y + rect.height >= canvas.y + canvas.height - 1
    );
  };
  // A full-stage modal backdrop is an intentional input barrier, not itself
  // a control. Ancestor preorder leaves its own foreground children intact.
  let barrier = -1;
  for (const item of candidates) if (whole(item.hit)) barrier = item.order;
  const controls: { item: Candidate; name: string }[] = [];
  const all = new Map<DisplayObject, Candidate>();
  for (const item of candidates) all.set(item.node, item);
  for (const item of candidates) {
    if (item.order <= barrier || !item.shown || whole(item.hit)) continue;
    const native = pointer === undefined ? undefined : screenControlFor(pointer, item.node);
    if (native?.enabled === false) continue;
    const matches = matchingClaims(item, claims),
      possible = matches.filter(
        claim => actionable(claim) || (native !== undefined && structuralRoles.has(claim.role))
      ),
      match = possible.length === 1 ? possible[0] : undefined;
    if (match?.inert || match?.disabled) continue;
    // Native registrations and actionable semantics are authoritative.
    // Non-actionable semantic holders, even named pointer-only backgrounds,
    // should not become controls merely because they draw or catch taps.
    const legacy = options.legacyName?.(item.node);
    if (native === undefined && match === undefined) {
      if (matches.length > 0) continue;
      if (legacy === undefined && !(options.rawTargets && (claims === undefined || item.node.name !== ''))) continue;
    }
    controls.push({ item, name: match?.name || legacy || item.node.name || (native ? native.kind + ' control' : '') });
  }
  const known = new Set(controls.map(control => control.item.node));
  return controls.map(({ item, name }) => {
    const rect = page(item.hit);
    // Verify an actual interception only where an unrelated later native
    // target overlaps. This avoids probing every node on every tool tick.
    let blockedBy: string | undefined;
    for (const blocker of candidates) {
      if (blocker.order <= item.order || related(item, blocker) || known.has(blocker.node) || whole(blocker.hit))
        continue;
      const overlap = screenIntersection(item.hit, blocker.hit);
      if (area(page(overlap)) <= 1) continue;
      const x = overlap.x + overlap.width / 2,
        y = overlap.y + overlap.height / 2;
      if (!contains(item.node, item.local, x, y) || !clipAllows(item.node, x, y)) continue;
      try {
        const picked = stage.hitTest(x, y);
        if (picked !== undefined && picked === blocker.node && all.has(picked)) {
          blockedBy = picked.name || 'native input surface';
          break;
        }
      } catch {
        // A refused pick is no evidence of an interception.
      }
    }
    const coveredBy = [
      ...new Set(
        paints
          .filter(
            paint =>
              paint.order > item.order && !related(item, paint) && area(screenIntersection(rect, page(paint.rect))) > 1
          )
          .map(paint => paint.name)
      )
    ];
    return {
      name,
      id: item.id,
      ancestors: item.ancestors,
      ...rect,
      ...(same(item.hit, item.authored) ? {} : { authored: page(item.authored) }),
      ...(blockedBy === undefined ? {} : { blockedBy }),
      ...(coveredBy.length === 0 ? {} : { coveredBy })
    };
  });
}
