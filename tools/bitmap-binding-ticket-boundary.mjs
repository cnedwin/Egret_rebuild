// SPDX-License-Identifier: Apache-2.0
// Source/emission policy only. Lexer/named-export parser adapted from the
// first-party SequencePlayback policy; no product module is imported/evaluated.
import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
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
function pinCheck(pin,code){const raw=read(pin.path);if(raw.length!==pin.bytes||hash(raw)!==pin.sha256)bbtbFail(code,'Changed complete source identity: '+pin.path);}
const policyPin={"path":"tools/bitmap-binding-ticket-policy.json","bytes":17818,"sha256":"922ced53d05167171ad12d1d4d71cb1b5685674df5050e2445f5d41812fd0b05"};
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
function run(){
 if(policy.schemaVersion!==1||policy.kind!=='BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY'||!equal(bbtbTypes,['BitmapBindingTicket']))bbtbFail('BBT_BOUNDARY_POLICY_IDENTITY','Exact finite policy schema required');
 // Assigned exposure rules run before generic pinned-identity refusals.
 for(const entry of policy.entries)for(const file of [entry.source,entry.js,entry.declaration])authority(bbtbTokens(read(file).toString('utf8'),file),file,entry.package==='engine'&&entry.entry==='.');
 for(const file of ['packages/engine/src/index.ts','packages/engine/dist/index.d.ts','packages/engine/dist/index.js']){
  const exports=bbtbNamed(read(file).toString('utf8'),file),values=exports.filter(q=>!q.typeOnly).map(q=>q.exposed).sort();
  if(new Set(values).size!==values.length||!equal(values,policy.rootValues))bbtbFail('BBT_BOUNDARY_ROOT_VALUES','Default runtime namespace changed');
  const selected=exports.filter(q=>q.from==='./bitmapBindingTicket.js'),expected=file.endsWith('index.js')?[]:bbtbTypes;
  if(selected.some(q=>!q.typeOnly||q.local!==q.exposed)||!equal(selected.map(q=>q.exposed).sort(),expected))bbtbFail('BBT_BOUNDARY_ROOT_TYPES','Exactly one canonical erased name required');
 }
 for(const q of policy.oldRootPins){const raw=read(q.path);inversePin(q.path,q.path.endsWith('/index.js')?raw:removeRootTypes(raw,q.path),q,'BBT_BOUNDARY_ROOT_INTERFACE_IDENTITY');}
 const dts='packages/engine/dist/Engine.d.ts';inversePin(dts,oldEngineDeclaration(read(dts)),policy.oldEngineDeclarationPin,'BBT_BOUNDARY_ENGINE_PUBLIC_DECLARATION');
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
 for(const pin of policy.stableEntries)pinCheck(pin,'BBT_BOUNDARY_DEFAULT_ENTRY_IDENTITY');
 for(const pin of policy.workspacePins)pinCheck(pin,'BBT_BOUNDARY_PACKAGE_DAG');
 // The new leaf is reached through the ordinary Engine; it is never an optional GFX exception.
 for(const file of ['packages/engine/src/Engine.ts','packages/engine/dist/Engine.js','packages/engine/dist/Engine.d.ts']){
  const tokens=bbtbTokens(read(file).toString('utf8'),file);
  const incoming=tokens.filter((token,index)=>token.kind==='string'&&token.value===policy.coreClosureMembership.engineImport&&tokens[index-1]?.value==='from');
  const expectedIncoming=file==='packages/engine/src/Engine.ts'?2:1;
  if(incoming.length!==expectedIncoming)bbtbFail('BBT_BOUNDARY_CORE_CLOSURE','Exact ordinary Engine-to-core value/type edges required: '+file);
 }
 for(const pin of policy.selectedProductPins)pinCheck(pin,'BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY');
 // Complete raw readback catches source drift during this bounded inspection.
 for(const [file,pin] of seen){const now=fingerprintFile(root,file);if(!equal(now,pin))bbtbFail('BBT_BOUNDARY_SOURCE_DRIFT',file);}
 console.log('BBT_BOUNDARY_PASS '+JSON.stringify({scope:'finite source/emission policy only',method:'Engine.captureBitmapBindings',erasedTypes:bbtbTypes,unchangedDefaultRuntimeValues:policy.rootValues.length,readFiles:seen.size,productExecution:false}));
}
try{run();}catch(error){const code=typeof error?.code==='string'&&error.code.startsWith('BBT_BOUNDARY_')?error.code:'BBT_BOUNDARY_SETUP';process.stderr.write(code+': '+String(error?.message??error)+'\n');process.exitCode=1;}
