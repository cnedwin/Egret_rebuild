// Runs only the authored graphics probe in a fresh headless test profile.
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
async function main() {
  const { chromium } = require(process.argv[2] || 'playwright');
  const { server } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  let browser;
  let mode;
  try {
    try { browser = await chromium.launch({ headless: true }); mode = 'bundled_chromium'; }
    catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }); mode = 'installed_edge_fresh_test_profile'; }
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:18765/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#state').filter({ hasText: '已保存' }).waitFor({ timeout: 45000 });
    const output = path.resolve(__dirname, '../../evidence/browser-probe-results.json');
    const report = JSON.parse(await fs.readFile(output, 'utf8'));
    report.executionMode = 'headless_local_graphics_lab';
    report.browserLaunchMode = mode;
    report.browserVersion = browser.version();
    report.pageErrors = errors;
    report.sourceHashes.push({ path: 'run-headless.cjs', sha256: crypto.createHash('sha256').update(await fs.readFile(__filename)).digest('hex') });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
    await page.screenshot({ path: path.resolve(__dirname, '../../evidence/browser-probe.png'), fullPage: true });
    console.log(JSON.stringify({ browser: report.browserVersion, mode: report.executionMode, counts: report.counts, renderer: report.environment.webglRenderer, errors }));
    if (report.counts.failed || errors.length) process.exitCode = 1;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
