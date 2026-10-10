# Legacy MovieClip CPU conversion contract

[简体中文](../../Cns/docs/legacy-movieclip-contract.md) · [Evidence](legacy-movieclip-evidence.md)

This first-party component converts one explicitly named legacy MovieClip declaration into an immutable sequence-frame input and display-offset mapping. The implementation and 28 focused CPU groups have been checked. Image loading, decoding, rendering, label/event playback and full project migration remain separate work.

## Internal API and data

The internal module `packages/project/src/legacy-movieclip-plan.ts` exports its types and this function; it is not exposed through a package barrel:

```ts
planLegacyMovieClipConversion(
  text: unknown, clipName: unknown, atlasPath: unknown,
  atlasWidth: unknown, atlasHeight: unknown,
): LegacyMovieClipConversionResult
```

Inputs are three primitive strings and two primitive numbers. Atlas path/dimensions are explicit declarations; the converter accepts no parsed caller graph, texture, runtime clip, loader or callback. It reuses the existing project-local strict JSON, Unicode and portable-path helpers, without a runtime-private import or new dependency.

The result has exactly `planVersion`, `profile`, `status`, `diagnostics`, `acceptance`, `plan`. Version/profile are `0.1` / `legacy-movieclip-single-atlas-0.1`; status is `planned`, `invalid`, `unsupported` or `incomplete`. Planned results have zero diagnostics and a complete plan. Each refusal has one first diagnostic and `plan: null`. Acceptance fields `fileExistence`, `decoding`, `execution`, `migration` always remain `unverified`. Containers and nested output records are freshly owned and frozen.

The plan has exactly `clipName`, `atlasPath`, `totalLegacyFrames`, `sequenceInput`, `holds`. `sequenceInput` owns atlasWidth/atlasHeight/frames; each frame owns x/y/width/height/durationSeconds. Each parallel hold owns resourceName/offsetX/offsetY/firstLegacyFrame/durationFrames. Atlas x/y are crop coordinates; offsetX/offsetY are display offsets. Legacy logical starts are one-based. The output carries plain data: actual `createSequenceClip` must re-admit it and create authentic runtime identity. This re-admission and sampling have been tested; renderer placement remains unverified.

## Accepted declarations and time

Root fields are mc/res. Only the requested exact own mc member is converted; there is no first-member fallback or name normalization. Selected clip fields are frames/frameRate/labels/events; frame fields res/x/y/duration; referenced regions x/y/w/h. Names such as __proto__ and constructor require actual own properties. Unselected clip and unreferenced region contents remain semantically uncertified, while whole-text parser budgets still apply.

Missing frameRate means 24; a present rate must be finite and positive, including fractional rates. Missing duration means one logical frame; a present duration must be a positive safe integer. Missing display offsets mean zero; present offsets must be signed 32-bit integers, with negative zero normalized. Crop x/y are nonnegative safe integers and w/h positive safe integers. Safe extents must fit the independently declared atlas width/height.

Each authored keyframe becomes one hold. Adjacent equal records remain separate, and repeated ticks are represented by durationFrames rather than expanded frames. Each hold divides once in binary64, without integer-second or float32 conversion. Its seconds must be finite and positive; cumulative ends from zero must be finite and strictly increase in authored order. Positive subnormal seconds are retained. Compressed division/summation can differ from expanded legacy tick arithmetic: a one-tick hold followed by a two-tick hold at rate 10 ends at 0.30000000000000004; one three-tick hold ends at 0.3. Legacy wall-clock equivalence is unverified. No absorbed-increment branch coverage is claimed under the logical-tick budget.

Missing/null/empty labels or events are accepted; nonempty arrays are unsupported without inspecting their members. Other list types are invalid. Missing/empty res marks an unsupported blank frame; a present nonstring res is invalid. Missing references are invalid. Generated frame backreferences, rotation, trimming and other unknown selected fields are unsupported. Permissive legacy numeric coercions are outside this strict subset.

## Budgets

| Boundary | Limit |
| --- | ---: |
| Raw text UTF-16 length and UTF-8 bytes, each | 1,048,576 |
| Decoded JSON key/string UTF-8 bytes | 4096 |
| Container depth | 16 |
| mc members / res members | 64 / 4096 |
| Authored frames | 1–1024 |
| Total legacy logical frames | 1,048,576 |
| Selector / referenced resource name UTF-8 bytes, each | 256 |
| Atlas path UTF-8 bytes | 1024 |

