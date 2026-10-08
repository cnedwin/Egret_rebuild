import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const han=/\p{Script=Han}/u;
const identity=s=>/^(?:https?:\/\/|[RDHVS]\d{3}$|(?:outputs|docs|knowledge-base|registry|experiments|evidence|templates|proposals|work|packages|tests|tools|verification)\/)/.test(s)||/\.(?:md|json|mjs|ts|png|gltf|bin|zip)(?:$|#)/.test(s);
const ignored=new Set(['node_modules','dist','.git','pnpm-store']);

/** Compare structured authority, allowing translation only of human prose strings. */
function parity(a,b,location,issues){
 if(typeof a!==typeof b||Array.isArray(a)!==Array.isArray(b)){issues.push(`parity shape: ${location}`);return;}
 if(a===null||b===null||typeof a!=='object'){
  if(typeof a==='string'&&han.test(a)&&!identity(a)){
   if(a===b)issues.push(`parity untranslated prose: ${location}`);
   const numbers=s=>s.match(/\d+(?:\.\d+)*/g)??[];
   if(JSON.stringify(numbers(a))!==JSON.stringify(numbers(b)))issues.push(`parity numerical prose: ${location}`);
  }else if(a!==b)issues.push(`parity value: ${location}`);
  return;
 }
 const keys=Object.keys(a),other=Object.keys(b);
 if(JSON.stringify(keys.sort())!==JSON.stringify(other.sort())){issues.push(`parity keys: ${location}`);return;}
 for(const k of keys)parity(a[k],b[k],`${location}.${k}`,issues);
}

/** Checks current file identities and structure; it cannot certify prose meaning or authorization. */
export async function checkPublication(inputRoot){
 const root=path.resolve(inputRoot),issues=[],files=[];
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  if(ignored.has(e.name)||e.name.endsWith('.tsbuildinfo'))continue;
  const full=path.join(dir,e.name),rel=path.relative(root,full).replaceAll('\\','/');
  if(e.isSymbolicLink()){issues.push(`outside or symbolic file: ${rel}`);continue;}
  if(e.isDirectory())await walk(full);else files.push(rel);
 }}
 await walk(root);
 const inventory=JSON.parse(await readFile(path.join(root,'localization.json'),'utf8'));
 if(inventory.schemaVersion!==1||inventory.semanticReview?.status!=='reviewed_with_scope')issues.push('missing scoped semantic review record');
 const paired=new Set(),seen=new Set();
 async function verifyFile(rel,hash){
  const full=path.resolve(root,rel);
  if(!full.startsWith(root+path.sep)){issues.push(`outside: ${rel}`);return;}
  if(seen.has(rel))issues.push(`duplicate listed file: ${rel}`);seen.add(rel);
  try{const bytes=await readFile(full);if(sha(bytes)!==hash)issues.push(`hash stale: ${rel}`);return bytes.toString('utf8');}
  catch{issues.push(`missing: ${rel}`);}
 }
 for(const item of inventory.documents??[]){
  paired.add(item.zh);paired.add(item.en);
  const pairedBodies=[];
  for(const [rel,hash] of [[item.zh,item.zhSha256],[item.en,item.enSha256]]){
   const body=await verifyFile(rel,hash);if(body===undefined)continue;
   pairedBodies.push(body);
   // Code blocks and identity lists are shared technical data, not prose links.
   const prose=body.replace(/^```[^\n]*\n.*?^```\s*$/gms,'');
   for(const m of prose.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)){
    const target=m[1].replace(/^<|>$/g,'').split('#')[0];if(!target||/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target))continue;
    const dest=path.resolve(path.dirname(path.join(root,rel)),decodeURIComponent(target));
    if(!dest.startsWith(root+path.sep)){issues.push(`outside link: ${rel} -> ${target}`);continue;}
    try{if(!(await stat(dest)).isFile())issues.push(`missing linked file: ${rel} -> ${target}`);}catch{issues.push(`missing link: ${rel} -> ${target}`);}
   }
  }
  // A presence-only check misses a damaged duplicate occurrence in an evidence table.
  if(pairedBodies.length===2&&item.kind!=='informational_legal'){
   const opaque=s=>(s.match(/\b(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{64}|[0-9a-f]{40})\b/gi)??[]).map(x=>x.toLowerCase()).sort();
   if(JSON.stringify(opaque(pairedBodies[0]))!==JSON.stringify(opaque(pairedBodies[1])))issues.push(`opaque identifier occurrence drift: ${item.en}`);
  }
 }
 for(const f of files.filter(x=>x.endsWith('.md')))if(!paired.has(f))issues.push(`unlisted reading document: ${f}`);
 const registryFiles=new Set();
 for(const item of inventory.registries??[]){
  registryFiles.add(item.source);registryFiles.add(item.target);
  const source=await verifyFile(item.source,item.sourceSha256),target=await verifyFile(item.target,item.targetSha256);
  if(source===undefined||target===undefined)continue;
  const a=JSON.parse(source),b=JSON.parse(target),meta=b._localization;delete b._localization;
  if(meta?.canonicalSource!==path.basename(item.source)||meta?.canonicalSha256!==sha(source)||meta?.role!=='read_only_translation'||meta?.language!=='en')issues.push(`parity localization authority: ${item.target}`);
  parity(a,b,item.source,issues);
 }
 for(const f of files.filter(x=>/(^|\/)registry\/[^/]+\.json$/.test(x)))if(!registryFiles.has(f))issues.push(`unlisted registry view: ${f}`);
 for(const item of inventory.criticalComments??[]){
  const body=await verifyFile(item.path,item.sha256);
  // Inspect comment text itself so following English code cannot satisfy the rule.
  const comments=body?.match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g)??[];
  if(body!==undefined&&!comments.some(s=>!han.test(s)&&(s.match(/\b[A-Za-z]{3,}\b/g)??[]).length>=3))issues.push(`missing English comment: ${item.path}`);
 }
 const critical=new Set((inventory.criticalComments??[]).map(x=>x.path));
 for(const f of files.filter(x=>(/^packages\/[^/]+\/src\/.*\.ts$/.test(x)||/^packages\/engine\/web\/.*\.ts$/.test(x))&&!x.endsWith('/index.ts'))){
  if(!critical.has(f))issues.push(`unlisted critical source: ${f}`);
 }
 return {documents:inventory.documents?.length??0,registryViews:inventory.registries?.length??0,criticalSourceFiles:inventory.criticalComments?.length??0,issues};
}
const script=fileURLToPath(import.meta.url);
if(process.argv[1]&&path.resolve(process.argv[1])===script){
 const result=await checkPublication(fileURLToPath(new URL('..',import.meta.url)));
 if(result.issues.length){console.error(JSON.stringify(result,null,2));process.exitCode=1;}
 else console.log(JSON.stringify({...result,scope:'Structural identities/parity/links only; author review supplies translation meaning and public-content authorization.'}));
}
