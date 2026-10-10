# Legacy RES conversion-intent contract

[简体中文](../../Cns/docs/legacy-res-plan-contract.md) · [Verification evidence](legacy-res-plan-evidence.md)

Egret's first-party RES planner (`packages/project/src/legacy-res-plan.ts`) translates a recognized legacy resource declaration report into immutable copy/reference intentions. Legacy RES declaration semantics are the compatibility target. This internal planning API is not exported by the project package barrel and does not execute migration.

```ts
planLegacyResourceManifestConversion(text: unknown, resourceRoot: unknown)
  : LegacyResourceConversionResult
```

## Admission and result

The planner calls its manifest analyzer (`packages/project/src/legacy-res-report.ts`) once with the actual input before planning. It does not accept a caller-authored report or producer callback. Existing strict JSON, schema, declaration, path and diagnostic precedence remains the analyzer's responsibility. The supported planning subset is admitted local `image` and `json` resources with resolved group references; formats such as sprite sheets and scale-nine declarations remain unsupported.

The result has `planVersion: "0.1"`, `scope: "legacy-res-conversion-intents"`, the actual immutable `report` and a `plan`. Only a `recognized` report produces `status: "planned"` and a non-null plan, including a recognized empty manifest. `unsupported`, `invalid` and `incomplete` retain their report status and return `plan: null`. No partially constructed plan is published.

The inherited bounds are 4096 resource declarations/files, 1024 groups and 16,384 group references. Path admission remains bounded, local and relative, with the analyzer's Unicode/collision policy. Planning performs no extra path normalization, percent-decoding or filesystem-containment proof.

`resourceRoot` must be a primitive, nonempty portable relative prefix. The analyzer first checks primitive text/root inputs, Unicode and early text/root budgets, then strict JSON, then portable-root admission. An early root limit of 4096 code units/UTF-8 bytes does not relax the portable path limit: an admitted root and each joined project path must fit 1024 UTF-8 bytes. Portable components reject backslashes, empty/`.`/`..` components, trailing spaces/dots, reserved names and invalid characters. These are lexical project-path rules, not platform filesystem resolution.

For an invented declaration URL `images/hero.png` and root `assets`, the copy intent uses `assets/images/hero.png` for both `sourcePath` and `destinationPath`. Each is interpreted relative to its separate original/output project root. No file is examined, and `assets` is not added again.

`incomplete` is an analyzer report status. Planner invariant or native allocation/publication failures may throw; the API does not promise to convert every such failure into an incomplete report. They still publish no partial plan.

## Stable mapping

`plan.resourceRoot` preserves the admitted root. `files` deduplicates exact already-root-prefixed project paths in first-occurrence order. Each file has equal relative `sourcePath` and `destinationPath` names, interpreted beneath separate original and output project roots. The root is not prefixed twice.

`resources` preserves declaration order and each name/type, with a `fileIndex` referencing `files`. Aliases can share an index; an image and JSON declaration can reference the same path without certifying that the file satisfies both content types. `groups` preserves group order and admitted key order, including repeated references, and maps keys to resource indices without splitting or deduplicating again.

Every result, plan, array and plan record is freshly owned and frozen. The internally produced report is retained as the evidence and diagnostic authority. File existence, decoding, execution and migration acceptance remain **unverified**.

## Execution boundary

A copy intention grants no permission to overwrite files and makes no claim about realpath/symlink containment or actual contents. File reads, hashes, decoding, copying, transactions, runtime resource installation and complete project migration require separate implementation and validation. The focused CPU evidence covers the intent mapping, and the selected combined source set passed current whole-repository verification: 901/901 tests plus build, boundary and type gates. This result does not establish migration acceptance; the paired evidence preserves the earlier failed repository attempt.
