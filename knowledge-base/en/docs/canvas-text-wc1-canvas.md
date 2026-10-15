# WC1 Canvas text preview

English | [简体中文](../../Cns/docs/Canvas文字WC1.md) · [T1 cache](text-raster-t1-contract.md) · [TF1 display](text-field-tf1-contract.md)

Engineering preview **0.28.0** adds an explicit Canvas text provider for the existing TextRasterCache, TextField, Scope, Engine and CanvasHost. Current CPU/type checks, complete current verification and fixed native Canvas observations passed within the scopes below; independent bilingual meaning review, the mandatory Git push hook and delivery remain separate. Workspace packages remain private `0.0.0` and protocol pins remain `1.0`. The execution and pending-delivery statuses below belong to this original 0.28.0 record; they are not a fresh delivery assessment.

## Public use and font ownership

The only new export is `createCanvasTextRasterProvider(): TextRasterProvider` from `@egret/engine/web/text`. Its return type is the existing T1 protocol; no named type reexport or default-root factory is added. Import is inert. Calling the factory captures the current Window document and checks capabilities without creating a Canvas, loading a font or scheduling work.

```ts
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createTextRasterCache, createTextField } from '@egret/engine/text';

// Supply a genuine open Engine, its Scope, and an admitted complete request.
const cache = createTextRasterCache(engine.assets, {
  provider: createCanvasTextRasterProvider(),
});
const field = createTextField(engine, scope, cache);
field.setRequest(input);
await field.prepare();
engine.stage.addChild(field);
engine.renderFrame();
```

This sketch omits setup and cleanup. The [first-party example](../../../examples/canvas-text/README.md) owns its Engine, CanvasHost, cache and Ahem FontFace; its Scope owns the field. The provider never fetches, installs, waits for or deletes fonts. Applications stabilize their font environment, explicitly call `cache.invalidate()` after relevant changes, then prepare fields again. Replacement retains committed content until success; a blank success clears drawing while retaining admitted layout. Preparation and rendering remain explicit.

Before each native measure/raster phase, `document.fonts.check()` must succeed. Refusal is `WEB_TEXT_FONT_NOT_READY` before that phase's Canvas work. A true readiness check can permit fallback; it does not prove face membership, selection or glyph coverage. The acceptance fixture separately checks its exact owned loaded Ahem face and selected advance. Full-line measurement/drawing preserves source ranges, signed native metrics and the em-origin baseline `fontSize + lineIndex * lineHeight`. Existing T1/TF1 ownership, image and allocation limits remain authoritative; provider admission has four active/quarantined slots shared across its caches. These are logical limits, not physical-memory measurements.

## Native Canvas scope

The recorded baseline has **14 rows**: `X`, `p`, `É`, space, empty, LF and CRLF, each at densities **1** and **1.5**. Six fresh default-msedge contexts exercised these independent obligations:

| Mode | Required evidence |
| --- | --- |
| `baseline` | All owned-raster bytes and all 80×80 frame bytes; half-opacity, clipping and painter-order composition; blank replacement and font-generation reprepare. |
| `omitFill` | C01: the predeclared wrong owned-raster pixel for X/density1. |
| `omitOrigin` | C02: the predeclared wrong owned-raster pixel for p/density1. |
| `noOp` | C03: the predeclared wrong full-frame pixel for X/density1. |
| `holdRaster` | Genuine provider/cache/field integration, retained old frame, closed-Scope refusal and late image retirement. |
| `notReady` | Readiness refusal before native measurement or provider Canvas context allocation. |

An independent first-party native Canvas/Ahem reference imports no Egret code and takes no expected pixels from target output. Every mode must durably save and reread reference metadata and **28 owned-raster/full-frame buffers before any target acquire**, including explicit empty-buffer evidence. Every actual/expected buffer must resolve to a named saved inventory entry; each control's predeclared coordinate must bind to the correct saved image. Comparisons use complete bytes with **zero tolerance**. Each C01–C03 control must expose exactly its assigned witness without an unrelated failure. Claimed comparison booleans do not replace rereading the bytes.

Cleanup must prove released plans, settled actors, idle/closed caches, restored native methods, deletion of the owned font, retirement of reference buffers and closure of contexts/browser/server. Required attempts continue while preserving the first failure, including thrown `undefined`. Incomplete evidence or incomplete cleanup cannot pass. No GPU import, command, result or acceptance belongs to this verifier.

After a fresh public build, the standalone command is:

```text
node tools/verify-canvas-text-canvas.mjs --playwright <absolute-installed-package> --output <absolute-fresh-directory-outside-repo>
```

