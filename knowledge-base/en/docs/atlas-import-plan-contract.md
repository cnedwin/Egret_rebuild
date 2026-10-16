# Atlas import planning contract

English | [简体中文](../../Cns/docs/atlas-import-plan-contract.md) · [Normalized atlas frames](atlas-frame-layout-contract.md) · [Evidence and limits](atlas-import-plan-evidence.md)

An atlas metadata file can describe packed crops, logical sprite sizes and frame durations, but it does not identify a loaded Texture or establish whether an exporter feature can be represented by the runtime. The optional `@egret/project/atlas` entry converts strict JSON text and one explicit PNG binding into owned inputs for the existing SpriteSheet and SequenceClip factories. It performs synchronous metadata planning without loading images, editing projects, creating resources or advancing a clock.

The selected profile is exactly `aseprite-json-array-1.3.18.6-v1`: one declared stable `1.3.18.6` JSON-array page, `RGBA8888`, scale string `"1"` and unrotated frames. Success admits this bounded profile; it does not certify Aseprite exporter compatibility, producer identity, pixels, hashes, entitlement, playback or rendering. The actual marker in a commercial release's original output remains unverified. Source research predicts `1.3.18.6-dev` for an ordinary clean exact-tag Git build; that value and fallback `1.x-dev` are refused. There is no `1.3.x` wildcard or inferred release-artifact identity.

## Explicit input and public API

The entry has exactly two runtime values, `createAtlasImportPlan` and frozen `ATLAS_IMPORT_LIMITS`. The `@egret/project` root does not re-export them. There is no default export, public error class, test hook or unknown-field passthrough. Its dependencies remain `@egret/contracts` and `jsonc-parser` 3.3.1; its only project reference is contracts. It adds no Engine, Runtime or Host dependency or API. The ES2022/NodeNext configuration, `lib: ["ES2022"]`, `types: []`, strict flags, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` remain in force; product code is DOM/Node-free.

```ts
function createAtlasImportPlan(input: unknown): AtlasImportResult;
const ATLAS_IMPORT_LIMITS: Readonly<AtlasImportLimits>;
```

Exactly sixteen erased names describe this interface:

| Type-only name | Contract |
| --- | --- |
| `AtlasImportProfile` | Literal `aseprite-json-array-1.3.18.6-v1` |
| `AtlasProvenance` | Readonly `origin`, `license`, `notice` strings and optional `sha256` string |
| `AtlasTextSource` | Readonly `id`, `text`, `provenance` |
| `AtlasPageBinding` | Readonly `pageName`, `assetId`, `width`, `height`, `provenance` |
| `AtlasImportInput` | Readonly `profile`, `source: AtlasTextSource`, `page: AtlasPageBinding` |
| `AtlasSourceSpan` | Readonly `source: 'metadata'`, `sourceId`, `offset`, `length`, `line`, `column` |
| `AtlasImportDiagnosticCode` | The thirteen literal codes in the diagnostic table |
| `AtlasImportDiagnostic` | Readonly `code`, `severity: 'error'`, `source: 'input' \| 'metadata'`, `pointer`, `message`; optional `span`, `relatedSpan`, `cause: unknown` |
| `AtlasNormalizedFrameLayout` | Readonly numeric `sourceWidth`, `sourceHeight`, `trimX`, `trimY`, and literal `packedRotation: 0` |
| `AtlasSpriteSheetFrame` | Readonly `name`, numeric `x/y/width/height`, `layout: AtlasNormalizedFrameLayout` |
| `AtlasSequenceFrame` | Readonly numeric `x/y/width/height/durationSeconds`, `layout: AtlasNormalizedFrameLayout` |
| `AtlasSequenceInput` | Readonly numeric `atlasWidth/atlasHeight` and readonly `frames: readonly AtlasSequenceFrame[]` |
| `AtlasFrameOrigin` | Readonly numeric `index`, string `pointer`, and spans `name/frame/sourceSize/spriteSourceSize/duration` |
| `AtlasImportPlan` | The owned plan described below |
| `AtlasImportResult` | `{ readonly ok: true; readonly value: AtlasImportPlan; readonly diagnostics: readonly [] }` or `{ readonly ok: false; readonly diagnostics: readonly [AtlasImportDiagnostic] }` |
| `AtlasImportLimits` | Readonly numeric properties for every limit listed below |

All properties and nested plan structures are readonly. Types import no SDK module. A successful plan contains `planVersion: 1`, its exact profile, `exportVersion: '1.3.18.6'`, the copied page, ordered `names`, `spriteSheetFrames`, `sequenceInput` and `origins`. `sourceDeclarations.metadata` contains the copied `id/provenance`, original-text `utf8Bytes`, and `hashVerification: 'declared_unverified'`. It does not retain source text or the private JSON tree. Its `acceptance` fields are exactly `exporterArtifact: 'unverified'`, `assetPixels: 'not_run'`, `runtimeComposition: 'not_run'`, `rendering: 'not_run'` and `licenseEntitlement: 'unverified'`.

The plan owns and deeply freezes all its records and arrays. No input record or array is retained; strings and numbers are copied as values. Names and both factory inputs preserve array order. Every frame and layout is independently allocated, including between the sheet and sequence branches; matching crops are not merged. There is no Texture, lease, Engine, file operation or implicit PNG discovery in a plan. Failure diagnostic containers are frozen, but a real reflection `cause` is a deliberate borrowed exception: its `name/code/message` are not read and it is not recursively frozen. No zero-alias promise applies to that cause.

## A supported call and independent factory admission

This original programmatic metadata illustrates the selected shape; it is not a captured exporter output. `originalFullAtlasLease` is a separately acquired caller-owned lease whose Texture view covers the full 4×4 atlas. `resources` is an existing genuine Scope. These declarations stand for the application's existing resource setup; the planner supplies none of them.

```ts
import { createAtlasImportPlan } from '@egret/project/atlas';
import { createSequenceClip, createSpriteSheet } from '@egret/engine';

