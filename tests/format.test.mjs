// SPDX-License-Identifier: Apache-2.0
// The sources that biome.json names are laid out as the formatter lays them out. A change that fails here runs
// `node tools/format.mjs` and commits what it writes. Where the formatter is not installed the test is skipped: the
// "Source layout" workflow installs it and runs the same check on every pull request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatterPath, formatSources } from '../tools/format.mjs';

test('FM01 the sources are formatted', {
  skip: formatterPath() === undefined && 'the formatter is not installed: npm ci --ignore-scripts --prefix tools/format'
}, () => {
  const result = formatSources(true);
  assert.equal(result.status, 0, 'Run node tools/format.mjs. The formatter reports:\n' + result.output.slice(0, 4000));
});
