// SPDX-License-Identifier: Apache-2.0
// Review preparation only. No baseline, catalog, gate or historical evidence is written.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,logicalPath,samePhysicalPath} from './lib/file-identity.mjs';

const repository=fileURLToPath(new URL('..',import.meta.url));
const names=['contracts','engine','project','runtime'];
const schedules=['tools/prepush.mjs','tools/test.mjs','tools/verify.mjs'];
const catalogFile='tools/incremental-test-catalog.json';
const registrations=[
 ['tools/spritesheet-boundary.mjs','graphPins'],
 ['tools/spritesheet-boundary.mjs','configurationPins'],
 ['tools/spritesheet-boundary.mjs','ss1AtlasGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','acceptedSnapshot','graph'],
 ['tools/browser-png-boundary.mjs','acceptedSnapshot','stablePins'],
 ['tools/browser-png-boundary.mjs','atlasGraphSuccessor'],
 ['tools/spritesheet-boundary.mjs','m11WarmSubmissionGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','m11WarmSubmissionGraphSuccessor'],
 ['tools/atlas-import-boundary.mjs','m11WarmSubmissionGraphSuccessor'],
 ['tools/spritesheet-boundary.mjs','m12IncrementalRenderingGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','m12IncrementalRenderingGraphSuccessor'],
 ['tools/atlas-import-boundary.mjs','m12IncrementalRenderingGraphSuccessor'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m12IncrementalOwnershipSuccessor'],
 ['tools/spritesheet-boundary.mjs','m13SharedRenderingGraphSuccessor'],
 ['tools/browser-png-boundary.mjs','m13SharedRenderingGraphSuccessor'],
 ['tools/atlas-import-boundary.mjs','m13SharedRenderingGraphSuccessor'],
 ['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceRawSuccessor'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceRawSuccessor'],
 ['tools/sequence-playback-boundary.mjs','seqpbPackages'],
 ['tools/sequence-playback-boundary.mjs','seqpbStableEntries'],
 ['tools/sequence-playback-boundary.mjs','seqpbConfigurations']
];

// Only these complete reviewed source revisions permit post-preamble JSON reads.
const m13SourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":149677,"sha256":"5f4885f894b2b6d304a1f6c5fb685a86d28fbb510eb0335c615e71e2f65a4bae"},{"path":"tools/browser-png-boundary.mjs","bytes":151624,"sha256":"3a3db5f44bd79bc9f2ba11b393facd85533b52e93dbd17213076b8d6754d7ad4"},{"path":"tools/atlas-import-boundary.mjs","bytes":54233,"sha256":"6646d8fbf1a9baf248d4122195e5f3023c7c385470d876e106942ef828d2558b"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":29569,"sha256":"5bd40db8add4af6a15b0c5ce7415a77b663620984d074104c0849b6595390c6a"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":33706,"sha256":"65b356be737202f018b2c5cb1813538762e07af19c950b782fbbde782dbaa556"},{"path":"tools/sequence-playback-boundary.mjs","bytes":35428,"sha256":"898af8561932a01f5ba9b6de243feb6340557342e8d0a4afa171530e2ee531cd"}];
// Exact M1.4 source revisions preserve the previous sealed owners above.
const m14SourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":161018,"sha256":"ef34a3adf751069637682833caddd72efb7f1940a2d23e5cf2f1652eef5ecc75"},{"path":"tools/sequence-playback-boundary.mjs","bytes":36688,"sha256":"3a5cbef25992645aae0d3060a4680b1a496b0bb48a5ab10e671d0739932838d5"},{"path":"tools/browser-png-boundary.mjs","bytes":163335,"sha256":"ed175200cc2957f671b83b7082e98e6598018a9e636050ac9d305c8a3e8f0569"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":30824,"sha256":"ceedb70bb26730fd8bc44990d169f7ea5f25b8362daf4557ee853e46e592a277"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":34961,"sha256":"f57422e49f5197cd5c5ef66c76bc8cde2c6a36571b8bae5de9f89c24832591ab"},{"path":"tools/atlas-import-boundary.mjs","bytes":65640,"sha256":"d3994b788efa4e9eafeeed4a37f6ed4935af2946e7efc42ed35b9d9e4d5c6239"},{"path":"tools/browser-png-boundary.mjs","bytes":163653,"sha256":"0fa3391e5831ab6c2c9889622ffd51e36b678d2aa93822ff69b51b30679b4e33"}];
const m14GraphRegistrations = [["tools/spritesheet-boundary.mjs","m14WebGL2GraphSuccessor"],["tools/browser-png-boundary.mjs","m14WebGL2GraphSuccessor"],["tools/atlas-import-boundary.mjs","m14WebGL2GraphSuccessor"]];
const m13PairRegistrations = [
 ['tools/sequence-playback-boundary.mjs','m13SequenceInterfaceSuccessor','raw-pair-observation-only'],
 ['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceProjectedSuccessor','transformed-pair-raw-observation-only'],
 ['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceStableSuccessor','raw-pair-observation-only'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceProjectedSuccessor','transformed-pair-raw-observation-only'],
 ['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceStableSuccessor','raw-pair-observation-only']
];
// Exact M1.5 sources and fixed JSON roles; historical owners remain unchanged.
const m15SourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":185549,"sha256":"d93ec76d594db2b7ca2173c933b80ff3d83630442619c9ae127db7ed9d51ff35"},{"path":"tools/browser-png-boundary.mjs","bytes":191515,"sha256":"d916154a3c50433ecb3faff4dd061fc51e7b772a4c6ab64e43d83920555f93bd"},{"path":"tools/atlas-import-boundary.mjs","bytes":90249,"sha256":"e3758e91108fe4b1f11dff391100f3de72e57032b96992bf69dd00d1d50fb4ac"},{"path":"tools/sequence-playback-boundary.mjs","bytes":43012,"sha256":"2d95757ddd9c3a6d1762fd44ba02461ef92504690f2e1e4c342a5f6d71f10a62"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":38244,"sha256":"1a4046d1bd5003714ca030ade053f412c98ca1f787d35357b823a12005e791a3"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":44823,"sha256":"690d56e1eb726d55990d6a8cd37b2215b1f3bb44430ca5c54abc67cdcffe8026"}];
// Exact cancellation-order successors retain all prior M1.5 source owners above.
const m15CancellationSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":185549,"sha256":"bfb4fb02f29cd66442a6f5124c1e209d87b305550ec5a48978c104f09163fb3f"},{"path":"tools/browser-png-boundary.mjs","bytes":191515,"sha256":"f04e493805cd21c45e753c4cf2ac3f876f2b16d9f5c9b2f9193293d662036094"},{"path":"tools/atlas-import-boundary.mjs","bytes":90249,"sha256":"4dee83aecfeb345647356ee3a8f5aef36e6b984333dcd8699ff40bfd7de6d581"}];
// Exact diagnostic-path successor; historical and cancellation-order owners remain unchanged.
const m15DiagnosticSourceOwners = [{"path":"tools/browser-png-boundary.mjs","bytes":191467,"sha256":"ce40f1363774bec52a053a5a0b2001aab2f3e4701b49e822e1a61097c7a4299d"}];
// Exact current preparation owners; every older source authority stays intact.
const m12PreparationSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":192441,"sha256":"ecab5b53ef95905ccc0d497d22ae21f0fdcdb722af9a131fcdc8f33a28322345"},{"path":"tools/browser-png-boundary.mjs","bytes":198282,"sha256":"76ff8a040936e5eace5eff3c94f3da733d512328f0fde507b958c8d32012413e"},{"path":"tools/atlas-import-boundary.mjs","bytes":97146,"sha256":"67b80c84cbfd35c511e739c6afb2d64c80ebe9abf03ecf54cdc68b3f3dc3c5f5"}];
const m12PreparationGraphRegistrations = [["tools/spritesheet-boundary.mjs","m12PreparationHotPathGraphSuccessor"],["tools/browser-png-boundary.mjs","m12PreparationHotPathGraphSuccessor"],["tools/atlas-import-boundary.mjs","m12PreparationHotPathGraphSuccessor"]];
const m15GraphRegistrations = [["tools/spritesheet-boundary.mjs","m15ResourceRecoveryGraphSuccessor"],["tools/browser-png-boundary.mjs","m15ResourceRecoveryGraphSuccessor"],["tools/atlas-import-boundary.mjs","m15ResourceRecoveryGraphSuccessor"]];
const m15PairRegistrations = [["tools/spritesheet-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15SequenceInterfaceSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15InterfaceRawSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15InterfaceProjectedSuccessor","transformed-pair-raw-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15InterfaceRawSuccessor","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15InterfaceProjectedSuccessor","transformed-pair-raw-observation-only"]];
// Exact M3 pointer owners and declaration roles; every historical source row stays fixed.
const m3PointerSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":202670,"sha256":"0da3517e80ae80562655bfcd98e6468c9a9f9ed16fde4b590f357cc4195365c4"},{"path":"tools/sequence-playback-boundary.mjs","bytes":45750,"sha256":"220c68bd0afcf72fc41ba75bf67844c75293b51c885023e5ad41a1c312a0bea9"},{"path":"tools/browser-png-boundary.mjs","bytes":209858,"sha256":"2fcd26757382cabb4c28ea8bb0652b6867c550add31f1c514661ce860a4f0ba0"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":40977,"sha256":"f6b5f7f4cae9c7eff328f5e7e6f53de7db23c977a587bfd0b76c9ee2e1112146"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":47556,"sha256":"2b85a5206b2cfad092ecb42d1200b3e87d9a916a38529087862a94933bdbc4a6"},{"path":"tools/atlas-import-boundary.mjs","bytes":107421,"sha256":"6c670e346640165395fd0019b4fa7edd259fa844da70f8a04a9dabbdb597ae8f"}];
// M2.1 admits only the six reviewed current boundary source owners.
const m21ContentSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":207646,"sha256":"4d51b7456094eed65c2db387d4f1407e8366360d78739e996e2c309bca5cb965"},{"path":"tools/sequence-playback-boundary.mjs","bytes":46593,"sha256":"f4bc56c5a4acb32126d9cd58138be1a61d0d977eab46fa3aba55ca964c5eca8b"},{"path":"tools/browser-png-boundary.mjs","bytes":214947,"sha256":"cf8a143d063995ba1f015e4d90fb72715257d3c1098c776df03ab63cb9b34498"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":41778,"sha256":"a03103fe528dda7292b80292e4a559f11ff54985de768ed49fdeb3d27aa3dc14"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":48357,"sha256":"04e760910bee4ce84e4285a3ce9eae9eced72ecc1381c8c59fe0679762c2b0b1"},{"path":"tools/atlas-import-boundary.mjs","bytes":112375,"sha256":"88283e42d8081c407ff9cc0238a5eb8557c6f964a529549fac0df10f582a8e9b"}];
const m22SequenceSourceOwners = [
  {
    "path": "tools/spritesheet-boundary.mjs",
    "bytes": 247421,
    "sha256": "55756fe02f8c6bfcdb8924e70199902168a830d9fa231637f3a339f914c271cb"
  },
  {
    "path": "tools/browser-png-boundary.mjs",
    "bytes": 256296,
    "sha256": "d15791d46b5314875a3d0dfe65e78bb9327cbc719a30876bfbb52552a38cb4f0"
  },
  {
    "path": "tools/atlas-import-boundary.mjs",
    "bytes": 152134,
    "sha256": "9e8741eaeaa9d14fa31f2fafcbf7ef522567cffba2654dba468d57679439bb43"
  },
  {
    "path": "tools/bitmap-resource-slot-boundary.mjs",
    "bytes": 56840,
    "sha256": "e34d89d62e91dbeeb028446414b2da3b4b9a62f18bfb8521c6bcf94c5c247e85"
  },
  {
    "path": "tools/bitmap-binding-ticket-boundary.mjs",
    "bytes": 63419,
    "sha256": "4ce0782193bf3d311ab841130e33497ceb52bba0f26daf8cf7d8f764066b5e50"
  },
  {
    "path": "tools/sequence-playback-boundary.mjs",
    "bytes": 61921,
    "sha256": "f8b3ef13e2a7ef356703574592862bfa57adb071947f715cf156c4949c201657"
  }
];
const m22SequenceGraphRegistrations = [["tools/spritesheet-boundary.mjs","m22SequenceAdditionPins"],["tools/browser-png-boundary.mjs","m22SequenceAdditionPins"],["tools/atlas-import-boundary.mjs","m22SequenceAdditionPins"]];
const m22SequencePairRegistrations = [["tools/spritesheet-boundary.mjs","m22SequencePackagePairs","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","m22SequenceSourcePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m22SequencePackagePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m22SequenceSourcePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m22SequencePackagePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m22SequenceSourcePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m22SequencePackagePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m22SequenceSourcePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m22SequencePackagePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m22SequenceSourcePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m22SequencePackagePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m22SequenceSourcePairs","raw-pair-observation-only"]];
const m31UiSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":220067,"sha256":"b534701cdbcd7d0ef14019005234d29e69d5686999450654929b4524d09068b1"},{"path":"tools/sequence-playback-boundary.mjs","bytes":48793,"sha256":"fa09b4b2acaca3c70f0b4583b34dae3cf7a12b5de9fe754ee8bfe9815dca85dc"},{"path":"tools/browser-png-boundary.mjs","bytes":227685,"sha256":"dee49b3e1128b22bd999b367b178977825a0658744ed98f3893100ba8144093e"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":43941,"sha256":"d35fe029b5a4b94f7af3bbc151936a4c65d1bbb778dd412c48317156aaf57a67"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":50520,"sha256":"f35e0311de99c1fd8030a67631dcdadecd03423d9cb966d54099b6d7e5bf28f9"},{"path":"tools/atlas-import-boundary.mjs","bytes":124821,"sha256":"d850cb52e476c323f63da1eca82a6e7e5bfda87a0ee80287dffab39a421595d4"}];
const m31UiGraphRegistrations = [["tools/spritesheet-boundary.mjs","m31UiAdditionPins"],["tools/browser-png-boundary.mjs","m31UiAdditionPins"],["tools/atlas-import-boundary.mjs","m31UiAdditionPins"]];
const m31UiPairRegistrations = [["tools/spritesheet-boundary.mjs","m31UiPackagePairs","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","m31UiSourcePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m31UiPackagePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m31UiSourcePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m31UiPackagePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m31UiSourcePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m31UiPackagePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m31UiSourcePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m31UiPackagePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m31UiSourcePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m31UiPackagePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m31UiSourcePairs","raw-pair-observation-only"]];
const m3PointerGraphRegistrations = [["tools/spritesheet-boundary.mjs","m3PointerGraphSuccessor"],["tools/browser-png-boundary.mjs","m3PointerGraphSuccessor"],["tools/atlas-import-boundary.mjs","m3PointerGraphSuccessor"]];
const m3PointerPairRegistrations = [["tools/spritesheet-boundary.mjs","m3PointerPackageSuccessors","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m3PointerPackageSuccessors","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m3PointerPackageSuccessors","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m3PointerPackageSuccessors","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m3PointerPackageSuccessors","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m3PointerPackageSuccessors","raw-pair-observation-only"]];
const m33KeyboardSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":252663,"sha256":"8f19ac2f77414d2815fc56b33910cbbbb21cd823c3e6dd0f9e8aafb6fc73de26"},{"path":"tools/sequence-playback-boundary.mjs","bytes":61921,"sha256":"da160818cab7b5d5c1a5231a416d9ba9617ffd0d7d7a735faac3adf4d3d48b99"},{"path":"tools/browser-png-boundary.mjs","bytes":261636,"sha256":"5d4ec3fc991c2de3fd272c2a563f40f2103ee2896df510cdc73bdd2f6ba29678"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":56840,"sha256":"98b5f0d8a24017014d7fa8729453519c1b7ae8c0c52242547cb775c01e549b1e"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":63419,"sha256":"bc88cf0b2efe56dc76a83dd26f834c7eca91d1467f82531d2e8f45593413ecbc"},{"path":"tools/atlas-import-boundary.mjs","bytes":157376,"sha256":"e8f63cd530c81b47153317a798a02f10a85960291016e5929faf374b67bb4ca7"}];
const m33KeyboardPairRegistrations = [["tools/spritesheet-boundary.mjs","m33KeyboardPackagePairs","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","m33KeyboardSourcePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m33KeyboardPackagePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m33KeyboardSourcePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m33KeyboardPackagePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m33KeyboardSourcePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m33KeyboardPackagePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m33KeyboardSourcePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m33KeyboardPackagePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m33KeyboardSourcePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m33KeyboardPackagePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m33KeyboardSourcePairs","raw-pair-observation-only"]];
const m33KeyboardGraphRegistrations = [["tools/spritesheet-boundary.mjs","m33KeyboardAdditionPins"],["tools/browser-png-boundary.mjs","m33KeyboardAdditionPins"],["tools/atlas-import-boundary.mjs","m33KeyboardAdditionPins"]];
// Exact current key-reveal owners retain all earlier source authorities.
// M24-SPINE-CURRENT-BEGIN
const m24SpineSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":288443,"sha256":"9b6007c32c23d3207c2ec92382924ecdb1b8a69eecd48e6f324a95363c1704d4"},{"path":"tools/browser-png-boundary.mjs","bytes":297416,"sha256":"79ab1afc19f226fd99962985ce2a25f6f96fe9308d3a46b9bc56046f7772dc9d"},{"path":"tools/atlas-import-boundary.mjs","bytes":193156,"sha256":"89683d59e3cc415acd0d5f78808e67c365f8984f9c54c058df5a6701b4594b07"},{"path":"tools/sequence-playback-boundary.mjs","bytes":81997,"sha256":"a4a9928fd4210037656d5facd9c3ad100e5e559e4fbc09115159cc86dca654f8"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":77624,"sha256":"cee8ac3ad10a1f1f39253749a96fd82b98e4cb4beac2a6301d4c79b052e76f2c"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":84203,"sha256":"66b81960502532f9a16b5115ed5ebb2bdc0e616994dfd9ee08d1d5fc45c9c091"}];
const m24SpinePairRegistrations = [["tools/spritesheet-boundary.mjs","m24SpineSourcePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m24SpineSourcePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m24SpineSourcePairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m24SpineSourcePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m24SpineSourcePairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m24SpineSourcePairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m24SpineProjectedPairs","transformed-baseline-raw-observation"],["tools/bitmap-binding-ticket-boundary.mjs","m24SpineProjectedPairs","transformed-baseline-raw-observation"]];
const m24SpineGraphRegistrations = [["tools/spritesheet-boundary.mjs","m24SpineAdditionPins"],["tools/browser-png-boundary.mjs","m24SpineAdditionPins"],["tools/atlas-import-boundary.mjs","m24SpineAdditionPins"]];
// M24-SPINE-CURRENT-END

const m3KeyRevealSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":256239,"sha256":"9fe4430a07a41f9a553a5302c67404ff01e1eb59d8b91e11e07bebc324a849b5"},{"path":"tools/browser-png-boundary.mjs","bytes":265212,"sha256":"5418e1727c4b635847986ddea1b21761f448861cb4e46c9149993d1b5e91d929"},{"path":"tools/atlas-import-boundary.mjs","bytes":160952,"sha256":"914639e2fd0d8b424b0be12f84ed3639e5bd1b8541d538ac1bca6d62d16bb1e6"}];
const m3KeyRevealPairRegistrations = [["tools/spritesheet-boundary.mjs","m3KeyRevealSourcePairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m3KeyRevealSourcePairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m3KeyRevealSourcePairs","raw-pair-observation-only"]];
// M3.4 admits only three complete theme owners and their finite JSON groups.
const m24ResetSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":299076,"sha256":"221d0cb33d4972ec3226a16acdc27052af270b4f4766a0e0bcea5536de3ca83e"},{"path":"tools/browser-png-boundary.mjs","bytes":308049,"sha256":"b3b8a5871ebea6eb1550baa3902c1ea5cc009300c0bd1505639804020e5e69e7"},{"path":"tools/atlas-import-boundary.mjs","bytes":203789,"sha256":"666a85b7f59f71d43af888763a7fd8dec3f083550d71f19ab695dc7ff93b0c43"}];
const m24ResetPairRegistrations = [["tools/spritesheet-boundary.mjs","sequenceResetGraphPairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","sequenceResetGraphPairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","sequenceResetGraphPairs","raw-pair-observation-only"]];
const m24ResetGraphRegistrations = [["tools/spritesheet-boundary.mjs","sequenceResetGraphAdditions"],["tools/browser-png-boundary.mjs","sequenceResetGraphAdditions"],["tools/atlas-import-boundary.mjs","sequenceResetGraphAdditions"]];
const m34ThemeSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":292702,"sha256":"8c27e63d1242e57d6c37e3a63ca1f6a040c81dd708b1b7a756628bbdcb7d6ab5"},{"path":"tools/browser-png-boundary.mjs","bytes":301675,"sha256":"821a4a694fb5ee2a6065e4e19e663414551959d01b83e4cbae1f6d1c26697720"},{"path":"tools/atlas-import-boundary.mjs","bytes":197415,"sha256":"26f44c498b995fe51e070f1bc74484819209109ba25df272ebd055b0379f4538"}];
const m34ThemePairRegistrations = [["tools/spritesheet-boundary.mjs","uiThemeGraphPairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","uiThemeGraphPairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","uiThemeGraphPairs","raw-pair-observation-only"]];
const m34ThemeGraphRegistrations = [["tools/spritesheet-boundary.mjs","uiThemeGraphAdditions"],["tools/browser-png-boundary.mjs","uiThemeGraphAdditions"],["tools/atlas-import-boundary.mjs","uiThemeGraphAdditions"]];
// Exact selector-repair successors retain the earlier theme owners above.
const m34ThemeSelectionSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":292808,"sha256":"4820df162a859727c32c5d2c312114d26af4e6aea202084ff24048b75019e909"},{"path":"tools/browser-png-boundary.mjs","bytes":301781,"sha256":"47539bdf0a7db1ca9ccca6d8d1fd8ea5702f696b9a266f0408d7d56349c41244"},{"path":"tools/atlas-import-boundary.mjs","bytes":197521,"sha256":"014c7b880f0bf0649f71298ec7bfa089b8a747a89817d1ce28227bd0ea60a1e2"}];
// Controls observations register only these three complete current source owners.
// Exact current contained-clipping owners preserve the complete earlier declarations.
const m42ContainedClipSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":225513,"sha256":"66571d74b96da3dc0855f85faf921cd64350f87055c8c4665689ede620b553fc"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":85039,"sha256":"265552943c2f0c241ebdecbf93a080e78804060da13b93a5f6cb9771d3f98f96"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":78460,"sha256":"bdb5adcf984c30ec191f63dacac466966c4103bb392b528d8b9002bc6117db19"},{"path":"tools/browser-png-boundary.mjs","bytes":330385,"sha256":"fcfc3eb6f57c449adeab29a59b5bb1976fe05f6244d28a60b5ce4591ef00272d"},{"path":"tools/sequence-playback-boundary.mjs","bytes":82982,"sha256":"d8827b5be210eb7e8f8acd648dbb5362b5981e6a88e2c32ff04f00d4df692947"},{"path":"tools/spritesheet-boundary.mjs","bytes":320800,"sha256":"f9852114b8b6621c13ad45b53ff8928f90fe3c51deb867fd9f6e52951ef9ff79"}];
const m42ContainedClipPairRegistrations = [["tools/atlas-import-boundary.mjs","sharedContainedClipPairs","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","sharedContainedClipPairs","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","sharedContainedClipPairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","sharedContainedClipPairs","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","sharedContainedClipPairs","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","sharedContainedClipPairs","raw-pair-observation-only"]];
// Exact owners that add compatible sequence playback to the contained-clipping graph.
const m24CompatibleSequenceSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":225633,"sha256":"7461d309cde511e9c3f09e7b6dafc051f699bf1236ec1188be28a870cabd4bf1"},{"path":"tools/browser-png-boundary.mjs","bytes":330545,"sha256":"ff20a368a0f8799b983217a296420bbcb138c7dd3c861df0b7322c76821bf8be"},{"path":"tools/spritesheet-boundary.mjs","bytes":320920,"sha256":"ce63a9d9ffe530b1de9ce864404ca78b0024b4f84b6b4d5db5961c02f8ef0e2b"}];
// Exact geometry owners retain the complete contained-clipping and compatible sequence graph.
const m42GeometryCanonicalSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":226475,"sha256":"b8f30d7e95a98029b8a02bce33a05867ef46d1d29f530287062b92ce4bf31247"},{"path":"tools/browser-png-boundary.mjs","bytes":331387,"sha256":"6fdabeb2b29dbbf30e06bd63f39d93c443dd48f34641ff400d001e2a172808ce"},{"path":"tools/spritesheet-boundary.mjs","bytes":321762,"sha256":"9bfeb94f02b0b3c2a1a0660c659880d51c0c0e58fda2f1306ddf69b73273cf32"}];
const uiControlsSourceOwners = [{"path":"tools/spritesheet-boundary.mjs","bytes":319945,"sha256":"4e8a13f8d1167d08280d3d910ba06a503d5d016f5076929450ff112fdcf3544e"},{"path":"tools/browser-png-boundary.mjs","bytes":329530,"sha256":"4c46de36cb28ca3797634d74aa102b2b67692b8e2c1cf3d04fb4849f9c3c80f6"},{"path":"tools/atlas-import-boundary.mjs","bytes":224658,"sha256":"7d978cf3d623232f97bbe96d20ae4df831475cf162bbfb26126c5f2afed1d0ab"}];
const uiControlsPairRegistrations = [["tools/spritesheet-boundary.mjs","uiControlsGraphPairs","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","uiControlsGraphPairs","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","uiControlsGraphPairs","raw-pair-observation-only"]];
const uiControlsGraphRegistrations = [["tools/spritesheet-boundary.mjs","uiControlsGraphAdditions"],["tools/browser-png-boundary.mjs","uiControlsGraphAdditions"],["tools/atlas-import-boundary.mjs","uiControlsGraphAdditions"]];
// Cached-layer owners retain the complete predecessor closures above.
const sharedLayerCacheSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":230296,"sha256":"a8462f0c3aca5a7734baf9937d3f1cc29688cca8e0450626ef3f310c55159c85"},{"path":"tools/browser-png-boundary.mjs","bytes":335208,"sha256":"3f1073fc59c0e53d813fbe04a6a3d7b9f5cccd53ed7cc36169f306db3f329c00"},{"path":"tools/spritesheet-boundary.mjs","bytes":325583,"sha256":"7bfd18156f007e0bba1b44b7c547005d197d1cb3872e749c028550831d45779e"}];
// Cached-layer light owners retain the complete unlit cache closures above.
const sharedLayerLightSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":233799,"sha256":"9161dc1f6433f9f6c1d62d2574d13fd8db461f6bbcdfc7a2da04c3929a723434"},{"path":"tools/browser-png-boundary.mjs","bytes":338711,"sha256":"2424dd6f11aa8927c063ece1ebefc40e250ca7eff87d4cb66e64ab847ba5a6b2"},{"path":"tools/spritesheet-boundary.mjs","bytes":329086,"sha256":"83cd5b756eee3275507e5cd3e90ed75ed4181d77353acdec12232deae8b869bb"}];
// Authored-scene graph owners project only the exact current route and closure.
const authoredSceneSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":238311,"sha256":"7adbc20a0eee14fe5722305f87e9f1bd01878c21ec32206975ebd89166a43102"},{"path":"tools/browser-png-boundary.mjs","bytes":343437,"sha256":"c7b931679ac8756ec6987bc5218089082cbe56471e92a8a67e9484de909a8a88"},{"path":"tools/spritesheet-boundary.mjs","bytes":333598,"sha256":"b460877da8b8ca870db95de7ca8a9d236c2cc7d8781ff76c5f61902bbab975a7"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":86228,"sha256":"cf84050013391fc3fdbe0aec44a3e4ca06440c3f0a0afe3551ec9b3d62a16027"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":79649,"sha256":"4a398c73aa10808ab7dd8837c3862b39a05a3cf1bc157afa479102b26521cc29"},{"path":"tools/sequence-playback-boundary.mjs","bytes":84171,"sha256":"41f79f11c0ca976b24db974efdf1d8d56ce81b3ddfc468a78633adef7a393903"}];
// Exact WorldCard owners retain earlier declaration extraction identities.
const worldCardSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":249484,"sha256":"f3c217613a4af300ece55513f6c78ed4aba51af4faf54473969d98d1e274de90"},{"path":"tools/browser-png-boundary.mjs","bytes":354610,"sha256":"3aa1cae612345230a0461c49a872914ee998fd8806d807d0cb4484266eb31684"},{"path":"tools/spritesheet-boundary.mjs","bytes":344771,"sha256":"4ccf826a39fa50c47ae9f5fbcd08c1f835fb544d3c8993ebe3a251d1eb5136cc"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":88133,"sha256":"9f39b8e6eb7f53a4c8c5c52a607c3dc45a0759d1ac56941356658b80ad6be917"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":81554,"sha256":"0f46f8ee3d89fdc8c23e6b3c1c5064f033ee1687de9156bb2faabb853b8dd973"},{"path":"tools/sequence-playback-boundary.mjs","bytes":86118,"sha256":"00fd782d8ca1cd804fc9c16993a72a0bce9cfe502d1f887040f73b3cb0c1ed99"}];
// Exact textured GLB owners retain the sealed earlier declaration extraction.
const texturedGlbSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":260334,"sha256":"d33dc32749c896f77cc5cee9ce7389c15668d5e645bc87b0d71bffb3df7efddb"},{"path":"tools/browser-png-boundary.mjs","bytes":365460,"sha256":"16bc8f7b212301382e5519407aca52b50cad86885b3eb822db879e9c29c56b06"},{"path":"tools/spritesheet-boundary.mjs","bytes":355621,"sha256":"8a038acea333a2ea1a719cc212fc0ff692a68e4960f41a927f5482a6bda5bfb3"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":90081,"sha256":"40a94aaec6e6fd350b9ca923b59634103d000654c11a84f0236cb4d2690e46fb"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":83502,"sha256":"fdc638d64dbf9c5b8566fc91c7f8ec65f7a7e22f27e1b4048d36bca8ed50dca2"},{"path":"tools/sequence-playback-boundary.mjs","bytes":88108,"sha256":"140b7f838ff1c7d2aac76fdba46b93f4c2813f22c7c5b369a06e40aca150edf9"}];
// Exact Lambert owners retain the sealed earlier declaration extraction.
const lambertGlbSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":272488,"sha256":"6d5957edb26911bb616e3ba6c5c2cc2b42f9d490fc40b3677d584034a6e5f747"},{"path":"tools/browser-png-boundary.mjs","bytes":377614,"sha256":"0245f9776c5bd71b9bbb32d61161b5822755071fd2e3ee784dbee349346f9351"},{"path":"tools/spritesheet-boundary.mjs","bytes":367775,"sha256":"702623cff673d162e0fa53c90b4d30b6ad2171b90dcb778b8ddfd77928c6be98"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":92622,"sha256":"9357961e01c7ddb78d26aafe80ea77f3563de0fcba4b598f6120fb2afc061c6a"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":86043,"sha256":"71e981e06cc4344018d6c035ad2c825a73bce4a34fc6a8d7e59d2fbece18298d"},{"path":"tools/sequence-playback-boundary.mjs","bytes":90691,"sha256":"4b6bf9d671d2fe00deae1de3fbfecdee4789aeae660deb0d237f2137294d03a3"}];
const sceneAnimationSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":275895,"sha256":"0fa164004e76b1f4e8692456f6b5aba6813a713d71929833d9cb9b4f2765642c"},{"path":"tools/browser-png-boundary.mjs","bytes":381021,"sha256":"06e73501889f0de5b42897606801ee137147a23df72b9cb759413bf338834fcf"},{"path":"tools/spritesheet-boundary.mjs","bytes":371182,"sha256":"9ed71f5e37a9c20ad0b8bda449cb44210f4036bf819d9d5729e98f559a240269"}];
const importedGlbAnimationSourceOwners = [{"path":"tools/atlas-import-boundary.mjs","bytes":279862,"sha256":"6f9abb824bd75d7de38fc68ab7943d52816b28f7a141a815ce0989f7575c0f59"},{"path":"tools/browser-png-boundary.mjs","bytes":384988,"sha256":"65bd61b12c56c6b4902124997e023d47457a74c78712cc8d8d5f68f553f6a8c7"},{"path":"tools/spritesheet-boundary.mjs","bytes":375149,"sha256":"f4f48a3015f6d72208bc7a9b145ca95da8e0403175a7c5ed035b5bc21bd6054f"}];
// Explicit selectors keep historical transforms and third-party owners separate.
const policyRegistrations=[
 {owner:'tools/bitmap-resource-slot-boundary.mjs',binding:'policyPin',target:'tools/bitmap-resource-slot-policy.json',kind:'BITMAP_RESOURCE_SLOT_FINITE_INTERFACE_POLICY',selectors:['packages','configurations','stableEntries','oldRootPins','oldEngineDeclarationPin','workspacePins']},
 {owner:'tools/bitmap-binding-ticket-boundary.mjs',binding:'policyPin',target:'tools/bitmap-binding-ticket-policy.json',kind:'BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY',selectors:['packages','configurations','stableEntries','oldRootPins','oldEngineDeclarationPin','workspacePins','selectedProductPins']},
 {owner:'tools/atlas-import-boundary.mjs',binding:'inventoryPin',target:'tests/types/atlas-import-diagnostic-expectations.json',kind:'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS',selectors:['sourcePolicy.modules','sourcePolicy.configurationPins']}
];
// Parse JSON once, then reject duplicate decoded object keys at every depth.
export function uniqueJSON(text){
 const value=JSON.parse(text),tokens=text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g);let at=0;
 function visit(depth){
  if(depth>128)throw Error('Unsupported JSON nesting');
  const token=tokens[at++];
  if(token==='{'||token==='['){
   const end=token==='{'?'}':']',keys=new Set();
   while(tokens[at]!==end){
    if(token==='{'){const key=JSON.parse(tokens[at++]);if(keys.has(key))throw Error('Duplicate JSON key');keys.add(key);at++;}
    visit(depth+1);if(tokens[at]===',')at++;
   }at++;
  }
 }
 visit(0);return value;
}
function repositoryPin(pin){
 validPin(pin);const file=pin.path;
 const allowed=/^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file)
  ||/^tests\/types\/[A-Za-z0-9_.-]+\.json$/.test(file)
  ||/^packages\/(?:contracts|engine|project|runtime)\/(?:(?:src|dist|web|rendering|tests)\/.+\.(?:ts|js)|package\.json|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file);
 if(!allowed||file.split('/').some(x=>x.toLowerCase()==='node_modules'||x.startsWith('.')))throw Error('Unsupported repository pin owner: '+file);
 return pin;
}

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const samePin=(a,b)=>a===null||b===null?a===b:a.path===b.path&&a.bytes===b.bytes&&a.sha256===b.sha256;
function validPin(pin){
 if(!pin||!equal(Object.keys(pin).sort(),['bytes','path','sha256'])||!Number.isSafeInteger(pin.bytes)||pin.bytes<0||!/^[a-f0-9]{64}$/.test(pin.sha256))throw Error('Malformed raw identity');
 logicalPath(pin.path);return pin;
}
// Absence is data; spelling aliases, links and nonregular owners are always errors.
function present(root,file){
 logicalPath(file);let current=root;
 const parts=file.split('/');
 for(let i=0;i<parts.length;i++){
  const entries=fs.readdirSync(current),part=parts[i];
  if(!entries.includes(part)){
   if(entries.some(x=>x.toLowerCase()===part.toLowerCase()))throw Error('File spelling differs: '+file);
   return false;
  }
  current=path.join(current,part);const stat=fs.lstatSync(current);
  if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()))throw Error('Nonregular maintenance input: '+file);
 }
 return true;
}
function reader(root){
 const inputs=new Map();
 function pin(file){if(!inputs.has(file))inputs.set(file,present(root,file)?fingerprintFile(root,file):null);return inputs.get(file);}
 function text(file){
  const identity=pin(file);if(!identity)throw Error('Missing required maintenance input: '+file);
  const raw=fs.readFileSync(path.join(root,file));
  if(raw.length!==identity.bytes||createHash('sha256').update(raw).digest('hex')!==identity.sha256)throw Error('Input changed while reading '+file);
  return raw.toString('utf8');
 }
 function finish(){
  const rows=[...inputs].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,identity])=>({path:file,identity}));
  for(const row of rows)if(!equal(row.identity,present(root,row.path)?fingerprintFile(root,row.path):null))throw Error('Input changed during preparation: '+row.path);
  return rows;
 }
 for(const file of ['tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs'])text(file);
 return {pin,text,finish};
}
// This is a bounded preamble reader, not a JavaScript parser. Ambiguous raw
// occurrences and unsupported prefix syntax are refused, never evaluated.
function declaration(text,name){
 const matches=[...text.matchAll(new RegExp('\\bconst\\s+'+name+'\\b','g'))];
 if(matches.length!==1)throw Error('Missing or ambiguous declaration: '+name);
 const at=matches[0].index,prefix=text.slice(0,at),stack=[];
 const refuse=()=>{throw Error('Unsupported declaration preamble: '+name);};
 for(let i=0;i<prefix.length;){
  const c=prefix[i];
  if(prefix.startsWith('//',i)){const end=prefix.indexOf('\n',i+2);if(end<0)refuse();i=end+1;continue;}
  if(prefix.startsWith('/*',i)){const end=prefix.indexOf('*/',i+2);if(end<0)refuse();i=end+2;continue;}
  if(c==='"'||c==="'"){
   const quote=c;let closed=false;i++;
   for(;i<prefix.length;i++){
    if(prefix[i]==='\\'){i++;continue;}
    if(prefix[i]===quote){i++;closed=true;break;}
    if(prefix[i]==='\n'||prefix[i]==='\r')refuse();
   }
   if(!closed)refuse();continue;
  }
  // Regex, division, templates and escaped identifiers need a real parser;
  // these registered preambles do not use them outside ordinary literals.
  if(c==='/'||c===String.fromCharCode(96)||c==='\\')refuse();
  if('({['.includes(c))stack.push(c);
  if(')}]'.includes(c)&&stack.pop()!=={')':'(', '}':'{', ']':'['}[c])refuse();
  i++;
 }
 if(stack.length||!/^\s*$/.test(prefix.slice(prefix.lastIndexOf('\n')+1)))refuse();
 const match=text.slice(at).split(/\r?\n/,1)[0].match(new RegExp('^const\\s+'+name+'\\s*=\\s*(.*);\\s*$'));
 if(!match)throw Error('Unsupported JSON declaration: '+name);
 try{return uniqueJSON(match[1]);}catch{throw Error('Unsupported JSON declaration: '+name);}
}
function codeInventory(root){
 const result=[];
 function walk(relative){
  // A synthetic child checks every directory component with the same path rules.
  present(root,relative+'/__egret_inventory_probe__');
  for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
   const file=relative+'/'+entry.name;logicalPath(file);
   if(entry.isSymbolicLink()||(!entry.isDirectory()&&!entry.isFile()))throw Error('Nonregular package inventory: '+file);
   if(entry.isDirectory())walk(file);else if(/\.(ts|js)$/.test(file))result.push(file);
  }
 }
 for(const name of names)for(const area of ['src','dist',...(name==='engine'?['web','rendering']:[])])walk('packages/'+name+'/'+area);
 return result.sort();
}
export function prepareBaselineReview(root){
 const read=reader(root),owners=new Map(),declarations=[],policyLinks=[],successorPairs=[];
 const ownerText=file=>{if(!owners.has(file))owners.set(file,read.text(file));return owners.get(file);};
 function registeredDeclaration(owner,binding){
  const text=ownerText(owner);
  try{return declaration(text,binding);}catch(cause){
   const allowed=registrations.some(row=>row[0]===owner&&row[1]===binding&&binding.startsWith('m13'))
    || m13PairRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m14GraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m15GraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m12PreparationGraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m15PairRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m22SequenceGraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m22SequencePairRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m31UiGraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m31UiPairRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m3PointerGraphRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || m3PointerPairRegistrations.some(row=>row[0]===owner&&row[1]===binding)
    || [...m42ContainedClipPairRegistrations,...uiControlsPairRegistrations,...uiControlsGraphRegistrations,...m24ResetPairRegistrations,...m24ResetGraphRegistrations,...m34ThemePairRegistrations,...m34ThemeGraphRegistrations,...m24SpinePairRegistrations,...m24SpineGraphRegistrations,...m3KeyRevealPairRegistrations,...m33KeyboardPairRegistrations,...m33KeyboardGraphRegistrations].some(row=>row[0]===owner&&row[1]===binding);
   const reviewed=[...m13SourceOwners,...m14SourceOwners,...m15SourceOwners,...m15CancellationSourceOwners,...m15DiagnosticSourceOwners,...m12PreparationSourceOwners,...m3PointerSourceOwners,...m21ContentSourceOwners,...m31UiSourceOwners,...m22SequenceSourceOwners,...m33KeyboardSourceOwners,...m3KeyRevealSourceOwners,...m24SpineSourceOwners,...m34ThemeSourceOwners,...m34ThemeSelectionSourceOwners,...m24ResetSourceOwners,...uiControlsSourceOwners,...m42ContainedClipSourceOwners,...m24CompatibleSequenceSourceOwners,...m42GeometryCanonicalSourceOwners,...sharedLayerCacheSourceOwners,...sharedLayerLightSourceOwners,...authoredSceneSourceOwners,...worldCardSourceOwners,...texturedGlbSourceOwners,...lambertGlbSourceOwners,...sceneAnimationSourceOwners,...importedGlbAnimationSourceOwners].filter(row=>row.path===owner);
   if(!allowed||!reviewed.some(row=>samePin(read.pin(owner),row)))throw cause;
   // Raw source authority precedes extraction; no caller-selected parser fallback.
   const lines=text.split(/\r?\n/).filter(line=>line.startsWith('const '+binding+' = '));
   if(lines.length!==1||!lines[0].endsWith(';'))throw Error('Missing or ambiguous reviewed M1.3 declaration');
   return uniqueJSON(lines[0].slice(('const '+binding+' = ').length,-1));
  }
 }
 const row=expected=>{const current=read.pin(expected.path);return {expected,current,identity:current===null?'missing':samePin(expected,current)?'same':'different'};};
 function add(owner,binding,pins,comparison='raw-identity'){
  if(!Array.isArray(pins))throw Error('Expected declared pin array: '+binding);
  const seen=new Set();for(const pin of pins){repositoryPin(pin);if(seen.has(pin.path))throw Error('Duplicate declared path: '+pin.path);seen.add(pin.path);}
  declarations.push({owner,binding,comparison,rows:pins.map(row)});
 }
 for(const [owner,binding,member]of registrations){
  if(!owners.has(owner))owners.set(owner,read.text(owner));
  const value=registeredDeclaration(owner,binding),pins=member?value[member]:value;
  if(!Array.isArray(pins))throw Error('Expected declared pin array: '+binding);
  const seen=new Set(),rows=pins.map(expected=>{
   validPin(expected);if(seen.has(expected.path))throw Error('Duplicate declared path: '+expected.path);seen.add(expected.path);
   const current=read.pin(expected.path);
   return {expected,current,identity:current===null?'missing':samePin(expected,current)?'same':'different'};
  });
  declarations.push({owner,binding:binding+(member?'.'+member:''),rows});
 }
 for(const spec of policyRegistrations){
  const expected=validPin(declaration(ownerText(spec.owner),spec.binding));
  if(expected.path!==spec.target)throw Error('Registered policy target path differs');
  policyLinks.push({owner:spec.owner,binding:spec.binding,row:row(expected)});
  const value=uniqueJSON(read.text(spec.target));
  if(value.kind!==spec.kind||(spec.binding==='policyPin'?value.schemaVersion!==1:value.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS'))throw Error('Unsupported policy schema: '+spec.target);
  for(const selector of spec.selectors){
   let pins=value;for(const part of selector.split('.')){if(!pins||!Object.hasOwn(pins,part))throw Error('Missing policy selector: '+selector);pins=pins[part];}
   const transformed=selector==='oldRootPins'||selector==='oldEngineDeclarationPin';
   add(spec.target,selector,selector==='oldEngineDeclarationPin'?[pins]:pins,transformed?'transformed-baseline-raw-observation':'raw-identity');
  }
 }
 for(const owner of ['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs']){
  const binding='imageResidencySuccessors',pairs=declaration(ownerText(owner),binding),seen=new Set();
  if(!Array.isArray(pairs))throw Error('Expected successor pair array');
  const rows=pairs.map(pair=>{
   if(!pair||!equal(Object.keys(pair).sort(),['base','current','path']))throw Error('Malformed successor pair');
   for(const arm of ['base','current'])if(!pair[arm]||!equal(Object.keys(pair[arm]).sort(),['bytes','sha256']))throw Error('Malformed successor arm');
   const base=repositoryPin({path:pair.path,...pair.base}),successor=repositoryPin({path:pair.path,...pair.current});
   if(seen.has(pair.path))throw Error('Duplicate successor path');seen.add(pair.path);
   const current=read.pin(pair.path),baseMatches=samePin(base,current),successorMatches=samePin(successor,current);
   return {path:pair.path,base,successor,current,identity:current===null?'missing':baseMatches&&successorMatches?'both':baseMatches?'base':successorMatches?'current':'neither'};
  });
  successorPairs.push({owner,binding,comparison:'raw-pair-observation-only',rows});
 }
 for(const [owner,binding,comparison]of [...m13PairRegistrations,...m42ContainedClipPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding+' = ')),...uiControlsPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m24ResetPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m34ThemePairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m24SpinePairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m3KeyRevealPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m33KeyboardPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m22SequencePairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m31UiPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m3PointerPairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding)),...m15PairRegistrations.filter(([owner,binding])=>ownerText(owner).includes('const '+binding))]){
  const pairs=registeredDeclaration(owner,binding),seen=new Set();
  if(!Array.isArray(pairs))throw Error('Expected registered M1.3 pair array');
  const rows=pairs.map(pair=>{
   if(!pair||!equal(Object.keys(pair).sort(),['base','current']))throw Error('Malformed M1.3 successor pair');
   const base=repositoryPin(pair.base),successor=repositoryPin(pair.current);
   if(base.path!==successor.path||seen.has(base.path))throw Error('M1.3 successor path differs or repeats');seen.add(base.path);
   const current=read.pin(base.path),baseMatches=samePin(base,current),successorMatches=samePin(successor,current);
   return {path:base.path,base,successor,current,identity:current===null?'missing':baseMatches&&successorMatches?'both':baseMatches?'base':successorMatches?'current':'neither'};
  });
  successorPairs.push({owner,binding,comparison,rows});
 }
 // Historical owners without this later declaration remain readable as history.
 // Current post-preamble extraction still requires one exact reviewed raw owner.
 for(const [owner,binding]of [...uiControlsGraphRegistrations,...m24ResetGraphRegistrations,...m34ThemeGraphRegistrations,...m24SpineGraphRegistrations,...m14GraphRegistrations,...m15GraphRegistrations,...m12PreparationGraphRegistrations,...m3PointerGraphRegistrations,...m31UiGraphRegistrations,...m22SequenceGraphRegistrations,...m33KeyboardGraphRegistrations]){
  if(!ownerText(owner).includes('const '+binding))continue;
  add(owner,binding,registeredDeclaration(owner,binding));
 }
 const inventory=codeInventory(root);for(const file of inventory)read.pin(file);
 const graphCoverage=[
  ['tools/spritesheet-boundary.mjs','graphPins','ss1AtlasGraphSuccessor','tools/spritesheet-boundary.mjs'],
  ['tools/browser-png-boundary.mjs','acceptedSnapshot.graph','atlasGraphSuccessor','tools/browser-png-boundary.mjs'],
  ['tests/types/atlas-import-diagnostic-expectations.json','sourcePolicy.modules',null,'tools/atlas-import-boundary.mjs']
 ].map(([owner,baseBinding,successorBinding,warmOwner])=>{
  const warmSuccessor={owner:warmOwner,binding:'m11WarmSubmissionGraphSuccessor'};
  const incrementalSuccessor={owner:warmOwner,binding:'m12IncrementalRenderingGraphSuccessor'};
  const sharedSuccessor={owner:warmOwner,binding:'m13SharedRenderingGraphSuccessor'};
  const webglSuccessor={owner:warmOwner,binding:'m14WebGL2GraphSuccessor'};
   const resourceRecoverySuccessor={owner:warmOwner,binding:'m15ResourceRecoveryGraphSuccessor'};
   const preparationHotPathSuccessor={owner:warmOwner,binding:'m12PreparationHotPathGraphSuccessor'};
   const pointerSuccessor={owner:warmOwner,binding:'m3PointerGraphSuccessor'};
   const sequenceSuccessor=ownerText(warmOwner).includes('const m22SequenceAdditionPins')?{owner:warmOwner,binding:'m22SequenceAdditionPins'}:undefined;
   const uiSuccessor=ownerText(warmOwner).includes('const m31UiAdditionPins')?{owner:warmOwner,binding:'m31UiAdditionPins'}:undefined;
   const spineSuccessor=ownerText(warmOwner).includes('const m24SpineAdditionPins')?{owner:warmOwner,binding:'m24SpineAdditionPins'}:undefined;
   const keyboardSuccessor=ownerText(warmOwner).includes('const m33KeyboardAdditionPins')?{owner:warmOwner,binding:'m33KeyboardAdditionPins'}:undefined;
  const declared=new Set(declarations.filter(x=>x.owner===owner&&(x.binding===baseBinding||x.binding===successorBinding)
   || x.owner===warmSuccessor.owner&&x.binding===warmSuccessor.binding
   || x.owner===incrementalSuccessor.owner&&x.binding===incrementalSuccessor.binding
   || x.owner===sharedSuccessor.owner&&x.binding===sharedSuccessor.binding
   || x.owner===webglSuccessor.owner&&x.binding===webglSuccessor.binding
    || x.owner===resourceRecoverySuccessor.owner&&x.binding===resourceRecoverySuccessor.binding
    || x.owner===preparationHotPathSuccessor.owner&&x.binding===preparationHotPathSuccessor.binding
    || x.owner===pointerSuccessor.owner&&x.binding===pointerSuccessor.binding
    || sequenceSuccessor&&x.owner===sequenceSuccessor.owner&&x.binding===sequenceSuccessor.binding
    || uiSuccessor&&x.owner===uiSuccessor.owner&&x.binding===uiSuccessor.binding
   || spineSuccessor&&x.owner===spineSuccessor.owner&&x.binding===spineSuccessor.binding
   || keyboardSuccessor&&x.owner===keyboardSuccessor.owner&&x.binding===keyboardSuccessor.binding).flatMap(x=>x.rows.map(row=>row.expected.path)));
  return {owner,baseBinding,successorBinding,warmSuccessor,incrementalSuccessor,sharedSuccessor,webglSuccessor,resourceRecoverySuccessor,preparationHotPathSuccessor,pointerSuccessor,...(uiSuccessor?{uiSuccessor}:{}),...(sequenceSuccessor?{sequenceSuccessor}:{}),...(keyboardSuccessor?{keyboardSuccessor}:{}),...(spineSuccessor?{spineSuccessor}:{}),unlisted:inventory.filter(file=>!declared.has(file)).map(file=>read.pin(file))};
 });
 // Many declarations can reference one path; retain every selector and pair arm.
 const byPath=new Map();
 function reference(expected,owner,binding,branch,comparison){
  if(!byPath.has(expected.path))byPath.set(expected.path,{path:expected.path,current:read.pin(expected.path),references:[]});
  byPath.get(expected.path).references.push({owner,binding,branch,comparison,expected});
 }
 for(const group of declarations)for(const item of group.rows)reference(item.expected,group.owner,group.binding,'expected',group.comparison??'raw-identity');
 for(const group of policyLinks)reference(group.row.expected,group.owner,group.binding,'expected','policy-owner-link');
 for(const group of successorPairs)for(const item of group.rows){reference(item.base,group.owner,group.binding,'base',group.comparison);reference(item.successor,group.owner,group.binding,'current',group.comparison);}
 const references=[...byPath.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const inputs=read.finish();if(!equal(inventory,codeInventory(root)))throw Error('Package inventory changed during preparation');
 return {schemaVersion:1,kind:'source-baseline',status:'review-required',scope:'Registered repository-owned declarations only; raw differences are not gate failures.',excluded:['Compiler and third-party dependency owners including Atlas inputPins/jsoncPins','Host group admission and inverse transforms, including package inverse evaluation','Resource-scene/atlas-frame multi-owner snapshots and other unregistered policies','Semantic/public/type/native acceptance'],declarations,policyLinks,successorPairs,graphCoverage,references,inventory,inputs};
}
function testNames(root){
 present(root,'tests/__egret_inventory_probe__');
 return fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x).sort();
}
export function prepareCatalogReview(root){
 const read=reader(root),old=JSON.parse(read.text(catalogFile));
 if(old.schemaVersion!==1||!equal(Object.keys(old.packages??{}).sort(),names)||!Array.isArray(old.tests)||!Array.isArray(old.policy)||!equal(old.policy.map(x=>x.path).sort(),schedules))throw Error('Unsupported catalog');
 const packages={},graph={};let stable=true;
 for(const name of names){
  const before=old.packages[name],file='packages/'+name+'/package.json';validPin(before.manifest);
  if(before.manifest.path!==file||!Array.isArray(before.dependencies))throw Error('Invalid package owner');
  const manifest=JSON.parse(read.text(file)),dependencies=Object.keys(manifest.dependencies??{}).filter(x=>x.startsWith('@egret/')).map(x=>x.slice(7)).sort();
  if(manifest.name!=='@egret/'+name||dependencies.some(x=>!names.includes(x)))throw Error('Unsupported package graph');
  packages[name]={manifest:read.pin(file),dependencies};graph[name]=dependencies;
  stable&&=samePin(before.manifest,read.pin(file))&&equal([...before.dependencies].sort(),dependencies);
 }
 const visiting=new Set(),visited=new Set();
 function visit(name){if(visiting.has(name))throw Error('Cyclic package graph');if(visited.has(name))return;visiting.add(name);graph[name].forEach(visit);visiting.delete(name);visited.add(name);}
 names.forEach(visit);
 const policy=old.policy.map(pin=>{validPin(pin);const current=read.pin(pin.path);if(!current)throw Error('Missing complete runner');stable&&=samePin(pin,current);return current;});
 const previous=new Map();
 for(const row of old.tests){
  validPin(row.file);if(!/^tests\/[A-Za-z0-9_-]+\.test\.mjs$/.test(row.file.path)||previous.has(row.file.path)||!Array.isArray(row.support))throw Error('Invalid test membership');
  if(row.packages!==null&&(!Array.isArray(row.packages)||!row.packages.length||new Set(row.packages).size!==row.packages.length||row.packages.some(x=>!names.includes(x))))throw Error('Invalid test ownership');
  const seen=new Set();for(const pin of row.support){validPin(pin);if(!pin.path.startsWith('tests/')||!pin.path.endsWith('.mjs')||seen.has(pin.path))throw Error('Invalid support owner');seen.add(pin.path);read.pin(pin.path);}
  previous.set(row.file.path,row);
 }
 const inventory=testNames(root),changes=[],tests=inventory.map(file=>{
  const current=read.pin(file);if(!current)throw Error('Test inventory changed');
  const before=previous.get(file),support=(before?.support??[]).map(pin=>read.pin(pin.path));
  const unchanged=before&&samePin(current,before.file)&&before.support.every((pin,i)=>samePin(pin,support[i]));
  const keep=stable&&unchanged;
  if(!keep)changes.push({path:file,reason:!stable?'package-or-schedule-changed':!before?'new-test':!samePin(current,before.file)?'test-changed':'support-changed-or-missing'});
  return {file:current,packages:keep?before.packages:null,support:support.filter(Boolean)};
 });
 const inputs=read.finish();if(!equal(inventory,testNames(root)))throw Error('Test inventory changed during preparation');
 return {schemaVersion:1,kind:'test-catalog',status:'review-required',catalog:{...old,packages,tests,policy},changes,removed:[...previous.keys()].filter(x=>!inventory.includes(x)).sort(),unavailable:inputs.filter(x=>x.identity===null).map(x=>x.path),inventory,inputs};
}
export function verifyMaintenanceProposal(root,proposal){
 if(proposal?.status!=='review-required')throw Error('Invalid maintenance proposal');
 const current=proposal.kind==='source-baseline'?prepareBaselineReview(root):proposal.kind==='test-catalog'?prepareCatalogReview(root):null;
 if(!current||!equal(current,proposal))throw Error('Maintenance proposal inputs or content changed');return true;
}
export function runMaintenance(args){
 if(args.length===1&&args[0]==='--baselines')return prepareBaselineReview(repository);
 if(args.length===1&&args[0]==='--catalog')return prepareCatalogReview(repository);
 if(args.length===2&&args[0]==='--check'){
  verifyMaintenanceProposal(repository,JSON.parse(fs.readFileSync(args[1],'utf8')));
  return {status:'current-inputs',acceptance:'none; independent review and complete gates remain required'};
 }
 throw Error('Usage: node tools/prepare-check-maintenance.mjs --baselines | --catalog | --check <proposal.json>');
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))console.log(JSON.stringify(runMaintenance(process.argv.slice(2)),null,2));
