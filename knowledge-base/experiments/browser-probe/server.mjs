import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';

const runId = randomUUID();
const sources = [];
for (const path of ['server.mjs', 'index.html', 'probe.js']) sources.push({ path, sha256: createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex') });
export const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/report') {
      let bytes = 0; const parts = [];
      for await (const part of request) { bytes += part.length; if (bytes > 1048576) throw new Error('Report too large'); parts.push(part); }
      const report = JSON.parse(Buffer.concat(parts).toString());
      if (report.runId !== runId || !Array.isArray(report.results)) throw new Error('Wrong report run');
      report.sourceHashes = sources;
      await writeFile(new URL('../../evidence/browser-probe-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ saved: true, runId }));
      console.log(JSON.stringify({ reportSaved: true, runId, counts: report.counts })); return;
    }
    if (request.method === 'GET' && request.url === '/meta') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ runId })); return;
    }
    const routes = { '/': ['index.html','text/html; charset=utf-8'], '/probe.js': ['probe.js','text/javascript; charset=utf-8'] };
    const route = routes[request.url];
    if (request.method !== 'GET' || !route) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' });
    response.end(await readFile(new URL(route[0], import.meta.url)));
  } catch (error) { response.writeHead(400); response.end(error.message); }
});
server.listen(18765, '127.0.0.1', () => console.log(JSON.stringify({ listening: 'http://127.0.0.1:18765/', runId })));
process.on('SIGINT', () => server.close(() => process.exit(0)));