const provenance = {
  origin: 'Original programmatic fixture',
  license: 'Apache-2.0',
  notice: 'Egret community fixture',
};
const result = createAtlasImportPlan({
  profile: 'aseprite-json-array-1.3.18.6-v1',
  source: {
    id: 'metadata:original', provenance,
    text: '{"frames":[{"filename":"idle","frame":{"x":0,"y":0,"w":2,"h":2},"rotated":false,"trimmed":true,"spriteSourceSize":{"x":1,"y":1,"w":2,"h":2},"sourceSize":{"w":4,"h":4},"duration":125}],"meta":{"app":"https://www.aseprite.org/","version":"1.3.18.6","image":"atlas.png","format":"RGBA8888","size":{"w":4,"h":4},"scale":"1"}}',
  },
  page: { pageName: 'atlas.png', assetId: 'page:original',
    width: 4, height: 4, provenance },
});
if (result.ok) {
  const plan = result.value;
  const sheet = resources.use(createSpriteSheet(
    originalFullAtlasLease, plan.spriteSheetFrames, 'trim-rotation-v1'));
  const clip = createSequenceClip(plan.sequenceInput, 'trim-rotation-v1');
  // Adopt created Bitmaps into a Scope; use existing playback APIs separately.
} else {
  // Escape diagnostic text and source IDs for the application's output context.
  console.log(result.diagnostics[0]);
}
```

The engine factories independently re-admit the normalized data and enforce their resource, layout and timing contracts. Planner success does not authenticate the lease or connect `assetId` to it. Keep the caller's lease and Texture lifetime ownership; sheet disposal does not release them. Playback uses the existing clock and player APIs. The importer does not implement placement matrices, UVs, rotation unpacking, renderer logic, pixel cropping or resource management. See the [normalized atlas-frame contract](atlas-frame-layout-contract.md).

## Capturing records and declaring the page

Input records must have `Object.prototype` or null prototype; arrays, functions and class instances are refused. Keys must be exact own enumerable string data descriptors. Symbols, accessors, missing fields and extra fields are refused without calling getters. Capture root fields in `profile/source/page` order, source in `id/text/provenance` order, page in `pageName/assetId/width/height/provenance` order, and each provenance in `origin/license/notice/sha256` order, with `sha256` optional.

For each record, perform `Array.isArray`, `getPrototypeOf`, `ownKeys`, then own-descriptor reads in that fixed order. A structural refusal stops immediately. Each reflection operation runs only once, with its catch limited to that operation; a revoked proxy is not probed again. A real throw yields `ATLAS_READ_FAILED` at the current container pointer for record operations or field pointer for descriptor operations. The diagnostic always owns `cause`, even when the thrown value is `undefined`. An invocation-private sentinel distinguishes internal refusals; externally supplied `error.name/code` cannot impersonate one. Capture the complete record tree before checking primitive values or budgets; do not continue after a structural refusal to search for a later fault. Arbitrary proxy side effects are not rolled back.

`source.id` and `assetId` must be nonempty well-formed Unicode strings; no whitespace-trimming requirement is added. `text` must be a primitive string. Required provenance strings are nonempty well-formed Unicode; optional `sha256` is exactly 64 lowercase hexadecimal characters. All are declarations, not verified origin, rights, original hashes or license entitlement. Page dimensions are positive safe integers. Input scalar/provenance failures have `source: 'input'` and no fabricated text span.

Caller `/page/pageName` admission occurs after complete record capture, during scalar/budget checks and before JSON scanning or metadata semantics. A wrong primitive type returns `ATLAS_INPUT_INVALID`; a primitive string with an invalid portable PNG basename shape returns `ATLAS_PAGE_BINDING_INVALID`; exceeding the page-name UTF-8 budget returns `ATLAS_LIMIT_EXCEEDED`. These caller-side refusals use `source: 'input'` and have no metadata span; metadata-origin refusals are diagnosed separately. `pageName` and `meta.image` must each be a case-preserving portable PNG basename: a nonempty stem followed by exact lowercase `.png`, at most 255 UTF-8 bytes, no slash or backslash. Existing portable-path rules refuse control/DEL, `: * ? " < > |`, empty/dot segments, trailing spaces/dots and Windows reserved device names. `%` and `#` are ordinary filename characters, not URL syntax. Do not normalize Unicode, NFC or case, append extensions, or discover adjacent files. The two names must match exactly by UTF-16 units, and `meta.size` must exactly match the explicit width/height. `assetId` is an opaque identity and triggers no resource lookup.

