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
  if (args.length !== 4 || args[0] !== '--admission' || args[2] !== '--output'
    || !path.isAbsolute(args[1]) || !path.isAbsolute(args[3])) throw new TypeError('Exact admission/output options required');
  const owner = path.dirname(args[1]), relative = ownerRelativePath(owner, args[1]), pin = fingerprintFile(owner, relative);
  const raw = readFileSync(args[1]);
  if (raw.length !== pin.bytes || createHash('sha256').update(raw).digest('hex') !== pin.sha256) throw new TypeError('Admission raw read drift');
  const result = await collectBrowserPng({ admissionPin: { ...pin, path: args[1] }, output: args[3] });
  process.stdout.write(JSON.stringify({ status: result.status, renderedSubmissions: result.renderedSubmissions,
    channelsCompared: result.channelsCompared, output: args[3] }) + '\n');
  if (result.status !== 'PASS') process.exitCode = 1;
}
