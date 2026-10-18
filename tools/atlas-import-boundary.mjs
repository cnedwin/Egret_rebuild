// SPDX-License-Identifier: Apache-2.0
// Source/emission/declaration inspection only; no product evaluation or writes.
import {readFileSync, readdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fingerprintFile, samePhysicalPath} from './lib/file-identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const inventoryPin = {"path":"tests/types/atlas-import-diagnostic-expectations.json","bytes":254943,"sha256":"3d59e24a78708bd0d85f06d6124bced00d5687afcc494d1e919dce1fc9a985c6"};
// One reviewed M1.1 group: all eleven raw identities must match before graph derivation.
const m11WarmSubmissionGraphSuccessor = [{"path":"packages/engine/web/WebGPUHost.ts","bytes":102838,"sha256":"bf33f8aa63f14103ff947f79f77527a28dfd0cf15468cc84abda6c8cd15007e0"},{"path":"packages/engine/dist/web/WebGPUHost.js","bytes":96436,"sha256":"f6f1727bdd06903f66dcb5918476c0c0c9d5d5f93cf9acb714c4d6e5b7cc3615"},{"path":"packages/engine/web/prepareTexturedSubmission2D.ts","bytes":17192,"sha256":"71dd8092df666f38ab7fa214ea9ec34fa2eaf13b5cf4cc039326308767fb9820"},{"path":"packages/engine/dist/web/prepareTexturedSubmission2D.js","bytes":11567,"sha256":"3bde4c2c3eb9570eedb6d6519776425224f6e35a52fb21ec5664448451fff485"},{"path":"packages/engine/dist/web/prepareTexturedSubmission2D.d.ts","bytes":6946,"sha256":"df22e84d752cfc96083920bf5ea01edd28947056c0c007d8023c0e53bb1fd5ee"},{"path":"packages/engine/web/webgpuBufferPool.ts","bytes":18097,"sha256":"a96a3f4655b178a814d3988ab6886255bb34b9613ba84b885854df4c53840957"},{"path":"packages/engine/dist/web/webgpuBufferPool.js","bytes":14951,"sha256":"8692118b05b645d50c15f68a77ecca7b839165f2653f980c4dfbe1ec937caef1"},{"path":"packages/engine/dist/web/webgpuBufferPool.d.ts","bytes":2052,"sha256":"54ffe7bd4fd62fca0ecec2f250fd8cd2dfbfbcfe3724df3ddf8f341c95dcfb27"},{"path":"packages/engine/web/webgpuBindingCache.ts","bytes":9982,"sha256":"22bc0399ce8c9401e103746c7aa24cac073204c852cc2cd3bc27bf8be7513b81"},{"path":"packages/engine/dist/web/webgpuBindingCache.js","bytes":8374,"sha256":"74bcda1b46f7ec63e46cb9a412c97ee353763d21e1375053663567ebdcfabea3"},{"path":"packages/engine/dist/web/webgpuBindingCache.d.ts","bytes":1018,"sha256":"6f7476892b229d2f478736cdb0b5a6c2640e462807d209d990665444ba856397"}];
const m11WarmSubmissionReplacementPaths = ["packages/engine/web/WebGPUHost.ts","packages/engine/dist/web/WebGPUHost.js","packages/engine/web/prepareTexturedSubmission2D.ts","packages/engine/dist/web/prepareTexturedSubmission2D.js","packages/engine/dist/web/prepareTexturedSubmission2D.d.ts"];
const m11WarmSubmissionAdditionPaths = ["packages/engine/web/webgpuBufferPool.ts","packages/engine/dist/web/webgpuBufferPool.js","packages/engine/dist/web/webgpuBufferPool.d.ts","packages/engine/web/webgpuBindingCache.ts","packages/engine/dist/web/webgpuBindingCache.js","packages/engine/dist/web/webgpuBindingCache.d.ts"];

