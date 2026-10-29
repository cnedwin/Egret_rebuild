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
// Only the two reviewed optional GL entries extend this exact historical package.
// Reconstruct its full predecessor; unrelated fields and routes remain byte-bound.
// Exact M1.5 package successors; all retained package tuples/inverses remain below.
const m15ResourcePackageSuccessors = [{"base":{"path":"packages/contracts/package.json","bytes":179,"sha256":"fceaef2ae55a77347ce9f99acd2165d36e991d89c76bf0480ff5048f3e7a94a1"},"current":{"path":"packages/contracts/package.json","bytes":319,"sha256":"f40591968003b235cddf38a576c1250a28ef965726750d377f0691a8e6f48e9e"}},{"base":{"path":"packages/engine/package.json","bytes":1567,"sha256":"e01d48a51c0845783afeec93ffcc7674c7980797cd6a9c58cc74ec3f13d2e0c5"},"current":{"path":"packages/engine/package.json","bytes":2167,"sha256":"be2a5a1e13136e99111ebc0fdfa657e4067fbba79647eeb93431395210516143"}},{"base":{"path":"packages/project/package.json","bytes":397,"sha256":"295e6bc8d81a4647f5b99355ea27879563ced216fa2af406c65cc78b95f40945"},"current":{"path":"packages/project/package.json","bytes":621,"sha256":"e6ec9743041ee5489297861ad5ed810021875dae7c041011a0f6d4e754eb6462"}}];
const m15ResourceAtlasPackageSuccessor = [{"base":{"path":"packages/project/package.json","bytes":503,"sha256":"4b4380142316c6ab2f0727eab44c80eff2a21640c701871c6ace3a0ab1b276af"},"current":{"path":"packages/project/package.json","bytes":621,"sha256":"e6ec9743041ee5489297861ad5ed810021875dae7c041011a0f6d4e754eb6462"}}];
// M3-POINTER-PACKAGE-BEGIN
// Two exact current packages invert to their retained predecessors; no old row changes.
const m3PointerPackageSuccessors = [{"base":{"path":"packages/engine/package.json","bytes":2167,"sha256":"be2a5a1e13136e99111ebc0fdfa657e4067fbba79647eeb93431395210516143"},"current":{"path":"packages/engine/package.json","bytes":2494,"sha256":"65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951"}},{"base":{"path":"packages/runtime/package.json","bytes":327,"sha256":"b9294c479d38614dd8866adcd8775f5d6f43c787d9b08c8ef54371e426cb5032"},"current":{"path":"packages/runtime/package.json","bytes":471,"sha256":"97b2d4678df4fd137b681a54511ce625935accfc3014da4800902f4a241c8db1"}}];
const m3RuntimePackagePredecessor = "{\n  \"name\": \"@egret/runtime\",\n  \"version\": \"0.0.0\",\n  \"private\": true,\n  \"type\": \"module\",\n  \"exports\": {\n    \".\": { \"types\": \"./dist/index.d.ts\", \"import\": \"./dist/index.js\" },\n    \"./text\": { \"types\": \"./dist/text/index.d.ts\", \"import\": \"./dist/text/index.js\" }\n  },\n  \"dependencies\": { \"@egret/contracts\": \"workspace:*\" }\n}\n";
function m3PointerPackageSuccessor(expected, raw) {
  const pair=m3PointerPackageSuccessors.find(row=>row.base.path===expected?.path);
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;
  const value=JSON.parse(raw.toString('utf8'));
  const remove=(key,mapping)=>{if(JSON.stringify(value.exports[key])!==JSON.stringify(mapping))return false;delete value.exports[key];return true;};
  let predecessor;
  if(expected.path==='packages/engine/package.json') {
    if(!remove('./input',{types:'./dist/input.d.ts',import:'./dist/input.js'})
      ||!remove('./web/pointer',{types:'./dist/web/pointer.d.ts',import:'./dist/web/pointer.js'})
      ||JSON.stringify(value.imports['#egret-pointer-input'])!==JSON.stringify({types:'./dist/pointerInput.d.ts',import:'./dist/pointerInput.js'}))return false;
    delete value.imports['#egret-pointer-input'];
    predecessor=Buffer.from(JSON.stringify(value,null,2)+String.fromCharCode(10));
  } else {
    if(!remove('./input',{types:'./dist/input/index.d.ts',import:'./dist/input/index.js'})
      ||JSON.stringify(value)!==JSON.stringify(JSON.parse(m3RuntimePackagePredecessor)))return false;
    predecessor=Buffer.from(m3RuntimePackagePredecessor);
  }
  if(predecessor.length!==pair.base.bytes||digest(predecessor)!==pair.base.sha256)return false;
  return expected.bytes===pair.base.bytes&&expected.sha256===pair.base.sha256
    ||m15ResourcePackageSuccessor(expected,predecessor);
}
// M3-POINTER-PACKAGE-END

