# Local linear-layout planner specification

English | [简体中文](../../Cns/docs/local-linear-layout-spec.md)

Engineering preview **0.55.0** provides an optional planner that turns caller-authored dimensions into local rectangle placements. Callers select membership and apply the result. This document defines the exact behavior; recorded results and limits are in the [evidence record](local-linear-layout-evidence.md).

## Purpose

A caller-authored Button menu needs consistent local rectangle placement before existing Engine, Scope, resource, picking, capture and Host APIs apply and display the result. An explicit pure planner provides this bounded utility. Automatic ancestor layout and complete UI acceptance remain open. Resource replacement has a separate asynchronous publication and ownership contract.

## Constraints and design

Automatic scene-tree layout requires lifetime, invalidation and bounds policies. This planner instead accepts explicit numeric records: the caller selects membership, invokes planning and applies the result through existing display APIs. It does not own a scene, resource, handle or render clock.

Only the optional built public entry `@egret/engine/layout` exposes the runtime function `planLinearLayout` and four erased interfaces. The default, web and runtime entry surfaces and SDK Host protocol retain their existing contracts. The layout runtime imports only genuine `EgretError` from `@egret/runtime`; it adds no dependency, global registry or mutable global call state. The function is receiver independent.

```ts
interface LinearLayoutItem {
  readonly width: number;
  readonly height: number;
}
interface LinearLayoutOptions {
  readonly axis: 'horizontal' | 'vertical';
  readonly items: readonly LinearLayoutItem[];
  readonly gap?: number;
  readonly padding?: number;
  readonly crossAlign?: 'start' | 'center' | 'end';
}
interface LinearLayoutPlacement {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
interface LinearLayoutPlan {
  readonly width: number;
  readonly height: number;
  readonly placements: readonly LinearLayoutPlacement[];
}
function planLinearLayout(options: LinearLayoutOptions): LinearLayoutPlan;
```

## Ordered observations and validation

An options or item record is a non-null object excluding arrays and functions. Inherited properties, class instances and ordinary Proxy-backed records are accepted. Unknown fields are ignored without enumeration. There is no iterable protocol or coercion.

1. Validate the options record; read `axis` once and require the exact horizontal/vertical string.
2. Read `items` once and require `Array.isArray(items)`. Read its `length` once. The observed value must be a number, finite integer in 0..2^32−1; otherwise throw `LAYOUT_OPTIONS_INVALID`. A valid observed length above 4096 throws `LAYOUT_LIMIT` before any optional field or item is read. This captured upper bound also governs a Proxy array.
3. Read and validate `gap`, then `padding`, then `crossAlign`, exactly once each. Only undefined defaults: gap=0, padding=0, crossAlign=start. Null and all other invalid scalars fail.
4. For index 0 through captured length−1, ordinary Get the slot once, validate its item record, read/validate width once, then read/validate height once. Each dimension, gap and padding must be a finite number >=0; canonicalize every −0 to +0. The first invalid observation stops all later reads.

All ordered reads and scalar validation finish **before any arithmetic**, including doubled padding. Thus a later invalid value or throwing getter wins over an earlier combination that would overflow. Every thrown property read is wrapped in a fresh genuine `EgretError('LAYOUT_OPTIONS_INVALID', {cause})`, retaining the exact original thrown value, including undefined. A classification operation that itself throws (for example a revoked Proxy in Array.isArray) uses the same wrapper/cause rule. Invalid scalars use the same code; no later field is consulted.

## Snapshot and reentrancy policy

This is an ordered numeric snapshot, not an atomic snapshot of user objects. Captured items reference and length are fixed. A future index replacement, inherited-slot change or future dimension mutation is observed when that Get occurs. A previously captured number is never reread. Within one item, replacing its array slot during width's getter does not replace the captured item reference used for height. Holes resolve through ordinary inheritance; an unresolved hole yields undefined and fails. Growth beyond the captured length is ignored; shrinkage can make a later ordinary Get fail validation.

Reentrant calls have separate capture arrays/cursors/results; no outer-call partial state is published or shared. Getter side effects belong to caller code and are not rolled back. The planner never writes inputs, positions, tree membership, visibility or handles.

