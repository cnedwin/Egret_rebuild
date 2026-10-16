// SPDX-License-Identifier: Apache-2.0
// Independent heldout cases sealed before implementation.
// Public API only. Metadata, expectations, UTF-16 spans, and trap order are fixed literals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtlasImportPlan } from '@egret/project/atlas';

const texts = {
  "base": "{\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\"b\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "lateLex": "{\"frames\":[],\"meta\":{\"app\":\"bad\"},\"meta\":{} /*late*/}",
  "duplicateGrammar": "{\"meta\":{},\"\\u006deta\":{},}",
  "duplicateNames": "{\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\"\\u0061\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "concernOrder": "{\"z\":false,\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"q\":null,\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "lateGeometry": "{\"z\":false,\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\"b\",\"frame\":{\"x\":-1,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":4,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"q\":null,\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "markerOrder": "{\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":7,\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "pageMismatch": "{\"z\":false,\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"q\":null,\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"other.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "rotatedTime": "{\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":true,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\"b\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":0}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "sizeConcernGeometry": "{\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\"b\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":2,\"h\":1},\"duration\":100},{\"filename\":\"c\",\"frame\":{\"x\":-1,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":4,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "unicodeNames": "{\"frames\":[{\"filename\":\"é\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\"e\\u0301\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},{\"filename\":\" \",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "emoji64": "{\"frames\":[{\"filename\":\"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "emoji65": "{\"frames\":[{\"filename\":\"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "decodedSurrogate": "{\"frames\":[{\"filename\":\"\\ud800\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "nonfinite": "{\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":1e400,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "escapedPointer": "{\"a/~b\":false,\"frames\":[{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}],\"meta\":{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}}",
  "missingRotatedCrlf": "{\r\n  \"frames\": [\r\n    {\"filename\":\"😀\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100},\r\n    {\"filename\":\"b\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}\r\n  ],\r\n  \"meta\": {\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}\r\n}"
};
const parts = {
  "meta": "{\"app\":\"https://www.aseprite.org/\",\"version\":\"1.3.18.6\",\"image\":\"atlas%#.png\",\"format\":\"RGBA8888\",\"size\":{\"w\":4,\"h\":4},\"scale\":\"1\"}",
  "frameA": "{\"filename\":\"a\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}",
  "frameB": "{\"filename\":\"b\",\"frame\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"rotated\":false,\"trimmed\":true,\"spriteSourceSize\":{\"x\":0,\"y\":0,\"w\":1,\"h\":1},\"sourceSize\":{\"w\":1,\"h\":1},\"duration\":100}",
  "totalNameFrameLength": 295,
  "totalNamePrefixLength": 11,
  "totalNameFilenameTokenWithinFrame": 12
};
const cases = [
  {
    "id": "H01",
    "text": "lateLex",
    "factory": "",
    "ok": false,
    "code": "ATLAS_JSON_SYNTAX",
    "source": "metadata",
    "pointer": "",
    "priority": "scanner comment beats early duplicate and unsupported app",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 44,
      "length": 8,
      "line": 1,
      "column": 45
    },
    "causeOwn": false,
    "message": "Metadata must be strict finite Unicode JSON.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H02",
    "text": "duplicateGrammar",
    "factory": "",
    "ok": false,
    "code": "ATLAS_JSON_DUPLICATE_KEY",
    "source": "metadata",
    "pointer": "/meta",
    "priority": "visitor duplicate beats later trailing-comma grammar fault",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 11,
      "length": 11,
      "line": 1,
      "column": 12
    },
    "relatedSpan": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 1,
      "length": 6,
      "line": 1,
      "column": 2
    },
    "causeOwn": false,
    "message": "Metadata contains a duplicate decoded key.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H03",
    "text": "duplicateNames",
    "factory": "",
    "ok": false,
    "code": "ATLAS_NAME_INVALID",
    "source": "metadata",
    "pointer": "/frames/1/filename",
    "priority": "decoded filename identity; second original value and first related value",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 192,
      "length": 8,
      "line": 1,
      "column": 193
    },
    "relatedSpan": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 23,
      "length": 3,
      "line": 1,
      "column": 24
    },
    "causeOwn": false,
    "message": "Frame names must be nonempty and unique.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H04",
    "text": "missingRotatedCrlf",
    "factory": "",
    "ok": false,
    "code": "ATLAS_SCHEMA_INVALID",
    "source": "metadata",
    "pointer": "/frames/1/rotated",
    "priority": "missing boolean field uses full completed object; CRLF and earlier astral UTF16 accounting",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 198,
      "length": 152,
      "line": 4,
      "column": 5
    },
    "causeOwn": false,
    "message": "Metadata does not have the selected schema.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H05",
    "text": "concernOrder",
    "factory": "",
    "ok": false,
    "code": "ATLAS_PROFILE_UNSUPPORTED",
    "source": "metadata",
    "pointer": "/z",
    "priority": "smallest original key offset beats schema field validation order",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 1,
      "length": 3,
      "line": 1,
      "column": 2
    },
    "causeOwn": false,
    "message": "Metadata is outside the selected atlas profile.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H06",
    "text": "lateGeometry",
    "factory": "",
    "ok": false,
    "code": "ATLAS_REGION_INVALID",
    "source": "metadata",
    "pointer": "/frames/1/frame/x",
    "priority": "late supported negative x error beats earlier unknown z and q",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 219,
      "length": 2,
      "line": 1,
      "column": 220
    },
    "causeOwn": false,
    "message": "Frame geometry is invalid.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H07",
    "text": "markerOrder",
    "factory": "profileUnknown",
    "ok": false,
    "code": "ATLAS_PROFILE_UNSUPPORTED",
    "source": "input",
    "pointer": "/profile",
    "priority": "unknown caller string profile after complete JSON structure and before marker checks",
    "causeOwn": false,
    "message": "Metadata is outside the selected atlas profile.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H08",
    "text": "markerOrder",
    "factory": "",
    "ok": false,
    "code": "ATLAS_MARKER_INVALID",
    "source": "metadata",
    "pointer": "/meta/app",
    "priority": "app wrong type beats missing version",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 195,
      "length": 1,
      "line": 1,
      "column": 196
    },
    "causeOwn": false,
    "message": "An exporter marker has the wrong primitive type.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H09",
    "text": "pageMismatch",
    "factory": "",
    "ok": false,
    "code": "ATLAS_PAGE_BINDING_INVALID",
    "source": "metadata",
    "pointer": "/meta/image",
    "priority": "binding failure beats earlier unknown concern",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 271,
      "length": 11,
      "line": 1,
      "column": 272
    },
    "causeOwn": false,
    "message": "Metadata needs one exact declared PNG binding.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H10",
    "text": "rotatedTime",
    "factory": "",
    "ok": false,
    "code": "ATLAS_TIME_INVALID",
    "source": "metadata",
    "pointer": "/frames/1/duration",
    "priority": "later supported duration failure beats earlier rotated true concern",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 343,
      "length": 1,
      "line": 1,
      "column": 344
    },
    "causeOwn": false,
    "message": "Frame durations must form a positive finite sequence.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H11",
    "text": "sizeConcernGeometry",
    "factory": "",
    "ok": false,
    "code": "ATLAS_REGION_INVALID",
    "source": "metadata",
    "pointer": "/frames/2/frame/x",
    "priority": "late negative x failure beats earlier cross-frame source-size concern",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 378,
      "length": 2,
      "line": 1,
      "column": 379
    },
    "causeOwn": false,
    "message": "Frame geometry is invalid.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H12",
    "text": "unicodeNames",
    "factory": "",
    "ok": true,
    "names": [
      "é",
      "é",
      " "
    ],
    "priority": "exact Unicode identity and whitespace allowed; public ownership and freeze checks required"
  },
  {
    "id": "H13",
    "text": "emoji64",
    "factory": "",
    "ok": true,
    "nameUtf16Units": 128,
    "nameUtf8Bytes": 256,
    "priority": "128 UTF16 units accepted; astral scalar measured as two units"
  },
  {
    "id": "H14",
    "text": "emoji65",
    "factory": "",
    "ok": false,
    "code": "ATLAS_LIMIT_EXCEEDED",
    "source": "metadata",
    "pointer": "/frames/0/filename",
    "priority": "130 UTF16 units fails despite only 260 UTF8 bytes",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 23,
      "length": 132,
      "line": 1,
      "column": 24
    },
    "causeOwn": false,
    "message": "Input exceeds an atlas planning limit.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H15",
    "text": "",
    "factory": "totalNames256",
    "ok": true,
    "totalNameUtf16Units": 32768,
    "priority": "total 256 times 128 exactly accepted"
  },
  {
    "id": "H16",
    "text": "",
    "factory": "totalNames257",
    "ok": false,
    "code": "ATLAS_LIMIT_EXCEEDED",
    "source": "metadata",
    "pointer": "/frames/256/filename",
    "priority": "257th name raises running total from 32768 to 32896; maxFrames remains below 1024",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 75799,
      "length": 130,
      "line": 1,
      "column": 75800
    },
    "causeOwn": false,
    "message": "Input exceeds an atlas planning limit.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H17",
    "text": "decodedSurrogate",
    "factory": "",
    "ok": false,
    "code": "ATLAS_JSON_SYNTAX",
    "source": "metadata",
    "pointer": "",
    "priority": "scanner decoded Unicode fault before JSON tree or schema",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 23,
      "length": 8,
      "line": 1,
      "column": 24
    },
    "causeOwn": false,
    "message": "Metadata must be strict finite Unicode JSON.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H18",
    "text": "nonfinite",
    "factory": "",
    "ok": false,
    "code": "ATLAS_JSON_SYNTAX",
    "source": "metadata",
    "pointer": "/frames/0/frame/x",
    "priority": "visitor rejects finite-number overflow before schema geometry",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 40,
      "length": 5,
      "line": 1,
      "column": 41
    },
    "causeOwn": false,
    "message": "Metadata must be strict finite Unicode JSON.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H19",
    "text": "escapedPointer",
    "factory": "",
    "ok": false,
    "code": "ATLAS_PROFILE_UNSUPPORTED",
    "source": "metadata",
    "pointer": "/a~1~0b",
    "priority": "unknown concern key uses decoded pointer escaping and original full key token",
    "span": {
      "source": "metadata",
      "sourceId": "heldout-source",
      "offset": 1,
      "length": 6,
      "line": 1,
      "column": 2
    },
    "causeOwn": false,
    "message": "Metadata is outside the selected atlas profile.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H20",
    "text": "base",
    "factory": "protoUndefined",
    "ok": false,
    "code": "ATLAS_READ_FAILED",
    "source": "input",
    "pointer": "",
    "causeOwn": true,
    "trapLog": [
      "getPrototypeOf"
    ],
    "getterCalls": 0,
    "priority": "root getPrototypeOf throws undefined once",
    "message": "Reading an input descriptor failed.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H21",
    "text": "base",
    "factory": "keysUndefined",
    "ok": false,
    "code": "ATLAS_READ_FAILED",
    "source": "input",
    "pointer": "",
    "causeOwn": true,
    "trapLog": [
      "getPrototypeOf",
      "ownKeys"
    ],
    "getterCalls": 0,
    "priority": "root ownKeys throws undefined once",
    "message": "Reading an input descriptor failed.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H22",
    "text": "base",
    "factory": "descriptorUndefined",
    "ok": false,
    "code": "ATLAS_READ_FAILED",
    "source": "input",
    "pointer": "/source",
    "causeOwn": true,
    "trapLog": [
      "getPrototypeOf",
      "ownKeys",
      "descriptor:profile",
      "descriptor:source"
    ],
    "getterCalls": 0,
    "priority": "root descriptor source throws undefined once",
    "message": "Reading an input descriptor failed.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H23",
    "text": "base",
    "factory": "accessor",
    "ok": false,
    "code": "ATLAS_INPUT_INVALID",
    "source": "input",
    "pointer": "/profile",
    "causeOwn": false,
    "trapLog": [
      "getPrototypeOf",
      "ownKeys",
      "descriptor:profile"
    ],
    "getterCalls": 0,
    "priority": "root profile accessor rejected without invoking getter or later descriptors",
    "message": "Input must use the supported data descriptors.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H24",
    "text": "base",
    "factory": "borrowedCause",
    "ok": false,
    "code": "ATLAS_READ_FAILED",
    "source": "input",
    "pointer": "",
    "causeOwn": true,
    "trapLog": [
      "getPrototypeOf"
    ],
    "getterCalls": 0,
    "priority": "untrusted external cause with code/name/message getters is preserved uninspected and unfrozen",
    "message": "Reading an input descriptor failed.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H25",
    "text": "base",
    "factory": "captureBeforeScalar",
    "ok": false,
    "code": "ATLAS_INPUT_INVALID",
    "source": "input",
    "pointer": "/page/assetId",
    "causeOwn": false,
    "trapLog": [],
    "getterCalls": 0,
    "priority": "page accessor structure rejection beats earlier invalid source.text primitive",
    "message": "Input must use the supported data descriptors.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  },
  {
    "id": "H26",
    "text": "base",
    "factory": "nestedUndefined",
    "ok": false,
    "code": "ATLAS_READ_FAILED",
    "source": "input",
    "pointer": "/source/provenance",
    "causeOwn": true,
    "trapLog": [
      "getPrototypeOf",
      "ownKeys"
    ],
    "getterCalls": 0,
    "priority": "nested provenance reflection fault beats earlier invalid source.text primitive",
    "message": "Reading an input descriptor failed.",
    "severity": "error",
    "resultDiagnosticsLength": 1
  }
];

