// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { LinearLayoutOptions, LinearLayoutPlacement, LinearLayoutPlan } from './layoutTypes.js';
export type {
  LinearLayoutItem,
  LinearLayoutOptions,
  LinearLayoutPlacement,
  LinearLayoutPlan,
} from './layoutTypes.js';

function isArray(value: unknown): value is unknown[] {
  try { return Array.isArray(value); }
  catch (cause) { throw new EgretError('LAYOUT_OPTIONS_INVALID', { cause }); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !isArray(value);
}

function read(value: object, key: PropertyKey): unknown {
  // Keep the catch around only the caller's Get: even a caller EgretError needs
  // a fresh wrapper, while our own validation failures must not be wrapped again.
  try { return (value as Record<PropertyKey, unknown>)[key]; }
  catch (cause) { throw new EgretError('LAYOUT_OPTIONS_INVALID', { cause }); }
}

function dimension(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EgretError('LAYOUT_OPTIONS_INVALID');
  }
  return value === 0 ? 0 : value;
}

function finiteResult(value: number): number {
  if (!Number.isFinite(value)) throw new EgretError('LAYOUT_OVERFLOW');
  return value === 0 ? 0 : value;
}

/** Capture ordered numeric inputs, then plan local rectangle origins without scene writes. */
export function planLinearLayout(options: LinearLayoutOptions): LinearLayoutPlan {
  if (!isRecord(options)) throw new EgretError('LAYOUT_OPTIONS_INVALID');
  const axis = read(options, 'axis');
  if (axis !== 'horizontal' && axis !== 'vertical') {
    throw new EgretError('LAYOUT_OPTIONS_INVALID');
  }
  const items = read(options, 'items');
  if (!isArray(items)) throw new EgretError('LAYOUT_OPTIONS_INVALID');
  const length = read(items, 'length');
  if (typeof length !== 'number' || !Number.isInteger(length)
    || !Number.isFinite(length) || length < 0 || length > 0xffffffff) {
    throw new EgretError('LAYOUT_OPTIONS_INVALID');
  }
  // This one observed bound also governs Proxy arrays and must win over getters
  // on optional fields, even if the underlying array has a different length.
  if (length > 4096) throw new EgretError('LAYOUT_LIMIT');
  const gapValue = read(options, 'gap');
  const gap = gapValue === undefined ? 0 : dimension(gapValue);
  const paddingValue = read(options, 'padding');
  const padding = paddingValue === undefined ? 0 : dimension(paddingValue);
  const crossAlignValue = read(options, 'crossAlign');
  const crossAlign = crossAlignValue === undefined ? 'start' : crossAlignValue;
  if (crossAlign !== 'start' && crossAlign !== 'center' && crossAlign !== 'end') {
    throw new EgretError('LAYOUT_OPTIONS_INVALID');
  }

  const captured: { readonly width: number; readonly height: number; mainPosition: number }[] = [];
  for (let index = 0; index < length; index++) {
    const item = read(items, index);
    if (!isRecord(item)) throw new EgretError('LAYOUT_OPTIONS_INVALID');
    // Retain this item only for its two Gets. Replacing its source slot during
    // width cannot redirect height, while mutations of future slots remain visible.
    const width = dimension(read(item, 'width'));
    const height = dimension(read(item, 'height'));
    captured.push({ width, height, mainPosition: 0 });
  }

  // No layout arithmetic, including padding addition, may precede the final Get:
  // a late invalid input or getter failure takes precedence over numeric overflow.
  // Every remaining array/record is call-local, so reentry cannot share a cursor.
  const horizontal = axis === 'horizontal';
  let cursor = padding;
  let index = 0;
  for (const item of captured) {
    item.mainPosition = cursor;
    cursor = finiteResult(cursor + (horizontal ? item.width : item.height));
    index++;
    if (index < length) cursor = finiteResult(cursor + gap);
  }
  const mainExtent = finiteResult(cursor + padding);

  let maxCross = 0;
  for (const item of captured) {
    const crossSize = horizontal ? item.height : item.width;
    if (crossSize > maxCross) maxCross = crossSize;
  }
  // Preserve both binary64 additions; doubling padding or reassociating them
  // changes rounding and overflow behavior, including for an empty input.
  const crossWithPadding = finiteResult(maxCross + padding);
  const crossExtent = finiteResult(crossWithPadding + padding);

  const placements: LinearLayoutPlacement[] = [];
  index = 0;
  for (const item of captured) {
    let crossPosition = padding;
    if (crossAlign !== 'start') {
      const crossSize = horizontal ? item.height : item.width;
      const remaining = finiteResult(maxCross - crossSize);
      if (crossAlign === 'center') {
        const halfRemaining = finiteResult(remaining / 2);
        crossPosition = finiteResult(padding + halfRemaining);
      } else {
        crossPosition = finiteResult(padding + remaining);
      }
    }
    placements.push(Object.freeze({
      index,
      x: horizontal ? item.mainPosition : crossPosition,
      y: horizontal ? crossPosition : item.mainPosition,
      width: item.width,
      height: item.height,
    }));
    index++;
  }
  return Object.freeze({
    width: horizontal ? mainExtent : crossExtent,
    height: horizontal ? crossExtent : mainExtent,
    placements: Object.freeze(placements),
  });
}
