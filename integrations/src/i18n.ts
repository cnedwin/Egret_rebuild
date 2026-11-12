// SPDX-License-Identifier: Apache-2.0
import { createInstance } from 'i18next';
import type { Resource } from 'i18next';
import { IntegrationError } from './errors.js';

export interface LocalizationOptions {
    readonly language: string;
    readonly fallbackLanguage: string;
    readonly resources: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface TranslationOptions {
    readonly count?: number;
    readonly values?: Readonly<Record<string, string | number>>;
}

export interface Localization {
    readonly language: string;
    t(key: string, options?: TranslationOptions): string;
    changeLanguage(language: string): Promise<void>;
    dispose(): void;
}

function invalid(message: string): never {
    throw new IntegrationError('i18n', 'invalid-input', message);
}

function locale(value: string): string {
    if (typeof value !== 'string') invalid('Expected a BCP 47 language tag.');
    try {
        const canonical = Intl.getCanonicalLocales(value)[0];
        if (canonical && canonical !== 'cimode') return canonical;
    } catch {
        // Report invalid tags through the integration's public error contract.
    }
    return invalid('Invalid or reserved language tag: ' + value);
}

function safeKey(key: string): boolean {
    return typeof key === 'string' && key.length > 0 && key.length <= 256 &&
        !key.split('.').some(part => part === '__proto__' || part === 'constructor' || part === 'prototype');
}

/** Create an isolated translator with an owned copy of the application's plain-text catalogs. */
export async function createLocalization(options: LocalizationOptions): Promise<Localization> {
    if (!options || !options.resources || typeof options.resources !== 'object' || Array.isArray(options.resources)) {
        invalid('Expected language catalogs.');
    }
    const language = locale(options.language);
    const fallbackLng = locale(options.fallbackLanguage);
    const resources: Resource = Object.create(null);
    for (const [tag, catalog] of Object.entries(options.resources)) {
        const key = locale(tag);
        if (Object.hasOwn(resources, key)) invalid('Duplicate normalized language: ' + key);
        if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) invalid('Expected a text catalog: ' + key);
        const translation: Record<string, string> = Object.create(null);
        for (const [id, text] of Object.entries(catalog)) {
            if (!safeKey(id) || typeof text !== 'string') invalid('Invalid translation entry: ' + id);
            translation[id] = text;
        }
        resources[key] = { translation };
    }
    if (!Object.hasOwn(resources, language) || !Object.hasOwn(resources, fallbackLng)) {
        invalid('The initial and fallback languages need their own catalogs.');
    }

    const translator = createInstance();
    try {
        await translator.init({
            resources, lng: language, fallbackLng, supportedLngs: Object.keys(resources),
            keySeparator: false, nsSeparator: false, load: 'currentOnly', initAsync: false,
            // The adapter returns plain text for Egret or DOM textContent.
            interpolation: { escapeValue: false },
        });
    } catch (cause) {
        throw new IntegrationError('i18n', 'operation-failed', 'Could not initialize translations.', { cause });
    }
    let disposed = false;
    function active(): void {
        if (disposed) throw new IntegrationError('i18n', 'disposed', 'Localization is disposed.');
    }
    return Object.freeze({
        get language() { active(); return translator.language; },
        t(key: string, options: TranslationOptions = {}): string {
            active();
            if (!options || !safeKey(key) || (options.count !== undefined && !Number.isFinite(options.count))) invalid('Invalid translation key or count.');
            const replace: Record<string, string | number> = Object.create(null);
            for (const [name, value] of Object.entries(options.values ?? {})) {
                if (!safeKey(name) || (typeof value !== 'string' && !Number.isFinite(value))) invalid('Invalid interpolation value: ' + name);
                replace[name] = value;
            }
            if (options.count !== undefined) replace.count = options.count;
            return translator.t(key, { replace, ...(options.count === undefined ? {} : { count: options.count }) });
        },
        async changeLanguage(next: string): Promise<void> {
            active();
            const key = locale(next);
            if (!Object.hasOwn(resources, key)) invalid('Unknown language: ' + key);
            try { await translator.changeLanguage(key); }
            catch (cause) {
                throw new IntegrationError('i18n', 'operation-failed', 'Could not change language.', { cause });
            }
        },
        dispose() { disposed = true; },
    });
}
