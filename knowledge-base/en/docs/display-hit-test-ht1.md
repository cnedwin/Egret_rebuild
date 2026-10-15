# Authored rectangular display picking: HT1

English | [简体中文](../../Cns/docs/显示命中HT1.md) · [Coordinates](display-coordinate-query-contract.md) · [Display-tree scaling](display-tree-scaling.md)

Engineering preview **0.29.0** adds explicit logical picking to the existing display tree. Applications author local rectangles and ask their genuine Engine-owned Stage for the topmost eligible object. The independently implemented CPU slice, targeted behavior, strict types and finite boundary controls have recorded results below. Complete current verification and six affected existing desktop renderer regressions passed. The private-plan browser picking supplement, independent bilingual meaning review, mandatory Git push hook and delivery remain **PENDING**. Workspace packages remain private `0.0.0`; protocol pins remain `1.0`. These verification and pending-delivery statements retain the original 0.29.0 cutoff; they are not a new assessment of later picking integrations.

## Public API and example

| Surface | Contract |
| --- | --- |
| `DisplayObject.touchEnabled` | Primitive boolean, default `false`; enables only this object's own authored area. |
| `DisplayObject.hitArea` | `Rectangle2D \| undefined`, default `undefined`; successful assignment stores a new owned frozen local rectangle. |
| `DisplayObjectContainer.touchChildren` | Primitive boolean, default `true`; controls descent without implicit retargeting. |
| `Stage.hitTest(globalX, globalY, options?)` | Required finite primitive logical coordinates; returns a borrowed `DisplayObject \| undefined`. |
| `HitTestOptions` | Type-only export from existing `@egret/engine` and `@egret/runtime` roots; `readonly maxNodes?: number`. |

There is no new value export, package subpath, dependency, implicit global Stage or input router. The following TypeScript function uses the existing public factory, Scope ownership and Sprite constructor. The application supplies its admitted HostAdapter. Picking does not need drawn content or a render submission.

```ts
import { createEngine, Sprite } from '@egret/engine';
import type { HostAdapter, HitTestOptions } from '@egret/engine';

async function selectsButton(host: HostAdapter): Promise<boolean> {
  const engine = await createEngine({ host });
  const screen = engine.createScope();
  try {
    const button = screen.use(new Sprite());
    button.x = 20;
    button.y = 30;
    button.touchEnabled = true;
    button.hitArea = { x: 0, y: 0, width: 80, height: 40 };
    engine.stage.addChild(button);
    const options: HitTestOptions = { maxNodes: 4096 };
    return engine.stage.hitTest(25, 35, options) === button;
  } finally {
    try { screen.dispose(); }
    finally { await engine.dispose(); }
  }
}
```

The returned identity creates no ownership or retention obligation for the query. A previous result does not become a retained target after detachment or disposal. Applications that dispatch an existing typed Event must decide that action separately; `hitTest` itself emits no event and advances no frame, clock or animation.

## Two passes and selection order

After caller-input admission, the query first admits the **whole current Stage tree**, including Stage and hidden, disabled, singular, clipped-out and `touchChildren=false` descendants. The default `maxNodes` is **4096**; an explicitly supplied value must be an integer from **1 through 65536**. Stage counts as one node. Budget is checked before retrieving the next indexed child, and no eager sibling snapshot is taken. Ascending child indices establish structural failure order. Genuine identity, unique occurrence, private parent linkage, live state and identical Engine affinity are checked before any numerical work or result.

The second iterative pass establishes each eligible ancestor's stored world transform and local clip before visiting its children. Later sibling subtrees precede earlier ones, and a container's children precede its own area. Stage's transform participates. The first winning identity is retained, but **all otherwise eligible numerical branches still complete** before return. A valid topmost hit therefore cannot conceal an active sibling's arithmetic-range failure.

`visible=false` suppresses a branch's numerical work. An inherited rejected clip, a singular ancestor or `touchChildren=false` suppresses descendant numerical work; suppressed descendants were still charged by the first pass. `touchEnabled=false` suppresses only the object's own candidate, and a miss of its own area does not suppress its children. Alpha, including zero, has no selection effect. Stage is **never** a returned target, even if its inherited flag and area are assigned; there is no Stage fallback.

