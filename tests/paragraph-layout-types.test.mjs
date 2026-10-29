// SPDX-License-Identifier: Apache-2.0
// Two public consumers; no source mutation, private product import or suppression.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const expected = [
  {
    "file": "tests/types/paragraph-layout-negative.ts",
    "line": 4,
    "column": 52,
    "code": 2322,
    "message": "Type '\"middle\"' is not assignable to type 'ParagraphTextAlign'."
  },
  {
    "file": "tests/types/paragraph-layout-negative.ts",
    "line": 5,
    "column": 50,
    "code": 2322,
    "message": "Type 'string' is not assignable to type 'number'."
  },
  {
    "file": "tests/types/paragraph-layout-negative.ts",
    "line": 6,
    "column": 72,
    "code": 2322,
    "message": "Type 'string' is not assignable to type 'boolean'."
  },
  {
    "file": "tests/types/paragraph-layout-negative.ts",
    "line": 7,
    "column": 55,
    "code": 2322,
    "message": "Type 'string' is not assignable to type 'boolean'."
  }
];
test('paragraph layout public types compile valid controls and preserve four actual unsuppressed refusals', () => {
    const temporaryRoot = fs.realpathSync(os.tmpdir()), temporary = fs.mkdtempSync(path.join(temporaryRoot, 'egret-paragraph-types-'));
    try {
        for (const kind of ['positive', 'negative']) {
            const config = path.join(temporary, kind + '.json');
            fs.writeFileSync(config, JSON.stringify({extends: path.join(root, 'tsconfig.base.json'),
                compilerOptions: {noEmit: true, composite: false, declaration: false, declarationMap: false, sourceMap: false},
                files: [path.join(root, 'tests/types/paragraph-layout-' + kind + '.ts')]}));
            const result = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--project', config, '--pretty', 'false'],
                {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000});
            assert.equal(result.error, undefined); assert.equal(result.stderr, '');
            if (kind === 'positive') {assert.equal(result.status, 0, result.stdout); assert.equal(result.stdout, ''); continue;}
            assert.equal(result.status, 1);
            const observed = result.stdout.trim().split(/\r?\n/).map(line => {
                const m = line.match(/^(.*?)\((\d+),(\d+)\): error TS(\d+): (.*)$/); assert.ok(m, line);
                return {file: path.relative(root, path.resolve(root, m[1])).split(path.sep).join('/'),
                    line: Number(m[2]), column: Number(m[3]), code: Number(m[4]), message: m[5]};
            });
            assert.deepEqual(observed, expected);
        }
    } finally {
        assert.equal(path.dirname(temporary), temporaryRoot); assert.ok(path.basename(temporary).startsWith('egret-paragraph-types-'));
        fs.rmSync(temporary, {recursive: true});
    }
});
