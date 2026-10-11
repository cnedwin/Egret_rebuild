import { EgretError } from '@egret/runtime';
import type { DisplayObject, Scope } from '@egret/runtime';

export interface TextFieldEnginePort {
  assertOpen(): void;
  isEngineScope(value: unknown): value is Scope;
  registerCache(cache: object, construct: (scope: Scope) => DisplayObject): void;
  construct(scope: Scope, cache: object): DisplayObject;
}
const engines = new WeakMap<object, TextFieldEnginePort>();

/** Only Engine assembly can install the closed-over instance/cache authority. */
export function registerTextFieldEngine(engine: object, assertOpen: () => void,
  isEngineScope: (value: unknown) => value is Scope): TextFieldEnginePort {
  const caches = new WeakMap<object, (scope: Scope) => DisplayObject>();
  const port: TextFieldEnginePort = Object.freeze({
    assertOpen, isEngineScope,
    registerCache(cache: object, construct: (scope: Scope) => DisplayObject): void {
      assertOpen(); caches.set(cache, construct);
    },
    construct(scope: Scope, cache: object): DisplayObject {
      assertOpen();
      if (!isEngineScope(scope)) throw new EgretError('TEXT_FIELD_INVALID');
      const construct = caches.get(cache);
      if (construct === undefined) throw new EgretError('TEXT_FIELD_INVALID');
      return construct(scope);
    },
  });
  engines.set(engine, port);
  return port;
}
export function requireTextFieldEngine(engine: unknown): TextFieldEnginePort {
  const port = engines.get(engine as object);
  if (port === undefined) throw new EgretError('TEXT_FIELD_INVALID');
  return port;
}
