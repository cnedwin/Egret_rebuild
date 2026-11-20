#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Which public entries of @egret/engine each entry reaches through its imports, and so which entries a game uses
// without naming them: `@egret/engine/web/game` brings the pointer, the keyboard and the loop with it. A tool that
// counts the entries a game imports (the capability matrix of the games repository) reads `guide/entries.json` to
// credit the entries behind the one a game names. Written from the built engine:
//
//   node tools/entry-map.mjs          writes guide/entries.json
//   node tools/entry-map.mjs --check  fails when guide/entries.json is not what the built engine gives
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planVendor } from './vendor-game.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'guide', 'entries.json');

/** The public entries of the engine package, as its exports name them. */
export function engineEntries() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'engine', 'package.json'), 'utf8'));
  return Object.keys(pkg.exports ?? {})
    .filter(subpath => !subpath.includes('*') && !subpath.endsWith('.json'))
    .map(subpath => (subpath === '.' ? pkg.name : pkg.name + subpath.slice(1)))
    .sort();
}

/** For each engine entry, the other engine entries it reaches; and for each, the entries that reach it. */
export function entryMap() {
  const entries = engineEntries(),
    known = new Set(entries);
  const includes = {},
    partOf = {};
  // The file each entry names: an entry reached by its file, through a relative import, counts as well as by name.
  const fileOf = new Map(entries.map(entry => [planVendor([entry]).map[entry], entry]));
  for (const entry of entries) {
    const plan = planVendor([entry]),
      reached = new Set(Object.keys(plan.map).filter(spec => known.has(spec)));
    for (const file of plan.files.values()) if (fileOf.has(file)) reached.add(fileOf.get(file));
    reached.delete(entry);
    const list = [...reached].sort();
    includes[entry] = list;
    for (const inner of list) (partOf[inner] ??= []).push(entry);
  }
  for (const list of Object.values(partOf)) list.sort();
  const sortedPartOf = Object.fromEntries(
    Object.keys(partOf)
      .sort()
      .map(key => [key, partOf[key]])
  );
  return {
    about:
      'For each public entry of @egret/engine: `includes`, the other entries it imports, directly or through others; ' +
      '`partOf`, the entries that import it. A game that imports an entry uses those it includes. Written by tools/entry-map.mjs.',
    includes,
    partOf: sortedPartOf
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const text = JSON.stringify(entryMap(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (now !== text) {
      console.error('guide/entries.json is not what the built engine gives: run node tools/entry-map.mjs');
      process.exit(1);
    }
    console.log('guide/entries.json is current');
  } else {
    fs.writeFileSync(out, text);
    console.log('wrote guide/entries.json');
  }
}