// M22-SEQUENCE-SUCCESSOR-BEGIN
// Exact optional sequence profile; preceding source/package groups remain immutable.
const m22SequencePackagePairs = [{"base":{"path":"packages/engine/package.json","bytes":2591,"sha256":"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5"},"current":{"path":"packages/engine/package.json","bytes":2933,"sha256":"afcc7ed24ddd5e73f0ebed1f60b1c1b31d1bac59d2127e0b061c499cfe8e93fe"}},{"base":{"path":"packages/runtime/package.json","bytes":568,"sha256":"cb9822d5bbc457edf1256a98d2a7437ee8e13bc58caffe9914afdaa9345ef8c3"},"current":{"path":"packages/runtime/package.json","bytes":686,"sha256":"4d420a3f9896562972c959a1aeaeb5a7cb3e6e74e0fd47595a011f08665741c0"}}];
const m22SequenceSourcePairs = [{"base":{"path":"packages/engine/src/Engine.ts","bytes":25315,"sha256":"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d"},"current":{"path":"packages/engine/src/Engine.ts","bytes":27132,"sha256":"9fedacae6f7b73dfbcf9e947aa361e2a8f11d6d0fd3ca4dfd36ebc26c6be8a33"}},{"base":{"path":"packages/engine/dist/Engine.js","bytes":22046,"sha256":"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239"},"current":{"path":"packages/engine/dist/Engine.js","bytes":23756,"sha256":"83050b49d34c654f94e887d676419cb43fa4653dff4d2105f3ba9cfd5744a6b9"}},{"base":{"path":"packages/engine/src/sequencePlayback.ts","bytes":13644,"sha256":"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6"},"current":{"path":"packages/engine/src/sequencePlayback.ts","bytes":13879,"sha256":"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6"}},{"base":{"path":"packages/engine/dist/sequencePlayback.js","bytes":12959,"sha256":"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d"},"current":{"path":"packages/engine/dist/sequencePlayback.js","bytes":13139,"sha256":"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e"}},{"base":{"path":"packages/engine/dist/sequencePlayback.d.ts","bytes":819,"sha256":"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7"},"current":{"path":"packages/engine/dist/sequencePlayback.d.ts","bytes":933,"sha256":"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d"}},{"base":{"path":"packages/engine/src/resources.ts","bytes":325,"sha256":"db405ec5a4de624e74b1d0f05950d3527126c341b76b44bbc42ec49718e06d04"},"current":{"path":"packages/engine/src/resources.ts","bytes":511,"sha256":"90c1864d75bffd32a02c20319e32e8c156f030cd7ada4c729ca2c4fa0fe6256a"}},{"base":{"path":"packages/engine/dist/resources.js","bytes":231,"sha256":"6f0f57d9eaa19c6831d1085eee3cae26666fe67cd76774c0d9f901eeadc97562"},"current":{"path":"packages/engine/dist/resources.js","bytes":289,"sha256":"782db97f1c067225f74111696cd51bcc15db02929ae41b940b94d166be30bf31"}},{"base":{"path":"packages/engine/dist/resources.d.ts","bytes":325,"sha256":"65f26f39e5692313250696adebba1c17b5eb9f21ce07fe0c22080920775589c2"},"current":{"path":"packages/engine/dist/resources.d.ts","bytes":511,"sha256":"c44ea7667725102c0a57aac82d2e16fae9ae62b0fb36eeb4f4bcfc3ac9623844"}},{"base":{"path":"packages/engine/web/resources.ts","bytes":1909,"sha256":"beebdb71e9a1e03d7c18f6a8f649f451c50d5cccd1b2a89cb10ee99702eb6891"},"current":{"path":"packages/engine/web/resources.ts","bytes":5556,"sha256":"a562f3774e27b79a472d1940b9dca57940c63364a4695516488e94dfd1e1d0e2"}},{"base":{"path":"packages/engine/dist/web/resources.js","bytes":1386,"sha256":"2b40df1b56ee6a78f2aa7f19355e92c04d594afb80fbf0340266c77cd4d0305a"},"current":{"path":"packages/engine/dist/web/resources.js","bytes":4131,"sha256":"c4b6d4acbc38ee0653bf0cf7bbbeb6fe3c5fddae45d184ffb71d77d5591d13bf"}},{"base":{"path":"packages/engine/dist/web/resources.d.ts","bytes":810,"sha256":"f01106264b029449c8406a9481f11de449f5df512fa758ef197093ae183dc10e"},"current":{"path":"packages/engine/dist/web/resources.d.ts","bytes":1640,"sha256":"545df2b849dc8013afb105dc3b85e8fc3ec9656ece4d1eff11f185e5e30b1216"}},{"base":{"path":"packages/engine/src/internal/textFieldFactoryState.ts","bytes":1535,"sha256":"8602e59028681b31fa2156c1e725290f4eb8a782f5324b7c3c2b22e549279014"},"current":{"path":"packages/engine/src/internal/textFieldFactoryState.ts","bytes":1829,"sha256":"fbd5e1211ed000fde0397dff98de6c706ffbc8f2e18c48b3d1578361421e1624"}},{"base":{"path":"packages/engine/dist/internal/textFieldFactoryState.js","bytes":1108,"sha256":"fa69fb138980f01bfda9cf70214705a89f88de52435a8d59abe51a2e729c7568"},"current":{"path":"packages/engine/dist/internal/textFieldFactoryState.js","bytes":1209,"sha256":"320085d19f32fdf1957b356709b114897364d0bd48f10fbe4c57da6d0d06468e"}},{"base":{"path":"packages/engine/dist/internal/textFieldFactoryState.d.ts","bytes":699,"sha256":"83f64ae1033b24455c6548e98f291d51ea625135ac00708cac2bea6fd78ee2de"},"current":{"path":"packages/engine/dist/internal/textFieldFactoryState.d.ts","bytes":777,"sha256":"c26a508556e57c4669081aa370897194e66575dcee85cd56ab0fba1b85805da1"}},{"base":{"path":"packages/runtime/src/assetManagerOwnerState.ts","bytes":4195,"sha256":"876d4e019270abda5ac30b710ee2aeec6ebd71dc78a5c5b9d05231e04b5cef15"},"current":{"path":"packages/runtime/src/assetManagerOwnerState.ts","bytes":5440,"sha256":"d7bc393df5ae03a252e1803a788b42faa23f4debfa606f01f66c9c074a5cdb79"}},{"base":{"path":"packages/runtime/dist/assetManagerOwnerState.js","bytes":2888,"sha256":"9db66146430152ab5a0d07f704d9b27f5daa70834981ac33b5e9eb1194de563a"},"current":{"path":"packages/runtime/dist/assetManagerOwnerState.js","bytes":4102,"sha256":"864a608dccaf23b7df91758416c229dc7f19afce1529214893648a6d6827608e"}},{"base":{"path":"packages/runtime/dist/assetManagerOwnerState.d.ts","bytes":2182,"sha256":"e3aeb01ae81c8c318bd8e35e9c63691658833953d10351cfa817838fcfaae6bb"},"current":{"path":"packages/runtime/dist/assetManagerOwnerState.d.ts","bytes":2453,"sha256":"b5f503523de0c2601bcb7f799f703a6b8b94d0ef7628e57d1b087bc3b7719435"}},{"base":{"path":"packages/runtime/src/ownership.ts","bytes":9816,"sha256":"1510c8ae9fb345b9dbd39cf3fb820acd1937ec73729af1ccc87765948194fd18"},"current":{"path":"packages/runtime/src/ownership.ts","bytes":9855,"sha256":"cb3f8463303927329d88800578b3e7a3882eb27663bd478a4ec69a7ea8b38e71"}},{"base":{"path":"packages/runtime/dist/ownership.d.ts","bytes":4326,"sha256":"6a7bcbcd81f736a8952217b07909f455bb811fa41595ddeaa81100df115bd44e"},"current":{"path":"packages/runtime/dist/ownership.d.ts","bytes":4365,"sha256":"33121d6df9a0eba7db600b2607ba9deb1d244d5639f83e79a740d7259fe72c86"}},{"base":{"path":"packages/engine/src/ui/index.ts","bytes":409,"sha256":"9ca17e7bc2f991957971def9860c99918ead58399912e65a9780211890a3aa48"},"current":{"path":"packages/engine/src/ui/index.ts","bytes":446,"sha256":"6c2d2918abe6f4090a88fbed67950255ad987c48d2f3f0169cc2342a73357959"}},{"base":{"path":"packages/engine/dist/ui/index.d.ts","bytes":405,"sha256":"d688771a3fa804d3b23292aaaad656846dd70ea1c94fdc982d284733b794ce7c"},"current":{"path":"packages/engine/dist/ui/index.d.ts","bytes":442,"sha256":"a32ddd032f7bc5276665e37a318b44c177fadd21e1cf0fc01392f2110043b0ac"}},{"base":{"path":"packages/engine/src/ui/types.ts","bytes":6682,"sha256":"6e4134d6518f816f416a3a2cc7b2ce7baf11a220755a93fdec0e79ec6c1f4ec9"},"current":{"path":"packages/engine/src/ui/types.ts","bytes":7178,"sha256":"d9af4b4876a47f36547ece782a55b8aa86d3574663a83207ebdbb3658e4c58eb"}},{"base":{"path":"packages/engine/dist/ui/types.d.ts","bytes":6689,"sha256":"0f599f4f622a8339e92bfc45b1debb95ea905f12536d7cd594704d86aad78aa9"},"current":{"path":"packages/engine/dist/ui/types.d.ts","bytes":7185,"sha256":"09af413d3ea48c94478ca1e88eabb6112e330ac934624b0563efd894a160b51f"}},{"base":{"path":"packages/engine/src/ui/uiRoot.ts","bytes":49636,"sha256":"fc7e364ca14a63cfd21cb4688a77a15393fc51622cc8246f2803232702da098b"},"current":{"path":"packages/engine/src/ui/uiRoot.ts","bytes":56855,"sha256":"2996e1293e544771adbd62888b555a980dc1012ff947954772f6a85854a8df27"}},{"base":{"path":"packages/engine/dist/ui/uiRoot.js","bytes":44969,"sha256":"e48bffc5adb71cabf40e1ee44444f82a60a1e3f91c99e206b2d08671f13d8ac6"},"current":{"path":"packages/engine/dist/ui/uiRoot.js","bytes":51640,"sha256":"ce9105fd69411fd41580bd9b12ed845d6578f4bbe8c03a0592b4df1b387f682d"}}];
function m22SequencePackageSuccessor(expected,raw){
 const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');
 if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;
 const value=JSON.parse(raw.toString('utf8'));
 const entries=expected.path==='packages/runtime/package.json'
  ? [['./paragraph',{types:'./dist/paragraph/index.d.ts',import:'./dist/paragraph/index.js'}]]
  : [['./paragraph',{types:'./dist/paragraph.d.ts',import:'./dist/paragraph.js'}],['./web/paragraph',{types:'./dist/web/paragraph.d.ts',import:'./dist/web/paragraph.js'}],['./animation',{types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}]];
 for(const [name,mapping]of entries){if(JSON.stringify(value.exports[name])!==JSON.stringify(mapping))return false;delete value.exports[name];}
 const previous=Buffer.from(JSON.stringify(value,null,2)+'\n');
 if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;
 return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);
}
// M22-SEQUENCE-SUCCESSOR-END

