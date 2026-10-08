import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    const contents = await readFile(file);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': type }); response.end(contents);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(0, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${server.address().port}/examples/canvas-scene/index.html; stop with Ctrl+C.`));
