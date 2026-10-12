// Original NS1 misuse cases remain unsuppressed and separately marked.
// Numeric range and precision admission require behavior tests, not type claims.
import { createNineSliceGeometry2D } from "@egret/engine";
import type { NineSliceInsets2D, NineSliceGeometry2DOptions, TexturedGeometry2D } from "@egret/engine";
declare const insets: NineSliceInsets2D;
declare const options: NineSliceGeometry2DOptions;
declare const geometry: TexturedGeometry2D;

// NSN required-options
createNineSliceGeometry2D();
// NSN no-second-argument
createNineSliceGeometry2D(options, options);
// NSN nonnull-options
createNineSliceGeometry2D(null);
// NSN options-not-string
createNineSliceGeometry2D("panel");
// NSN source-width-primitive-number
createNineSliceGeometry2D({ ...options, sourceWidth: "8" });
// NSN source-height-primitive-number
createNineSliceGeometry2D({ ...options, sourceHeight: false });
// NSN target-width-primitive-number
createNineSliceGeometry2D({ ...options, targetWidth: 16n });
// NSN target-height-primitive-number
createNineSliceGeometry2D({ ...options, targetHeight: new Number(12) });
// NSN left-primitive-number
createNineSliceGeometry2D({ ...options, insets: { ...insets, left: "2" } });
// NSN top-primitive-number
createNineSliceGeometry2D({ ...options, insets: { ...insets, top: false } });
// NSN right-primitive-number
createNineSliceGeometry2D({ ...options, insets: { ...insets, right: 2n } });
// NSN bottom-primitive-number
createNineSliceGeometry2D({ ...options, insets: { ...insets, bottom: new Number(2) } });
// NSN required-source-width
createNineSliceGeometry2D({ sourceHeight: 8, targetWidth: 16, targetHeight: 12, insets });
// NSN required-source-height
createNineSliceGeometry2D({ sourceWidth: 8, targetWidth: 16, targetHeight: 12, insets });
// NSN required-target-width
createNineSliceGeometry2D({ sourceWidth: 8, sourceHeight: 8, targetHeight: 12, insets });
// NSN required-target-height
createNineSliceGeometry2D({ sourceWidth: 8, sourceHeight: 8, targetWidth: 16, insets });
// NSN required-insets
createNineSliceGeometry2D({ sourceWidth: 8, sourceHeight: 8, targetWidth: 16, targetHeight: 12 });
// NSN nonnull-insets
createNineSliceGeometry2D({ ...options, insets: null });
// NSN insets-not-number
createNineSliceGeometry2D({ ...options, insets: 2 });
// NSN required-left
createNineSliceGeometry2D({ ...options, insets: { top: 2, right: 2, bottom: 2 } });
// NSN required-top
createNineSliceGeometry2D({ ...options, insets: { left: 2, right: 2, bottom: 2 } });
// NSN required-right
createNineSliceGeometry2D({ ...options, insets: { left: 2, top: 2, bottom: 2 } });
// NSN required-bottom
createNineSliceGeometry2D({ ...options, insets: { left: 2, top: 2, right: 2 } });
// NSN readonly-source-width
options.sourceWidth = 8;
// NSN readonly-source-height
options.sourceHeight = 8;
// NSN readonly-target-width
options.targetWidth = 16;
// NSN readonly-target-height
options.targetHeight = 12;
// NSN readonly-insets-reference
options.insets = insets;
// NSN readonly-left
insets.left = 2;
// NSN readonly-top
insets.top = 2;
// NSN readonly-right
insets.right = 2;
// NSN readonly-bottom
insets.bottom = 2;
// NSN canonical-result-not-void
const noResult: void = createNineSliceGeometry2D(options);
// NSN canonical-result-not-promise
const asynchronousResult: Promise<TexturedGeometry2D> = createNineSliceGeometry2D(options);
// NSN nominal-result-cannot-be-forged
const forgedGeometry: TexturedGeometry2D = { vertexCount: 16, indexCount: 54, triangleCount: 18,
  logicalByteLength: 1240, positions: [], uvs: [], lightColors: [], indices: [] };
// NSN readonly-result-vertex-count
geometry.vertexCount = 16;
// NSN readonly-result-indices-reference
geometry.indices = [];
// NSN readonly-result-position-element
geometry.positions[0] = 0;
// NSN readonly-result-uv-element
geometry.uvs[0] = 0;
// NSN readonly-result-light-element
geometry.lightColors[0] = 1;
// NSN readonly-result-index-element
geometry.indices[0] = 0;
void noResult; void asynchronousResult; void forgedGeometry;
