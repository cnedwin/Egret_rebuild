// SPDX-License-Identifier: Apache-2.0
// Read-only registered compiler inputs. Raw observations never replace strict gates.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,logicalPath,physicalPathKey,samePhysicalPath} from './lib/file-identity.mjs';
import {uniqueJSON} from './prepare-check-maintenance.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url)));
// Each adapter declares its own saved schema; no recursive pin discovery is allowed.
const strictNames=['atlas-import','atlas-frame','bitmap-resource-slot','bitmap-binding-ticket','linear-layout','bitmap-button','display-anchor-offsets','display-container-add-child-at','display-container-child-index','display-container-remove-children','nine-slice-bitmap'];
const nativeNames=new Set(['bitmap-resource-slot','bitmap-binding-ticket','linear-layout','bitmap-button','display-anchor-offsets','display-container-add-child-at','display-container-child-index','display-container-remove-children']);
const legacyNames=['browser-png','spritesheet','sequence-playback','byte-writer','nine-slice','scene3d'];
const registry=[...strictNames,...legacyNames,'shared-render'];
const gate=name=>['byte-writer','nine-slice','scene3d'].includes(name)?'tools/check-types.mjs':'tools/'+name+'-types.mjs';
const inventoryPath=name=>'tests/types/'+name+'-diagnostic-expectations.json';
const nativeName='@typescript/typescript-win32-x64';
const sceneFixtures=['positive','web-positive','negative','web-negative','import-negative','web-dom-free-negative'].map(lane=>'tests/types/scene3d-'+lane+'.ts');
const packages=[['compiler','typescript'],['compiler-native','@typescript/typescript-win32-x64'],['project-json','jsonc-parser']];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const sort=(a,b)=>a<b?-1:a>b?1:0;
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),keys.sort());
function pin(value){
 requireThat(exact(value,['path','bytes','sha256'])&&Number.isSafeInteger(value.bytes)&&value.bytes>=0&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256),'Invalid raw identity');logicalPath(value.path);return value;
}
// A missing literal file is data. Aliases and nonregular descendants are errors.
function optionalPin(owner,file){
 logicalPath(file);let current=owner;const parts=file.split('/');
 for(let i=0;i<parts.length;i++){
  const entries=fs.readdirSync(current),part=parts[i];
  if(!entries.includes(part)){requireThat(!entries.some(x=>x.toLowerCase()===part.toLowerCase()),'Input spelling differs');return null;}
  current=path.join(current,part);const stat=fs.lstatSync(current);
  requireThat(!stat.isSymbolicLink()&&(i===parts.length-1?stat.isFile():stat.isDirectory()),'Nonregular compiler input');
 }
 return fingerprintFile(owner,file);
}
function inventory(owner){
 const rows=[];
 function walk(relative){
  for(const item of fs.readdirSync(path.join(owner,relative),{withFileTypes:true}).sort((a,b)=>sort(a.name,b.name))){
   const file=relative?relative+'/'+item.name:item.name;logicalPath(file);
   requireThat(!item.isSymbolicLink()&&(item.isDirectory()||item.isFile()),'Nonregular dependency inventory');
   if(item.isDirectory())walk(file);else rows.push(fingerprintFile(owner,file));
  }
 }
 walk('');return rows.sort((a,b)=>sort(a.path,b.path));
}
function decode(owner,file,identity){
 requireThat(identity!==null,'Required input missing: '+file);requireThat(identity.bytes<=16_777_216,'JSON artifact exceeds 16 MiB');
 const raw=fs.readFileSync(path.join(owner,file));
 requireThat(raw.length===identity.bytes&&createHash('sha256').update(raw).digest('hex')===identity.sha256,'Input changed during read');
 return uniqueJSON(new TextDecoder('utf-8',{fatal:true}).decode(raw));
}
function resolveOwners(root){
 const owners={repository:root};
 for(const [owner,name]of packages){const selected=fs.realpathSync(path.join(root,'node_modules',name));requireThat(fs.statSync(selected).isDirectory(),'Dependency owner directory required');owners[owner]=selected;}
 // Resolve metadata through the wrapper's Node search path, without importing it.
 const name='@typescript/typescript-win32-x64';
 const search=createRequire(path.join(owners.compiler,'package.json')).resolve.paths(name+'/package.json');
 // Inspect the fixed metadata subpath afresh: require.resolve caches earlier hits.
 const selected=search.map(base=>path.join(base,name,'package.json')).find(file=>fs.existsSync(file));
 requireThat(selected,'Wrapper native metadata missing');
 const native=fs.realpathSync(path.dirname(selected));
 requireThat(native===owners['compiler-native'],'Wrapper and repository native owners differ');
 return {owners,wrapperNative:native};
}
function target(file){
 logicalPath(file);
 for(const [owner,name]of packages){const prefix='node_modules/'+name+'/';if(file.startsWith(prefix))return {owner,path:logicalPath(file.slice(prefix.length))};}
 const allowed=/^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file)
  ||registry.some(name=>file===gate(name))||file==='tools/lib/file-identity.mjs'||/^tests\/types\/[A-Za-z0-9_.-]+\.(?:json|ts)$/.test(file)
  ||/^packages\/(?:contracts|engine|project|runtime)\/(?:(?:src|dist|web|rendering)\/.+\.(?:ts|js)|package\.json|tsconfig(?:\.[A-Za-z0-9-]+)?\.json)$/.test(file);
 requireThat(allowed&&!file.split('/').some(x=>x.startsWith('.')||x==='node_modules'),'Unsupported compiler input owner: '+file);
 return {owner:'repository',path:file};
}
// These are reviewed source revisions, not caller-supplied parser permissions.
const inlineSources=[
 {
  "path": "tools/check-types.mjs",
  "bytes": 94916,
  "sha256": "13080da8e72418df9b8e8279d09b53e36839a5826953f84143c5787d1d1bff7a"
 },
 {
  "path": "tools/bitmap-resource-slot-types.mjs",
  "bytes": 10489,
  "sha256": "454abe1eb4fafc7c805e8c806d61e6f592e8c7a5345fd4a2d23316b5b500bf73"
 },
 {
  "path": "tools/bitmap-binding-ticket-types.mjs",
  "bytes": 13171,
  "sha256": "57ed148c4e654d1eb8da46991a9b7902123a6e1d673efe1de05a0c5657f02879"
 },
 {
  "path": "tools/linear-layout-types.mjs",
  "bytes": 10385,
  "sha256": "02a691c2e66eb7d817bcf8dea1a70f908337d9b064b36797f3fea0c2a06e73a8"
 },
 {
  "path": "tools/bitmap-button-types.mjs",
  "bytes": 16544,
  "sha256": "792ea25c61a5815f32df80bc5cfe5a1f646452ca927e0022ee7f43d6deaf1e4a"
 },
 {
  "path": "tools/display-anchor-offsets-types.mjs",
  "bytes": 15885,
  "sha256": "fee3a36afb7516c991775c052abc0889541f8a9cf9174ea526c428470fee56c1"
 },
 {
  "path": "tools/display-container-add-child-at-types.mjs",
  "bytes": 17991,
  "sha256": "267a68a830c4394dc63dfd7fde01c5b9f4ed5b773704bd31f90d2199898d7643"
 },
 {
  "path": "tools/display-container-child-index-types.mjs",
  "bytes": 16406,
  "sha256": "692faad618a5ffb05d6bcfbd98d97bc3f6806b87040a29cc6836345d3b9a6a6a"
 },
 {
  "path": "tools/display-container-remove-children-types.mjs",
  "bytes": 14624,
  "sha256": "b20a666a9ccaf770ef1b2d9dbc3c086809f45f35aefc02366388a50c09818578"
 },
 {
  "path": "tools/sequence-playback-types.mjs",
  "bytes": 17296,
  "sha256": "8b2d266f7aacd680f7a1581afb2ea1a1381f02fc44cd70b340ee8961c7584222"
 }
];
// This one reviewed gate revision retains its original raw authority above.
// It adds no caller-selected parser or source permission.
const inlineSourceSuccessors = [{"path":"tools/sequence-playback-types.mjs","base":{"bytes":17296,"sha256":"8b2d266f7aacd680f7a1581afb2ea1a1381f02fc44cd70b340ee8961c7584222"},"current":{"bytes":18474,"sha256":"e9388c73080d4db112b3260e17bdfc7d1ff1ca6130fa8cccdae7d3b60084ba6b"}}];
// M1.3 source revisions retain every original and M1.2 tuple above.
const m13InlineSourceSuccessors = [{"path":"tools/check-types.mjs","base":{"bytes":94916,"sha256":"13080da8e72418df9b8e8279d09b53e36839a5826953f84143c5787d1d1bff7a"},"current":{"bytes":121118,"sha256":"64d5996ebf925b8b2eda7e04d20e939e399d50953da0023a48ffd02223985093"}},{"path":"tools/bitmap-resource-slot-types.mjs","base":{"bytes":10489,"sha256":"454abe1eb4fafc7c805e8c806d61e6f592e8c7a5345fd4a2d23316b5b500bf73"},"current":{"bytes":11184,"sha256":"cfce369d4a6eb4644305f47ae1ae4375d67f22173581a69bfd0fe1974fd1c5c9"}},{"path":"tools/bitmap-binding-ticket-types.mjs","base":{"bytes":13171,"sha256":"57ed148c4e654d1eb8da46991a9b7902123a6e1d673efe1de05a0c5657f02879"},"current":{"bytes":13887,"sha256":"cca972eaedd8ad923b0c740dcd79426bdf9377f16d1d5276f561b617463a89c9"}},{"path":"tools/linear-layout-types.mjs","base":{"bytes":10385,"sha256":"02a691c2e66eb7d817bcf8dea1a70f908337d9b064b36797f3fea0c2a06e73a8"},"current":{"bytes":11073,"sha256":"5714975b76d8a9d5173f0e01bf9b0008485ecbdb1eaf7028cad2fea7f1ae484e"}},{"path":"tools/bitmap-button-types.mjs","base":{"bytes":16544,"sha256":"792ea25c61a5815f32df80bc5cfe5a1f646452ca927e0022ee7f43d6deaf1e4a"},"current":{"bytes":17175,"sha256":"a3b39cd4b01a07925acb380561ca7234cf7a8d954b83a75c5b0a1a3821eaf9aa"}},{"path":"tools/display-anchor-offsets-types.mjs","base":{"bytes":15885,"sha256":"fee3a36afb7516c991775c052abc0889541f8a9cf9174ea526c428470fee56c1"},"current":{"bytes":16526,"sha256":"fd4f28d45b4324473e5887ec5236811cd00d6bd98498192c44c88252515f562c"}},{"path":"tools/display-container-add-child-at-types.mjs","base":{"bytes":17991,"sha256":"267a68a830c4394dc63dfd7fde01c5b9f4ed5b773704bd31f90d2199898d7643"},"current":{"bytes":18718,"sha256":"4c95f93cae5b8bbc0336b2a8d9dcd50dbbe1789b08aa8b80cd5154043d3524b1"}},{"path":"tools/display-container-child-index-types.mjs","base":{"bytes":16406,"sha256":"692faad618a5ffb05d6bcfbd98d97bc3f6806b87040a29cc6836345d3b9a6a6a"},"current":{"bytes":17112,"sha256":"23dcb3eccb938b0f0b2847715ba3a989bef86d05b40b4d35fda7c564f5d58fb1"}},{"path":"tools/display-container-remove-children-types.mjs","base":{"bytes":14624,"sha256":"b20a666a9ccaf770ef1b2d9dbc3c086809f45f35aefc02366388a50c09818578"},"current":{"bytes":15268,"sha256":"0114c56923843c8d2456bfd6ae7f9988d739f51c07ea4ced346e8bc1ec03064c"}},{"path":"tools/sequence-playback-types.mjs","base":{"bytes":18474,"sha256":"e9388c73080d4db112b3260e17bdfc7d1ff1ca6130fa8cccdae7d3b60084ba6b"},"current":{"bytes":19255,"sha256":"42a0bad83c5f68f74d2b1e26bd9c5183be9e94e1cb4c36a01a4b60c373e4a6ea"}}];
// M1.4 appends only one strict-checker import. Keep every prior revision and
// extracted inline span; this exact successor is not a source refresh policy.
const m14InlineSourceSuccessor = {"path":"tools/check-types.mjs","predecessor":{"bytes":121118,"sha256":"64d5996ebf925b8b2eda7e04d20e939e399d50953da0023a48ffd02223985093"},"current":{"bytes":121161,"sha256":"c85407cbdc9c6222cbf240de21e82afd37725e6c8a68bed9ca0d098d7b6dc343"},"appended":"await import('./shared-webgl2-types.mjs');\n"};
// M1.5 admits two complete reviewed revisions, with exact inverses to M1.4.
const m15InlineSourceSuccessor = {"path":"tools/check-types.mjs","predecessor":{"bytes":121161,"sha256":"c85407cbdc9c6222cbf240de21e82afd37725e6c8a68bed9ca0d098d7b6dc343"},"delegate":{"bytes":121293,"sha256":"a4cde570d560924537f8caabb7fa8a9b5059241fedda6edfc4968dba443a7e2e"},"scene":{"bytes":141012,"sha256":"b584aa0dc9368285380a3f1569b49430e6fceee3f994a2be4d37acbbc1e9785e"},"appended":"\n// Preserve every retained strict lane before the seven M1.5 public consumer pairs.\nawait import('./resource-recovery-types.mjs');\n"};
function m15ScenePredecessor(raw){
 let text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 const start="// The separately observed M1.5 closure retains the complete M1.3 table above.\n",end='const sceneDomM13Selected = ';
 requireThat(text.split(start).length===2,'M1.5 scene insertion differs');
 const a=text.indexOf(start),b=text.indexOf(end,a);
 requireThat(b>a&&b-a===19541,'M1.5 scene insertion span differs');text=text.slice(0,a)+text.slice(b);
 const changes=[
  ["const sceneDomM13Selected = sceneDomM15Selected || existsSync","const sceneDomM13Selected = existsSync",1],
  ["  if(sceneDomM15Selected&&!sceneDomM15Markers.every(file=>existsSync(path.join(root,file))))throw Error(sceneDomLabel+' incomplete declaration markers');\n","",1],
  ["sceneDomSuccessor.","sceneDomM13Successor.",8],
  ["Error(sceneDomLabel+'","Error('S3D1 M1.3",5]
 ];
 for(const [after,before,count]of changes){requireThat(text.split(after).length===count+1,'M1.5 scene inverse differs');text=text.split(after).join(before);}
 return Buffer.from(text);
}
// These exact strict gate revisions change only the authenticated helper bootstrap.
const m14StrictSourceSuccessors = [{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"cfce369d4a6eb4644305f47ae1ae4375d67f22173581a69bfd0fe1974fd1c5c9"},"current":{"bytes":11184,"sha256":"2f1c767bc1701c5bcf087b7eb48857006334ffc36c205a82cf81d9fa2b857315"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"cca972eaedd8ad923b0c740dcd79426bdf9377f16d1d5276f561b617463a89c9"},"current":{"bytes":13887,"sha256":"1e80a8a04ae0b35dd1084762172aed96e966fe3a3e9e47a86da383cd853bfb32"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"5714975b76d8a9d5173f0e01bf9b0008485ecbdb1eaf7028cad2fea7f1ae484e"},"current":{"bytes":11073,"sha256":"1d9a07307a4725eb8234cbb062f23474c2c4ce28ef0a43706a041cecbe246085"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"a3b39cd4b01a07925acb380561ca7234cf7a8d954b83a75c5b0a1a3821eaf9aa"},"current":{"bytes":17175,"sha256":"74c55fbc100d49ed03278b2d8eb85d4833379a8219c932fce5325ec9cd448fe1"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"fd4f28d45b4324473e5887ec5236811cd00d6bd98498192c44c88252515f562c"},"current":{"bytes":16526,"sha256":"04fcc94308c627433412348d9088fb98d032808d9029ef5e8fc154cf28868ae4"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"4c95f93cae5b8bbc0336b2a8d9dcd50dbbe1789b08aa8b80cd5154043d3524b1"},"current":{"bytes":18718,"sha256":"64d67885a2c91e19beda887da12a44d09938d71afceff3c001a6cf51c4523563"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"23dcb3eccb938b0f0b2847715ba3a989bef86d05b40b4d35fda7c564f5d58fb1"},"current":{"bytes":17112,"sha256":"eea91a2a74aaf1a7d210a923106afd305e0028bd29a24482f9669a368d2c689f"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"0114c56923843c8d2456bfd6ae7f9988d739f51c07ea4ced346e8bc1ec03064c"},"current":{"bytes":15268,"sha256":"df1dd4a369ac4d19f892aed8d684e5097f86935f470e6f02deed48c5c3f20159"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"42a0bad83c5f68f74d2b1e26bd9c5183be9e94e1cb4c36a01a4b60c373e4a6ea"},"current":{"bytes":19255,"sha256":"904cc980cc1ae6bc8542ea37cf5f876020c8ba5576fd6f3066536e35de33c6b6"}}];
const m14StrictBootstrap = {"before":"m13HelperPin.bytes !== 10785 || m13HelperPin.sha256 !== '61a14bb8be2162d861a26b822ded713c552b4032d755e291578b225cd13ef337'","after":"m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634'"};
// M1.5 keeps the exact M1.4 predecessor and reverses only its helper bootstrap.
const m15StrictSourceSuccessors = [{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"2f1c767bc1701c5bcf087b7eb48857006334ffc36c205a82cf81d9fa2b857315"},"current":{"bytes":11184,"sha256":"c97f8b75d9103477c7f5e5932f0fb75e588d42eec31a73e6f66327fae9275eaf"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"1e80a8a04ae0b35dd1084762172aed96e966fe3a3e9e47a86da383cd853bfb32"},"current":{"bytes":13887,"sha256":"b36874eaab10b6c275424584d062b599f8e14a215336a7722e9a3783190a8782"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"1d9a07307a4725eb8234cbb062f23474c2c4ce28ef0a43706a041cecbe246085"},"current":{"bytes":11073,"sha256":"89cf1e6e5fd099871ff0d7388df1b0b6e6accd36c78aef9aa33e1e5426fa71c3"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"74c55fbc100d49ed03278b2d8eb85d4833379a8219c932fce5325ec9cd448fe1"},"current":{"bytes":17175,"sha256":"919546bc07a51a78d499ae070618d7000e2d87774ad4af3c8a540b395924bbb8"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"04fcc94308c627433412348d9088fb98d032808d9029ef5e8fc154cf28868ae4"},"current":{"bytes":16526,"sha256":"9d37f5989501d97094b25a0d9130f98c906cdc60bea4b1f9a042279b7279f90c"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"64d67885a2c91e19beda887da12a44d09938d71afceff3c001a6cf51c4523563"},"current":{"bytes":18718,"sha256":"f25ded3a21e455bfc45d5181025d7fd6dcd43cd666a08bc246855fce4452ee91"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"eea91a2a74aaf1a7d210a923106afd305e0028bd29a24482f9669a368d2c689f"},"current":{"bytes":17112,"sha256":"fb2d518381df6f41795f198c5b353b03fc194361151bbdd5963fde78e7f38929"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"df1dd4a369ac4d19f892aed8d684e5097f86935f470e6f02deed48c5c3f20159"},"current":{"bytes":15268,"sha256":"f03e8cfc77240d8ea40021333bf13e56cc15e0e0f469442fd6a72dee7e5bd31b"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"904cc980cc1ae6bc8542ea37cf5f876020c8ba5576fd6f3066536e35de33c6b6"},"current":{"bytes":19255,"sha256":"6dffcc40c3654db9c9faa2f9983eafea7b6e91960aab20f279b0f5caba9a66be"}}];
const m15StrictBootstrap = {"before":"m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634'","after":"m13HelperPin.bytes !== 12701 || m13HelperPin.sha256 !== '0c8ae45e31b879ca8e84633091f3a5e938d7712c4f2dff7cf1af3013859b91ad'"};
// Current helper bootstraps reverse exactly to their retained M1.5 actors.
const m12HotPathStrictSourceSuccessors = [{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"c97f8b75d9103477c7f5e5932f0fb75e588d42eec31a73e6f66327fae9275eaf"},"current":{"bytes":11184,"sha256":"e368d684d0fcaa7ad64539464110f8313cd8e17f2769421cd534953064317629"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"b36874eaab10b6c275424584d062b599f8e14a215336a7722e9a3783190a8782"},"current":{"bytes":13887,"sha256":"c59ec5a76da98fae8389671152ef38ae07653ce6b8680443b3a05c89061753f9"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"89cf1e6e5fd099871ff0d7388df1b0b6e6accd36c78aef9aa33e1e5426fa71c3"},"current":{"bytes":11073,"sha256":"aecf36d5290b8691cb08b838a008767300f1d62793dfaf3a482ff349cf87f369"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"919546bc07a51a78d499ae070618d7000e2d87774ad4af3c8a540b395924bbb8"},"current":{"bytes":17175,"sha256":"38049fb026e9602a5666709a6995a83d619e55f4ff69c777bd282fcc4f13a594"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"9d37f5989501d97094b25a0d9130f98c906cdc60bea4b1f9a042279b7279f90c"},"current":{"bytes":16526,"sha256":"ec55c864f05220560e9bf1dec478bb4ec9654cdf643230d2fe029dcfc9e2633a"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"f25ded3a21e455bfc45d5181025d7fd6dcd43cd666a08bc246855fce4452ee91"},"current":{"bytes":18718,"sha256":"39dbbc65ab64ddc2f9f4cf92333f689d8a8998e20277d9a327bf7ecd179e9fbe"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"fb2d518381df6f41795f198c5b353b03fc194361151bbdd5963fde78e7f38929"},"current":{"bytes":17112,"sha256":"74c3722cb43b203b46e7aed2f442f34e220849be55a92dc165e48af29c156a0f"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"f03e8cfc77240d8ea40021333bf13e56cc15e0e0f469442fd6a72dee7e5bd31b"},"current":{"bytes":15268,"sha256":"08abd88096100f2dc45f0b197cdde72baf55bfff93e34c6f1e508c7ef0fa7514"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"6dffcc40c3654db9c9faa2f9983eafea7b6e91960aab20f279b0f5caba9a66be"},"current":{"bytes":19255,"sha256":"4b0dccd9c27eeb4ae049a80048e978f821fde744c712530a6d342dcad8abaf35"}}];
const m12HotPathStrictBootstrap = {"before":"m13HelperPin.bytes !== 12701 || m13HelperPin.sha256 !== '0c8ae45e31b879ca8e84633091f3a5e938d7712c4f2dff7cf1af3013859b91ad'","after":"m13HelperPin.bytes !== 14254 || m13HelperPin.sha256 !== '01ac10f3471436f5b5a72ae01abe4813f7843a331a2b071e74c281ee3d3aaa0d'"};
// M3.3 admits only the nine existing wrappers with the reviewed pointer-input helper bootstrap.
// Each exact inverse retains the complete M1.2/M1.5/M1.4 predecessor chain.
const m33PointerStrictSourceSuccessors = [{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"e368d684d0fcaa7ad64539464110f8313cd8e17f2769421cd534953064317629"},"current":{"bytes":11184,"sha256":"6e6bf53aa8ef8f966c3ea19a51fa753d66a78755d6d4308b75df98d2f6f279ca"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"c59ec5a76da98fae8389671152ef38ae07653ce6b8680443b3a05c89061753f9"},"current":{"bytes":13887,"sha256":"e29cd5ec5e3e0ac49c1ed60f5625f9619ebfd2efb47eff54a73f5c89e55d4338"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"aecf36d5290b8691cb08b838a008767300f1d62793dfaf3a482ff349cf87f369"},"current":{"bytes":11073,"sha256":"2b1fcdaab0348fc048336809ceb54f90d32a01ba9808beaff4a813c82c90faee"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"38049fb026e9602a5666709a6995a83d619e55f4ff69c777bd282fcc4f13a594"},"current":{"bytes":17175,"sha256":"20d345fe4a69ce04e7092191c9dfb51a2c12c487985507bcb6cec77ab833b19e"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"ec55c864f05220560e9bf1dec478bb4ec9654cdf643230d2fe029dcfc9e2633a"},"current":{"bytes":16526,"sha256":"41b9b17458129ad80e06e9585e6389456bde45a2c14f8fc1b34e7677c45ebdda"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"39dbbc65ab64ddc2f9f4cf92333f689d8a8998e20277d9a327bf7ecd179e9fbe"},"current":{"bytes":18718,"sha256":"43938661831d4cd464867fc3c32e925c021fafb45fc567f41a3fe5d1f5371227"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"74c3722cb43b203b46e7aed2f442f34e220849be55a92dc165e48af29c156a0f"},"current":{"bytes":17112,"sha256":"fafb90b31816b298863a2742afdeb380d622d47626daaa202a9895498b045e90"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"08abd88096100f2dc45f0b197cdde72baf55bfff93e34c6f1e508c7ef0fa7514"},"current":{"bytes":15268,"sha256":"47cc4b3670285c429cfdbd63d1b5276ce69df829e8b084357644c6a305f1b18d"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"4b0dccd9c27eeb4ae049a80048e978f821fde744c712530a6d342dcad8abaf35"},"current":{"bytes":19255,"sha256":"1478a503c52bad8cca832b86437b7a7546db0eadbc7fbdc9c7ec119ba950fe01"}}];
const m33PointerStrictBootstrap = {"before":"m13HelperPin.bytes !== 14254 || m13HelperPin.sha256 !== '01ac10f3471436f5b5a72ae01abe4813f7843a331a2b071e74c281ee3d3aaa0d'","after":"m13HelperPin.bytes !== 16190 || m13HelperPin.sha256 !== '6410f814c90eaf001850a35ff74e826ca994e39cea7434b10a94dda165a01b88'"};
// M2.1 keeps the existing nine wrapper histories and admits only this candidate.
const m21ContentStrictSourceSuccessors = [{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"6e6bf53aa8ef8f966c3ea19a51fa753d66a78755d6d4308b75df98d2f6f279ca"},"current":{"bytes":11184,"sha256":"4a86730c6708b1902dbc3cb44850cfdb3b815ba36574a4cb075f79a03c0c78b5"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"e29cd5ec5e3e0ac49c1ed60f5625f9619ebfd2efb47eff54a73f5c89e55d4338"},"current":{"bytes":13887,"sha256":"e1f5e567527b77668668d35b70b0dc0a8fa16e0d8284913f416f056385ebcb1a"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"2b1fcdaab0348fc048336809ceb54f90d32a01ba9808beaff4a813c82c90faee"},"current":{"bytes":11073,"sha256":"190eba781a679110b93f79f90d062d79c28719769693424b0ab015502151964c"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"20d345fe4a69ce04e7092191c9dfb51a2c12c487985507bcb6cec77ab833b19e"},"current":{"bytes":17175,"sha256":"7876598c62518c5f1728826591a4a58513d5830d101d7300422f08bb8ec84e55"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"41b9b17458129ad80e06e9585e6389456bde45a2c14f8fc1b34e7677c45ebdda"},"current":{"bytes":16526,"sha256":"7c2d96d633e7d5a4e388ccc5b5542d995df2cd8a2e71637c0cbc913764384ff7"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"43938661831d4cd464867fc3c32e925c021fafb45fc567f41a3fe5d1f5371227"},"current":{"bytes":18718,"sha256":"4c5dc914f9086b38614472b5b7b904a13522126364e260e95fe617cc21a696ac"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"fafb90b31816b298863a2742afdeb380d622d47626daaa202a9895498b045e90"},"current":{"bytes":17112,"sha256":"fb5258ab0ccbff63d10ed2772ab820962fe6c9a4bd178440e52f2f9628f9dfc2"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"47cc4b3670285c429cfdbd63d1b5276ce69df829e8b084357644c6a305f1b18d"},"current":{"bytes":15268,"sha256":"48a3f5e3ad4efdc50edc96062f00128a7a81165cf583b9a5e8dc70f36f0a0721"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"1478a503c52bad8cca832b86437b7a7546db0eadbc7fbdc9c7ec119ba950fe01"},"current":{"bytes":19297,"sha256":"cbb8774959757fb4db286946458f1ddf9ace9dc77d41be2c068ecd8a8036d57b"}}];
const m21ContentStrictBootstrap = {"before":"m13HelperPin.bytes !== 16190 || m13HelperPin.sha256 !== '6410f814c90eaf001850a35ff74e826ca994e39cea7434b10a94dda165a01b88'","after":"m13HelperPin.bytes !== 19535 || m13HelperPin.sha256 !== '7e458ff6c264079df2db6178014b4cea65b2067906484d2bf794c41e0e28c074'"};
const m22SequenceInlineSources = [{"path":"tools/atlas-frame-types.mjs","predecessor":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"922c6bfddfd41b3207075745f8f386015370d891bff8197deb70c0950e0ca70a"},"current":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"0cb8bc6ccc6c5f3492c2b14af2fbf71ff2656347d3bdc8ab9b17e9a9a5e51f7d"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/atlas-import-types.mjs","predecessor":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"0a3e63c34afa6774814f2cf05c47c5e499366bdd23ef82c8fa26a296df235e23"},"current":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"577e8c279f70f0b290b26cbb2e6be870a6f96c9b17555541f396945b6ece626d"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"49ee10d9589f836b488d6458d923f5fe40da64e4166efe7188db1765bf025e03"},"current":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"147614e18551d9125bda7f565f9c2ebeecad5fb109d5141bf398eaf528905bb8"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e5cd2730ea1d71a3a86c0da63055684e3a559f373755cfad6592978e32eee3ab"},"current":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e76a3e6b40a0d173b3df8a18db41ffbcd7b6692f4935569c3fef2af73a7dc7d4"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/linear-layout-types.mjs","predecessor":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"eea842819e1bca56d9db9a1a266a383c4a05c86cd9b2c3f65325be9d90976afb"},"current":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"5fb964ecfd0e8490f21f0488f48c63d074489d0e23b8a4e95947c117e0068551"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/bitmap-button-types.mjs","predecessor":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"42559f04035034289e7a6c6e41a0539f9f3dfbde8321b1f251af2265e0a200f8"},"current":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"3046b63c077970f704b37ef519cf7d948b7ec56203a6d5a2e9864af7caab1b47"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"3403c30220a0bca502772669c8c67255dab6eb68254d1862f34bfdc53aea3510"},"current":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"0fbfb8b641f89584a8e50f2fb5811ada2667c2b3acfb8a9e4f1dc8961b2fb50b"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4bc3d2d9f3c86fd4d531781c4390f0d939f24aa691e2edc563920d0ca4b63b60"},"current":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4692050db2f8556d0fc2cb63b394cdc3a99ca72d7aceb3e57c6f54bf66bcb158"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"5bc707351c3668800e8138f88d6fc5782e3b65d70c29d846e07ad34c3f1c1ff0"},"current":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"2799c3f5c7c84e338f599ea094fce7354aea674cf809ad4c95310ad9d7d4f8cb"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"35779d8fb02e90cf1de53a5b18b30d2ca1239a37840142e5d9ca775c4ba69f1a"},"current":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"50e324f26a1395a998c6927a48c9eae5b95cc1b79ed35ebab41c8269d5702435"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/nine-slice-bitmap-types.mjs","predecessor":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"6675992221c9f97122a1edd5b6d1d8d8abc9fd3423fb8bcf8b90a239d99f048f"},"current":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"df22758ec6fa5ca59776d0941b0408786a41935689833c649cb1b174dcb50ee2"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/sequence-playback-types.mjs","predecessor":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"6bbaed98027e0199cbbe947bea8a461141000c9e0840f1af7673bbe926c77b0b"},"current":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"e539361d17451ff4464377da82cfae1316aa93db3ec8043eb273eefa96364b63"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/check-types.mjs","predecessor":{"path":"tools/check-types.mjs","bytes":142629,"sha256":"f7b2b034bd836799a3ce7e19860f6af22a3c4087a74ac24f8b79ad068006a1dd"},"current":{"path":"tools/check-types.mjs","bytes":144395,"sha256":"2ca30bd7ebf5a761042e9d661f0ae3bc608153fd4947680c5b2ed348ced1b596"},"inverse":[{"from":"// Match every optional sequence-control misuse to its actual compiler tuple.\n  const sequenceControlCases = [{\"name\":\"optional-entry-only\",\"line\":489,\"column\":21,\"code\":2339},{\"name\":\"controller-type-only\",\"line\":491,\"column\":23,\"code\":2551},{\"name\":\"unknown-profile\",\"line\":493,\"column\":59,\"code\":2322},{\"name\":\"invalid-repeat-kind\",\"line\":495,\"column\":95,\"code\":2322},{\"name\":\"numeric-marker-id\",\"line\":497,\"column\":106,\"code\":2322},{\"name\":\"invalid-callback-return\",\"line\":499,\"column\":97,\"code\":2322},{\"name\":\"invalid-seek-replay\",\"line\":501,\"column\":42,\"code\":2322},{\"name\":\"immutable-state\",\"line\":503,\"column\":24,\"code\":2540},{\"name\":\"nonforgeable-controller\",\"line\":505,\"column\":7,\"code\":2741},{\"name\":\"discriminated-completion\",\"line\":509,\"column\":11,\"code\":2339}];\n  const sequenceControlMarkers=raw.split(/\\r?\\n/).flatMap((line,index)=>{const match=line.match(/@ts-expect-error SEQUENCE_CONTROL_CASE ([\\w-]+)/);return match?[{name:match[1],line:index+2}]:[];});\n  if(JSON.stringify(sequenceControlMarkers)!==JSON.stringify(sequenceControlCases.map(({name,line})=>({name,line})))||(raw.match(/SEQUENCE_CONTROL_CASE/g)??[]).length!==10)throw Error('Sequence control exact negative membership changed');\n  const sequenceControlReceipts=sequenceControlCases.map(expected=>{\n    const found=observedGeometry.filter(actual=>actual.file==='tests/types/invalid.generated.ts'&&actual.line===expected.line);\n    if(found.length!==1||found[0].column!==expected.column||found[0].code!==expected.code)throw Error('Sequence control unsuppressed exact diagnostic changed: '+expected.name);\n    return {name:expected.name,actual:found[0]};\n  });\n  console.log('Sequence control individual unsuppressed diagnostic receipts: '+JSON.stringify(sequenceControlReceipts));\n\n  ","to":""}]}];
function m22SequencePrevious(raw,selected){
 if(!selected)return raw;
 const identity=body=>({path:selected.path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 if(JSON.stringify(identity(raw))!==JSON.stringify(selected.current))return raw;
 let text=raw.toString('utf8');
 if(selected.block){if(text.split(selected.block).length!==2)throw Error('M2.2 exact source block differs');text=text.replace(selected.block,'');}
 for(const inverse of selected.inverse){if(text.split(inverse.from).length!==2)throw Error('M2.2 exact source inverse differs');text=text.replace(inverse.from,inverse.to);}
 const previous=Buffer.from(text);if(JSON.stringify(identity(previous))!==JSON.stringify(selected.predecessor))throw Error('M2.2 complete source predecessor differs');return previous;
}

// Exact UI insertions invert to the previously reviewed complete source owners.
const m31UiInlineSources = [{"path":"tools/atlas-frame-types.mjs","kind":"strict","predecessor":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"5758b6783ae84cce24cb21eb6676ab3358a748437d23303b4dea412be36deec5"},"current":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"922c6bfddfd41b3207075745f8f386015370d891bff8197deb70c0950e0ca70a"}},{"path":"tools/atlas-import-types.mjs","kind":"strict","predecessor":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"94212adb90496a82aedbdac4cb7705aaec47e7ee124409bb21b9fb82d0bd7508"},"current":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"0a3e63c34afa6774814f2cf05c47c5e499366bdd23ef82c8fa26a296df235e23"}},{"path":"tools/bitmap-resource-slot-types.mjs","kind":"strict","predecessor":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"4a86730c6708b1902dbc3cb44850cfdb3b815ba36574a4cb075f79a03c0c78b5"},"current":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"49ee10d9589f836b488d6458d923f5fe40da64e4166efe7188db1765bf025e03"}},{"path":"tools/bitmap-binding-ticket-types.mjs","kind":"strict","predecessor":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e1f5e567527b77668668d35b70b0dc0a8fa16e0d8284913f416f056385ebcb1a"},"current":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e5cd2730ea1d71a3a86c0da63055684e3a559f373755cfad6592978e32eee3ab"}},{"path":"tools/linear-layout-types.mjs","kind":"strict","predecessor":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"190eba781a679110b93f79f90d062d79c28719769693424b0ab015502151964c"},"current":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"eea842819e1bca56d9db9a1a266a383c4a05c86cd9b2c3f65325be9d90976afb"}},{"path":"tools/bitmap-button-types.mjs","kind":"strict","predecessor":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"7876598c62518c5f1728826591a4a58513d5830d101d7300422f08bb8ec84e55"},"current":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"42559f04035034289e7a6c6e41a0539f9f3dfbde8321b1f251af2265e0a200f8"}},{"path":"tools/display-anchor-offsets-types.mjs","kind":"strict","predecessor":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"7c2d96d633e7d5a4e388ccc5b5542d995df2cd8a2e71637c0cbc913764384ff7"},"current":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"3403c30220a0bca502772669c8c67255dab6eb68254d1862f34bfdc53aea3510"}},{"path":"tools/display-container-add-child-at-types.mjs","kind":"strict","predecessor":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4c5dc914f9086b38614472b5b7b904a13522126364e260e95fe617cc21a696ac"},"current":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4bc3d2d9f3c86fd4d531781c4390f0d939f24aa691e2edc563920d0ca4b63b60"}},{"path":"tools/display-container-child-index-types.mjs","kind":"strict","predecessor":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"fb5258ab0ccbff63d10ed2772ab820962fe6c9a4bd178440e52f2f9628f9dfc2"},"current":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"5bc707351c3668800e8138f88d6fc5782e3b65d70c29d846e07ad34c3f1c1ff0"}},{"path":"tools/display-container-remove-children-types.mjs","kind":"strict","predecessor":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"48a3f5e3ad4efdc50edc96062f00128a7a81165cf583b9a5e8dc70f36f0a0721"},"current":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"35779d8fb02e90cf1de53a5b18b30d2ca1239a37840142e5d9ca775c4ba69f1a"}},{"path":"tools/nine-slice-bitmap-types.mjs","kind":"strict","predecessor":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"d924ec9f3c17224339863f57f103a4514fdf1e7b593f8ad8edf2737cadb53a41"},"current":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"6675992221c9f97122a1edd5b6d1d8d8abc9fd3423fb8bcf8b90a239d99f048f"}},{"path":"tools/sequence-playback-types.mjs","kind":"strict","predecessor":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"cbb8774959757fb4db286946458f1ddf9ace9dc77d41be2c068ecd8a8036d57b"},"current":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"6bbaed98027e0199cbbe947bea8a461141000c9e0840f1af7673bbe926c77b0b"}},{"path":"tools/check-types.mjs","kind":"root","predecessor":{"path":"tools/check-types.mjs","bytes":141012,"sha256":"b584aa0dc9368285380a3f1569b49430e6fceee3f994a2be4d37acbbc1e9785e"},"current":{"path":"tools/check-types.mjs","bytes":142629,"sha256":"f7b2b034bd836799a3ce7e19860f6af22a3c4087a74ac24f8b79ad068006a1dd"}}];
const m31UiBootstrap = {"before":"m13HelperPin.bytes !== 19535 || m13HelperPin.sha256 !== '7e458ff6c264079df2db6178014b4cea65b2067906484d2bf794c41e0e28c074'","after":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"};
const m31UiReceiptInsertion = "  // M3.1 retains each observed unsuppressed misuse tuple in the existing lane.\n  const uiCases = [{\"name\":\"optional-entry-only\",\"line\":461,\"column\":19,\"code\":2339},{\"name\":\"preparation-type-only\",\"line\":463,\"column\":18,\"code\":2339},{\"name\":\"nonforgeable-preparation\",\"line\":465,\"column\":7,\"code\":2741},{\"name\":\"required-list-source\",\"line\":467,\"column\":7,\"code\":2322},{\"name\":\"unsupported-layout-kind\",\"line\":469,\"column\":51,\"code\":2322},{\"name\":\"asynchronous-measure\",\"line\":471,\"column\":66,\"code\":2322},{\"name\":\"immutable-snapshot\",\"line\":473,\"column\":20,\"code\":2540},{\"name\":\"immutable-rows\",\"line\":475,\"column\":25,\"code\":2339},{\"name\":\"invalid-retention-reason\",\"line\":477,\"column\":42,\"code\":2345},{\"name\":\"unavailable-resource-total\",\"line\":479,\"column\":7,\"code\":2322}];\n  const uiMarkers=raw.split(/\\r?\\n/).flatMap((line,index)=>{const match=line.match(/@ts-expect-error UI_CASE ([\\w-]+)/);return match?[{name:match[1],line:index+2}]:[];});\n  if(JSON.stringify(uiMarkers)!==JSON.stringify(uiCases.map(({name,line})=>({name,line})))||(raw.match(/UI_CASE/g)??[]).length!==10)throw Error('UI exact negative membership changed');\n  const uiReceipts=uiCases.map(expected=>{\n    const found=observedGeometry.filter(actual=>actual.file==='tests/types/invalid.generated.ts'&&actual.line===expected.line);\n    if(found.length!==1||found[0].column!==expected.column||found[0].code!==expected.code)throw Error('UI unsuppressed exact diagnostic changed: '+expected.name);\n    return {name:expected.name,actual:found[0]};\n  });\n  console.log('UI individual unsuppressed diagnostic receipts: '+JSON.stringify(uiReceipts));\n\n";
function m31UiPrevious(raw,selected){
 const value=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 const from=selected.kind==='root'?m31UiReceiptInsertion:m31UiBootstrap.after,to=selected.kind==='root'?'':m31UiBootstrap.before;
 requireThat(value.split(from).length===2,'M3.1 UI exact source insertion differs');
 const previous=Buffer.from(value.replace(from,to));
 requireThat(previous.length===selected.predecessor.bytes&&createHash('sha256').update(previous).digest('hex')===selected.predecessor.sha256,'M3.1 UI complete predecessor differs');
 return previous;
}
const inlineInventories=[
 ['mouseTypeExpectations','mouse-input',['positive','negative','import-negative','dom-free-negative']],
 ['spineTypeExpectations','spine-import-plan',['positive','negative','import-negative']]
];
function inlineMode(options={}){
 requireThat(exact(options,[])||exact(options,['inlinePolicies'])&&typeof options.inlinePolicies==='boolean','Unsupported compiler review options');return options.inlinePolicies===true;
}
export function parseCompilerOptions(args){
 const options={inlinePolicies:false};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--inline-policies'){requireThat(!options.inlinePolicies,'Duplicate inline policy mode');options.inlinePolicies=true;}
  else if(args[i]==='--check'){requireThat(!Object.hasOwn(options,'check')&&typeof args[i+1]==='string','Explicit check artifact required');options.check=args[++i];physicalPathKey(options.check);requireThat(path.extname(options.check)==='.json','Explicit JSON proposal required');}
  else throw Error('Unsupported compiler review option');
 }
 return options;
}
export function prepareCompilerReview(root,options={}){
 const includeInline=inlineMode(options);
 physicalPathKey(root);const selectedRoot=root;root=fs.realpathSync(root);
 const resolution=resolveOwners(root),{owners}=resolution,observed=new Map(),declarations=[],records=new Map();
 function observe(owner,file){const key=owner+':'+file;if(!observed.has(key))observed.set(key,{owner,path:file,identity:optionalPin(owners[owner],file)});return observed.get(key).identity;}
 for(const file of ['tools/prepare-compiler-maintenance.mjs','tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs'])requireThat(observe('repository',file),'Maintenance implementation missing');
 const dependencies=packages.map(([owner,name])=>{
  const files=inventory(owners[owner]),metadata=decode(owners[owner],'package.json',files.find(x=>x.path==='package.json')??null);
  requireThat(metadata.name===name,'Installed package name differs');
  if(owner==='compiler-native')requireThat(!Object.hasOwn(metadata,'exports')||equal(metadata.exports,{'./package.json':'./package.json'}),'Native metadata export mapping is outside this reader');
  return {owner,name,metadata,inventory:files};
 });
 // Membership is review data. Unknown records are listed, never parsed or followed.
 function coverageNow(){
  const discovered=fs.readdirSync(path.join(root,'tests/types')).filter(x=>/diagnostic-expectations\.json$/i.test(x)).map(x=>'tests/types/'+x).sort(sort);
  const registered=registry.map(inventoryPath).sort(sort);
  return {registered,unregistered:discovered.filter(x=>!registered.includes(x))};
 }
 const coverage=coverageNow();
 function add(file,selector,list,locate=expected=>target(expected.path),comparison='bytes-and-sha256'){
  requireThat(Array.isArray(list)&&list.length>0,'Registered input list required: '+selector);const seen=new Set();
  const rows=list.map(expected=>{
   if(comparison==='sha256-only')requireThat(exact(expected,['path','sha256'])&&typeof expected.sha256==='string'&&/^[a-f0-9]{64}$/.test(expected.sha256),'Invalid digest-only identity');else pin(expected);
   logicalPath(expected.path);requireThat(!seen.has(expected.path),'Duplicate declared input path');seen.add(expected.path);
   const location=locate(expected),current=observe(location.owner,location.path);
   const matches=current!==null&&current.sha256===expected.sha256&&(comparison==='sha256-only'||current.bytes===expected.bytes);
   return {...location,expected,current,comparison,identity:current===null?'missing':matches?'same':'different'};
  });
  declarations.push({owner:file,selector,rows});
 }
 function savedNative(value,packageKey){requireThat(value?.platform==='win32'&&value.arch==='x64'&&value[packageKey]===nativeName,'Unsupported saved native owner');}
 function nativeLocation(expected,allowed,prefix=''){
  const file=expected.path;requireThat(file.startsWith(prefix)&&allowed.includes(file.slice(prefix.length)),'Unsupported saved native input');
  return {owner:'compiler-native',path:file.slice(prefix.length)};
 }
 for(const name of registry){
  const file=inventoryPath(name);requireThat(observe('repository',gate(name)),'Registered strict gate missing');
  const value=decode(root,file,observe('repository',file)),kind=name.replaceAll('-','_').toUpperCase();records.set(name,value);
  const list=selector=>{let v=value;for(const key of selector.split('.'))v=v?.[key];return v;};
  const addList=(selector,locate)=>add(file,selector,list(selector),locate);
  const addOne=(selector,locate)=>add(file,selector,[list(selector)],locate);
  const noField=key=>!Object.hasOwn(value,key);
  if(name==='shared-render'){
   requireThat(value.schemaVersion===1&&value.kind==='SHARED_RENDER_ACTUAL_STRICT_DIAGNOSTICS'&&value.status==='OBSERVED_TS7_DIAGNOSTICS'
    &&value.compilerVersion==='7.0.2'&&equal(value.tupleFormat,['file','line','column','code']),'Unsupported shared strict schema');
   requireThat(Array.isArray(value.inputPins)&&equal(value.inputPins.map(row=>row.path),["tests/types/shared-render-positive.ts","tests/types/shared-render-negative.ts","tests/types/tsconfig.shared-render-positive.json","tests/types/tsconfig.shared-render-negative.json","tests/types/tsconfig.dom-free.json","tests/types/tsconfig.json","tsconfig.base.json"]),'Unsupported shared strict inputs');
   addList('inputPins');
  }else if(strictNames.includes(name)){
   requireThat(value.kind===kind+'_ACTUAL_STRICT_DIAGNOSTICS'&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&(['atlas-import','atlas-frame'].includes(name)?noField('schemaVersion'):value.schemaVersion===1),'Unsupported registered diagnostic schema');
   addList('inputPins');
   if(name==='atlas-import')addList('sourcePolicy.jsoncPins',expected=>{const location=target(expected.path);requireThat(location.owner==='project-json','Atlas JSON parser owner required');return location;});
   if(nativeNames.has(name)){
    savedNative(value.originalCompilerObservation,'nativePackage');
    addList('nativeLibraryPins',expected=>{requireThat(/^lib\/lib\.(?:es[0-9a-z.]*|decorators(?:\.legacy)?)\.d\.ts$/.test(expected.path),'Unsupported native library path');return {owner:'compiler-native',path:expected.path};});
    addOne('originalCompilerObservation.nativeMetadataPin',expected=>nativeLocation(expected,['package.json']));
    addOne('originalCompilerObservation.nativeBinaryPin',expected=>nativeLocation(expected,['lib/tsc.exe']));
   }
   // These are additional claims, not replacements or effective gate decisions.
   if(name.startsWith('display-container-'))addList('currentInputIdentitySuccessor.rows');
  }else{
   requireThat(value.schemaVersion===1,'Unsupported legacy schema');
   if(['browser-png','spritesheet','sequence-playback'].includes(name)){
    requireThat(value.kind===kind+'_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS'&&(name==='sequence-playback'?value.status==='SAVED_ACTUAL_DATA_FROZEN_REUSABLE_GATE_NOT_RUN':noField('status')),'Unsupported legacy diagnostic kind/status');
    addList('compiler.pins');addList('configurationPins');
    const group=name==='browser-png'?'lanes':'groups',fields=name==='browser-png'?['sourcePin','configPin']:['fixture','config'];
    requireThat(Array.isArray(value[group])&&value[group].length>0,'Registered groups required');
    for(let i=0;i<value[group].length;i++)for(const field of fields)addOne(group+'.'+i+'.'+field);
    if(name==='browser-png')addList('productPins');
    if(name==='sequence-playback'){
     savedNative(value.compiler.observedNative,'package');
     const pins=value.compiler.observedNative.pins;requireThat(Array.isArray(pins)&&equal(pins.map(x=>x.path).sort(),['lib/tsc.exe','package.json']),'Native metadata and binary pair required');
     addList('compiler.observedNative.pins',expected=>nativeLocation(expected,['package.json','lib/tsc.exe']));
     addList('currentDeclarationSuccessor.sourcePins');addOne('currentDeclarationSuccessor.fixture');addOne('currentDeclarationSuccessor.config');
    }
   }else if(name==='scene3d'){
    requireThat(noField('kind')&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&exact(value.fixtureSHA256,[...sceneFixtures]),'Unsupported scene fixture schema');
    for(const [key,filePath]of [['packageSHA256','node_modules/typescript/package.json'],['tscSHA256','node_modules/typescript/bin/tsc']])add(file,'compiler.'+key,[{path:filePath,sha256:value.compiler?.[key]}],undefined,'sha256-only');
    add(file,'fixtureSHA256',sceneFixtures.map(filePath=>({path:filePath,sha256:value.fixtureSHA256[filePath]})),undefined,'sha256-only');
   }else{
    requireThat(noField('kind')&&noField('status')&&value.scope===(name==='byte-writer'?'BW1':'NS1')+' actual strict consumer diagnostic inventory','Unsupported legacy scope');
    for(const selector of ['positive.fixture','groups.negative.fixture','groups.import-negative.fixture'])addOne(selector);
    if(name==='nine-slice'){
     requireThat(value.compiler?.platform==='win32'&&value.compiler.arch==='x64','Unsupported saved native owner');addList('compiler.wrapperPins');addList('configurationPins');
     for(const [key,leaf]of [['package','package.json'],['executable','lib/tsc.exe']])addOne('compiler.nativePlatform.'+key,expected=>nativeLocation(expected,[leaf],nativeName+'/'));
    }
   }
  }
 }
 let inlinePolicies=null;
 if(includeInline){
  const sources=[],sourceRevisions=[],texts=new Map(),literals=[],conditions=[],observations=[];
  // Authenticate the complete original bytes before examining any initializer.
  for(const expected of inlineSources){
   const current=observe('repository',expected.path),successor=inlineSourceSuccessors.find(row=>row.path===expected.path);
   const sequence=m22SequenceInlineSources.find(row=>row.path===expected.path),sequenceSelected=sequence!==undefined&&equal(current,sequence.current);
   const ui=m31UiInlineSources.find(row=>row.path===expected.path),uiSelected=ui!==undefined&&equal(sequenceSelected?sequence.predecessor:current,ui.current);
   if(successor)requireThat(equal(expected,{path:successor.path,...successor.base}),'Inline successor base differs');
   const newer=successor?{path:successor.path,...successor.current}:null;
   const shared=m13InlineSourceSuccessors.find(row=>row.path===expected.path);
   requireThat(shared&&equal({path:shared.path,...shared.base},newer??expected),'M1.3 inline predecessor differs');
   const latest={path:shared.path,...shared.current};
   const webgl=expected.path===m14InlineSourceSuccessor.path?m14InlineSourceSuccessor:null;
   if(webgl)requireThat(equal(latest,{path:webgl.path,...webgl.predecessor}),'M1.4 inline predecessor differs');
   const glLatest=webgl?{path:webgl.path,...webgl.current}:null,glSelected=glLatest!==null&&equal(current,glLatest);
   const inlineRecovery=expected.path===m15InlineSourceSuccessor.path?m15InlineSourceSuccessor:null;
   if(inlineRecovery)requireThat(glLatest!==null&&equal(glLatest,{path:inlineRecovery.path,...inlineRecovery.predecessor}),'M1.5 inline predecessor differs');
   const delegateLatest=inlineRecovery?{path:inlineRecovery.path,...inlineRecovery.delegate}:null,sceneLatest=inlineRecovery?{path:inlineRecovery.path,...inlineRecovery.scene}:null;
   const delegateSelected=delegateLatest!==null&&equal(current,delegateLatest),sceneSelected=sceneLatest!==null&&(equal(current,sceneLatest)||uiSelected&&ui.kind==='root');
   if(uiSelected&&ui.kind==='root')requireThat(equal(ui.predecessor,sceneLatest),'M3.1 root UI predecessor differs');
   const strict=m14StrictSourceSuccessors.find(row=>row.path===expected.path),strictLatest=strict?{path:strict.path,...strict.current}:null;
   if(strict)requireThat(equal(latest,{path:strict.path,...strict.predecessor}),'M1.4 strict predecessor differs');
   const strictSelected=strictLatest!==null&&equal(current,strictLatest);
   const recovery=m15StrictSourceSuccessors.find(row=>row.path===expected.path),recoveryLatest=recovery?{path:recovery.path,...recovery.current}:null;
   if(recovery)requireThat(strictLatest!==null&&equal(strictLatest,{path:recovery.path,...recovery.predecessor}),'M1.5 strict predecessor differs');
   const recoverySelected=recoveryLatest!==null&&equal(current,recoveryLatest);
   const hotPath=m12HotPathStrictSourceSuccessors.find(row=>row.path===expected.path),hotPathLatest=hotPath?{path:hotPath.path,...hotPath.current}:null;
   if(hotPath)requireThat(recoveryLatest!==null&&equal(recoveryLatest,{path:hotPath.path,...hotPath.predecessor}),'M1.2 hotpath strict predecessor differs');
   const hotPathSelected=hotPathLatest!==null&&equal(current,hotPathLatest);
   const pointer=m33PointerStrictSourceSuccessors.find(row=>row.path===expected.path),pointerLatest=pointer?{path:pointer.path,...pointer.current}:null;
   if(pointer)requireThat(hotPathLatest!==null&&equal(hotPathLatest,{path:pointer.path,...pointer.predecessor}),'M3.3 pointer strict predecessor differs');
   const content=m21ContentStrictSourceSuccessors.find(row=>row.path===expected.path),contentLatest=content?{path:content.path,...content.current}:null;
   if(content)requireThat(pointerLatest!==null&&equal(pointerLatest,{path:content.path,...content.predecessor}),'M2.1 content strict predecessor differs');
   const contentSelected=contentLatest!==null&&(equal(current,contentLatest)||uiSelected&&ui.kind==='strict');
   if(uiSelected&&ui.kind==='strict')requireThat(equal(ui.predecessor,contentLatest),'M3.1 strict UI predecessor differs');
   const pointerSelected=pointerLatest!==null&&(equal(current,pointerLatest)||contentSelected);
   requireThat(equal(current,expected)||newer!==null&&equal(current,newer)||equal(current,latest)||glSelected||delegateSelected||sceneSelected||strictSelected||recoverySelected||hotPathSelected||pointerSelected,'Unreviewed inline policy source: '+expected.path);
   const actualRaw=fs.readFileSync(path.join(root,expected.path));requireThat(actualRaw.length===current.bytes&&createHash('sha256').update(actualRaw).digest('hex')===current.sha256,'Inline source changed while reading');
   const raw=sequenceSelected?m22SequencePrevious(actualRaw,sequence):actualRaw;
   // Verify the whole retained M1.3 program after removing the exact final line.
   // Original values and byte offsets remain authoritative for inline extraction.
   let inlineRaw=uiSelected?m31UiPrevious(raw,ui):raw;
   if(sceneSelected){
    inlineRaw=m15ScenePredecessor(inlineRaw);
    requireThat(inlineRaw.length===inlineRecovery.delegate.bytes&&createHash('sha256').update(inlineRaw).digest('hex')===inlineRecovery.delegate.sha256,'M1.5 scene predecessor bytes differ');
   }
   if(delegateSelected||sceneSelected){
    const suffix=Buffer.from(inlineRecovery.appended),before=inlineRaw.subarray(0,inlineRaw.length-suffix.length);
    requireThat(inlineRaw.subarray(inlineRaw.length-suffix.length).equals(suffix)&&before.length===inlineRecovery.predecessor.bytes
     &&createHash('sha256').update(before).digest('hex')===inlineRecovery.predecessor.sha256,'M1.5 inline append differs');inlineRaw=before;
   }
   if(glSelected||delegateSelected||sceneSelected){
    const suffix=Buffer.from(webgl.appended),before=inlineRaw.subarray(0,inlineRaw.length-suffix.length);
    requireThat(inlineRaw.subarray(inlineRaw.length-suffix.length).equals(suffix)&&before.length===webgl.predecessor.bytes
     &&createHash('sha256').update(before).digest('hex')===webgl.predecessor.sha256,'M1.4 inline append differs');
   }
   let strictRaw=uiSelected?m31UiPrevious(raw,ui):raw;
   if(contentSelected){
    let text=new TextDecoder('utf-8',{fatal:true}).decode(strictRaw);
    requireThat(text.split(m21ContentStrictBootstrap.after).length===2,'M2.1 content strict bootstrap differs');
    text=text.replace(m21ContentStrictBootstrap.after,m21ContentStrictBootstrap.before);
    if(expected.path==='tools/sequence-playback-types.mjs'){
     const after='for (const pin of m13?.compilerPins ?? seqpInventory.compiler.pins) seqpReadPin(pin);',before='for (const pin of seqpInventory.compiler.pins) seqpReadPin(pin);';
     requireThat(text.split(after).length===3,'M2.1 sequence compiler pin selection differs');text=text.replaceAll(after,before);
    }
    strictRaw=Buffer.from(text);
    requireThat(strictRaw.length===content.predecessor.bytes&&createHash('sha256').update(strictRaw).digest('hex')===content.predecessor.sha256,'M2.1 content strict predecessor bytes differ');
   }
   if(pointerSelected){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(strictRaw);
    requireThat(text.split(m33PointerStrictBootstrap.after).length===2,'M3.3 pointer strict bootstrap differs');
    strictRaw=Buffer.from(text.replace(m33PointerStrictBootstrap.after,m33PointerStrictBootstrap.before));
    requireThat(strictRaw.length===pointer.predecessor.bytes&&createHash('sha256').update(strictRaw).digest('hex')===pointer.predecessor.sha256,'M3.3 pointer strict predecessor bytes differ');
   }
   if(hotPathSelected||pointerSelected){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(strictRaw);
    requireThat(text.split(m12HotPathStrictBootstrap.after).length===2,'M1.2 hotpath strict bootstrap differs');
    strictRaw=Buffer.from(text.replace(m12HotPathStrictBootstrap.after,m12HotPathStrictBootstrap.before));
    requireThat(strictRaw.length===hotPath.predecessor.bytes&&createHash('sha256').update(strictRaw).digest('hex')===hotPath.predecessor.sha256,'M1.2 hotpath strict predecessor bytes differ');
   }
   if(recoverySelected||hotPathSelected||pointerSelected){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(strictRaw);
    requireThat(text.split(m15StrictBootstrap.after).length===2,'M1.5 strict bootstrap differs');
    strictRaw=Buffer.from(text.replace(m15StrictBootstrap.after,m15StrictBootstrap.before));
    requireThat(strictRaw.length===recovery.predecessor.bytes&&createHash('sha256').update(strictRaw).digest('hex')===recovery.predecessor.sha256,'M1.5 strict predecessor bytes differ');
   }
   if(strictSelected||recoverySelected||hotPathSelected||pointerSelected){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(strictRaw);
    requireThat(text.split(m14StrictBootstrap.after).length===2,'M1.4 strict bootstrap differs');
    const before=Buffer.from(text.replace(m14StrictBootstrap.after,m14StrictBootstrap.before));
    requireThat(before.length===strict.predecessor.bytes&&createHash('sha256').update(before).digest('hex')===strict.predecessor.sha256,'M1.4 strict predecessor bytes differ');
   }
   texts.set(expected.path,new TextDecoder('utf-8',{fatal:true}).decode(raw));sources.push(current);
   sourceRevisions.push({base:expected,predecessor:newer,successor:latest,...(webgl?{m14Successor:glLatest}:{}),...(inlineRecovery?{m15DelegateSuccessor:delegateLatest,m15SceneSuccessor:sceneLatest}:{}),...(strict?{m14StrictSuccessor:strictLatest}:{}),...(recovery?{m15StrictSuccessor:recoveryLatest}:{}),...(hotPath?{m12HotPathStrictSuccessor:hotPathLatest}:{}),...(pointer?{m33PointerStrictSuccessor:pointerLatest}:{}),...(content?{m21ContentStrictSuccessor:contentLatest}:{}),...(uiSelected?{m31UiSuccessor:ui.current}:{}),...(sequenceSelected?{m22SequenceSuccessor:sequence.current}:{}),current,selection:uiSelected?'m31-ui-current':contentSelected?'m21-content-strict-current':equal(current,expected)?'base':newer!==null&&equal(current,newer)?'predecessor':glSelected?'m14-current':delegateSelected?'m15-delegate-current':sceneSelected?'m15-scene-current':strictSelected?'m14-strict-current':recoverySelected?'m15-strict-current':hotPathSelected?'m12-hotpath-strict-current':pointerSelected?'m33-pointer-strict-current':'current',admission:'not-evaluated'});
  }
  function span(owner,start,end){const text=texts.get(owner),raw=Buffer.from(text.slice(start,end));return {owner,startByte:Buffer.byteLength(text.slice(0,start)),endByte:Buffer.byteLength(text.slice(0,end)),bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};}
  // Only JSON initializers in authenticated revisions are supported. This is
  // not a general JavaScript parser and never evaluates a gate or condition.
  function literal(owner,binding){
   const text=texts.get(owner),matches=[...text.matchAll(new RegExp('^ *const '+binding+' *= *([^\\r\\n]+); *$','gm'))];
   requireThat(matches.length===1,'Missing or ambiguous reviewed literal: '+binding);
   const match=matches[0],start=match.index+match[0].indexOf('=')+1,leading=text.slice(start).match(/^ */)[0].length,a=start+leading,b=a+match[1].length;
   const value=uniqueJSON(match[1]);literals.push({binding,...span(owner,a,b)});return value;
  }
  for(const [binding,family,lanes]of inlineInventories){
   const owner='tools/check-types.mjs',value=literal(owner,binding),fixtures=lanes.map(lane=>'tests/types/'+family+'-'+lane+'.ts');
   requireThat(value.schemaVersion===1&&value.status==='OBSERVED_FROZEN_TS7_DIAGNOSTICS'&&exact(value.fixtureSHA256,[...fixtures]),'Unsupported reviewed inline inventory');
   for(const [key,filePath]of [['packageSHA256','node_modules/typescript/package.json'],['tscSHA256','node_modules/typescript/bin/tsc']])add(owner,binding+'.compiler.'+key,[{path:filePath,sha256:value.compiler?.[key]}],undefined,'sha256-only');
   add(owner,binding+'.fixtureSHA256',fixtures.map(filePath=>({path:filePath,sha256:value.fixtureSHA256[filePath]})),undefined,'sha256-only');
   const actual=dependencies.find(x=>x.owner==='compiler').metadata.version;
   observations.push({owner,binding,savedVersion:value.compiler.version,installedVersion:actual,versionAgreement:actual===value.compiler.version,admission:'not-evaluated'});
  }
  for(const name of nativeNames){
   const owner=gate(name),text=texts.get(owner),saved=records.get(name).originalCompilerObservation;
   const first=['bitmap-resource-slot','bitmap-binding-ticket','linear-layout'].includes(name);
   const prefix=first?'if(observed.platform===process.platform&&observed.arch===process.arch)':name==='bitmap-button'?'if(process.platform===originalCompiler.platform&&process.arch===originalCompiler.arch){':'if (process.platform === observedCompiler.platform && process.arch === observedCompiler.arch) {';
   const at=text.indexOf(prefix);requireThat(at>=0&&text.indexOf(prefix,at+1)<0,'Reviewed native condition missing or ambiguous');
   const end=first?text.indexOf('\n',at):text.indexOf('\n}',at)+2;requireThat(end>at,'Reviewed native branch end missing');
   const readerHost={platform:process.platform,arch:process.arch},savedHost={platform:saved.platform,arch:saved.arch};
   conditions.push({kind:'saved-native-host',gate:owner,inventory:inventoryPath(name),branch:span(owner,at,end),readerHost,savedHost,readerHostEqualsSavedHost:equal(readerHost,savedHost),conditionalSelectors:['originalCompilerObservation.nativeMetadataPin','originalCompilerObservation.nativeBinaryPin'],unconditionalSelector:'nativeLibraryPins',admission:'not-evaluated'});
  }
  for(const name of ['display-container-add-child-at','display-container-child-index','display-container-remove-children']){
   const owner=gate(name),historical=literal(owner,'historicalDeclaration'),current=literal(owner,'currentDeclarationRows'),value=records.get(name);
   add(owner,'historicalDeclaration',[historical]);add(owner,'currentDeclarationRows',current);
   conditions.push({kind:'container-successor',gate:owner,inventory:inventoryPath(name),historyAgreement:equal(historical,value.inputPins.find(x=>x.path===historical.path)),successorAgreement:equal(current,value.currentInputIdentitySuccessor.rows),selectors:['inputPins','currentInputIdentitySuccessor.rows'],admission:'not-evaluated'});
  }
  const sequence=gate('sequence-playback'),expected=literal(sequence,'expectedCurrentSourcePins');add(sequence,'expectedCurrentSourcePins',expected);
  conditions.push({kind:'sequence-negative-successor',gate:sequence,inventory:inventoryPath('sequence-playback'),lane:'negative',sourceAgreement:equal(expected,records.get('sequence-playback').currentDeclarationSuccessor.sourcePins),selector:'currentDeclarationSuccessor.sourcePins',admission:'not-evaluated'});
  if(['predecessor','current','m14-strict-current','m15-strict-current','m12-hotpath-strict-current','m33-pointer-strict-current','m31-ui-current'].includes(sourceRevisions.find(row=>row.current.path===sequence)?.selection)){
   const incremental=literal(sequence,'m12IncrementalSourcePins');add(sequence,'m12IncrementalSourcePins',incremental);
   const current=expected.map(row=>observe('repository',row.path));
   conditions.push({kind:'sequence-source-successor',gate:sequence,baseBinding:'expectedCurrentSourcePins',currentBinding:'m12IncrementalSourcePins',
    pathsAgreement:equal(expected.map(row=>row.path),incremental.map(row=>row.path)),unchangedDeclaration:equal(expected[1],incremental[1]),
    completeBaseMatch:equal(current,expected),completeCurrentMatch:equal(current,incremental),admission:'not-evaluated'});
  }
  inlinePolicies={sources,sourceRevisions,literals,observations,conditions,limits:['Raw data relationships only; original schema, kind, review hash, tuple, closure and execution obligations remain with their gates','Native host equality concerns saved metadata/binary pins only; libraries and current-host owner/version checks remain separate','Fixed Windows x64 bundle observations never select the actual host compiler or decide admission','Any gate-source byte change requires a separately reviewed registry update; no parser fallback or automatic fingerprint refresh']};
 }
 const reverse=new Map();
 for(const group of declarations)for(const row of group.rows){
  const key=row.owner+':'+row.path;if(!reverse.has(key))reverse.set(key,{owner:row.owner,path:row.path,current:row.current,references:[]});
  reverse.get(key).references.push({declaration:group.owner,selector:group.selector,expected:row.expected,comparison:row.comparison,matches:row.identity==='same'});
 }
 const references=[...reverse.values()].sort((a,b)=>sort(a.owner+':'+a.path,b.owner+':'+b.path));
 for(const row of references)row.identity=row.current===null?'missing':row.references.every(x=>x.matches)?'same':'different';
 const inputs=[...observed.values()].sort((a,b)=>sort(a.owner+':'+a.path,b.owner+':'+b.path));
 for(const row of inputs)requireThat(equal(row.identity,optionalPin(owners[row.owner],row.path)),'Compiler input changed during collection');
 for(const dependency of dependencies)requireThat(equal(dependency.inventory,inventory(owners[dependency.owner])),'Dependency inventory changed during collection');
 requireThat(fs.realpathSync(selectedRoot)===root&&equal(resolution,resolveOwners(root)),'Compiler owner resolution changed during collection');
 requireThat(equal(coverage,coverageNow()),'Diagnostic inventory membership changed during collection');
 return {schemaVersion:3,kind:'compiler-maintenance',status:'review-required',acceptance:'none',repository:root,resolution,coverage,dependencies,declarations,references,inputs,inlinePolicies,
  limits:['Explicit selectors in 18 registered diagnostic JSON records; unknown inventory names are coverage gaps','Observed Windows x64 dependency bundle; no host compatibility or compiler execution claim','Eight native library lists and fixed metadata/binary observations are compared under their explicit native owner',
   'Selected successor pins remain separate claims; other successor semantics, diagnostics, private receipts and provenance are byte-bound but not interpreted',
   'Digest-only expectations retain their original comparison strength; complete dependency inventory does not authenticate historical declarations','No baseline update, diagnostic replay, version admission, browser or device acceptance']};
}
export function verifyCompilerProposal(root,proposal,options={}){
 requireThat(proposal?.kind==='compiler-maintenance'&&proposal.schemaVersion===3,'Compiler proposal required');
 requireThat((proposal.inlinePolicies!==null)===inlineMode(options),'Explicit inline policy mode differs');
 requireThat(equal(proposal,prepareCompilerReview(root,options)),'Compiler proposal inputs or content changed');
 return {status:'current-inputs',acceptance:'none; independent review and complete gates remain required'};
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 requireThat(process.execArgv.length===0&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'Fresh Node CLI without preload or custom loader options required');
 const {check,...options}=parseCompilerOptions(process.argv.slice(2));let result;
 if(check===undefined)result=prepareCompilerReview(ROOT,options);
 else {
  const file=check,owner=path.dirname(file),name=path.basename(file);requireThat(fs.lstatSync(file).size<=16_777_216,'JSON artifact exceeds 16 MiB');
  const before=fingerprintFile(owner,name);result=verifyCompilerProposal(ROOT,decode(owner,name,before),options);
  requireThat(equal(before,fingerprintFile(owner,name)),'Proposal changed during recheck');
 }
 console.log(JSON.stringify(result,null,2));
}
