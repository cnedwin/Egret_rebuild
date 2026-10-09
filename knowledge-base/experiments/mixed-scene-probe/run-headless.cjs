const path = require('node:path'), fs = require('node:fs/promises'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
async function main() {
  const { chromium } = require(process.argv[2] || 'playwright');
  const { server } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  let browser;
  try {
    let launchMode; try { browser = await chromium.launch({ headless: true }); launchMode = 'bundled_chromium'; } catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }); launchMode = 'installed_edge_fresh_test_profile'; }
    const page = await browser.newPage(); const errors = [], diagnostics = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', c => { if (['error', 'warning'].includes(c.type())) diagnostics.push({ type: c.type(), message: c.text() }); });
    await page.goto('http://127.0.0.1:18766/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.locator('#state').filter({ hasText: '已保存' }).waitFor({ timeout: 45000 });
    const reportPath = path.resolve(__dirname, '../../evidence/mixed-scene-probe-results.json'); const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    report.browserVersion = browser.version(); report.launchMode = launchMode; report.pageErrors = errors; report.consoleDiagnostics = diagnostics;
    report.sourceHashes.push({ path: 'run-headless.cjs', sha256: crypto.createHash('sha256').update(await fs.readFile(__filename)).digest('hex') });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); await page.screenshot({ path: path.resolve(__dirname, '../../evidence/mixed-scene-probe.png'), fullPage: true });
    console.log(JSON.stringify({ counts: report.counts, browser: report.browserVersion, errors, diagnostics })); process.exitCode = report.counts.failed || errors.length ? 1 : 0;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
