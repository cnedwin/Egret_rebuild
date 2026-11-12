// SPDX-License-Identifier: Apache-2.0
// The optional World3D entry points have a closed source/emission successor.
// Historical gates still validate all retained rows and the complete predecessor.
import { createHash } from 'node:crypto';

const routeTargets = {
  './world3d': './dist/rendering/world3d/index',
  './webgl2/world3d': './dist/web/world3d/index',
  './webgpu/world3d': './dist/web/world3d/webgpu',
};

export function projectWorld3dExports(exports) {
  const routes = Object.entries(routeTargets);
  if (!routes.every(([route, stem]) => JSON.stringify(exports?.[route]) ===
    JSON.stringify({ types: stem + '.d.ts', import: stem + '.js' }))) return exports;
  const prior = { ...exports };
  for (const [route] of routes) delete prior[route];
  return prior;
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const matches = (raw, pin) => raw.length === pin.bytes && hash(raw) === pin.sha256;

export function projectWorld3dPackage(raw) {
  if (!matches(raw, world3dPackagePair.current)) return raw;
  const value = JSON.parse(raw);
  const priorExports = projectWorld3dExports(value.exports);
  if (priorExports === value.exports) return raw;
  const prior = Buffer.from(JSON.stringify({ ...value, exports: priorExports }, null, 2) + '\n');
  return matches(prior, world3dPackagePair.base) ? prior : raw;
}

export const world3dPackagePair = {
  base:  {"path":"packages/engine/package.json","bytes":3662,"sha256":"32bdc997a04e80bc65fc014a174a46e874b565960703d005850be6120811beec"},
  current:  {"path":"packages/engine/package.json","bytes":4050,"sha256":"c413bebdaafd1ab3bb9075a518122857aaabad560997c700f214b3b4f4dcb6ab"},
};

export const world3dGraphPins = [
  {"path":"packages/engine/dist/rendering/world3d/Animation3D.d.ts","bytes":4029,"sha256":"5595c270c3eb588dc3260dcdf0d7dbdf7e15e9fe96e06dbc2cb1db07a9da9ae7"},
  {"path":"packages/engine/dist/rendering/world3d/Animation3D.js","bytes":14138,"sha256":"dfdab8d82ad4f009b1cfc9f4d8a052543e515184149f451b34610d810fc2da1d"},
  {"path":"packages/engine/dist/rendering/world3d/Camera3D.d.ts","bytes":2301,"sha256":"7b3f31fd044b3ccf176d5e8526d02a09523e944f014b3cd36104e105f0bfac36"},
  {"path":"packages/engine/dist/rendering/world3d/Camera3D.js","bytes":5168,"sha256":"212499dd4472119ed9484cacef9816d01a223a9b98fe6fb769ff97e834b764e4"},
  {"path":"packages/engine/dist/rendering/world3d/Geometry3D.d.ts","bytes":3546,"sha256":"ab49cbe58083a88e48a81b41af3d1dfd0ef00e38c717912929839f3ca32a9d96"},
  {"path":"packages/engine/dist/rendering/world3d/Geometry3D.js","bytes":13874,"sha256":"5646c362d6ca2ae93eaca5086924014f7831e98320a7e17910973539a1da2a70"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.d.ts","bytes":1730,"sha256":"d0ede40955ac04b8bbe857dc5c52e110c73f429750b95ef762eaa0939dc5e31e"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.js","bytes":34548,"sha256":"f9c6f4219ba7258e4de2509e8e0478b98847b17800ecfecca0a50f2cec6549bd"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.d.ts","bytes":2615,"sha256":"23a177a35acf2d5fc4e61ea1f7af70eeff99a7cd7f66ed63b1c8b665bd06b569"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.js","bytes":2949,"sha256":"5f4ee857b44fb33ac2496b56e50f25993057ca648fe1113cd2e05b0c4254fa91"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.d.ts","bytes":4807,"sha256":"29d95634571418466610c71c0295972380c46ab59479f0bb9e2073e8150b7f28"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.js","bytes":5760,"sha256":"9deda46e0a9c7ac8e252f33d12a527cc562444c84d9f1de82d8f979d5d08a29b"},
  {"path":"packages/engine/dist/rendering/world3d/Mesh3D.d.ts","bytes":4131,"sha256":"581bce14ab93b5618073e021d50046c6f5484404d209063d74c40f95598e7ee7"},
  {"path":"packages/engine/dist/rendering/world3d/Mesh3D.js","bytes":11689,"sha256":"00dde05a5c752d397aa9211f72242af1bf8bdf846334c3516b87d36c5931fbfa"},
  {"path":"packages/engine/dist/rendering/world3d/Object3D.d.ts","bytes":4764,"sha256":"00592ed85d8939ae358d5e705581802b07e3a271667dea773483fd2c5bbb76ba"},
  {"path":"packages/engine/dist/rendering/world3d/Object3D.js","bytes":10865,"sha256":"594558794120088beb4e0f8cb8ba69f80078616126fa46aacede4ec16175758b"},
  {"path":"packages/engine/dist/rendering/world3d/Particles3D.d.ts","bytes":3740,"sha256":"664e687d71f43b0ed593d9b1b481cbe974ae8ca3201fe8492718698ed2926172"},
  {"path":"packages/engine/dist/rendering/world3d/Particles3D.js","bytes":12528,"sha256":"4384ff747b2300d84c5ab9c7d72f47ee6adf53328df0978ebfddeafd8b0debe2"},
  {"path":"packages/engine/dist/rendering/world3d/Raycast3D.d.ts","bytes":1686,"sha256":"f51484af8550ff3cdbba25c587e8553bbb0320a3ccf47a4a798b011f762385cd"},
  {"path":"packages/engine/dist/rendering/world3d/Raycast3D.js","bytes":5856,"sha256":"ba001fd96a64900374460d346f9ac5648d7749c3aad10274f9bae3b0d1b34ddf"},
  {"path":"packages/engine/dist/rendering/world3d/RenderList3D.d.ts","bytes":1667,"sha256":"17b2c53cd5260ed395612dbdbef0359cac31f179eadef2036178d620804d2711"},
  {"path":"packages/engine/dist/rendering/world3d/RenderList3D.js","bytes":5799,"sha256":"c3a58bcae60a416c8200fdb58df54abb6e15d090dd8855e6a95dfc17fc028102"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.d.ts","bytes":4312,"sha256":"f8b4f4278ef5f50e1182614f558f249d30a570220bb1c0419ebcef7e492ec389"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.js","bytes":7875,"sha256":"ceffefef0fd6d0229294ac60614f10c3b09960c25f15671f50e80e3e6bdab1bf"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.d.ts","bytes":1861,"sha256":"c4380a072e9ea3d33928938b6bcc081ef8e6e5b0bd6d09ec9a8bc92a04b9b308"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.js","bytes":3213,"sha256":"ff5da5bf3509a0965378748b446db53de396c8a14cd74266fa5ef07e286689cd"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.d.ts","bytes":2000,"sha256":"e23c41c43b4dd53a01b9385448f49f4fb848ffead8684527f157d6a0d60b2fb2"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.js","bytes":5001,"sha256":"83ef7d4b3ef096d915d145dccbbc192bd1d0667254229928c940788a3a0dd6ac"},
  {"path":"packages/engine/dist/rendering/world3d/index.d.ts","bytes":3308,"sha256":"f2b7125039d761bec97cad414a73c95beb6ed9afd517c5f7b8ce81fd7489084b"},
  {"path":"packages/engine/dist/rendering/world3d/index.js","bytes":2107,"sha256":"246bcf414fba37271a5462bbd17a738c67962ad03aaf06107a3c739980ead35f"},
  {"path":"packages/engine/dist/rendering/world3d/math3D.d.ts","bytes":7222,"sha256":"075fd132d834d96d2ad5afe1f46dd048b5f1cb6116bf8955397df248cad4e2e8"},
  {"path":"packages/engine/dist/rendering/world3d/math3D.js","bytes":23075,"sha256":"19ca87fc98ca78fded36d24b52a21762c92b375d95847b033e7cf4e144823b06"},
  {"path":"packages/engine/dist/rendering/world3d/primitives3D.d.ts","bytes":2566,"sha256":"ed3f143d092319469a4978bf0667fc17a083750b7f31dcd334d42521f4bd153d"},
  {"path":"packages/engine/dist/rendering/world3d/primitives3D.js","bytes":10000,"sha256":"baff435a5b03b07c729f9cb9bc509337ceb5927aaaf24762aaf0d46a56783e6e"},
  {"path":"packages/engine/dist/web/world3d/OrbitControls3D.d.ts","bytes":2177,"sha256":"adcd7535d4dbcecad4c81560edcdb5e3c1abd7ba7460f29a0db608dde356d51b"},
  {"path":"packages/engine/dist/web/world3d/OrbitControls3D.js","bytes":8036,"sha256":"b04ba6a01eb23f55b3f30f32d71ea547ff76a0421387195a05afdaa93e3232a4"},
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.d.ts","bytes":3204,"sha256":"26d7546e7f3697406941829229c939c93afcb20cddb21f3ee7c742740162ec4b"},
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.js","bytes":34125,"sha256":"cf073e0242304b5710d7c733ad3a9f42dcf752f3a4711dd869b561e852e18bb6"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.d.ts","bytes":3552,"sha256":"bf49ea25125d43758e3f3dd35fbdcf844f01623269d74c4f27407d38907d40a8"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.js","bytes":59059,"sha256":"dc67ee9a3fe4bcae508e77dc5ab180ad71e325176fee9c690d84789a36132691"},
  {"path":"packages/engine/dist/web/world3d/World3DView.d.ts","bytes":2487,"sha256":"ae107bb493d08bdaeafd01d4e92373f0836cce8bb1c1a81e691c47063b60396d"},
  {"path":"packages/engine/dist/web/world3d/World3DView.js","bytes":2932,"sha256":"330afcc4d2811795296bddae88b8d5e70eff423ab99ab23f6d41dbb96e35420c"},
  {"path":"packages/engine/dist/web/world3d/frame3D.d.ts","bytes":3836,"sha256":"d0bf97a259d3ebda5d14ec8f6b2868f6956193583821c725c4f17d0af15efb54"},
  {"path":"packages/engine/dist/web/world3d/frame3D.js","bytes":6956,"sha256":"d8fee673b57d41721360ee4cdaad0cc2153b3a75de36727f64b13f263003d4e6"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.d.ts","bytes":3148,"sha256":"0a8927a675af44815cc4d80e9a0ed26e522c8609297c3e0ccf2be154e9171e1a"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.js","bytes":28543,"sha256":"f3d0d60baa2acae18d21aec6021d908843f5884c7f2c3cbf8b9e62256ea9bec5"},
  {"path":"packages/engine/dist/web/world3d/host3D.d.ts","bytes":1051,"sha256":"108f3bf808667379d5e35ca7fa38ed13ace75cfde2a7c4d61440e9ec59365f12"},
  {"path":"packages/engine/dist/web/world3d/host3D.js","bytes":2150,"sha256":"5d45aea704dedcfcbf2195e6de3fffa944141b900dfb37a866666440af82bb47"},
  {"path":"packages/engine/dist/web/world3d/index.d.ts","bytes":820,"sha256":"d4466bfb28695b26a54dacba956ddab8064bdf791fabae31b8bc7ab34888bb54"},
  {"path":"packages/engine/dist/web/world3d/index.js","bytes":660,"sha256":"c6e5ceb37538bf9d32bc846ec443d18ccafb5bfec2307c311047029879e59bb9"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.d.ts","bytes":1102,"sha256":"1280bd0220c1ac291ef971f08714391f2adc294bc2e55b2e7fae3019a04e4279"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.js","bytes":4894,"sha256":"3dafc9c84a557db092a85eb185900001b509e6eeaa637179a9a6b3e12c8bd5da"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.d.ts","bytes":1283,"sha256":"2ed86ae5043c72f22f33b01268f31edc891b0900a02ea024889662c62c67469e"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.js","bytes":17009,"sha256":"e2583a6fc7028c3aa8c0a074cc836dcd09a2ba8e210a973ec59c7d6063429045"},
  {"path":"packages/engine/dist/web/world3d/webgpu.d.ts","bytes":821,"sha256":"5b689892349bd9df1ec5bc39c8a039e8cf7f4658714dd92c2d7ac40d8030a56e"},
  {"path":"packages/engine/dist/web/world3d/webgpu.js","bytes":635,"sha256":"17fcd335f3faf0c0330ee42d9b1eac605afdb988cfa701f7658acfd8880f714a"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.d.ts","bytes":3945,"sha256":"d3a9e16770e0298a8af771f45c83bd8ddc0294c5b6efd2ca9c4cfa7dd5e08417"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.js","bytes":20159,"sha256":"37b02a738a3f9ba713fff46657bc854a5b50fa8c14702def7e3850160004da7f"},
  {"path":"packages/engine/rendering/world3d/Animation3D.ts","bytes":15505,"sha256":"32841bc4a625b8e28e39f1acd3bf94470a6f3799d1e3abdfeda492590175fca5"},
  {"path":"packages/engine/rendering/world3d/Camera3D.ts","bytes":5826,"sha256":"95aea52abff097f17c3c704aa60f51952aa10a6c5b8bbc14976c29da654e80c4"},
  {"path":"packages/engine/rendering/world3d/Geometry3D.ts","bytes":14604,"sha256":"e45fb458cb9f5b15919bff6910f7a88b4b4c0b7a18327dce2cf28c44fd01d38c"},
  {"path":"packages/engine/rendering/world3d/Gltf3D.ts","bytes":36657,"sha256":"65ac462da1251084e557c5de7397f47450ee7dd32fcf1000aad097d35a23da85"},
  {"path":"packages/engine/rendering/world3d/Light3D.ts","bytes":4414,"sha256":"c38e03ac667636e174b8afef60e46355608096a519d67d70c442fad3873a1e52"},
  {"path":"packages/engine/rendering/world3d/Material3D.ts","bytes":8150,"sha256":"34e63314ea60a0189f0e095d26c162a0cfaaeee654341c2e9adf5ec6d49d98c2"},
  {"path":"packages/engine/rendering/world3d/Mesh3D.ts","bytes":12433,"sha256":"95f6aa7933f46b05a435f7fc8f2a240d19703dee99ef676130e85199ff6d446b"},
  {"path":"packages/engine/rendering/world3d/Object3D.ts","bytes":11991,"sha256":"118aa6fbd7db938292a8167b42af4e78d1bd47427e148ccbfd42954e1df21f86"},
  {"path":"packages/engine/rendering/world3d/Particles3D.ts","bytes":14456,"sha256":"5c433510cfc40f5fe99b8945d413371ef2a8d5255543f9fdbbb1e163cd48bb13"},
  {"path":"packages/engine/rendering/world3d/Raycast3D.ts","bytes":6946,"sha256":"21b72409b80f0a29cda3a6a8504523be0225652718135adac1a169e152f55323"},
  {"path":"packages/engine/rendering/world3d/RenderList3D.ts","bytes":6668,"sha256":"12c5adb1723048ed850fe80cba4d6897c543a821febd31fb7e6211a496d3b08a"},
  {"path":"packages/engine/rendering/world3d/Texture3D.ts","bytes":9133,"sha256":"5fa8faa089808db1a62ab66ac52d6e4af67f9c650979bc5ef7f14d9101f0c157"},
  {"path":"packages/engine/rendering/world3d/core3D.ts","bytes":3665,"sha256":"677ce4383c2a175f41dd1d73496fe066cac95d90ed696e85b3958cbbb381c7a2"},
  {"path":"packages/engine/rendering/world3d/helpers3D.ts","bytes":5265,"sha256":"565861bc545f119ee38289c454b58c102f8471cb33ff3b1d5d47090f17625a46"},
  {"path":"packages/engine/rendering/world3d/index.ts","bytes":3565,"sha256":"01495058ccaa374ec30f33f64b9e4cda41ef798b1c5b3e1578e2acde01bf5a13"},
  {"path":"packages/engine/rendering/world3d/math3D.ts","bytes":25221,"sha256":"e04d08cc5aaab47ae2a19d2a855a0ac56cc9be2c684ee5c3924b580c72523f5e"},
  {"path":"packages/engine/rendering/world3d/primitives3D.ts","bytes":11591,"sha256":"cb6ab67944d25d286dc7c2c34a6349335288027d9799dd7775d79b6d6e193aa4"},
  {"path":"packages/engine/web/world3d/OrbitControls3D.ts","bytes":9550,"sha256":"dae24e6d27b2ffa3b1975a945077f062aa7e5471eba7ba4089f275a7645c2975"},
  {"path":"packages/engine/web/world3d/WebGL2Renderer3D.ts","bytes":35162,"sha256":"573d2a5492e88cc1cd00ed6dd9283786e69052a95d101279e128da8034a74b42"},
  {"path":"packages/engine/web/world3d/WebGPURenderer3D.ts","bytes":63621,"sha256":"636bef5ba0b962403e5abd363d5d90b2db56afeb68d93401653edaf817d66acc"},
  {"path":"packages/engine/web/world3d/World3DView.ts","bytes":4962,"sha256":"cfb666a5aec0a53da5b55c125779f0cf962678fe22901d44b63a6c6a8bae18e5"},
  {"path":"packages/engine/web/world3d/frame3D.ts","bytes":9492,"sha256":"8c16411ebb55d2b441a26c1551990cfd00ead08af80388b4eeeabd8c1191c371"},
  {"path":"packages/engine/web/world3d/gpuResources3D.ts","bytes":30538,"sha256":"0915db36317e9c5eda81951421e0221248c0cccc7caa3e579ad464fdb6a98cdb"},
  {"path":"packages/engine/web/world3d/host3D.ts","bytes":2699,"sha256":"4d00610295a36b95b527f7951a59d195878fb78b4d5c4127226e58bb1611b7ed"},
  {"path":"packages/engine/web/world3d/index.ts","bytes":1009,"sha256":"98e94a40084b3d27c3055e7ab9e54cacb72d13d50b3fb06323db619f8f1f6576"},
  {"path":"packages/engine/web/world3d/loaders3D.ts","bytes":5443,"sha256":"4086b48f4b9362ba570c7d8340240c2d9a408141e6da8dd528d5cd62216994bc"},
  {"path":"packages/engine/web/world3d/shaders3D.ts","bytes":17141,"sha256":"4d675d98a1539df3e9d85048eaf8e55813a528f087c093387c1ade1933d2432a"},
  {"path":"packages/engine/web/world3d/webgpu.ts","bytes":983,"sha256":"a956205e05e677110c244baa71cff6865aa5d3ba46af6677034e8b9ceadaafb2"},
  {"path":"packages/engine/web/world3d/wgsl3D.ts","bytes":21203,"sha256":"331c5c727190936b09cd37bb54393d4d884ce983b2d504dea415dea6ed81f204"},
];