With `touchChildren=false`, a container can return itself only through its own enabled, positive area. A child's larger area is not projected onto that container. With `touchChildren=true`, descendants can be selected outside the container's own area when the applicable ancestor clips permit it.

## Coordinates, clips and exact rank

Composition uses the stored binary64 world matrix and requires finite components. Its exact rank is tested with the existing coordinate-inverse mechanism at the matrix translation, rather than an epsilon or rounded determinant. A singular ancestor suppresses its entire branch even if rounded descendant composition could regain rank. This does not change the existing coordinate-inverse algorithm or establish conservative pixel coverage.

The requested point is inverted only for an active nonempty clip or an enabled, non-Stage own area with positive width and height. An area-less or disabled ancestor does not perform an unnecessary requested-point inverse. Each ancestor clip is tested in that clip owner's local coordinates, including Stage's clip; there is no union or world-AABB substitution.

Every nonempty area and clip uses the half-open test `x <= localX < x + width` and `y <= localY < y + height`: local left/top are included, right/bottom excluded, including reflected transforms. Zero-area objects select nothing. Existing clip admission permits finite dimensions whose endpoints overflow; an **active** such clip fails with `HIT_TEST_ARITHMETIC_RANGE`, before zero-extent suppression. Hidden or otherwise suppressed clips do not evaluate those endpoints.

## Owned state, reentry and errors

`hitArea` accepts `undefined` or a non-null, non-array object. Ordinary inherited or proxied `x`, `y`, `width`, `height` properties are read **once each, in that order**, without enumeration or prototype inspection. After all reads succeed, node lifetime and the bound Engine are checked again before semantic validation. Components must be finite primitive numbers, extents nonnegative, and right/bottom endpoints finite, even for a zero extent. Successful admission preserves signed zero and commits one new frozen literal; it neither freezes nor retains the caller's object.

Source getters may complete reentrant assignments, detachment or shutdown. Their completed effects remain effective. A failed outer assignment does not commit a replacement or roll back those effects. Source shape/read faults, including revoked Proxy checks, an application EgretError and thrown `undefined`, are wrapped in the applicable input/area error with the exact original `cause`. A later lifetime check cannot replace a throwing source read. For successful reads, disposal or Engine closure takes precedence over invalid returned dimensions or budget.

New state getters authenticate genuine node/container identity and may return stored values after disposal, following existing visual-getter behavior. Setters require a live node and open bound Engine; flags accept primitive booleans only. Private node termination and Engine affinity provide authority. The query does not read an overridable Scope state getter or call overridden display getters, `getBounds`, `globalToLocal` or usability hooks. Normal Scope disposal terminates its owned node; this slice adds no new Scope lifecycle port.

| Code | Meaning |
| --- | --- |
| `HIT_TEST_RECEIVER_INVALID` | Required genuine Stage, node or container receiver is absent. |
| `HIT_TEST_INPUT_INVALID` | Required coordinates, options shape/read or `maxNodes` are invalid. |
| `HIT_TEST_AREA_INVALID` | Area shape/read, components, extents or endpoints are invalid. |
| `HIT_TEST_VALUE_INVALID` | Interaction flag is not a primitive boolean. |
| `HIT_TEST_TREE_LIMIT` | Receiver-inclusive whole-tree count exceeds the admitted budget. |
| `HIT_TEST_ARITHMETIC_RANGE` | Evaluated matrix, active clip endpoint or requested-point inverse is out of range. |

Existing `OBJECT_DISPOSED`, `ENGINE_CLOSED`, `DISPLAY_TREE_INVARIANT` and `ENGINE_MISMATCH` remain applicable. A singular matrix suppresses its branch rather than throwing a hit-specific singular error. Known internal coordinate range errors retain their cause when mapped to the hit-test range code; unexpected failures are not broadly converted into a miss.

