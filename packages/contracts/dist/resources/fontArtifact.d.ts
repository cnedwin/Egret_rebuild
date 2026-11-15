/** Bounded SFNT container admission; native decoding still owns glyph/font semantics. */
export declare function inspectFontArtifact(bytes: Uint8Array): Readonly<{
    format: 'truetype' | 'opentype';
    byteLength: number;
    tables: number;
}>;
//# sourceMappingURL=fontArtifact.d.ts.map