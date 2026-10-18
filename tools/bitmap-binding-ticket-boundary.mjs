// SPDX-License-Identifier: Apache-2.0
// Source/emission policy only. Lexer/named-export parser adapted from the
// first-party SequencePlayback policy; no product module is imported/evaluated.
import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
// Preserve the frozen policy; only this complete source/emission pair may succeed it.
const m12IncrementalOwnershipSuccessor = [{"path":"packages/runtime/dist/ownership.js","bytes":6711,"sha256":"a26b1fcd8232dc000ed45fc522784668cb5c69b35d187cea21419cf6b3da7b52"},{"path":"packages/runtime/src/ownership.ts","bytes":9594,"sha256":"0b3bdfbba67ba6e9e30a31b7384c3379fc3fb0352b7be8e7425956372bfbbbfd"}];
const declaredRoot=fileURLToPath(new URL('..',import.meta.url));
const root=realpathSync(declaredRoot);
const platform=process.platform==='win32'?'win32':process.platform;
const physicalAPI=platform==='win32'?path.win32:path.posix;
const bbtbFail=(code,message)=>{const error=Error(message);error.code=code;throw error;};
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
if(process.argv.length!==2)bbtbFail('BBT_BOUNDARY_INPUT','No arguments or external root override is accepted');
if(!physicalAPI.isAbsolute(root)||physicalAPI.relative(root,declaredRoot)!==''||lstatSync(root).isSymbolicLink())bbtbFail('BBT_BOUNDARY_INPUT','Canonical physical owner required');
// Builtins authenticate every exact helper path component and raw bytes first.
let helperFile=root;
for(const [index,part] of ['tools','lib','file-identity.mjs'].entries()){
 if(!readdirSync(helperFile).includes(part))bbtbFail('BBT_BOUNDARY_HELPER','Helper spelling differs');
 helperFile=physicalAPI.join(helperFile,part);const stat=lstatSync(helperFile);
 if(stat.isSymbolicLink()||(index<2?!stat.isDirectory():!stat.isFile()))bbtbFail('BBT_BOUNDARY_HELPER','Helper owner component differs');
}
if(physicalAPI.relative(root,realpathSync(helperFile)).replaceAll('\\','/')!=='tools/lib/file-identity.mjs')bbtbFail('BBT_BOUNDARY_HELPER','Helper has another physical owner');
const helperURL=pathToFileURL(helperFile),helperRaw=readFileSync(helperFile);
if(physicalAPI.relative(helperFile,fileURLToPath(helperURL))!==''||helperRaw.length!==5065||hash(helperRaw)!=='999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569')bbtbFail('BBT_BOUNDARY_HELPER','Shared helper raw bootstrap differs');
const {fingerprintFile,logicalPath,samePhysicalPath}=await import(helperURL.href);
if(!samePhysicalPath(root,declaredRoot,platform))bbtbFail('BBT_BOUNDARY_INPUT','Physical owner differs');
const seen=new Map();
function read(file){logicalPath(file);const pin=fingerprintFile(root,file),raw=readFileSync(path.join(root,file));if(pin.bytes!==raw.length||pin.sha256!==hash(raw))bbtbFail('BBT_BOUNDARY_SOURCE_DRIFT',file);seen.set(file,pin);return raw;}

// Retain the historical pin and admit only the reviewed optional-entry successor.
// This is one complete path and two exact raw identities, never a path wildcard.
// Only the two reviewed optional GL entries extend this exact historical package.
// Reconstruct its full predecessor; unrelated fields and routes remain byte-bound.
function m14EnginePackageSuccessor(expected, raw) {
  const bytes = Buffer.from(raw);
  if (expected?.path !== 'packages/engine/package.json' || expected.bytes !== 1567
      || expected.sha256 !== 'e01d48a51c0845783afeec93ffcc7674c7980797cd6a9c58cc74ec3f13d2e0c5' || bytes.length !== 1799
      || createHash('sha256').update(bytes).digest('hex') !== 'c106c84b479f88ac1570418a21672b6148b1bdd0b870631198c359d467f2f0c7') return false;
  const value = JSON.parse(bytes.toString('utf8'));
  const entries = {"./webgl2":{"types":"./dist/web/webgl2.d.ts","import":"./dist/web/webgl2.js"},"./webgl2/scene3d":{"types":"./dist/web/webgl2Scene3d.d.ts","import":"./dist/web/webgl2Scene3d.js"}};
  for (const [name, mapping] of Object.entries(entries)) {
    if (JSON.stringify(value.exports[name]) !== JSON.stringify(mapping)) return false;
    delete value.exports[name];
  }
  const prior = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  return prior.length === expected.bytes && createHash('sha256').update(prior).digest('hex') === expected.sha256;
}

function bbtbAtlasPackageSuccessor(expected, raw) {
  return expected?.path === 'packages/project/package.json'
    && expected.bytes === 397 && expected.sha256 === '295e6bc8d81a4647f5b99355ea27879563ced216fa2af406c65cc78b95f40945'
    && raw.length === 503 && hash(raw) === '4b4380142316c6ab2f0727eab44c80eff2a21640c701871c6ace3a0ab1b276af';
}

