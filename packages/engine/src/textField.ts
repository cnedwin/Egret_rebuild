import type { Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { TextField, TextRasterCache } from './text.js';
import { requireTextFieldEngine } from './internal/textFieldFactoryState.js';

/** Public explicit entry; shape, proxies and borrowed identities grant no authority. */
export function createTextField(engine: Engine, scope: Scope, cache: TextRasterCache): TextField {
  return requireTextFieldEngine(engine).construct(scope, cache) as TextField;
}
