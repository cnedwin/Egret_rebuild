# Private paragraph bidi backend comparison — 2026-10-29

English | [简体中文](../../Cns/docs/paragraph-bidi-comparison.md)

A private SheenBidi comparison now serves the actual SkUnicode/SkParagraph path and has completed the declared Unicode 17 bidi comparisons with zero mismatches. This is an experimental implementation and bounded qualification result, not an Egret SDK feature or provider adoption. M3.2 remains OPEN, including final soft-wrapped-line L1, independent glyph/ink references, native editing, device coverage and memory/performance acceptance. The [prior checkpoint](m3-ui-text-input-plan.md) retains the earlier ICU results.

## Implementation and source identity

The comparison uses [Skia/SkParagraph e2def78](https://github.com/google/skia/tree/e2def78fa232884d4aedcf3ad92d4a0dd673b898) and stock [SheenBidi v3.0.0, commit cfe430e](https://github.com/Tehreer/SheenBidi/tree/cfe430e7375a7845b679adae9d51dac6deaa8858). Four real paragraph builder paths pass the same private candidate factory through bidi-region extraction, shaping and final run ordering. The original ICU export and every existing ICU diagnostic retain their meaning. ICU still supplies break iterators, code-unit flags, properties and the declared locale/data behavior; fonts and the 32/64 MiB memory declaration are unchanged.

Sheen resolves each P1 paragraph through X1–I2, then its full-paragraph line API supplies L1-adjusted logical UTF16 levels. The actual paragraph path retains linked ICU's pure `reorderVisual` L2 on run levels. The separate backend diagnostic expands native Sheen SBLine runs; the adapter diagnostic observes the real factory and applies ICU L2 separately within each P1 range. Their maps remain raw UTF16 slots, with UTF8 byte regions reported separately. NUL, supplementary characters, CRLF, malformed-input refusals and owned iterator results have finite controls. The typed-class diagnostic uses original type tokens through a private same-unity C seam, not representative characters or a public Sheen callback.

**Final soft-wrapped-line L1 is not integrated.** A full-P1 line result cannot substitute for the line-specific reset after actual wrapping. The candidate explicitly reports `wrapLineL1Integrated=false`; standard-input success cannot close that boundary. Borrowed native values are copied before release; ordinary nullable-allocation refusal and retained plain arrays do not prove native OOM recovery or physical reclamation.

The [source manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sheen-comparison/public-source-manifest.json) and [native patch](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sheen-comparison/native.patch) identify seven file deltas: four new owned wrappers under Apache-2.0 and three modified Skia files retaining BSD attribution. Native source receipt `23e1c33e…` and patch `0273da28…` identify the reviewed source. The manifest specifies exact derived-base identities, six preceding patches and a strict-data prerequisite. This patch is not a complete one-step replay recipe on clean upstream Skia. Stock vendor source, fonts and executable payloads are not added to the public package; no public SDK or product runtime dependency changes here.

## Observed comparisons and retained failures

The [verification summary](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sheen-comparison/verification-summary.json) records the exact artifact and evidence identities. The full comparison receipt is `59fe420f0631e12498986b887cfbd9e85b16a8824024b1583ba1ac48d5415770`.

| Declared profile | Observed attempts | Result |
| --- | ---: | --- |
| BidiTest original class tokens | 770,241 | Zero strict level/order mismatches |
| BidiCharacterTest text, including declared auto modes | 91,707 | Zero strict level/order mismatches |
| Actual paragraph factory adapter, fixed directions 0/1 | 91,679 | Zero strict level/order mismatches |
| Official auto cases outside that fixed-direction adapter | 28 | NOT_OBSERVED; not converted into fixed-direction cases |

The schedule totals 953,655 attempts: 953,627 OBSERVED plus 28 declared adapter exclusions. The observed profiles have zero refusal, error, parse or capacity events, and 21 audited input identities remain unchanged. Expectations and strict comparators were preserved; candidate output did not become a golden.

Focused results are 24/24 N0 order controls, 54 boundary controls passed with two declared scope items NOT_RUN, and a separate 10/10 typed-class control set. The first boundary run's real test failure remains recorded: it addressed nested immutable ICU identity fields as top-level fields. Revision 1 corrected only three field accesses, retaining expected values and the native artifact. Ordinary refusal controls do not fill the separate OOM-injection gap.

The historical ICU artifact still has 105,785 class-attempt failures and 11 character / 11 fixed-adapter mismatches. These remain historical contradictions, not relabeled passes or evidence that 105,785 rendering bugs were repaired. Different diagnostic scopes overlap; their counts are not summed into a defect total.

## Real paragraphs and desktop browser scope

The existing 53-case corpus yielded 49 observed original cases, one retained missing-font preflight, and three observed companions. The unchanged finite verifier recorded 844 MATCH, zero mismatches and 494 unchanged inputs. This preserves the existing 38-invariant scope, finite independent references and conditional parity. It does not give all 53 cases independent shaping or pixel goldens, nor turn mark-index order into an ink result.

Desktop browser revision 1 passed using default Edge (`msedge`, headless, no extra flags) with Playwright 1.62.1. It observed all 24 N0 order controls and a real Ahem CPU raster whose exact RGBA bytes matched Node using the same artifact. This is cross-host consistency, not an independent shaping golden, GPU result, general browser composition result, phone result or IME acceptance.

Browser revision 0 failed before initialization: the generated loader ignored the supplied `wasmBinary`, and its default Wasm URL was outside the narrow allowlist. The failed receipt remains preserved. Revision 1 changed only I/O configuration to use the supported `locateFile` route; there was no native rebuild, expectation change or weakened assertion.

## Cost and remaining acceptance

With Node 26.7.0 `gzipSync` level 9, Wasm contributes **4,184,563 bytes**, glue **29,909 bytes**, combined **4,214,472 bytes**. Embedded ICU data is already inside Wasm and is counted once. The Wasm contribution is compared with the 4.5 MiB component ceiling; glue is reported separately. This does not establish total M4 transfer, startup or performance acceptance.

Actual linear-memory capacity again grew from 32 to 38.4375 MiB under the unchanged 64 MiB maximum. Capacity is not live ownership, physical-memory peak, reclamation, OOM recovery or heap-headroom qualification. M3.2/provider acceptance, final wrapped-line L1, independent glyph/ink references, fonts, browser composition, IME/accessibility, mobile and full M4 remain OPEN. The separate M1.2 timing result of 10.3 ms against an 8 ms target also remains OPEN.

## Sources and licenses

Source roles remain distinct: [selected ICU source](https://chromium.googlesource.com/chromium/deps/icu/+/d578f2e8b7bd5938e21cfb6bf15c079e0aa5b738/) supplies shared services; [Unicode 17 BidiTest](https://www.unicode.org/Public/17.0.0/ucd/BidiTest.txt), [BidiCharacterTest](https://www.unicode.org/Public/17.0.0/ucd/BidiCharacterTest.txt) and [UAX #9 revision 51](https://www.unicode.org/reports/tr9/tr9-51.html) supply independent standard expectations. Sheen's source data declares Unicode 17.0.0; observed library version and declared table provenance are separate, with no invented runtime Unicode-version getter or exhaustive generated-table equivalence claim. Retain the [original Skia BSD license](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sheen-comparison/skia-BSD-3-Clause.txt), [original Sheen Apache-2.0 license](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sheen-comparison/sheen-Apache-2.0.txt) and applicable Unicode/ICU notices. The new wrappers call the pinned library; they do not transplant algorithm fragments into a new UBA implementation.
