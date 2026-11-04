// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
import type { Scope } from '@egret/engine';
import type { SpineContentLoader } from './types.js';
import type { SpineDisplay } from './displayTypes.js';
import type { SpineInstance } from './instanceTypes.js';

const loaders = new WeakMap<object, (scope: Scope) => void>();
const displays = new WeakMap<object, SpineInstance>();
export function registerResetLoader(loader: SpineContentLoader, authenticate: (scope: Scope) => void): void { loaders.set(loader, authenticate); }
export function authenticateResetLoader(loader: SpineContentLoader, scope: Scope): void {
  const authenticate = loaders.get(loader); if (!authenticate) throw new EgretError('SPINE_RESET_LOADER_INVALID'); authenticate(scope);
}
export function registerResetDisplay(display: SpineDisplay, instance: SpineInstance): void { displays.set(display, instance); }
export function authenticateResetDisplay(display: SpineDisplay, instance: SpineInstance): void {
  if (displays.get(display) !== instance || !instance || !display || display.getStatus().isDisposed || instance.isDisposed) throw new EgretError('SPINE_RESET_INITIAL_INVALID');
}
