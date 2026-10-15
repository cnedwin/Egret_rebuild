# F2-A source-plan replay

English | [简体中文](../../../Cns/experiments/spine-f2/README.md)

This synchronous source-planning guide preserves the engineering preview 0.42.0 record. Its saved development run succeeded; independent acceptance and publication were pending at that original draft cutoff. Status: [contract](../../docs/spine-mesh-source-plan-contract.md), [evidence](../../docs/spine-mesh-source-plan-evidence.md), [shared verification](../../../evidence/spine-mesh-source-plan-verification.json).

## Install and verify

Use Node **24.19.0**, pnpm **11.25.0**, TypeScript **7.0.2** and jsonc-parser **3.3.1**. Root manifests pin these tools/dependencies. The checker uses TS7's unstable public AST API; version changes need new verification.

Run from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
git config --local core.hooksPath .githooks
node tools/build.mjs
node tools/verify-spine-f2-source.mjs
```

The last command also runs as `pnpm verify:spine-f2-source`. For noninteractive relinking of the managed dependency directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts --config.confirmModulesPurge=false
```

This option permits dependency-directory relinking, not source deletion. Use the installer, not manual aliases. A requires no private cache path, Playwright, browser or physical phone.

`node tools/verify.mjs` includes F2 after retained SDK checks. Before pushing, run `node tools/prepush.mjs` and keep the hook. No private SDK imports, skipped types/source guards or hook bypass. Experiment and core totals stay separate.

## Read a plan

Repository-root TypeScript usage imports only the built experiment and public SP1 type. This request has no mesh/setup references; page IDs are declarations, without image loading.

```ts
import {createF2MeshSourcePlan} from './knowledge-base/experiments/spine-f2/dist/index.js';
import type {SpineImportInput} from '@egret/project/spine';

const provenance = {
  origin: 'Original contributor sample', license: 'Apache-2.0',
  notice: 'Source-plan example, not an Editor export.',
};
const input: SpineImportInput = {
  skeleton: {id: 'sample', text: '{"skeleton":{"spine":"4.3.13"}}', provenance},
  atlas: {id: 'atlas', text: 'sample.png\nsize: 1,1\n', provenance},
  pages: [{pageName: 'sample.png', assetId: 'sample:page', provenance}],
};
const result = createF2MeshSourcePlan(input);
if (result.ok) console.log(result.value.meshes, result.value.setup);
else console.log(result.diagnostics);
```

The [SP1 contract](../../docs/spine-import-plan-contract.md) defines owned input. Frozen summaries grant no execution or permissions. A admits exact **4.3.13**, independent unweighted mesh coordinates/UVs/indices and conservative static setup counts, retaining original spans and SP1 refusals/warnings.

## Results and limits

Saved verifier exit **0**: **22/22** tests = **16 behavior + 6 boundary** (one baseline, five controls). Positive types: **0** diagnostics; all **39** negative file/line/column/code/full-message tuples matched. Negative compiler exit **1** is expected; verifier success requires exit **0**. The shared record retains failures/successors. These counts do not establish publication/Main delivery.

Full profile/deform/animation semantics, Core compatibility, actual resources, rendering and license entitlement remain pending; R020/V020 remain **OPEN**. Controlled witnesses for `F2_SOURCE_VIEW` and `F2_INTERNAL_ERROR` also remain **PENDING**. Do not use source admission to start playback.

The seven [shared assets](../../../experiments/spine-f2/assets/egret-original-unfold.spine.json) are original Apache-2.0 specimens, not Editor exports or canonical Core outputs. This slice bundles no third-party Core. See the repository-root `LICENSE` and `NOTICE`, the [official format source](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts), [atlas format](https://esotericsoftware.com/spine-atlas-format) and [runtime license](https://esotericsoftware.com/spine-runtimes-license). Upstream terms and resource rights require their own qualification.

<!-- F2-B-GUIDE-0.43.0-BEGIN -->
## Current F2-B opt-in entry / 当前 F2-B 可选入口

The current built opt-in experiment exposes 2 runtime values: `createF2MeshSourcePlan` (A) and `createF2MeshProfilePlan` (B), and 10 erased types: A's unchanged 6 plus `F2MeshProfilePlan`, `F2MeshProfileResult`, `F2MeshProfileDiagnostic` and `F2MeshProfileDiagnosticCode`. B accepts the same public `SpineImportInput`; use the [B contract](../../docs/spine-linear-profile-contract.md), [B evidence](../../docs/spine-linear-profile-evidence.md) and [shared verification](../../../evidence/spine-linear-profile-verification.json). The current complete development verifier accepted 160 tests and exact A39/B100 type tuples; current full prepush/push/PR/Main remain PENDING. A's earlier source-only and Pending cutoffs above remain unchanged. Core, pose, resources, playback, rendering and entitlement remain unaccepted; controlled faults remain pending and R020/V020 and R008/V006 remain OPEN.
<!-- F2-B-GUIDE-0.43.0-END -->