// One reviewed M1.2 group; predecessor and current identities are independently fixed.
const m12IncrementalRenderingGraphSuccessor = [{"path":"packages/engine/dist/rendering/packImageVertices2D.d.ts","bytes":979,"sha256":"88e199327b1722ae6df6c109b36a8a377317fe84234efd196364fdd1aa8a771e"},{"path":"packages/engine/dist/rendering/packImageVertices2D.js","bytes":3851,"sha256":"d133289551bc3514cc3c5a42661abd32377371f480669bb13547fe7df9b0f30f"},{"path":"packages/engine/dist/rendering/packTexturedMesh2D.d.ts","bytes":1210,"sha256":"c9e90371fa9e16f4ec48d88919d72e763e89adb5ac65e2a13067a49271522026"},{"path":"packages/engine/dist/rendering/packTexturedMesh2D.js","bytes":5253,"sha256":"2b2812f97af50299451c2205dbe9acbdf169bb846dc41b4b964dc081039f8733"},{"path":"packages/engine/dist/rendering/preparedBatches2D.d.ts","bytes":2268,"sha256":"a590dcb24cd7693c346814415015673d5390fb80b9e2682ced83ee1db267ebbd"},{"path":"packages/engine/dist/rendering/preparedBatches2D.js","bytes":8234,"sha256":"6f2ef1c01d8bef89ae3bc604ed961807532faf83010aee363edec6f8da5c5d48"},{"path":"packages/engine/dist/rendering/preparedFrameCache2D.d.ts","bytes":3743,"sha256":"9e99802c3ad27c331e4721f046c23285cdc33d8e4978ee3ff08943d01126237c"},{"path":"packages/engine/dist/rendering/preparedFrameCache2D.js","bytes":19934,"sha256":"5e969f7d89fff8a9e7b5cb54daac0c027441c498890dee00d63d3ccc5d57f8e2"},{"path":"packages/engine/dist/rendering/prepareImages2D.d.ts","bytes":1095,"sha256":"806fb96d390dae384584fc4be97e8af17981ccaf03fdead011e2c7431234e55f"},{"path":"packages/engine/dist/rendering/prepareImages2D.js","bytes":4494,"sha256":"6dd60d19ca7e3da67baa42f31ebbbd88f2b3555e041092ae29c54fe5f8a00809"},{"path":"packages/engine/dist/rendering/prepareMixedDraws2D.d.ts","bytes":1013,"sha256":"50d869965cf6f4899f3279799097bf89d90a7b9835b842aeca3c855271fbabdd"},{"path":"packages/engine/dist/rendering/prepareMixedDraws2D.js","bytes":3234,"sha256":"b5925f98de56982a203a22529a45aa72604e18cb4083ce5e261a185594dc6feb"},{"path":"packages/engine/dist/rendering/prepareRectangles2D.d.ts","bytes":3713,"sha256":"e1a03ecb50d41616e91451a7afa6ec9fbe48555eb1ae716c619f4239fc1f1e13"},{"path":"packages/engine/dist/rendering/prepareRectangles2D.js","bytes":11969,"sha256":"c937d387f44241ce6d9d5c6f7fe28ce6e9fcf29e1dfdf0ad65197667aff11fd9"},{"path":"packages/engine/dist/rendering/prepareTexturedDraws2D.d.ts","bytes":1967,"sha256":"1e0c90ba08a98dc92503bf71c6a906511ed0b2c27c6becc846c0415f36c39c44"},{"path":"packages/engine/dist/rendering/prepareTexturedDraws2D.js","bytes":2645,"sha256":"313d56811af0cccba4b7708b4eac3ea58f2fb8f42f71b2c17e652edaa6cf0e91"},{"path":"packages/engine/dist/rendering/prepareTexturedMesh2D.d.ts","bytes":1531,"sha256":"3d8e975259fa2268433a24b1fc60d7ab2861a16c701ce63d6f4206b6a4eee3ac"},{"path":"packages/engine/dist/rendering/prepareTexturedMesh2D.js","bytes":7492,"sha256":"f7f1bde2bd2fadffc4acc7d9c4e2b779c76f5673023fa4e72c04e59d944a6cfe"},{"path":"packages/engine/dist/rendering/texturedPreparationBudget2D.d.ts","bytes":2018,"sha256":"6ead5fca179354c02d03c0de0205db66a77ced94c136dbf42bc9a0318b4d7f06"},{"path":"packages/engine/dist/rendering/texturedPreparationBudget2D.js","bytes":5977,"sha256":"eeb48a6701001b53159567a87a43bafbe1300810dc3ceee176a6b9e6c4090e9f"},{"path":"packages/engine/dist/web/prepareTexturedSubmission2D.d.ts","bytes":6637,"sha256":"c49e81808feb5213056cf9649369c7fbdb0df5e724f231d1d6c54be188a6578b"},{"path":"packages/engine/dist/web/prepareTexturedSubmission2D.js","bytes":12690,"sha256":"14c5baa8c8ac5bcb970173cea5e8094dd0ad3a5f4aa8b9650b252562d4a12434"},{"path":"packages/engine/dist/web/WebGPUHost.js","bytes":98119,"sha256":"f080cf28350c60f8453082e2ce58cab8bc1f1fcef6c3538fced4cda74ed90f89"},{"path":"packages/engine/dist/web/webgpuPass.d.ts","bytes":1514,"sha256":"22349987139c1ad714d09adfbd3e4de5a9111795bde3bdcae53aebf2d494f52c"},{"path":"packages/engine/dist/web/webgpuPass.js","bytes":6136,"sha256":"07d77f142cc280b34eb85b7c0ab5c6f9f21b92e1be1696a6572436959f527bd2"},{"path":"packages/engine/rendering/packImageVertices2D.ts","bytes":4202,"sha256":"e5efb8a5f049df54d051ac120b6d06276c0f40eb594de702a4c5a8465d13589e"},{"path":"packages/engine/rendering/packTexturedMesh2D.ts","bytes":5823,"sha256":"c269a04212d0726856a0a44d5fc7770462424866510cf23add51a9c3537a04fa"},{"path":"packages/engine/rendering/preparedBatches2D.ts","bytes":9833,"sha256":"14b0cc8ceab32e26c95031a3f649ca0b90c5ae1cfd99ef6ab8f74c3d76605dd3"},{"path":"packages/engine/rendering/preparedFrameCache2D.ts","bytes":23026,"sha256":"71ec1dd9142224468e6c7dece8bf83f29a884731056fa8df3fc44fd47cdb48cf"},{"path":"packages/engine/rendering/prepareImages2D.ts","bytes":5476,"sha256":"eaa9d3f8f45b4610a663d84624be04abaf7a6ecc0d8b4d3b2ce4b6c63a9217bb"},{"path":"packages/engine/rendering/prepareMixedDraws2D.ts","bytes":4042,"sha256":"d997d0a8bee6d93e733bf5f1255477d5ec72c7a4913c2acd708a02f6ba4e894b"},{"path":"packages/engine/rendering/prepareRectangles2D.ts","bytes":14130,"sha256":"40c78f2e7718f70bc1ce1db2703a45de9cc96a55783e9433687b3fc89d4277e6"},{"path":"packages/engine/rendering/prepareTexturedDraws2D.ts","bytes":4307,"sha256":"45207191bd5ef863fbc9be1299eece9c469deec35d1aa22e16eb64417ca1dcaa"},{"path":"packages/engine/rendering/prepareTexturedMesh2D.ts","bytes":8590,"sha256":"0f6e3a5a7a3c51b80b4ce7d6567ea8d0d9d3debe24e9ad588273dfb6d991206b"},{"path":"packages/engine/rendering/texturedPreparationBudget2D.ts","bytes":7614,"sha256":"135e8fd5a5b8d58b34ec096094d6e2aac36380844d4640a99ff116c043f83b51"},{"path":"packages/engine/web/prepareTexturedSubmission2D.ts","bytes":18051,"sha256":"9577236996a3bbeda38b3f90bbb73246b868d15dbb136f126ce60973fc4672e7"},{"path":"packages/engine/web/WebGPUHost.ts","bytes":104705,"sha256":"e9d172d17cc9f45109dae7b7038485d63d2c8e572efd88fb74af918812045d1d"},{"path":"packages/engine/web/webgpuPass.ts","bytes":6806,"sha256":"765818e5e8ef98ec09741ebfb35f4c5a65a16c7b05229341aa67e54da575e7b7"},{"path":"packages/runtime/dist/bitmapDisplayState.js","bytes":1066,"sha256":"fd50bff484322b93d54755698a1928edd46526a1f8a57816928499fc36b9bd73"},{"path":"packages/runtime/dist/DisplayObject.js","bytes":6542,"sha256":"18a1bddd2577dac39aedfec3af3851b85b528f92b34ed5196d8856674bf42f84"},{"path":"packages/runtime/dist/displayTreeState.js","bytes":15727,"sha256":"e0f8ab70550bfc4a879c29b475f2374bf342d831c643ee18cef8744fec1c79aa"},{"path":"packages/runtime/dist/displayVisualState.d.ts","bytes":1996,"sha256":"5ea66cd3ea03069dd0b7219537ac2d87193afcc08a362792efe97634e2fb6a95"},{"path":"packages/runtime/dist/displayVisualState.js","bytes":3990,"sha256":"e7cc93bffb098faa3778731a72f10b7d52975fb51ec66832f7998dbff123e395"},{"path":"packages/runtime/dist/frameCapture.js","bytes":7619,"sha256":"2194b12582a5395fe2ab63c475aa5de440e47bbae0a92954159d3c6f14385117"},{"path":"packages/runtime/dist/frameCaptureCache.d.ts","bytes":4967,"sha256":"e8038fbd5d20eb58b19505b9d7890d02345357d8b630db69b5565ea0c4ce482d"},{"path":"packages/runtime/dist/frameCaptureCache.js","bytes":15981,"sha256":"b041688739321426600fb1ad1a2dfd005ebcdca93d3e5beb90d2dab8219757f0"},{"path":"packages/runtime/dist/Graphics.js","bytes":1448,"sha256":"c4637f250e7059ca46a313898d5afbbf283b2a164cbcabb9b3fd729fd69afeff"},{"path":"packages/runtime/dist/meshDisplayState.js","bytes":978,"sha256":"867eeb0aed95cb6d28fafe3ab02560acaf428086c89df0d61da9313b2a63ef55"},{"path":"packages/runtime/dist/ownership.js","bytes":6711,"sha256":"a26b1fcd8232dc000ed45fc522784668cb5c69b35d187cea21419cf6b3da7b52"},{"path":"packages/runtime/dist/textDisplayState.js","bytes":1185,"sha256":"b61cab464a2c46a9bda0cec4d6dea3561c2588d675eef2bb8b80dab4bd332156"},{"path":"packages/runtime/dist/texturedFrameCapture.js","bytes":13146,"sha256":"c670a6486dcab922151cc05272fb413d83922ad373ac7c0844580015a1dbd6cf"},{"path":"packages/runtime/src/bitmapDisplayState.ts","bytes":1658,"sha256":"11962f2c5a6aa9abb9a9f8030e1ad5a88f37b2b851036b70e0fe355d6323ee85"},{"path":"packages/runtime/src/DisplayObject.ts","bytes":7011,"sha256":"3cb67df2b19e006674e60bb60c990198005d3e1446c85a9f78e62a6fc44a6817"},{"path":"packages/runtime/src/displayTreeState.ts","bytes":18261,"sha256":"f3d0dd262d872f52fc8235b1df876cb54af6c0718bc0116525f64804b1a06f32"},{"path":"packages/runtime/src/displayVisualState.ts","bytes":4865,"sha256":"33905e9f50f3e075a985142ada29bff10d0f697ee07402d98a089899649177ad"},{"path":"packages/runtime/src/frameCapture.ts","bytes":7746,"sha256":"bda7148fd439d64ecaa9f99363413d7f34d2325b069b1b0671c53673e9a1dff3"},{"path":"packages/runtime/src/frameCaptureCache.ts","bytes":18988,"sha256":"575c0e5881631b7e438eea59ace23eec1e70e5e554f38980ccb268f8f5eefd31"},{"path":"packages/runtime/src/Graphics.ts","bytes":1488,"sha256":"40ad187b36eed1b2ba111c7672550139c7308ac720f43361d55ad9c13c3ac7ff"},{"path":"packages/runtime/src/meshDisplayState.ts","bytes":1473,"sha256":"3a87f0e93fd78164272b753c7db377ef949cb2fea732b428cc1a326cebc58836"},{"path":"packages/runtime/src/ownership.ts","bytes":9594,"sha256":"0b3bdfbba67ba6e9e30a31b7384c3379fc3fb0352b7be8e7425956372bfbbbfd"},{"path":"packages/runtime/src/textDisplayState.ts","bytes":1788,"sha256":"f9ec119609eb6d9c607a8f8c7f348326d2f41e7990843c4a075ef3d4b3313405"},{"path":"packages/runtime/src/texturedFrameCapture.ts","bytes":13836,"sha256":"45f3e21b3e1490d64ee8a380224bd8d98f05bb1f61b27772852fe9eaab37c09a"}];
const m12IncrementalRenderingReplacementPaths = ["packages/engine/dist/rendering/packImageVertices2D.d.ts","packages/engine/dist/rendering/packImageVertices2D.js","packages/engine/dist/rendering/packTexturedMesh2D.d.ts","packages/engine/dist/rendering/packTexturedMesh2D.js","packages/engine/dist/rendering/prepareImages2D.d.ts","packages/engine/dist/rendering/prepareImages2D.js","packages/engine/dist/rendering/prepareMixedDraws2D.d.ts","packages/engine/dist/rendering/prepareMixedDraws2D.js","packages/engine/dist/rendering/prepareRectangles2D.d.ts","packages/engine/dist/rendering/prepareRectangles2D.js","packages/engine/dist/rendering/prepareTexturedDraws2D.d.ts","packages/engine/dist/rendering/prepareTexturedDraws2D.js","packages/engine/dist/rendering/prepareTexturedMesh2D.d.ts","packages/engine/dist/rendering/prepareTexturedMesh2D.js","packages/engine/dist/rendering/texturedPreparationBudget2D.d.ts","packages/engine/dist/rendering/texturedPreparationBudget2D.js","packages/engine/dist/web/prepareTexturedSubmission2D.d.ts","packages/engine/dist/web/prepareTexturedSubmission2D.js","packages/engine/dist/web/WebGPUHost.js","packages/engine/dist/web/webgpuPass.d.ts","packages/engine/dist/web/webgpuPass.js","packages/engine/rendering/packImageVertices2D.ts","packages/engine/rendering/packTexturedMesh2D.ts","packages/engine/rendering/prepareImages2D.ts","packages/engine/rendering/prepareMixedDraws2D.ts","packages/engine/rendering/prepareRectangles2D.ts","packages/engine/rendering/prepareTexturedDraws2D.ts","packages/engine/rendering/prepareTexturedMesh2D.ts","packages/engine/rendering/texturedPreparationBudget2D.ts","packages/engine/web/prepareTexturedSubmission2D.ts","packages/engine/web/WebGPUHost.ts","packages/engine/web/webgpuPass.ts","packages/runtime/dist/bitmapDisplayState.js","packages/runtime/dist/DisplayObject.js","packages/runtime/dist/displayTreeState.js","packages/runtime/dist/displayVisualState.d.ts","packages/runtime/dist/displayVisualState.js","packages/runtime/dist/frameCapture.js","packages/runtime/dist/Graphics.js","packages/runtime/dist/meshDisplayState.js","packages/runtime/dist/ownership.js","packages/runtime/dist/textDisplayState.js","packages/runtime/dist/texturedFrameCapture.js","packages/runtime/src/bitmapDisplayState.ts","packages/runtime/src/DisplayObject.ts","packages/runtime/src/displayTreeState.ts","packages/runtime/src/displayVisualState.ts","packages/runtime/src/frameCapture.ts","packages/runtime/src/Graphics.ts","packages/runtime/src/meshDisplayState.ts","packages/runtime/src/ownership.ts","packages/runtime/src/textDisplayState.ts","packages/runtime/src/texturedFrameCapture.ts"];
const m12IncrementalRenderingAdditionPaths = ["packages/engine/dist/rendering/preparedBatches2D.d.ts","packages/engine/dist/rendering/preparedBatches2D.js","packages/engine/dist/rendering/preparedFrameCache2D.d.ts","packages/engine/dist/rendering/preparedFrameCache2D.js","packages/engine/rendering/preparedBatches2D.ts","packages/engine/rendering/preparedFrameCache2D.ts","packages/runtime/dist/frameCaptureCache.d.ts","packages/runtime/dist/frameCaptureCache.js","packages/runtime/src/frameCaptureCache.ts"];
const m12IncrementalRenderingPredecessor = {"members":536,"sha256":"c32f29042b44f72b1ad16fdebe210f524ad09540228fc73677b0e961f58c3ed9"};

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