The current verifier requires Windows, Node.js **24.19.0**, Playwright **1.62.1** and the default Edge profile. These are verifier requirements; the runtime provider separately requires the current Window document and effective Canvas 2D/font capabilities described above. The verifier pins selected installed tooling, fixtures/assets, built public modules and corresponding selected source files before serving captured bytes, then rehashes them at completion. Build/source correspondence is an explicit prerequisite. Action, operation and cleanup limits are **20**, **240** and **270 seconds**; each artifact is at most **4 MiB**, with **16 MiB** total. Required scope is `wc1-canvas-explicit-lines-v1`; `PASS_WC1_CANVAS_SUBSET` names this bounded result.

## Recorded verification and remaining gates

The genuine pre-adoption Main public-entry regression failed **1 test** with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Subsequent Main public behavior/boundary checks passed **288/288**; the complete strict type run passed, including **12** new ordinary and **8** new import diagnostics plus the retained **18** BR1 diagnostics. The production boundary scan passed **420 files**, and the current pure verifier-contract suite passed **12/12**. These overlapping scopes are not added.

The actual native result is **`PASS_WC1_CANVAS_SUBSET`** on default headless **Edge 154.0.4258.62**, Windows, Node.js **24.19.0** and Playwright **1.62.1**. All six contexts completed their assigned obligations: the 14 baseline rows matched complete raster/frame bytes with zero tolerance; C01–C03 exposed their exact wrong witnesses; composition, blank replacement, font-generation reprepare, held-raster lifetime and not-ready refusal passed. Recorded cleanup released plans, closed caches and settled actors, with zero owned fonts/reference buffers remaining; all six contexts, browser and server closed. The baseline made 14 initial acquires; measure/plan/raster/release counts were each 21 after supplementary flows, not test totals. Held preparation refused `TEXT_FIELD_DISPOSED`; Scope/reentry refused `SCOPE_CLOSED`. Closed metadata accounting remained 4,096 bytes. OS descendant retirement and physical reclamation remain unverified.

The first-party application smoke passed initial render, replacement, empty content and explicit close, with zero browser errors. Its saved close status recorded cache idle and Engine disposal, no remaining owned font/Canvas, and closed context/browser/server. This application observation supplies no independent pixel oracle. The shared [verification record](../../evidence/canvas-text-wc1-canvas-verification.json) retains exact source, fixture and saved-result identities.

| Gate | Current status |
| --- | --- |
| Finite source and actual saved-native review | **PASS**, with **0** open findings. |
| Independent bilingual meaning review, including the public shared JSON | **PASS**, with **0** open findings. |
| Five affected existing browser regression gates | **PASS** for existing Canvas, rectangle WebGPU, B1, textured WebGPU and SequencePlayer routes. |
| Complete current verification | **PASS**: 2,285/2,285 core tests, 59/59 publication tests, build, strict types, production boundaries, knowledge-base checks and headless example. |
| Mandatory Git push hook and delivery | **PENDING**. |

The first complete prepush retained 2,285/2,285 core and 52/52 publication passes but failed nine knowledge-base path checks. Registry artifacts resolve from the shared knowledge-base root. The finite repair corrects the example artifact paths, admits exactly five named repository reading files, and maps only exact inventoried language pairs in repository-root and shared-knowledge-base-relative forms. Actual repair controls changed from 3/5 to 5/5 for the knowledge-base reader and from 53/54 to 54/54 for publication parity; other outward paths and unpaired translations remain rejected. These checks establish the stated path behavior, not general filesystem security. The failed cutoff remains preserved; the later complete run is a distinct successor.

The next restricted-process run passed 59/59 publication tests but recorded 2,002/2,285 core passes and 283 aggregate core failures. EPERM setup observations included 172 isolated-package directory-symlink errors and 103 temporary-directory realpath errors before assigned probes; those error observations are not the aggregate test count. The authorized host-process successor ran the unchanged complete gate successfully; product code and tests were not weakened. Both cutoffs remain separately recorded.

These existing renderer regressions retain their established routes; they do not extend WC1 text acceptance to WebGPU. The earlier mixed Canvas/textured-WebGPU run remains **FAIL**: **512 GPU composition bytes differed**, with maximum channel difference **1**. Native7/OR1 acceptance remains pending separately. This Canvas-only increment does not close those obligations or establish complete WC1, CJK/phones, full UI, Spine, 3D, performance, physical reclamation or full migration acceptance.

## Provenance

Provider, application, reference, fixtures and documentation are AI-assisted independent first-party Egret work composing the public T1/TF1, image and lifecycle APIs under **Apache-2.0**. Existing dependencies retain their own notices. The geometric Ahem test font is external: **Todd Fahrner and Myles C. Maxfield**'s original public-domain declaration retains its original **CC0 fallback** where public domain is not recognized. The unchanged [Ahem notice](../../../examples/canvas-text/assets/Ahem-COPYING.txt), [README](../../../examples/canvas-text/assets/Ahem-README.txt) and [source record](../../../examples/canvas-text/assets/provenance.json) remain with the asset. Ahem is not relicensed as Apache-2.0 and does not establish general-language glyph quality.
