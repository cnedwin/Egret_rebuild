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
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.js","bytes":40056,"sha256":"bc45430e8c1baf12cbbd80c5f5016069d7ddaa6d58717f8efd8cb79eb88c13c5"},
  {"path":"packages/engine/dist/rendering/world3d/Hdr3D.d.ts","bytes":1390,"sha256":"efb5ef84a1461473a3644e79b31b7b7412fbfdee780fc6fd044f3b5a8e73bc1f"},
  {"path":"packages/engine/dist/rendering/world3d/Hdr3D.js","bytes":8069,"sha256":"04428d7b412ad6c4c73bf7229be1a588b57a3b691c5cb4da8a2572bc36f848ae"},
  {"path":"packages/engine/dist/rendering/world3d/Ktx23D.d.ts","bytes":1325,"sha256":"331fd2cb9e38e5063db1f6272c9364f69ddbb9acb7e41025f1658efd23d77273"},
  {"path":"packages/engine/dist/rendering/world3d/Ktx23D.js","bytes":4496,"sha256":"f0c118c07120fe9a252f5d95e302bb0a8e0840f06525b5b199a86c84851ce2d4"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.d.ts","bytes":3093,"sha256":"1e6831ada6adea990c1cac5cce4cf9a984c2a4bf980e7635f79b69e48d6656e8"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.js","bytes":2978,"sha256":"6855c60deba1c9886cf8a3430dfb56ffca113d01fa25dc3ab05e3ab8690c168f"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.d.ts","bytes":6855,"sha256":"8841f07ec8d2b09a30c3e9d6df0f595f70bd953f18a2f43b9e329bb4efd09e4f"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.js","bytes":7468,"sha256":"a6fc198ce5b9fa7e1a960781912a692e6138108644ca1c2b4eeba77e6f8db9a5"},
  {"path":"packages/engine/dist/rendering/world3d/Mesh3D.d.ts","bytes":4131,"sha256":"581bce14ab93b5618073e021d50046c6f5484404d209063d74c40f95598e7ee7"},
  {"path":"packages/engine/dist/rendering/world3d/Mesh3D.js","bytes":11689,"sha256":"00dde05a5c752d397aa9211f72242af1bf8bdf846334c3516b87d36c5931fbfa"},
  {"path":"packages/engine/dist/rendering/world3d/Object3D.d.ts","bytes":4764,"sha256":"00592ed85d8939ae358d5e705581802b07e3a271667dea773483fd2c5bbb76ba"},
  {"path":"packages/engine/dist/rendering/world3d/Object3D.js","bytes":10865,"sha256":"594558794120088beb4e0f8cb8ba69f80078616126fa46aacede4ec16175758b"},
  {"path":"packages/engine/dist/rendering/world3d/Particles3D.d.ts","bytes":3740,"sha256":"664e687d71f43b0ed593d9b1b481cbe974ae8ca3201fe8492718698ed2926172"},
  {"path":"packages/engine/dist/rendering/world3d/Particles3D.js","bytes":12528,"sha256":"4384ff747b2300d84c5ab9c7d72f47ee6adf53328df0978ebfddeafd8b0debe2"},
  {"path":"packages/engine/dist/rendering/world3d/Physics3D.d.ts","bytes":7774,"sha256":"7c92100bc8ba6912affd55fbe968e9d9841d390b3153393fad110ded7f98df71"},
  {"path":"packages/engine/dist/rendering/world3d/Physics3D.js","bytes":51442,"sha256":"67d6fcac16b8e75f3278393fd3fb054c648effadf893cec8128e72f12169795d"},
  {"path":"packages/engine/dist/rendering/world3d/Raycast3D.d.ts","bytes":1686,"sha256":"f51484af8550ff3cdbba25c587e8553bbb0320a3ccf47a4a798b011f762385cd"},
  {"path":"packages/engine/dist/rendering/world3d/Raycast3D.js","bytes":5856,"sha256":"ba001fd96a64900374460d346f9ac5648d7749c3aad10274f9bae3b0d1b34ddf"},
  {"path":"packages/engine/dist/rendering/world3d/RenderList3D.d.ts","bytes":1667,"sha256":"17b2c53cd5260ed395612dbdbef0359cac31f179eadef2036178d620804d2711"},
  {"path":"packages/engine/dist/rendering/world3d/RenderList3D.js","bytes":5910,"sha256":"7b16c5d4cc1b92f12ba0c49c3a3280d7274e1dcb824093baab6dc188bae65ab2"},
  {"path":"packages/engine/dist/rendering/world3d/Serialize3D.d.ts","bytes":2244,"sha256":"c0b8936886994587f9c818585a3a86950a6f9afb4654a18b750508d8c860553a"},
  {"path":"packages/engine/dist/rendering/world3d/Serialize3D.js","bytes":25478,"sha256":"dcff2bc33a23c70404ccfe22e3fb3d92bf4a949c5077126612cc0d1db0cc209e"},
  {"path":"packages/engine/dist/rendering/world3d/StateMachine3D.d.ts","bytes":3565,"sha256":"06360df6f114e413b30744a6f12c7437b11220c4de9898db919056adf77b3cb9"},
  {"path":"packages/engine/dist/rendering/world3d/StateMachine3D.js","bytes":11622,"sha256":"f73d427aed0208da6d502987dcdbd4aed6f9b9bb647c89bc51f72a3fcdc448a4"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.d.ts","bytes":5572,"sha256":"0432fecac057780a5502817748119f900916bbd89e6073baca2ba3b6497665d7"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.js","bytes":9516,"sha256":"9b510865ddcb3ab4828317742957961b4c800b57ba03614687d925577fbee926"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.d.ts","bytes":1861,"sha256":"c4380a072e9ea3d33928938b6bcc081ef8e6e5b0bd6d09ec9a8bc92a04b9b308"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.js","bytes":3213,"sha256":"ff5da5bf3509a0965378748b446db53de396c8a14cd74266fa5ef07e286689cd"},
  {"path":"packages/engine/dist/rendering/world3d/debug3D.d.ts","bytes":3100,"sha256":"6f3634e7e20a2894bafd179bcbbfb264874dde1ee167e4673b33c4920a2c1b83"},
  {"path":"packages/engine/dist/rendering/world3d/debug3D.js","bytes":10078,"sha256":"8575166568f753495a7fdbb508a513af3673e1d70359925cf56791b19b254cc2"},
  {"path":"packages/engine/dist/rendering/world3d/geometries3D.d.ts","bytes":5009,"sha256":"25f2b1034b2abb44a963bc0886360aa4231255e0a8b6c069db9b12691169ecb5"},
  {"path":"packages/engine/dist/rendering/world3d/geometries3D.js","bytes":26469,"sha256":"c41019a0fb1585522b876f520b9ceae8734ada96308c7897d577dbf4f9ff2b90"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.d.ts","bytes":3383,"sha256":"201c911db5175fcc342f24962d04b8743893331c17b5efcbf29f4c9b12cd8a54"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.js","bytes":7038,"sha256":"0e0d20d9bf2dae266fcb2aad0e9f485a2ccc086711c76a412c1293ac5ec4ccb3"},
  {"path":"packages/engine/dist/rendering/world3d/index.d.ts","bytes":6128,"sha256":"3ce2bff8a99c782349bede1f7d73a3978645757813bb950ed985ecc1e50c13a8"},
  {"path":"packages/engine/dist/rendering/world3d/index.js","bytes":3784,"sha256":"6c7eb9428360b6ceaec7c573273c1834d73f8c689de9b02603d817e055b4d143"},
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
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.js","bytes":38072,"sha256":"eea7d9559ee21682ea863f633a7d6313402091f02faee9c1c38fc1d8758b170f"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.d.ts","bytes":4263,"sha256":"49c2aaf36b63fcc3f68cfe333270a5dfe8940d1ba52eb629212d9cdfc1bf78ac"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.js","bytes":69819,"sha256":"457b0bbc910bc73303060379fe22a2e25a9b4d876555b1d9e4ff4716a7d7de06"},
  {"path":"packages/engine/dist/web/world3d/World3DView.d.ts","bytes":2487,"sha256":"ae107bb493d08bdaeafd01d4e92373f0836cce8bb1c1a81e691c47063b60396d"},
  {"path":"packages/engine/dist/web/world3d/World3DView.js","bytes":2932,"sha256":"330afcc4d2811795296bddae88b8d5e70eff423ab99ab23f6d41dbb96e35420c"},
  {"path":"packages/engine/dist/web/world3d/assets3D.d.ts","bytes":2252,"sha256":"799977a073daf42105fc658f5bd42d04ca3b7931d560110aefb4729a2169c8d5"},
  {"path":"packages/engine/dist/web/world3d/assets3D.js","bytes":5229,"sha256":"2301e5c3ba34f839640dfbd131c71ebde865ae8fc712893202db889e5c3581c2"},
  {"path":"packages/engine/dist/web/world3d/frame3D.d.ts","bytes":5122,"sha256":"8efeb4b720cea0533b0f8b63d525113322e20693da04549d4721d73e3551fdc3"},
  {"path":"packages/engine/dist/web/world3d/frame3D.js","bytes":13913,"sha256":"b21bd4efcf3d7baf1b286c5e7b7a1f0a6c374488dfce869963d9e47c5e546944"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.d.ts","bytes":3556,"sha256":"9b8a073871eaef5faa8bc2547737b27355f0b87769e96a6806130318c79fca90"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.js","bytes":31193,"sha256":"1a97804d704962b551c41a0fd1d634dfbc8ee59e1601de86dad0c0268c5dd863"},
  {"path":"packages/engine/dist/web/world3d/host3D.d.ts","bytes":1051,"sha256":"108f3bf808667379d5e35ca7fa38ed13ace75cfde2a7c4d61440e9ec59365f12"},
  {"path":"packages/engine/dist/web/world3d/host3D.js","bytes":2150,"sha256":"5d45aea704dedcfcbf2195e6de3fffa944141b900dfb37a866666440af82bb47"},
  {"path":"packages/engine/dist/web/world3d/index.d.ts","bytes":1649,"sha256":"c3129706e6a966ea8a9706dd2ec345c6537969cecdbdeaa16a85ae1dfa69fa38"},
  {"path":"packages/engine/dist/web/world3d/index.js","bytes":1102,"sha256":"40a480cc6647984660b0b61612b1cf9086c38bfedbc5bbcd01cb5384bbfcd23a"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.d.ts","bytes":1688,"sha256":"4763fbb184cfb2aed3daa1a1f7e8c3ec0e7c4c105c2c26bb060e704be303e5ea"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.js","bytes":5928,"sha256":"5b967f5756300fb5c2877aa16587a8cd64fb79a1c41f802401ef687ad80adceb"},
  {"path":"packages/engine/dist/web/world3d/post3D.d.ts","bytes":2634,"sha256":"9a6af0f27161c476b2dfaaa45e84150ca4dd5256b8d515d61e075bd831e3944f"},
  {"path":"packages/engine/dist/web/world3d/post3D.js","bytes":9986,"sha256":"e41e58bf7714fb86d64b2f710fad60dfc933567c3809c7640194bc588c541d19"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.d.ts","bytes":1088,"sha256":"94652dca8fc6198ed71876ecfd2b4d109f9611abaebf2eb62d4d14813010458f"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.js","bytes":7599,"sha256":"a6878c7926d5f4ee3698c63a6f5fb57ec0b1b5648c09cc7a479f2a9183cd566b"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.d.ts","bytes":903,"sha256":"77c07559700ec12cdd9d64a22aa99b05d891adfa09ec056855e681e789c88390"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.js","bytes":7487,"sha256":"9af65d48c5c3b12229509a1f9ccfd5a07bc01fc3dc607e3d93ebad264e3757d0"},
  {"path":"packages/engine/dist/web/world3d/probe3D.d.ts","bytes":761,"sha256":"daa9a0f1baf474e8e55de600ff86eec476e53ce84f14e783d9a875802709c322"},
  {"path":"packages/engine/dist/web/world3d/probe3D.js","bytes":3297,"sha256":"c083d946fa3d5fbb995330f5ce3aa1d599b9d8006320a2f206d26bab5f3e8a5c"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.d.ts","bytes":1308,"sha256":"a3898be1fd702a792e765ef291a3fbfc2efe1b17f9c27f13e0ef18e6e51be5d5"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.js","bytes":20375,"sha256":"4f6aa590c86dffc9f0f1e45892d3e6179e2d43f9aa3623f5c0ca35dbc57032ea"},
  {"path":"packages/engine/dist/web/world3d/webgpu.d.ts","bytes":1650,"sha256":"da21d490606d85f319f8a2086a10e49e9a1ea9cf202963c0dc5c096e3f656c8d"},
  {"path":"packages/engine/dist/web/world3d/webgpu.js","bytes":1077,"sha256":"a5d87213e7d6c4c1bfcf004a7ddbed9feea2c5459d7b13e73d30a2832f2ffc78"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.d.ts","bytes":4143,"sha256":"898d2bd1a2161945da7e075eaa3e978243b4236909fd2403098adc0396b47fa5"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.js","bytes":23891,"sha256":"af7d3fab55ca7b68c9832a1b661bd1bc0d71cec79048d9a940edb35cc96d27ea"},
  {"path":"packages/engine/rendering/world3d/Animation3D.ts","bytes":15505,"sha256":"32841bc4a625b8e28e39f1acd3bf94470a6f3799d1e3abdfeda492590175fca5"},
  {"path":"packages/engine/rendering/world3d/Camera3D.ts","bytes":5826,"sha256":"95aea52abff097f17c3c704aa60f51952aa10a6c5b8bbc14976c29da654e80c4"},
  {"path":"packages/engine/rendering/world3d/Curves3D.ts","bytes":20209,"sha256":"9bf2b507b704f900238355c87c5e4cb3bf4c4cce05d53984d8d025c33ae4b4b0"},
  {"path":"packages/engine/rendering/world3d/Geometry3D.ts","bytes":14604,"sha256":"e45fb458cb9f5b15919bff6910f7a88b4b4c0b7a18327dce2cf28c44fd01d38c"},
  {"path":"packages/engine/rendering/world3d/Gltf3D.ts","bytes":43646,"sha256":"f232596b317cb1e86483455ae2f229259b33093a1c21583f179d1f4ec0eca56e"},
  {"path":"packages/engine/rendering/world3d/Hdr3D.ts","bytes":7725,"sha256":"884b2f136ae3c6418c4ff1af3deff725b2a6b9acc582bff5eda8feb2f271d9ea"},
  {"path":"packages/engine/rendering/world3d/Ktx23D.ts","bytes":5513,"sha256":"83b42307f1bf4c92212c3999cdc2885daac17a1c1059398f872aefbb24e9af9b"},
  {"path":"packages/engine/rendering/world3d/Light3D.ts","bytes":4923,"sha256":"3363714fc9ce0d967f23a9e9fd504ede6d0e7ff1c1c7e3098d65e72f56c2e9a8"},
  {"path":"packages/engine/rendering/world3d/Material3D.ts","bytes":10992,"sha256":"11f291a6ce8f13dd2744fa917c39f26860b53862d90c4de154c25ecfefc422f8"},
  {"path":"packages/engine/rendering/world3d/Mesh3D.ts","bytes":12433,"sha256":"95f6aa7933f46b05a435f7fc8f2a240d19703dee99ef676130e85199ff6d446b"},
  {"path":"packages/engine/rendering/world3d/Object3D.ts","bytes":11991,"sha256":"118aa6fbd7db938292a8167b42af4e78d1bd47427e148ccbfd42954e1df21f86"},
  {"path":"packages/engine/rendering/world3d/Particles3D.ts","bytes":14456,"sha256":"5c433510cfc40f5fe99b8945d413371ef2a8d5255543f9fdbbb1e163cd48bb13"},
  {"path":"packages/engine/rendering/world3d/Physics3D.ts","bytes":54935,"sha256":"2361b19e67a41244f1399fc5f4657b01e1b737b197f34572918c841ff091eaae"},
  {"path":"packages/engine/rendering/world3d/Raycast3D.ts","bytes":6946,"sha256":"21b72409b80f0a29cda3a6a8504523be0225652718135adac1a169e152f55323"},
  {"path":"packages/engine/rendering/world3d/RenderList3D.ts","bytes":6767,"sha256":"7951604ab3a6094682a152d77f19e8ba1b06f3fd2986578688513a41d9352409"},
  {"path":"packages/engine/rendering/world3d/Serialize3D.ts","bytes":26294,"sha256":"2092af315504b471140ddd4af189a93343338861d327fff310465afde4a6f418"},
  {"path":"packages/engine/rendering/world3d/StateMachine3D.ts","bytes":14136,"sha256":"24c0381ce5294d9888459ef0c637ad62d10084bd3354a06078569d8af595abf7"},
  {"path":"packages/engine/rendering/world3d/Texture3D.ts","bytes":11850,"sha256":"91aa037e196095a87b63b9b96ab56cf0700ab4a22e548e6bb4a07dde67b9cb66"},
  {"path":"packages/engine/rendering/world3d/core3D.ts","bytes":3665,"sha256":"677ce4383c2a175f41dd1d73496fe066cac95d90ed696e85b3958cbbb381c7a2"},
  {"path":"packages/engine/rendering/world3d/debug3D.ts","bytes":10814,"sha256":"a473bfa15e881199e8877fe4eb90643d846ee145c2ccc5f568966eeb4b26d0b8"},
  {"path":"packages/engine/rendering/world3d/geometries3D.ts","bytes":28515,"sha256":"b5cfb58bae4f1c98112f0e9a1820e4967eddfb4e284f9aea1c5548a08a1847be"},
  {"path":"packages/engine/rendering/world3d/helpers3D.ts","bytes":8059,"sha256":"bc89c98f555bb9bb475913f3166667fbdd502a1401a1207da10de18b7e0f10f0"},
  {"path":"packages/engine/rendering/world3d/index.ts","bytes":6401,"sha256":"16d8e7eee55b908072e3f4a722dbd22dee20cc4dfed7b162e8a83cd96922693f"},
  {"path":"packages/engine/rendering/world3d/math3D.ts","bytes":25221,"sha256":"e04d08cc5aaab47ae2a19d2a855a0ac56cc9be2c684ee5c3924b580c72523f5e"},
  {"path":"packages/engine/rendering/world3d/primitives3D.ts","bytes":11591,"sha256":"cb6ab67944d25d286dc7c2c34a6349335288027d9799dd7775d79b6d6e193aa4"},
  {"path":"packages/engine/web/world3d/Audio3D.ts","bytes":9454,"sha256":"74335f006441f5115f1c34454d44fc5eb1121ded10e323ed0cefcc8a8a1ecd58"},
  {"path":"packages/engine/web/world3d/FlyControls3D.ts","bytes":8140,"sha256":"00bb382726713aa39a1ab8eb4331c08643b880340d3e5053d5e31721c4928547"},
  {"path":"packages/engine/web/world3d/OrbitControls3D.ts","bytes":9550,"sha256":"dae24e6d27b2ffa3b1975a945077f062aa7e5471eba7ba4089f275a7645c2975"},
  {"path":"packages/engine/web/world3d/WebGL2Renderer3D.ts","bytes":39288,"sha256":"518184f208063d404247c855799bd3076197e8f9072d668ca131a514e7ec410f"},
  {"path":"packages/engine/web/world3d/WebGPURenderer3D.ts","bytes":74968,"sha256":"5cb3e37e1f856e9a3ce6378f95e44bd03df33361f3da63560a2e3b4bf2b7d42b"},
  {"path":"packages/engine/web/world3d/World3DView.ts","bytes":4962,"sha256":"cfb666a5aec0a53da5b55c125779f0cf962678fe22901d44b63a6c6a8bae18e5"},
  {"path":"packages/engine/web/world3d/assets3D.ts","bytes":7124,"sha256":"1762d854141d5a05cb5be2775c4ebf29103574c7d71ac9e757d5c8af33f1ae7a"},
  {"path":"packages/engine/web/world3d/frame3D.ts","bytes":17329,"sha256":"009dc928e9127adf0f9c92718810ff1155607a60f5680d9123f8e8ed58d24a58"},
  {"path":"packages/engine/web/world3d/gpuResources3D.ts","bytes":33341,"sha256":"fe40245ba0f87020a0195693cbffacadc7e7fc04218e745a07aa6c0716dbc72a"},
  {"path":"packages/engine/web/world3d/host3D.ts","bytes":2699,"sha256":"4d00610295a36b95b527f7951a59d195878fb78b4d5c4127226e58bb1611b7ed"},
  {"path":"packages/engine/web/world3d/index.ts","bytes":1818,"sha256":"6525dc89d093e966c987541968c947748ee5ec969cbc9763f8415c5c290e8f12"},
  {"path":"packages/engine/web/world3d/loaders3D.ts","bytes":7076,"sha256":"c38fcdaf3be2a0e5bf607a288f0c53953d0ed186c205fb8cf4c915424b5b328b"},
  {"path":"packages/engine/web/world3d/post3D.ts","bytes":11509,"sha256":"887603b9504ae46cf94162bf07258f7a22f4425d8e40a83d33d160ee51d36cfd"},
  {"path":"packages/engine/web/world3d/postWebGL23D.ts","bytes":8142,"sha256":"936c03149be0814fe3617830112119f6b11b78f7dcdf6cb3913617d9344b9c66"},
  {"path":"packages/engine/web/world3d/postWebGPU3D.ts","bytes":8384,"sha256":"b5e3a9312f009694a0bd41ea71ca45af8bc8d784f1cfea44c5bad2b9f7e459d3"},
  {"path":"packages/engine/web/world3d/probe3D.ts","bytes":3691,"sha256":"308be2e4bcd9b0d2f24fa8aab25fba2d9e82c612ab181f98fa11760de333f144"},
  {"path":"packages/engine/web/world3d/shaders3D.ts","bytes":20507,"sha256":"584d01c3941fdfb1d9ed4526dc62012afb43d07f4f30f5d3ec4a9c6af9300cb5"},
  {"path":"packages/engine/web/world3d/webgpu.ts","bytes":1792,"sha256":"f00ab123757b7bc399b8a47534924bab5d14b15177865383cfae69a876438056"},
  {"path":"packages/engine/web/world3d/wgsl3D.ts","bytes":25127,"sha256":"859ecf864f81b5a7eb42de170b2d2c063306ab47d721228d3d220f6128c6b8bf"},
];