function prepare(id, texts, parts) {
  const observations = { trapLog: [], getterCalls: 0, causeGetterCalls: 0 };
  const provenance = () => ({
    origin: 'first-party synthetic heldout preparation',
    license: 'Apache-2.0',
    notice: 'Not exporter output; planning-only fixture.'
  });
  let text = texts.base;
  const textById = {
    H01: 'lateLex', H02: 'duplicateGrammar', H03: 'duplicateNames',
    H04: 'missingRotatedCrlf', H05: 'concernOrder', H06: 'lateGeometry',
    H07: 'markerOrder', H08: 'markerOrder', H09: 'pageMismatch',
    H10: 'rotatedTime', H11: 'sizeConcernGeometry', H12: 'unicodeNames',
    H13: 'emoji64', H14: 'emoji65', H17: 'decodedSurrogate',
    H18: 'nonfinite', H19: 'escapedPointer'
  };
  if (textById[id]) text = texts[textById[id]];
  if (id === 'H15' || id === 'H16') {
    const count = id === 'H15' ? 256 : 257;
    const frames = [];
    for (let i = 0; i < count; i++) {
      // Exactly three ASCII hex digits plus 125 ASCII 'a' units; all unique.
      const name = i.toString(16).padStart(3, '0') + 'a'.repeat(125);
      frames.push(parts.frameA.replace('"filename":"a"', '"filename":"' + name + '"'));
    }
    text = '{"frames":[' + frames.join(',') + '],"meta":' + parts.meta + '}';
  }
  let input = {
    profile: 'aseprite-json-array-1.3.18.6-v1',
    source: { id: 'heldout-source', text, provenance: provenance() },
    page: { pageName: 'atlas%#.png', assetId: 'opaque:heldout',
      width: 4, height: 4, provenance: provenance() }
  };
  let borrowedCause;
  if (id === 'H07') input.profile = 'aseprite-json-array-unknown';
  if (id === 'H20' || id === 'H24') {
    if (id === 'H24') {
      borrowedCause = { witness: 1 };
      for (const key of ['name', 'code', 'message']) {
        Object.defineProperty(borrowedCause, key, {
          configurable: true,
          get() { observations.causeGetterCalls++; throw 'cause inspected'; }
        });
      }
    }
    input = new Proxy(input, {
      getPrototypeOf() {
        observations.trapLog.push('getPrototypeOf');
        throw borrowedCause; // H20 genuinely throws undefined.
      }
    });
  }
  if (id === 'H21') {
    input = new Proxy(input, {
      getPrototypeOf(target) {
        observations.trapLog.push('getPrototypeOf');
        return Reflect.getPrototypeOf(target);
      },
      ownKeys() { observations.trapLog.push('ownKeys'); throw undefined; }
    });
  }
  if (id === 'H22' || id === 'H23') {
    if (id === 'H23') Object.defineProperty(input, 'profile', {
      enumerable: true, configurable: true,
      get() { observations.getterCalls++; throw 'getter invoked'; }
    });
    input = new Proxy(input, {
      getPrototypeOf(target) {
        observations.trapLog.push('getPrototypeOf');
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        observations.trapLog.push('ownKeys');
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        observations.trapLog.push('descriptor:' + key);
        if (id === 'H22' && key === 'source') throw undefined;
        return Reflect.getOwnPropertyDescriptor(target, key);
      }
    });
  }
  if (id === 'H25') {
    input.source.text = 42;
    Object.defineProperty(input.page, 'assetId', {
      enumerable: true, configurable: true,
      get() { observations.getterCalls++; throw 'getter invoked'; }
    });
  }
  if (id === 'H26') {
    input.source.text = 42;
    input.source.provenance = new Proxy(input.source.provenance, {
      getPrototypeOf(target) {
        observations.trapLog.push('getPrototypeOf');
        return Reflect.getPrototypeOf(target);
      },
      ownKeys() { observations.trapLog.push('ownKeys'); throw undefined; }
    });
  }
  return { input, observations, borrowedCause };
}


