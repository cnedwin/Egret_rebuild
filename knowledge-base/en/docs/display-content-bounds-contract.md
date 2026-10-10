# Display content bounds — proposed bounded contract

Status: bounded public implementation with recorded CPU/type and affected desktop observations plus scoped independent source and saved-render reviews. Bilingual public-material review, final prepush and stacked remote delivery remain separately pending.

## Public surface and purpose

```ts
export interface BoundsQueryOptions {
  readonly maxNodes?: number;
  readonly maxPrimitives?: number;
}
// Inherited by DisplayObjectContainer, Sprite, Bitmap and Stage.
DisplayObject.getBounds(options?: BoundsQueryOptions): Rectangle2D;
```

The engine facade exports the options as a type and reuses its existing readonly Rectangle2D type. Every success returns a fresh frozen record with exactly x, y, width and height, finite numbers and positive zero normalization. The result retains no node, options, primitive, lease or image. There is no mutable output rectangle or target-space argument. A legacy output-rectangle adapter remains pending. Fresh literals with unknown fields fail TypeScript excess-property checking; structural variables with a recognized options field may contain extra fields. At runtime unknown fields are ignored without reading them, and options are never mutated. Omitted options/fields, including untyped field values of undefined, use defaults. Exact optional property typing does not admit an explicitly undefined field in a typed options literal.

This slice measures content for future layout. It supplies neither layout sizing/invalidation nor hit testing, input eligibility, clipping-aware visual bounds or pixel bounds. No geometry class, arbitrary geometry extension hook, new dependency or platform support is added. The broader naming document's transformed-bounds wording needs a bounded-slice qualification: descendant transforms are included in receiver-local bounds; other coordinate spaces require a future contract.

## Space and admitted content

The receiver defines local coordinates. Its own transform and every ancestor transform are excluded, including Stage's transform when Stage is the receiver. Each descendant contributes through the ordered parent × local composition already used by frame capture and coordinate queries. Detached trees are valid; reparenting the receiver alone does not change this local measurement. No inverse is used, so a singular receiver is valid. Singular descendant transforms may collapse positive content to a point or line.

Content consists of authoritative rectangle Graphics primitives and an occupied Bitmap's cached crop dimensions at local (0,0). A crop's source x/y do not offset its display geometry. Visibility, alpha (including fill alpha), colors, clip rectangles, live image entitlement, host pixels/DPR and draw readiness do not filter content. Retiring a lease or disposing its Texture does not erase cached dimensions while the bound engine remains open; clearing the Bitmap lease removes its cached geometry. Bounds never reads image/lease entitlement or grants access to pixels.

Every admitted primitive, including zero-width/height rectangles, consumes one primitive unit; an occupied Bitmap consumes one, a cleared Bitmap none. Authored rectangles with either extent zero contribute no content and skip endpoint/corner arithmetic. A positive rectangle contributes even when later rounding or a descendant transform collapses its extent. An internal hasContent flag distinguishes no contributors from a degenerate contributor without adding a public field. No contributors yield {x:0,y:0,width:0,height:0}; a point at (7,9) yields {x:7,y:9,width:0,height:0}. Neither zero extents nor the all-zero record prove logical emptiness.

## Numerical boundary

For descendants, preserve the existing composition expressions and evaluation order exactly: rotation is degrees with (rotation % 360) × PI / 180, local coefficients use sin/cos and signed scales, and parents multiply local matrices. Do not snap quadrants, compensate cancellation, reuse the inverse kernel, or apply singularity thresholds. Every visited descendant's completed six-coefficient matrix must be finite, including nodes with no content. The excluded receiver/ancestor transforms are not evaluated.

For each positive primitive, compute right = x + width and bottom = y + height and require both finite. Evaluate all four direct corners as X = a*x + c*y + tx and Y = b*x + d*y + ty in that order, requiring finite results. Union these evaluated corners; never transform an already aggregated child bounding box. After union, compute width = maxX - minX and height = maxY - minY, require finite results, and normalize signed zero in the four returned fields. A nonfinite matrix, endpoint, corner or final extent raises BOUNDS_ARITHMETIC_RANGE. No offending content is silently discarded. Ordinary finite binary64 rounding and underflow, including collapsed geometry, are accepted.

This is measurement of evaluated binary64 geometry, with ordinary binary64 extent subtraction. It makes no outward-rounded conservative-enclosure promise. The returned x + width need not reconstruct maxX. For rectangles (1,0,1,1) and (2^53,0,2,1), the evaluated extrema are 1 and 2^53+2; their exact difference 2^53+1 rounds nearest-even to width 2^53. A future hit-test or broad-phase contract must not use this record as its sole rejecting bound without its own numerical contract. This API also makes no inverse/forward round-trip, exact-real geometry or performance claim.

## Admission, lifetime and failures

Authenticate a genuine receiver by private identity before any public getter or caller options read; forged objects and proxies of genuine nodes raise BOUNDS_RECEIVER_INVALID. Check receiver lifetime, then bound-engine openness, before options. OBJECT_DISPOSED precedes engine closure when both hold. Live unbound nodes are allowed; detached bound nodes retain their engine lifetime restriction.