function m12IncrementalRenderingGraph(base, actualNames) {
  const present = new Set(actualNames);
  if (!m12IncrementalRenderingAdditionPaths.some(file => present.has(file))) return undefined;
  const oldRows = m11WarmSubmissionGraphSuccessor, oldReplacements = m11WarmSubmissionReplacementPaths, oldAdditions = m11WarmSubmissionAdditionPaths;
  const basePaths = new Set(base.map(row => row.path)), oldPaths = [...oldReplacements, ...oldAdditions];
  if (oldRows.length !== 11 || new Set(oldPaths).size !== 11
      || !same(oldRows.map(row => row.path).sort(), [...oldPaths].sort())
      || oldRows.some(row => !same(Object.keys(row).sort(), ['bytes', 'path', 'sha256']) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || !/^[a-f0-9]{64}$/.test(row.sha256))
      || oldReplacements.some(file => !basePaths.has(file)) || oldAdditions.some(file => basePaths.has(file))) {
    refuse('ATLAS_SOURCE_IDENTITY', 'Invalid finite M1.1 predecessor declaration');
  }
  const old = new Map(oldRows.map(row => [row.path, row]));
  const predecessor = [...base.map(row => old.get(row.path) ?? row), ...oldAdditions.map(file => old.get(file))];
  // JSON of path-sorted complete [path, bytes, sha256] tuples, without a newline.
  const serialized = JSON.stringify([...predecessor].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(row => [row.path, row.bytes, row.sha256]));
  if (predecessor.length !== m12IncrementalRenderingPredecessor.members || createHash('sha256').update(serialized).digest('hex') !== m12IncrementalRenderingPredecessor.sha256) {
    refuse('ATLAS_SOURCE_IDENTITY', 'M1.1 predecessor digest differs');
  }
  const rows = m12IncrementalRenderingGraphSuccessor, replacements = m12IncrementalRenderingReplacementPaths, additions = m12IncrementalRenderingAdditionPaths;
  const expectedPaths = [...replacements, ...additions], predecessorPaths = new Set(predecessor.map(row => row.path));
  if (rows.length !== 62 || replacements.length !== 53 || additions.length !== 9 || new Set(expectedPaths).size !== 62
      || !same(rows.map(row => row.path).sort(), [...expectedPaths].sort())
      || rows.some(row => !same(Object.keys(row).sort(), ['bytes', 'path', 'sha256']) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || !/^[a-f0-9]{64}$/.test(row.sha256))
      || replacements.some(file => !predecessorPaths.has(file)) || additions.some(file => predecessorPaths.has(file))) {
    refuse('ATLAS_SOURCE_IDENTITY', 'Invalid finite M1.2 successor declaration');
  }
  for (const row of rows) {
    if (!present.has(row.path)) { refuse('ATLAS_SOURCE_FILES', 'Incomplete M1.2 successor: ' + row.path); }
    checkPin(row, 'ATLAS_SOURCE_IDENTITY');
  }
  const reviewed = new Map(rows.map(row => [row.path, row]));
  const graph = [...predecessor.map(row => reviewed.get(row.path) ?? row), ...additions.map(file => reviewed.get(file))];
  return graph;
}

