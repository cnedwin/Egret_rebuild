import { DisplayObject, DisplayObjectContainer, Stage } from '@egret/engine';
import type { HitTestOptions } from '@egret/engine';
declare const stage: Stage;
declare const node: DisplayObject;
declare const container: DisplayObjectContainer;
// HIT_TEST_CASE required-coordinates TS2554
stage.hitTest();
// HIT_TEST_CASE required-second-coordinate TS2554
stage.hitTest(1);
// HIT_TEST_CASE numeric-x TS2345
stage.hitTest('1', 2);
// HIT_TEST_CASE numeric-y TS2345
stage.hitTest(1, undefined);
// HIT_TEST_CASE rectangle-enabled-boolean TS2322
node.touchEnabled = 1;
// HIT_TEST_CASE child-flag-boolean TS2322
container.touchChildren = 'false';
// HIT_TEST_CASE complete-rectangle TS2741
node.hitArea = { x: 0, y: 0, width: 1 };
// HIT_TEST_CASE numeric-rectangle TS2322
node.hitArea = { x: '0', y: 0, width: 1, height: 1 };
// HIT_TEST_CASE leaf-has-no-touchChildren TS2339
node.touchChildren = false;
// HIT_TEST_CASE leaf-has-no-query TS2339
node.hitTest(1, 2);
// HIT_TEST_CASE container-has-no-query TS2339
container.hitTest(1, 2);
// HIT_TEST_CASE readonly-budget TS2540
declare const options: HitTestOptions; options.maxNodes = 1;
// HIT_TEST_CASE numeric-budget TS2322
const badBudget: HitTestOptions = { maxNodes: '1' };
// HIT_TEST_CASE no-content-mode TS2353
stage.hitTest(1, 2, { shapeFlag: true });
// HIT_TEST_CASE borrowed-optional-target TS2322
const definite: DisplayObject = stage.hitTest(1, 2);
// HIT_TEST_CASE options-type-only TS2693
void HitTestOptions;
void badBudget; void definite;