## Fixed admission limits

`ATLAS_IMPORT_LIMITS` is frozen. These are planner policy ceilings, not vendor maximums, device capacities or performance measurements. All applicable ceilings apply together.

| `AtlasImportLimits` property | Fixed ceiling and accounting |
| --- | --- |
| `maxSourceUtf8Bytes` | 1048576, original text encoded as UTF-8; not an authenticated file hash |
| `maxJsonDepth` | 16; root object/array has depth 1 |
| `maxJsonNodes` / `maxJsonProperties` | 65536 / 49152; objects, arrays and literals are nodes, keys are separate properties |
| `maxJsonKeyUtf8Bytes` / `maxJsonStringUtf8Bytes` | 256 / 4096, decoded values; every JSON field is charged |
| `maxSourceIdUtf8Bytes` / `maxAssetIdUtf8Bytes` | 256 / 256 |
| `maxNameUtf8Bytes` / `maxNameUtf16Units` / `maxTotalNameUtf16Units` | 1024 / 128 / 32768 |
| `maxPageNameUtf8Bytes` / `maxFrames` | 255 / 1024; at least 1 frame |
| `maxAtlasEdge` / `maxAtlasPixels` | 4096 / 1048576; positive edges and safe area |
| `maxSourceDimension` / `maxDurationMilliseconds` | 65535 / 65535; positive integers |
| `maxProvenanceFieldUtf8Bytes` / `maxProvenanceTotalUtf8Bytes` | 4096 / 24576; all source and page `origin/license/notice/sha256` values, source before page |
| `maxDiagnosticPointerUtf8Bytes` | 2048; the exact rejection-span rule appears below |

