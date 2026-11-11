// SPDX-License-Identifier: Apache-2.0
// Exact reviewed successor for the existing sequence RESET and source graph gates.
import { fingerprintFile } from './file-identity.mjs';

const transitions = [
  {"base":{"path":"packages/engine/src/internal/contentFactoryState.ts","bytes":1967,"sha256":"81a0d471ecf828289598239c5d68d32a3b2ced5d468380b95da3a019b5000d7c"},"current":{"path":"packages/engine/src/internal/contentFactoryState.ts","bytes":2824,"sha256":"f6abac54f4f58504dca750aa3b4b6c5a2ca344007ecd1c63d58f3a160baffd42"}},
  {"base":{"path":"packages/engine/dist/internal/contentFactoryState.js","bytes":1085,"sha256":"1e9f75627a4a24593da30a77ba23f8814092484cbeaa969ef23ecc56a18f1ff3"},"current":{"path":"packages/engine/dist/internal/contentFactoryState.js","bytes":1775,"sha256":"b257a477d739162a9f6a68f2b2adb1d8d761edea2348af5a80e04ed73531f257"}},
  {"base":{"path":"packages/engine/dist/internal/contentFactoryState.d.ts","bytes":1260,"sha256":"fc09fc76429000e7d6e51cf37d15a221003814832b218f5412706e201aca14c0"},"current":{"path":"packages/engine/dist/internal/contentFactoryState.d.ts","bytes":1592,"sha256":"40262c26027baa80bb0cf663fb1dd9a08ac4ae272bfd562b41a915fa42fe4a60"}},
  {"base":{"path":"packages/engine/src/contentLoader.ts","bytes":13817,"sha256":"a1db93dad35f49dd9a55f2f492bbf8d0ded1788f6a1ce2e405d88436edddd5e7"},"current":{"path":"packages/engine/src/contentLoader.ts","bytes":13932,"sha256":"016652083561c826257381a4a3236d896f735de6e8e3071bc3f9c1e311c733b9"}},
  {"base":{"path":"packages/engine/dist/contentLoader.js","bytes":14835,"sha256":"86e04ef4e3188ca5b49b1e86c1fa222ebc5491c95051f275434142e34b58fff9"},"current":{"path":"packages/engine/dist/contentLoader.js","bytes":15005,"sha256":"4796305782055e1db623b008cddfc1ffba12a13782ab42073c9c3e5f26cefa27"}},
  {"base":{"path":"packages/engine/src/animation/sequenceResetTypes.ts","bytes":1717,"sha256":"3d40cd1cb3e1cdcff9a0020d8fec652e40c71381cc8e5ed3dd3e8c5d4403a45c"},"current":{"path":"packages/engine/src/animation/sequenceResetTypes.ts","bytes":1952,"sha256":"0afbec5920189de78aee57e53d8204d787086113185c982abdc35f4a685537fc"}},
  {"base":{"path":"packages/engine/dist/animation/sequenceResetTypes.d.ts","bytes":1783,"sha256":"277f71a5106cf2d56fc9d95237c88349b26dfe72ba80c41441a9bd62a6209cd5"},"current":{"path":"packages/engine/dist/animation/sequenceResetTypes.d.ts","bytes":2022,"sha256":"bd88017eecfded35a08cfb2e52ca98ee0c0837b6ab160545893eb7d6aa512562"}},
  {"base":{"path":"packages/engine/src/animation/sequenceController.ts","bytes":21915,"sha256":"ea476a5d41f62c0f5c9e1469efa9a8b2d124a01de53159af53984ff731a3a4e8"},"current":{"path":"packages/engine/src/animation/sequenceController.ts","bytes":24594,"sha256":"1b7b91f30e7f32a16a37287064778d686b1e2296f3fea9a1c21a38032c4010af"}},
  {"base":{"path":"packages/engine/dist/animation/sequenceController.js","bytes":20640,"sha256":"19da7eb93a39ca8ae5cc785efc4bdc9cfd598b3e23f2ff62f7ccfb966760efc5"},"current":{"path":"packages/engine/dist/animation/sequenceController.js","bytes":22818,"sha256":"0af64c74fe1c69bd8865bc1606a12ed1b673e7e3045b9ee599a9aa2b194689a7"}},
  {"base":{"path":"packages/engine/dist/animation/sequenceController.d.ts","bytes":823,"sha256":"661a778583e81a6ce6b80c54717292c5ca9d7fecaafcb73c7bd3cd9ef2d53655"},"current":{"path":"packages/engine/dist/animation/sequenceController.d.ts","bytes":1725,"sha256":"f19111595ca54381b3cf64ed959577f39d5d8aad530613e8b3d6c82f68ba42a5"}},
  {"base":{"path":"packages/engine/src/animation/sequenceResetSlot.ts","bytes":10893,"sha256":"ad8cf7106cfd8b37bcdca9d92448e0339f019e71111f71d255ef676e22de8a09"},"current":{"path":"packages/engine/src/animation/sequenceResetSlot.ts","bytes":12346,"sha256":"d0353d8163a79ca216c519f8ca6b5a3a2a4dfdac043bf1e8f461aac07b20cb1a"}},
  {"base":{"path":"packages/engine/dist/animation/sequenceResetSlot.js","bytes":13497,"sha256":"2a7dfe8767b6db5acf99f18f2bab7549a31e3d3e958936cde552d0a03215238b"},"current":{"path":"packages/engine/dist/animation/sequenceResetSlot.js","bytes":14918,"sha256":"c14404a1e877462e343776f9c6be4014d29403b8b36299183ce287424c908dc8"}},
];
const same = (a, b) => a?.path === b.path && a.bytes === b.bytes && a.sha256 === b.sha256;

export function selectSequencePreservePins(root, expected, present) {
  const previous = new Map(expected.map(row => [row.path, row]));
  if (!transitions.every(({base}) => same(previous.get(base.path), base))) return expected;
  // A current member selects the whole successor. The existing gate checks every selected byte.
  const selected = transitions.some(({current}) => (!present || present.has(current.path))
    && same(fingerprintFile(root, current.path), current));
  if (!selected) return expected;
  const current = new Map(transitions.map(({current}) => [current.path, current]));
  return expected.map(row => current.get(row.path) ?? row);
}
