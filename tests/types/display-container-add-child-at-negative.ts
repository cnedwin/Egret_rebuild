// SPDX-License-Identifier: Apache-2.0
// Original unsuppressed diagnostics; actual tuples are frozen by Root after execution.
import { DisplayObject, DisplayObjectContainer, Sprite } from '@egret/engine';
const container = new DisplayObjectContainer(), child = new DisplayObject(), sprite = new Sprite();
// ADI-N01 index is required
container.addChildAt(child);
// ADI-N02 string index
container.addChildAt(child, '0');
// ADI-N03 null index
container.addChildAt(child, null);
// ADI-N04 undefined index
container.addChildAt(child, undefined);
// ADI-N05 numeric child
container.addChildAt(0, 0);
// ADI-N06 null child
container.addChildAt(null, 0);
// ADI-N07 undefined child
container.addChildAt(undefined, 0);
// ADI-N08 a shape is not a DisplayObject
container.addChildAt({ parent: container }, 0);
// ADI-N09 no third argument
container.addChildAt(child, 0, true);
// ADI-N10 the inferred Sprite return is not a number
const wrongNumber: number = container.addChildAt(sprite, 0);
void wrongNumber;
