// First-party Apache-2.0 fixed numeric oracle. Expected values are not observations.
// Literal data projects only the independently reviewed finite numeric successor.
// This module imports no SDK, renderer, shader, native output or generated pixels.
function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
export const FIXTURE = freezeDeep(
{
  "canvas": {
    "logicalWidth": 64,
    "logicalHeight": 64,
    "pixelRatio": 1,
    "backingWidth": 64,
    "backingHeight": 64,
    "clearColor": 0,
    "clearAlpha": 1,
    "sampleCount": 1,
    "coordinateOrigin": "top-left",
    "samplePoint": "(x+0.5,y+0.5)",
    "clearExpectedRGBA": [
      0,
      0,
      0,
      255
    ]
  },
  "scene": {
    "factory": "createMeshGeometry3D then createSceneFrame3D; ordinary literal Arrays; modelView through public createMatrix4",
    "projection": {
      "kind": "orthographic",
      "left": -1,
      "right": 1,
      "bottom": -1,
      "top": 1,
      "near": 1,
      "far": 9
    },
    "depthConvention": {
      "range": "zeroToOne",
      "direction": "reverse",
      "clear": 0,
      "compare": "greater",
      "write": true
    },
    "modelView": [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ],
    "projectionMatrixColumnMajor": [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0.125,
      0,
      0,
      0,
      1.125,
      1
    ],
    "mvpColumnMajor": [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0.125,
      0,
      0,
      0,
      1.125,
      1
    ],
    "geometries": [
      {
        "id": "near-red",
        "positions": [
          -0.5,
          0.5,
          -3,
          0.5,
          0.5,
          -3,
          -0.5,
          -0.5,
          -3
        ],
        "colors": [
          1,
          0,
          0,
          1,
          0,
          0,
          1,
          0,
          0
        ],
        "indices": [
          0,
          1,
          2
        ],
        "screenVertices": [
          [
            16,
            16
          ],
          [
            48,
            16
          ],
          [
            16,
            48
          ]
        ],
        "clipZ": 0.75,
        "clipW": 1,
        "vertexCount": 3,
        "indexCount": 3,
        "logicalBytes": 168,
        "packedBytes": 84
      },
      {
        "id": "far-blue",
        "positions": [
          -0.75,
          0.75,
          -7,
          0.75,
          0.75,
          -7,
          -0.75,
          -0.75,
          -7
        ],
        "colors": [
          0,
          0,
          1,
          0,
          0,
          1,
          0,
          0,
          1
        ],
        "indices": [
          0,
          1,
          2
        ],
        "screenVertices": [
          [
            8,
            8
          ],
          [
            56,
            8
          ],
          [
            8,
            56
          ]
        ],
        "clipZ": 0.25,
        "clipW": 1,
        "vertexCount": 3,
        "indexCount": 3,
        "logicalBytes": 168,
        "packedBytes": 84
      }
    ],
    "drawOrder": [
      "near-red",
      "far-blue"
    ],
    "reuse": "The same genuine SceneFrame3D is rendered with both overlay snapshots.",
    "arithmetic": "xScreen=32*(x+1), yScreen=32*(1-y), depth=(z+9)/8. Both triangles have interior x+y<64; near also x>16,y>16, far x>8,y>8. The later far draw must fail greater at stored near depth .75.",
    "expectedLogicalCounts": {
      "draws": 2,
      "geometries": 2,
      "cpuLogicalBytes": 336,
      "sceneBytes": 168,
      "uniformBytes": 128,
      "depthBytes": 16384
    }
  },
  "resources": {
    "image": {
      "factory": "createImageData2D",
      "width": 2,
      "height": 2,
      "byteLength": 16,
      "pixelsRowMajorRGBA": [
        0,
        255,
        255,
        255,
        255,
        255,
        0,
        255,
        255,
        0,
        255,
        255,
        255,
        255,
        255,
        255
      ],
      "palette": [
        [
          0,
          0,
          "cyan",
          [
            0,
            255,
            255,
            255
          ]
        ],
        [
          1,
          0,
          "yellow",
          [
            255,
            255,
            0,
            255
          ]
        ],
        [
          0,
          1,
          "magenta",
          [
            255,
            0,
            255,
            255
          ]
        ],
        [
          1,
          1,
          "white",
          [
            255,
            255,
            255,
            255
          ]
        ]
      ]
    },
    "texture": {
      "factory": "createTexture",
      "sourceRect": {
        "x": 0,
        "y": 0,
        "width": 2,
        "height": 2
      },
      "description": "One authentic Texture, one registered asset type/ref, one acquired genuine AssetLease reused by Mesh2D and Bitmap."
    },
    "acquisition": {
      "typeName": "combined-host-native-palette",
      "refKey": "palette2x2",
      "typePredicate": "isTexture",
      "providerLoad": "returns the actual created Texture",
      "providerDispose": "calls value.dispose()",
      "leaseOwner": "one genuine Engine-created Scope; acquire with its signal; lease and display nodes registered through Scope.use"
    },
    "sampler": {
      "minFilter": "nearest",
      "magFilter": "nearest",
      "mipmapFilter": "nearest",
      "addressModeU": "clamp-to-edge",
      "addressModeV": "clamp-to-edge",
      "mipLevel": 0
    },
    "encoding": "All channels are literal 0/255, alpha255, light/opacity1. Crop premultiplication preserves bytes; no partial alpha/gamma/antialias oracle is introduced."
  },
  "overlay": {
    "capture": "engine.captureTexturedFrame({width:64,height:64,clearColor:0,clearAlpha:1}); authentic frozen returned frame only",
    "stage": {
      "x": 0,
      "y": 0,
      "scaleX": 1,
      "scaleY": 1,
      "rotation": 0,
      "alpha": 1,
      "visible": true,
      "clipRect": null,
      "clipRectNotation": "Serialized null means no authored clip in this descriptor. Actual public stage authoring uses undefined for clipRect; never assign this null marker to the node API."
    },
    "whiteRectangle": {
      "node": "Sprite",
      "transform": {
        "x": 0,
        "y": 0,
        "scaleX": 1,
        "scaleY": 1,
        "rotation": 0,
        "alpha": 1,
        "visible": true
      },
      "graphics": {
        "rect": {
          "x": 8,
          "y": 18,
          "width": 14,
          "height": 10
        },
        "color": 16777215,
        "alpha": 1
      },
      "clips": []
    },
    "meshParent": {
      "node": "Sprite",
      "transform": {
        "x": 12,
        "y": 16,
        "scaleX": 1,
        "scaleY": 1,
        "rotation": 0,
        "alpha": 1,
        "visible": true
      },
      "clipRect": {
        "x": 0,
        "y": 0,
        "width": 24,
        "height": 24
      },
      "children": [
        "paletteMesh"
      ]
    },
    "paletteMesh": {
      "node": "Mesh2D",
      "constructor": "new Mesh2D(actualPaletteLease,actualGeometry)",
      "transform": {
        "x": 0,
        "y": 0,
        "scaleX": 1,
        "scaleY": 1,
        "rotation": 0,
        "alpha": 1,
        "visible": true
      },
      "geometry": {
        "factory": "createTexturedGeometry2D",
        "inputBrands": {
          "positions": "Float64Array",
          "uvs": "Float64Array",
          "lightColors": "Float64Array",
          "indices": "Uint32Array"
        },
        "positions": [
          0,
          0,
          32,
          0,
          32,
          32,
          0,
          32
        ],
        "uvs": [
          0,
          0,
          1,
          0,
          1,
          1,
          0,
          1
        ],
        "lightColors": [
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1
        ],
        "indices": [
          0,
          1,
          2,
          0,
          2,
          3
        ],
        "vertexCount": 4,
        "indexCount": 6,
        "triangleCount": 2,
        "logicalByteLength": 280
      },
      "sourceRect": {
        "x": 0,
        "y": 0,
        "width": 2,
        "height": 2
      },
      "screenSquare": {
        "left": 12,
        "top": 16,
        "right": 44,
        "bottom": 48
      },
      "effectiveClip": {
        "left": 12,
        "top": 16,
        "right": 36,
        "bottom": 40
      },
      "uvEquation": "u=(xCenter-12)/32, v=(yCenter-16)/32; nearest texel=(floor(2u),floor(2v)). Clipping transports original UV; it does not stretch the remaining palette into the 24x24 region."
    },
    "croppedImage": {
      "node": "Bitmap",
      "constructor": "new Bitmap(actualPaletteLease)",
      "sourceRect": {
        "x": 1,
        "y": 0,
        "width": 1,
        "height": 1
      },
      "sourceRectAssignment": "Set this through the real public Bitmap.sourceRect before capture.",
      "naturalWidth": 1,
      "naturalHeight": 1,
      "transform": {
        "x": 24,
        "y": 26,
        "scaleX": 16,
        "scaleY": 12,
        "rotation": 0,
        "alpha": 1,
        "visible": true
      },
      "screenBounds": {
        "left": 24,
        "top": 26,
        "right": 40,
        "bottom": 38
      },
      "projectedImage": {
        "width": 1,
        "height": 1,
        "pixelsRGBA": [
          255,
          255,
          0,
          255
        ]
      },
      "clips": []
    },
    "greenRectangle": {
      "node": "Sprite",
      "transform": {
        "x": 0,
        "y": 0,
        "scaleX": 1,
        "scaleY": 1,
        "rotation": 0,
        "alpha": 1,
        "visible": true
      },
      "graphics": {
        "rect": {
          "x": 30,
          "y": 28,
          "width": 14,
          "height": 8
        },
        "color": 65280,
        "alpha": 1
      },
      "clips": []
    },
    "expectedCapturedCounts": {
      "commands": 4,
      "images": 1,
      "geometries": 1,
      "sourceTriangles": 2,
      "sourceGeometryLogicalBytes": 280,
      "projectedViews": 2,
      "projectedTextureBytes": 20
    },
    "orderingMutation": "After CHN01 capture, call actual engine.stage.setChildIndex(greenRectangle,2) to obtain [whiteRectangle,meshParent,greenRectangle,croppedImage], then capture CHN02. No replacement/edited/spread frame or command is admitted.",
    "lifetime": "Keep the genuine Scope/lease/Texture/nodes live for both captures and readbacks; later native owner must settle readback+whenIdle and dispose actual resources/Engine/host according to accepted cleanup, without equating unsafe cleanup with safe return."
  },
  "observations": [
    {
      "id": "CHN01",
      "expectedFrameId": 1,
      "expectedReadbackSerial": 1,
      "stageChildOrder": [
        "whiteRectangle",
        "meshParent",
        "croppedImage",
        "greenRectangle"
      ],
      "expectedCommandKinds": [
        "rect",
        "mesh",
        "image",
        "rect"
      ],
      "sampleSet": "sharedSamples plus ui-order-overlap below",
      "frameSpecificSamples": [
        {
          "id": "ui-order-overlap",
          "x": 34,
          "y": 32,
          "expectedRGBA": [
            0,
            255,
            0,
            255
          ],
          "basis": "Green is last over cropped yellow Bitmap and palette Mesh."
        }
      ]
    },
    {
      "id": "CHN02",
      "expectedFrameId": 2,
      "expectedReadbackSerial": 2,
      "stageChildOrder": [
        "whiteRectangle",
        "meshParent",
        "greenRectangle",
        "croppedImage"
      ],
      "expectedCommandKinds": [
        "rect",
        "mesh",
        "rect",
        "image"
      ],
      "sampleSet": "same sharedSamples plus ui-order-overlap below",
      "frameSpecificSamples": [
        {
          "id": "ui-order-overlap",
          "x": 34,
          "y": 32,
          "expectedRGBA": [
            255,
            255,
            0,
            255
          ],
          "basis": "Cropped yellow Bitmap is last over green and palette Mesh; only this sampled color changes."
        }
      ]
    }
  ],
  "sharedSamples": [
    {
      "id": "background-preserved",
      "x": 4,
      "y": 4,
      "expectedRGBA": [
        0,
        0,
        0,
        255
      ],
      "basis": "Outside both scene triangles and every UI region."
    },
    {
      "id": "scene-near-depth-preserved",
      "x": 40,
      "y": 17,
      "expectedRGBA": [
        255,
        0,
        0,
        255
      ],
      "basis": "Pixel center (40.5,17.5) lies in both triangles (sum58<64), outside all UI. Near .75 was drawn before far .25."
    },
    {
      "id": "scene-far-preserved",
      "x": 10,
      "y": 12,
      "expectedRGBA": [
        0,
        0,
        255,
        255
      ],
      "basis": "Center (10.5,12.5) is inside far, outside near and every UI region."
    },
    {
      "id": "rectangle-over-far",
      "x": 9,
      "y": 24,
      "expectedRGBA": [
        255,
        255,
        255,
        255
      ],
      "basis": "White rectangle covers far blue; x9.5 is left of Mesh clip start12. UI must not use scene depth."
    },
    {
      "id": "mesh-cyan-over-near",
      "x": 24,
      "y": 22,
      "expectedRGBA": [
        0,
        255,
        255,
        255
      ],
      "basis": "Near red underneath. Mesh UV=(.390625,.203125), nearest palette texel (0,0), inside clip, above Bitmap."
    },
    {
      "id": "mesh-yellow-uv",
      "x": 34,
      "y": 22,
      "expectedRGBA": [
        255,
        255,
        0,
        255
      ],
      "basis": "Near red underneath. Mesh UV=(.703125,.203125), nearest texel (1,0), x34.5<clip right36."
    },
    {
      "id": "mesh-magenta-uv",
      "x": 20,
      "y": 35,
      "expectedRGBA": [
        255,
        0,
        255,
        255
      ],
      "basis": "Near red underneath. Mesh UV=(.265625,.609375), nearest texel (0,1); left of Bitmap x24."
    },
    {
      "id": "mesh-white-uv",
      "x": 31,
      "y": 38,
      "expectedRGBA": [
        255,
        255,
        255,
        255
      ],
      "basis": "Scene background underneath. Mesh UV=(.609375,.703125), nearest texel (1,1); below Bitmap end38 and green end36, above clip end40."
    },
    {
      "id": "mesh-clip-outside-preserves-near",
      "x": 38,
      "y": 22,
      "expectedRGBA": [
        255,
        0,
        0,
        255
      ],
      "basis": "Inside authored Mesh square but outside clip right36; near red remains. Omitted clip would expose yellow texel (1,0)."
    },
    {
      "id": "image-crop-over-mesh",
      "x": 27,
      "y": 30,
      "expectedRGBA": [
        255,
        255,
        0,
        255
      ],
      "basis": "Bitmap actual source crop selects palette texel (1,0); inside 16x12 image, left of green. Ignoring crop and stretching full palette gives cyan texel (0,0) here."
    },
    {
      "id": "rectangle-outside-image",
      "x": 41,
      "y": 32,
      "expectedRGBA": [
        0,
        255,
        0,
        255
      ],
      "basis": "Inside green x30..44,y28..36, outside Bitmap right40 and Mesh clip right36. Both schedules keep green here."
    }
  ],
  "readbackExpected": {
    "qualification": "Expected metadata, not observed results. A fresh combined host/Engine performs exactly these two captures/two submissions; no preliminary capture/render on this Engine/host may silently consume frameId/serial.",
    "width": 64,
    "height": 64,
    "byteLength": 16384,
    "bytesPerRow": 256,
    "bytesPerRowNotation": "256 is derived tight RGBA row stride and copy row pitch for width64 (4*64=256; already 256-aligned). It is not a WebGPUReadback property assertion; actual readback metadata checks use existing public fields and bytes length.",
    "format": "rgba8unorm",
    "allowedSourceFormats": [
      "rgba8unorm",
      "bgra8unorm"
    ],
    "colorSpace": "srgb",
    "alphaMode": "premultiplied",
    "renderReturn": "undefined",
    "perObservation": {
      "passes": 2,
      "submissions": 1,
      "sceneIndexedDraws": 2,
      "uiNonemptyDraws": 4
    },
    "combinedTotal": {
      "observations": 2,
      "passes": 4,
      "submissions": 2
    },
    "passOrder": [
      {
        "role": "scene",
        "colorLoadOp": "clear",
        "hasDepth": true,
        "depthClear": 0
      },
      {
        "role": "ui",
        "colorLoadOp": "load",
        "hasDepth": false
      }
    ],
    "pipelineRoles": [
      "rectangle-stride24",
      "image-stride16",
      "scene-stride24-with-MVP64-and-depth",
      "textured-Mesh2D-stride32"
    ],
    "afterEachReadbackAndIdle": "After each readback and whenIdle, public getStatus().pendingFrames/pendingUploadBytes/pendingReadbackBytes and getTexturedStatus().pendingGeometryBytes plus getSceneStatus().pendingSceneBytes/pendingUniformBytes/pendingDepthBytes must all be zero, with firstFailure absent. T20 retirement is a source-reviewed internal ownership obligation, not a public pendingTexture counter assertion. Later native resource cleanup observations are separately bounded to actually created textures after settled work; they do not prove queue safety or safe return on an unsafe close. Actual source identities and diagnostics remain required.",
    "rawBufferEvidence": "Later verifier stores both full raw byte arrays/files and actual hashes before assertions; no expected whole-buffer hash is invented.",
    "actual": null
  },
  "sensitivityControl": {
    "id": "CHNC01",
    "mode": "oracle-only assigned sensitivity after both real positives",
    "assertion": "ui-order-overlap",
    "oracleFrom": "CHN01",
    "rawBufferFrom": "CHN02",
    "x": 34,
    "y": 32,
    "expectedRGBA": [
      0,
      255,
      0,
      255
    ],
    "requiredActualRGBA": [
      255,
      255,
      0,
      255
    ],
    "zeroTolerance": true,
    "requiredOutcome": "The single named pixel assertion rejects with exact assertion/x/y/expected/actual; a setup/metadata/readback/cleanup failure does not qualify.",
    "expectedDifferingChannels": [
      "red"
    ],
    "rendererMutation": "none",
    "newBrowserFrames": 0,
    "actualOutcome": "NOT_RUN"
  },
  "coverage": {
    "perFramePixels": 12,
    "perFrameChannels": 48,
    "perFrameComparedBytes": 48,
    "perFrameTotalPixels": 4096,
    "perFrameTotalBytes": 16384,
    "positivePixelComparisons": 24,
    "positiveChannelComparisons": 96,
    "sensitivityPixelComparisons": 1,
    "exhaustiveRasterEquality": false,
    "description": "Eleven common coordinates plus one order-overlap coordinate per frame. Full raw buffers are retained as evidence, while oracle comparisons cover only these twelve fixed interior pixels."
  }
}
);
export class CombinedMetadataAssertion extends Error {
  constructor(reason, details = {}) {
    super('COMBINED_NATIVE_METADATA:' + reason);
    this.name = 'CombinedMetadataAssertion';
    this.reason = reason;
    this.details = details;
  }
}
export class CombinedPixelAssertion extends Error {
  constructor(oracleId, sample, actual, channels) {
    super('COMBINED_NATIVE_PIXEL:' + oracleId + ':' + sample.id);
    this.name = 'CombinedPixelAssertion';
    Object.assign(this, { oracleId, assertion: sample.id, x: sample.x, y: sample.y,
      expected: [...sample.expectedRGBA], actual: [...actual], channels: [...channels], zeroTolerance: true });
  }
}
export function verifyMetadata(readback, observationId) {
  const expected = FIXTURE.observations.find(value => value.id === observationId);
  if (!expected) throw new CombinedMetadataAssertion('UNKNOWN_OBSERVATION', { observationId });
  const meta = FIXTURE.readbackExpected;
  if (!readback || readback.width !== meta.width || readback.height !== meta.height
      || readback.format !== meta.format || !meta.allowedSourceFormats.includes(readback.sourceFormat)
      || readback.colorSpace !== meta.colorSpace || readback.alphaMode !== meta.alphaMode
      || readback.frameId !== expected.expectedFrameId || readback.serial !== expected.expectedReadbackSerial
      || readback.bytes?.length !== meta.byteLength) throw new CombinedMetadataAssertion('READBACK_FIELDS', { observationId });
  for (const byte of readback.bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new CombinedMetadataAssertion('BYTE_SCHEMA', { observationId });
  }
  // All bytes are retained and schema-checked; color acceptance covers only 12 interior pixels.
  return { observationId, width: readback.width, height: readback.height, byteLength: readback.bytes.length,
    frameId: readback.frameId, serial: readback.serial, format: readback.format, sourceFormat: readback.sourceFormat,
    colorSpace: readback.colorSpace, alphaMode: readback.alphaMode, derivedTightRowStride: 4 * readback.width };
}
export function samplesFor(observationId) {
  const expected = FIXTURE.observations.find(value => value.id === observationId);
  if (!expected) throw new CombinedMetadataAssertion('UNKNOWN_ORACLE', { observationId });
  return [...FIXTURE.sharedSamples, ...expected.frameSpecificSamples];
}
export function verifyPixels(readback, oracleId, { metadataId = oracleId, sampleId = null } = {}) {
  const metadata = verifyMetadata(readback, metadataId);
  const samples = samplesFor(oracleId).filter(value => sampleId === null || value.id === sampleId);
  if (samples.length !== (sampleId === null ? 12 : 1)) throw new CombinedMetadataAssertion('SAMPLE_SELECTION');
  const checks = [];
  let firstFailure = null;
  for (const sample of samples) {
    const offset = 4 * (readback.width * sample.y + sample.x);
    const actual = Array.from(readback.bytes.slice(offset, offset + 4));
    const channels = sample.expectedRGBA.map((expected, index) => actual[index] === expected);
    if (!firstFailure && (actual.length !== 4 || channels.some(value => !value))) firstFailure = new CombinedPixelAssertion(oracleId, sample, actual, channels);
    checks.push({ assertion: sample.id, x: sample.x, y: sample.y, expected: [...sample.expectedRGBA], actual,
      channels, zeroTolerance: true });
  }
  if (firstFailure) { firstFailure.checks = checks; throw firstFailure; }
  return { oracleId, metadataId, metadata, checks, sampleCoverage: 'Bounded interior samples; no whole-image color equality' };
}
export function verifySensitivity(secondReadback) {
  // This consumes CHN02 actual bytes only; it never creates a third render or altered SDK.
  return verifyPixels(secondReadback, 'CHN01', { metadataId: 'CHN02', sampleId: 'ui-order-overlap' });
}
