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
  {"path":"packages/engine/dist/rendering/world3d/Camera3D.d.ts","bytes":2641,"sha256":"8b24dd338543d8dbe39e9044a5f434188541cbbeb40c586e14a050353bc8b676"},
  {"path":"packages/engine/dist/rendering/world3d/Camera3D.js","bytes":5888,"sha256":"50ea9c0b0dda791d575629f9f7785956d1f74bbb1d8fde56be54ff75c176cbc4"},
  {"path":"packages/engine/dist/rendering/world3d/Curves3D.d.ts","bytes":4844,"sha256":"bdc0e0199f73bd6da8ade5638485ebfb33ec3c6337d9246cb543ed15f09c291d"},
  {"path":"packages/engine/dist/rendering/world3d/Curves3D.js","bytes":19222,"sha256":"25c2dbb8b1a4395fa94b30964f45ad5c6f5b64b99297573f4cbc7f0048cd30ce"},
  {"path":"packages/engine/dist/rendering/world3d/Geometry3D.d.ts","bytes":3546,"sha256":"ab49cbe58083a88e48a81b41af3d1dfd0ef00e38c717912929839f3ca32a9d96"},
  {"path":"packages/engine/dist/rendering/world3d/Geometry3D.js","bytes":13874,"sha256":"5646c362d6ca2ae93eaca5086924014f7831e98320a7e17910973539a1da2a70"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.d.ts","bytes":3119,"sha256":"314b8c7b3061c95197e986adff58b77d8486e85e1e575ced01f5e3bdf5ef6ad4"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.js","bytes":43554,"sha256":"bd76bee60ce5109cdbf2d8eef8ce3694e6031f52498b9d4c8d989501be594656"},
  {"path":"packages/engine/dist/rendering/world3d/Hdr3D.d.ts","bytes":1390,"sha256":"efb5ef84a1461473a3644e79b31b7b7412fbfdee780fc6fd044f3b5a8e73bc1f"},
  {"path":"packages/engine/dist/rendering/world3d/Hdr3D.js","bytes":8069,"sha256":"04428d7b412ad6c4c73bf7229be1a588b57a3b691c5cb4da8a2572bc36f848ae"},
  {"path":"packages/engine/dist/rendering/world3d/Ktx23D.d.ts","bytes":1325,"sha256":"331fd2cb9e38e5063db1f6272c9364f69ddbb9acb7e41025f1658efd23d77273"},
  {"path":"packages/engine/dist/rendering/world3d/Ktx23D.js","bytes":4496,"sha256":"f0c118c07120fe9a252f5d95e302bb0a8e0840f06525b5b199a86c84851ce2d4"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.d.ts","bytes":3093,"sha256":"1e6831ada6adea990c1cac5cce4cf9a984c2a4bf980e7635f79b69e48d6656e8"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.js","bytes":2978,"sha256":"6855c60deba1c9886cf8a3430dfb56ffca113d01fa25dc3ab05e3ab8690c168f"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.d.ts","bytes":7594,"sha256":"0798071ff39767502a7daa2b6ba07bd8b91fe92f9e9af4c665e5c1b851b55d44"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.js","bytes":7698,"sha256":"14394d8df93b319e226c83660e373e648e9ba7acf337a6d9abb12f4aa78bf474"},
  {"path":"packages/engine/dist/rendering/world3d/Mesh3D.d.ts","bytes":4131,"sha256":"581bce14ab93b5618073e021d50046c6f5484404d209063d74c40f95598e7ee7"},
  {"path":"packages/engine/dist/rendering/world3d/Mesh3D.js","bytes":11689,"sha256":"00dde05a5c752d397aa9211f72242af1bf8bdf846334c3516b87d36c5931fbfa"},
  {"path":"packages/engine/dist/rendering/world3d/Object3D.d.ts","bytes":5180,"sha256":"c53b275805a773e112b75758162b2853a3bcbeb7f4d18c7377d48e723245c8db"},
  {"path":"packages/engine/dist/rendering/world3d/Object3D.js","bytes":11180,"sha256":"7df4f3e3901b24d41a9c5c89dfcb9614431618a22b7ceb81f26d1aa3a1ad0f85"},
  {"path":"packages/engine/dist/rendering/world3d/Particles3D.d.ts","bytes":3740,"sha256":"664e687d71f43b0ed593d9b1b481cbe974ae8ca3201fe8492718698ed2926172"},
  {"path":"packages/engine/dist/rendering/world3d/Particles3D.js","bytes":12528,"sha256":"4384ff747b2300d84c5ab9c7d72f47ee6adf53328df0978ebfddeafd8b0debe2"},
  {"path":"packages/engine/dist/rendering/world3d/Physics3D.d.ts","bytes":8002,"sha256":"36ef3dd41301e6992a03b54b51f0a553ca00b363abf5ef93a737d47584ea340a"},
  {"path":"packages/engine/dist/rendering/world3d/Physics3D.js","bytes":59858,"sha256":"a2d4ac745ff3cd3b36ae251757f15f89dddef94a94ea00cde2386213fc9bf310"},
  {"path":"packages/engine/dist/rendering/world3d/PhysicsMesh3D.d.ts","bytes":1936,"sha256":"c884fcbbc1c5b3ff5991ff1aee113acba0482e6ee7d6ce18a26270e7f7886eb7"},
  {"path":"packages/engine/dist/rendering/world3d/PhysicsMesh3D.js","bytes":16143,"sha256":"87f8aec6c180aaeb8e0479a319c23a0834c5a42c4e549ba2ff358bbc99b392f6"},
  {"path":"packages/engine/dist/rendering/world3d/Raycast3D.d.ts","bytes":1686,"sha256":"f51484af8550ff3cdbba25c587e8553bbb0320a3ccf47a4a798b011f762385cd"},
  {"path":"packages/engine/dist/rendering/world3d/Raycast3D.js","bytes":5856,"sha256":"ba001fd96a64900374460d346f9ac5648d7749c3aad10274f9bae3b0d1b34ddf"},
  {"path":"packages/engine/dist/rendering/world3d/RenderList3D.d.ts","bytes":1667,"sha256":"17b2c53cd5260ed395612dbdbef0359cac31f179eadef2036178d620804d2711"},
  {"path":"packages/engine/dist/rendering/world3d/RenderList3D.js","bytes":6228,"sha256":"742f79d8eca8c7f6de1269682ad4db71aa24ca28e6243768dd6f0bca2ddd0ae6"},
  {"path":"packages/engine/dist/rendering/world3d/Serialize3D.d.ts","bytes":2244,"sha256":"c0b8936886994587f9c818585a3a86950a6f9afb4654a18b750508d8c860553a"},
  {"path":"packages/engine/dist/rendering/world3d/Serialize3D.js","bytes":25478,"sha256":"dcff2bc33a23c70404ccfe22e3fb3d92bf4a949c5077126612cc0d1db0cc209e"},
  {"path":"packages/engine/dist/rendering/world3d/StateMachine3D.d.ts","bytes":3565,"sha256":"06360df6f114e413b30744a6f12c7437b11220c4de9898db919056adf77b3cb9"},
  {"path":"packages/engine/dist/rendering/world3d/StateMachine3D.js","bytes":11622,"sha256":"f73d427aed0208da6d502987dcdbd4aed6f9b9bb647c89bc51f72a3fcdc448a4"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.d.ts","bytes":6095,"sha256":"e55ba52cb7328017ec2f2763057f321c84bf5517d83a589b906ada9e5836a9d0"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.js","bytes":10062,"sha256":"7d4cc7c926233b3f2659448b2c002c6a1e7887dc48280ed184deea12a9b47381"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.d.ts","bytes":1861,"sha256":"c4380a072e9ea3d33928938b6bcc081ef8e6e5b0bd6d09ec9a8bc92a04b9b308"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.js","bytes":3213,"sha256":"ff5da5bf3509a0965378748b446db53de396c8a14cd74266fa5ef07e286689cd"},
  {"path":"packages/engine/dist/rendering/world3d/debug3D.d.ts","bytes":3100,"sha256":"6f3634e7e20a2894bafd179bcbbfb264874dde1ee167e4673b33c4920a2c1b83"},
  {"path":"packages/engine/dist/rendering/world3d/debug3D.js","bytes":10078,"sha256":"8575166568f753495a7fdbb508a513af3673e1d70359925cf56791b19b254cc2"},
  {"path":"packages/engine/dist/rendering/world3d/geometries3D.d.ts","bytes":5009,"sha256":"25f2b1034b2abb44a963bc0886360aa4231255e0a8b6c069db9b12691169ecb5"},
  {"path":"packages/engine/dist/rendering/world3d/geometries3D.js","bytes":26469,"sha256":"c41019a0fb1585522b876f520b9ceae8734ada96308c7897d577dbf4f9ff2b90"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.d.ts","bytes":3383,"sha256":"201c911db5175fcc342f24962d04b8743893331c17b5efcbf29f4c9b12cd8a54"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.js","bytes":7038,"sha256":"0e0d20d9bf2dae266fcb2aad0e9f485a2ccc086711c76a412c1293ac5ec4ccb3"},
  {"path":"packages/engine/dist/rendering/world3d/index.d.ts","bytes":6228,"sha256":"a4426b64eb3825136aeeec3c90f377da694eb3e296167c6dad11d5336052ccf2"},
  {"path":"packages/engine/dist/rendering/world3d/index.js","bytes":3884,"sha256":"f6b8f2831abcda06ec44aa0e5b1e10c4d819a8aa8c7daaf322e19e4a644e9613"},
  {"path":"packages/engine/dist/rendering/world3d/math3D.d.ts","bytes":7222,"sha256":"075fd132d834d96d2ad5afe1f46dd048b5f1cb6116bf8955397df248cad4e2e8"},
  {"path":"packages/engine/dist/rendering/world3d/math3D.js","bytes":23075,"sha256":"19ca87fc98ca78fded36d24b52a21762c92b375d95847b033e7cf4e144823b06"},
  {"path":"packages/engine/dist/rendering/world3d/primitives3D.d.ts","bytes":2566,"sha256":"ed3f143d092319469a4978bf0667fc17a083750b7f31dcd334d42521f4bd153d"},
  {"path":"packages/engine/dist/rendering/world3d/primitives3D.js","bytes":10000,"sha256":"baff435a5b03b07c729f9cb9bc509337ceb5927aaaf24762aaf0d46a56783e6e"},
  {"path":"packages/engine/dist/web/world3d/Audio3D.d.ts","bytes":3189,"sha256":"3746af7f3503fd4ffb2227ffc9f23969f3ef0f04e2e0f0c6422b6b7501a74541"},
  {"path":"packages/engine/dist/web/world3d/Audio3D.js","bytes":7881,"sha256":"60f10c20b77627ceb4c19c3702547b11afce8e2b9d5c2aba6d393e2ab8ee198f"},
  {"path":"packages/engine/dist/web/world3d/FlyControls3D.d.ts","bytes":2204,"sha256":"60e2cf5f52aefb895a049ba6f2dd01b33081f6178e50a46448ba43acd9eabc07"},
  {"path":"packages/engine/dist/web/world3d/FlyControls3D.js","bytes":6510,"sha256":"7d6d442d5dfaa652688a2f5d58f9d1ebc97c1cdf9fa1036238529a7f7717137d"},
  {"path":"packages/engine/dist/web/world3d/OrbitControls3D.d.ts","bytes":2177,"sha256":"adcd7535d4dbcecad4c81560edcdb5e3c1abd7ba7460f29a0db608dde356d51b"},
  {"path":"packages/engine/dist/web/world3d/OrbitControls3D.js","bytes":8036,"sha256":"b04ba6a01eb23f55b3f30f32d71ea547ff76a0421387195a05afdaa93e3232a4"},
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.d.ts","bytes":3832,"sha256":"7ed999b5f3e9e48d5193c92a166586a734864a804c24aeb8e7fae88e455a7796"},
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.js","bytes":40422,"sha256":"4abae626221e474df9afda3173f0f3393b049354fe008c556040e3aba1bcad8f"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.d.ts","bytes":4263,"sha256":"49c2aaf36b63fcc3f68cfe333270a5dfe8940d1ba52eb629212d9cdfc1bf78ac"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.js","bytes":72054,"sha256":"7b562d51e2e2fd15b35bca82dbc064b5a394858db747ce439f5cff804ef940fd"},
  {"path":"packages/engine/dist/web/world3d/World3DView.d.ts","bytes":2487,"sha256":"ae107bb493d08bdaeafd01d4e92373f0836cce8bb1c1a81e691c47063b60396d"},
  {"path":"packages/engine/dist/web/world3d/World3DView.js","bytes":2932,"sha256":"330afcc4d2811795296bddae88b8d5e70eff423ab99ab23f6d41dbb96e35420c"},
  {"path":"packages/engine/dist/web/world3d/assets3D.d.ts","bytes":2252,"sha256":"799977a073daf42105fc658f5bd42d04ca3b7931d560110aefb4729a2169c8d5"},
  {"path":"packages/engine/dist/web/world3d/assets3D.js","bytes":5229,"sha256":"2301e5c3ba34f839640dfbd131c71ebde865ae8fc712893202db889e5c3581c2"},
  {"path":"packages/engine/dist/web/world3d/frame3D.d.ts","bytes":5180,"sha256":"2a4007894d5d19601ff68def77a41eabb17d2ac7f9449fe8a674f38f8311b0bc"},
  {"path":"packages/engine/dist/web/world3d/frame3D.js","bytes":14154,"sha256":"b6fe76aa3b7b3cc169b7313b24f80d98d41da1ddf2fd98297e5908f692cd74ac"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.d.ts","bytes":3683,"sha256":"66fb94aeeeeff8999312d911b88576f2e86b1cfedddb8792707c7620933ed79b"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.js","bytes":32314,"sha256":"7d66a3532b9d0488167aeee3e7ce36353fd7c81db3e07b49a60fe338f0e3acf2"},
  {"path":"packages/engine/dist/web/world3d/host3D.d.ts","bytes":1051,"sha256":"108f3bf808667379d5e35ca7fa38ed13ace75cfde2a7c4d61440e9ec59365f12"},
  {"path":"packages/engine/dist/web/world3d/host3D.js","bytes":2150,"sha256":"5d45aea704dedcfcbf2195e6de3fffa944141b900dfb37a866666440af82bb47"},
  {"path":"packages/engine/dist/web/world3d/index.d.ts","bytes":1683,"sha256":"ff8f5269ba40d3f72ca002d140cdce7e8ac842560f54584470533c2a38fb0c52"},
  {"path":"packages/engine/dist/web/world3d/index.js","bytes":1122,"sha256":"53a2abeaaddc861ac5ef44d392d682d870eba034d9a068eaa0007670c6ba847f"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.d.ts","bytes":1688,"sha256":"4763fbb184cfb2aed3daa1a1f7e8c3ec0e7c4c105c2c26bb060e704be303e5ea"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.js","bytes":5928,"sha256":"5b967f5756300fb5c2877aa16587a8cd64fb79a1c41f802401ef687ad80adceb"},
  {"path":"packages/engine/dist/web/world3d/post3D.d.ts","bytes":5887,"sha256":"9f440f9dfd180bf6e8fb299346c06fcd75b95a261e91bc2b35cc70f001c28283"},
  {"path":"packages/engine/dist/web/world3d/post3D.js","bytes":19625,"sha256":"4da34f2ba1a9871ef7be86dd5535b8bb36240a7deb37b8b7ccb73afab5846697"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.d.ts","bytes":1403,"sha256":"52e1055ef42929fd9a3bcbc4362850d8c95826e764f29a70ac8003b71ed772af"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.js","bytes":11108,"sha256":"b6ea7c3c94ac47709366a2fce3a339204c0d4b4e00b647a5986e5c4b2fd025d4"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.d.ts","bytes":1216,"sha256":"b27bfa18620396b5d6a53297f1628ee1eb5c0f76d31f6ad97d1ff8883372798e"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.js","bytes":10813,"sha256":"2d23ed48aa1a20a853cf758839d0d27a20c9a0142923c347eebc1e72aa760d8a"},
  {"path":"packages/engine/dist/web/world3d/probe3D.d.ts","bytes":761,"sha256":"daa9a0f1baf474e8e55de600ff86eec476e53ce84f14e783d9a875802709c322"},
  {"path":"packages/engine/dist/web/world3d/probe3D.js","bytes":3297,"sha256":"c083d946fa3d5fbb995330f5ce3aa1d599b9d8006320a2f206d26bab5f3e8a5c"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.d.ts","bytes":1331,"sha256":"f017d27903503f868833cdc0aa6d40216a6fe2f14c59999e132dc0bd6665467d"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.js","bytes":21332,"sha256":"8f8a638cb38505b337a535993460dd6b00df095514dca41c299d2ebd34d3454b"},
  {"path":"packages/engine/dist/web/world3d/webgpu.d.ts","bytes":1684,"sha256":"f5fa720cc41dee8deb1c9cbc7af55da76a77bebe463622ff4db5f9f95dd3d9e6"},
  {"path":"packages/engine/dist/web/world3d/webgpu.js","bytes":1097,"sha256":"59d4b55bd3c03a1c7d0dce6cc50ee6e3f14a12636e606e9578fb530fe2e05468"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.d.ts","bytes":4387,"sha256":"9c4d0c9f3f34392d0fad1b3944e2b7d79b56a8712ba1d7ea66ce602733eca8a7"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.js","bytes":24609,"sha256":"fc84d49bdd468675e7c53b8d0f699b0369a96902ec9be4262fcc00d0c1be24bd"},
  {"path":"packages/engine/rendering/world3d/Animation3D.ts","bytes":15505,"sha256":"32841bc4a625b8e28e39f1acd3bf94470a6f3799d1e3abdfeda492590175fca5"},
  {"path":"packages/engine/rendering/world3d/Camera3D.ts","bytes":6545,"sha256":"2372ddac4c6217e867fe877e448d93679324ad1ce64fb612c7c58dbf2912a9bf"},
  {"path":"packages/engine/rendering/world3d/Curves3D.ts","bytes":20209,"sha256":"9bf2b507b704f900238355c87c5e4cb3bf4c4cce05d53984d8d025c33ae4b4b0"},
  {"path":"packages/engine/rendering/world3d/Geometry3D.ts","bytes":14604,"sha256":"e45fb458cb9f5b15919bff6910f7a88b4b4c0b7a18327dce2cf28c44fd01d38c"},
  {"path":"packages/engine/rendering/world3d/Gltf3D.ts","bytes":46938,"sha256":"bca251fe9826cb281415c9c09058cad71ece142e51452da918aa3a10da92d5ee"},
  {"path":"packages/engine/rendering/world3d/Hdr3D.ts","bytes":7725,"sha256":"884b2f136ae3c6418c4ff1af3deff725b2a6b9acc582bff5eda8feb2f271d9ea"},
  {"path":"packages/engine/rendering/world3d/Ktx23D.ts","bytes":5513,"sha256":"83b42307f1bf4c92212c3999cdc2885daac17a1c1059398f872aefbb24e9af9b"},
  {"path":"packages/engine/rendering/world3d/Light3D.ts","bytes":4923,"sha256":"3363714fc9ce0d967f23a9e9fd504ede6d0e7ff1c1c7e3098d65e72f56c2e9a8"},
  {"path":"packages/engine/rendering/world3d/Material3D.ts","bytes":11949,"sha256":"7d24f395d30f02715ba159af72bdc4de65f14dd8dd3d87170c472bf1f03be6e6"},
  {"path":"packages/engine/rendering/world3d/Mesh3D.ts","bytes":12433,"sha256":"95f6aa7933f46b05a435f7fc8f2a240d19703dee99ef676130e85199ff6d446b"},
  {"path":"packages/engine/rendering/world3d/Object3D.ts","bytes":12412,"sha256":"5a88136cdf4ab70049703d8c3811853dd822ce944bc1fad9dcaaf9e31bc61b29"},
  {"path":"packages/engine/rendering/world3d/Particles3D.ts","bytes":14456,"sha256":"5c433510cfc40f5fe99b8945d413371ef2a8d5255543f9fdbbb1e163cd48bb13"},
  {"path":"packages/engine/rendering/world3d/Physics3D.ts","bytes":63787,"sha256":"50469a5afa503e337e01298ec8475ffcea80522c7cea9dc35ee51c1b8fbf9b43"},
  {"path":"packages/engine/rendering/world3d/PhysicsMesh3D.ts","bytes":15284,"sha256":"b944a4fd3047a9abdd6b68b492f0a56b52df759f61a41e7a166a0b7c12299652"},
  {"path":"packages/engine/rendering/world3d/Raycast3D.ts","bytes":6946,"sha256":"21b72409b80f0a29cda3a6a8504523be0225652718135adac1a169e152f55323"},
  {"path":"packages/engine/rendering/world3d/RenderList3D.ts","bytes":7097,"sha256":"1f956beaaa4c9bd14c3895a2ed71a6345f85ed514ce720c0aad99bc97117578c"},
  {"path":"packages/engine/rendering/world3d/Serialize3D.ts","bytes":26294,"sha256":"2092af315504b471140ddd4af189a93343338861d327fff310465afde4a6f418"},
  {"path":"packages/engine/rendering/world3d/StateMachine3D.ts","bytes":14136,"sha256":"24c0381ce5294d9888459ef0c637ad62d10084bd3354a06078569d8af595abf7"},
  {"path":"packages/engine/rendering/world3d/Texture3D.ts","bytes":12654,"sha256":"abae379febee1fae04b3c6e16d75d512a6be21ebd1a7f41d2182305ef72263e0"},
  {"path":"packages/engine/rendering/world3d/core3D.ts","bytes":3665,"sha256":"677ce4383c2a175f41dd1d73496fe066cac95d90ed696e85b3958cbbb381c7a2"},
  {"path":"packages/engine/rendering/world3d/debug3D.ts","bytes":10814,"sha256":"a473bfa15e881199e8877fe4eb90643d846ee145c2ccc5f568966eeb4b26d0b8"},
  {"path":"packages/engine/rendering/world3d/geometries3D.ts","bytes":28515,"sha256":"b5cfb58bae4f1c98112f0e9a1820e4967eddfb4e284f9aea1c5548a08a1847be"},
  {"path":"packages/engine/rendering/world3d/helpers3D.ts","bytes":8059,"sha256":"bc89c98f555bb9bb475913f3166667fbdd502a1401a1207da10de18b7e0f10f0"},
  {"path":"packages/engine/rendering/world3d/index.ts","bytes":6499,"sha256":"806100fca2d18252af1d70b9677f9c7e933b072097fd7e635c3cc7c9d625c7ea"},
  {"path":"packages/engine/rendering/world3d/math3D.ts","bytes":25221,"sha256":"e04d08cc5aaab47ae2a19d2a855a0ac56cc9be2c684ee5c3924b580c72523f5e"},
  {"path":"packages/engine/rendering/world3d/primitives3D.ts","bytes":11591,"sha256":"cb6ab67944d25d286dc7c2c34a6349335288027d9799dd7775d79b6d6e193aa4"},
  {"path":"packages/engine/web/world3d/Audio3D.ts","bytes":9454,"sha256":"74335f006441f5115f1c34454d44fc5eb1121ded10e323ed0cefcc8a8a1ecd58"},
  {"path":"packages/engine/web/world3d/FlyControls3D.ts","bytes":8140,"sha256":"00bb382726713aa39a1ab8eb4331c08643b880340d3e5053d5e31721c4928547"},
  {"path":"packages/engine/web/world3d/OrbitControls3D.ts","bytes":9550,"sha256":"dae24e6d27b2ffa3b1975a945077f062aa7e5471eba7ba4089f275a7645c2975"},
  {"path":"packages/engine/web/world3d/WebGL2Renderer3D.ts","bytes":41346,"sha256":"e15eeba35fff5175b7cc45eb96183106f01a823a51fad203c8a8a2d1d8b63fcd"},
  {"path":"packages/engine/web/world3d/WebGPURenderer3D.ts","bytes":77039,"sha256":"c0dc620d3633ae98e2ed55a14b3af9419a7535385183672ddbfeb5e3c7a18e72"},
  {"path":"packages/engine/web/world3d/World3DView.ts","bytes":4962,"sha256":"cfb666a5aec0a53da5b55c125779f0cf962678fe22901d44b63a6c6a8bae18e5"},
  {"path":"packages/engine/web/world3d/assets3D.ts","bytes":7124,"sha256":"1762d854141d5a05cb5be2775c4ebf29103574c7d71ac9e757d5c8af33f1ae7a"},
  {"path":"packages/engine/web/world3d/frame3D.ts","bytes":17563,"sha256":"fd8ee938e7857ec84016ad2306d04fb160ffa06b7b908b1df9ccbb609cf2250f"},
  {"path":"packages/engine/web/world3d/gpuResources3D.ts","bytes":34513,"sha256":"c2e938e0dcef2dcc3ae32003098282ccece4cea346deec9db70c64cc33fc0b34"},
  {"path":"packages/engine/web/world3d/host3D.ts","bytes":2699,"sha256":"4d00610295a36b95b527f7951a59d195878fb78b4d5c4127226e58bb1611b7ed"},
  {"path":"packages/engine/web/world3d/index.ts","bytes":1852,"sha256":"87dcb0b52464e16ffd3c04de8b5b3b2dac5ebe9361ab87098122ef5f1263a1a2"},
  {"path":"packages/engine/web/world3d/loaders3D.ts","bytes":7076,"sha256":"c38fcdaf3be2a0e5bf607a288f0c53953d0ed186c205fb8cf4c915424b5b328b"},
  {"path":"packages/engine/web/world3d/post3D.ts","bytes":23693,"sha256":"c17be0fe1461a3b1c44a41f36fcfda33d1d4cf427d6945e10082a909115c04d7"},
  {"path":"packages/engine/web/world3d/postWebGL23D.ts","bytes":11675,"sha256":"06a5a9fc5441778fc962827acd44d2ed48f970bdc23654a61a1d097fdf3e5c6c"},
  {"path":"packages/engine/web/world3d/postWebGPU3D.ts","bytes":12009,"sha256":"8b46d4be0937fccd6534252148a648e337b1d1ced2d99733521f0ab78c104560"},
  {"path":"packages/engine/web/world3d/probe3D.ts","bytes":3691,"sha256":"308be2e4bcd9b0d2f24fa8aab25fba2d9e82c612ab181f98fa11760de333f144"},
  {"path":"packages/engine/web/world3d/shaders3D.ts","bytes":21464,"sha256":"9585f7b31221bdbcaf1be623a80e6fdf1ccac4316f66227743f9c1b0d8fdc051"},
  {"path":"packages/engine/web/world3d/webgpu.ts","bytes":1826,"sha256":"fb2f1f3d299c390cfbd652995c372b6af0db3d1ce87f38e86bd037336e9299b1"},
  {"path":"packages/engine/web/world3d/wgsl3D.ts","bytes":26081,"sha256":"f15674582a37ba4aab067e4c6ec86f739723fc8d7f9ed363aaa455a92d650969"},
];