function pinCheck(pin,code){const raw=read(pin.path);if(m14EnginePackageSuccessor(pin,raw)||bbtbAtlasPackageSuccessor(pin,raw))return;if(raw.length!==pin.bytes||hash(raw)!==pin.sha256)bbtbFail(code,'Changed complete source identity: '+pin.path);}
const policyPin={"path":"tools/bitmap-binding-ticket-policy.json","bytes":17762,"sha256":"81fb8a30379ae85782fb4eff61c25a890ab1f4a79404b4ea9bb8b3f1468de6e5"};
pinCheck(policyPin,'BBT_BOUNDARY_POLICY_IDENTITY');
const policy=JSON.parse(read(policyPin.path));
const bbtbTypes=policy.types;
const bbtbPrivate=new Set(['BitmapBindingContext','BitmapBindingOwner','createBitmapBindingOwner','captureBatch','prepareBatch','commitBatch','clearBatchIfCurrent']);
function bbtbTokens(text, file) {
  const tokens = [], backtick = String.fromCharCode(96);
  let index = 0;
  while (index < text.length) {
    const c = text[index];
    if (/\s/.test(c)) { index++; continue; }
    if (text.startsWith('//', index)) { const end = text.indexOf('\n', index + 2); index = end < 0 ? text.length : end; continue; }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      if (end < 0) bbtbFail('BBT_BOUNDARY_LEXICAL', 'Unclosed comment: ' + file);
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
        if (quote === backtick && next === '$' && text[index] === '{') bbtbFail('BBT_BOUNDARY_LEXICAL', 'Uninspected template substitution: ' + file);
        if (quote !== backtick && (next === '\n' || next === '\r')) bbtbFail('BBT_BOUNDARY_LEXICAL', 'Unclosed literal: ' + file);
        value += next;
      }
      if (!closed) bbtbFail('BBT_BOUNDARY_LEXICAL', 'Unclosed literal: ' + file);
      tokens.push({ kind: 'string', value }); continue;
    }
    if (c === '\\' || c.charCodeAt(0) > 127) bbtbFail('BBT_BOUNDARY_LEXICAL', 'Uninspected identifier encoding: ' + file);
    const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(index));
    if (word) { tokens.push({ kind: 'word', value: word[0] }); index += word[0].length; continue; }
    tokens.push({ kind: 'punctuation', value: c }); index++;
  }
  return tokens;
}
function bbtbNamed(raw, file) {
  const tokens = bbtbTokens(raw, file), found = []; let index = 0;
  while (index < tokens.length) {
    if (tokens[index++]?.value !== 'export') bbtbFail('BBT_BOUNDARY_ROOT_GRAMMAR', 'Unconsumed root barrel: ' + file);
    const typeOnly = tokens[index]?.value === 'type'; if (typeOnly) index++;
    if (tokens[index++]?.value !== '{') bbtbFail('BBT_BOUNDARY_ROOT_GRAMMAR', 'Non-named export: ' + file);
    const names = [];
    while (tokens[index]?.value !== '}') {
      const local = tokens[index++];
      if (local?.kind !== 'word') bbtbFail('BBT_BOUNDARY_ROOT_GRAMMAR', 'Invalid export member: ' + file);
      let exposed = local.value;
      if (tokens[index]?.value === 'as') { index++; const alias = tokens[index++]; if (alias?.kind !== 'word') bbtbFail('BBT_BOUNDARY_ROOT_GRAMMAR', 'Invalid alias'); exposed = alias.value; }
      names.push({ local: local.value, exposed });
      if (tokens[index]?.value !== ',') break; index++;
    }
    if (tokens[index++]?.value !== '}' || tokens[index++]?.value !== 'from' || tokens[index]?.kind !== 'string') bbtbFail('BBT_BOUNDARY_ROOT_GRAMMAR', 'Incomplete export');
    const from = tokens[index++].value;
    if (tokens[index++]?.value !== ';') bbtbFail('BBT_BOUNDARY_ROOT_GRAMMAR', 'Unterminated export');
    for (const name of names) found.push({ ...name, typeOnly, from });
  }
  return found;
}

