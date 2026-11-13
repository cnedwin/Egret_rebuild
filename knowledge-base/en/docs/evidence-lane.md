# Evidence lane: checks bound to exact bytes

English | [简体中文](../../Cns/docs/evidence-lane.md)

A change to a product file no longer needs a recorded successor identity before it can merge. The checks that compare product files with recorded bytes still exist and can still be run. They report; they do not decide.

A product file is a source or emitted file of a package: anything under `packages/<name>/src`, `dist`, `web` or `rendering`.

## Why

Six boundary tools, a shared strict-type helper and its twelve callers, the B1 verifier and two maintenance tools each recorded the SHA-256 of product files. A change to one source line had to be admitted in every one of them as a new layer, and each layer kept the layers before it. The first round of 2D cost reductions changed four sources and needed edits in 23 tool and test files that had nothing to do with rendering.

A recorded hash proves one thing: these are the bytes that were checked. It does not say the bytes are correct, and it says nothing about the next version. What a reviewer needs from a merge check is whether the product still behaves and still presents the same public types. Those are checked directly.

## What decides a merge

`node tools/verify.mjs` runs, in order:

| Check | What it establishes |
| --- | --- |
| `build` | Every package compiles |
| `check-boundaries` | Package dependency direction, approved import edges, DOM-free core |
| `check-spine-content` | Optional Spine dependency and its notice |
| `resource-scene-boundary` | Module closure of the resource scene |
| `atlas-frame/boundary` | Module closure and routes of the atlas frame scene |
| `check-type-lanes` | Consumers of fourteen features compile, and fail, exactly as recorded |
| `check-types` | The remaining public type fixtures and their diagnostics |
| `test` | Every behavior test file outside the evidence lane |
| `verify-spine-f2-source` | The Spine experiment source |

None of these compares a product file with a recorded hash.

## Type lanes

A type lane is one compiler configuration under `tests/types` and the exact lines the compiler prints for it. A positive lane prints nothing. A negative lane prints the errors a consumer must get. The table is `tests/types/type-lanes.json`.

~~~text
node tools/check-type-lanes.mjs
node tools/check-type-lanes.mjs --record
~~~

The first command compiles every lane and compares. The second rewrites the table from what the compiler prints now. Use it when a public type was meant to change, then read the difference: each changed line is a change a consumer will see. The table records no file identity, so an edit that leaves public types alone never touches it.

The compiler names a module by its location on the machine. The tool replaces the checkout directory with `<repository>` so that one table serves every machine.

The lanes were recorded from the tree in which the earlier byte-bound type replays all passed, and 23 of the 28 lanes those replays owned match their saved diagnostics line for line. The other five had been superseded by later observations inside the helper.

## What became evidence

`tools/lib/evidence-lane.mjs` lists the tools and test files that were written against one exact set of product bytes.

| Kind | Checks |
| --- | --- |
| Source and emission identity | The SpriteSheet, sequence playback, browser PNG, bitmap resource slot, bitmap binding ticket and atlas import boundary tools, and their test files |
| Type replays | Fourteen `*-types` tools bound to recorded source and declaration identities, `tests/strict-successor-boundaries.test.mjs` and `tests/sequence-reset-types.test.mjs` |
| B1 verifier | `tests/b1-webgpu-verifier.test.mjs` |
| Maintenance history | `tests/publication/incremental-checks-evidence.test.mjs`: the cases that rebuild earlier revisions of tools from recorded bytes |

The maintenance history cases are bound to recorded bytes of tools, not only of product files: they replay `tools/check-types.mjs` and the boundary tools as they once were.

~~~text
node tools/evidence.mjs --list
node tools/evidence.mjs --tools
node tools/evidence.mjs
~~~

The report marks each check `HOLDS` or `STALE`. A stale check was true of the bytes it was written against. It says nothing about the current bytes, in either direction. It is not a failure and it is not a pass.

`node tools/current-identities.mjs` reports the saved evidence files under `examples`, `verification` and `knowledge-base/evidence` that record identities which are no longer current. `--write` writes the identity of every product file to `current-identities.json`, which Git ignores, and prints one digest of the table. That digest names the whole product as built; evidence can record it beside the commit. After a merge to `main`, CI prints the digest and both reports in the run summary.

When the lane was introduced, every tool in it held for the files as they stood. Seventeen maintenance history cases were stale from that moment, because they replay recorded bytes of `tools/check-types.mjs` and the same change removed the type replays from that file.

To renew a piece of evidence, run its tool or procedure against the current files and save the result with the identities it was run under. Renewal is a deliberate act with its own review. It is never a condition of merging a change.

## Tests that moved, and one that changed

A test file whose subject is an evidence tool is evidence too. `tests/project-boundaries.test.mjs` held both kinds: the package boundary cases and the seven-pair resource consumer controls stay, and the replays of the strict type tools moved to `tests/strict-successor-boundaries.test.mjs`. Both use `tests/helpers/project-fixture.mjs`. No case was removed or rewritten.

`tests/spritesheet-fault.test.mjs` is a behavior test that recorded three earlier identities of two emitted modules as a precondition. It now reads the pair as built, once, and holds the whole SDK to those bytes while its cases run. Its fault injection still refuses unless the block it replaces is present exactly once.

The shared baseline check ran three positive controls before a push. One of them, the B1 emitted closure, is bound to emitted bytes and is now evidence; two remain.

## What this gives up

The evidence tools checked more than bytes in passing, such as the exact list of modules one feature may load. Where `check-boundaries`, a retained boundary check or a behavior test covers the same rule, it is still enforced at merge. Where only an evidence tool covered it, it is now reported, not enforced.

Recorded hashes also made an unreviewed edit to a product file impossible to miss. Review of the change itself now carries that.

## Rules for contributors

- Do not add a check that compares a product file with a recorded hash to the merge sequence. `tools/verify.mjs` refuses an evidence tool in its list.
- A new check that needs exact bytes belongs in the evidence lane from the start.
- Do not add successor layers to the evidence tools to make them hold again. Renew the evidence or leave it stale.
- Hashes of files that are not product files, such as third-party notices and frozen compiler inputs, are unchanged by this.