Except for original text, UTF-8 accounting uses decoded Unicode rather than the raw length of JSON escapes. Names contain 1–128 UTF-16 units and obey both UTF-8 and total-unit budgets. Preserve decoded names exactly: no trim, truncation, rename, normalization or sort. Nonempty all-whitespace names are allowed; exact duplicates are refused. Crop overlap is allowed.

Numeric fields reject strings, coercion, nonfinite, fractional and unsafe values; zero coordinates become `+0`. JSON `1.0` or `1e2` is acceptable when its parsed value satisfies the integer constraint. Invalid raw text Unicode is `ATLAS_JSON_SYNTAX`; invalid Unicode in other input strings is `ATLAS_INPUT_INVALID`. Budget excess is `ATLAS_LIMIT_EXCEEDED`. Positive safe geometry integers above policy ceilings use LIMIT; other invalid geometry uses REGION. Duration wrong type, negative, zero or fractional uses TIME; a positive integer over its policy ceiling uses LIMIT.

## Strict JSON and refusal precedence

Admission has a deliberate schedule; there is no global earliest-character rule.

1. Capture the complete input record tree, then admit primitive values, Unicode and budgets. A non-string or malformed-Unicode caller profile returns `ATLAS_INPUT_INVALID` with `source: 'input'` and pointer `/profile`, without `span`, `relatedSpan` or `cause`; structural or reflection failures during complete capture still take priority. A well-formed unknown profile has no additional profile-length ceiling. Defer its `ATLAS_PROFILE_UNSUPPORTED` refusal until complete JSON parsing succeeds and stage 4 reaches caller-profile admission; that refusal also uses `source: 'input'`, pointer `/profile` and no `span`, `relatedSpan` or `cause`.
2. Check raw Unicode and source UTF-8 size; a leading raw BOM is syntax at offset 0, length 1. Scan the complete original text to EOF using `createScanner(text, false)`, rejecting token errors, comments/unknown tokens, invalid decoded Unicode and excess depth without constructing a tree. A later lexical/depth fault therefore precedes an earlier duplicate, schema or unsupported concern.
3. Use only the retained private JSON foundation's public jsonc-parser 3.3.1 `visit` as grammar authority, with `disallowComments: true`, `allowTrailingComma: false`, `allowEmptyContent: false`. Build an ordered property/node tree. Detect decoded duplicate keys with a Map; check node/property/string/key/pointer budgets and finite numbers in callbacks. The first callback refusal ends processing. An early duplicate can precede a later grammar fault; complete grammar is not promised before duplicates. Schema and unsupported interpretation wait for the complete visitor to succeed, so a late grammar fault precedes an early unsupported concern.
4. Admit root-object and required `frames/meta` structure, then caller profile, then `meta.app/version/format/scale` in that exact order. Missing markers, wrong primitive types and unknown values have distinct codes. Object-valued `frames` is unsupported JSON-hash and is never sorted; other non-array shapes are schema errors.
5. Validate supported required schema, geometry, timing, names and page binding, starting with `meta.image/size` and then frames in array order. Retain unknown fields and known unsupported extensions as concerns until all supported checks finish. A later invalid frame defeats an earlier readable unsupported field. If concerns remain, select the one with the smallest original JSON key offset, not the order in which schema fields were inspected.
6. Only with no concern create and freeze the public plan. A declared admission refusal returns one fatal diagnostic, no partial plan and no earlier warnings. Unexpected internal exceptions propagate; do not disguise them as reflection READ_FAILED or promise recovery from OOM.

Root keys are only `frames/meta`. Required meta keys are `app/version/image/format/size/scale`; `size` has only `w/h`. A frame has exactly `filename/frame/rotated/trimmed/spriteSourceSize/sourceSize/duration`; `frame` and `spriteSourceSize` have only `x/y/w/h`, and `sourceSize` only `w/h`. Wrong or missing required fields use schema or their specific name/numeric code. Unknown fields are deferred concerns even when their values are `false` or `null`.

