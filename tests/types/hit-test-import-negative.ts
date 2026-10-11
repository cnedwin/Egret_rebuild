// HIT_TEST_IMPORT_CASE web-options TS2305
import type { HitTestOptions as WebOptions } from '@egret/engine/web';
// HIT_TEST_IMPORT_CASE gpu-options TS2305
import type { HitTestOptions as GpuOptions } from '@egret/engine/webgpu';
// HIT_TEST_IMPORT_CASE text-options TS2305
import type { HitTestOptions as TextOptions } from '@egret/engine/text';
// HIT_TEST_IMPORT_CASE root-private-state TS2305
import { readDisplayHitState } from '@egret/engine';
// HIT_TEST_IMPORT_CASE runtime-private-query TS2305
import { queryDisplayHit } from '@egret/runtime';
// HIT_TEST_IMPORT_CASE engine-deep-query TS2307
import { queryDisplayHit as EngineDeep } from '@egret/engine/displayHitTest';
// HIT_TEST_IMPORT_CASE runtime-deep-state TS2307
import { readDisplayHitState as RuntimeDeep } from '@egret/runtime/displayHitState';
// HIT_TEST_IMPORT_CASE no-input-subpath TS2307
import { createInputRouter } from '@egret/engine/input';
void [readDisplayHitState, queryDisplayHit, EngineDeep, RuntimeDeep, createInputRouter];
export type { WebOptions, GpuOptions, TextOptions };
