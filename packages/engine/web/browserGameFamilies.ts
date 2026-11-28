// SPDX-License-Identifier: Apache-2.0
// Explicit font candidates for the opt-in BrowserGame paragraph and fixed-glyph text paths.
// Legacy T1 labels deliberately do not pass through this helper.
import { EgretError } from '@egret/runtime';

export function gameFontFamilies(
  input: { readonly fontFamily?: string; readonly fontFamilies?: readonly string[] },
  previous: readonly string[] = ['sans-serif']
): readonly string[] {
  const { fontFamily, fontFamilies } = input;
  const invalid = () => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
  if (fontFamily !== undefined && fontFamilies !== undefined) throw invalid();
  const names = fontFamily === undefined ? (fontFamilies ?? previous) : [fontFamily];
  if (!Array.isArray(names) || names.length < 1 || names.length > 16) throw invalid();
  const copied: string[] = [];
  for (const name of names) {
    if (typeof name !== 'string' || !name.length || name.length > 256 || /[\x00-\x1f\x7f]/.test(name)) throw invalid();
    copied.push(name);
  }
  return Object.freeze(copied);
}
