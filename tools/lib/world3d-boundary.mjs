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
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.d.ts","bytes":3119,"sha256":"314b8c7b3061c95197e986adff58b77d8486e85e1e575ced01f5e3bdf5ef6ad4"},
  {"path":"packages/engine/dist/rendering/world3d/Gltf3D.js","bytes":40056,"sha256":"bc45430e8c1baf12cbbd80c5f5016069d7ddaa6d58717f8efd8cb79eb88c13c5"},
  {"path":"packages/engine/dist/rendering/world3d/Ktx23D.d.ts","bytes":1325,"sha256":"331fd2cb9e38e5063db1f6272c9364f69ddbb9acb7e41025f1658efd23d77273"},
  {"path":"packages/engine/dist/rendering/world3d/Ktx23D.js","bytes":4496,"sha256":"f0c118c07120fe9a252f5d95e302bb0a8e0840f06525b5b199a86c84851ce2d4"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.d.ts","bytes":3093,"sha256":"1e6831ada6adea990c1cac5cce4cf9a984c2a4bf980e7635f79b69e48d6656e8"},
  {"path":"packages/engine/dist/rendering/world3d/Light3D.js","bytes":3004,"sha256":"c5c217b312af102851d23572f80e8587a87bfaf28e3b855f6336c5e8668ea156"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.d.ts","bytes":4929,"sha256":"5ee9291b306f350133493d497df84864f76d344daa12afeb4841a840a4e9cf94"},
  {"path":"packages/engine/dist/rendering/world3d/Material3D.js","bytes":5881,"sha256":"7caa2e385ec614f2eb48dae46ad771e14db48fdffabacad91dbcc4e9c12dff9c"},
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
  {"path":"packages/engine/dist/rendering/world3d/Serialize3D.js","bytes":25412,"sha256":"94b2eb1239cadfe4f9e6f4dd8d5b1495af5082626e34284e810bc7a42b3566bb"},
  {"path":"packages/engine/dist/rendering/world3d/StateMachine3D.d.ts","bytes":3565,"sha256":"06360df6f114e413b30744a6f12c7437b11220c4de9898db919056adf77b3cb9"},
  {"path":"packages/engine/dist/rendering/world3d/StateMachine3D.js","bytes":11622,"sha256":"f73d427aed0208da6d502987dcdbd4aed6f9b9bb647c89bc51f72a3fcdc448a4"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.d.ts","bytes":5572,"sha256":"0432fecac057780a5502817748119f900916bbd89e6073baca2ba3b6497665d7"},
  {"path":"packages/engine/dist/rendering/world3d/Texture3D.js","bytes":9516,"sha256":"9b510865ddcb3ab4828317742957961b4c800b57ba03614687d925577fbee926"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.d.ts","bytes":1861,"sha256":"c4380a072e9ea3d33928938b6bcc081ef8e6e5b0bd6d09ec9a8bc92a04b9b308"},
  {"path":"packages/engine/dist/rendering/world3d/core3D.js","bytes":3213,"sha256":"ff5da5bf3509a0965378748b446db53de396c8a14cd74266fa5ef07e286689cd"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.d.ts","bytes":3383,"sha256":"201c911db5175fcc342f24962d04b8743893331c17b5efcbf29f4c9b12cd8a54"},
  {"path":"packages/engine/dist/rendering/world3d/helpers3D.js","bytes":7038,"sha256":"0e0d20d9bf2dae266fcb2aad0e9f485a2ccc086711c76a412c1293ac5ec4ccb3"},
  {"path":"packages/engine/dist/rendering/world3d/index.d.ts","bytes":4674,"sha256":"e73c1c7b743cf8ba49eb2fd3239029859c5fb716eadcb0ed812f55b04684e884"},
  {"path":"packages/engine/dist/rendering/world3d/index.js","bytes":2696,"sha256":"a9e968c8a849fdab8b16df72a3c905853d5434f2599de3eeca7f559fa26696b4"},
  {"path":"packages/engine/dist/rendering/world3d/math3D.d.ts","bytes":7222,"sha256":"075fd132d834d96d2ad5afe1f46dd048b5f1cb6116bf8955397df248cad4e2e8"},
  {"path":"packages/engine/dist/rendering/world3d/math3D.js","bytes":23075,"sha256":"19ca87fc98ca78fded36d24b52a21762c92b375d95847b033e7cf4e144823b06"},
  {"path":"packages/engine/dist/rendering/world3d/primitives3D.d.ts","bytes":2566,"sha256":"ed3f143d092319469a4978bf0667fc17a083750b7f31dcd334d42521f4bd153d"},
  {"path":"packages/engine/dist/rendering/world3d/primitives3D.js","bytes":10000,"sha256":"baff435a5b03b07c729f9cb9bc509337ceb5927aaaf24762aaf0d46a56783e6e"},
  {"path":"packages/engine/dist/web/world3d/OrbitControls3D.d.ts","bytes":2177,"sha256":"adcd7535d4dbcecad4c81560edcdb5e3c1abd7ba7460f29a0db608dde356d51b"},
  {"path":"packages/engine/dist/web/world3d/OrbitControls3D.js","bytes":8036,"sha256":"b04ba6a01eb23f55b3f30f32d71ea547ff76a0421387195a05afdaa93e3232a4"},
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.d.ts","bytes":3739,"sha256":"bd53b95ec02e6aa8025e543c1cd34b270e81b29e74b581938aa983d04cc862b7"},
  {"path":"packages/engine/dist/web/world3d/WebGL2Renderer3D.js","bytes":36679,"sha256":"576608e80ba93764d5a0336a3c04582b2abf6314165b0968ea3c3fe18eb34b58"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.d.ts","bytes":4170,"sha256":"adf872111bc39ae0194ce860643d274f8677a2c9037413bfbd7d7917c0c2c672"},
  {"path":"packages/engine/dist/web/world3d/WebGPURenderer3D.js","bytes":68411,"sha256":"2cff8f9981f63c89cd4625fc12646ef607440cf036d7c114bb95337cefc8056a"},
  {"path":"packages/engine/dist/web/world3d/World3DView.d.ts","bytes":2487,"sha256":"ae107bb493d08bdaeafd01d4e92373f0836cce8bb1c1a81e691c47063b60396d"},
  {"path":"packages/engine/dist/web/world3d/World3DView.js","bytes":2932,"sha256":"330afcc4d2811795296bddae88b8d5e70eff423ab99ab23f6d41dbb96e35420c"},
  {"path":"packages/engine/dist/web/world3d/assets3D.d.ts","bytes":2252,"sha256":"799977a073daf42105fc658f5bd42d04ca3b7931d560110aefb4729a2169c8d5"},
  {"path":"packages/engine/dist/web/world3d/assets3D.js","bytes":5229,"sha256":"2301e5c3ba34f839640dfbd131c71ebde865ae8fc712893202db889e5c3581c2"},
  {"path":"packages/engine/dist/web/world3d/frame3D.d.ts","bytes":4580,"sha256":"c0676fd15dfa561260002c4e1ae0554fe0ee2841851b022c2c1d68754e374203"},
  {"path":"packages/engine/dist/web/world3d/frame3D.js","bytes":12474,"sha256":"5e2f73e02f637c954e0d9bdc9e0be1fd8382342f0d20eb37d12f2be4f624189c"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.d.ts","bytes":3556,"sha256":"9b8a073871eaef5faa8bc2547737b27355f0b87769e96a6806130318c79fca90"},
  {"path":"packages/engine/dist/web/world3d/gpuResources3D.js","bytes":31193,"sha256":"1a97804d704962b551c41a0fd1d634dfbc8ee59e1601de86dad0c0268c5dd863"},
  {"path":"packages/engine/dist/web/world3d/host3D.d.ts","bytes":1051,"sha256":"108f3bf808667379d5e35ca7fa38ed13ace75cfde2a7c4d61440e9ec59365f12"},
  {"path":"packages/engine/dist/web/world3d/host3D.js","bytes":2150,"sha256":"5d45aea704dedcfcbf2195e6de3fffa944141b900dfb37a866666440af82bb47"},
  {"path":"packages/engine/dist/web/world3d/index.d.ts","bytes":1181,"sha256":"33ab9e4e114dd100c38c29c79c74995c562ec0ea4be9a002d2afe6ee00662b6d"},
  {"path":"packages/engine/dist/web/world3d/index.js","bytes":861,"sha256":"ecdcdb8405faf387e4fd92edf23e59eb95e033605dd3adbe59caa08d1a935325"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.d.ts","bytes":1688,"sha256":"4763fbb184cfb2aed3daa1a1f7e8c3ec0e7c4c105c2c26bb060e704be303e5ea"},
  {"path":"packages/engine/dist/web/world3d/loaders3D.js","bytes":5928,"sha256":"5b967f5756300fb5c2877aa16587a8cd64fb79a1c41f802401ef687ad80adceb"},
  {"path":"packages/engine/dist/web/world3d/post3D.d.ts","bytes":2634,"sha256":"9a6af0f27161c476b2dfaaa45e84150ca4dd5256b8d515d61e075bd831e3944f"},
  {"path":"packages/engine/dist/web/world3d/post3D.js","bytes":9986,"sha256":"e41e58bf7714fb86d64b2f710fad60dfc933567c3809c7640194bc588c541d19"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.d.ts","bytes":1088,"sha256":"94652dca8fc6198ed71876ecfd2b4d109f9611abaebf2eb62d4d14813010458f"},
  {"path":"packages/engine/dist/web/world3d/postWebGL23D.js","bytes":7599,"sha256":"a6878c7926d5f4ee3698c63a6f5fb57ec0b1b5648c09cc7a479f2a9183cd566b"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.d.ts","bytes":903,"sha256":"77c07559700ec12cdd9d64a22aa99b05d891adfa09ec056855e681e789c88390"},
  {"path":"packages/engine/dist/web/world3d/postWebGPU3D.js","bytes":7487,"sha256":"9af65d48c5c3b12229509a1f9ccfd5a07bc01fc3dc607e3d93ebad264e3757d0"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.d.ts","bytes":1283,"sha256":"2ed86ae5043c72f22f33b01268f31edc891b0900a02ea024889662c62c67469e"},
  {"path":"packages/engine/dist/web/world3d/shaders3D.js","bytes":18295,"sha256":"4bf32d3df5b2a79997eceaf37dbd07e24e5485629e3925796bc5118fe09be95c"},
  {"path":"packages/engine/dist/web/world3d/webgpu.d.ts","bytes":1182,"sha256":"3e18a0a3e1e96159a2a9cf777eecba4cf332d5c92abfd0c56d0dd4ff27fc9df2"},
  {"path":"packages/engine/dist/web/world3d/webgpu.js","bytes":836,"sha256":"317563ec7e07e20b4135ec8957cd59acecfe9f5753ace179a0fb67642ea84999"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.d.ts","bytes":3975,"sha256":"5435c8ad0c532699fdfd85c480956f322a0b5faffa2058b3018cc2380faba9fb"},
  {"path":"packages/engine/dist/web/world3d/wgsl3D.js","bytes":21377,"sha256":"68574af08a918a6f93925accc82beb505e9c0888914a7207bd8eea8080b761c6"},
  {"path":"packages/engine/rendering/world3d/Animation3D.ts","bytes":15505,"sha256":"32841bc4a625b8e28e39f1acd3bf94470a6f3799d1e3abdfeda492590175fca5"},
  {"path":"packages/engine/rendering/world3d/Camera3D.ts","bytes":5826,"sha256":"95aea52abff097f17c3c704aa60f51952aa10a6c5b8bbc14976c29da654e80c4"},
  {"path":"packages/engine/rendering/world3d/Geometry3D.ts","bytes":14604,"sha256":"e45fb458cb9f5b15919bff6910f7a88b4b4c0b7a18327dce2cf28c44fd01d38c"},
  {"path":"packages/engine/rendering/world3d/Gltf3D.ts","bytes":43646,"sha256":"f232596b317cb1e86483455ae2f229259b33093a1c21583f179d1f4ec0eca56e"},
  {"path":"packages/engine/rendering/world3d/Ktx23D.ts","bytes":5513,"sha256":"83b42307f1bf4c92212c3999cdc2885daac17a1c1059398f872aefbb24e9af9b"},
  {"path":"packages/engine/rendering/world3d/Light3D.ts","bytes":4947,"sha256":"35d3196893f44f9ae266c4b53744959629e96a57b3072c0d07009871758d8175"},
  {"path":"packages/engine/rendering/world3d/Material3D.ts","bytes":8271,"sha256":"e6aef9eb879e3f3fd03d0861ef7253d7eaaed2c58cd9af7803c5c841fa77e900"},
  {"path":"packages/engine/rendering/world3d/Mesh3D.ts","bytes":12433,"sha256":"95f6aa7933f46b05a435f7fc8f2a240d19703dee99ef676130e85199ff6d446b"},
  {"path":"packages/engine/rendering/world3d/Object3D.ts","bytes":11991,"sha256":"118aa6fbd7db938292a8167b42af4e78d1bd47427e148ccbfd42954e1df21f86"},
  {"path":"packages/engine/rendering/world3d/Particles3D.ts","bytes":14456,"sha256":"5c433510cfc40f5fe99b8945d413371ef2a8d5255543f9fdbbb1e163cd48bb13"},
  {"path":"packages/engine/rendering/world3d/Physics3D.ts","bytes":54935,"sha256":"2361b19e67a41244f1399fc5f4657b01e1b737b197f34572918c841ff091eaae"},
  {"path":"packages/engine/rendering/world3d/Raycast3D.ts","bytes":6946,"sha256":"21b72409b80f0a29cda3a6a8504523be0225652718135adac1a169e152f55323"},
  {"path":"packages/engine/rendering/world3d/RenderList3D.ts","bytes":6767,"sha256":"7951604ab3a6094682a152d77f19e8ba1b06f3fd2986578688513a41d9352409"},
  {"path":"packages/engine/rendering/world3d/Serialize3D.ts","bytes":26228,"sha256":"ce1f126bf054042f75daade0f711c83ef1589b780db3354b7025416befaba863"},
  {"path":"packages/engine/rendering/world3d/StateMachine3D.ts","bytes":14136,"sha256":"24c0381ce5294d9888459ef0c637ad62d10084bd3354a06078569d8af595abf7"},
  {"path":"packages/engine/rendering/world3d/Texture3D.ts","bytes":11850,"sha256":"91aa037e196095a87b63b9b96ab56cf0700ab4a22e548e6bb4a07dde67b9cb66"},
  {"path":"packages/engine/rendering/world3d/core3D.ts","bytes":3665,"sha256":"677ce4383c2a175f41dd1d73496fe066cac95d90ed696e85b3958cbbb381c7a2"},
  {"path":"packages/engine/rendering/world3d/helpers3D.ts","bytes":8059,"sha256":"bc89c98f555bb9bb475913f3166667fbdd502a1401a1207da10de18b7e0f10f0"},
  {"path":"packages/engine/rendering/world3d/index.ts","bytes":4913,"sha256":"381f7eec3a33735c9dc7c460859a0b841365473be0b49d041953cbd49c8b2e7d"},
  {"path":"packages/engine/rendering/world3d/math3D.ts","bytes":25221,"sha256":"e04d08cc5aaab47ae2a19d2a855a0ac56cc9be2c684ee5c3924b580c72523f5e"},
  {"path":"packages/engine/rendering/world3d/primitives3D.ts","bytes":11591,"sha256":"cb6ab67944d25d286dc7c2c34a6349335288027d9799dd7775d79b6d6e193aa4"},
  {"path":"packages/engine/web/world3d/OrbitControls3D.ts","bytes":9550,"sha256":"dae24e6d27b2ffa3b1975a945077f062aa7e5471eba7ba4089f275a7645c2975"},
  {"path":"packages/engine/web/world3d/WebGL2Renderer3D.ts","bytes":37903,"sha256":"0eec4993e23a669ce228dabd8b1bc7e37061c526769aa382e14d1df15e742150"},
  {"path":"packages/engine/web/world3d/WebGPURenderer3D.ts","bytes":73528,"sha256":"10aa4b91b27f8981a1c1620f2bcc6e18825121074dee50bf3c8385d72b8b5bff"},
  {"path":"packages/engine/web/world3d/World3DView.ts","bytes":4962,"sha256":"cfb666a5aec0a53da5b55c125779f0cf962678fe22901d44b63a6c6a8bae18e5"},
  {"path":"packages/engine/web/world3d/assets3D.ts","bytes":7124,"sha256":"1762d854141d5a05cb5be2775c4ebf29103574c7d71ac9e757d5c8af33f1ae7a"},
  {"path":"packages/engine/web/world3d/frame3D.ts","bytes":15365,"sha256":"e32ad2bc7fb0b7e0ad25d2c1212af2a9acec959ef4d54d6235b20b5c80601313"},
  {"path":"packages/engine/web/world3d/gpuResources3D.ts","bytes":33341,"sha256":"fe40245ba0f87020a0195693cbffacadc7e7fc04218e745a07aa6c0716dbc72a"},
  {"path":"packages/engine/web/world3d/host3D.ts","bytes":2699,"sha256":"4d00610295a36b95b527f7951a59d195878fb78b4d5c4127226e58bb1611b7ed"},
  {"path":"packages/engine/web/world3d/index.ts","bytes":1362,"sha256":"048f7437152fcd8f98d6f070e03b0b00f8f7e7a565ee6cebe4e312996e9ee723"},
  {"path":"packages/engine/web/world3d/loaders3D.ts","bytes":7076,"sha256":"c38fcdaf3be2a0e5bf607a288f0c53953d0ed186c205fb8cf4c915424b5b328b"},
  {"path":"packages/engine/web/world3d/post3D.ts","bytes":11509,"sha256":"887603b9504ae46cf94162bf07258f7a22f4425d8e40a83d33d160ee51d36cfd"},
  {"path":"packages/engine/web/world3d/postWebGL23D.ts","bytes":8142,"sha256":"936c03149be0814fe3617830112119f6b11b78f7dcdf6cb3913617d9344b9c66"},
  {"path":"packages/engine/web/world3d/postWebGPU3D.ts","bytes":8384,"sha256":"b5e3a9312f009694a0bd41ea71ca45af8bc8d784f1cfea44c5bad2b9f7e459d3"},
  {"path":"packages/engine/web/world3d/shaders3D.ts","bytes":18427,"sha256":"ba8826eb592facdf61a15bd21fc08c6d2a900d28ba93184cfcb446c0731add97"},
  {"path":"packages/engine/web/world3d/webgpu.ts","bytes":1336,"sha256":"8673566e06becace299c80db14db2762ea9d2139a9d4e9c644f8e2d9deec08b1"},
  {"path":"packages/engine/web/world3d/wgsl3D.ts","bytes":22456,"sha256":"3a3bbd2018cbca001daaa6358146345acdc06ba5e38159c0877416e943a95a8b"},
];
