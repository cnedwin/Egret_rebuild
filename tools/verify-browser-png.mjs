// SPDX-License-Identifier: Apache-2.0
// Explicit opt-in tool: help/argument checks never load the SDK or browser runtime.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fingerprintFile, ownerRelativePath } from './lib/file-identity.mjs';
import { collectBrowserPng } from './browser-png/collector.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  process.stdout.write('Usage: node tools/verify-browser-png.mjs --admission <absolute reviewed JSON> --output <fresh absolute directory>\n');
} else {
  const nineSlice = args[0] === '--nine-slice-bitmap';
  const removeChildren = args[0] === '--display-container-remove-children';
  const childIndex = args[0] === '--display-container-child-index';
  const selected = nineSlice || removeChildren || childIndex ? args.slice(1) : args;
  if (selected.length !== 4 || selected[0] !== '--admission' || selected[2] !== '--output'
    || !path.isAbsolute(selected[1]) || !path.isAbsolute(selected[3])) throw new TypeError('Exact admission/output options required');
  const owner = path.dirname(selected[1]), relative = ownerRelativePath(owner, selected[1]), pin = fingerprintFile(owner, relative);
  const raw = readFileSync(selected[1]);
  if (raw.length !== pin.bytes || createHash('sha256').update(raw).digest('hex') !== pin.sha256) throw new TypeError('Admission raw read drift');
  const result = await collectBrowserPng({ admissionPin: { ...pin, path: selected[1] }, output: selected[3],
    ...(childIndex ? { profile:'display-container-child-index' } : nineSlice ? { profile:'nine-slice-bitmap' } : removeChildren ? { profile:'display-container-remove-children' } : {}) });
  process.stdout.write(JSON.stringify({ status: result.status, renderedSubmissions: result.renderedSubmissions,
    channelsCompared: result.channelsCompared, output: selected[3] }) + '\n');
  if (result.status !== 'PASS') process.exitCode = 1;
}
