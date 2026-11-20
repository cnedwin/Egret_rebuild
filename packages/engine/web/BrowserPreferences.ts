// SPDX-License-Identifier: Apache-2.0
// What the player has asked of every page: less motion, and which languages. Read once, or watched as it changes.

type MediaWindow = { matchMedia?: (query: string) => MediaQueryList };

function query(): MediaQueryList | undefined {
  const page = globalThis as MediaWindow;
  try {
    return typeof page.matchMedia === 'function' ? page.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the player has asked the system for less motion (`prefers-reduced-motion: reduce`): then leave out shakes,
 * flashes, parallax and large moves that are only for show. False where the page cannot tell.
 */
export function prefersReducedMotion(): boolean {
  return query()?.matches === true;
}

/** Calls `listener` with the new answer whenever the player changes it. The function returned stops it. */
export function watchReducedMotion(listener: (reduced: boolean) => void): () => void {
  if (typeof listener !== 'function') throw new TypeError('watchReducedMotion needs a function');
  const list = query();
  if (list === undefined || typeof list.addEventListener !== 'function') return () => {};
  const changed = (event: MediaQueryListEvent): void => listener(event.matches);
  list.addEventListener('change', changed);
  return () => list.removeEventListener('change', changed);
}

/** The languages the player's browser asks for, most wanted first, such as `['zh-CN', 'en']`; empty where unknown. */
export function browserLanguages(): readonly string[] {
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
  if (nav === undefined) return [];
  if (Array.isArray(nav.languages) && nav.languages.length > 0) return Object.freeze([...nav.languages]);
  return typeof nav.language === 'string' ? Object.freeze([nav.language]) : [];
}