// M31-UI-SUCCESSOR-BEGIN
// Exact current UI identities preserve all preceding package and source groups.
const m31UiPackagePairs = [{"base":{"path":"packages/engine/package.json","bytes":2494,"sha256":"65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951"},"current":{"path":"packages/engine/package.json","bytes":2591,"sha256":"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5"}},{"base":{"path":"packages/runtime/package.json","bytes":471,"sha256":"97b2d4678df4fd137b681a54511ce625935accfc3014da4800902f4a241c8db1"},"current":{"path":"packages/runtime/package.json","bytes":568,"sha256":"cb9822d5bbc457edf1256a98d2a7437ee8e13bc58caffe9914afdaa9345ef8c3"}}];
const m31UiSourcePairs = [{"base":{"path":"packages/engine/dist/Engine.js","bytes":21169,"sha256":"61e9613b37d886859d2f11ed23b889684b24a0aba39b4d8f324fb2d5a003f933"},"current":{"path":"packages/engine/dist/Engine.js","bytes":22046,"sha256":"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239"}},{"base":{"path":"packages/engine/src/Engine.ts","bytes":24333,"sha256":"ee2e61e0e038ae425e26bc9913da38b80cfe9117b782f0712c3ebeca51f92cfd"},"current":{"path":"packages/engine/src/Engine.ts","bytes":25315,"sha256":"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d"}}];
function m31UiPackageSuccessor(expected,raw){
 if(m22SequencePackageSuccessor(expected,raw))return true;
 const pair=m31UiPackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');
 if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;
 const value=JSON.parse(raw.toString('utf8'));
 if(JSON.stringify(value.exports['./ui'])!==JSON.stringify({types:'./dist/ui/index.d.ts',import:'./dist/ui/index.js'}))return false;
 delete value.exports['./ui'];const predecessor=Buffer.from(JSON.stringify(value,null,2)+'\n');
 if(predecessor.length!==pair.base.bytes||digest(predecessor)!==pair.base.sha256)return false;
 return JSON.stringify(expected)===JSON.stringify(pair.base)||m3PointerPackageSuccessor(expected,predecessor);
}
// M31-UI-SUCCESSOR-END