Options must be undefined or a non-null, non-array object; functions and primitives are invalid. Check Array.isArray once in a narrow source-fault catch: a revoked proxy's thrown error becomes the exact cause of BOUNDS_INPUT_INVALID. Array semantic rejection occurs outside that catch. Read maxNodes then maxPrimitives once each through normal property lookup, including inherited getters. Complete both successful reads before the receiver lifetime/openness recheck and numeric validation. A first throwing read prevents the second; a second throwing read precedes first-field semantic invalidity. Any read throw, even undefined or an EgretError and even after disposal/closure, is preserved as the exact supplied cause of BOUNDS_INPUT_INVALID. Successful reads followed by disposal/closure raise the lifetime error before field semantics. Source catches must not wrap semantic/lifetime errors. Do not enumerate, probe prototypes or retain options.

Validate maxNodes first, then maxPrimitives: finite integer numbers in [1,65536] and [1,262144], respectively. Defaults are 4096 nodes and 65536 primitives. Invalid values raise BOUNDS_INPUT_INVALID. These are explicit admission limits, not time, byte, arbitrary-getter-work or aggregate-call guarantees.

After option capture, observe authoritative state resulting from completed getter mutations, reparenting or reentry. Each call owns its accumulators and traversal. No traversal callback or subclass/public getter is invoked. Visit receiver first, then each node's Graphics insertion order, then occupied Bitmap slot, then children in current authoritative index order, depth first. Count all nodes, including empty, hidden and clipped ones. Check a node limit before retrieving the next child; check a content limit before accessing the next item's geometry. The first reached failure in this order wins: BOUNDS_TREE_LIMIT or BOUNDS_CONTENT_LIMIT. On node entry check private identity/tree consistency and lifetime/openness; check descendants' matrices before their content. Repeated identity, missing expected child or parent mismatch raises DISPLAY_TREE_INVARIANT. Recheck visited lifetimes before publishing; return no partial result on failure. Valid public tree operations cannot construct invariant corruption.

Queries change no tree, binding, resource, frame identifier, draw counter or host state. Authentication/state access bypass overridable x/y/scale/rotation, parent/children/numChildren, isDisposed, Bitmap dimension/lease/crop getters and assertUsable hooks. User option getters can themselves perform user code; the query does not erase those effects.

## Literal validation plan, not results

Public facade tests will isolate genuine API-absence RED from other cases and verify facade Bitmap module loading. Literal groups cover receiver/Stage exclusion, exact translations/reflections, nested rotations/shear with a stated floating tolerance, direct-corner versus aggregate-AABB behavior, no-origin seeding, zero/degenerate content, hidden/alpha/clipped content, Bitmap cached/retired/cleared state, freeze/freshness, signed zero, arithmetic overflow/underflow, the 2^53 extent fixture, ordered getter causes and mutations/reentry, lifetimes, hostile public getters, and receiver-inclusive wide/deep budgets. No private runtime import or production helper serves as the oracle.

Public type fixtures will check both whole-callable equality and optional parameter tuples, readonly return/options, inherited methods and structural versus fresh-literal options; negative cases include bad budgets, explicit undefined fields, mutable result/options, legacy output arguments and an extra argument. Existing Bitmap/frame/texture/tree/coordinates regressions, strict core type/boundary gates and full headless verification precede fresh affected Canvas, rectangle WebGPU and B1 desktop acceptance with source/build identities. Those gates cannot establish phone, cross-browser, performance, GPU bounds arithmetic or complete UI support. Independent source, numerical-boundary and bilingual review precede acceptance.

## Provenance

The proposal is first-party design from current authoritative code and requirements, prepared with AI assistance. Existing first-party transform expressions are retained for source equivalence; no external research source, old engine implementation or third-party dependency supplies a new implementation. Future evidence must distinguish proposal, actual execution, independent review and publication, preserve predecessor records and record actual AI contribution. No test execution is claimed here.

## Recorded execution and acceptance boundary — 2026-10-10

[简体中文](../../Cns/docs/显示内容边界契约.md) · [Bounded evidence](display-content-bounds-evidence.md) · [Compact record](../../evidence/content-bounds-verification.json)

The original title, normative body, literal validation plan and provenance above are preserved as authored. This isolated appendix records the actual successor: baseline build succeeded and all 18 registered callbacks failed at authentic getBounds availability; the focused successor passed 157/157 including 18 bounds callbacks. Positive/DOM-free type checks passed with 81 root + 5 web + 28 project = 114 expected negative diagnostics, including 13 bounds additions. Core verification passed 1063/1063 and 306 boundary files; headless execution closed with zero pending timers.

Fresh saved desktop Canvas reported 14 checks; rectangle WebGPU reported 42 frames, 1709 raw checks, 84 PNGs, 6808 composition checks and 8 counterexamples; B1 reported 7 positive frames, 5 counterexamples and 11 submissions. Each 391-file inventory was stable. These observations do not execute bounds arithmetic on the GPU; B1 OS descendant retirement is UNBOUND. The scoped source audit reported PASS_SOURCE_WITH_LIMITS with zero unresolved P1/P2, including whole Bitmap extraction equivalence. The independent saved-render audit reported PASS_SAVED_RENDER_WITH_LIMITS with zero unresolved P1/P2. Bilingual public-material review, complete prepush and actual stacked delivery are separately pending. Exact execution, retained source-preparation guard failure/header-only test projection and source/review identities are in the paired evidence and compact record; overlapping suite counts are not additive.
