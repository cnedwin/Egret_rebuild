import { createTextField } from '@egret/engine/text';
import type { TextField, TextRasterCache } from '@egret/engine/text';
import type { DisplayObject, Engine, Scope } from '@egret/engine';
declare const engine: Engine, scope: Scope, cache: TextRasterCache;
declare const unbranded: DisplayObject & Pick<TextField, 'setRequest' | 'prepare' | 'getStatus'>;
declare const wrongEngine: {}, wrongScope: {}, wrongCache: {};

// TEXT_FIELD_SUPPLEMENT_CASE complete-shape-without-brand TS2741
const missingOnlyBrand: TextField = unbranded;
// TEXT_FIELD_SUPPLEMENT_CASE wrong-engine-argument TS2740
createTextField(wrongEngine, scope, cache);
// TEXT_FIELD_SUPPLEMENT_CASE wrong-scope-argument TS2740
createTextField(engine, wrongScope, cache);
// TEXT_FIELD_SUPPLEMENT_CASE wrong-cache-argument TS2740
createTextField(engine, scope, wrongCache);
void missingOnlyBrand;
