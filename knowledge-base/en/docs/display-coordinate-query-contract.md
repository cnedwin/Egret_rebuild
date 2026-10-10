# Display Coordinate Query Contract

English | [简体中文](../../Cns/docs/显示坐标查询契约.md)

Date: 2026-10-10. Status: implemented experimental contract; bounded execution recorded. Implementation and acceptance evidence are recorded separately. This contract adds bounded CPU coordinate queries to the existing [display and frame semantics](display-and-frame-execution-contract.md). It establishes no new platform support, performance result or complete legacy compatibility.

## Public API and values

```ts
export interface Point2D {
  readonly x: number;
  readonly y: number;
}
export interface CoordinateQueryOptions {
  readonly maxNodes?: number;
}

// DisplayObject, inherited by DisplayObjectContainer, Sprite, Bitmap and Stage
localToGlobal(localX?: number, localY?: number,
  options?: CoordinateQueryOptions): Point2D;
globalToLocal(globalX?: number, globalY?: number,
  options?: CoordinateQueryOptions): Point2D;
```

Both types are available through the `@egret/engine` root as type-only exports. Point2D belongs to contracts; CoordinateQueryOptions belongs to runtime. No Point class, public inverse/matrix helper, new entry point or executable type factory is added. The core remains DOM/Node-free; import starts no scheduler or host activity.

Each missing or undefined coordinate defaults independently to zero. Coordinates must be finite number primitives; null, boxed numbers, strings, NaN and infinities reject without coercion. A successful query returns a fresh frozen `{x,y}` with finite values and positive zero in place of any negative zero. It retains no live node, engine, lease, host or caller-options reference. Saved results remain usable after reparenting, disposal and shutdown. The query mutates no display state, ownership, resources or frame sequence.

The third argument is new query options, whereas historical Egret APIs accepted a mutable output Point there. This contract never mutates a caller result object; a legacy adapter remains pending. A fresh Point-like object is not a typed options literal. Structural variables containing a valid maxNodes plus extra x/y fields may still be accepted; unknown fields are ignored and cannot become output storage.

## Coordinate space and transform authority

Use authoritative internal display identity, parent and transform state. Overridden public transform, parent, isDisposed or child-list getters and subclass validation hooks do not supply query authority. A Proxy around a genuine node is a different, unauthenticated receiver. Genuine registered DisplayObject subclasses inherit the methods.

The identity matrix lies above the actual topmost ancestor. Include every node's transform, including Stage or a detached root. A detached subtree uses its actual root space and does not inherit a former Stage's transform through retained engine affinity. Stage's own localToGlobal includes its own visual transform. There is no implicit global Stage.

Rotation is degrees reduced by `% 360` before radians/trigonometry. Local transformation applies scale, then rotation, then translation. With C=cos(angle), S=sin(angle), local coefficients are `(C*scaleX,S*scaleX,-S*scaleY,C*scaleY,x,y)`. Build world root-to-receiver as parent × local. For parent p and local coefficients a,b,c,d with translation x,y, preserve this binary64 expression order:

```text
world.a  = p.a*a + p.c*b       world.b  = p.b*a + p.d*b
world.c  = p.a*c + p.c*d       world.d  = p.b*c + p.d*d
world.tx = p.a*x + p.c*y + p.tx
world.ty = p.b*x + p.d*y + p.ty
```

World maps points as `X=a*x+c*y+tx`, `Y=b*x+d*y+ty`. Preserve existing frame-capture arithmetic and trigonometric values; do not snap quarter turns or compensate/reorder forward sums. Every composed matrix must remain finite. localToGlobal permits zero/negative scales and singular matrices when the complete matrix and mapped point remain finite; ordinary binary64 underflow is permitted. A nonfinite matrix or mapped point rejects the complete query, even if an overflowing matrix coefficient is unused by the requested point.

Visibility, alpha, clipping, graphics, texture content/lease entitlement, frame dimensions and pixel ratio do not alter these coordinates. Queries require no drawing, layout validation, backend access or resource acquisition. This slice adds no bounds, hit testing, mutable Point/Matrix, cross-node conversion, cache or scheduler.

## Exact stored-matrix inverse and numerical limits

globalToLocal solves the completed finite binary64 world matrix. Its linear determinant is `a*d-b*c`, evaluated exactly from the stored coefficients for the singularity decision. Only an exactly zero determinant produces COORDINATE_TRANSFORM_SINGULAR; there is no condition threshold. The matrix's rank is authoritative even if earlier frame-style composition collapsed a nonzero authored scale.

The private inverse uses fixed-size dyadic arithmetic with built-in BigInt and local binary64 decoding. A finite number is exactly N*2^e with at most 53 integer magnitude bits and e in [-1074,971]. Evaluate exactly:

```text
det = a*d - b*c
nx  = d*globalX - d*tx - c*globalY + c*ty
ny  = a*globalY - a*ty - b*globalX + b*tx
localX = nx/det; localY = ny/det
```

