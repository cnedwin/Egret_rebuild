// SPDX-License-Identifier: Apache-2.0
// Intentional unsuppressed refusals; actual diagnostics are collected separately.
import { DisplayObject, NineSliceBitmap } from '@egret/engine';
import type { AssetLease, NineSliceBitmapOptions, Texture } from '@egret/engine';
declare const lease: AssetLease<Texture>;
declare const unknownLease: AssetLease<unknown>;
declare const panel: NineSliceBitmap;
const options: NineSliceBitmapOptions = { width: 16, height: 12, insets: { left: 2, top: 2, right: 2, bottom: 2 } };

// NLB_TYPE_CASE NLB-N01: invariant unknown resource entitlement is not a Texture lease.
new NineSliceBitmap(unknownLease, options);
// NLB_TYPE_CASE NLB-N02: a Texture value is not a lease.
new NineSliceBitmap(lease.value, options);
// NLB_TYPE_CASE NLB-N03: options are required.
new NineSliceBitmap(lease);
// NLB_TYPE_CASE NLB-N04: no provider/mode argument exists.
new NineSliceBitmap(lease, options, {});
// NLB_TYPE_CASE NLB-N05: primitive numeric target dimensions are typed.
new NineSliceBitmap(lease, { width: '16', height: 12, insets: options.insets });
// NLB_TYPE_CASE NLB-N06: fixed insets are required.
new NineSliceBitmap(lease, { width: 16, height: 12 });
// NLB_TYPE_CASE NLB-N07: all four borders are required.
new NineSliceBitmap(lease, { width: 16, height: 12, insets: { left: 2, top: 2, right: 2 } });
// NLB_TYPE_CASE NLB-N08: resize requires both dimensions.
panel.resize(12);
// NLB_TYPE_CASE NLB-N09: resize does not coerce a string.
panel.resize('12', 16);
// NLB_TYPE_CASE NLB-N10: committed target metadata is readonly.
panel.targetWidth = 4;
// NLB_TYPE_CASE NLB-N11: the borrowed Texture lease cannot be replaced.
panel.textureLease = lease;
// NLB_TYPE_CASE NLB-N12: fixed border metadata is readonly.
panel.insets.left = 1;
// NLB_TYPE_CASE NLB-N13: an ordinary display object does not supply nominal leaf identity.
const forged: NineSliceBitmap = new DisplayObject();
// NLB_TYPE_CASE NLB-N14: arbitrary geometry replacement is absent.
panel.setContent(lease, {});
// NLB_TYPE_CASE NLB-N15: atlas crop mutation is absent.
panel.sourceRect = { x: 0, y: 0, width: 1, height: 1 };
// NLB_TYPE_CASE NLB-N16: default-core consumers have no DOM ambient globals.
document.createElement('canvas');
// NLB_TYPE_CASE NLB-N17: types[] admits no Node ambient globals.
process.exitCode = 0;
void forged;