function m15ResourcePackageSuccessor(expected, raw) {
  const pair=[...m15ResourcePackageSuccessors,...m15ResourceAtlasPackageSuccessor].find(row=>row.base.path===expected?.path
    &&row.base.bytes===expected.bytes&&row.base.sha256===expected.sha256);
  if(!pair)return false;
  const bytes=Buffer.from(raw),digest=raw=>createHash('sha256').update(raw).digest('hex');
  if(bytes.length!==pair.current.bytes||digest(bytes)!==pair.current.sha256)return false;
  const value=JSON.parse(bytes.toString('utf8'));
  const remove=(key,mapping)=>{if(JSON.stringify(value.exports[key])!==JSON.stringify(mapping))return false;delete value.exports[key];return true;};
  const resourceIndex={types:'./dist/resources/index.d.ts',import:'./dist/resources/index.js'};
  if(expected.path==='packages/contracts/package.json') {
    if(!remove('./resources',resourceIndex))return false;
  } else if(expected.path==='packages/project/package.json') {
    if(!remove('./resources',resourceIndex))return false;
    if(expected.bytes===397&&!remove('./atlas',{types:'./dist/atlas/index.d.ts',import:'./dist/atlas/index.js'}))return false;
  } else {
    if(!remove('./resources',{types:'./dist/resources.d.ts',import:'./dist/resources.js'})
      ||!remove('./web/resources',{types:'./dist/web/resources.d.ts',import:'./dist/web/resources.js'})
      ||JSON.stringify(value.imports['#egret-manifest-resources'])!==JSON.stringify({types:'./dist/manifestResourceState.d.ts',import:'./dist/manifestResourceState.js'}))return false;
    delete value.imports['#egret-manifest-resources'];
    if(!remove('./webgl2',{types:'./dist/web/webgl2.d.ts',import:'./dist/web/webgl2.js'})
      ||!remove('./webgl2/scene3d',{types:'./dist/web/webgl2Scene3d.d.ts',import:'./dist/web/webgl2Scene3d.js'}))return false;
  }
  let predecessor=JSON.stringify(value,null,2)+'\n';
  if(expected.path==='packages/contracts/package.json'){
    const expanded="  \"exports\": {\n    \".\": {\n      \"types\": \"./dist/index.d.ts\",\n      \"import\": \"./dist/index.js\"\n    }\n  }",compact="  \"exports\": { \".\": { \"types\": \"./dist/index.d.ts\", \"import\": \"./dist/index.js\" } }";
    if(predecessor.split(expanded).length!==2)return false;
    predecessor=predecessor.replace(expanded,compact);
  }
  const prior=Buffer.from(predecessor);
  return prior.length===expected.bytes&&digest(prior)===expected.sha256;
}

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