`meta.app` allows only `http://www.aseprite.org/` or `https://www.aseprite.org/`; version is exactly `1.3.18.6`, format exactly `RGBA8888`, and scale the string `"1"`. `meta.frameTags/layers/slices` may be absent or empty arrays; nonarrays are schema errors and nonempty arrays unsupported. Pivot/center, nine-slice, mesh/polygon and any multipage/textures/related_multi_packs marker are not consumed and produce concerns. TexturePacker hash formats, rotation-direction inference, tags/layers/slices semantics, `.ase` binaries, Spine, exporter generation and legacy migration are outside this profile. This slice does not close all P04, full Spine R020/V020 or migration R008/V006, and adds no animated resource-replacement or performance guarantee.

## Geometry, time and provenance of each frame

Translate `frame.x/y/w/h` to packed `x/y/width/height` without changing their meaning. Coordinates are nonnegative, dimensions positive, sums safe and crops contained by `meta.size`. `sourceSize.w/h` becomes layout `sourceWidth/sourceHeight`; `spriteSourceSize.x/y` becomes `trimX/trimY`. Its declared visible `w/h` is positive, offsets nonnegative, and offsets plus visible sizes fit sourceSize. With `rotated: false`, visible `w/h` must also equal packed `w/h`, and output `packedRotation` is the literal `0`. `rotated: true` is a deferred unsupported concern; do not infer unpacked dimensions or rotation direction from it. Other rotated types are schema errors.

`trimmed: false` requires zero offsets and visible size equal to sourceSize; `true` does not require actual shrinkage. All frames must have the same sourceSize; a mismatch is a deferred unsupported concern. Required boolean type errors are schema errors. Legal 1×1 transparent placeholders are not rejected based on JSON: the planner cannot inspect alpha or infer the author's empty-frame intent.

Duration is an integer 1–65535 milliseconds, divided by 1000 exactly once to obtain seconds. Binary64 accumulation follows array order and must remain finite and strictly increasing. There is no default frame rate or tick quantization. Each `origins` item retains the frame index/pointer and original spans for filename, frame, sourceSize, spriteSourceSize and duration.

## Original-text diagnostics

Spans refer to unnormalized `source.text` UTF-16 units. `offset/length` are zero-based half-open ranges; `line/column` are one-based and columns count UTF-16 units. CRLF is one line break; lone CR or LF is also a line break. `span.source` is always `metadata`; `sourceId` is the captured source ID. Strings, numbers, booleans and null use their complete original literal token, including quotes/escapes for strings. Key spans include the complete quoted key. Completed object/array spans extend through the closing delimiter using the actual end-callback offset plus length, rather than the opening character alone.

Invalid semantic values identify the value span. A missing required field points to that field and uses the complete containing-object span. Unknown fields use key spans. A duplicate decoded key identifies the second key and relates the first key; a duplicate filename does the same for the two values. EOF grammar errors may have length 0; other syntax spans use the public parser API's offset/length without invented enlargement. Scanner diagnostics have pointer `""`. Tree pointers escape decoded `~` as `~0` and `/` as `~1`. Input diagnostics have no text span. External raw-byte SHA identities remain separate from UTF-16 spans and UTF-8 budgets.

Pointer budget rejection occurs upon visitor entry into the current property/node. At 2048 UTF-8 bytes the pointer is allowed; at 2049 it is refused with `ATLAS_LIMIT_EXCEEDED` and the nearest still-admitted parent pointer. For object properties, use the complete original key token from `onObjectProperty`. Array indices have no key token: use a complete literal token from `onLiteralValue`, or the single opening `{`/`[` character, length exactly 1, from `onObjectBegin/onArrayBegin`. Do not borrow an ancestor key or wait for container completion. This special early span does not change normal full-container spans and adds neither relatedSpan nor cause.

