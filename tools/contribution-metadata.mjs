// SPDX-License-Identifier: Apache-2.0
// Generate current ledger fields from an explicit Git base; historical objects
// and raw evidence are never regenerated or treated as behavioral acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {logicalPath,fingerprintFile,canonicalTextBytes,samePhysicalPath} from './lib/file-identity.mjs';
const LEDGERS=['localization.json','knowledge-base/documentation-layout.json','source-origin.json'];
// One reviewed new legal original; historical legal files still cannot be refreshed.
const PNGJS_LICENSE={path:'third-party/pngjs-7.0.0.LICENSE',bytes:1150,sha256:'be75ef59c5cf59715588a17a82dff7dd3e83c4dba3c458676bb9311e05fbedc5'};
// Exact new paragraph-distribution legal originals reviewed with this package.
const PARAGRAPH_LEGAL=new Map([
  [
    "examples/paragraph-panel/vendor/licenses/brotli-LICENSE.txt",
    {
      "bytes": 1084,
      "sha256": "3d180008e36922a4e8daec11c34c7af264fed5962d07924aea928c38e8663c94"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/chromium-BSD-3-Clause.txt",
    {
      "bytes": 1536,
      "sha256": "368cca1106be99d39ecd32a38d8305585d802a475effb66380b91ffc9bcf709b"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/compiler-rt-LICENSE.TXT",
    {
      "bytes": 16708,
      "sha256": "1a8f1058753f1ba890de984e48f0242a3a5c29a6a8f2ed9fd813f36985387e8d"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/dlmalloc-original.c.txt",
    {
      "bytes": 236568,
      "sha256": "c008dc3c2b005ba822efb1bf6187a9d7a6aecd096826c6f28c6f5ee62885053d"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/emscripten-AUTHORS.txt",
    {
      "bytes": 28933,
      "sha256": "56f7df65203d4858dac19cafe3a84a8c49abaff56b67d32d2d463d5fef6e440b"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/emscripten-LICENSE.txt",
    {
      "bytes": 5093,
      "sha256": "620a78084fc7ca97c0b5dea9abf891f3ffcadfdbf305276f099c9c4e12fc1d86"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/fonts/noto-arabic/OFL-archive.txt",
    {
      "bytes": 4382,
      "sha256": "a7a5a25eb188bf1cd96982030d53e23c33485c69b1044a562254226857ee13af"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/fonts/noto-arabic/OFL-upstream.txt",
    {
      "bytes": 4382,
      "sha256": "a7a5a25eb188bf1cd96982030d53e23c33485c69b1044a562254226857ee13af"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/fonts/noto-cjk/LICENSE",
    {
      "bytes": 4301,
      "sha256": "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/fonts/noto-sans/LICENSE",
    {
      "bytes": 4377,
      "sha256": "0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/freetype-bdf-README.txt",
    {
      "bytes": 5972,
      "sha256": "7984455e7e5a9faba3797c8bf095fbe10cc846316b7320aff8c58402e22b82fe"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/freetype-fthash.c.txt",
    {
      "bytes": 8406,
      "sha256": "693e5a54b3ce30140975a94a3369dbe706eb1f280c69e80da426d39cc45b94ef"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/freetype-fthash.h.txt",
    {
      "bytes": 4055,
      "sha256": "023d88d49d29ecf3833db7717a3f7ae223c17ec2012bdb5bf33bb67abaf616c4"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/freetype-FTL.TXT",
    {
      "bytes": 6743,
      "sha256": "5a5ee54c5001bbad1cdc1a57cc3dd4c42199b2da09d39c7ee41fab002d02967f"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/freetype-LICENSE.TXT",
    {
      "bytes": 2149,
      "sha256": "bd36c8b474855fa294c2ec5c184544478ef3720aad37d65a6296a4f264fd2d3b"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/freetype-pcf-README.txt",
    {
      "bytes": 3311,
      "sha256": "18d9782898d9eac04476e2f744678137b2a889689ed3e923e052fc396a86f86b"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/harfbuzz-COPYING.txt",
    {
      "bytes": 1971,
      "sha256": "ba8f810f2455c2f08e2d56bb49b72f37fcf68f1f4fade38977cfd7372050ad64"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/harfbuzz-ms-use-COPYING.txt",
    {
      "bytes": 1141,
      "sha256": "c2cfccb812fe482101a8f04597dfc5a9991a6b2748266c47ac91b6a5aae15383"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/icu-license.html",
    {
      "bytes": 622,
      "sha256": "c62d7697c03979f5056d28b338fafc7a1152820f7b379adf4a9d88cd37160f96"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/icu-LICENSE.txt",
    {
      "bytes": 27718,
      "sha256": "e55522d81edc687a341a4411e0776e54ca654e90147f354a90458aaced4116af"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libcxx-LICENSE.TXT",
    {
      "bytes": 16703,
      "sha256": "539dd7aed86e8a4f12cbdd0e6c50c189c7d74847e4fecc64ce2c6ee3a01da38b"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libcxxabi-LICENSE.TXT",
    {
      "bytes": 16706,
      "sha256": "e2b35be49f7284a45b7baca8fc7b3ab7440e7902392b2528a457816b5bb2a15c"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libjpeg-turbo-LICENSE.md",
    {
      "bytes": 5620,
      "sha256": "96f5b328adbb78eeaaec6980d73fd558cb1e4d62560ed615646bc3cf5e532430"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libjpeg-turbo-README.ijg",
    {
      "bytes": 12799,
      "sha256": "75815e3bf6484201a3c3d17a1bbf10f2e8e3237f84df10a2357ea896db2a81d6"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libpng-LICENSE.txt",
    {
      "bytes": 5345,
      "sha256": "bdb0a645ea18c60507d0368379b1ac5474b92255fcc2d115e07486a7672ba526"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libunwind-LICENSE.TXT",
    {
      "bytes": 16706,
      "sha256": "b5efebcaca80879234098e52d1725e6d9eb8fb96a19fce625d39184b705f7b6d"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libwebp-COPYING.txt",
    {
      "bytes": 1496,
      "sha256": "5aec868f669e384a22372a4e8a1a6cd7d44c64cd451f960ca69cc170d1e13acf"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/libwebp-PATENTS.txt",
    {
      "bytes": 1436,
      "sha256": "cc3273e0694ea5896145e0677699b53471b03ea43021ddc50e7923fbb9f5023c"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/musl-COPYRIGHT.txt",
    {
      "bytes": 6204,
      "sha256": "f9bc4423732350eb0b3f7ed7e91d530298476f8fec0c6c427a1c04ade22655af"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/sheen-Apache-2.0.txt",
    {
      "bytes": 11358,
      "sha256": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/skcms-BSD-3-Clause.txt",
    {
      "bytes": 1635,
      "sha256": "e59bb5c5c6ba426a9ac4ba9fe667ad14c5166b12aa25be8af1d122b14fbe2e36"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/skia-BSD-3-Clause.txt",
    {
      "bytes": 1507,
      "sha256": "5f787c1dee3c56547f09ccc2906ab5f5293c4d8dd6c8654e573216c38e908dbd"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/UNICODE-LICENSE-V3.txt",
    {
      "bytes": 1995,
      "sha256": "e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/wuffs-LICENSE.txt",
    {
      "bytes": 11358,
      "sha256": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
    }
  ],
  [
    "examples/paragraph-panel/vendor/licenses/zlib-LICENSE.txt",
    {
      "bytes": 910,
      "sha256": "e1cfcc55c325b3f78cf55df9664abaa066e2271dffe8213347d9fccdfbac8f2c"
    }
  ]
]);
// Declarations cannot publish private/generated trees; legal originals use a separate review.
const excludedParts=new Set(['.superpowers','.agents','.codex','.git','work','node_modules','dist','build','pnpm-store','.pnpm-store','private','raw-logs','traces','screenshots','counterexample-trees']);
const excluded=p=>p.split('/').some(x=>excludedParts.has(x.toLowerCase())||/^\.env(?:\.|$)/i.test(x))||p.toLowerCase().endsWith('.tsbuildinfo');
const hash=b=>createHash('sha256').update(b).digest('hex');
const encode=v=>canonicalTextBytes(JSON.stringify(v,null,2)).toString('utf8');
const preserved=p=>/^(?:knowledge-base\/(?:evidence|experiments)\/|third-party\/|tests\/types\/.*(?:expectation|inventory))/.test(p)||/(?:^|\/)(?:LICENSE|NOTICE|COPYING)(?:[.-]|$)/i.test(p);
/** Resolve Git against the explicit cwd, never an inherited hook's owner/index. */
export function isolatedGitEnvironment(input=process.env){
 const env={...input};
 const local=new Set(['GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CONFIG','GIT_CONFIG_PARAMETERS','GIT_CONFIG_COUNT','GIT_OBJECT_DIRECTORY','GIT_DIR','GIT_WORK_TREE','GIT_IMPLICIT_WORK_TREE','GIT_GRAFT_FILE','GIT_INDEX_FILE','GIT_NO_REPLACE_OBJECTS','GIT_REPLACE_REF_BASE','GIT_PREFIX','GIT_SHALLOW_FILE','GIT_COMMON_DIR','GIT_NAMESPACE']);
 for(const key of Object.keys(env))if(local.has(key.toUpperCase())||/^GIT_CONFIG_(?:KEY|VALUE)_/i.test(key))delete env[key];
 return {...env,GIT_OPTIONAL_LOCKS:'0'};
}
function git(root,args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,env:isolatedGitEnvironment()});if(r.error||r.status!==0)throw Error('Git metadata input failed: '+(r.stderr??r.error));return r.stdout;}
function shape(name,value){
 const copy=structuredClone(value);
 if(name==='source-origin.json')for(const row of copy.files){delete row.bytes;delete row.sha256;}
 else if(name==='localization.json'){
  for(const row of copy.documents){delete row.enSha256;delete row.zhSha256;}
  for(const row of copy.criticalComments??[])delete row.sha256;
  for(const row of copy.registries??[]){delete row.sourceSha256;delete row.targetSha256;}
 }else for(const row of copy.documents){delete row.currentEnSha256;delete row.currentZhSha256;}
 return JSON.stringify(copy);
}
/** A plan is read-only and includes exact inputs for a later guarded write. */
export function planMetadata(root,{base}={}){
 root=path.resolve(root);
 base=base??git(root,['merge-base','HEAD','origin/main']).trim();
 if(!/^[A-Za-z0-9_./-]+$/.test(base)||base.startsWith('-'))throw Error('Invalid Git base');
 const commit=git(root,['rev-parse','--verify',base+'^{commit}']).trim();
 const baseline=Object.fromEntries(LEDGERS.map(f=>[f,JSON.parse(git(root,['show',commit+':'+f]))]));
 const current=Object.fromEntries(LEDGERS.map(f=>{fingerprintFile(root,f);return [f,JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))];}));
 const expected=structuredClone(baseline),inputs=new Map();
 const observe=f=>{const pin=fingerprintFile(root,logicalPath(f));inputs.set(f,pin);return pin;};
 for(const f of LEDGERS)observe(f);
 const changed=[...new Set((git(root,['diff','--name-only','--no-renames','-z',commit,'--'])+git(root,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean))].sort();
 const origin=expected['source-origin.json'],loc=expected['localization.json'],layout=expected['knowledge-base/documentation-layout.json'];
 const registered=new Map(origin.files.map(row=>[row.path,row]));
 if(registered.size!==origin.files.length)throw Error('Duplicate source declaration');
 const declarationPaths=git(root,['ls-files','--cached','--others','--exclude-standard','-z','--','contributions']).split('\0').filter(Boolean).sort();
 const declared=new Set(),frozen=new Set();
 const originalRows=new Map(baseline['source-origin.json'].files.map(row=>[row.path,row]));
 let originalCompilerPaths;
 for(const f of declarationPaths){
  if(!/^contributions\/[a-z0-9-]+\.json$/.test(f))throw Error('Invalid contribution declaration path');
  observe(f);const d=JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  if(d.schemaVersion!==1||!Array.isArray(d.files)||!Array.isArray(d.documents)||(d.frozenInputs!==undefined&&!Array.isArray(d.frozenInputs))||Object.keys(d).some(k=>!['schemaVersion','files','documents','frozenInputs'].includes(k)))throw Error('Invalid contribution declaration');
  for(const row of d.files){
   logicalPath(row.path);
   if(excluded(row.path))throw Error('An excluded input cannot be declared: '+row.path);
   if(preserved(row.path)||LEDGERS.includes(row.path)||row.path.startsWith('contributions/')||declared.has(row.path))throw Error('Duplicate or preserved declaration: '+row.path);
   if(typeof row.originRole!=='string'||row.originRole.length<12||Object.keys(row).some(k=>!['path','originRole','criticalComment'].includes(k))||row.criticalComment!==undefined&&typeof row.criticalComment!=='boolean')throw Error('Invalid source declaration');
   declared.add(row.path);observe(row.path);
   if(!registered.has(row.path)){const entry={path:row.path,originRole:row.originRole};origin.files.push(entry);registered.set(row.path,entry);}
   else if(registered.get(row.path).originRole!==row.originRole)throw Error('Existing source declaration differs: '+row.path);
   if(row.criticalComment&&!loc.criticalComments.some(x=>x.path===row.path))loc.criticalComments.push({path:row.path});
  }
  // New compiler observations have an explicit first-registration path. Their
  // reviewed raw tuple is immutable thereafter; old files cannot be relabelled.
  for(const row of d.frozenInputs??[]){
   if(!row||typeof row.path!=='string'||!( /^tests\/types\/[a-z0-9-]+-diagnostic-expectations\.json$/.test(row.path)||row.path===PNGJS_LICENSE.path||PARAGRAPH_LEGAL.has(row.path)))throw Error('Invalid frozen compiler or reviewed license path');
   if(row.path===PNGJS_LICENSE.path&&(row.bytes!==PNGJS_LICENSE.bytes||row.sha256!==PNGJS_LICENSE.sha256))throw Error('Reviewed license identity differs');
   const legal=PARAGRAPH_LEGAL.get(row.path);
   if(legal&&(row.bytes!==legal.bytes||row.sha256!==legal.sha256))throw Error('Reviewed paragraph legal identity differs');
   logicalPath(row.path);
   if(declared.has(row.path))throw Error('Duplicate frozen compiler declaration: '+row.path);
   if(Object.keys(row).sort().join(',')!=='bytes,originRole,path,sha256'||!Number.isSafeInteger(row.bytes)||row.bytes<0||!/^[a-f0-9]{64}$/.test(row.sha256)||typeof row.originRole!=='string'||row.originRole.length<12)throw Error('Invalid frozen compiler declaration');
   const actual=observe(row.path);
   if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)throw Error('Frozen compiler identity differs: '+row.path);
   const previous=originalRows.get(row.path);
   if(previous){
    if(previous.bytes!==row.bytes||previous.sha256!==row.sha256||previous.originRole!==row.originRole)throw Error('Frozen compiler baseline differs: '+row.path);
   }else{
    originalCompilerPaths??=new Set(git(root,['ls-tree','-r','--name-only','-z',commit,'--','tests/types','third-party','examples/paragraph-panel/vendor/licenses']).split('\0').filter(Boolean));
    if(originalCompilerPaths.has(row.path))throw Error('Frozen compiler input already exists at base: '+row.path);
    const entry={...row};origin.files.push(entry);registered.set(row.path,entry);
   }
   declared.add(row.path);frozen.add(row.path);
  }
  for(const pair of d.documents){
   if(Object.keys(pair).sort().join(',')!=='en,zh'||!declared.has(pair.en)||!declared.has(pair.zh))throw Error('Document pair requires declared sources');
   if(!loc.documents.some(x=>x.en===pair.en&&x.zh===pair.zh))loc.documents.push({...pair,kind:'public_reading'});
  }
  if(!registered.has(f)){const entry={path:f,originRole:'First-party contribution declarations; source and authorship statements are reviewed separately.'};origin.files.push(entry);registered.set(f,entry);}
 }
 const refresh=new Set([...changed,...declared,...declarationPaths]);
 for(const f of refresh){
  if(LEDGERS.includes(f))continue;
  if(preserved(f)&&!frozen.has(f))throw Error('Changed preserved input requires a separate reviewed process: '+f);
  if(!registered.has(f))throw Error('Missing source declaration: '+f);
  Object.assign(registered.get(f),observe(f));
 }
 for(const row of loc.documents)for(const [fileKey,hashKey] of [['en','enSha256'],['zh','zhSha256']])if(refresh.has(row[fileKey])||!row[hashKey])row[hashKey]=observe(row[fileKey]).sha256;
 for(const row of loc.criticalComments??[])if(refresh.has(row.path)||!row.sha256)row.sha256=observe(row.path).sha256;
 // Registry translation authority and frozen compiler inventories need their own
 // reviewed transformation. This command does not manufacture translations.
 for(const row of loc.registries??[])for(const [fileKey,hashKey] of [['source','sourceSha256'],['target','targetSha256']])if(refresh.has(row[fileKey]))row[hashKey]=observe(row[fileKey]).sha256;
 for(const row of layout.documents)for(const [fileKey,hashKey] of [['newEn','currentEnSha256'],['newZh','currentZhSha256']])if(refresh.has(row[fileKey]))row[hashKey]=observe(row[fileKey]).sha256;
 const outputs={};
 for(const f of LEDGERS){
  if(shape(f,current[f])!==shape(f,baseline[f])&&shape(f,current[f])!==shape(f,expected[f]))throw Error('Unapproved metadata structure change: '+f);
  outputs[f]=encode(expected[f]);
  if(f!=='source-origin.json'){
   const row=registered.get(f);if(!row)throw Error('Missing ledger source declaration');
   const bytes=Buffer.from(outputs[f]);Object.assign(row,{bytes:bytes.length,sha256:hash(bytes)});
  }
 }
 return {base:commit,changed,outputs,inputs:[...inputs.values()],risk:changed.every(f=>/\.md$/.test(f)||LEDGERS.includes(f))?'documentation':'code-or-tooling',scope:'Current metadata generation only; complete checks and human source/translation review remain required.'};
}
export function checkIntegrated(root,plan){
 for(const [f,text] of Object.entries(plan.outputs))if(!fs.readFileSync(path.join(root,f)).equals(Buffer.from(text)))throw Error('Current metadata not integrated: '+f);
}
export function writeMetadata(root,plan){
 // Validate every captured input before writing any ledger; never normalize
 // bytes when comparing identities. The output vocabulary is fixed here.
 if(Object.keys(plan.outputs).join('|')!==LEDGERS.join('|'))throw Error('Unexpected ledger output');
 for(const pin of plan.inputs)if(JSON.stringify(fingerprintFile(root,pin.path))!==JSON.stringify(pin))throw Error('Input changed after metadata planning: '+pin.path);
 for(const f of LEDGERS)fs.writeFileSync(path.join(root,f),canonicalTextBytes(plan.outputs[f]));
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2);let base,mode='plan';
 for(let i=0;i<args.length;i++){
  if(args[i]==='--base'&&base===undefined&&args[i+1])base=args[++i];
  else if(['--write','--check'].includes(args[i])&&mode==='plan')mode=args[i].slice(2);
  else throw Error('Usage: node tools/contribution-metadata.mjs [--base ref] [--write|--check]');
 }
 const root=fileURLToPath(new URL('..',import.meta.url)),plan=planMetadata(root,{base});
 if(mode==='write')writeMetadata(root,plan);if(mode==='check')checkIntegrated(root,plan);
 console.log(JSON.stringify({base:plan.base,changed:plan.changed,risk:plan.risk,mode,scope:plan.scope}));
}
