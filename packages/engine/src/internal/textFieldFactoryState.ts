import { EgretError } from '@egret/runtime';
import type { DisplayObject, Scope } from '@egret/runtime';

export interface TextFieldEnginePort {
  assertOpen(): void;
  isEngineScope(value: unknown): value is Scope;
  registerCache(cache: object, construct: (scope: Scope) => DisplayObject, kind?: 'explicit-lines' | 'paragraph'): void;
  construct(scope: Scope, cache: object, kind?: 'explicit-lines' | 'paragraph'): DisplayObject;
}
const engines = new WeakMap<object, TextFieldEnginePort>();

/** Only Engine assembly can install the closed-over instance/cache authority. */
export function registerTextFieldEngine(engine: object, assertOpen: () => void,
  isEngineScope: (value: unknown) => value is Scope): TextFieldEnginePort {
  const caches = new WeakMap<object, { construct: (scope: Scope) => DisplayObject; kind: 'explicit-lines' | 'paragraph' }>();
  const port: TextFieldEnginePort = Object.freeze({
    assertOpen, isEngineScope,
    registerCache(cache: object, construct: (scope: Scope) => DisplayObject, kind: 'explicit-lines' | 'paragraph' = 'explicit-lines'): void {
      assertOpen(); caches.set(cache, {construct, kind});
    },
    construct(scope: Scope, cache: object, kind: 'explicit-lines' | 'paragraph' = 'explicit-lines'): DisplayObject {
      assertOpen();
      if (!isEngineScope(scope)) throw new EgretError('TEXT_FIELD_INVALID');
      const registered = caches.get(cache);
      if (registered === undefined || registered.kind !== kind) throw new EgretError('TEXT_FIELD_INVALID');
      return registered.construct(scope);
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
