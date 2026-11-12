// SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { importTiledMap } from '@egret/integrations/tiled';

const example = new URL('../example/', import.meta.url);

function fixtureTone() {
    const samplesPerSecond = 22050;
    const sampleCount = samplesPerSecond * 2;
    const bytes = Buffer.alloc(44 + sampleCount * 2);
    bytes.write('RIFF', 0);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(samplesPerSecond, 24);
    bytes.writeUInt32LE(samplesPerSecond * 2, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(sampleCount * 2, 40);
    for (let index = 0; index < sampleCount; index++) {
        const fade = Math.min(1, index / 256, (sampleCount - index) / 256);
        bytes.writeInt16LE(Math.round(Math.sin(index * 440 * 2 * Math.PI / samplesPerSecond) * 1400 * fade), 44 + index * 2);
    }
    return bytes;
}

export async function startIntegrationExample(port = 0) {
    const [html, tmx, tsx, atlas, bundle] = await Promise.all([
        readFile(new URL('index.html', example)),
        readFile(new URL('assets/room.tmx', example), 'utf8'),
        readFile(new URL('assets/tiles.tsx', example), 'utf8'),
        readFile(new URL('assets/tiles.png', example)),
        build({
            entryPoints: [fileURLToPath(new URL('main.mjs', example))],
            platform: 'browser', format: 'esm', target: 'es2023', bundle: true,
            sourcemap: 'inline', write: false, metafile: true,
        }),
    ]);
    const inputs = Object.keys(bundle.metafile.inputs);
    if (inputs.some(input => /(?:^|[\\/])(?:tmx-parser|sax|pend)(?:[\\/]|@)/.test(input))) {
        throw new Error('Node Tiled importer escaped into the browser bundle.');
    }
    const map = await importTiledMap({ mapPath: 'room.tmx', files: { 'room.tmx': tmx, 'tiles.tsx': tsx } });
    const routes = new Map([
        ['/', ['text/html; charset=utf-8', html]],
        ['/app.js', ['text/javascript; charset=utf-8', bundle.outputFiles[0].contents]],
        ['/map.json', ['application/json', Buffer.from(JSON.stringify(map))]],
        ['/tiles.png', ['image/png', atlas]],
        ['/tone.wav', ['audio/wav', fixtureTone()]],
    ]);
    const server = createServer((request, response) => {
        const route = routes.get(request.url);
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        } else if (!route) {
            response.writeHead(404).end();
        } else {
            const [type, bytes] = route;
            response.writeHead(200, {
                'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            }).end(request.method === 'HEAD' ? undefined : bytes);
        }
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
    });
    return { server, url: 'http://127.0.0.1:' + server.address().port + '/', browserInputs: inputs.length };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    const port = Number(process.argv[2] ?? '4174');
    if (!Number.isInteger(port) || port < 0 || port > 65535 || process.argv.length > 3) {
        throw new Error('Usage: node integrations/tools/example.mjs [port]');
    }
    const example = await startIntegrationExample(port);
    console.log('Open ' + example.url);
}
