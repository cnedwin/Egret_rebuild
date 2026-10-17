// SPDX-License-Identifier: Apache-2.0
// Named source/emission policy only; no product module is executed here.
import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const seqpbRepository = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const seqpbTypes = ['SequencePlayback', 'SequencePlaybackOptions', 'SequencePlaybackState'];
const seqpbPrivate = new Set(['SequencePlaybackOwner', 'SequencePlaybackContext', 'sequencePlaybackBrand', 'createSequencePlaybackOwner', 'createSequencePlayback']);
const seqpbValues = ["AssetLease","AssetManager","BYTE_READER_LIMITS","BYTE_WRITER_LIMITS","Bitmap","ByteReader","ByteWriter","CancellationController","DisplayObject","DisplayObjectContainer","EgretError","Engine","Event","EventDispatcher","Graphics","IMAGE_LIMITS_2D","Mesh2D","NineSliceBitmap","Scope","SequencePlayer","Sprite","Stage","TEXTURED_FRAME_PROFILE_2D","Texture","copyImageData2DPixels","createAssetRef","createAssetType","createEngine","createEngineForProfile","createEventType","createImageData2D","createNineSliceGeometry2D","createSequenceClip","createSpriteSheet","createTexture","createTexturedGeometry2D","isImageData2D","isTexture","isTexturedGeometry2D"];
const seqpbPackages = [{"path":"packages/contracts/package.json","bytes":179,"sha256":"fceaef2ae55a77347ce9f99acd2165d36e991d89c76bf0480ff5048f3e7a94a1"},{"path":"packages/runtime/package.json","bytes":327,"sha256":"b9294c479d38614dd8866adcd8775f5d6f43c787d9b08c8ef54371e426cb5032"},{"path":"packages/engine/package.json","bytes":1567,"sha256":"e01d48a51c0845783afeec93ffcc7674c7980797cd6a9c58cc74ec3f13d2e0c5"},{"path":"packages/project/package.json","bytes":397,"sha256":"295e6bc8d81a4647f5b99355ea27879563ced216fa2af406c65cc78b95f40945"}];
const seqpbStableEntries = [{"path":"packages/contracts/src/index.ts","bytes":1585,"sha256":"75d513766f2d2087ec0a07f097dff7abf5739289f3f9d0bf0e372576467a94c5"},{"path":"packages/contracts/dist/index.js","bytes":304,"sha256":"cd9227c66a8fc34729ecb9a4e462fd432fe5b9be76dc25950f44f3c3725ba95c"},{"path":"packages/contracts/dist/index.d.ts","bytes":1619,"sha256":"b714fec938e235591ddfadc53fa72ba183aaea506267aadaebe5abe65e22c10f"},{"path":"packages/runtime/src/index.ts","bytes":3015,"sha256":"d18e00809b0bd48ecb380e33233988225e85cd348935f7fe72617fb2ebdb3bba"},{"path":"packages/runtime/dist/index.js","bytes":1620,"sha256":"4fd1a98e92b80394a74fe547db1aef39cf663619b61bc5d03be4499d09146eb3"},{"path":"packages/runtime/dist/index.d.ts","bytes":3049,"sha256":"dbfe6572dd526c8bb9c35271f16a1244c93ff9b7474cac813efd1f1e11e6e3d4"},{"path":"packages/runtime/src/text/index.ts","bytes":172,"sha256":"550f5349821f81ed9257780a1e4b5a409afe52e370c90a5fef6334ec7a06191f"},{"path":"packages/runtime/dist/text/index.js","bytes":172,"sha256":"9c68180bcfbbcc01fb762501f660ad8e61da9929799c5b55e7518382c764e7ab"},{"path":"packages/runtime/dist/text/index.d.ts","bytes":207,"sha256":"04cdff5643d9a816ee0c396158533c1d082968853933cd939838de309dfb259d"},{"path":"packages/engine/web/webgpu.ts","bytes":451,"sha256":"84a69d7c3de60a5e3f83cd0d31cb6cd0bcabdebe5553a89abe0fb3f07540c3cb"},{"path":"packages/engine/dist/web/webgpu.js","bytes":190,"sha256":"ae83c0c5f2cb2797e81a72ceaac2b7b19060a985fb3bc201b264881a34e62f31"},{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":409,"sha256":"d2d9e0f5d317dd8ff2a1c536a4fb9c68b0b068da137492daa1e93bddeacc2b8e"},{"path":"packages/engine/rendering/scene3d.ts","bytes":2176,"sha256":"dc10f0cec74891a7a9e8fa67427eeeef6e5ac02012d57e1eee213ed9daad7ca3"},{"path":"packages/engine/dist/rendering/scene3d.js","bytes":1324,"sha256":"4d71aed1486089f3da2c59fcb3d81b8067008c63d1565e89b9d3f74d419b247c"},{"path":"packages/engine/dist/rendering/scene3d.d.ts","bytes":1275,"sha256":"4efe7c389cb1e312124984b6a6b8ed02115a2a131a937e0f83c70f06406d5c3e"},{"path":"packages/engine/web/scene3d.ts","bytes":1484,"sha256":"f1e659b0eee592caf9eef33974e5468c802884d251c933c7df9ade108fb2d7b3"},{"path":"packages/engine/dist/web/scene3d.js","bytes":471,"sha256":"84c56083682a75cad68c065da06700cc18d448278144f130411d709fdc7e6f4b"},{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1280,"sha256":"e2533624b4e0035d837e50bc963e1e39e665685daafa5ca1577d894b15085416"},{"path":"packages/engine/web/index.ts","bytes":122,"sha256":"1c06c610493ff706ed07983a2bdd826aaf8a2b3af8c88563ad99e1324f2a7e4e"},{"path":"packages/engine/dist/web/index.js","bytes":85,"sha256":"5df04a30354456e0d8a316ba156a4a8b9b43f5ff7c8601ac2e0b41af4c7fd27d"},{"path":"packages/engine/dist/web/index.d.ts","bytes":157,"sha256":"8633bffa640fd23f9c3a6b6c1683ba447ea875e5822ddc9cc5cbd265316f0300"},{"path":"packages/engine/src/text.ts","bytes":985,"sha256":"d52c84ce6a50057d13c95291b81a120bb57bd6507ba9b237693aeaa9f84f8175"},{"path":"packages/engine/dist/text.js","bytes":227,"sha256":"7259c2f8f859bc5dd8a17055f0be1b906652fbd47e6965dedbfb96bb25236964"},{"path":"packages/engine/dist/text.d.ts","bytes":1038,"sha256":"44cc298f7bf35cce45cea088c81b1e5902055fb4463f3b701723de4fe9100e5a"},{"path":"packages/engine/web/input.ts","bytes":442,"sha256":"4c90ee48e9228cfab06a45235587e9337118e9a4391a2975e9e6f6b44657fdab"},{"path":"packages/engine/dist/web/input.js","bytes":228,"sha256":"e9279a344270805e83bddd7afdacbe499d7e5a88b305a852301dd168a866eb4b"},{"path":"packages/engine/dist/web/input.d.ts","bytes":477,"sha256":"cf4ffaea56d4e80feb4b41f306ab4a9883e385c0689499b66dc080a2f7e1a916"},{"path":"packages/engine/web/text.ts","bytes":161,"sha256":"f80a1cc204922ca45c180fb82f3860522852108922af25a200df3c27c0654047"},{"path":"packages/engine/dist/web/text.js","bytes":193,"sha256":"d128297057cbd480b05d25a65a982be3d1d72da47fee51cabb230d8d1db5b81b"},{"path":"packages/engine/dist/web/text.d.ts","bytes":195,"sha256":"ba992555448590fbe7bc6777a367f68c71e4ebcbd6d3d34c5999403f204eafe1"},{"path":"packages/project/src/index.ts","bytes":932,"sha256":"95f833ab8c6b93e4b7eb33a0d403c73142648a36b2736a159407bda3eeb6ed2e"},{"path":"packages/project/dist/index.js","bytes":390,"sha256":"302a10921ab9ed63d6601738650a845b4219ac25c505d8b669e3ec6eff309710"},{"path":"packages/project/dist/index.d.ts","bytes":804,"sha256":"f3cf8e24297a0fb50c3d01b002b563c9c3e6f06fbe925d5233fcf7bf7ba53217"},{"path":"packages/project/src/spine/index.ts","bytes":444,"sha256":"658bffaa24a5651cb42923e4222307ac841389441a1082c67934363b3d2b8c36"},{"path":"packages/project/dist/spine/index.js","bytes":232,"sha256":"d559e5dbf5a9373ace8bc26ea1dbebbc8afa67439fc62a85eefb17a2c50d373e"},{"path":"packages/project/dist/spine/index.d.ts","bytes":351,"sha256":"ef6a841b06f8e69e2db5cba87ef3030e7f43ca46c087de3764c136bb334de88a"},{"path":"packages/engine/src/layout.ts","bytes":5432,"sha256":"64227cd76bda5818ff2c257b1c94b2825dac385c915efb77f1ab21153f5d5580"},{"path":"packages/engine/dist/layout.js","bytes":5349,"sha256":"7e8b71d24685d3e1ca5109919bad86c1abcc216a551696450f5a79bf336daafd"},{"path":"packages/engine/dist/layout.d.ts","bytes":421,"sha256":"68e15d413ec3a4b1bdf50459cd4dd5b91cfc74ea141fa6a0eb16767cab696e37"}];
const seqpbConfigurations = [{"path":"tsconfig.base.json","bytes":446,"sha256":"b7a31fb9f93a93e20bfdcf33c135acb45cb3a6895a8b3e7006bd85214ddc1008"},{"path":"tsconfig.json","bytes":369,"sha256":"d9253848fbde9041d0f7540553dbabc7f723856e7f4513358d41aa0384fab0ef"},{"path":"packages/contracts/tsconfig.json","bytes":135,"sha256":"65830141c9e37d6d5a604ae796c5fe8b9258040f9e1f29547c0b238829b989d6"},{"path":"packages/runtime/tsconfig.json","bytes":181,"sha256":"ed31ec963ca62cee11d41071686c8a3dc58554155e120f52d1747254087f1bac"},{"path":"packages/engine/tsconfig.json","bytes":207,"sha256":"ac07062d5460bb112739e3ef98e2f16f7479b1f4a18c7add69c46c2880ac68a4"},{"path":"packages/engine/tsconfig.rendering.json","bytes":307,"sha256":"f5a7e4fe1d79c140d9472417b8ddfbd0104929a982cdf61dae247735f1b6f13a"},{"path":"packages/engine/tsconfig.web.json","bytes":356,"sha256":"c1db022356fde98656725aff6d5e795d8a54bed48046fecb49b33c3c73f2bea3"},{"path":"packages/project/tsconfig.json","bytes":217,"sha256":"77bce36f3e9727b65bad73927abbf5ef3391453d2ff407f2740e4f7c83783567"}];
const seqpbEntries = [{"package":"contracts","entry":".","source":"packages/contracts/src/index.ts","js":"packages/contracts/dist/index.js","declaration":"packages/contracts/dist/index.d.ts"},{"package":"runtime","entry":".","source":"packages/runtime/src/index.ts","js":"packages/runtime/dist/index.js","declaration":"packages/runtime/dist/index.d.ts"},{"package":"runtime","entry":"./text","source":"packages/runtime/src/text/index.ts","js":"packages/runtime/dist/text/index.js","declaration":"packages/runtime/dist/text/index.d.ts"},{"package":"engine","entry":".","source":"packages/engine/src/index.ts","js":"packages/engine/dist/index.js","declaration":"packages/engine/dist/index.d.ts"},{"package":"engine","entry":"./webgpu","source":"packages/engine/web/webgpu.ts","js":"packages/engine/dist/web/webgpu.js","declaration":"packages/engine/dist/web/webgpu.d.ts"},{"package":"engine","entry":"./scene3d","source":"packages/engine/rendering/scene3d.ts","js":"packages/engine/dist/rendering/scene3d.js","declaration":"packages/engine/dist/rendering/scene3d.d.ts"},{"package":"engine","entry":"./webgpu/scene3d","source":"packages/engine/web/scene3d.ts","js":"packages/engine/dist/web/scene3d.js","declaration":"packages/engine/dist/web/scene3d.d.ts"},{"package":"engine","entry":"./web","source":"packages/engine/web/index.ts","js":"packages/engine/dist/web/index.js","declaration":"packages/engine/dist/web/index.d.ts"},{"package":"engine","entry":"./text","source":"packages/engine/src/text.ts","js":"packages/engine/dist/text.js","declaration":"packages/engine/dist/text.d.ts"},{"package":"engine","entry":"./web/input","source":"packages/engine/web/input.ts","js":"packages/engine/dist/web/input.js","declaration":"packages/engine/dist/web/input.d.ts"},{"package":"engine","entry":"./web/text","source":"packages/engine/web/text.ts","js":"packages/engine/dist/web/text.js","declaration":"packages/engine/dist/web/text.d.ts"},{"package":"project","entry":".","source":"packages/project/src/index.ts","js":"packages/project/dist/index.js","declaration":"packages/project/dist/index.d.ts"},{"package":"project","entry":"./spine","source":"packages/project/src/spine/index.ts","js":"packages/project/dist/spine/index.js","declaration":"packages/project/dist/spine/index.d.ts"},{"package":"engine","entry":"./web/image","source":"packages/engine/web/image.ts","js":"packages/engine/dist/web/image.js","declaration":"packages/engine/dist/web/image.d.ts"},{"package":"engine","entry":"./layout","source":"packages/engine/src/layout.ts","js":"packages/engine/dist/layout.js","declaration":"packages/engine/dist/layout.d.ts"}];
const seqpbHash = bytes => createHash('sha256').update(bytes).digest('hex');
const seqpbFail = (code, message) => { const error = Error(message); error.code = code; throw error; };
const seqpbSame = (left, right) => path.relative(left, right) === '';
const seqpbContains = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
function seqpbRead(root, file) {
  if (typeof file !== 'string' || file.includes('\\') || path.isAbsolute(file) || file.split('/').some(part => !part || part === '.' || part === '..')) seqpbFail('SEQP_BOUNDARY_INPUT', 'Noncanonical relative input');
  const physical = realpathSync(path.join(root, file));
  if (!seqpbContains(root, physical) || !lstatSync(physical).isFile()) seqpbFail('SEQP_BOUNDARY_INPUT', 'Source escaped owner: ' + file);
  return readFileSync(physical);
}

// Retain the historical pin and admit only the reviewed optional-entry successor.
// This is one complete path and two exact raw identities, never a path wildcard.
function seqpbAtlasPackageSuccessor(expected, raw) {
  return expected?.path === 'packages/project/package.json'
    && expected.bytes === 397 && expected.sha256 === '295e6bc8d81a4647f5b99355ea27879563ced216fa2af406c65cc78b95f40945'
    && raw.length === 503 && seqpbHash(raw) === '4b4380142316c6ab2f0727eab44c80eff2a21640c701871c6ace3a0ab1b276af';
}

function seqpbPin(root, pin, code) {
  const bytes = seqpbRead(root, pin.path);
  if (seqpbAtlasPackageSuccessor(pin, bytes)) return;
  if (bytes.length !== pin.bytes || seqpbHash(bytes) !== pin.sha256) seqpbFail(code, 'Source identity changed: ' + pin.path);
}

// Whole lexical consumption keeps comments/literal data separate from identifiers.
// Uninspected template substitutions are refused rather than erased.
function seqpbTokens(text, file) {
  const tokens = [], backtick = String.fromCharCode(96);
  let index = 0;
  while (index < text.length) {
    const c = text[index];
    if (/\s/.test(c)) { index++; continue; }
    if (text.startsWith('//', index)) { const end = text.indexOf('\n', index + 2); index = end < 0 ? text.length : end; continue; }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      if (end < 0) seqpbFail('SEQP_BOUNDARY_LEXICAL', 'Unclosed comment: ' + file);
      index = end + 2; continue;
    }
    if (c === '"' || c === "'" || c === backtick) {
      const quote = c; let value = '', closed = false; index++;
      while (index < text.length) {
        const next = text[index++];
        if (next === quote) { closed = true; break; }
        if (next === '\\') {
          if (index >= text.length) break;
          const escaped = text[index++];
          if (escaped === '\r' && text[index] === '\n') index++;
          else if (escaped !== '\n') value += '\\' + escaped;
          continue;
        }
        if (quote === backtick && next === '$' && text[index] === '{') seqpbFail('SEQP_BOUNDARY_LEXICAL', 'Uninspected template substitution: ' + file);
        if (quote !== backtick && (next === '\n' || next === '\r')) seqpbFail('SEQP_BOUNDARY_LEXICAL', 'Unclosed literal: ' + file);
        value += next;
      }
      if (!closed) seqpbFail('SEQP_BOUNDARY_LEXICAL', 'Unclosed literal: ' + file);
      tokens.push({ kind: 'string', value }); continue;
    }
    if (c === '\\' || c.charCodeAt(0) > 127) seqpbFail('SEQP_BOUNDARY_LEXICAL', 'Uninspected identifier encoding: ' + file);
    const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(index));
    if (word) { tokens.push({ kind: 'word', value: word[0] }); index += word[0].length; continue; }
    tokens.push({ kind: 'punctuation', value: c }); index++;
  }
  return tokens;
}
const seqpbLeaf = value => /(?:^|\/)sequencePlayback(?:Types)?(?:\.[cm]?js|\.ts)?$/.test(value);
function seqpbAuthority(tokens, file, rootEntry) {
  for (const token of tokens) {
    if (token.kind === 'word' && seqpbPrivate.has(token.value)) seqpbFail('SEQP_BOUNDARY_PRIVATE_OWNER', file + ': private owner/context/brand/factory leaked');
    if (!rootEntry && token.kind === 'word' && seqpbTypes.includes(token.value)) seqpbFail('SEQP_BOUNDARY_NONROOT_TYPES', file + ': Engine-only type leaked');
    if (token.kind === 'string' && seqpbLeaf(token.value) && (!rootEntry || !token.value.endsWith('/sequencePlaybackTypes.js'))) seqpbFail('SEQP_BOUNDARY_PRIVATE_OWNER', file + ': private leaf exposed');
  }
}
function seqpbNamed(raw, file) {
  const tokens = seqpbTokens(raw, file), found = []; let index = 0;
  while (index < tokens.length) {
    if (tokens[index++]?.value !== 'export') seqpbFail('SEQP_BOUNDARY_ROOT_GRAMMAR', 'Unconsumed root barrel: ' + file);
    const typeOnly = tokens[index]?.value === 'type'; if (typeOnly) index++;
    if (tokens[index++]?.value !== '{') seqpbFail('SEQP_BOUNDARY_ROOT_GRAMMAR', 'Non-named export: ' + file);
    const names = [];
    while (tokens[index]?.value !== '}') {
      const local = tokens[index++];
      if (local?.kind !== 'word') seqpbFail('SEQP_BOUNDARY_ROOT_GRAMMAR', 'Invalid export member: ' + file);
      let exposed = local.value;
      if (tokens[index]?.value === 'as') { index++; const alias = tokens[index++]; if (alias?.kind !== 'word') seqpbFail('SEQP_BOUNDARY_ROOT_GRAMMAR', 'Invalid alias'); exposed = alias.value; }
      names.push({ local: local.value, exposed });
      if (tokens[index]?.value !== ',') break; index++;
    }
    if (tokens[index++]?.value !== '}' || tokens[index++]?.value !== 'from' || tokens[index]?.kind !== 'string') seqpbFail('SEQP_BOUNDARY_ROOT_GRAMMAR', 'Incomplete export');
    const from = tokens[index++].value;
    if (tokens[index++]?.value !== ';') seqpbFail('SEQP_BOUNDARY_ROOT_GRAMMAR', 'Unterminated export');
    for (const name of names) found.push({ ...name, typeOnly, from });
  }
  return found;
}
function seqpbHost(tokens, raw, file) {
  if (/^\s*\/\/\/\s*<reference\b[^\n]*(?:lib\s*=\s*["']dom|types\s*=\s*["']node)/m.test(raw)) seqpbFail('SEQP_BOUNDARY_HOST', file + ': ambient host reference');
  const timing = new Set(['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'queueMicrotask']);
  const host = new Set(['window', 'document', 'navigator', 'global', 'globalThis', 'process', 'require', 'Buffer', 'fetch', 'Worker', 'WebSocket', 'HTMLElement', 'Element', 'EventTarget', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'WebGLRenderingContext', 'ImageBitmap', 'ImageData', 'OffscreenCanvas', 'Blob']);
  for (const token of tokens) if (token.kind === 'word' && timing.has(token.value)) seqpbFail('SEQP_BOUNDARY_AUTOMATIC_TIME', file + ': automatic wall-clock/timer dependency');
  for (const token of tokens) if (token.kind === 'word' && host.has(token.value)) seqpbFail('SEQP_BOUNDARY_HOST', file + ': DOM/Node/host dependency');
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].kind === 'word' && tokens[index].value === 'import' && tokens[index + 1]?.value === '(') seqpbFail('SEQP_BOUNDARY_DAG', file + ': dynamic private-module import');
    if (tokens[index].kind !== 'word' || !['import', 'from'].includes(tokens[index].value) || tokens[index + 1]?.kind !== 'string') continue;
    if (!['@egret/contracts', '@egret/runtime', './gameClockTypes.js', './sequencePlaybackTypes.js'].includes(tokens[index + 1].value)) seqpbFail('SEQP_BOUNDARY_DAG', file + ': unapproved private-module import');
  }
}
function seqpbInventory(root) {
  const pins = [], links = new Set(['contracts', 'runtime', 'engine', 'project'].map(name => 'node_modules/@egret/' + name));
  const visit = relative => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) { if (!links.has(file)) seqpbFail('SEQP_BOUNDARY_COPY', 'Unexpected snapshot link'); continue; }
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        if (file === '.sequence-playback-policy-copy.json') continue;
        const bytes = seqpbRead(root, file); pins.push({ path: file, bytes: bytes.length, sha256: seqpbHash(bytes) });
      } else seqpbFail('SEQP_BOUNDARY_COPY', 'Unexpected snapshot kind');
    }
  };
  visit(''); return pins.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function seqpbRun() {
  const options = new Map(), args = process.argv.slice(2);
  while (args.length) {
    const name = args.shift(), value = args.shift();
    if (!['--root', '--owned-parent', '--owner-token'].includes(name) || options.has(name) || !value) seqpbFail('SEQP_BOUNDARY_INPUT', 'Invalid/duplicate option');
    options.set(name, value);
  }
  const root = realpathSync(options.get('--root') ?? seqpbRepository); let owned = null;
  if (!seqpbSame(root, seqpbRepository)) {
    if (!options.has('--owned-parent') || !options.has('--owner-token')) seqpbFail('SEQP_BOUNDARY_COPY', 'External root lacks owned-copy authority');
    const parent = realpathSync(options.get('--owned-parent'));
    if (!seqpbContains(parent, root) || !seqpbSame(path.dirname(root), parent) || !path.basename(root).startsWith('sequence-playback-policy-')) seqpbFail('SEQP_BOUNDARY_COPY', 'Copy escaped its exact parent');
    owned = JSON.parse(seqpbRead(root, '.sequence-playback-policy-copy.json').toString('utf8'));
    if (owned.kind !== 'GENUINE_SEQUENCE_PLAYBACK_POLICY_COPY' || owned.token !== options.get('--owner-token')
      || !seqpbSame(realpathSync(owned.sourceRoot), seqpbRepository) || !seqpbSame(realpathSync(owned.root), root)
      || !seqpbSame(realpathSync(owned.parent), parent) || !Array.isArray(owned.pins) || !Array.isArray(owned.sourceFiles) || !owned.pins.length) seqpbFail('SEQP_BOUNDARY_COPY', 'Invalid genuine-copy receipt');
  } else if (options.has('--owned-parent') || options.has('--owner-token')) seqpbFail('SEQP_BOUNDARY_COPY', 'Owned options cannot relabel current root');

  // Target rules precede generic identity checks. Controlled failures must name
  // this policy's assigned rule, never the retained checker's generic refusal.
  for (const entry of seqpbEntries) for (const file of [entry.source, entry.js, entry.declaration]) {
    seqpbAuthority(seqpbTokens(seqpbRead(root, file).toString('utf8'), file), file, entry.package === 'engine' && entry.entry === '.');
  }
  const typesJS = 'packages/engine/dist/sequencePlaybackTypes.js';
  if (JSON.stringify(seqpbTokens(seqpbRead(root, typesJS).toString('utf8'), typesJS).map(token => token.value)) !== JSON.stringify(['export', '{', '}', ';'])) seqpbFail('SEQP_BOUNDARY_TYPES_RUNTIME_VALUE', 'Erased type module emitted executable values');
  for (const file of ['packages/engine/src/sequencePlayback.ts', 'packages/engine/src/sequencePlaybackTypes.ts', 'packages/engine/dist/sequencePlayback.js', typesJS, 'packages/engine/dist/sequencePlayback.d.ts', 'packages/engine/dist/sequencePlaybackTypes.d.ts']) {
    const raw = seqpbRead(root, file).toString('utf8'); seqpbHost(seqpbTokens(raw, file), raw, file);
  }
  for (const file of ['packages/engine/src/index.ts', 'packages/engine/dist/index.d.ts', 'packages/engine/dist/index.js']) {
    const exports = seqpbNamed(seqpbRead(root, file).toString('utf8'), file), values = exports.filter(item => !item.typeOnly).map(item => item.exposed).sort();
    if (new Set(values).size !== values.length || JSON.stringify(values) !== JSON.stringify(seqpbValues)) seqpbFail('SEQP_BOUNDARY_ROOT_VALUES', 'Root named runtime values changed');
    const types = exports.filter(item => item.from === './sequencePlaybackTypes.js'), expected = file.endsWith('index.js') ? [] : seqpbTypes;
    if (types.some(item => !item.typeOnly || item.local !== item.exposed) || JSON.stringify(types.map(item => item.exposed).sort()) !== JSON.stringify(expected)) seqpbFail('SEQP_BOUNDARY_ROOT_TYPES', 'Root requires exactly three erased canonical types');
  }
  for (const file of ['packages/engine/src/sequencePlaybackTypes.ts', 'packages/engine/dist/sequencePlaybackTypes.d.ts']) {
    const tokens = seqpbTokens(seqpbRead(root, file).toString('utf8'), file), names = [];
    for (let index = 0; index < tokens.length; index++) if (tokens[index].value === 'export') {
      if (tokens[index + 1]?.value === '{' && tokens[index + 2]?.value === '}') continue;
      if (!['type', 'interface'].includes(tokens[index + 1]?.value) || tokens[index + 2]?.kind !== 'word') seqpbFail('SEQP_BOUNDARY_CANONICAL_TYPES', 'Extra canonical export grammar');
      names.push(tokens[index + 2].value);
    }
    if (JSON.stringify(names.sort()) !== JSON.stringify(seqpbTypes)) seqpbFail('SEQP_BOUNDARY_CANONICAL_TYPES', 'Canonical type inventory changed');
  }
  for (const file of ['packages/engine/src/Engine.ts', 'packages/engine/dist/Engine.js', 'packages/engine/dist/Engine.d.ts']) {
    const tokens = seqpbTokens(seqpbRead(root, file).toString('utf8'), file);
    if (tokens.filter(token => token.kind === 'word' && token.value === 'createSequencePlayback').length !== 1) seqpbFail('SEQP_BOUNDARY_ENGINE_METHOD', 'Engine factory must occur exactly once: ' + file);
    if (file.endsWith('.d.ts') && tokens.some(token => token.kind === 'word' && seqpbPrivate.has(token.value) && token.value !== 'createSequencePlayback')) seqpbFail('SEQP_BOUNDARY_PRIVATE_OWNER', 'Engine declaration exposes assembly authority');
  }
  if (!/^\s*createSequencePlayback\(scope: Scope, bitmap: Bitmap, clip: SequenceClip, options\?: SequencePlaybackOptions\): SequencePlayback;$/m.test(seqpbRead(root, 'packages/engine/dist/Engine.d.ts').toString('utf8'))) seqpbFail('SEQP_BOUNDARY_ENGINE_METHOD', 'Engine factory declaration changed');
  // Current admitted declaration identities close renamed/extra assembly ports.
  seqpbPin(root, {"path":"packages/engine/dist/Engine.d.ts","bytes":3578,"sha256":"2d3861e95f9411f060b7ab0a1febd74ed40e883038f822d4a8df3af0a84cd727"}, 'SEQP_BOUNDARY_ENGINE_METHOD');
  seqpbPin(root, {"path":"packages/engine/dist/sequencePlaybackTypes.d.ts","bytes":798,"sha256":"7670a7b455167beca3aab6729261ac0ad1eb980327e67d13f12132570e67c5cf"}, 'SEQP_BOUNDARY_CANONICAL_TYPES');
  for (const pin of [{"path":"packages/engine/src/index.ts","bytes":3475,"sha256":"c3af513385381ba023c396b9bebc262eb03f300fb2d083e6c76ae08810360cc5"},{"path":"packages/engine/dist/index.js","bytes":1196,"sha256":"d34379ae7b19c048f90b23cc97a819a3037dec8a49ef5c4f330a9e3ed7db6192"},{"path":"packages/engine/dist/index.d.ts","bytes":3509,"sha256":"2f18be0cac8dd50528882438002625f23c24ce4945308419dd4f67ffcaf47271"}]) seqpbPin(root, pin, 'SEQP_BOUNDARY_ROOT_INTERFACE_IDENTITY');
  for (const pin of seqpbPackages) {
    const pkg = JSON.parse(seqpbRead(root, pin.path).toString('utf8'));
    if (/sequencePlayback(?:Types)?/.test(JSON.stringify({ exports: pkg.exports, imports: pkg.imports }))) seqpbFail('SEQP_BOUNDARY_PRIVATE_EXPORT', 'Private sequence leaf became a package entry/port');
    seqpbPin(root, pin, 'SEQP_BOUNDARY_PACKAGE_DAG');
  }
  for (const pin of seqpbStableEntries) seqpbPin(root, pin, 'SEQP_BOUNDARY_DEFAULT_ENTRY_IDENTITY');
  for (const pin of seqpbConfigurations) seqpbPin(root, pin, 'SEQP_BOUNDARY_CONFIGURATION_DAG');
  for (const pin of [{"path":"package.json","bytes":1108,"sha256":"16a969b9a50653b1733893c59ee4cd1d29845208c11bd182036bc585372834d0"},{"path":"pnpm-workspace.yaml","bytes":152,"sha256":"ef6a20dff8ed4d47463ce64622472de5e72ae4515bf56bdd0c09f034e59c66ff"},{"path":"pnpm-lock.yaml","bytes":9017,"sha256":"79383095fd4bb2bb4682a12f9651d9a876a01fc6dc1326d09bc0ad587db23084"}]) seqpbPin(root, pin, 'SEQP_BOUNDARY_PACKAGE_DAG');
  if (owned) {
    if (JSON.stringify(seqpbInventory(root)) !== JSON.stringify(owned.pins)) seqpbFail('SEQP_BOUNDARY_COPY', 'Full successful snapshot differs from receipt');
    const sourceNames = new Set();
    for (const source of owned.sourceFiles) {
      if (sourceNames.has(source.path)) seqpbFail('SEQP_BOUNDARY_COPY', 'Duplicate source mapping'); sourceNames.add(source.path);
      const original = realpathSync(source.source);
      if (!seqpbContains(seqpbRepository, original)) seqpbFail('SEQP_BOUNDARY_COPY', 'Original source mapping escaped current repository');
      const bytes = readFileSync(original);
      if (bytes.length !== source.bytes || seqpbHash(bytes) !== source.sha256) seqpbFail('SEQP_BOUNDARY_COPY', 'Original source changed after snapshot');
      seqpbPin(root, source, 'SEQP_BOUNDARY_COPY');
    }
    const requireTree = (base, relative) => {
      for (const entry of readdirSync(path.join(base, relative), { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const file = relative + '/' + entry.name;
        if (entry.isDirectory()) requireTree(base, file);
        else if (!entry.isFile() || !sourceNames.has(file)) seqpbFail('SEQP_BOUNDARY_COPY', 'Incomplete genuine four-package snapshot');
      }
    };
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      requireTree(seqpbRepository, 'packages/' + name);
      if (!seqpbSame(realpathSync(path.join(root, 'node_modules/@egret', name)), realpathSync(path.join(root, 'packages', name)))) seqpbFail('SEQP_BOUNDARY_COPY', 'Workspace link escaped copied package');
    }
  }
  console.log('SEQP_BOUNDARY_PASS ' + JSON.stringify({ scope: 'source/emission only', rootTypes: seqpbTypes, rootValueCount: seqpbValues.length, ownedSnapshot: owned !== null }));
}
try { seqpbRun(); }
catch (error) {
  const code = typeof error?.code === 'string' && error.code.startsWith('SEQP_BOUNDARY_') ? error.code : 'SEQP_BOUNDARY_SETUP';
  process.stderr.write(code + ': ' + String(error?.message ?? error) + '\n'); process.exitCode = 1;
}
