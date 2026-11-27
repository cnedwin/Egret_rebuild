// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./browser-adapter-files.mjs', import.meta.url));
// The scene helper is also a standalone import in existing converted games.
const entryPoints = ['legacy-web.mjs', 'compat/scene.mjs', 'compat/theme-factories.mjs'];

export function browserAdapterFiles() {
  // Node's module parser reads import/export declarations without executing the adapters.
  return JSON.parse(
    execFileSync(process.execPath, ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning', script], {
      encoding: 'utf8',
      windowsHide: true
    })
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  const visited = new Set(),
    ordered = [];
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const source = fs.readFileSync(new URL(name, import.meta.url), 'utf8');
    for (const { specifier } of new vm.SourceTextModule(source).moduleRequests) {
      const child = path.posix.join(path.posix.dirname(name), specifier);
      if (!/^\.{1,2}\/[-\w./]+\.mjs$/.test(specifier) || child.startsWith('../'))
        throw new Error('Expected a package-local browser adapter import in ' + name + ': ' + specifier);
      visit(child);
    }
    ordered.push(name);
  }
  for (const root of entryPoints) visit(root);
  process.stdout.write(JSON.stringify(ordered));
}
