// SPDX-License-Identifier: Apache-2.0
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { readProjectFile } from './inspect.mjs';
import { loadCompiler } from './compile-classic.mjs';

const maxBytes = 64 * 1024 * 1024;
const maxFile = 16 * 1024 * 1024;
const maxFiles = 4095;
const examplesPerKind = 8;
const hostRoots = new Set(['document', 'navigator', 'localStorage', 'WebSocket', 'XMLHttpRequest', 'fetch']);
const channelRoots = new Set(['wx', 'tt', 'FBInstant', 'jsb', 'ExternalInterface']);

// Inspect syntax only. Names can be shadowed by application code, so every hit is a candidate.
function collect(ts, file, bytes, onUse) {
  const syntax = ts.createSourceFile(file, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  const k = ts.SyntaxKind;
  function visit(node) {
    if (node.kind === k.Identifier) {
      const parent = node.parent;
      const name = node.text;
      const member = parent?.kind === k.PropertyAccessExpression && parent.name === node;
      const receiver = member ? parent.expression : undefined;
      const global =
        !member || (receiver.kind === k.Identifier && ['window', 'globalThis', '__global'].includes(receiver.text));
      const isDeclaration = parent?.name === node && !member;
      let kind;
      let symbol = name;
      if (!isDeclaration && global && hostRoots.has(name)) kind = 'browser-host';
      if (
        !isDeclaration &&
        ((global && channelRoots.has(name)) || (member && receiver.text === 'egret' && name === 'ExternalInterface'))
      )
        kind = 'platform-bridge';
      if (
        member &&
        receiver.text === 'RES' &&
        parent.parent?.kind === k.CallExpression &&
        parent.parent.expression === parent &&
        ['getRes', 'getResAsync', 'getResByUrl', 'loadGroup', 'loadConfig'].includes(name)
      ) {
        const first = parent.parent.arguments[0];
        if (first && ![k.StringLiteral, k.NoSubstitutionTemplateLiteral].includes(first.kind)) {
          kind = 'dynamic-resource';
          symbol = 'RES.' + name;
        }
      }
      if (kind) {
        const { line, character } = syntax.getLineAndCharacterOfPosition(node.getStart(syntax));
        onUse(kind, { symbol, file, line: line + 1, column: character + 1 });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return syntax.parseDiagnostics?.length ?? 0;
}

export function inspectHostUsage(owner, sourceOrder, compiler, expectedHash, otherGameRoots) {
  if (!compiler) return { status: 'not-scanned', nextAction: 'supply-trusted-classic-compiler' };
  const { ts, identity } = loadCompiler(owner, compiler, expectedHash, otherGameRoots);
  const findings = {};
  const digest = createHash('sha256');
  let scanned = 0,
    consumed = 0,
    missing = 0,
    oversized = 0,
    parseDiagnostics = 0;
  const listed = [...new Set(sourceOrder.filter(Boolean))];
  for (const file of listed.slice(0, maxFiles)) {
    const stat = fs.lstatSync(path.join(owner, file), { throwIfNoEntry: false });
    if (!stat) {
      missing++;
      continue;
    }
    if (stat.size > maxFile || consumed + stat.size > maxBytes) {
      oversized++;
      continue;
    }
    const entry = readProjectFile(owner, file, Math.min(maxFile, maxBytes - consumed));
    consumed += entry.identity.bytes;
    digest.update(JSON.stringify([file, entry.identity.sha256]) + '\n');
    parseDiagnostics += collect(ts, file, entry.bytes, (kind, use) => {
      const group = (findings[kind] ??= { occurrences: 0, examples: [] });
      group.occurrences++;
      if (group.examples.length < examplesPerKind) group.examples.push({ ...use, sha256: entry.identity.sha256 });
    });
    scanned++;
  }
  return {
    status: scanned === listed.length && !parseDiagnostics && scanned ? 'scanned' : 'partial',
    compiler: identity,
    listed: listed.length,
    scanned,
    missing,
    oversized,
    beyondFileLimit: Math.max(listed.length - maxFiles, 0),
    parseDiagnostics,
    bytes: consumed,
    orderedInputsSha256: digest.digest('hex'),
    findings
  };
}