Check det=0 before solving. A zero numerator returns positive zero. Nonzero quotients are rounded once to binary64, nearest with ties to even. Exact product/alignment and final quotient rounding retain extreme coefficient/RHS exponents independently, so intermediate normalization, translated subtraction or rounded product cancellation cannot silently erase a representable result. These fixed expressions require at most 4197 determinant bits, 4198 numerator bits and 4251 rounding/comparison bits, within an internal conservative 8192-bit ceiling. No caller-defined precision, arbitrary term lists, new dependency or general numerical API is introduced.

For an exact nonzero quotient, determine its binary exponent k using integer bit lengths and exact shifted comparison. k>1023 rejects range; k<-1075 rounds to positive zero. Otherwise round at quantum 2^(k-52) for normal output, or 2^-1074 for subnormal output, using integer quotient/remainder and parity. Handle normal/subnormal carry and the maximum-finite overflow midpoint. Publish one frozen Point2D only after both coordinates round to finite values; a rounded infinity rejects range. Negative outputs mirror positive rounding, and any rounded zero is positive.

This defines rounding of the rational inverse of the stored matrix. It promises neither exact real-hierarchy coordinates nor a uniform error bound for near-singular matrices. Small coefficient/input perturbations can cause large output changes; correctly rounding the stored-matrix solve does not restore precision lost in composition or ordinary forward mapping. Forward-to-inverse round trips are not guaranteed. Final inverse underflow to zero is permitted by nearest-even rounding; overflowing world composition remains an error before the inverse can run. Fixed bit bounds establish bounded operand size, not latency, allocation benchmarks or real-time suitability.

## Admission, lifetimes, reads and budgets

Options is undefined or a non-null, non-array object; functions and other primitives reject. maxNodes missing/undefined defaults to 4096; an explicit value must be an integer in [1,65536], without coercion. Null is invalid. Inspect array admission once and read maxNodes once through ordinary property lookup, including inherited getters. Do not enumerate unknown keys, separately inspect a prototype, or retain options.

The node budget counts the receiver and every actual ancestor, including Stage or a detached root. A path at the budget succeeds and an additional node produces COORDINATE_TREE_LIMIT. The hard maximum is 65536. Ancestor traversal is iterative, scans no descendants, and rejects repeated identities as DISPLAY_TREE_INVARIANT. Each call's traversal/allocation is bounded; arbitrary options-getter work and aggregate reentrant calls are outside this bound. Deep-tree cleanup is not changed by this query contract.

Error precedence is:

1. Authenticate receiver identity before public receiver or options reads; reject COORDINATE_RECEIVER_INVALID.
2. Check receiver liveness, then its bound engine openness. OBJECT_DISPOSED precedes ENGINE_CLOSED if both apply. Detached bound objects retain closing/closed restrictions; live never-bound objects need no engine.
3. Validate primitive coordinates before options admission. For an object candidate, evaluate Array.isArray once inside a narrow catch. Preserve a revoked object/array Proxy's actual admission exception as `EgretError('COORDINATE_INPUT_INVALID',{cause})`, without a second probe or maxNodes read. Semantic shape failures stay outside that catch.
4. Capture maxNodes once after successful admission. Wrap any read exception with COORDINATE_INPUT_INVALID and its exact cause, including undefined or an EgretError. Never classify source exceptions by their type/code. A throwing source takes precedence over a close/dispose it also initiates.
5. After a successful field read, recheck receiver liveness/openness before maxNodes validation and current-path gathering. Completed getter transform/reparent changes are observed; getter-triggered close/dispose prevents result publication. Reentrant queries own separate local state.
6. Check the path budget, each node's liveness/openness, composed matrices, forward mapping or inverse exact determinant/final rounding, and final path lifetimes before publication. Inverse exact singularity precedes hypothetical coordinate-range failures.

| Error | Meaning |
| --- | --- |
| COORDINATE_RECEIVER_INVALID | Unregistered, forged or proxied receiver. |
| OBJECT_DISPOSED / ENGINE_CLOSED | Existing terminal-object or bound-engine restriction. |
| COORDINATE_INPUT_INVALID | Invalid coordinate/options value, or source admission/read exception with exact cause. |
| COORDINATE_TREE_LIMIT | Actual ancestor path exceeds maxNodes. |
| DISPLAY_TREE_INVARIANT | Repeated identity in the authoritative ancestor path. |
| COORDINATE_ARITHMETIC_RANGE | Nonfinite completed matrix/forward point, or nonfinite final rounded inverse coordinate. |
| COORDINATE_TRANSFORM_SINGULAR | Exact zero linear determinant of the finite stored world matrix. |

Queries emit no diagnostics, consume no frame IDs, establish no ownership/binding and acquire/release no resource. Existing scalar property reads are unaffected by these operational-query lifetime rules.

