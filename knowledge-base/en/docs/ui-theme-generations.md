# UI theme generations

English | [简体中文](../../Cns/docs/ui-theme-generations.md)

The optional `@egret/engine/ui` entry adds immutable, admitted theme generations to the existing `UiRoot` preparation and commit domain. This is the M3.4 theme/skin slice, not the complete controls, semantics, IME, effects or device acceptance package.

## Data and API

`createUiTheme({ id, colors?, spacing?, typography?, skins? })` returns a distinct frozen `UiTheme` identity. Equal descriptors still create separate generations; the ID is a label, not authority or a global revision. Nested records are copied and frozen. Each group admits at most 64 tokens. Identifiers use ASCII letters followed by letters, digits, underscore, dot or hyphen, at most 64 characters. Plain data records only: accessors, symbols and unknown fields are refused without calling getters.

Colors are integer RGB values from 0 to 0xffffff. Spacing is finite 0–4096. Typography supplies a nonempty font family of at most 256 characters without control characters, font size 1–512 and line height 1–2048. Skin records require `default` and optionally provide `hover`, `pressed`, `disabled`, `focus`, `checked`, `selected` and `expanded` names. These names select application-owned typed asset references; they are neither URLs nor implicit loader instructions. State selection and accessible control behavior remain with the existing/application control owner.

`UiRootOptions.theme` selects the initial desired generation. `root.setTheme(theme | undefined)` stages a change; `root.snapshot().theme` reports only the committed generation. A structural imitation is refused even if its fields match. `LayoutNode.theme` can bind `fill` to a color token and `padding`/`gap` to spacing tokens. Missing referenced tokens fail before accepting intent. Literal node values are the fallback when theme is undefined. Fill bindings require leaves; virtual lists cannot bind padding/gap.

Both `UiLeafPrepareContext.theme` and `RowBindContext.theme` carry the captured generation. Existing content callbacks can select typography for the current paragraph request/provider contract or select skin assets through the existing asset manager/content groups. They must own every acquired lease or prepared content through their supplied Scope and observe its cancellation signal. No second asset manager, resource namespace, input listener, CSS cascade or font-provider authority is added.

## Preparation, publication and cancellation

Every theme change conservatively re-prepares admitted leaf and row content in detached candidate Scopes. Colors and skin names are paint changes; spacing and typography differences are metric changes. Metric changes rerun layout and invalidate old measured list heights while preserving the stable-key scroll anchor and offset, subject to existing bounds. There is no cross-root atomicity.

A paint-only change with no other uncommitted root edits reuses the committed layout plan and box identities. It performs no layout or authored measurement calls. Prepared content must return exactly its prior measured height; otherwise `UI_THEME_METRICS_CHANGED` rejects the candidate and preserves the old domain. Row validation compares against the committed height index, including explicit updateHeights changes, rather than an older binding measurement. Applications must include a spacing/typography change when a skin affects measurement. The cumulative `snapshot().counters.layoutPasses` counts actual planner invocations, including detached width discovery; it stays unchanged for a paint-only switch. Current measurement counters are zero after that publication. Content preparation and painting may still do work; this is not a performance or font-rasterization claim.

Call `prepare()` until it returns ready, then use the existing explicit `commit()` at an idle Engine boundary. Commit publishes display bindings, geometry, snapshot and theme without user callbacks between partial assignments. Only afterward does it retire old content. Existing resource sharing retains other users' leases. The initial empty root remains a noninteractive placeholder until its first complete commit.

Failures retain the committed state. A newer theme or ordinary `setTree`, source, viewport, origin, scroll or invalidation intent makes an older preparation stale. Ordinary edits retain the desired theme and may require layout; they never publish it on their own. To cancel a pending switch, stage `root.setTheme(root.snapshot().theme)`, then prepare/commit the resulting intent. Other staged edits remain staged. A rejected candidate can be retried by preparing again. Scope/root/Engine disposal cancels pending preparation and retires detached ownership; late completions cannot resurrect it.

Explicit focus/composition row retention preserves its existing no-rebind contract. A theme that would replace a retained binding is refused with UI_ROW_RETAINED before accepting the theme intent; retention acquired during pending preparation is checked again before a candidate can become ready. Release retention before explicitly retrying the switch. Cancellation back to the retained binding's committed theme remains available.

Callback reentry is governed by the existing revision and ownership checks. Direct cleanup errors returned by UI callbacks remain in `postCommitErrors`; Scope-owned disposal errors use the existing Engine cleanup diagnostics and do not retroactively undo a published theme.

## Example and verification boundaries

The existing [UI data panel](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-data-panel/README.md) adds dark/light paint variants, larger typography/row metrics, image-skin selection, delayed success, rejection, cancellation and supersession. The second panel stays independent. The same checked PNG, font, typed asset loader, pointer channel and shared rendering hosts are retained.

Focused public behavior tests cover immutable admission, genuine identity, no-layout paint publication, changed-height refusal, failure/stale/late ownership, ordinary edits, anchor preservation and cleanup diagnostics. Strict positive and seven unsuppressed negative cases cover the optional entry and readonly branded contract. The example collector freezes its full input closure and checks literal pixels, geometry, planner counters, actual mouse behavior and shutdown on both shared backends. Local results, complete gates, independent review and PR/main delivery are separate statuses; physical touch, accessibility, full control states and font/script qualification remain open.

The [theme verification summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-data-panel/theme-verification-summary.json) records observed inputs, focused and strict checks, both browser backends and the remaining delivery boundaries.
