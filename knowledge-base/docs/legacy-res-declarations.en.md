# Legacy RES declaration analysis

English | [简体中文](legacy-res-declarations.md)

0.16.0 adds an internal declaration analyzer with reportVersion 0.1 and profile legacy-res-comma-declarations-0.1. It provides bounded, inspectable declaration inventory as a prerequisite for legacy migration. It is not exposed through the package-root facade, does not make an imported legacy project runnable and does not upgrade complete R008/V006 migration acceptance.

## Input and report contract

text and resourceRoot must be primitive strings; caller objects are not coerced to strings. text uses strict JSON, rejecting comments, trailing commas, duplicate decoded keys, invalid Unicode and extra trailing content. The resource root must be a nonempty portable path; declarations require resources/groups arrays and their corresponding string fields.

Each result is a fresh, owned, deeply frozen report containing resources, groups, diagnostics and acceptance; no caller graph or parser record escapes. status is recognized, unsupported, invalid or incomplete. recognized means known declaration structure only; unsupported means outside the structural profile; invalid means invalid input/budget; incomplete means internal failure while constructing a failure report remains possible. Arbitrary OOM/poisoned-intrinsic recovery is not guaranteed.

| Boundary | Cap |
| --- | ---: |
| text early UTF-16 length and UTF-8 bytes | 1048576 each |
| JSON nesting depth | 16 |
| Decoded key/string UTF-8 bytes | 4096 |
| resourceRoot early characters/UTF-8 bytes | 4096 each |
| Portable path UTF-8 bytes | 1024 |
| resources/groups | 4096/1024 |
| Total declared group references | 16384 |
| Warnings | 256 |

Over-limit reports are not truncated into apparently complete inventories. Count/string budgets are logical admission bounds; existing parser allocations and host memory are not equivalent to those numbers.

## Preserved declaration semantics

group.keys splits on literal commas. An empty string yields zero references; other input preserves empty tokens, spaces, duplicates and order without trimming. For example a,, b,a yields a, an empty token, b with a leading space, and a; references resolve against original names. This does not infer the complete historical resource manager's runtime deduplication/loading behavior.

Exact duplicate resource/group names are rejected. Paths retain their original spelling; aliases colliding under NFC normalization/lowercasing are rejected. Known types are image and json. Other types, subkeys, scale9grid, remote/special URLs and unresolved references produce unsupported reports. Unknown schema fields conservatively produce unsupported, rather than silently translating misunderstood fields into apparent correctness.

The report's fileExistence, decoding, execution and migration fields always remain unverified. Declaration recognition checks neither file existence, content digests, loading, image decoding, runtime equivalence nor historical-game playability.

## Sources and finite evidence

Strict parsing uses the existing [jsonc-parser 3.3.1](https://github.com/microsoft/node-jsonc-parser/tree/v3.3.1) public-root createScanner/visit APIs under its MIT license. The declaration profile, report organization and test fixtures were independently authored from first-party contracts. Founder-supplied historical RES declaration semantics informed compatibility research; exact historical version/module closure remains unverified. Public materials preserve that provenance without distributing historical private source or project archives.

The accepted exact three-file range has saved 20 focused/772 full passes and three finite independent reviews with no findings. These source tests use independently authored declaration fixtures, rather than legacy-game migration. Historical source/test identities are in the [declaration verification summary](../evidence/legacy-res-declarations-verification.json). This documentation work reran none of those checks; final public review/push gates remain pending.

## Complete migration remains required

R008/V006 still requires version/module/dependency inventory, new-project builds, deterministic conversion and Agent repair/rollback, old/new behavior/visual/animation/resource comparison, target-host performance, human-intervention/AI-cost records, and continued editing/undo/actual publication/update after conversion. This analyzer supplies prerequisite evidence; Agent, editor, animation and the complete converter have separate implementation and acceptance work.

[Core progress](core-progress.en.md) · [Legacy migration goal](旧工程迁移.en.md) · [Acknowledgements](../ACKNOWLEDGEMENTS.en.md)
