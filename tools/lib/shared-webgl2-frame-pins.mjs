// SPDX-License-Identifier: Apache-2.0
// The opt-in frame timing and working attachment qualification were reviewed as one exact group.
import { fingerprintFile } from './file-identity.mjs';

const transitions = [
  {"base":{"path":"packages/engine/web/WebGL2Host.ts","bytes":114059,"sha256":"33f663959b9608bc7b7cd365fa3816fcb30f246b059d6cc355297a59097946e2"},"current":{"path":"packages/engine/web/WebGL2Host.ts","bytes":117891,"sha256":"89e78b1e48c783acf3a0b25a03d631be6c0c9bf004cd78894884131c80323a49"}},
  {"base":{"path":"packages/engine/dist/web/WebGL2Host.js","bytes":121421,"sha256":"3ef87e05d9aba08f12bdbdebaca026b3ee177fe7aed46044ad722f9ddc106ec4"},"current":{"path":"packages/engine/dist/web/WebGL2Host.js","bytes":125569,"sha256":"42607b13d149efcbbf9c7e3378cf97ec7ce0321d389535df57b3953cd126c98e"}},
  {"base":{"path":"packages/engine/web/sharedWebGL2Options.ts","bytes":3981,"sha256":"fb93c16410adcea2978382e02125893cbe7fa7f5dfe715ad168bcdfde1a14cb9"},"current":{"path":"packages/engine/web/sharedWebGL2Options.ts","bytes":4384,"sha256":"eb112266f700ee5a2d72e7e480862ce61103c0443044305a43714ae2fe346439"}},
  {"base":{"path":"packages/engine/dist/web/sharedWebGL2Options.js","bytes":2756,"sha256":"3dedd11300425c7eb2766ec98b7923d3c4fabdfd8aad520f46ffcd3e8e3b7d31"},"current":{"path":"packages/engine/dist/web/sharedWebGL2Options.js","bytes":3004,"sha256":"6c4d7cd7a3c492864272dc6440635c61b5da604e262c7454be62364a07c5d852"}},
  {"base":{"path":"packages/engine/dist/web/sharedWebGL2Options.d.ts","bytes":1272,"sha256":"e3dbaa29559285a2894be963a8a14ecd8af2b8b1943e6d35b20cbdfc267a6f5b"},"current":{"path":"packages/engine/dist/web/sharedWebGL2Options.d.ts","bytes":1435,"sha256":"8b055c55a15c20d47e445ccae4f84b54fd88b6b72bf8a061e07e8979dbc87c30"}},
  {"base":{"path":"packages/engine/web/webgl2.ts","bytes":843,"sha256":"4035fe24f6a635b0606db205aa9647533a3ec3daa11739436e6a41169bae7277"},"current":{"path":"packages/engine/web/webgl2.ts","bytes":959,"sha256":"2fcec09692bed4d97d33dfd782b67a84f4f2aa253b206a764cf07601d2d6b903"}},
  {"base":{"path":"packages/engine/dist/web/webgl2.d.ts","bytes":759,"sha256":"4371471c516b8b98657da40709ea5c025359d0c40d309cd21cb78bfcf92dc400"},"current":{"path":"packages/engine/dist/web/webgl2.d.ts","bytes":875,"sha256":"8bd071509d95ef612c8891a9ec7a10b276faf7e803c1526e4f1845e6f74abece"}},
  {"base":{"path":"packages/engine/web/webgl2Native.ts","bytes":16642,"sha256":"2488fe3dba2225a7a6a195521a1e65fcf23d46cd6e707fc25b3e415e58496d73"},"current":{"path":"packages/engine/web/webgl2Native.ts","bytes":19169,"sha256":"a61cb853529de906405c23d643a45cc6b292ed714c2ec71e2c8b9b4d0dd6b988"}},
  {"base":{"path":"packages/engine/dist/web/webgl2Native.js","bytes":16508,"sha256":"22f01b9ce3f84fe4b8499a2dab19fee841c6c4b30b2c1f73ed715dd6d6c52ea3"},"current":{"path":"packages/engine/dist/web/webgl2Native.js","bytes":19157,"sha256":"4f775d00fd6d7c5d9e2f13138f355c779493dcac92c254a9fae260709d1e2b6f"}},
  {"base":{"path":"packages/engine/dist/web/webgl2Native.d.ts","bytes":2613,"sha256":"f55d03552a52bb105d0d6ca07ac4618c3b5cc03a68793b62fa22e418c338da2f"},"current":{"path":"packages/engine/dist/web/webgl2Native.d.ts","bytes":3099,"sha256":"661e87c305cc7302265e3a3d52d76a5eacb4490d3b003821c964a9da5915d987"}},
  {"base":{"path":"packages/engine/web/webgl2Types.ts","bytes":6412,"sha256":"0133ef15d217a8dac0939777e382ba2c8609838e414eb2b202aa731e12641347"},"current":{"path":"packages/engine/web/webgl2Types.ts","bytes":7455,"sha256":"54688edee459507b6bd9d3749517b4c54b3feec3eb9f435f1441ec51946e2925"}},
  {"base":{"path":"packages/engine/dist/web/webgl2Types.d.ts","bytes":6461,"sha256":"b65dc78eb010c13e4befb1f04b8ef17b6668fb1432dfd39f39739752b6fe0206"},"current":{"path":"packages/engine/dist/web/webgl2Types.d.ts","bytes":7534,"sha256":"803fa8ff1c1da8fb067b17f7f50422d384a63d8392c867c2dfa133120da419c7"}},
  {"base":{"path":"packages/engine/rendering/sharedColor2D.ts","bytes":2797,"sha256":"eb3a0e96e2a77f95da7dcba00ee398a7d64727f3a4e5d7e69cba2ba15b736ccc"},"current":{"path":"packages/engine/rendering/sharedColor2D.ts","bytes":3208,"sha256":"af0f9545d52147d5a042fa643acfdee6725d45c8b1714acd56e1759c5423f131"}},
  {"base":{"path":"packages/engine/dist/rendering/sharedColor2D.js","bytes":2455,"sha256":"4e3c221cb075be46b90454719c04f3886bed2dd10fd048bdef5273ebda7962b0"},"current":{"path":"packages/engine/dist/rendering/sharedColor2D.js","bytes":2861,"sha256":"754e47217b62c57ef5a6c61355dfb2794938d91aef0afc0c81b9195276000171"}},
];
const same = (left, right) => left?.path === right.path && left.bytes === right.bytes && left.sha256 === right.sha256;

export function selectSharedWebGL2FramePins(root, graph, present) {
  const retained = new Map(graph.map(row => [row.path, row]));
  if (!transitions.every(({base}) => same(retained.get(base.path), base))) return graph;
  // A matching current member selects the group. Callers check every path and its exact bytes.
  if (!transitions.some(({current}) => present.has(current.path)
    && same(fingerprintFile(root, current.path), current))) return graph;
  const replacement = new Map(transitions.map(({current}) => [current.path, current]));
  return graph.map(row => replacement.get(row.path) ?? row);
}
