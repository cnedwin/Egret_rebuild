// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { VirtualDataSource, VirtualRecord } from './types.js';
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