Strict JSON rejects invalid Unicode, duplicate and escaped-duplicate keys, BOM, comments and trailing commas. The path retains authored spelling, passes portable project-relative rules and excludes schemes, absolute/protocol-relative forms, backslashes, query/fragment/percent syntax, traversal/empty components, invalid characters, trailing dot/space and Windows reserved components. This lexical admission gives no file existence, physical/symlink containment or overwrite authority.

## Deterministic validation order

1. Check all five primitive types left to right, without object reads or coercion. Nonfinite number primitives reach the later dimension checks. Then invoke readLegacyResourceJSON once. Actual LEGACY_RES_INPUT_INVALID, LEGACY_RES_SYNTAX_INVALID, LEGACY_RES_LIMIT_EXCEEDED and LEGACY_RES_INTERNAL_FAILED results map to the corresponding LEGACY_MOVIECLIP_ codes. Input/syntax/limit refusals are invalid; internal or unknown producer behavior is incomplete. Strict parsing precedes semantic name/path/dimension checks; no second parser, reviver or input execution is used.
2. Check nonempty selector, Unicode and bytes; path Unicode, bytes and lexical rules; positive safe width then height. Check root/mc/res nonarray records in order, then mc/res count limits. Resolve the exact own clip, then its record and nonempty own frames array/count.
3. Capture rate/labels/events, then validate them in that order. For each authored frame check record, res type/name bytes, x, y, duration and referenced region. A region validates record then x/y/w/h, followed by horizontal then vertical safe fit. Validate logical-tick sum, seconds quotient and cumulative end before the next frame. Blank/list unsupported markers remain deferred. First invalid supported value wins.
4. After all supported data validates, select unsupported in this order: root unknown field; clip unknown field; frame unknown field in authored order; distinct referenced-region unknown field in first-reference order; first blank frame; nonempty labels; nonempty events. Within each record use default JavaScript string-sort. Later invalid data therefore beats earlier unsupported markers.
5. Publish complete owned/frozen records after admission. An unexpected internal fault yields incomplete when a refusal can be allocated. Foreign thrown values are not inspected or coerced; universal out-of-memory recovery is not promised. No partial plan is published.

## Diagnostics

Diagnostics contain exactly code/source/severity/jsonPointer/message. Source is text/clipName/atlasPath/atlasWidth/atlasHeight; unsupported severity is warning, others error. Messages are static English text of 1–160 UTF-16 units, without interpolated caller content or serialized exceptions; exact wording is not a behavioral oracle. Argument pointers are empty; text pointers escape ~ before /, preserving the actual own field spelling.

All codes below have prefix LEGACY_MOVIECLIP_:

| Suffix | Meaning / pointer |
| --- | --- |
| INPUT_INVALID | Primitive/Unicode, record/array, res/list/offset type failure; offending parameter or text field |
| SYNTAX_INVALID | Strict parser syntax refusal; preserve producer pointer |
| LIMIT_EXCEEDED | Producer or converter budget; preserve producer pointer, /mc, /res, frames, duration or name field |
| PATH_INVALID | Lexical atlas path; atlasPath source, empty pointer |
| CLIP_NOT_FOUND | /mc/escapedName |
| REFERENCE_UNRESOLVED | Frame res field |
| RATE_INVALID | Clip frameRate |
| DURATION_INVALID | Current duration |
| REGION_INVALID | Region record/field; horizontal extent w, vertical extent h |
| TIME_INVALID | Current duration, including its default |
| SCHEMA_UNSUPPORTED | First unknown selected field |
| FEATURE_UNSUPPORTED | First blank res or nonempty labels/events |
| INTERNAL_FAILED | text source, empty pointer |

Invalid selector/path Unicode uses INPUT_INVALID; their byte excess uses LIMIT_EXCEEDED. Width/height semantics use INPUT_INVALID. Rate/duration require their declared strict types; quotient or cumulative-time failures use TIME_INVALID. See the paired evidence record for actual validation and remaining gates.