## Compact validation plan

Behavioral/type acceptance uses built `@egret/engine`; private numerical imports are not implied. Hand-derived literal results are primary oracles, with 1e-10 absolute tolerance for quarter-turn examples and exact assertions for dyadic cases. Round trips are supplementary.

| Public setup/input | Required result |
| --- | --- |
| Parent x=10,y=20,scaleX=2; child x=3,y=4,rotation=90 | Child (1,2) → global (12,25); global (4,28) → child (4,6). |
| Same tree, Stage x=7,y=-3,scaleX=3,scaleY=-2 | Child (1,2) → (43,-53); detaching parent restores (12,25); Stage origin → (7,-3). |
| x=5,y=-7,scaleX=-2,scaleY=3 | (4,-2) → (-3,-13), and the inverse returns (4,-2). Setting scaleX=0 permits forward (5,-13), but inverse rejects singular. |
| scaleX=2^600,scaleY=2^555; global (0,2^-500) | Inverse (0,2^-1055), exactly representable and nonzero. |
| Uniform scale 2^1023, x=-2^1023; global (2^1023,0) | Inverse (2,0), despite an overflowing ordinary translated difference. |
| scaleX=1,scaleY=2^-46, or scales (2^600,2^-600) | Matching global (2*scaleX,3*scaleY) → (2,3); no condition cutoff. |
| scaleX=2; globalX=MIN, then 3*MIN; MIN=2^-1074 | Inverse x=+0, then 2*MIN, by nearest-even subnormal ties. |
| Unit scale, globalX=MAX, x=-2^969 / -2^970 / -3*2^969 | Inverse x=MAX / range error / range error; MAX=Number.MAX_VALUE. |
| Stage + parent + leaf, maxNodes=3 / 2 | Success / tree-limit error; default paths of 4096 / 4097 nodes have the same boundary. |

Also verify identity/frozen-result ownership, ignored render/texture state, hostile public getters, revoked and inherited options behavior, read-cause precedence, getter-triggered mutation/disposal, retained detached engine affinity, negative mirrors, zero numerator with negative determinant, normal/subnormal carry, forward overflow and readonly/public DOM-free types.

For product-cancellation coverage, use public parent/child Sprites both rotated 45 degrees, parent scales (1,2^-120), and a small child Graphics rectangle. Observe the child matrix through public captureFrame. The discriminating fixture is conditional on captured coefficients `(a,b,c,d)=(1/2+2^-53,1/2,-1/2,-1/2+2^-53)`: ordinary rounded `a*d-b*c` is zero, exact determinant is 2^-106, and global (0,2^-106) inverses to (1/2,1/2+2^-53). Assert those coefficient identities on the pinned runtime before counting coverage. If they differ, derive another public fixture; do not silently skip coverage, substitute a round trip or introduce an unauthorized private import.

Shared composition extraction must preserve frame-capture coefficient values, suppression, errors and snapshots. Its emitted graph changes require fresh affected real Canvas/WebGPU rectangle verification; CPU equivalence alone does not establish an unchanged rendering build. B1 has a separate gate only when its bounded graph/scene behavior is affected. Record actual source identities, environments, commands and uncovered items in evidence; planned checks do not establish passed acceptance.

## Source and implementation independence

This is a first-party specification using the recorded display/frame authority and independently derived affine/dyadic mathematics. Implementation is to be independently authored from these contracts; no historical engine implementation is required as source input. First-party code/docs retain Apache-2.0. No third-party product dependency is added. Record AI assistance, actual implementation inputs and author review separately from research references and acceptance evidence. Preserve the package DAG: engine depends on runtime/contracts, runtime only on contracts, and contracts has no package dependencies. Preserve strict core types and existing package exports; production hosts, migration adapters, bounds and hit testing retain separate acceptance obligations.

## Recorded execution — 2026-10-10

The public coordinate suite registered 49 genuine missing-API failures before implementation; the focused successor passed 92/92 coordinate/frame/tree/texture checks, including the actual C37 public-capture coefficient gate. After correcting the expected Parameters tuple's explicit undefined unions, the strict gate passed 68 root + 5 web + 28 project expected negative diagnostics, including 14 coordinate additions; whole-callable assertions stayed intact. The recorded core verifier passed 1045/1045 tests, 300 boundary files and headless execution. Fresh affected Canvas, WebGPU rectangle and bounded B1 observations passed with their recorded desktop fixture and cleanup limits. Read the [paired evidence](display-coordinate-query-evidence.md) and [compact record](../../evidence/coordinate-query-verification.json) for exact identities, failures, numerical proof and scope. Independent implementation and saved-render reviews have zero actionable P1/P2 within their declared scopes; current public-material review, fresh complete prepush and remote delivery remain separately pending. These observations establish no performance, phone, cross-browser, full 3D/UI/Spine or complete migration acceptance.
