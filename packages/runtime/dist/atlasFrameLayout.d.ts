/** Logical canvas and unpacked placement of a clockwise-packed atlas rectangle. */
export interface AtlasFrameLayout {
    readonly sourceWidth: number;
    readonly sourceHeight: number;
    readonly trimX: number;
    readonly trimY: number;
    readonly packedRotation: 0 | 90;
}
interface Field {
    readonly present: boolean;
    readonly value: unknown;
}
interface CapturedLayout {
    readonly fields?: readonly Field[];
}
/** Capture only; each factory owns its staging and semantic scheduling. */
export declare function captureAtlasFrameLayout(frame: object, read: (source: object, key: string) => Field, operation: <T>(callback: () => T) => T): CapturedLayout;
/** Validate scalars and allocate a frozen owned copy, retaining no caller graph. */
export declare function copyAtlasFrameLayout(captured: CapturedLayout, width: number, height: number, reject: (kind: 'shape' | 'region') => never): AtlasFrameLayout;
export {};
//# sourceMappingURL=atlasFrameLayout.d.ts.map