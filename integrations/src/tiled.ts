// SPDX-License-Identifier: Apache-2.0
import sax from 'sax';
import tmx, {type LegacyTileMap} from 'tmx-parser';
import {IntegrationError} from './errors.js';

export interface TiledImportInput {
    readonly mapPath: string;
    readonly files: Readonly<Record<string, string>>;
}

export type TiledProperties = Readonly<Record<string, boolean | number | string>>;
export interface TiledTile {
    readonly gid: number;
    readonly tilesetIndex: number;
    readonly tileId: number;
    readonly flipX: boolean;
    readonly flipY: boolean;
    readonly flipDiagonal: boolean;
}
export interface TiledTileset {
    readonly firstGid: number;
    readonly name: string;
    readonly tileWidth: number;
    readonly tileHeight: number;
    readonly columns: number;
    readonly tileCount: number;
    readonly margin: number;
    readonly spacing: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly image: Readonly<{path: string; width: number; height: number}>;
    readonly properties: TiledProperties;
}
interface TiledLayerProperties {
    readonly id: number;
    readonly name: string;
    readonly visible: boolean;
    readonly opacity: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly properties: TiledProperties;
}
export interface TiledTileLayer extends TiledLayerProperties {
    readonly kind: 'tile';
    readonly cells: readonly (TiledTile | null)[];
}
export type TiledObjectShape =
    | Readonly<{kind: 'rectangle' | 'point' | 'ellipse'}>
    | Readonly<{kind: 'polygon' | 'polyline'; points: readonly Readonly<{x: number; y: number}>[]}>;
export interface TiledObject {
    readonly id: number;
    readonly name: string;
    readonly className: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
    readonly visible: boolean;
    readonly shape: TiledObjectShape;
    readonly properties: TiledProperties;
}
export interface TiledObjectLayer extends TiledLayerProperties {
    readonly kind: 'object';
    readonly drawOrder: 'topdown' | 'index';
    readonly objects: readonly TiledObject[];
}
export interface TiledMap {
    readonly format: 'egret.tiled-map/1';
    readonly orientation: 'orthogonal' | 'isometric';
    readonly renderOrder: 'right-down' | 'right-up' | 'left-down' | 'left-up';
    readonly width: number;
    readonly height: number;
    readonly tileWidth: number;
    readonly tileHeight: number;
    readonly backgroundColor?: string;
    readonly properties: TiledProperties;
    readonly tilesets: readonly TiledTileset[];
    readonly layers: readonly (TiledTileLayer | TiledObjectLayer)[];
}

interface XmlElement {
    name: string;
    fields: Record<string, string>;
    children: XmlElement[];
    text: string[];
}
interface UnparsedTileLayer extends TiledLayerProperties {
    kind: 'tile';
    gids: number[];
}

const limits = Object.freeze({
    fileCount: 65, textUnits: 4_194_304, projectTextUnits: 8_388_608, tags: 100_000, nesting: 12,
    mapAxis: 512, tileSize: 4096, imageSize: 8192, tilesets: 64, layers: 64,
    cells: 1_048_576, objects: 4096, points: 256, path: 512,
});
const gidMask = 0x0fffffff;

function fail(code: 'invalid-input' | 'unsupported' | 'limit-exceeded' | 'operation-failed', message: string): never {
    throw new IntegrationError('tiled', code, message);
}

function pathSegments(value: string): string[] {
    if (!value || value.length > limits.path || /[\\:%?#<>|"*\u0000-\u001f\u007f]/u.test(value)) {
        fail('invalid-input', 'Expected a project-relative POSIX asset path.');
    }
    const parts = value.split('/');
    if (parts.some(part => !part || (part !== '.' && part !== '..' &&
        (/[ .]$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))))) {
        fail('invalid-input', 'Invalid project asset path segment.');
    }
    return parts;
}
function canonicalPath(value: string, extension: '.tmx' | '.tsx'): string {
    if (!value.endsWith(extension) || pathSegments(value).some(part => part === '.' || part === '..')) {
        fail('invalid-input', 'Expected a canonical project path ending in ' + extension + '.');
    }
    return value;
}
function relativePath(owner: string, source: string): string {
    const output = owner.split('/').slice(0, -1);
    const segments = pathSegments(source);
    const filename = segments.at(-1);
    if (filename === '.' || filename === '..') fail('invalid-input', 'An asset reference requires a filename.');
    for (const segment of segments) {
        if (segment === '..') {
            if (!output.length) fail('invalid-input', 'An asset reference escapes the project root.');
            output.pop();
        } else if (segment !== '.') {
            output.push(segment);
        }
    }
    const path = output.join('/');
    pathSegments(path);
    return path;
}

