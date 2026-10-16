// SPDX-License-Identifier: Apache-2.0
/** Logical canvas and unpacked placement of a clockwise-packed atlas rectangle. */
export interface AtlasFrameLayout {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly packedRotation: 0 | 90;
}
interface Field { readonly present: boolean; readonly value: unknown; }
interface CapturedLayout {
  readonly fields?: readonly Field[];
}
const keys = ['sourceWidth', 'sourceHeight', 'trimX', 'trimY', 'packedRotation'] as const;
/** Capture only; each factory owns its staging and semantic scheduling. */
export function captureAtlasFrameLayout(
  frame: object, read: (source: object, key: string) => Field,
  operation: <T>(callback: () => T) => T,
): CapturedLayout {
  const field = read(frame, 'layout');
  if (!field.present || field.value === null || typeof field.value !== 'object') return {};
  if (operation(() => Array.isArray(field.value))) return {};
  const source = field.value;
  const fields: Field[] = [];
  for (const key of keys) fields.push(read(source, key));
  return { fields };
}
/** Validate scalars and allocate a frozen owned copy, retaining no caller graph. */
export function copyAtlasFrameLayout(
  captured: CapturedLayout, width: number, height: number,
  reject: (kind: 'shape' | 'region') => never,
): AtlasFrameLayout {
  const fields = captured.fields;
  if (fields === undefined || fields.some(field => !field.present)) return reject('shape');
  const values = fields.map(field => field.value);
  const [sourceWidth, sourceHeight, trimX, trimY, packedRotation] = values;
  if (typeof sourceWidth !== 'number' || !Number.isSafeInteger(sourceWidth) || sourceWidth <= 0
    || typeof sourceHeight !== 'number' || !Number.isSafeInteger(sourceHeight) || sourceHeight <= 0
    || typeof trimX !== 'number' || !Number.isSafeInteger(trimX) || trimX < 0
    || typeof trimY !== 'number' || !Number.isSafeInteger(trimY) || trimY < 0
    || (packedRotation !== 0 && packedRotation !== 90)) return reject('region');
  const right = trimX + (packedRotation === 90 ? height : width);
  const bottom = trimY + (packedRotation === 90 ? width : height);
  if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom)
    || right > sourceWidth || bottom > sourceHeight) return reject('region');
  return Object.freeze({ sourceWidth, sourceHeight, trimX: trimX === 0 ? 0 : trimX,
    trimY: trimY === 0 ? 0 : trimY, packedRotation: packedRotation === 0 ? 0 : 90 });
}
