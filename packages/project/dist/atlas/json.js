// SPDX-License-Identifier: Apache-2.0
import { createScanner, visit } from '../json-foundation.js';
import { utf8Length } from '../unicode.js';
import { ATLAS_IMPORT_LIMITS as limits } from './input.js';
const OPEN_OBJECT = 1, CLOSE_OBJECT = 2, OPEN_ARRAY = 3, CLOSE_ARRAY = 4, STRING = 10, LINE_COMMENT = 12, BLOCK_COMMENT = 13, UNKNOWN = 16, EOF = 17;
export function readMetadata(context, input) {
    const text = input.text, starts = [0];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === 13) {
            if (text.charCodeAt(i + 1) === 10)
                i++;
            starts.push(i + 1);
        }
        else if (c === 10)
            starts.push(i + 1);
    }
    const span = (offset, length) => {
        let lo = 0, hi = starts.length;
        while (lo + 1 < hi) {
            const middle = Math.floor((lo + hi) / 2);
            if (starts[middle] <= offset)
                lo = middle;
            else
                hi = middle;
        }
        return Object.freeze({
            source: 'metadata',
            sourceId: input.id,
            offset,
            length,
            line: lo + 1,
            column: offset - starts[lo] + 1
        });
    };
    const sourceBytes = utf8Length(text);
    if (!sourceBytes.ok)
        context.fail('ATLAS_JSON_SYNTAX', 'metadata', '');
    if (sourceBytes.value > limits.maxSourceUtf8Bytes)
        context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', '');
    if (text.charCodeAt(0) === 0xfeff)
        context.fail('ATLAS_JSON_SYNTAX', 'metadata', '', span(0, 1));
    const scanner = createScanner(text, false);
    let depth = 0;
    for (let token = scanner.scan();; token = scanner.scan()) {
        const tokenSpan = () => span(scanner.getTokenOffset(), scanner.getTokenLength());
        if (scanner.getTokenError() !== 0 || token === UNKNOWN || token === LINE_COMMENT || token === BLOCK_COMMENT)
            context.fail('ATLAS_JSON_SYNTAX', 'metadata', '', tokenSpan());
        if (token === EOF)
            break;
        if (token === STRING && !utf8Length(scanner.getTokenValue()).ok)
            context.fail('ATLAS_JSON_SYNTAX', 'metadata', '', tokenSpan());
        if (token === OPEN_OBJECT || token === OPEN_ARRAY) {
            if (++depth > limits.maxJsonDepth)
                context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', '', tokenSpan());
        }
        else if (token === CLOSE_OBJECT || token === CLOSE_ARRAY)
            depth = Math.max(0, depth - 1);
    }
    let root, nodes = 0, properties = 0;
    const frames = [];
    const childPointer = (parent, key, token) => {
        const pointer = parent + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
        const bytes = utf8Length(pointer);
        if (!bytes.ok || bytes.value > limits.maxDiagnosticPointerUtf8Bytes)
            context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', parent, token);
        return pointer;
    };
    const nextPointer = (token) => {
        const parent = frames.at(-1);
        if (!parent)
            return '';
        if (parent.node.kind === 'array')
            return childPointer(parent.node.pointer, String(parent.node.elements.length), token);
        if (!parent.current)
            context.fail('ATLAS_JSON_SYNTAX', 'metadata', parent.node.pointer, token);
        return parent.current.pointer;
    };
    const attach = (node) => {
        const parent = frames.at(-1);
        if (!parent) {
            root = node;
            return;
        }
        if (parent.node.kind === 'array')
            parent.node.elements.push(node);
        else {
            if (!parent.current)
                context.fail('ATLAS_JSON_SYNTAX', 'metadata', parent.node.pointer, node.span);
            parent.current.node = node;
            delete parent.current;
        }
    };
    const begin = (kind, offset) => {
        const token = span(offset, 1), pointer = nextPointer(token);
        if (++nodes > limits.maxJsonNodes)
            context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', pointer, token);
        const node = {
            kind,
            pointer,
            span: token,
            ...(kind === 'array'
                ? {
                    elements: []
                }
                : {
                    properties: []
                })
        };
        attach(node);
        frames.push({
            node,
            keys: new Map()
        });
    };
    const end = (offset, length) => {
        const frame = frames.pop();
        frame.node.span = span(frame.node.span.offset, offset + length - frame.node.span.offset);
    };
    visit(text, {
        onObjectBegin: offset => begin('object', offset),
        onArrayBegin: offset => begin('array', offset),
        onObjectEnd: end,
        onArrayEnd: end,
        onObjectProperty: (key, offset, length) => {
            const frame = frames.at(-1), token = span(offset, length), pointer = childPointer(frame.node.pointer, key, token), bytes = utf8Length(key);
            if (!bytes.ok)
                context.fail('ATLAS_JSON_SYNTAX', 'metadata', pointer, token);
            if (bytes.value > limits.maxJsonKeyUtf8Bytes)
                context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', pointer, token);
            const earlier = frame.keys.get(key);
            if (earlier)
                context.fail('ATLAS_JSON_DUPLICATE_KEY', 'metadata', pointer, token, earlier);
            if (++properties > limits.maxJsonProperties)
                context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', pointer, token);
            const property = {
                key,
                pointer,
                span: token
            };
            frame.keys.set(key, token);
            frame.node.properties.push(property);
            frame.current = property;
        },
        onLiteralValue: (value, offset, length) => {
            const token = span(offset, length), pointer = nextPointer(token);
            if (typeof value === 'string') {
                const bytes = utf8Length(value);
                if (!bytes.ok)
                    context.fail('ATLAS_JSON_SYNTAX', 'metadata', pointer, token);
                if (bytes.value > limits.maxJsonStringUtf8Bytes)
                    context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', pointer, token);
            }
            else if (typeof value === 'number' && !Number.isFinite(value))
                context.fail('ATLAS_JSON_SYNTAX', 'metadata', pointer, token);
            if (++nodes > limits.maxJsonNodes)
                context.fail('ATLAS_LIMIT_EXCEEDED', 'metadata', pointer, token);
            attach({
                kind: 'literal',
                value,
                pointer,
                span: token
            });
        },
        onError: (_error, offset, length) => context.fail('ATLAS_JSON_SYNTAX', 'metadata', '', span(offset, length))
    }, {
        disallowComments: true,
        allowTrailingComma: false,
        allowEmptyContent: false
    });
    if (!root)
        context.fail('ATLAS_JSON_SYNTAX', 'metadata', '');
    return {
        root,
        utf8Bytes: sourceBytes.value
    };
}
//# sourceMappingURL=json.js.map