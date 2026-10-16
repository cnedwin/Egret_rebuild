// SPDX-License-Identifier: Apache-2.0
/** Caller-authored dimensions in the intended local coordinate system. */
export interface LinearLayoutItem {
  readonly width: number;
  readonly height: number;
}

/** Explicit membership and spacing; omitted optional values use planner defaults. */
export interface LinearLayoutOptions {
  readonly axis: 'horizontal' | 'vertical';
  readonly items: readonly LinearLayoutItem[];
  readonly gap?: number;
  readonly padding?: number;
  readonly crossAlign?: 'start' | 'center' | 'end';
}

/** A rectangle origin and captured dimensions, without a display-object reference. */
export interface LinearLayoutPlacement {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Immutable numeric result; applying it to a scene remains the caller's operation. */
export interface LinearLayoutPlan {
  readonly width: number;
  readonly height: number;
  readonly placements: readonly LinearLayoutPlacement[];
}
