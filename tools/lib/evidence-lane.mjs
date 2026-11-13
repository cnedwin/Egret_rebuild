// SPDX-License-Identifier: Apache-2.0
// The evidence lane: checks that were written against one exact set of product bytes. Each of
// them proved something about that set and says nothing about another, so none of them decides
// whether a change may merge. tools/evidence.mjs runs them and reports which still hold.
//
// A product byte is a byte of a source or emitted file of a package (packages/<name>/src, dist,
// web or rendering). A check belongs here when changing such a file, without changing what the
// product does or the types it presents, is enough to make the check refuse. So does a check that
// replays recorded bytes of another check in this lane or of the type checks.

/** Tools run as `node tools/<name>.mjs`. */
export const EVIDENCE_TOOLS = Object.freeze([
  // Source and emission identities of whole packages or of one feature's modules.
  'spritesheet-boundary',
  'sequence-playback-boundary',
  'browser-png-boundary',
  'bitmap-resource-slot-boundary',
  'bitmap-binding-ticket-boundary',
  'atlas-import-boundary',
  // Compiler replays bound to recorded source and declaration identities. What a consumer of
  // these features may and may not write is checked without identities by check-type-lanes.
  'atlas-frame-types',
  'atlas-import-types',
  'bitmap-binding-ticket-types',
  'bitmap-button-types',
  'bitmap-resource-slot-types',
  'browser-png-types',
  'display-anchor-offsets-types',
  'display-container-add-child-at-types',
  'display-container-child-index-types',
  'display-container-remove-children-types',
  'linear-layout-types',
  'nine-slice-bitmap-types',
  'sequence-playback-types',
  'sequence-reset-types',
]);

/** Test files whose subject is one of the tools above, or the recorded identities themselves. */
export const EVIDENCE_TESTS = Object.freeze([
  'tests/atlas-import-boundary.test.mjs',
  'tests/b1-webgpu-verifier.test.mjs',
  'tests/bitmap-binding-ticket-boundaries.test.mjs',
  'tests/browser-png-boundaries.test.mjs',
  'tests/browser-png-boundaries-2.test.mjs',
  'tests/browser-png-boundaries-3.test.mjs',
  'tests/browser-png-boundaries-4.test.mjs',
  'tests/sequence-playback-boundaries.test.mjs',
  'tests/sequence-reset-types.test.mjs',
  'tests/spritesheet-boundaries.test.mjs',
  'tests/strict-successor-boundaries.test.mjs',
  // The maintenance tools rebuild earlier revisions of the tools above and of the type checks from
  // recorded bytes. Their gate-order and selection cases stay in incremental-checks.test.mjs.
  'tests/publication/incremental-checks-evidence.test.mjs',
]);
