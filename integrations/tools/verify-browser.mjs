// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startIntegrationExample } from './example.mjs';

const channel = process.argv[2] ?? (process.platform === 'win32' ? 'msedge' : 'chromium');
const { server, url, browserInputs } = await startIntegrationExample();
let browser;
try {
    browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
    const page = await browser.newPage({ viewport: { width: 410, height: 840 } });
    const faults = [];
    page.on('pageerror', error => faults.push(error.message));
    page.on('response', response => { if (response.status() >= 400) faults.push(response.url() + ' ' + response.status()); });
    const diagnostics = page.locator('#diagnostics');
    const snapshot = async phase => {
        await page.locator('#diagnostics[data-phase="' + phase + '"], #diagnostics[data-phase="failed"]').waitFor();
        const details = JSON.parse(await diagnostics.textContent());
        assert.equal(await diagnostics.getAttribute('data-phase'), phase, JSON.stringify(details.failure));
        return details;
    };
    await page.goto(url);
    const initial = await snapshot('ready');
    assert.deepEqual(initial.map, { format: 'egret.tiled-map/1', orientation: 'orthogonal', width: 4, height: 3, tilesets: 1, populated: 11 });
    assert.equal(initial.archive.entries, 2);
    assert.deepEqual(initial.texture, { width: 2, height: 2, mipLevels: 2 });
    assert.deepEqual(initial.render.tilePixel, [46, 108, 109, 255]);
    assert.deepEqual(initial.render.ktxPixel, [255, 0, 0, 255]);
    assert.deepEqual(initial.save, { runs: 0, isolated: true });
    await page.getByRole('button', { name: /Run scene/ }).click();
    const run = await snapshot('complete');
    assert.equal(run.physics.steps, 120);
    assert.ok(run.physics.contacts >= 1 && run.physics.position.y > 5 && run.physics.position.y < 7);
    assert.equal(run.audio.playing, true);
    assert.equal(run.audio.stopped, true);
    assert.deepEqual(run.audio.events, ['load', 'play', 'stop']);
    assert.deepEqual(run.save, { runs: 2, isolated: true });
    assert.equal(run.language, 'zh-CN');
    assert.equal(await page.locator('#title').textContent(), '白鹭第三方集成');
    await page.reload();
    const reopened = await snapshot('ready');
    assert.deepEqual(reopened.save, { runs: 2, isolated: true });
    await page.getByRole('button', { name: /Close scene/ }).click();
    const closed = await snapshot('closed');
    assert.equal(closed.lifecycle, 'closed');
    assert.deepEqual(faults, []);
    console.log(JSON.stringify({ status: 'PASS', browser: browser.version(), channel, browserInputs,
        initial, run, reloaded: reopened.save, lifecycle: closed.lifecycle, faults }, null, 2));
} finally {
    try { await browser?.close(); } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