Query priority is genuine Stage, root lifetime, Engine openness, required primitive coordinates, options admission and one budget read, successful-read lifetime recheck, numeric budget, complete structure, eligible arithmetic, final lifetime check, then borrowed result. An already disposed Stage precedes closed Engine or invalid input. A throwing options getter produces the input wrapper/cause; a successful getter that closes the Engine produces `ENGINE_CLOSED` before invalid budget semantics. No new diagnostic observer callback is introduced.

## Recorded evidence and open gates

The unmodified earlier public Engine entry failed **1/1** baseline test with `TypeError: engine.stage.hitTest is not a function`, after genuine setup and with cleanup recorded. The saved source review approved the seven production candidates and the finite three-file policy integration for controlled adoption, with no blocking source findings. These are source inspections, distinct from later execution.

Actual adopted-source build passed. The combined HT1/display-tree/scaling/coordinate run passed **98/98**, including **32** HT1 cases. The production boundary scan passed **426 files**. The complete strict-type run passed the existing checks plus **16** exact ordinary and **8** exact import diagnostics, each bound to the original file, line and code; the type-only option remains absent from web/text/WebGPU entries and private deep paths. These diagnostics are expected refusals, not runtime failures.

The separate boundary-policy run passed **221/221**, with one new inert synthetic positive control and **14** assigned mutants alongside retained checks. Each mutant first requires its complete synthetic baseline to pass, then its assigned refusal. This is finite checker-policy evidence, not Engine/tree/picking execution or a general parser/security proof. The behavior, policy and type scopes overlap and are **not summed**.

Independent review added literal Stage-clip and singular-ancestor regressions. An initial fixture arithmetic assertion was corrected to distinguish a rounded-zero determinant from an independently proven exact determinant of `1` in coefficient units `2^-53`; production code was unchanged. The review-cutoff authored counts and earlier missing-entry failure remain preserved separately from actual passing receipts. The shared [verification record](../../evidence/display-hit-test-ht1-verification.json) binds the selected inputs and these saved results.

| Gate | Current status |
| --- | --- |
| Finite product and integration source review | Approved for controlled adoption and execution; no blocking source findings at those cutoffs. |
| Actual build, 98-case combined CPU run, 426-file boundaries and strict types | **PASS**, within the stated scopes. |
| Separate 221-case synthetic boundary-policy run | **PASS**, policy scope only. |
| Complete current verification, invoked manually | **PASS**: 2,333/2,333 core and 59/59 publication tests; build, strict types, boundaries, headless and knowledge-base checks passed. Localization: 138 pairs, 6 registry views, 148 critical files, 0 issues. Knowledge base: 157 records, 241 Markdown files, 1,981 links, 944 references, 0 issues. |
| Six affected existing desktop renderer regressions | **PASS** for Canvas, WebGPU, B1, textured WebGPU, SequencePlayer and opt-in Canvas text. Default headless Edge 154.0.4258.62; the Canvas text collection returned `PASS_WC1_CANVAS_SUBSET` with six contexts. The separate freeze command is preparation, not a seventh browser gate. |
| Browser pointer → logical target → typed Event → rendered frame supplement | **PENDING**; private plan only, not implemented or run at this cutoff. |
| Independent bilingual meaning review, mandatory Git push hook and delivery | **PENDING**; the completed manual verification is separate from observing the Git push hook. |

## Scope and provenance

HT1 provides authored rectangular logical picking. DOM pointer-to-logical conversion, event routing, gestures, accessibility, automatic layout/content bounds, alpha/pixel/texture/TextField coverage and historical TouchEvent compatibility require separate designs and acceptance. Browser picking/phone behavior, performance, full UI, Spine, 3D input and complete migration are not established by this CPU increment.

The implementation, fixtures and documentation are AI-assisted independent first-party Egret work under **Apache-2.0**. The implementation composes existing first-party matrix, tree and lifetime contracts. No dependency or external asset is added. Previous rendering/font records, their legal notices, failures and source cutoffs retain their original scope.