function authority(tokens,file,rootEntry){
 for(const token of tokens){
  if(token.kind==='word'&&bbtbPrivate.has(token.value))bbtbFail('BBT_BOUNDARY_PRIVATE_OWNER',file+': private capability leaked');
  if(!rootEntry&&token.kind==='word'&&bbtbTypes.includes(token.value))bbtbFail('BBT_BOUNDARY_NONROOT_TYPES',file+': Engine-only type leaked');
  if(token.kind==='string'&&/(?:^|\/)bitmapBindingTicket(?:\.[cm]?js|\.ts)?$/.test(token.value)&&(!rootEntry||token.value!=='./bitmapBindingTicket.js'))bbtbFail('BBT_BOUNDARY_PRIVATE_OWNER',file+': private leaf exposed');
 }
}
function host(tokens,raw,file){
 if(/^\s*\/\/\/\s*<reference\b[^\n]*(?:lib\s*=\s*["']dom|types\s*=\s*["']node)/m.test(raw))bbtbFail('BBT_BOUNDARY_HOST',file+': ambient host reference');
 const prohibited=new Set(['window','document','navigator','global','globalThis','process','require','Buffer','fetch','Worker','WebSocket','HTMLElement','Element','EventTarget','HTMLCanvasElement','CanvasRenderingContext2D','WebGLRenderingContext','ImageBitmap','ImageData','OffscreenCanvas','Blob']);
 const timers=new Set(['Date','performance','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','requestIdleCallback','cancelIdleCallback','queueMicrotask']);
 for(const token of tokens)if(token.kind==='word'&&prohibited.has(token.value))bbtbFail('BBT_BOUNDARY_HOST',file+': DOM/Node authority');
 for(const token of tokens)if(token.kind==='word'&&timers.has(token.value))bbtbFail('BBT_BOUNDARY_AUTOMATIC_TIME',file+': automatic clock');
 for(let i=0;i<tokens.length;i++){
  if(tokens[i].value==='import'&&tokens[i+1]?.value==='(')bbtbFail('BBT_BOUNDARY_DAG',file+': dynamic import');
  if(!['import','from'].includes(tokens[i].value)||tokens[i+1]?.kind!=='string')continue;
  const spec=tokens[i+1].value;
  if(file.startsWith('packages/engine/')&&spec!=='@egret/runtime'&&spec!=='@egret/contracts')bbtbFail('BBT_BOUNDARY_DAG',file+': coordinator import leaves selected DAG');
  if(file.startsWith('packages/runtime/')){
   if(spec==='@egret/contracts')continue;
   const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
   const owner=file.includes('/src/')?'packages/runtime/src/':'packages/runtime/dist/';
   if(!spec.startsWith('.')||!target.startsWith(owner))bbtbFail('BBT_BOUNDARY_DAG',file+': runtime import leaves owner');
  }
 }
}
function inversePin(file,raw,expected,code){if(raw.length!==expected.bytes||hash(raw)!==expected.sha256)bbtbFail(code,'Only selected declaration additions are permitted: '+file);}
function removeRootTypes(raw,file){
 const text=raw.toString('utf8');
 const pattern=/^export\s+type\s*\{[^\n]*\}\s+from\s+(['"])\.\/bitmapBindingTicket\.js\1;\n/gm;
 const matches=[...text.matchAll(pattern)];if(matches.length!==1)bbtbFail('BBT_BOUNDARY_ROOT_TYPES','One canonical forwarding declaration required: '+file);
 return Buffer.from(text.slice(0,matches[0].index)+text.slice(matches[0].index+matches[0][0].length),'utf8');
}
function oldEngineDeclaration(raw){
 const lines=raw.toString('utf8').split('\n');
 const exact='    captureBitmapBindings(scope: Scope, targets: readonly Bitmap[]): BitmapBindingTicket;';
 const positions=lines.flatMap((line,index)=>line===exact?[index]:[]);
 if(positions.length!==1)bbtbFail('BBT_BOUNDARY_ENGINE_METHOD','Exact selected method declaration required');
 let first=positions[0],last=first+1;
 // An adjacent documentation comment is authored with the one new method.
 if(first>0&&/^    \/\*\*.*\*\/$/.test(lines[first-1]))first--;
 else if(first>0&&/^    \*\/$/.test(lines[first-1])){
  let start=first-2;while(start>=0&&/^     \*/.test(lines[start]))start--;
  if(start<0||!/^    \/\*\*/.test(lines[start]))bbtbFail('BBT_BOUNDARY_ENGINE_METHOD','Malformed method documentation');first=start;
 }
 lines.splice(first,last-first);
 const imports=lines.flatMap((line,index)=>/^import type \{ BitmapBindingTicket \} from ['"]\.\/bitmapBindingTicket\.js['"];\s*$/.test(line)?[index]:[]);
 if(imports.length!==1)bbtbFail('BBT_BOUNDARY_ENGINE_METHOD','One erased method-result import required');
 lines.splice(imports[0],1);return Buffer.from(lines.join('\n'),'utf8');
}
function m12SelectedProductPins() {
 const paths = ['packages/runtime/src/ownership.ts', 'packages/runtime/dist/ownership.js'];
 const prior = policy.selectedProductPins.filter(row => paths.includes(row.path));
 const tuples = [...prior].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(row=>[row.path,row.bytes,row.sha256]);
 const rows = m12IncrementalOwnershipSuccessor;
 if (prior.length!==2 || hash(Buffer.from(JSON.stringify(tuples)))!=='f32e7e99a5d08e707b38da86a23e355cf76349426c8a6312b6e455c69f790a7f'
     || rows.length!==2 || !equal(rows.map(row=>row.path).sort(),[...paths].sort())
     || rows.some(row=>!equal(Object.keys(row).sort(),['bytes','path','sha256']) || !Number.isSafeInteger(row.bytes) || row.bytes<0 || !/^[a-f0-9]{64}$/.test(row.sha256))) {
  bbtbFail('BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY','Invalid finite M1.2 ownership predecessor or successor');
 }
 const actual = new Map(paths.map(file=>{const raw=read(file);return [file,{bytes:raw.length,sha256:hash(raw)}];}));
 const matches = group=>group.every(row=>actual.get(row.path).bytes===row.bytes&&actual.get(row.path).sha256===row.sha256);
 if (matches(prior)) return policy.selectedProductPins;
 if (!matches(rows)) bbtbFail('BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY','Complete M1.2 ownership source/emission pair differs');
 const reviewed = new Map(rows.map(row=>[row.path,row]));
 return policy.selectedProductPins.map(row=>reviewed.get(row.path)??row);
}

// M1.3 keeps the frozen interface policy and its exact inverse transforms.
const m13InterfaceRawSuccessor = [{"path":"packages/contracts/dist/index.d.ts","bytes":2486,"sha256":"955bbf2feaeafdab5b155e3e4875f077c667d074fe6d807a85c9a5fec6f24434"},{"path":"packages/contracts/dist/index.js","bytes":540,"sha256":"f90933caf2643c0d4aa688eff5264160a7e931ee54b94c80163e1535e398ebce"},{"path":"packages/contracts/src/index.ts","bytes":2452,"sha256":"dcdc09ded4557146775ee700087cfc2e9b14dc45e30f6d569848cebe0e3583e0"},{"path":"packages/engine/dist/Engine.d.ts","bytes":4164,"sha256":"95cafab27f02fe7cc60ff84f4f2c8e6f0647169a8da14fbd3c7ba343f7f31b4e"},{"path":"packages/engine/dist/Engine.js","bytes":19361,"sha256":"7dd89b839af28df8ee92e3832140c85dece6ee4700c8c1d5cfd2d0ddad67bc71"},{"path":"packages/engine/dist/bitmapBindingTicket.d.ts","bytes":882,"sha256":"74384e0772282729962db5fe7e7c0708296326ff5e03609138ade702299b5aa4"},{"path":"packages/engine/dist/bitmapBindingTicket.js","bytes":6424,"sha256":"e73da40785fee46bced473aefd0ea5d30bff97491f9461072cb56e31779e4b52"},{"path":"packages/engine/dist/index.d.ts","bytes":4196,"sha256":"74dcf197b05678d39f9946dd49ab5ac20ad2e04cc5aa2ba72ab1c4e9f973d134"},{"path":"packages/engine/dist/index.js","bytes":1358,"sha256":"96afca247999dc46d1321ce15138fbe01fffde0aafbb76fb48440a09b67ca082"},{"path":"packages/engine/dist/layout.d.ts","bytes":421,"sha256":"68e15d413ec3a4b1bdf50459cd4dd5b91cfc74ea141fa6a0eb16767cab696e37"},{"path":"packages/engine/dist/layout.js","bytes":5349,"sha256":"7e8b71d24685d3e1ca5109919bad86c1abcc216a551696450f5a79bf336daafd"},{"path":"packages/engine/dist/rendering/scene3d.d.ts","bytes":1275,"sha256":"4efe7c389cb1e312124984b6a6b8ed02115a2a131a937e0f83c70f06406d5c3e"},{"path":"packages/engine/dist/rendering/scene3d.js","bytes":1324,"sha256":"4d71aed1486089f3da2c59fcb3d81b8067008c63d1565e89b9d3f74d419b247c"},{"path":"packages/engine/dist/text.d.ts","bytes":1038,"sha256":"44cc298f7bf35cce45cea088c81b1e5902055fb4463f3b701723de4fe9100e5a"},{"path":"packages/engine/dist/text.js","bytes":227,"sha256":"7259c2f8f859bc5dd8a17055f0be1b906652fbd47e6965dedbfb96bb25236964"},{"path":"packages/engine/dist/web/image.d.ts","bytes":346,"sha256":"11e0348e549ed825d0c7e00c5864d1df9a2f24fa4ab2cbf7c43ad66e3d26c0ca"},{"path":"packages/engine/dist/web/image.js","bytes":234,"sha256":"28c0f728e5a1cdf35414806409623500267376b19a4a06f296310ee4d674d9c3"},{"path":"packages/engine/dist/web/index.d.ts","bytes":157,"sha256":"8633bffa640fd23f9c3a6b6c1683ba447ea875e5822ddc9cc5cbd265316f0300"},{"path":"packages/engine/dist/web/index.js","bytes":85,"sha256":"5df04a30354456e0d8a316ba156a4a8b9b43f5ff7c8601ac2e0b41af4c7fd27d"},{"path":"packages/engine/dist/web/input.d.ts","bytes":477,"sha256":"cf4ffaea56d4e80feb4b41f306ab4a9883e385c0689499b66dc080a2f7e1a916"},{"path":"packages/engine/dist/web/input.js","bytes":228,"sha256":"e9279a344270805e83bddd7afdacbe499d7e5a88b305a852301dd168a866eb4b"},{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1433,"sha256":"54ae3906765ca00ff8a0de7bbbdacd182816aabb03e79edc57ec5b00b099f62c"},{"path":"packages/engine/dist/web/scene3d.js","bytes":532,"sha256":"7d95b104c9e547fef5a6b479cc713ad753ce702286d1b4724ccf300725e0a14a"},{"path":"packages/engine/dist/web/text.d.ts","bytes":195,"sha256":"ba992555448590fbe7bc6777a367f68c71e4ebcbd6d3d34c5999403f204eafe1"},{"path":"packages/engine/dist/web/text.js","bytes":193,"sha256":"d128297057cbd480b05d25a65a982be3d1d72da47fee51cabb230d8d1db5b81b"},{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":595,"sha256":"3916e5931b13bb607303ca87568454a0fb4eaa37dab9e09c4433ee864d8d0ffa"},{"path":"packages/engine/dist/web/webgpu.js","bytes":248,"sha256":"59ff7e9981cbb680644404d113da72878f38e4a135de0c1301bc269cb8109450"},{"path":"packages/engine/rendering/scene3d.ts","bytes":2176,"sha256":"dc10f0cec74891a7a9e8fa67427eeeef6e5ac02012d57e1eee213ed9daad7ca3"},{"path":"packages/engine/src/Engine.ts","bytes":22118,"sha256":"69e224758234cdd63fa9610317d267a9cf5d7f304913586521742349c7e43d39"},{"path":"packages/engine/src/bitmapBindingTicket.ts","bytes":7544,"sha256":"9956863e485077e94f1a0871d0f48e154335e79926aadd8c3b00a7b1140c0158"},{"path":"packages/engine/src/index.ts","bytes":4162,"sha256":"c83485f3f51530025dd0567d4f7685930a8171821dd04d6916dfa9f8241d1fad"},{"path":"packages/engine/src/layout.ts","bytes":5432,"sha256":"64227cd76bda5818ff2c257b1c94b2825dac385c915efb77f1ab21153f5d5580"},{"path":"packages/engine/src/text.ts","bytes":985,"sha256":"d52c84ce6a50057d13c95291b81a120bb57bd6507ba9b237693aeaa9f84f8175"},{"path":"packages/engine/web/image.ts","bytes":358,"sha256":"beb530b0351e1c235ca75a27a831e0df491d6be7dc057ba6c6eca09492280359"},{"path":"packages/engine/web/index.ts","bytes":122,"sha256":"1c06c610493ff706ed07983a2bdd826aaf8a2b3af8c88563ad99e1324f2a7e4e"},{"path":"packages/engine/web/input.ts","bytes":442,"sha256":"4c90ee48e9228cfab06a45235587e9337118e9a4391a2975e9e6f6b44657fdab"},{"path":"packages/engine/web/scene3d.ts","bytes":1638,"sha256":"b0621adc967bd2b646d33dcc4704ce2927fd6bd16f24874b489a25c9e9e9d010"},{"path":"packages/engine/web/text.ts","bytes":161,"sha256":"f80a1cc204922ca45c180fb82f3860522852108922af25a200df3c27c0654047"},{"path":"packages/engine/web/webgpu.ts","bytes":638,"sha256":"5279441b47636a27fc3589102e8bfffeccea1f138915dc4012539b1fd3d8a5df"},{"path":"packages/project/dist/index.d.ts","bytes":804,"sha256":"f3cf8e24297a0fb50c3d01b002b563c9c3e6f06fbe925d5233fcf7bf7ba53217"},{"path":"packages/project/dist/index.js","bytes":390,"sha256":"302a10921ab9ed63d6601738650a845b4219ac25c505d8b669e3ec6eff309710"},{"path":"packages/project/dist/spine/index.d.ts","bytes":351,"sha256":"ef6a841b06f8e69e2db5cba87ef3030e7f43ca46c087de3764c136bb334de88a"},{"path":"packages/project/dist/spine/index.js","bytes":232,"sha256":"d559e5dbf5a9373ace8bc26ea1dbebbc8afa67439fc62a85eefb17a2c50d373e"},{"path":"packages/project/src/index.ts","bytes":932,"sha256":"95f833ab8c6b93e4b7eb33a0d403c73142648a36b2736a159407bda3eeb6ed2e"},{"path":"packages/project/src/spine/index.ts","bytes":444,"sha256":"658bffaa24a5651cb42923e4222307ac841389441a1082c67934363b3d2b8c36"},{"path":"packages/runtime/dist/Bitmap.d.ts","bytes":2135,"sha256":"f0b750c75909d8a5ebab613f7dbfdead941e0c33b22a3c2e8bdb054bbd0b959b"},{"path":"packages/runtime/dist/Bitmap.js","bytes":21049,"sha256":"b7d91499cb36d73c6b0b0767ec90080b2acaec52a2d0ccf0a785d793b48b6544"},{"path":"packages/runtime/dist/index.d.ts","bytes":3209,"sha256":"80882b9feafe084db79179fc33161c51e655f9748df813619c2869b04377ddeb"},{"path":"packages/runtime/dist/index.js","bytes":1708,"sha256":"c8cbc112cd5597e0729c34368954d74a94511638d3efab1fec78603e2f7007f5"},{"path":"packages/runtime/dist/ownership.d.ts","bytes":4100,"sha256":"2fbb46cdf1aa876df0593e93b3164e73622bcf0bc6772b64c4316a3b204d30c1"},{"path":"packages/runtime/dist/ownership.js","bytes":6711,"sha256":"a26b1fcd8232dc000ed45fc522784668cb5c69b35d187cea21419cf6b3da7b52"},{"path":"packages/runtime/dist/text/index.d.ts","bytes":207,"sha256":"04cdff5643d9a816ee0c396158533c1d082968853933cd939838de309dfb259d"},{"path":"packages/runtime/dist/text/index.js","bytes":172,"sha256":"9c68180bcfbbcc01fb762501f660ad8e61da9929799c5b55e7518382c764e7ab"},{"path":"packages/runtime/src/Bitmap.ts","bytes":21487,"sha256":"ce11656e4a4b2e9b60bd3a1d70f31da6cdfd66d7abcbce41e803993a72c1f3fe"},{"path":"packages/runtime/src/index.ts","bytes":3175,"sha256":"49dea0acbe38ef6fde21431b335da2c74e5324d8f607c9b9d6712323d8cf8beb"},{"path":"packages/runtime/src/ownership.ts","bytes":9594,"sha256":"0b3bdfbba67ba6e9e30a31b7384c3379fc3fb0352b7be8e7425956372bfbbbfd"},{"path":"packages/runtime/src/text/index.ts","bytes":172,"sha256":"550f5349821f81ed9257780a1e4b5a409afe52e370c90a5fef6334ec7a06191f"}];
const m13InterfaceProjectedSuccessor = [{"base":{"path":"packages/engine/src/index.ts","bytes":3406,"sha256":"073d5ce7d30ba0ca4977f1b561b1696797e6bbb9e691373ae8b84d0a90349fce"},"current":{"path":"packages/engine/src/index.ts","bytes":4093,"sha256":"e4365269cdd2dcac13d7a2605693c945ce9b130083f25728c64a14ae53347d21"}},{"base":{"path":"packages/engine/dist/index.js","bytes":1196,"sha256":"d34379ae7b19c048f90b23cc97a819a3037dec8a49ef5c4f330a9e3ed7db6192"},"current":{"path":"packages/engine/dist/index.js","bytes":1358,"sha256":"96afca247999dc46d1321ce15138fbe01fffde0aafbb76fb48440a09b67ca082"}},{"base":{"path":"packages/engine/dist/index.d.ts","bytes":3440,"sha256":"c795ff57405558b7a1d336b9658f16f13ced50dec312c0f8cfc4aa9a8bbde2dd"},"current":{"path":"packages/engine/dist/index.d.ts","bytes":4127,"sha256":"d4439f22d3dc56ace0e3c85fea434eb0dda4fec1f499099f9d50dcf4342324f3"}},{"base":{"path":"packages/engine/dist/Engine.d.ts","bytes":3328,"sha256":"9904b53a624ab5be83a28c4a906791edf1fd1e8a5cd383bb2bf98d4d510463b3"},"current":{"path":"packages/engine/dist/Engine.d.ts","bytes":3914,"sha256":"b10c557e6b470928e49be963e615b3b5a7b64c0c37dcf24301f5dfd641fbb766"}}];
const m13InterfaceStableSuccessor = [{"base":{"path":"packages/contracts/src/index.ts","bytes":1585,"sha256":"75d513766f2d2087ec0a07f097dff7abf5739289f3f9d0bf0e372576467a94c5"},"current":{"path":"packages/contracts/src/index.ts","bytes":2452,"sha256":"dcdc09ded4557146775ee700087cfc2e9b14dc45e30f6d569848cebe0e3583e0"}},{"base":{"path":"packages/contracts/dist/index.js","bytes":304,"sha256":"cd9227c66a8fc34729ecb9a4e462fd432fe5b9be76dc25950f44f3c3725ba95c"},"current":{"path":"packages/contracts/dist/index.js","bytes":540,"sha256":"f90933caf2643c0d4aa688eff5264160a7e931ee54b94c80163e1535e398ebce"}},{"base":{"path":"packages/contracts/dist/index.d.ts","bytes":1619,"sha256":"b714fec938e235591ddfadc53fa72ba183aaea506267aadaebe5abe65e22c10f"},"current":{"path":"packages/contracts/dist/index.d.ts","bytes":2486,"sha256":"955bbf2feaeafdab5b155e3e4875f077c667d074fe6d807a85c9a5fec6f24434"}},{"base":{"path":"packages/runtime/src/index.ts","bytes":3015,"sha256":"d18e00809b0bd48ecb380e33233988225e85cd348935f7fe72617fb2ebdb3bba"},"current":{"path":"packages/runtime/src/index.ts","bytes":3175,"sha256":"49dea0acbe38ef6fde21431b335da2c74e5324d8f607c9b9d6712323d8cf8beb"}},{"base":{"path":"packages/runtime/dist/index.js","bytes":1620,"sha256":"4fd1a98e92b80394a74fe547db1aef39cf663619b61bc5d03be4499d09146eb3"},"current":{"path":"packages/runtime/dist/index.js","bytes":1708,"sha256":"c8cbc112cd5597e0729c34368954d74a94511638d3efab1fec78603e2f7007f5"}},{"base":{"path":"packages/runtime/dist/index.d.ts","bytes":3049,"sha256":"dbfe6572dd526c8bb9c35271f16a1244c93ff9b7474cac813efd1f1e11e6e3d4"},"current":{"path":"packages/runtime/dist/index.d.ts","bytes":3209,"sha256":"80882b9feafe084db79179fc33161c51e655f9748df813619c2869b04377ddeb"}},{"base":{"path":"packages/engine/web/webgpu.ts","bytes":451,"sha256":"84a69d7c3de60a5e3f83cd0d31cb6cd0bcabdebe5553a89abe0fb3f07540c3cb"},"current":{"path":"packages/engine/web/webgpu.ts","bytes":638,"sha256":"5279441b47636a27fc3589102e8bfffeccea1f138915dc4012539b1fd3d8a5df"}},{"base":{"path":"packages/engine/dist/web/webgpu.js","bytes":190,"sha256":"ae83c0c5f2cb2797e81a72ceaac2b7b19060a985fb3bc201b264881a34e62f31"},"current":{"path":"packages/engine/dist/web/webgpu.js","bytes":248,"sha256":"59ff7e9981cbb680644404d113da72878f38e4a135de0c1301bc269cb8109450"}},{"base":{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":409,"sha256":"d2d9e0f5d317dd8ff2a1c536a4fb9c68b0b068da137492daa1e93bddeacc2b8e"},"current":{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":595,"sha256":"3916e5931b13bb607303ca87568454a0fb4eaa37dab9e09c4433ee864d8d0ffa"}},{"base":{"path":"packages/engine/web/scene3d.ts","bytes":1484,"sha256":"f1e659b0eee592caf9eef33974e5468c802884d251c933c7df9ade108fb2d7b3"},"current":{"path":"packages/engine/web/scene3d.ts","bytes":1638,"sha256":"b0621adc967bd2b646d33dcc4704ce2927fd6bd16f24874b489a25c9e9e9d010"}},{"base":{"path":"packages/engine/dist/web/scene3d.js","bytes":471,"sha256":"84c56083682a75cad68c065da06700cc18d448278144f130411d709fdc7e6f4b"},"current":{"path":"packages/engine/dist/web/scene3d.js","bytes":532,"sha256":"7d95b104c9e547fef5a6b479cc713ad753ce702286d1b4724ccf300725e0a14a"}},{"base":{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1280,"sha256":"e2533624b4e0035d837e50bc963e1e39e665685daafa5ca1577d894b15085416"},"current":{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1433,"sha256":"54ae3906765ca00ff8a0de7bbbdacd182816aabb03e79edc57ec5b00b099f62c"}}];
const m13InterfaceRawPaths = ["packages/contracts/dist/index.d.ts","packages/contracts/dist/index.js","packages/contracts/src/index.ts","packages/engine/dist/Engine.d.ts","packages/engine/dist/Engine.js","packages/engine/dist/bitmapBindingTicket.d.ts","packages/engine/dist/bitmapBindingTicket.js","packages/engine/dist/index.d.ts","packages/engine/dist/index.js","packages/engine/dist/layout.d.ts","packages/engine/dist/layout.js","packages/engine/dist/rendering/scene3d.d.ts","packages/engine/dist/rendering/scene3d.js","packages/engine/dist/text.d.ts","packages/engine/dist/text.js","packages/engine/dist/web/image.d.ts","packages/engine/dist/web/image.js","packages/engine/dist/web/index.d.ts","packages/engine/dist/web/index.js","packages/engine/dist/web/input.d.ts","packages/engine/dist/web/input.js","packages/engine/dist/web/scene3d.d.ts","packages/engine/dist/web/scene3d.js","packages/engine/dist/web/text.d.ts","packages/engine/dist/web/text.js","packages/engine/dist/web/webgpu.d.ts","packages/engine/dist/web/webgpu.js","packages/engine/rendering/scene3d.ts","packages/engine/src/Engine.ts","packages/engine/src/bitmapBindingTicket.ts","packages/engine/src/index.ts","packages/engine/src/layout.ts","packages/engine/src/text.ts","packages/engine/web/image.ts","packages/engine/web/index.ts","packages/engine/web/input.ts","packages/engine/web/scene3d.ts","packages/engine/web/text.ts","packages/engine/web/webgpu.ts","packages/project/dist/index.d.ts","packages/project/dist/index.js","packages/project/dist/spine/index.d.ts","packages/project/dist/spine/index.js","packages/project/src/index.ts","packages/project/src/spine/index.ts","packages/runtime/dist/Bitmap.d.ts","packages/runtime/dist/Bitmap.js","packages/runtime/dist/index.d.ts","packages/runtime/dist/index.js","packages/runtime/dist/ownership.d.ts","packages/runtime/dist/ownership.js","packages/runtime/dist/text/index.d.ts","packages/runtime/dist/text/index.js","packages/runtime/src/Bitmap.ts","packages/runtime/src/index.ts","packages/runtime/src/ownership.ts","packages/runtime/src/text/index.ts"];
function m13InterfaceSelected(){return ["SHARED_FRAME_PROFILE_2D","createSharedGeometry2D","createSharedMaterial2D","createTextureView"].some(name=>new RegExp('\\b'+name+'\\b').test(read('packages/engine/src/index.ts').toString('utf8')));}
function m13InterfacePin(expected,projected=false){
 if(!m13InterfaceSelected())return expected;
 const pair=(projected?m13InterfaceProjectedSuccessor:m13InterfaceStableSuccessor).find(row=>equal(row.base,expected));
 return pair?.current??expected;
}
function m13InterfaceComplete(){
 if(!m13InterfaceSelected())return;
 if(m13InterfaceRawSuccessor.length!==57||!equal(m13InterfaceRawSuccessor.map(row=>row.path),m13InterfaceRawPaths)||new Set(m13InterfaceRawPaths).size!==57
    ||m13InterfaceRawSuccessor.some(row=>!equal(Object.keys(row).sort(),['bytes','path','sha256'])||!Number.isSafeInteger(row.bytes)||row.bytes<0||!/^[a-f0-9]{64}$/.test(row.sha256)))bbtbFail('BBT_BOUNDARY_DEFAULT_ENTRY_IDENTITY','Invalid finite M1.3 interface group');
 for(const row of m13InterfaceRawSuccessor)pinCheck(row,'BBT_BOUNDARY_DEFAULT_ENTRY_IDENTITY');
}

function run(){
 if(policy.schemaVersion!==1||policy.kind!=='BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY'||!equal(bbtbTypes,['BitmapBindingTicket']))bbtbFail('BBT_BOUNDARY_POLICY_IDENTITY','Exact finite policy schema required');
 // Assigned exposure rules run before generic pinned-identity refusals.
 for(const entry of policy.entries)for(const file of [entry.source,entry.js,entry.declaration])authority(bbtbTokens(read(file).toString('utf8'),file),file,entry.package==='engine'&&entry.entry==='.');
 for(const file of ['packages/engine/src/index.ts','packages/engine/dist/index.d.ts','packages/engine/dist/index.js']){
  const exports=bbtbNamed(read(file).toString('utf8'),file),values=exports.filter(q=>!q.typeOnly).map(q=>q.exposed).sort();
  if(new Set(values).size!==values.length||!equal(values,m13InterfaceSelected()?[...policy.rootValues,...["SHARED_FRAME_PROFILE_2D","createSharedGeometry2D","createSharedMaterial2D","createTextureView"]].sort():policy.rootValues))bbtbFail('BBT_BOUNDARY_ROOT_VALUES','Default runtime namespace changed');
  const selected=exports.filter(q=>q.from==='./bitmapBindingTicket.js'),expected=file.endsWith('index.js')?[]:bbtbTypes;
  if(selected.some(q=>!q.typeOnly||q.local!==q.exposed)||!equal(selected.map(q=>q.exposed).sort(),expected))bbtbFail('BBT_BOUNDARY_ROOT_TYPES','Exactly one canonical erased name required');
 }
 for(const q of policy.oldRootPins){const raw=read(q.path);inversePin(q.path,q.path.endsWith('/index.js')?raw:removeRootTypes(raw,q.path),m13InterfacePin(q,true),'BBT_BOUNDARY_ROOT_INTERFACE_IDENTITY');}
 const dts='packages/engine/dist/Engine.d.ts';inversePin(dts,oldEngineDeclaration(read(dts)),m13InterfacePin(policy.oldEngineDeclarationPin,true),'BBT_BOUNDARY_ENGINE_PUBLIC_DECLARATION');
 for(const file of ['packages/engine/src/Engine.ts','packages/engine/dist/Engine.js','packages/engine/dist/Engine.d.ts']){
  const tokens=bbtbTokens(read(file).toString('utf8'),file);
  if(tokens.filter(q=>q.kind==='word'&&q.value==='captureBitmapBindings').length!==1)bbtbFail('BBT_BOUNDARY_ENGINE_METHOD','Exactly one Engine method: '+file);
 }
 for(const file of ['packages/engine/src/bitmapBindingTicket.ts','packages/engine/dist/bitmapBindingTicket.js','packages/engine/dist/bitmapBindingTicket.d.ts',
  'packages/runtime/src/Bitmap.ts','packages/runtime/dist/Bitmap.js','packages/runtime/dist/Bitmap.d.ts','packages/runtime/src/ownership.ts','packages/runtime/dist/ownership.js','packages/runtime/dist/ownership.d.ts']){
  const raw=read(file).toString('utf8'),tokens=bbtbTokens(raw,file);host(tokens,raw,file);
  if(file.endsWith('bitmapBindingTicket.ts')||file.endsWith('bitmapBindingTicket.d.ts'))for(const name of bbtbTypes){
   const count=tokens.filter((q,i)=>q.value==='export'&&['interface','type'].includes(tokens[i+1]?.value)&&tokens[i+2]?.value===name).length;
   if(count!==1)bbtbFail('BBT_BOUNDARY_CANONICAL_TYPES','One original erased declaration required: '+name);
  }
 }
 for(const pin of policy.packages){const pkg=JSON.parse(read(pin.path));if(/bitmapBindingTicket/.test(JSON.stringify({exports:pkg.exports,imports:pkg.imports})))bbtbFail('BBT_BOUNDARY_PRIVATE_EXPORT','Private assembly became package entry');pinCheck(pin,'BBT_BOUNDARY_PACKAGE_DAG');}
 for(const pin of policy.configurations)pinCheck(pin,'BBT_BOUNDARY_CONFIGURATION_DAG');
 for(const pin of policy.stableEntries)pinCheck(m13InterfacePin(pin),'BBT_BOUNDARY_DEFAULT_ENTRY_IDENTITY');
 for(const pin of policy.workspacePins)pinCheck(pin,'BBT_BOUNDARY_PACKAGE_DAG');
 // The new leaf is reached through the ordinary Engine; it is never an optional GFX exception.
 for(const file of ['packages/engine/src/Engine.ts','packages/engine/dist/Engine.js','packages/engine/dist/Engine.d.ts']){
  const tokens=bbtbTokens(read(file).toString('utf8'),file);
  const incoming=tokens.filter((token,index)=>token.kind==='string'&&token.value===policy.coreClosureMembership.engineImport&&tokens[index-1]?.value==='from');
  const expectedIncoming=file==='packages/engine/src/Engine.ts'?2:1;
  if(incoming.length!==expectedIncoming)bbtbFail('BBT_BOUNDARY_CORE_CLOSURE','Exact ordinary Engine-to-core value/type edges required: '+file);
 }
 for(const pin of m12SelectedProductPins()){const current=m13InterfaceSelected()?m13InterfaceRawSuccessor.find(row=>row.path===pin.path):undefined;pinCheck(current??pin,'BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY');}
 m13InterfaceComplete();
 // Complete raw readback catches source drift during this bounded inspection.
 for(const [file,pin] of seen){const now=fingerprintFile(root,file);if(!equal(now,pin))bbtbFail('BBT_BOUNDARY_SOURCE_DRIFT',file);}
 console.log('BBT_BOUNDARY_PASS '+JSON.stringify({scope:'finite source/emission policy only',method:'Engine.captureBitmapBindings',erasedTypes:bbtbTypes,defaultRuntimeValues:policy.rootValues.length+(m13InterfaceSelected()?4:0),readFiles:seen.size,productExecution:false}));
}
try{run();}catch(error){const code=typeof error?.code==='string'&&error.code.startsWith('BBT_BOUNDARY_')?error.code:'BBT_BOUNDARY_SETUP';process.stderr.write(code+': '+String(error?.message??error)+'\n');process.exitCode=1;}
