// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {verifyLineBidi, makeLineParagraph, inspectLineParagraph} from '../examples/paragraph-panel/verify-line-bidi.mjs';
const vendor = new URL('../examples/paragraph-panel/vendor/', import.meta.url);
test('actual optional native final-line bidi, geometry, reflow and ordinary raster compatibility', async () => {
    const temporaryRoot = fs.realpathSync(os.tmpdir());
    const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'egret-line-bidi-'));
    const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', vendor), 'utf8'));
    const instances = [];
    async function load(glue, wasm, name) {
        const cjs = path.join(temporary, name + '.cjs'); fs.copyFileSync(new URL(glue, vendor), cjs);
        const ck = await createRequire(import.meta.url)(cjs)({locateFile: () => fileURLToPath(new URL(wasm, vendor))});
        const fonts = ck.TypefaceFontProvider.Make(); instances.push(fonts);
        for (const font of manifest.fonts.slice(0, 2)) fonts.registerFont(fs.readFileSync(new URL(font.path, vendor)), font.family);
        return {ck, fonts};
    }
    try {
        const current = await load(manifest.runtime.glue, manifest.runtime.wasm, 'current');
        assert.equal(verifyLineBidi(current.ck, current.fonts).reflows, 90);
        const prior = await load('runtime/canvaskit.js', 'runtime/canvaskit.wasm', 'prior');
        for (const text of ['Latin words for normal wrapping', 'مرحبا 123 abc tail', 'abc xyz', 'Cafe\u0301 words tail']) for (const rtl of [false, true]) {
            const a = makeLineParagraph(current.ck, current.fonts, text, 95, rtl), b = makeLineParagraph(prior.ck, prior.fonts, text, 95, rtl);
            try { assert.deepEqual(inspectLineParagraph(current.ck, a, text).pixels, inspectLineParagraph(prior.ck, b, text).pixels, text); }
            finally { a.delete(); b.delete(); }
        }
    } finally {
        for (const fonts of instances) fonts.delete();
        assert.equal(path.dirname(temporary), temporaryRoot);
        assert.ok(path.basename(temporary).startsWith('egret-line-bidi-')); fs.rmSync(temporary, {recursive: true});
    }
});
