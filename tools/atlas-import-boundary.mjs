// SPDX-License-Identifier: Apache-2.0
// Source/emission/declaration inspection only; no product evaluation or writes.
import {readFileSync, readdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintFile, samePhysicalPath} from './lib/file-identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const inventoryPin = {"path":"tests/types/atlas-import-diagnostic-expectations.json","bytes":254943,"sha256":"3d59e24a78708bd0d85f06d6124bced00d5687afcc494d1e919dce1fc9a985c6"};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function refuse(code, detail) { const error = new Error(code + ': ' + detail); error.code = code; throw error; }
function readInventory() {
  if (!samePhysicalPath(root, realpathSync(root), process.platform)) refuse('ATLAS_GATE_OWNER', 'canonical physical owner required');
  const current = fingerprintFile(root, inventoryPin.path);
  if (!same(current, inventoryPin)) refuse('ATLAS_GATE_INVENTORY', 'observed inventory changed');
  return JSON.parse(readFileSync(path.join(root, inventoryPin.path), 'utf8'));
}
function authenticateAliases() {
  for (const name of ['project', 'engine', 'runtime', 'contracts']) {
    const actual = realpathSync(path.join(root, 'node_modules/@egret', name));
    const expected = realpathSync(path.join(root, 'packages', name));
    if (!samePhysicalPath(actual, expected, process.platform)) refuse('ATLAS_GATE_ALIAS', 'foreign public owner: ' + name);
    const entry = fileURLToPath(import.meta.resolve('@egret/' + name));
    if (!samePhysicalPath(realpathSync(entry), path.join(expected, 'dist/index.js'), process.platform)) refuse('ATLAS_GATE_ALIAS', 'foreign built entry: ' + name);
  }
  const optional = fileURLToPath(import.meta.resolve('@egret/project/atlas'));
  if (!samePhysicalPath(realpathSync(optional), path.join(root, 'packages/project/dist/atlas/index.js'), process.platform)) refuse('ATLAS_GATE_ALIAS', 'foreign optional entry');
}
function checkPin(pin, code) { if (!same(fingerprintFile(root, pin.path), pin)) refuse(code, pin.path); }

