import { EgretError } from '@egret/runtime';
import type { MouseInputEnginePort } from '../mouseInput.js';

const engines = new WeakMap<object, MouseInputEnginePort>();

/** Assembly installs authority before publishing the genuine Engine. */
export function registerMouseInputEngine(engine: object, port: MouseInputEnginePort): void {
  engines.set(engine, port);
}
export function requireMouseInputEngine(engine: unknown): MouseInputEnginePort {
  const port = engines.get(engine as object);
  if (port === undefined) throw new EgretError('MOUSE_INPUT_INVALID');
  port.assertReady();
  return port;
}
/** Successful Host startup is separate from ordinary open-state observation. */
export function markMouseInputEngineStarted(engine: object): void {
  engines.get(engine)?.markStarted();
}