function m11WarmSubmissionGraph(base, actualNames) {
  const rows=m11WarmSubmissionGraphSuccessor, replacements=m11WarmSubmissionReplacementPaths, additions=m11WarmSubmissionAdditionPaths;
  const expectedPaths=[...replacements,...additions], present=new Set(actualNames), basePaths=new Set(base.map(row=>row.path));
  if (rows.length!==11 || !same(rows.map(row=>row.path).sort(),[...expectedPaths].sort())
      || rows.some(row=>!same(Object.keys(row).sort(),['bytes','path','sha256']) || !Number.isSafeInteger(row.bytes) || row.bytes<0 || !/^[a-f0-9]{64}$/.test(row.sha256))
      || replacements.some(file=>!basePaths.has(file)) || additions.some(file=>basePaths.has(file))) refuse('ATLAS_SOURCE_IDENTITY','Invalid finite M1.1 successor declaration');
  if (!additions.some(file=>present.has(file))) return undefined;
  for (const row of rows) {
    if (!present.has(row.path)) refuse('ATLAS_SOURCE_FILES','Incomplete M1.1 successor: '+row.path);
    checkPin(row,'ATLAS_SOURCE_IDENTITY');
  }
  const reviewed=new Map(rows.map(row=>[row.path,row]));
  return [...base.map(row=>reviewed.get(row.path)??row),...additions.map(file=>reviewed.get(file))];
}

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
  const actualNames=modulePaths('packages');
  const effectiveModules=m12IncrementalRenderingGraph(policy.modules,actualNames)??m11WarmSubmissionGraph(policy.modules,actualNames)??policy.modules;
  if (!same(actualNames.sort(),effectiveModules.map(p=>p.path).sort())) refuse('ATLAS_SOURCE_FILES','product source/emission/declaration inventory changed');
  // Semantic policy guards above identify the assigned route refusals. Identity
  // checks then retain Spine, geometry, Host and every accepted product module.
  for (const pin of [...effectiveModules,...policy.configurationPins,...policy.jsoncPins]) checkPin(pin,'ATLAS_SOURCE_IDENTITY');
  console.log('Atlas import Source boundary PASS: '+effectiveModules.length+' exact source/emission/declaration files; two optional values, sixteen erased types, four local built aliases. No product or browser execution.');
}
if (process.argv[1] && samePhysicalPath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url), process.platform)) {
  if (process.argv.length!==2) refuse('ATLAS_SOURCE_ARGUMENTS','direct CLI accepts no arguments');
  runAtlasImportBoundary();
}
