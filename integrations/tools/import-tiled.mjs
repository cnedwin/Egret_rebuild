// SPDX-License-Identifier: Apache-2.0
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { importTiledMap } from '@egret/integrations/tiled';
import { logicalPath, ownerRelativePath } from '../../tools/lib/file-identity.mjs';

const [rootArgument, mapPath, ...tilesets] = process.argv.slice(2);
if (!rootArgument || !mapPath || tilesets.length > 32) {
    throw new Error('Usage: node integrations/tools/import-tiled.mjs <asset-root> <map.tmx> [tileset.tsx ...]');
}
const root = await realpath(rootArgument);
const files = Object.create(null);
const decoder = new TextDecoder('utf-8', { fatal: true });
const maxFileBytes = 1024 * 1024;
let remaining = 4 * maxFileBytes;
for (const logical of [mapPath, ...tilesets]) {
    logicalPath(logical);
    if (Object.hasOwn(files, logical)) throw new Error('Duplicate declared Tiled input: ' + logical);
    const candidate = await realpath(path.resolve(root, logical));
    if (ownerRelativePath(root, candidate) !== logical) throw new Error('Invalid declared Tiled input owner: ' + logical);
    const file = await open(candidate, 'r');
    try {
        const stats = await file.stat();
        if (!stats.isFile() || stats.size > Math.min(maxFileBytes, remaining)) throw new Error('Tiled input exceeds the file budget: ' + logical);
        const buffer = new Uint8Array(stats.size);
        let offset = 0;
        while (offset < buffer.length) {
            const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
            if (bytesRead === 0) throw new Error('Tiled input changed while reading: ' + logical);
            offset += bytesRead;
        }
        files[logical] = decoder.decode(buffer);
        remaining -= buffer.length;
    } finally {
        await file.close();
    }
}
const map = await importTiledMap({ mapPath, files });
process.stdout.write(JSON.stringify(map, null, 2) + '\n');