// sax 1.1.6 silently drops duplicate attributes and accepts some non-XML entities.
// Check those lexical rules once before letting SAX decode values and parse the tree.
function checkXmlLexical(text: string): void {
    if (/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(text)) {
        fail('invalid-input', 'XML contains an invalid character.');
    }
    const xmlName = /[A-Za-z_][A-Za-z0-9_.-]*/y;
    const space = /[\t\n\r ]*/y;
    function whitespace(at: number): number {
        space.lastIndex = at;
        space.exec(text);
        return space.lastIndex;
    }
    function name(at: number): string {
        xmlName.lastIndex = at;
        const found = xmlName.exec(text)?.[0];
        if (!found) fail('invalid-input', 'Expected a tag or attribute name.');
        return found;
    }
    function section(at: number, marker: string): number {
        const end = text.indexOf(marker, at);
        if (end < 0) fail('invalid-input', 'Unclosed XML section.');
        return end;
    }
    function reference(at: number): number {
        const end = section(at + 1, ';');
        const token = text.slice(at + 1, end);
        if (/^(?:amp|apos|gt|lt|quot)$/u.test(token)) return end + 1;
        let codePoint: number;
        if (/^#x[0-9a-fA-F]+$/u.test(token)) codePoint = Number.parseInt(token.slice(2), 16);
        else if (/^#[0-9]+$/u.test(token)) codePoint = Number(token.slice(1));
        else fail('invalid-input', 'Unrecognized XML entity.');
        if (!(codePoint === 9 || codePoint === 10 || codePoint === 13 ||
            (codePoint >= 32 && codePoint <= 0xd7ff) || (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
            (codePoint >= 0x10000 && codePoint <= 0x10ffff))) {
            fail('invalid-input', 'Invalid XML character reference.');
        }
        return end + 1;
    }
    function openTag(start: number): number {
        const seen = new Set<string>();
        let at = start + name(start).length;
        while (at < text.length) {
            const afterName = at;
            at = whitespace(at);
            if (text[at] === '>') return at + 1;
            if (text.startsWith('/>', at)) return at + 2;
            if (at === afterName) fail('invalid-input', 'Expected whitespace before an XML attribute.');
            const attribute = name(at);
            if (seen.has(attribute)) fail('invalid-input', 'Duplicate XML attribute ' + attribute + '.');
            seen.add(attribute);
            at = whitespace(at + attribute.length);
            if (text[at] !== '=') fail('invalid-input', 'Expected an XML attribute value.');
            at = whitespace(at + 1);
            const quote = text[at++];
            if (quote !== '"' && quote !== "'") fail('invalid-input', 'XML attribute values require quotes.');
            while (at < text.length && text[at] !== quote) {
                if (text[at] === '<') fail('invalid-input', 'Raw less-than sign in an XML attribute.');
                at = text[at] === '&' ? reference(at) : at + 1;
            }
            if (text[at] !== quote) fail('invalid-input', 'Unclosed XML attribute.');
            at++;
        }
        return fail('invalid-input', 'Unclosed XML tag.');
    }
    for (let at = 0; at < text.length;) {
        if (text[at] === '&') at = reference(at);
        else if (text.startsWith(']]>', at)) fail('invalid-input', 'CDATA closing marker outside a CDATA section.');
        else if (text[at] !== '<') at++;
        else if (text.startsWith('<!--', at)) {
            const end = section(at + 4, '-->');
            if (text.indexOf('--', at + 4) !== end) fail('invalid-input', 'Malformed XML comment.');
            at = end + 3;
        } else if (text.startsWith('<![CDATA[', at)) at = section(at + 9, ']]>') + 3;
        else if (text.startsWith('<?', at)) at = section(at + 2, '?>') + 2;
        else if (text.startsWith('<!DOCTYPE', at)) fail('unsupported', 'DOCTYPE declarations are outside the Tiled import profile.');
        else if (text.startsWith('</', at)) {
            at = whitespace(at + 2 + name(at + 2).length);
            if (text[at++] !== '>') fail('invalid-input', 'Malformed XML closing tag.');
        } else at = openTag(at + 1);
    }
}

function xml(text: string, owner: string): XmlElement {
    if (text.length > limits.textUnits) fail('limit-exceeded', 'XML source exceeds the per-file limit.');
    checkXmlLexical(text);
    const parser = sax.parser(true, {strictEntities: true});
    const open: XmlElement[] = [];
    let root: XmlElement | undefined;
    let tags = 0;
    let declared = false;
    parser.onopentag = ({name, attributes: fields}) => {
        if (++tags > limits.tags || open.length >= limits.nesting) {
            fail('limit-exceeded', 'XML source exceeds the tag or nesting limit.');
        }
        const next: XmlElement = {name, fields, children: [], text: []};
        const parent = open.at(-1);
        if (parent) parent.children.push(next);
        else if (root) fail('invalid-input', 'XML source must contain one root element.');
        else root = next;
        open.push(next);
    };
    parser.onclosetag = () => {open.pop();};
    parser.ontext = parser.oncdata = (value) => {open.at(-1)?.text.push(value);};
    parser.ondoctype = () => fail('unsupported', 'DOCTYPE declarations are outside the Tiled import profile.');
    parser.onprocessinginstruction = ({name}) => {
        if (name !== 'xml' || root || declared) fail('unsupported', 'Only one initial XML declaration is supported.');
        declared = true;
    };
    parser.onerror = (cause) => {throw cause;};
    try {
        parser.write(text).close();
    } catch (cause) {
        if (cause instanceof IntegrationError) throw cause;
        throw new IntegrationError('tiled', 'invalid-input', 'Malformed XML in ' + owner + '.', {cause});
    }
    if (!root || open.length) fail('invalid-input', 'Missing or unclosed XML root in ' + owner + '.');
    return root;
}
function attributes(node: XmlElement, allowed: readonly string[]): void {
    for (const name of Object.keys(node.fields)) {
        if (!allowed.includes(name)) fail('unsupported', 'Unsupported attribute ' + node.name + '.' + name + '.');
    }
}
function children(node: XmlElement, allowed: readonly string[], allowText = false): void {
    for (const child of node.children) {
        if (!allowed.includes(child.name)) fail('unsupported', 'Unsupported element ' + node.name + '/' + child.name + '.');
    }
    if (!allowText && node.text.join('').trim()) fail('invalid-input', 'Unexpected text in ' + node.name + '.');
}
function child(node: XmlElement, name: string): XmlElement | undefined {
    const matches = node.children.filter(entry => entry.name === name);
    if (matches.length > 1) fail('invalid-input', 'Duplicate ' + node.name + '/' + name + ' element.');
    return matches[0];
}
function integer(value: string | undefined, label: string, min: number, max: number, fallback?: number): number {
    if (value === undefined && fallback !== undefined) return fallback;
    if (value === undefined || !/^-?\d+$/u.test(value)) fail('invalid-input', 'Expected an integer for ' + label + '.');
    const number = Number(value);
    if (number > max) fail('limit-exceeded', label + ' exceeds the supported maximum.');
    if (!Number.isSafeInteger(number) || number < min) fail('invalid-input', 'Invalid integer for ' + label + '.');
    return number;
}
function decimal(value: string | undefined, label: string, fallback = 0): number {
    if (value === undefined) return fallback;
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value)) fail('invalid-input', 'Expected a number for ' + label + '.');
    const number = Number(value);
    if (!Number.isFinite(number)) fail('invalid-input', 'Non-finite number for ' + label + '.');
    return number;
}
function flag(value: string | undefined, label: string, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    if (value !== '0' && value !== '1') fail('invalid-input', 'Expected 0 or 1 for ' + label + '.');
    return value === '1';
}
function properties(owner: XmlElement): TiledProperties {
    const node = child(owner, 'properties');
    const result: Record<string, boolean | number | string> = {};
    if (!node) return Object.freeze(result);
    attributes(node, []);
    children(node, ['property']);
    for (const property of node.children) {
        attributes(property, ['name', 'type', 'value']);
        children(property, [], true);
        const {name, type = 'string', value} = property.fields;
        if (!name || name.length > 128 || name === '__proto__' || name === 'constructor' ||
            name === 'prototype' || Object.hasOwn(result, name)) {
            fail('invalid-input', 'Invalid or duplicate property name.');
        }
        const content = property.text.join('');
        if (value !== undefined && content.trim()) fail('invalid-input', 'A property has both text and an attribute value.');
        const input = value ?? content;
        switch (type) {
            case 'string': result[name] = input; break;
            case 'bool':
                if (input !== 'true' && input !== 'false') fail('invalid-input', 'Invalid Boolean property ' + name + '.');
                result[name] = input === 'true';
                break;
            case 'int':
                result[name] = integer(input, 'property ' + name, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
                break;
            case 'float': result[name] = decimal(input, 'property ' + name); break;
            default: fail('unsupported', 'Unsupported property type ' + type + '.');
        }
    }
    return Object.freeze(result);
}

function loadTileset(reference: XmlElement, mapPath: string, load: (path: string) => XmlElement): TiledTileset {
    const firstGid = integer(reference.fields.firstgid, 'tileset firstgid', 1, gidMask);
    let owner = mapPath;
    let node = reference;
    if (reference.fields.source !== undefined) {
        attributes(reference, ['firstgid', 'source']);
        children(reference, []);
        owner = canonicalPath(relativePath(mapPath, reference.fields.source), '.tsx');
        node = load(owner);
        if (node.name !== 'tileset' || node.fields.firstgid !== undefined) fail('invalid-input', 'Expected a TSX tileset document.');
    }
    attributes(node, ['firstgid', 'version', 'tiledversion', 'name', 'tilewidth', 'tileheight', 'spacing', 'margin', 'tilecount', 'columns']);
    children(node, ['properties', 'image', 'tileoffset']);
    const image = child(node, 'image');
    if (!image?.fields.source) fail('invalid-input', 'An atlas tileset requires one external image.');
    attributes(image, ['source', 'width', 'height']);
    children(image, []);
    const offset = child(node, 'tileoffset');
    if (offset) {
        attributes(offset, ['x', 'y']);
        children(offset, []);
    }
    const tileWidth = integer(node.fields.tilewidth, 'tileset tilewidth', 1, limits.tileSize);
    const tileHeight = integer(node.fields.tileheight, 'tileset tileheight', 1, limits.tileSize);
    const margin = integer(node.fields.margin, 'tileset margin', 0, limits.imageSize, 0);
    const spacing = integer(node.fields.spacing, 'tileset spacing', 0, limits.imageSize, 0);
    const width = integer(image.fields.width, 'atlas width', 1, limits.imageSize);
    const height = integer(image.fields.height, 'atlas height', 1, limits.imageSize);
    const across = Math.floor((width - 2 * margin + spacing) / (tileWidth + spacing));
    const down = Math.floor((height - 2 * margin + spacing) / (tileHeight + spacing));
    if (across < 1 || down < 1) fail('invalid-input', 'The atlas has no complete tile regions.');
    const columns = integer(node.fields.columns, 'tileset columns', 1, across, across);
    const tileCount = integer(node.fields.tilecount, 'tileset tilecount', 1, columns * down, columns * down);
    if (columns !== across || firstGid + tileCount - 1 > gidMask) fail('invalid-input', 'Atlas geometry or GID range is inconsistent.');
    return Object.freeze({
        firstGid, name: node.fields.name ?? '', tileWidth, tileHeight, columns, tileCount, margin, spacing,
        offsetX: integer(offset?.fields.x, 'tile offset x', -limits.imageSize, limits.imageSize, 0),
        offsetY: integer(offset?.fields.y, 'tile offset y', -limits.imageSize, limits.imageSize, 0),
        image: Object.freeze({path: relativePath(owner, image.fields.source), width, height}),
        properties: properties(node),
    });
}

function commonLayer(node: XmlElement): TiledLayerProperties {
    const {id, name, visible, opacity, offsetx, offsety, x, y} = node.fields;
    if (decimal(x, 'layer x') || decimal(y, 'layer y')) fail('unsupported', 'Only zero tile offsets are supported; use pixel offsets.');
    const alpha = decimal(opacity, 'layer opacity', 1);
    if (alpha < 0 || alpha > 1) fail('invalid-input', 'Layer opacity must be between 0 and 1.');
    return {
        id: integer(id, 'layer id', 1, Number.MAX_SAFE_INTEGER), name: name ?? '',
        visible: flag(visible, 'layer visible', true), opacity: alpha, offsetX: decimal(offsetx, 'layer offsetx'),
        offsetY: decimal(offsety, 'layer offsety'), properties: properties(node),
    };
}
const sharedLayerFields = ['id', 'name', 'visible', 'opacity', 'offsetx', 'offsety', 'x', 'y'];

function tileLayer(node: XmlElement, width: number, height: number): UnparsedTileLayer {
    attributes(node, [...sharedLayerFields, 'width', 'height']);
    children(node, ['properties', 'data']);
    if (integer(node.fields.width, 'layer width', 1, limits.mapAxis) !== width ||
        integer(node.fields.height, 'layer height', 1, limits.mapAxis) !== height) {
        fail('unsupported', 'Finite tile layers must use the map dimensions.');
    }
    const data = child(node, 'data');
    if (!data) fail('invalid-input', 'A tile layer requires data.');
    attributes(data, ['encoding', 'compression']);
    if (data.fields.compression !== undefined) fail('unsupported', 'Choose uncompressed CSV or XML tile data in Tiled.');
    const encoding = data.fields.encoding;
    let tokens: (string | undefined)[];
    if (encoding === 'csv') {
        children(data, [], true);
        tokens = data.text.join('').trim().split(',', width * height + 1).map(value => value.trim());
    } else if (encoding === undefined) {
        children(data, ['tile']);
        tokens = data.children.map(entry => {
            attributes(entry, ['gid']);
            children(entry, []);
            return entry.fields.gid;
        });
    } else {
        fail('unsupported', 'Only CSV and XML tile data are supported.');
    }
    if (tokens.length !== width * height) fail('invalid-input', 'Tile layer cell count does not match map dimensions.');
    const gids = tokens.map(token => {
        const gid = integer(token, 'tile GID', 0, 0xffffffff);
        // Tiled reserves a fourth high bit even on non-hexagonal maps. The legacy parser clears only three.
        const normalized = (gid & ~0x10000000) >>> 0;
        if (normalized !== 0 && (normalized & gidMask) === 0) fail('invalid-input', 'Flip flags require a nonempty tile GID.');
        return normalized;
    });
    return {...commonLayer(node), kind: 'tile', gids};
}

function objectShape(node: XmlElement): TiledObjectShape {
    const shapes = node.children.filter(entry => entry.name !== 'properties');
    if (shapes.length > 1) fail('invalid-input', 'An object must use one shape.');
    const shape = shapes[0];
    if (!shape) return Object.freeze({kind: 'rectangle'});
    if (shape.name === 'ellipse' || shape.name === 'point') {
        attributes(shape, []);
        children(shape, []);
        return Object.freeze({kind: shape.name});
    }
    const kind = shape.name === 'polygon' ? 'polygon' : 'polyline';
    attributes(shape, ['points']);
    children(shape, []);
    const tokens = (shape.fields.points ?? '').trim().split(/\s+/u);
    if (tokens.length > limits.points) fail('limit-exceeded', 'Object shape exceeds the point limit.');
    if (tokens.length < (kind === 'polygon' ? 3 : 2)) fail('invalid-input', 'Not enough object points.');
    const points = tokens.map(token => {
        const [x, y, ...rest] = token.split(',');
        if (!x || !y || rest.length) fail('invalid-input', 'Invalid object point.');
        return Object.freeze({x: decimal(x, 'object point x'), y: decimal(y, 'object point y')});
    });
    return Object.freeze({kind, points: Object.freeze(points)});
}
function mapObject(node: XmlElement): TiledObject {
    attributes(node, ['id', 'name', 'class', 'type', 'x', 'y', 'width', 'height', 'rotation', 'visible']);
    children(node, ['properties', 'point', 'ellipse', 'polygon', 'polyline']);
    const {id, name, x, y, width, height, rotation, visible, type} = node.fields;
    const w = decimal(width, 'object width');
    const h = decimal(height, 'object height');
    if (w < 0 || h < 0) fail('invalid-input', 'Object dimensions must be nonnegative.');
    return Object.freeze({
        id: integer(id, 'object id', 1, Number.MAX_SAFE_INTEGER), name: name ?? '', className: node.fields.class ?? type ?? '',
        x: decimal(x, 'object x'), y: decimal(y, 'object y'), width: w, height: h, rotation: decimal(rotation, 'object rotation'),
        visible: flag(visible, 'object visible', true), shape: objectShape(node), properties: properties(node),
    });
}
function objectLayer(node: XmlElement): TiledObjectLayer {
    attributes(node, [...sharedLayerFields, 'draworder', 'color']);
    children(node, ['properties', 'object']);
    const drawOrder = node.fields.draworder ?? 'topdown';
    if (drawOrder !== 'topdown' && drawOrder !== 'index') fail('unsupported', 'Unknown object draw order.');
    const objects = node.children.filter(entry => entry.name === 'object').map(mapObject);
    return Object.freeze({...commonLayer(node), kind: 'object', drawOrder, objects: Object.freeze(objects)});
}

function parseLegacy(xml: string): Promise<LegacyTileMap> {
    // Only normalized numeric rows reach tmx-parser. The generated inline tilesets cannot call its global readFile.
    return new Promise((resolve, reject) => {
        tmx.parse(xml, 'egret.tmx', (cause, map) => cause ? reject(cause) : resolve(map));
    });
}
async function resolveLayers(
    layers: readonly (UnparsedTileLayer | TiledObjectLayer)[], tilesets: readonly TiledTileset[],
    orientation: TiledMap['orientation'], width: number, height: number, tileWidth: number, tileHeight: number,
): Promise<readonly (TiledTileLayer | TiledObjectLayer)[]> {
    const rawLayers = layers.filter(layer => layer.kind === 'tile');
    const tags = ['<map orientation="' + orientation + '" width="' + width + '" height="' + height +
        '" tilewidth="' + tileWidth + '" tileheight="' + tileHeight + '">'];
    for (const tileset of tilesets) {
        tags.push('<tileset firstgid="' + tileset.firstGid + '" tilewidth="' + tileset.tileWidth +
            '" tileheight="' + tileset.tileHeight + '"/>');
    }
    for (const {gids} of rawLayers) tags.push('<layer><data encoding="csv">' + gids.join(',') + '</data></layer>');
    tags.push('</map>');
    const parsed = await parseLegacy(tags.join('')).catch((cause: unknown) => {
        throw new IntegrationError('tiled', 'operation-failed', 'The tile parser rejected normalized map data.', {cause});
    });
    if (parsed.layers.length !== rawLayers.length) fail('operation-failed', 'Unexpected parser layer count.');
    let index = 0;
    return Object.freeze(layers.map(layer => {
        if (layer.kind === 'object') return layer;
        const {gids, ...metadata} = layer;
        const parsedLayer = parsed.layers[index++];
        if (!parsedLayer || parsedLayer.tiles.length !== gids.length) {
            fail('operation-failed', 'Unexpected parser cell count.');
        }
        const cells = gids.map((raw, cell): TiledTile | null => {
            if (raw === 0) return null;
            const tile = parsedLayer.tiles[cell];
            if (!tile || tile.gid !== (raw & gidMask)) fail('invalid-input', 'A tile GID has no admitted tileset.');
            const tilesetIndex = tilesets.findLastIndex(entry => entry.firstGid <= tile.gid);
            const owner = tilesets[tilesetIndex];
            if (!owner || tile.id < 0 || tile.id >= owner.tileCount || tile.gid !== owner.firstGid + tile.id) {
                fail('invalid-input', 'A tile GID is outside the admitted atlas range.');
            }
            return Object.freeze({
                gid: tile.gid, tilesetIndex, tileId: tile.id, flipX: parsedLayer.horizontalFlips[cell] === true,
                flipY: parsedLayer.verticalFlips[cell] === true, flipDiagonal: parsedLayer.diagonalFlips[cell] === true,
            });
        });
        return Object.freeze({...metadata, cells: Object.freeze(cells)});
    }));
}

/** Import a finite Tiled map with caller-owned TMX/TSX text and project-relative atlas references. */
export async function importTiledMap(input: TiledImportInput): Promise<TiledMap> {
    if (!input || typeof input.mapPath !== 'string' || !input.files || typeof input.files !== 'object') {
        fail('invalid-input', 'Expected a mapPath and a file table.');
    }
    const {files} = input;
    if (Object.keys(files).length > limits.fileCount) fail('limit-exceeded', 'Too many declared Tiled source files.');
    const mapPath = canonicalPath(input.mapPath, '.tmx');
    const documents = new Map<string, XmlElement>();
    let textUnits = 0;
    function load(path: string): XmlElement {
        const previous = documents.get(path);
        if (previous) return previous;
        const source = Object.getOwnPropertyDescriptor(files, path);
        if (!source || typeof source.value !== 'string') fail('invalid-input', 'Missing declared XML source ' + path + '.');
        textUnits += source.value.length;
        if (textUnits > limits.projectTextUnits) fail('limit-exceeded', 'Tiled source files exceed the combined XML limit.');
        const document = xml(source.value, path);
        documents.set(path, document);
        return document;
    }
    const map = load(mapPath);
    if (map.name !== 'map') fail('invalid-input', 'Expected a TMX map document.');
    attributes(map, ['version', 'tiledversion', 'orientation', 'renderorder', 'width', 'height', 'tilewidth',
        'tileheight', 'infinite', 'nextlayerid', 'nextobjectid', 'backgroundcolor', 'compressionlevel']);
    children(map, ['properties', 'tileset', 'layer', 'objectgroup']);
    if (flag(map.fields.infinite, 'infinite', false)) fail('unsupported', 'Infinite maps are outside the Tiled import profile.');
    const {orientation, backgroundcolor: backgroundColor} = map.fields;
    if (orientation !== 'orthogonal' && orientation !== 'isometric') fail('unsupported', 'Only orthogonal and isometric maps are supported.');
    const renderOrder = map.fields.renderorder ?? 'right-down';
    if (renderOrder !== 'right-down' && renderOrder !== 'right-up' && renderOrder !== 'left-down' && renderOrder !== 'left-up') {
        fail('unsupported', 'Unknown tile render order.');
    }
    if (backgroundColor !== undefined && !/^#(?:[\da-f]{6}|[\da-f]{8})$/iu.test(backgroundColor)) {
        fail('invalid-input', 'Invalid map background color.');
    }
    const width = integer(map.fields.width, 'map width', 1, limits.mapAxis);
    const height = integer(map.fields.height, 'map height', 1, limits.mapAxis);
    const tileWidth = integer(map.fields.tilewidth, 'map tilewidth', 1, limits.tileSize);
    const tileHeight = integer(map.fields.tileheight, 'map tileheight', 1, limits.tileSize);
    const tileNodes = map.children.filter(node => node.name === 'tileset');
    const layerNodes = map.children.filter(node => node.name === 'layer' || node.name === 'objectgroup');
    if (tileNodes.length > limits.tilesets || layerNodes.length > limits.layers ||
        layerNodes.filter(node => node.name === 'layer').length * width * height > limits.cells ||
        layerNodes.reduce((count, node) => count + node.children.filter(entry => entry.name === 'object').length, 0) > limits.objects) {
        fail('limit-exceeded', 'Tiled map exceeds its tileset, layer, cell or object limit.');
    }
    const tilesets = tileNodes.map(node => loadTileset(node, mapPath, load));
    let minimumGid = 1;
    for (const [index, entry] of tilesets.entries()) {
        if (entry.firstGid < minimumGid || (index === 0 && entry.firstGid !== 1)) fail('invalid-input', 'Tileset GID ranges must start at 1 and never overlap.');
        minimumGid = entry.firstGid + entry.tileCount;
    }
    const layers = layerNodes.map(node => node.name === 'layer' ? tileLayer(node, width, height) : objectLayer(node));
    const ids = new Set<number>();
    const objects = new Set<number>();
    for (const layer of layers) {
        if (ids.has(layer.id)) fail('invalid-input', 'Duplicate layer ID.');
        ids.add(layer.id);
        if (layer.kind === 'object') {
            for (const object of layer.objects) {
                if (objects.has(object.id)) fail('invalid-input', 'Duplicate object ID.');
                objects.add(object.id);
            }
        }
    }
    const mapProperties = properties(map);
    return Object.freeze({
        format: 'egret.tiled-map/1', orientation, renderOrder, width, height, tileWidth, tileHeight,
        ...(backgroundColor === undefined ? {} : {backgroundColor}), properties: mapProperties,
        tilesets: Object.freeze(tilesets), layers: await resolveLayers(layers, tilesets, orientation, width, height, tileWidth, tileHeight),
    });
}