// Traverse only the public returned graph. The borrowed cause is excluded before reflection.
function publicContainers(value, borrowedCause) {
  const seen = new Set();
  function visit(current) {
    if (current === borrowedCause || current === null || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(current))) {
      if (Object.hasOwn(descriptor, 'value')) visit(descriptor.value);
    }
  }
  visit(value);
  return seen;
}

function assertFrozenPublic(value, borrowedCause) {
  for (const container of publicContainers(value, borrowedCause)) {
    assert.equal(Object.isFrozen(container), true, 'every public result container must be frozen');
  }
}

function assertSpan(actualDiagnostic, expected, field) {
  assert.equal(Object.hasOwn(actualDiagnostic, field), Object.hasOwn(expected, field), field + ' presence');
  if (!Object.hasOwn(expected, field)) return;
  for (const key of ['source', 'sourceId', 'offset', 'length', 'line', 'column']) {
    assert.equal(actualDiagnostic[field][key], expected[field][key], field + '.' + key);
  }
}

function assertFailure(result, expected, fixture) {
  assert.equal(result.ok, false);
  assert.equal(Object.hasOwn(result, 'value'), false, 'no partial plan');
  assert.equal(Array.isArray(result.diagnostics), true);
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = result.diagnostics[0];
  for (const key of ['code', 'source', 'pointer', 'severity', 'message']) {
    assert.equal(diagnostic[key], expected[key], expected.id + ' diagnostic.' + key);
  }
  assertSpan(diagnostic, expected, 'span');
  assertSpan(diagnostic, expected, 'relatedSpan');
  assert.equal(Object.hasOwn(diagnostic, 'cause'), expected.causeOwn);
  if (expected.causeOwn) assert.equal(diagnostic.cause, fixture.borrowedCause);
  assertFrozenPublic(result, fixture.borrowedCause);
  if (Object.hasOwn(expected, 'trapLog')) {
    assert.deepEqual(fixture.observations.trapLog, expected.trapLog);
    assert.equal(fixture.observations.getterCalls, 0);
  }
  assert.equal(fixture.observations.causeGetterCalls, 0);
  if (expected.id === 'H24') {
    assert.equal(diagnostic.cause, fixture.borrowedCause);
    assert.equal(Object.isFrozen(fixture.borrowedCause), false);
    assert.deepEqual(Object.getOwnPropertyDescriptor(fixture.borrowedCause, 'witness'), {
      value: 1, enumerable: true, configurable: true, writable: true
    });
    fixture.borrowedCause.witness = 2;
    assert.equal(diagnostic.cause.witness, 2, 'cause intentionally remains borrowed');
    assert.equal(fixture.observations.causeGetterCalls, 0);
  }
}

