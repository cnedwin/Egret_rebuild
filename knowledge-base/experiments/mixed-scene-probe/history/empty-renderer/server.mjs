import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
const runId = randomUUID(), sourceHashes = [];
for (const file of ['index.html', 'probe.js', 'renderer.mjs', 'server.mjs', '../batch-state-probe/model.mjs']) sourceHashes.push({ path: file, sha256: createHash('sha256').update(await readFile(new URL(file, import.meta.url))).digest('hex') });
export const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/meta') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ runId })); return; }
    if (req.method === 'POST' && req.url === '/report') {
      const parts = []; let size = 0; for await (const p of req) { size += p.length; if (size > 1048576) throw new Error('Report too large'); parts.push(p); }
      const report = JSON.parse(Buffer.concat(parts).toString()); if (report.runId !== runId || !Array.isArray(report.results)) throw new Error('Wrong report');
      report.sourceHashes = sourceHashes; await writeFile(new URL('../../evidence/mixed-scene-probe-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ saved: true })); return;
    }
    const routes = { '/': ['index.html', 'text/html; charset=utf-8'], '/probe.js': ['probe.js', 'text/javascript'], '/renderer.mjs': ['renderer.mjs', 'text/javascript'], '/batch-model.mjs': ['../batch-state-probe/model.mjs', 'text/javascript'] };
    if (req.method !== 'GET' || !routes[req.url]) { res.writeHead(404); res.end('Not found'); return; }
    const [file, type] = routes[req.url]; res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(await readFile(new URL(file, import.meta.url)));
  } catch (e) { res.writeHead(400); res.end(e.message); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18766, '127.0.0.1', resolve); });
