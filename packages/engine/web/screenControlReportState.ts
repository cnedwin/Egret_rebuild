// SPDX-License-Identifier: Apache-2.0

/** Only the fields observed by the browser screen verifier, not the public semantic tree API. */
export interface ScreenControlSemanticNode {
  readonly name: string;
  readonly role: string;
  readonly actions: readonly string[];
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly disabled: boolean;
  readonly inert: boolean;
}

interface ScreenControlProjection {
  readonly state: 'active' | 'closed';
  readonly snapshot: { readonly nodes: readonly ScreenControlSemanticNode[] };
}

// The named browser accessibility projection owns the real semantic tree and its canvas. Share only that
// live, read-only association with the screen verifier: no tree entry import here, no duplicate tree or
// page-global control API.
const projections = new WeakMap<HTMLCanvasElement, ScreenControlProjection>();

export function registerScreenSemantics(surface: HTMLCanvasElement, semantics: ScreenControlProjection): () => void {
  projections.set(surface, semantics);
  return () => {
    if (projections.get(surface) === semantics) projections.delete(surface);
  };
}

export function screenSemanticsFor(surface: HTMLCanvasElement): ScreenControlProjection | undefined {
  const semantics = projections.get(surface);
  return semantics?.state === 'active' ? semantics : undefined;
}