| Code | Fixed English message |
| --- | --- |
| `ATLAS_INPUT_INVALID` | Input must use the supported data descriptors. |
| `ATLAS_READ_FAILED` | Reading an input descriptor failed. |
| `ATLAS_LIMIT_EXCEEDED` | Input exceeds an atlas planning limit. |
| `ATLAS_JSON_SYNTAX` | Metadata must be strict finite Unicode JSON. |
| `ATLAS_JSON_DUPLICATE_KEY` | Metadata contains a duplicate decoded key. |
| `ATLAS_SCHEMA_INVALID` | Metadata does not have the selected schema. |
| `ATLAS_MARKER_MISSING` | A required exporter marker is missing. |
| `ATLAS_MARKER_INVALID` | An exporter marker has the wrong primitive type. |
| `ATLAS_PROFILE_UNSUPPORTED` | Metadata is outside the selected atlas profile. |
| `ATLAS_PAGE_BINDING_INVALID` | Metadata needs one exact declared PNG binding. |
| `ATLAS_NAME_INVALID` | Frame names must be nonempty and unique. |
| `ATLAS_REGION_INVALID` | Frame geometry is invalid. |
| `ATLAS_TIME_INVALID` | Frame durations must form a positive finite sequence. |

## Official references and acceptance boundaries

These references retain evidence IDs E01–E09. The research cutoff is 2026-10-16 17:24 UTC. URLs/tags/commits identify research sources, not locally authenticated upstream raw artifacts or executed exporter releases.

| ID | Official reference and boundary |
| --- | --- |
| E01 | [Aseprite CLI](https://www.aseprite.org/docs/cli/) describes json-array/json-hash, trim and optional tag/layer/slice data; the current unversioned documentation does not prove this profile's compatibility. |
| E02 | [v1.3.18.6 release tag](https://github.com/aseprite/aseprite/releases/tag/v1.3.18.6) and [commit 331e898ef405d919539c03fd1675691cfa16c3a3](https://github.com/aseprite/aseprite/commit/331e898ef405d919539c03fd1675691cfa16c3a3) locate the researched source; no release artifact was run. |
| E03 | Pinned [doc_exporter.cpp](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/app/doc_exporter.cpp) informed field semantics, sample order, rotated=false, duration, image format and scale string. Its header uses the Aseprite EULA; no exporter implementation is copied. |
| E04 | Pinned [sprite.h](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/doc/sprite.h) and [.ase specification](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/docs/ase-file-specs.md) cross-check millisecond units; this planner does not parse .ase binaries. |
| E05 | Pinned [info.c](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/ver/info.c) allows platform-dependent http/https and customizable app URLs. Markers do not authenticate a producer. |
| E06 | Pinned [EULA](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/EULA.txt) and [src/doc MIT license](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/doc/LICENSE.txt) have distinct scope. MIT for src/doc does not license the whole application or exporter/app/ver sources. |
| E07 | TexturePacker's [custom exporter](https://www.codeandweb.com/texturepacker/documentation/custom-exporter) and [texture settings](https://www.codeandweb.com/texturepacker/documentation/texture-settings) describe packed frameRect and XML-selected cw/ccw. The exact JSON-hash template was not obtained; do not generalize its direction. |
| E08 | The official [download manifest](https://www.codeandweb.com/download/texturepacker/latest.json) showed 8.3.0 at retrieval; [CLI parameters](https://www.codeandweb.com/texturepacker/documentation/commandline/parameters) describe format-related multipack/alias options. Neither establishes accepted JSON or animation timing. |
| E09 | Pinned [version CMakeLists.txt](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/ver/CMakeLists.txt) and [generated_version.h.in](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/ver/generated_version.h.in) support the default `-dev` source inference; no build was executed. The existing Aseprite license boundary still applies. |

Egret independently defines this contract, capture, budgets, diagnostics and normalized output. Original tiny fixtures are first-party programmatic data, not vendor sample art or captured commercial exporter outputs. Format vocabulary research does not establish Editor entitlement, distribution rights or original hash validity. No upstream code or assets are distributed by this contract; first-party code and documentation retain Apache-2.0. Source research is not a GPL/OSI-open-source claim about Aseprite.

Record source, parser behavior, actual emitted-entry type diagnostics, package boundaries, genuine public SDK CPU composition, bounded Native rendering, full local gates and publication/Main/CI independently. Historical normalized-layout evidence does not accept a new JSON path. Node parsing followed by a browser consuming a plan does not establish that the browser executed the parser. Any exporter-compatibility claim requires separate legitimate-tool output, settings, version and raw PNG/JSON identities.
