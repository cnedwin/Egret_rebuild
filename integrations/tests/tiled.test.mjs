// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {importTiledMap} from '@egret/integrations/tiled';

const [room, atlas] = await Promise.all(['room.tmx', 'tiles.tsx'].map(file =>
    readFile(new URL('../example/assets/' + file, import.meta.url), 'utf8')));
const files = {'maps/room.tmx': room.replace('source="tiles.tsx"', 'source="../tiles/tiles.tsx"'), 'tiles/tiles.tsx': atlas};
const importRoom = (xml = files['maps/room.tmx'], tiles = atlas) => importTiledMap({
    mapPath: 'maps/room.tmx',
    files: {...files, 'maps/room.tmx': xml, 'tiles/tiles.tsx': tiles},
});

test('imports Tiled TMX and closed TSX, preserving tiles, objects and GID transforms', async () => {
    const map = await importRoom();
    assert.equal(map.format, 'egret.tiled-map/1');
    assert.deepEqual([map.width, map.height, map.tileWidth, map.tileHeight], [4, 3, 16, 16]);
    assert.equal(map.properties.title, 'Integration room');
    const [tileset] = map.tilesets;
    assert.equal(tileset.firstGid, 1);
    assert.deepEqual(tileset.image, {path: 'tiles/tiles.png', width: 32, height: 16});
    const [ground, markers] = map.layers;
    assert.equal(ground.name, 'Ground');
    assert.equal(ground.cells.length, 12);
    assert.equal(ground.cells[6], null);
    assert.deepEqual(ground.cells[10], {
        gid: 2, tilesetIndex: 0, tileId: 1, flipX: true, flipY: false, flipDiagonal: false,
    });
    assert.equal(markers.objects[0].shape.kind, 'point');
    assert.equal(markers.objects[1].properties.blocked, true);
    assert(Object.isFrozen(map) && Object.isFrozen(ground.cells) && Object.isFrozen(ground.cells[10]));
    assert.deepEqual(JSON.parse(JSON.stringify(map)).layers[0].cells[10], ground.cells[10]);
});

test('isolates concurrent file sets and ignores the reserved rotation bit on non-hex maps', async () => {
    const [first, second] = await Promise.all([
        importRoom(files['maps/room.tmx'].replace('2147483650', '4026531842')),
        importRoom(files['maps/room.tmx'], atlas.replace('tiles.png', 'other.png')),
    ]);
    assert.deepEqual(first.layers[0].cells[10], {
        gid: 2, tilesetIndex: 0, tileId: 1, flipX: true, flipY: true, flipDiagonal: true,
    });
    assert.equal(first.tilesets[0].image.path, 'tiles/tiles.png');
    assert.equal(second.tilesets[0].image.path, 'tiles/other.png');
});

test('refuses undeclared TSX, escaping paths, malformed XML, invalid GIDs and over-budget maps', async () => {
    const xml = files['maps/room.tmx'];
    const code = (expected) => ({integration: 'tiled', code: expected});
    await assert.rejects(importTiledMap({mapPath: 'maps/room.tmx', files: {'maps/room.tmx': xml}}), code('invalid-input'));
    await assert.rejects(importRoom(xml.replace('../tiles/tiles.tsx', '../../tiles/tiles.tsx')), code('invalid-input'));
    await assert.rejects(importRoom(xml.replace('../tiles/tiles.tsx', 'https://example.test/tiles.tsx')), code('invalid-input'));
    await assert.rejects(importRoom(xml.replace('</map>', '</typo>')), code('invalid-input'));
    await assert.rejects(importRoom(xml.replace('2147483650', '999')), code('invalid-input'));
    await assert.rejects(importRoom(xml.replace('1,1,1,1,', '1,1,')), code('invalid-input'));
    await assert.rejects(importRoom(xml.replace('width="4"', 'width="1000000000"')), code('limit-exceeded'));
});

test('refuses unsupported TMX features before the legacy parser reads or expands data', async () => {
    const xml = files['maps/room.tmx'];
    const code = (expected) => ({integration: 'tiled', code: expected});
    await assert.rejects(importRoom(xml.replace('infinite="0"', 'infinite="1"')), code('unsupported'));
    await assert.rejects(importRoom(xml.replace('encoding="csv"', 'encoding="base64" compression="gzip"')), code('unsupported'));
    await assert.rejects(importRoom(xml.replace('<map ', '<!DOCTYPE map SYSTEM "file:///missing">\n<map ')), code('unsupported'));
    await assert.rejects(importRoom(xml.replace('name="title"', 'name="__proto__"')), code('invalid-input'));
    await assert.rejects(importRoom(xml, atlas.replace('source="tiles.png"', 'source="C:\\private.png"')), code('invalid-input'));
});

test('accepts finite isometric maps with XML tile entries and embedded image atlases', async () => {
    const xml = '<map orientation="isometric" width="2" height="1" tilewidth="16" tileheight="8">' +
        '<tileset firstgid="1" name="Inline" tilewidth="16" tileheight="8">' +
        '<image source="tiles.png" width="16" height="8"/></tileset>' +
        '<layer id="1" name="Tiles" width="2" height="1"><data><tile gid="1"/><tile gid="0"/></data></layer></map>';
    const map = await importTiledMap({mapPath: 'map.tmx', files: {'map.tmx': xml}});
    assert.equal(map.orientation, 'isometric');
    assert.equal(map.layers[0].cells[0].tileId, 0);
    assert.equal(map.layers[0].cells[1], null);
});

test('enforces XML lexical rules and portable atlas paths', async () => {
    const xml = files['maps/room.tmx'];
    const code = {integration: 'tiled', code: 'invalid-input'};
    await assert.rejects(importRoom(xml.replace('name="title"', 'name="title" name="duplicate"')), code);
    await assert.rejects(importRoom(xml.replace('Integration room', '&copy;')), code);
    await assert.rejects(importRoom(xml.replace('Integration room', '&AMP;')), code);
    await assert.rejects(importRoom(xml.replace('Integration room', '&#0;')), code);
    await assert.rejects(importRoom(xml.replace('Integration room', 'raw<value')), code);
    await assert.rejects(importRoom(xml, atlas.replace('tiles.png', 'tiles*.png')), code);
    const valid = await importRoom(xml.replace('Integration room', 'R&amp;D&apos;s &#x1F642;'));
    assert.equal(valid.properties.title, "R&D's \u{1F642}");
    const cdata = await importRoom(xml.replace(' value="Integration room"/>', '><![CDATA[raw &copy; text]]></property>'));
    assert.equal(cdata.properties.title, 'raw &copy; text');
});
