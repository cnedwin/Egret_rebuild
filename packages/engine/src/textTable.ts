// SPDX-License-Identifier: Apache-2.0
// A game's words in each of its languages: one table, a current language that can change while the game runs, and
// a word asked for by its key with values put in. Every string a player reads goes through it, so no Chinese is left
// on an English screen.
import { EgretError } from '@egret/runtime';

/** The words of one language, by key. A value may name `{placeholders}`. */
export type TextTableWords = Readonly<Record<string, string>>;

/** A text table to make: the words of each language, the language to start in and the one to fall back to. */
export interface TextTableOptions<L extends string> {
  /** One set of words per language, such as `{ zh: { start: '开始' }, en: { start: 'Start' } }`. */
  readonly languages: Readonly<Record<L, TextTableWords>>;
  /** The language to start in. The first that `languages` names unless given. */
  readonly language?: L;
  /** Where a word missing from the current language is taken from. The first language unless given. */
  readonly fallback?: L;
  /** Told of a key missing from the current language, once per key and language: for a check in development. */
  readonly onMissing?: (key: string, language: L) => void;
}

/** A game's words in its languages: the current one, a word by key, and who is told when the language changes. */
export interface TextTable<L extends string> {
  readonly languages: readonly L[];
  /** The current language. */
  readonly language: L;
  /** Changes the language and tells every listener, which redraws the words it shows. */
  setLanguage(language: L): void;
  /**
   * The word for `key` in the current language, else in the fallback, else the key itself, with each `{name}` replaced
   * by `values[name]`.
   */
  text(key: string, values?: Readonly<Record<string, string | number>>): string;
  /** Whether the current language has its own word for `key`. */
  has(key: string): boolean;
  /** Calls `listener` whenever the language changes. The function returned stops it. */
  onChange(listener: (language: L) => void): () => void;
  /** The keys some language has and another lacks, by language: for a test that every word is in every language. */
  missing(): Readonly<Record<L, readonly string[]>>;
}

const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

/** Makes a table of a game's words in its languages. */
export function createTextTable<L extends string>(options: TextTableOptions<L>): TextTable<L> {
  const invalid = (): EgretError => new EgretError('TEXT_TABLE_INVALID');
  if (
    options === null ||
    typeof options !== 'object' ||
    options.languages === null ||
    typeof options.languages !== 'object'
  )
    throw invalid();
  const languages = Object.keys(options.languages) as L[];
  if (languages.length === 0) throw invalid();
  for (const language of languages) {
    const words = options.languages[language];
    if (words === null || typeof words !== 'object' || Object.values(words).some(word => typeof word !== 'string'))
      throw invalid();
  }
  const fallback = options.fallback ?? languages[0]!;
  let language = options.language ?? languages[0]!;
  if (!languages.includes(fallback) || !languages.includes(language)) throw invalid();
  const onMissing = options.onMissing;
  if (onMissing !== undefined && typeof onMissing !== 'function') throw invalid();
  const told = new Set<string>(),
    listeners = new Set<(language: L) => void>();
  const own = (words: TextTableWords, key: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(words, key) ? words[key] : undefined;
  return {
    languages: Object.freeze([...languages]),
    get language(): L {
      return language;
    },
    setLanguage(next: L): void {
      if (!languages.includes(next)) throw invalid();
      if (next === language) return;
      language = next;
      let first: unknown;
      for (const listener of [...listeners])
        try {
          listener(next);
        } catch (cause) {
          first ??= cause;
        }
      if (first !== undefined) throw first;
    },
    text(key: string, values?: Readonly<Record<string, string | number>>): string {
      if (typeof key !== 'string') throw invalid();
      let word = own(options.languages[language], key);
      if (word === undefined) {
        if (onMissing !== undefined && !told.has(language + '\u0000' + key)) {
          told.add(language + '\u0000' + key);
          onMissing(key, language);
        }
        word = own(options.languages[fallback], key) ?? key;
      }
      return values === undefined
        ? word
        : word.replace(PLACEHOLDER, (whole, name: string) =>
            Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole
          );
    },
    has(key: string): boolean {
      return own(options.languages[language], key) !== undefined;
    },
    onChange(listener: (language: L) => void): () => void {
      if (typeof listener !== 'function') throw invalid();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    missing(): Readonly<Record<L, readonly string[]>> {
      const all = new Set<string>();
      for (const each of languages) for (const key of Object.keys(options.languages[each])) all.add(key);
      const result = {} as Record<L, readonly string[]>;
      for (const each of languages)
        result[each] = Object.freeze([...all].filter(key => own(options.languages[each], key) === undefined).sort());
      return Object.freeze(result);
    }
  };
}

/**
 * The language of `languages` that best matches what the player's browser or system asks for (`navigator.languages`,
 * given here as a list, such as `['zh-CN', 'en']`): an exact match first, then the same main language (`zh-TW` asks
 * for `zh`). The first of `languages` when none matches.
 */
export function pickLanguage<L extends string>(languages: readonly L[], wanted: readonly string[]): L {
  if (!Array.isArray(languages) || languages.length === 0) throw new EgretError('TEXT_TABLE_INVALID');
  const lower = languages.map(language => language.toLowerCase());
  for (const ask of Array.isArray(wanted) ? wanted : []) {
    if (typeof ask !== 'string') continue;
    const exact = lower.indexOf(ask.toLowerCase());
    if (exact >= 0) return languages[exact]!;
    const main = ask.toLowerCase().split('-')[0]!;
    const same = lower.findIndex(language => language.split('-')[0] === main);
    if (same >= 0) return languages[same]!;
  }
  return languages[0]!;
}
