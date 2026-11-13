// SPDX-License-Identifier: Apache-2.0
// Loopback-only server for the example: built package output and the example
// page, nothing else from the repository.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../..', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const vendor = 'vendor/robust-predicates/';

export function createDevtoolsExampleServer() {
  return http.createServer((request, response) => {
    const finish = (status, text) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(text); };
    if (request.method !== 'GET') return finish(405, 'GET required');
    let relative;
    try { relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).slice(1); }
    catch { return finish(400, 'Invalid path'); }
    if (relative === '') { response.writeHead(302, { Location: '/devtools/example/index.html' + new URL(request.url, 'http://127.0.0.1').search }); response.end(); return; }
    if (relative.startsWith(vendor)) relative = 'packages/engine/node_modules/robust-predicates/' + relative.slice(vendor.length);
    const allowed = /^packages\/(?:engine|runtime|contracts)\/dist\/[\w/.-]+\.js$/.test(relative)
      || /^packages\/engine\/node_modules\/robust-predicates\/[\w/.-]+\.js$/.test(relative)
      || /^devtools\/dist\/(?:core|web)\/[\w.-]+\.js$/.test(relative)
      || /^devtools\/example\/(?:index\.html|main\.mjs)$/.test(relative);
    if (!allowed || relative.includes('..')) return finish(404, 'Not served');
    fs.readFile(path.join(repository, relative), (error, data) => {
      if (error) return finish(404, 'Not found');
      response.writeHead(200, { 'Content-Type': types[path.extname(relative)], 'Cache-Control': 'no-store' });
      response.end(data);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 4174);
  const server = createDevtoolsExampleServer();
  server.listen(port, '127.0.0.1', () => console.log('Open http://127.0.0.1:' + server.address().port + '/devtools/example/index.html?egretDebug=1 (Ctrl+C to stop)'));
}