function seqpbAtlasPackageSuccessor(expected, raw) {
  return expected?.path === 'packages/project/package.json'
    && expected.bytes === 397 && expected.sha256 === '295e6bc8d81a4647f5b99355ea27879563ced216fa2af406c65cc78b95f40945'
    && raw.length === 503 && seqpbHash(raw) === '4b4380142316c6ab2f0727eab44c80eff2a21640c701871c6ace3a0ab1b276af';
}

// One finite M1.3 interface group; historical root and declaration tuples remain.
const m13SequenceInterfaceSuccessor = [{"base":{"path":"packages/contracts/src/index.ts","bytes":1585,"sha256":"75d513766f2d2087ec0a07f097dff7abf5739289f3f9d0bf0e372576467a94c5"},"current":{"path":"packages/contracts/src/index.ts","bytes":2452,"sha256":"dcdc09ded4557146775ee700087cfc2e9b14dc45e30f6d569848cebe0e3583e0"}},{"base":{"path":"packages/contracts/dist/index.js","bytes":304,"sha256":"cd9227c66a8fc34729ecb9a4e462fd432fe5b9be76dc25950f44f3c3725ba95c"},"current":{"path":"packages/contracts/dist/index.js","bytes":540,"sha256":"f90933caf2643c0d4aa688eff5264160a7e931ee54b94c80163e1535e398ebce"}},{"base":{"path":"packages/contracts/dist/index.d.ts","bytes":1619,"sha256":"b714fec938e235591ddfadc53fa72ba183aaea506267aadaebe5abe65e22c10f"},"current":{"path":"packages/contracts/dist/index.d.ts","bytes":2486,"sha256":"955bbf2feaeafdab5b155e3e4875f077c667d074fe6d807a85c9a5fec6f24434"}},{"base":{"path":"packages/runtime/src/index.ts","bytes":3015,"sha256":"d18e00809b0bd48ecb380e33233988225e85cd348935f7fe72617fb2ebdb3bba"},"current":{"path":"packages/runtime/src/index.ts","bytes":3175,"sha256":"49dea0acbe38ef6fde21431b335da2c74e5324d8f607c9b9d6712323d8cf8beb"}},{"base":{"path":"packages/runtime/dist/index.js","bytes":1620,"sha256":"4fd1a98e92b80394a74fe547db1aef39cf663619b61bc5d03be4499d09146eb3"},"current":{"path":"packages/runtime/dist/index.js","bytes":1708,"sha256":"c8cbc112cd5597e0729c34368954d74a94511638d3efab1fec78603e2f7007f5"}},{"base":{"path":"packages/runtime/dist/index.d.ts","bytes":3049,"sha256":"dbfe6572dd526c8bb9c35271f16a1244c93ff9b7474cac813efd1f1e11e6e3d4"},"current":{"path":"packages/runtime/dist/index.d.ts","bytes":3209,"sha256":"80882b9feafe084db79179fc33161c51e655f9748df813619c2869b04377ddeb"}},{"base":{"path":"packages/engine/web/webgpu.ts","bytes":451,"sha256":"84a69d7c3de60a5e3f83cd0d31cb6cd0bcabdebe5553a89abe0fb3f07540c3cb"},"current":{"path":"packages/engine/web/webgpu.ts","bytes":638,"sha256":"5279441b47636a27fc3589102e8bfffeccea1f138915dc4012539b1fd3d8a5df"}},{"base":{"path":"packages/engine/dist/web/webgpu.js","bytes":190,"sha256":"ae83c0c5f2cb2797e81a72ceaac2b7b19060a985fb3bc201b264881a34e62f31"},"current":{"path":"packages/engine/dist/web/webgpu.js","bytes":248,"sha256":"59ff7e9981cbb680644404d113da72878f38e4a135de0c1301bc269cb8109450"}},{"base":{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":409,"sha256":"d2d9e0f5d317dd8ff2a1c536a4fb9c68b0b068da137492daa1e93bddeacc2b8e"},"current":{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":595,"sha256":"3916e5931b13bb607303ca87568454a0fb4eaa37dab9e09c4433ee864d8d0ffa"}},{"base":{"path":"packages/engine/web/scene3d.ts","bytes":1484,"sha256":"f1e659b0eee592caf9eef33974e5468c802884d251c933c7df9ade108fb2d7b3"},"current":{"path":"packages/engine/web/scene3d.ts","bytes":1638,"sha256":"b0621adc967bd2b646d33dcc4704ce2927fd6bd16f24874b489a25c9e9e9d010"}},{"base":{"path":"packages/engine/dist/web/scene3d.js","bytes":471,"sha256":"84c56083682a75cad68c065da06700cc18d448278144f130411d709fdc7e6f4b"},"current":{"path":"packages/engine/dist/web/scene3d.js","bytes":532,"sha256":"7d95b104c9e547fef5a6b479cc713ad753ce702286d1b4724ccf300725e0a14a"}},{"base":{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1280,"sha256":"e2533624b4e0035d837e50bc963e1e39e665685daafa5ca1577d894b15085416"},"current":{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1433,"sha256":"54ae3906765ca00ff8a0de7bbbdacd182816aabb03e79edc57ec5b00b099f62c"}},{"base":{"path":"packages/engine/src/index.ts","bytes":3475,"sha256":"c3af513385381ba023c396b9bebc262eb03f300fb2d083e6c76ae08810360cc5"},"current":{"path":"packages/engine/src/index.ts","bytes":4162,"sha256":"c83485f3f51530025dd0567d4f7685930a8171821dd04d6916dfa9f8241d1fad"}},{"base":{"path":"packages/engine/dist/index.js","bytes":1196,"sha256":"d34379ae7b19c048f90b23cc97a819a3037dec8a49ef5c4f330a9e3ed7db6192"},"current":{"path":"packages/engine/dist/index.js","bytes":1358,"sha256":"96afca247999dc46d1321ce15138fbe01fffde0aafbb76fb48440a09b67ca082"}},{"base":{"path":"packages/engine/dist/index.d.ts","bytes":3509,"sha256":"2f18be0cac8dd50528882438002625f23c24ce4945308419dd4f67ffcaf47271"},"current":{"path":"packages/engine/dist/index.d.ts","bytes":4196,"sha256":"74dcf197b05678d39f9946dd49ab5ac20ad2e04cc5aa2ba72ab1c4e9f973d134"}},{"base":{"path":"packages/engine/dist/Engine.d.ts","bytes":3578,"sha256":"2d3861e95f9411f060b7ab0a1febd74ed40e883038f822d4a8df3af0a84cd727"},"current":{"path":"packages/engine/dist/Engine.d.ts","bytes":4164,"sha256":"95cafab27f02fe7cc60ff84f4f2c8e6f0647169a8da14fbd3c7ba343f7f31b4e"}}];
const m13SequenceInterfacePaths = ["packages/contracts/src/index.ts","packages/contracts/dist/index.js","packages/contracts/dist/index.d.ts","packages/runtime/src/index.ts","packages/runtime/dist/index.js","packages/runtime/dist/index.d.ts","packages/engine/web/webgpu.ts","packages/engine/dist/web/webgpu.js","packages/engine/dist/web/webgpu.d.ts","packages/engine/web/scene3d.ts","packages/engine/dist/web/scene3d.js","packages/engine/dist/web/scene3d.d.ts","packages/engine/src/index.ts","packages/engine/dist/index.js","packages/engine/dist/index.d.ts","packages/engine/dist/Engine.d.ts"];
function m13SequenceSelected(root){return ["SHARED_FRAME_PROFILE_2D","createSharedGeometry2D","createSharedMaterial2D","createTextureView"].some(name=>new RegExp('\\b'+name+'\\b').test(seqpbRead(root,'packages/engine/src/index.ts').toString('utf8')));}
// M1.5 changes only these members of the retained complete 16-row interface group.
const m15SequenceInterfaceSuccessor = [{"base":{"path":"packages/engine/web/webgpu.ts","bytes":638,"sha256":"5279441b47636a27fc3589102e8bfffeccea1f138915dc4012539b1fd3d8a5df"},"current":{"path":"packages/engine/web/webgpu.ts","bytes":904,"sha256":"bc32aef3a8e03cf725a480e5e0c3af3b1fb554a875aca6504e12dbcb9cb54ccb"}},{"base":{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":595,"sha256":"3916e5931b13bb607303ca87568454a0fb4eaa37dab9e09c4433ee864d8d0ffa"},"current":{"path":"packages/engine/dist/web/webgpu.d.ts","bytes":860,"sha256":"9834eb7ee6e69b79598174b1e6b6a086ca676b414a6dd3bcf2f3ab8d3f6cd9fa"}},{"base":{"path":"packages/engine/web/scene3d.ts","bytes":1638,"sha256":"b0621adc967bd2b646d33dcc4704ce2927fd6bd16f24874b489a25c9e9e9d010"},"current":{"path":"packages/engine/web/scene3d.ts","bytes":1904,"sha256":"6c185440ccb4ef077a83bc6f0529334ecba53cbd3aa7e40bf1663ccb0c1757ed"}},{"base":{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1433,"sha256":"54ae3906765ca00ff8a0de7bbbdacd182816aabb03e79edc57ec5b00b099f62c"},"current":{"path":"packages/engine/dist/web/scene3d.d.ts","bytes":1698,"sha256":"541cb0fa320cf0e807f471116a1466863e7ee7e9f4aea3047c40ea2481474f38"}},{"base":{"path":"packages/engine/dist/Engine.d.ts","bytes":4164,"sha256":"95cafab27f02fe7cc60ff84f4f2c8e6f0647169a8da14fbd3c7ba343f7f31b4e"},"current":{"path":"packages/engine/dist/Engine.d.ts","bytes":4824,"sha256":"67864a735d8a100219821eb9b542346cad169819abc57e2ae4f6a4d5a1b6a7b5"}}];
function m15SequenceSelected(root){return /capturePreparedSharedFrame|createManifestGroup|manifestResourceTypes/.test(seqpbRead(root,'packages/engine/dist/Engine.d.ts').toString('utf8'));}
function m15SequencePin(root,pin){
 if(!m15SequenceSelected(root))return pin;
 return m15SequenceInterfaceSuccessor.find(row=>JSON.stringify(row.base)===JSON.stringify(pin))?.current??pin;
}
function m15SequenceValidate(root){
 if(!m15SequenceSelected(root))return;
 const rows=m15SequenceInterfaceSuccessor,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(rows.length!==5||new Set(rows.map(row=>row.base.path)).size!==5
  ||rows.some(row=>!m13SequenceInterfaceSuccessor.some(old=>same(old.current,row.base))
   ||row.base.path!==row.current.path||[row.base,row.current].some(pin=>!same(Object.keys(pin).sort(),['bytes','path','sha256'])||!Number.isSafeInteger(pin.bytes)||pin.bytes<0||!/^[a-f0-9]{64}$/.test(pin.sha256))))
  seqpbFail('SEQP_BOUNDARY_DEFAULT_ENTRY_IDENTITY','Invalid finite M1.5 interface group');
}
function m13SequencePin(root,pin){if(!m13SequenceSelected(root))return pin;return m15SequencePin(root,m13SequenceInterfaceSuccessor.find(row=>JSON.stringify(row.base)===JSON.stringify(pin))?.current??pin);}
function m13SequenceComplete(root){
 if(!m13SequenceSelected(root))return;
 const rows=m13SequenceInterfaceSuccessor;
 if(rows.length!==16||new Set(m13SequenceInterfacePaths).size!==16||JSON.stringify(rows.map(row=>row.current.path))!==JSON.stringify(m13SequenceInterfacePaths)
    ||rows.some(row=>row.base.path!==row.current.path||[row.base,row.current].some(pin=>JSON.stringify(Object.keys(pin).sort())!==JSON.stringify(['bytes','path','sha256'])||!Number.isSafeInteger(pin.bytes)||pin.bytes<0||!/^[a-f0-9]{64}$/.test(pin.sha256))))seqpbFail('SEQP_BOUNDARY_DEFAULT_ENTRY_IDENTITY','Invalid finite M1.3 interface group');
 m15SequenceValidate(root);
 for(const row of rows){const pin=m15SequencePin(root,row.current),bytes=seqpbRead(root,pin.path);if(bytes.length!==pin.bytes||seqpbHash(bytes)!==pin.sha256)seqpbFail('SEQP_BOUNDARY_DEFAULT_ENTRY_IDENTITY','Complete M1.3 interface group differs: '+pin.path);}
}
// M2.1 dev-only dependency identities; historical package and lock pins remain intact.
const m21ContentConfigurationPairs = [{"base":{"path":"package.json","bytes":1108,"sha256":"16a969b9a50653b1733893c59ee4cd1d29845208c11bd182036bc585372834d0"},"current":{"path":"package.json","bytes":1130,"sha256":"716cda606f58987f784aee2a64e46cf0c2e0130e84157d2a869879b4c3ae7c40"}},{"base":{"path":"pnpm-lock.yaml","bytes":9017,"sha256":"79383095fd4bb2bb4682a12f9651d9a876a01fc6dc1326d09bc0ad587db23084"},"current":{"path":"pnpm-lock.yaml","bytes":9271,"sha256":"061742afdc492e6e1721798dcc1b1539f8e4fd9d0274fa7c5fd9091917e57338"}}];
function seqpbPin(root, pin, code) {
  pin = m13SequencePin(root, pin);
  pin = m31UiSourcePairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin))?.current??pin;
  pin = m22SequenceSourcePairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin))?.current??pin;
  const bytes = seqpbRead(root, pin.path);
  const content=m21ContentConfigurationPairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin));
  if(content&&bytes.length===content.current.bytes&&seqpbHash(bytes)===content.current.sha256)pin=content.current;
  if (m31UiPackageSuccessor(pin, bytes) || m3PointerPackageSuccessor(pin, bytes) || m15ResourcePackageSuccessor(pin, bytes) || m14EnginePackageSuccessor(pin, bytes) || seqpbAtlasPackageSuccessor(pin, bytes)) return;
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
    if (!['@egret/contracts', '@egret/runtime', './gameClockTypes.js', './sequencePlaybackTypes.js'].includes(tokens[index + 1].value) && !(['packages/engine/src/sequencePlayback.ts','packages/engine/dist/sequencePlayback.d.ts'].includes(file)&&tokens[index + 1].value==='./sequenceTargetClaims.js')) seqpbFail('SEQP_BOUNDARY_DAG', file + ': unapproved private-module import');
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
    if (new Set(values).size !== values.length || JSON.stringify(values) !== JSON.stringify(m13SequenceSelected(root)?[...seqpbValues,...["SHARED_FRAME_PROFILE_2D","createSharedGeometry2D","createSharedMaterial2D","createTextureView"]].sort():seqpbValues)) seqpbFail('SEQP_BOUNDARY_ROOT_VALUES', 'Root named runtime values changed');
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
  m13SequenceComplete(root);
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
  console.log('SEQP_BOUNDARY_PASS ' + JSON.stringify({ scope: 'source/emission only', rootTypes: seqpbTypes, rootValueCount: seqpbValues.length+(m13SequenceSelected(root)?4:0), ownedSnapshot: owned !== null }));
}
try { seqpbRun(); }
catch (error) {
  const code = typeof error?.code === 'string' && error.code.startsWith('SEQP_BOUNDARY_') ? error.code : 'SEQP_BOUNDARY_SETUP';
  process.stderr.write(code + ': ' + String(error?.message ?? error) + '\n'); process.exitCode = 1;
}
