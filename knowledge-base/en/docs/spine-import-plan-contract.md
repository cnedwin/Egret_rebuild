# Spine import planning contract

English | [简体中文](../../Cns/docs/Spine导入计划契约.md)

Engineering preview 0.34.0, SP1-A. The optional `@egret/project/spine` entry provides a synchronous, immutable import plan for stable 4.3 JSON, modern atlas text and explicit page-to-asset bindings. Admission means the bounded planning profile passed. Animation semantics, image data, playback, rendering, runtime compatibility and license entitlement require separate validation. Full Spine support remains requirement R020 and deliverable V020.

## Public use

```ts
import {createSpineImportPlan} from '@egret/project/spine';

const provenance = {
  origin: 'Original programmatic fixture',
  license: 'Apache-2.0',
  notice: 'Egret community fixture',
};
const result = createSpineImportPlan({
  skeleton: {
    id: 'skeleton:original',
    text: '{"skeleton":{"spine":"4.3.13"}}',
    provenance,
  },
  atlas: {
    id: 'atlas:original',
    text: 'page.png\nsize: 1,1\n',
    provenance,
  },
  pages: [{pageName: 'page.png', assetId: 'page:original', provenance}],
});
if (result.ok) {
  // A declared asset ID remains plain data; this plan does not load an image.
  console.log(result.value.pages[0]?.assetId);
} else {
  console.log(result.diagnostics[0]);
}
```

The two runtime exports are `createSpineImportPlan` and frozen `SPINE_IMPORT_LIMITS`. Eleven exported types describe input, provenance, plans, diagnostics and text spans. The existing `@egret/project` root keeps its six runtime values and existing types. This entry uses the retained jsonc-parser 3.3.1 grammar foundation; it adds no runtime dependency, host globals, network access, asset lookup or callbacks.

Inputs are ordinary Object/null-prototype records with exact enumerable own data properties and dense ordinary arrays. Getters, symbols, unknown keys and unsupported prototypes are refused without invoking getters. Reflection failures produce fixed input diagnostics; arbitrary proxy-trap side effects remain outside the guarantee. Outputs own and freeze their records and arrays. The planner retains no mutable input object, edits no project, allocates no Scope and needs no disposal.

## Versions, atlas and dependencies

Stable `4.3.<patch>` headers are admitted and preserved; prereleases, malformed headers and other series have distinct refusals. Header admission does not prove compatibility with every future patch. The plan records the researched candidate `@esotericsoftware/spine-core`, source tag `spine-ts-4.3.13` and commit `b7beb2ccbbce667a12c02f44d070644f59b04968`, with artifact verification explicitly `not_run` in this planning slice.

Atlas pages require `size`; regions require modern `bounds`. Rotation is restricted to false/0 or true/90. Strict complete decimal integer tokens must be finite and safe, pass individual ranges and then fit packed and original dimensions. Legacy `xy/size/offset/orig` region forms and global headers are outside this first Egret planning profile. This is an engineering admission choice; upstream's complete format is broader.

Before the first page name, a recognized page field (`size`, `format`, `filter`, `repeat` or `pma`) is an unsupported global header; an unknown field is an orphan syntax error. Both identify the original line with an empty atlas pointer.

Page paths follow Egret's portable-path rules. Names remain authored; NFC/case portability collisions are refused. Region identity is the exact `(name,index)` pair. Every page requires one byte-for-byte binding, with no unused binding. Asset IDs can be shared, must be trim-nonempty valid strings, and retain untrimmed spelling. They are declarations rather than authenticated AssetRefs or paths. No implicit URL or filesystem resolution occurs.

The plan preserves declared format, filter, repeat and PMA. Linear/mipmap sampling, wrapping, alternate formats, PMA, blend/dark tint, constraints, sequences and explicit attachment types remain visible compatibility concerns. Bone/slot/skin/animation names and selected feature markers are inventory only. Success always retains `featureInventory: 'partial'`, `animationSemantics: 'not_run'`, `rendering: 'not_run'` and `licenseEntitlement: 'unverified'`. Unknown/custom metadata does not upgrade these flags.

## Budgets, diagnostics and order

`SPINE_IMPORT_LIMITS` exposes exactly 28 fixed ceilings. Key limits are 8 MiB skeleton text, 1 MiB atlas text, depth 32, 262144 JSON value nodes, 131072 properties, 64 atlas pages and 8192 total regions. Dimensions/coordinates/offsets have separate limits up to 16384; tuple conversion never truncates or rounds unsafe integers. These are admission budgets rather than device limits or performance results. Overlapping budgets can make a successful individual ceiling witness unreachable.

Fatal stages are metadata/provenance admission, raw Unicode/bytes, complete iterative scanner lexical/depth preflight, strict visitor grammar/decoded keys and allocation, planning schema/version, atlas, then bindings. A later scanner depth failure can precede an earlier duplicate detected by the subsequent visitor. No global earliest-character rule is promised. Failures return one fatal diagnostic and no partial plan or earlier warnings.

Diagnostics identify `source: 'input' | 'skeleton' | 'atlas'`, an escaped bounded JSON pointer, a fixed English message and optional text spans. Input has no primary text span. Offsets and lengths refer to original UTF-16 text; line/column are one-based and CRLF is one break. Invalid decoded key Unicode reports its admitted parent pointer and the original key token. Missing fields use the containing object/page-name span. Duplicate tokens retain the earlier related span. Consumers must escape text and source IDs for their output context.

Success warnings are ordered profile, inventory and provenance, at most one per class. Declared SHA-256 strings are retained but not computed or verified. Origin/license/notice declarations do not establish authorship, distribution rights or Spine Editor entitlement. Runtime integration must retain the applicable upstream terms independently of Egret's Apache-2.0 first-party code.

## References and verification

The [official atlas format](https://esotericsoftware.com/spine-atlas-format), pinned [TextureAtlas source](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/TextureAtlas.ts) and [SkeletonJson source](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts) informed format research. Egret independently defines this plan, ownership, budgets, strict admission and diagnostics. Fixtures are original programmatic Apache-2.0 data and are not licensed Editor exports.

Actual source, behavior, type, control and delivery results belong in the [evidence reading](spine-import-plan-evidence.md) and [verification record](../../evidence/spine-import-plan-verification.json). Source research and proposed test expectations do not substitute for those results. Official-core animation/render integration is a separate workstream, not a prerequisite imposed by this planner.
