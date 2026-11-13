// SPDX-License-Identifier: Apache-2.0
// Compile both projects with the TypeScript compiler installed for the repository.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let compiler;
for (let directory = root; ; directory = path.dirname(directory)) {
  const candidate = path.join(directory, 'node_modules/typescript/bin/tsc');
  if (fs.existsSync(candidate)) { compiler = candidate; break; }
  if (path.dirname(directory) === directory) throw new Error('TypeScript is not installed; run pnpm install in the repository root.');
}
const result = spawnSync(process.execPath, [compiler, '--build', '--force', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
