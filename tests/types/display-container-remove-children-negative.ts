// SPDX-License-Identifier: Apache-2.0
// Assigned rejected consumers; freeze actual unsuppressed diagnostics later.
import { DisplayObject, DisplayObjectContainer } from '@egret/engine';
// DCA_TYPE_CASE DCA-N01: no standalone root function is added.
import { removeChildren } from '@egret/engine';
declare const root: DisplayObjectContainer;
declare const leaf: DisplayObject;
// DCA_TYPE_CASE DCA-N02: indexed removal is not this zero-argument method.
root.removeChildren(0);
// DCA_TYPE_CASE DCA-N03: a begin/end range is not declared.
root.removeChildren(0, 2);
// DCA_TYPE_CASE DCA-N04: no options descriptor exists.
root.removeChildren({ dispose: true });
// DCA_TYPE_CASE DCA-N05: the operation returns void rather than a count.
const count: number = root.removeChildren();
// DCA_TYPE_CASE DCA-N06: no child array is returned or exposed.
const children: readonly DisplayObject[] = root.removeChildren();
// DCA_TYPE_CASE DCA-N07: ordinary leaves do not gain the container member.
leaf.removeChildren();
// DCA_TYPE_CASE DCA-N08: no mutable children property is introduced.
root.children = [];
// DCA_TYPE_CASE DCA-N09: the default-core lane admits no DOM globals.
document.createElement('canvas');
// DCA_TYPE_CASE DCA-N10: types[] admits no Node globals.
process.exitCode = 0;
void count; void children;
