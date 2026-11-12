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
  {"path":"packages/engine/dist/rendering/world3d/Curves3D.d.ts","bytes":4844,"sha256":"bdc0e0199f73bd6da8ade5638485ebfb33ec3c6337d9246cb543ed15f09c291d"},
  {"path":"packages/engine/dist/rendering/world3d/Curves3D.js","bytes":19222,"sha256":"25c2dbb8b1a4395fa94b30964f45ad5c6f5b64b99297573f4cbc7f0048cd30ce"},
  {"path":"packages/engine/dist/rendering/world3d/Geometry3D.d.ts","bytes":3546,"sha256":"ab49cbe58083a88e48a81b41af3d1dfd0ef00e38c717912929839f3ca32a9d96"},
  {"path":"packages/engine/dist/rendering/world3d/Geometry3D.js","bytes":13874,"sha256":"5646c362d6ca2ae93eaca5086924014f7831e98320a7e17910973539a1da2a70"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.d.ts","bytes":3119,"sha256":"314b8c7b3061c95197e986adff58b77d8486e85e1e575ced01f5e3bdf5ef6ad4"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.js","bytes":43331,"sha256":"d44e8bbc5aef62d385eab010619a65636e0b257b45aa9eb93c31095ef2674467"},
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
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.d.ts","bytes":5748,"sha256":"553485e9b07bb2e2f3bd23427d33f3cd4e42d2de20ef372ecfc93b7471eec682"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.js","bytes":9609,"sha256":"cf4e8e346a956d0c93dff4b400e0a8f0038453bf611df9fd81d9a7fcc8d50dbb"},
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
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.js","bytes":39513,"sha256":"bed271a6d1a62f49d894311eb7391eef62c7b216ff0f5e085c86c4d85417efce"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.d.ts","bytes":4263,"sha256":"49c2aaf36b63fcc3f68cfe333270a5dfe8940d1ba52eb629212d9cdfc1bf78ac"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.js","bytes":71384,"sha256":"cd7a323b99ab0787838b54c8a121f4b342911054affbd4e1d7ff402329bc4d9b"},
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
  {"path":"packages/engine/dist/web/world3d/post3D.d.ts","bytes":5554,"sha256":"2e928151c67102e4d49549236844202481a38d0e4cdcef5f5fb33d0d8a6229ff"},
  {"path":"packages/engine/dist/web/world3d/post3D.js","bytes":19079,"sha256":"4a0c872b3b5bbc9b5b88da570c5f4fcd503464d5c1be697b2688d110c74a8876"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.d.ts","bytes":1403,"sha256":"52e1055ef42929fd9a3bcbc4362850d8c95826e764f29a70ac8003b71ed772af"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.js","bytes":10957,"sha256":"4b13453831c8f50d9d97cf5759ec6bf8bd2a9a55c0a2385398a0e854b22d69d4"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.d.ts","bytes":1216,"sha256":"b27bfa18620396b5d6a53297f1628ee1eb5c0f76d31f6ad97d1ff8883372798e"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.js","bytes":10784,"sha256":"1bf626572deb1545118d12aca18f28839686c49968ad05fbdb933088e85624be"},
  {"path":"packages/engine/dist/web/world3d/probe3D.d.ts","bytes":761,"sha256":"daa9a0f1baf474e8e55de600ff86eec476e53ce84f14e783d9a875802709c322"},
  {"path":"packages/engine/dist/web/world3d/probe3D.js","bytes":3297,"sha256":"c083d946fa3d5fbb995330f5ce3aa1d599b9d8006320a2f206d26bab5f3e8a5c"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.d.ts","bytes":1331,"sha256":"f017d27903503f868833cdc0aa6d40216a6fe2f14c59999e132dc0bd6665467d"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.js","bytes":21048,"sha256":"cea3e4514f3b5d278f3337ae2fb5bf5c840ca0729fff9ba6b711bc176e5b7c37"},
  {"path":"packages/engine/dist/web/world3d/webgpu.d.ts","bytes":1684,"sha256":"f5fa720cc41dee8deb1c9cbc7af55da76a77bebe463622ff4db5f9f95dd3d9e6"},
  {"path":"packages/engine/dist/web/world3d/webgpu.js","bytes":1097,"sha256":"59d4b55bd3c03a1c7d0dce6cc50ee6e3f14a12636e606e9578fb530fe2e05468"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.d.ts","bytes":4183,"sha256":"cefdb2359208fd4e7ba0d494ddf4bc7db450b898615f1fb7ea420995fa6c3871"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.js","bytes":24376,"sha256":"88a725cf19491dfe06b84e47f5c5fa30e3d9002315553c9e1b101d9050ab8645"},
  {"path":"packages/engine/rendering/world3d/Animation3D.ts","bytes":15505,"sha256":"32841bc4a625b8e28e39f1acd3bf94470a6f3799d1e3abdfeda492590175fca5"},
  {"path":"packages/engine/rendering/world3d/Camera3D.ts","bytes":5826,"sha256":"95aea52abff097f17c3c704aa60f51952aa10a6c5b8bbc14976c29da654e80c4"},
  {"path":"packages/engine/rendering/world3d/Curves3D.ts","bytes":20209,"sha256":"9bf2b507b704f900238355c87c5e4cb3bf4c4cce05d53984d8d025c33ae4b4b0"},
  {"path":"packages/engine/rendering/world3d/Geometry3D.ts","bytes":14604,"sha256":"e45fb458cb9f5b15919bff6910f7a88b4b4c0b7a18327dce2cf28c44fd01d38c"},
  {"path":"packages/engine/rendering/world3d/Gltf3D.ts","bytes":46715,"sha256":"b74577f37b85434fd5af25cb92f09fe346b0ecb64e9001a7a9ee384d11164644"},
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
  {"path":"packages/engine/rendering/world3d/Texture3D.ts","bytes":12101,"sha256":"4c59c6baa990c2e5b8c965f44dc205d06fb3715a29f1fe2df4e64986a2438e94"},
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
  {"path":"packages/engine/web/world3d/WebGL2Renderer3D.ts","bytes":40565,"sha256":"68b134d8d0a8c37cf34701576bb74f436a48eeed57e4376fbc4949c9b4876245"},
  {"path":"packages/engine/web/world3d/WebGPURenderer3D.ts","bytes":76381,"sha256":"206b053afb03d89e7fe8fb39623addf714bc0a8014fb1ca3e7345f7123780b79"},
  {"path":"packages/engine/web/world3d/World3DView.ts","bytes":4962,"sha256":"cfb666a5aec0a53da5b55c125779f0cf962678fe22901d44b63a6c6a8bae18e5"},
  {"path":"packages/engine/web/world3d/assets3D.ts","bytes":7124,"sha256":"1762d854141d5a05cb5be2775c4ebf29103574c7d71ac9e757d5c8af33f1ae7a"},
  {"path":"packages/engine/web/world3d/frame3D.ts","bytes":17563,"sha256":"fd8ee938e7857ec84016ad2306d04fb160ffa06b7b908b1df9ccbb609cf2250f"},
  {"path":"packages/engine/web/world3d/gpuResources3D.ts","bytes":34513,"sha256":"c2e938e0dcef2dcc3ae32003098282ccece4cea346deec9db70c64cc33fc0b34"},
  {"path":"packages/engine/web/world3d/host3D.ts","bytes":2699,"sha256":"4d00610295a36b95b527f7951a59d195878fb78b4d5c4127226e58bb1611b7ed"},
  {"path":"packages/engine/web/world3d/index.ts","bytes":1852,"sha256":"87dcb0b52464e16ffd3c04de8b5b3b2dac5ebe9361ab87098122ef5f1263a1a2"},
  {"path":"packages/engine/web/world3d/loaders3D.ts","bytes":7076,"sha256":"c38fcdaf3be2a0e5bf607a288f0c53953d0ed186c205fb8cf4c915424b5b328b"},
  {"path":"packages/engine/web/world3d/post3D.ts","bytes":22806,"sha256":"a80dd684ebacbe1d7185627471a9d81b128255c8bba8d55d5b3cc3c5716e2fe1"},
  {"path":"packages/engine/web/world3d/postWebGL23D.ts","bytes":11536,"sha256":"ab1f5b6eab908754d71b9be609db857d2f8ff490f070d1715d019343ffd1ec57"},
  {"path":"packages/engine/web/world3d/postWebGPU3D.ts","bytes":11980,"sha256":"48c7e2ce5f6ca7cf707ca45deadfe930476f07e6fc861da20c9454a293319fa7"},
  {"path":"packages/engine/web/world3d/probe3D.ts","bytes":3691,"sha256":"308be2e4bcd9b0d2f24fa8aab25fba2d9e82c612ab181f98fa11760de333f144"},
  {"path":"packages/engine/web/world3d/shaders3D.ts","bytes":21180,"sha256":"76828f9fc1a3bf4f50c344a46b9fc95681b0d12bf170ce7b6d728729f333edb1"},
  {"path":"packages/engine/web/world3d/webgpu.ts","bytes":1826,"sha256":"fb2f1f3d299c390cfbd652995c372b6af0db3d1ce87f38e86bd037336e9299b1"},
  {"path":"packages/engine/web/world3d/wgsl3D.ts","bytes":25652,"sha256":"ac427b3eaba6226c14cd1e19e8d108a4c89ca3b29dcc692b09419a1eff2c3986"},
];