const successSourceBytes = { H12: 665, H13: 575, H15: 75927 };
const expectedLayout = {
  sourceWidth: 1, sourceHeight: 1, trimX: 0, trimY: 0, packedRotation: 0
};

function successfulNames(id) {
  if (id === 'H12') return ['\u00e9', 'e\u0301', ' '];
  if (id === 'H13') return ['😀'.repeat(64)];
  // An independent nibble spelling of the sealed three-hex-digit name rule.
  const digits = '0123456789abcdef';
  return Array.from({ length: 256 }, (_, index) =>
    digits[(index >> 8) & 15] + digits[(index >> 4) & 15] + digits[index & 15] + 'a'.repeat(125));
}

function assertSuccess(result, expected, input, inputRecords) {
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  const plan = result.value;
  assert.equal(plan.planVersion, 1);
  assert.equal(plan.profile, 'aseprite-json-array-1.3.18.6-v1');
  assert.equal(plan.exportVersion, '1.3.18.6');
  assert.deepEqual(plan.acceptance, {
    exporterArtifact: 'unverified', assetPixels: 'not_run', runtimeComposition: 'not_run',
    rendering: 'not_run', licenseEntitlement: 'unverified'
  });
  assert.deepEqual(plan.page, {
    pageName: 'atlas%#.png', assetId: 'opaque:heldout', width: 4, height: 4,
    provenance: {
      origin: 'first-party synthetic heldout preparation', license: 'Apache-2.0',
      notice: 'Not exporter output; planning-only fixture.'
    }
  });
  assert.equal(plan.sourceDeclarations.metadata.id, 'heldout-source');
  assert.deepEqual(plan.sourceDeclarations.metadata.provenance, input.source.provenance);
  assert.equal(plan.sourceDeclarations.metadata.hashVerification, 'declared_unverified');
  assert.equal(plan.sourceDeclarations.metadata.utf8Bytes, successSourceBytes[expected.id]);
  const names = successfulNames(expected.id);
  assert.deepEqual(plan.names, names);
  assert.equal(plan.spriteSheetFrames.length, names.length);
  assert.equal(plan.sequenceInput.frames.length, names.length);
  assert.equal(plan.origins.length, names.length);
  assert.equal(plan.sequenceInput.atlasWidth, 4);
  assert.equal(plan.sequenceInput.atlasHeight, 4);
  const frames = new Set();
  const layouts = new Set();
  for (let index = 0; index < names.length; index++) {
    const sheet = plan.spriteSheetFrames[index];
    const sequence = plan.sequenceInput.frames[index];
    assert.deepEqual(sheet, { name: names[index], x: 0, y: 0, width: 1, height: 1, layout: expectedLayout });
    assert.deepEqual(sequence, { x: 0, y: 0, width: 1, height: 1, durationSeconds: 0.1, layout: expectedLayout });
    assert.equal(frames.has(sheet), false, 'fresh sheet frame');
    frames.add(sheet);
    assert.equal(frames.has(sequence), false, 'fresh sequence frame and independent branches');
    frames.add(sequence);
    assert.equal(layouts.has(sheet.layout), false, 'fresh sheet layout');
    layouts.add(sheet.layout);
    assert.equal(layouts.has(sequence.layout), false, 'fresh sequence layout and independent branches');
    layouts.add(sequence.layout);
    assert.equal(plan.origins[index].index, index);
    assert.equal(plan.origins[index].pointer, '/frames/' + index);
  }
  assert.equal(frames.size, names.length * 2);
  assert.equal(layouts.size, names.length * 2);
  if (expected.id === 'H13') {
    assert.equal(plan.names[0].length, 128);
    assert.equal(Buffer.byteLength(plan.names[0], 'utf8'), 256);
  }
  if (expected.id === 'H15') {
    assert.equal(new Set(plan.names).size, 256);
    assert.equal(plan.names.reduce((sum, name) => sum + name.length, 0), 32768);
    for (const name of plan.names) assert.equal(name.length, 128);
  }
  assertFrozenPublic(result);
  const returnedRecords = publicContainers(result);
  for (const record of inputRecords) {
    assert.equal(returnedRecords.has(record), false, 'no input record alias in public output');
    assert.equal(Object.isFrozen(record), false, 'input records must remain mutable');
  }
  const captured = JSON.stringify(result);
  input.page.width = 99;
  input.page.assetId = 'changed-asset';
  input.page.provenance.notice = 'changed-page-notice';
  input.source.id = 'changed-source';
  input.source.text = '{}';
  input.source.provenance.notice = 'changed-source-notice';
  assert.equal(input.page.width, 99);
  assert.equal(input.source.id, 'changed-source');
  assert.equal(input.page.provenance.notice, 'changed-page-notice');
  assert.equal(input.source.provenance.notice, 'changed-source-notice');
  assert.equal(JSON.stringify(result), captured, 'input mutation must not affect captured plan');
}

for (const expected of cases) {
  test('atlas heldout ' + expected.id + ': ' + expected.priority, () => {
    const fixture = prepare(expected.id, texts, parts);
    // Success inputs have no traps. Never pre-inspect a Proxy fixture.
    const inputRecords = expected.ok ? publicContainers(fixture.input) : undefined;
    if (expected.ok) {
      assert.equal(inputRecords.size, 5);
      for (const record of inputRecords) assert.equal(Object.isFrozen(record), false);
      assert.equal(Buffer.byteLength(fixture.input.source.text, 'utf8'), successSourceBytes[expected.id]);
    }
    const result = createAtlasImportPlan(fixture.input);
    if (expected.ok) assertSuccess(result, expected, fixture.input, inputRecords);
    else assertFailure(result, expected, fixture);
  });
}