## Exact binary64 computation and result

After all captures succeed, use JavaScript binary64 in this order, without reassociation, compensated sums, integer rounding or epsilon adjustment:

1. Set main cursor to padding. In item order, record this item's main position, set cursor=cursor+mainSize, then, only if another item follows, cursor=cursor+gap. Close with mainExtent=cursor+padding.
2. Scan captured cross sizes in order, starting maxCross=+0, replacing it only when crossSize>maxCross. Compute crossExtent=(maxCross+padding)+padding, as two additions.
3. In item order choose cross position: start=padding; center=padding+((maxCross−crossSize)/2); end=padding+(maxCross−crossSize). Subtraction, division and addition retain that grouping. Horizontal maps main/cross to x/y and width/height; vertical maps them to y/x and height/width.

Check every arithmetic intermediate for finiteness and throw genuine `EgretError('LAYOUT_OVERFLOW')` on the first nonfinite value. Do not publish a partial result. Empty input still computes both padding additions and returns an empty placements array; excessive padding can overflow even with zero items.

Return a fresh ordinary frozen plan, a fresh frozen placements array and a fresh frozen row per item, in input order. Exact plan keys: width,height,placements; row keys: index,x,y,width,height. No input/item aliases are retained in the result. All returned zeros are +0; repeated empty calls also produce distinct envelopes/arrays.

Literal examples:
- Horizontal center, [(8,6),(4,2)], gap2,padding1: extent (16,8); rows (index,x,y,width,height) = (0,1,1,8,6),(1,11,3,4,2).
- Vertical end with those items/gap/padding: extent (10,12); rows (0,1,1,8,6),(1,5,9,4,2).
- Empty,padding3: extent (6,6), no rows. One (2,4),padding2: extent (6,8), row (0,2,2,2,4).
- Horizontal widths [1e16,1,1], zero gap/padding: main extent 1e16 under the prescribed left-to-right additions; reassociation must not produce 10000000000000002.

## Use

Import the built public entry after building the SDK:

```ts
import {planLinearLayout} from '@egret/engine/layout';

const plan = planLinearLayout({
  axis: 'horizontal',
  items: [{width: 8, height: 6}, {width: 4, height: 2}],
  gap: 2,
  padding: 1,
  crossAlign: 'center',
});
// plan.width === 16; plan.height === 8
// plan.placements[1] is {index: 1, x: 11, y: 3, width: 4, height: 2}.
```

The caller authors dimensions, filters excluded records, recomputes when membership or direction changes, and applies placements in the intended local coordinate system. Placements are rectangle origins; nonzero pivots require an explicit caller offset. The planner provides no text measurement, bounds discovery, automatic visibility filtering, tree walking or transactional scene commit.

The original `examples/linear-layout` application composes two existing Buttons with gap 2, padding 2 and start alignment. It plans completely before writing scene positions. A rejected `gap: -1` therefore retains the last valid plan and scene through caller ordering. Saved horizontal replay submits a captured frame while live layout state can remain vertical, filtered or reordered.

## Acceptance and limits

Public fixtures consume emitted package entries and check literal layouts, cap boundaries, ordered reads and exact causes, snapshot mutation, reentrancy, immutable fresh results and binary64 grouping. Composition checks use genuine Engine, Scope, resource, input and Button objects with controlled ports; those checks establish no native browser behavior.

Actual Canvas/WebGPU acceptance requires the separately frozen literal full-RGBA schedule, real primary mouse routing, saved/live presentations, owner retirement and Engine close. Every WebGPU presentation must arm and await its genuine readback, including the ancillary startup frame. A fresh Canvas wrong-expectation control must fail independently with zero main acceptance credit. The schedule is source material until actually executed; its planned counts are not observed results.

This increment does not establish automatic EUI layout, flex/constraints/autosize, text/fonts/IME, virtual lists, scrolling/focus/keyboard/touch, full Spine, migration, advanced 3D, phone performance, Native SDK or general host acceptance. Current completed and pending checks are recorded in the [evidence record](local-linear-layout-evidence.md).