function tokens(text) {
  const output = []; let at = 0;
  while (at < text.length) {
    const c = text[at];
    if (/\s/.test(c)) { at++; continue; }
    if (text.startsWith('//', at)) { const end = text.indexOf('\n', at); at = end < 0 ? text.length : end; continue; }
    if (text.startsWith('/*', at)) { const end = text.indexOf('*/', at+2); if (end < 0) refuse('ATLAS_SOURCE_LEXICAL', 'unclosed comment'); at=end+2; continue; }
    if (c === '"' || c === "'") {
      const quote = c; let value = '', escaped = false, closed = false; at++;
      while (at < text.length) { const next = text[at++]; if (next === quote) { closed=true; break; } if (next === '\\') { escaped=true; value += next + text[at++]; } else value += next; }
      if (!closed) refuse('ATLAS_SOURCE_LEXICAL', 'unclosed string'); output.push({kind:'string', value, escaped}); continue;
    }
    if (c === String.fromCharCode(96)) refuse('ATLAS_SOURCE_LEXICAL', 'uninspected template');
    const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(at));
    if (word) { output.push({kind:'word', value:word[0]}); at+=word[0].length; } else { output.push({kind:'punctuation',value:c}); at++; }
  }
  return output;
}
function named(text) {
  const input=tokens(text), declarations=[]; let at=0;
  while (at < input.length) {
    if (input[at++]?.value !== 'export') refuse('ATLAS_SOURCE_BARREL', 'unexpected root statement');
    const typeOnly=input[at]?.value==='type'; if (typeOnly) at++;
    if (input[at++]?.value !== '{') refuse('ATLAS_SOURCE_BARREL', 'only explicit named forwarding is allowed');
    const names=[];
    while (input[at]?.value !== '}') { const member=input[at++]; if (member?.kind!=='word') refuse('ATLAS_SOURCE_BARREL','invalid name'); names.push(member.value); if (input[at]?.value!==',') break; at++; }
    if (input[at++]?.value!=='}' || input[at++]?.value!=='from' || input[at]?.kind!=='string' || input[at].escaped) refuse('ATLAS_SOURCE_BARREL','invalid forwarding');
    const from=input[at++].value; if (input[at++]?.value!==';') refuse('ATLAS_SOURCE_BARREL','unterminated forwarding');
    for (const name of names) declarations.push({name,typeOnly,from});
  }
  return declarations;
}
function modulePaths(relative) { return readdirSync(path.join(root, relative), {withFileTypes:true}).flatMap(entry => entry.name==='node_modules'?[]:entry.isDirectory()?modulePaths(relative+'/'+entry.name):entry.isFile()&&/\.(?:ts|js)$/.test(entry.name)?[relative+'/'+entry.name]:[]); }
export function runAtlasImportBoundary() {
  const inventory=readInventory(), policy=inventory.sourcePolicy;
  authenticateAliases();
  const project=JSON.parse(readFileSync(path.join(root,'packages/project/package.json'),'utf8'));
  if (!same(project.dependencies, {'@egret/contracts':'workspace:*','jsonc-parser':'3.3.1'})) refuse('ATLAS_SOURCE_PACKAGE','project dependency boundary changed');
  if (!same(project.exports, {'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./spine':{types:'./dist/spine/index.d.ts',import:'./dist/spine/index.js'},'./atlas':{types:'./dist/atlas/index.d.ts',import:'./dist/atlas/index.js'}})) refuse('ATLAS_SOURCE_PACKAGE','exact optional mapping changed');
  for (const relative of ['src/atlas/index.ts','dist/atlas/index.d.ts','dist/atlas/index.js']) {
    const entries=named(readFileSync(path.join(root,'packages/project',relative),'utf8'));
    const values=entries.filter(e=>!e.typeOnly), types=entries.filter(e=>e.typeOnly);
    if (!same(values.map(e=>e.name).sort(),policy.values) || !same(types.map(e=>e.name).sort(),relative.endsWith('.js')?[]:[...policy.types].sort())
        || values.some(e=>e.from!==(e.name==='ATLAS_IMPORT_LIMITS'?'./input.js':'./plan.js')) || types.some(e=>e.from!=='./types.js')) refuse('ATLAS_SOURCE_BARREL','two values and sixteen erased types required: '+relative);
  }
  for (const name of ['project','engine']) for (const relative of ['src/index.ts','dist/index.js','dist/index.d.ts']) {
    const entries=named(readFileSync(path.join(root,'packages',name,relative),'utf8'));
    if (entries.some(e=>policy.values.includes(e.name)||policy.types.includes(e.name))) refuse('ATLAS_SOURCE_ROOT','optional atlas API leaked into '+name+'/'+relative);
  }
  const atlasPaths=policy.modules.filter(p=>/^packages\/project\/(?:src|dist)\/atlas\//.test(p.path));
  const allowed=new Set(['./input.js','./json.js','./plan.js','./types.js','../json-foundation.js','../unicode.js','../paths.js']);
  const forbidden=new Set(['document','window','navigator','process','Buffer','require','globalThis','fetch','XMLHttpRequest','Worker','WebSocket','setTimeout','setInterval','setImmediate','queueMicrotask','requestAnimationFrame','TextEncoder','ImageBitmap','HTMLElement','HTMLCanvasElement','Document','Window','NodeJS','GPUDevice']);
  for (const pin of atlasPaths) {
    const raw=readFileSync(path.join(root,pin.path),'utf8'), input=tokens(raw);
    if (/\/\/\/\s*<reference\b[^\n]*(?:lib\s*=\s*['"]dom|types\s*=\s*['"]node)/i.test(raw)) refuse('ATLAS_SOURCE_HOST','ambient reference: '+pin.path);
    if (input.some(t=>t.kind==='word'&&forbidden.has(t.value))) refuse('ATLAS_SOURCE_HOST','host authority: '+pin.path);
    for (let i=0;i<input.length;i++) {
      const token=input[i];
      if (token.value==='cause'&&input[i+1]?.value==='.'&&['name','code','message'].includes(input[i+2]?.value)) refuse('ATLAS_SOURCE_CAUSE','external cause inspected');
      if (token.kind==='string'&&(input[i-1]?.value==='from'||input[i-1]?.value==='import'||input[i-2]?.value==='import'&&input[i-1]?.value==='(')) {
        if (token.escaped||!allowed.has(token.value)) refuse('ATLAS_SOURCE_IMPORT','unapproved full import: '+pin.path+' -> '+token.value);
        const begin=input.slice(0,i).map(t=>t.value).lastIndexOf('import');
        const clause=input.slice(begin,i).map(t=>t.value);
        if (clause.some(t=>['SyntaxKind','ScanError','ParseErrorCode'].includes(t))&&clause[1]!=='type') refuse('ATLAS_SOURCE_ENUM','const enum must be type-only');
      }
    }
    if (/\/types\.(?:ts|js)$/.test(pin.path)) {
      if (pin.path.endsWith('.js')&&!same(tokens(raw).map(t=>t.value),['export','{','}',';'])) refuse('ATLAS_SOURCE_TYPES','erased types module emitted values');
    }
  }
  const declaration=readFileSync(path.join(root,'node_modules/jsonc-parser/lib/umd/main.d.ts'),'utf8');
  const source=readFileSync(path.join(root,'packages/project/src/atlas/json.ts'),'utf8');
  for (const [local,upstream,value] of [['OPEN_OBJECT','OpenBraceToken',1],['CLOSE_OBJECT','CloseBraceToken',2],['OPEN_ARRAY','OpenBracketToken',3],['CLOSE_ARRAY','CloseBracketToken',4],['STRING','StringLiteral',10],['LINE_COMMENT','LineCommentTrivia',12],['BLOCK_COMMENT','BlockCommentTrivia',13],['UNKNOWN','Unknown',16],['EOF','EOF',17]]) {
    if (!new RegExp('\\b'+upstream+'\\s*=\\s*'+value+'\\b').test(declaration)||!new RegExp('\\b'+local+'\\s*:\\s*SyntaxKind\\s*=\\s*'+value+'\\b').test(source)) refuse('ATLAS_SOURCE_ENUM','retained public enum value differs: '+local);
  }
  if (!same(modulePaths('packages').sort(),policy.modules.map(p=>p.path).sort())) refuse('ATLAS_SOURCE_FILES','product source/emission/declaration inventory changed');
  // Semantic policy guards above identify the assigned route refusals. Identity
  // checks then retain Spine, geometry, Host and every accepted product module.
  for (const pin of [...policy.modules,...policy.configurationPins,...policy.jsoncPins]) checkPin(pin,'ATLAS_SOURCE_IDENTITY');
  console.log('Atlas import Source boundary PASS: '+policy.modules.length+' exact source/emission/declaration files; two optional values, sixteen erased types, four local built aliases. No product or browser execution.');
}
if (process.argv[1] && samePhysicalPath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url), process.platform)) {
  if (process.argv.length!==2) refuse('ATLAS_SOURCE_ARGUMENTS','direct CLI accepts no arguments');
  runAtlasImportBoundary();
}
