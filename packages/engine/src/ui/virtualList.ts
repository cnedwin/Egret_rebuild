// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { UiHeightView } from '@egret/runtime/ui';
import type { VirtualDataSource, VirtualRecord, VirtualListRevealOptions } from './types.js';
export interface CapturedSource {
    readonly identity: object;
    readonly revision: number;
    readonly records: readonly VirtualRecord<unknown>[];
    readonly byKey: ReadonlyMap<string, VirtualRecord<unknown>>;
    readonly bind: VirtualDataSource<unknown>['bind'];
    readonly unbind: VirtualDataSource<unknown>['unbind'];
}
export function captureSource(source: VirtualDataSource<unknown>): CapturedSource {
    if (source === null || typeof source !== 'object')
        throw new EgretError('UI_SOURCE_INVALID');
    const revision = source.revision, records = source.records, bind = source.bind, unbind = source.unbind;
    if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(records) || typeof bind !== 'function' || typeof unbind !== 'function')
        throw new EgretError('UI_SOURCE_INVALID');
    // Snapshot the caller-controlled count once, before allocation or indexed reads.
    const count = records.length;
    if (!Number.isInteger(count) || count < 0 || count > 50000)
        throw new EgretError('UI_SOURCE_INVALID');
    const byKey = new Map<string, VirtualRecord<unknown>>(), copied: VirtualRecord<unknown>[] = [];
    for (let index = 0; index < count; index++) {
        const record = records[index];
        if (record === null || typeof record !== 'object')
            throw new EgretError('UI_SOURCE_INVALID');
        const key = record.key, contentVersion = record.contentVersion, estimatedHeight = record.estimatedHeight, value = record.value;
        if (typeof key !== 'string' || key.length === 0 || key.length > 128 || byKey.has(key) || !Number.isSafeInteger(contentVersion) || contentVersion < 0 || !Number.isFinite(estimatedHeight) || estimatedHeight < 1 || estimatedHeight > 1048576)
            throw new EgretError('UI_SOURCE_INVALID');
        const item = Object.freeze({
            key,
            contentVersion,
            estimatedHeight,
            value
        });
        copied.push(item);
        byKey.set(key, item);
    }
    return Object.freeze({
        identity: source,
        revision,
        records: Object.freeze(copied),
        byKey,
        bind,
        unbind
    });
}

export interface RevealIntent {
    readonly key: string;
    readonly align: NonNullable<VirtualListRevealOptions['align']>;
}
/** Capture caller-controlled options before the owner mutates any pending intent. */
export function captureReveal(key: string | undefined, options?: VirtualListRevealOptions): RevealIntent | undefined {
    if (key === undefined) {
        if (options !== undefined) throw new EgretError('UI_VALUE_INVALID');
        return undefined;
    }
    if (typeof key !== 'string' || key.length === 0 || key.length > 128) throw new EgretError('UI_VALUE_INVALID');
    let align: RevealIntent['align'] = 'nearest';
    if (options !== undefined) {
        if (options === null || typeof options !== 'object') throw new EgretError('UI_VALUE_INVALID');
        const prototype = Object.getPrototypeOf(options);
        if (prototype !== Object.prototype && prototype !== null) throw new EgretError('UI_VALUE_INVALID');
        for (const name of Reflect.ownKeys(options)) if (name !== 'align') throw new EgretError('UI_VALUE_INVALID');
        const value = options.align;
        if (value !== undefined) {
            if (value !== 'nearest' && value !== 'start' && value !== 'center' && value !== 'end') throw new EgretError('UI_VALUE_INVALID');
            align = value;
        }
    }
    return Object.freeze({ key, align });
}
/** Resolve against each staged height view, without a second index or hidden row retention. */
export function revealScroll(view: UiHeightView, intent: RevealIntent, current: number, height: number): number {
    const index = view.indexOf(intent.key);
    if (index < 0) throw new EgretError('UI_UNKNOWN_KEY');
    const top = view.prefix(index), bottom = top + view.heightAt(index), scroll = view.clampScroll(current, height);
    let target: number;
    switch (intent.align) {
        case 'start': target = top; break;
        case 'center': target = (top + bottom - height) / 2; break;
        case 'end': target = bottom - height; break;
        default:
            // Keep both fully visible short rows and tall rows covering the viewport stable.
            if (top >= scroll && bottom <= scroll + height || top <= scroll && bottom >= scroll + height) target = scroll;
            else target = Math.abs(top - scroll) <= Math.abs(bottom - height - scroll) ? top : bottom - height;
    }
    return view.clampScroll(target, height);
}
