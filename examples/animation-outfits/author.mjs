// SPDX-License-Identifier: Apache-2.0
// Rebuildable original assets, using the existing public manifest contract.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {PNG} from 'pngjs';
import {buildResourceManifest} from '@egret/contracts/resources';
import {canonicalTextBytes,samePhysicalPath} from '../../tools/lib/file-identity.mjs';
import {skeletonSource,atlasText,sequenceInput} from './content.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const provenance={origin:'Original Egret animation outfit reference scene',license:'Apache-2.0',notice:'Programmatic geometry and pixels; no Editor-export or complete Spine qualification.'};
export function buildOriginalContent(){
 const png=(width,height,colors)=>PNG.sync.write({width,height,data:Buffer.from(colors.flat())},{colorType:6,inputColorType:6,bitDepth:8});
 const values=new Map([['e_warm',png(2,2,Array(4).fill([255,128,32,255]))],['e_cool',png(2,2,Array(4).fill([32,160,255,255]))],['e_atlas',Buffer.from(atlasText)],['e_character',Buffer.from(JSON.stringify(skeletonSource()))],['e_sparks',png(2,1,[[255,255,0,255],[0,255,128,255]])],['e_sequence',Buffer.from(JSON.stringify(sequenceInput))]]);
 const row=(id,resourceKind,importer,artifactFormatVersion,mediaType,dependencies,settings={})=>{const b=values.get(id);const file=role=>({id:'f_'+role+'_'+id.slice(2),path:(role==='asset'?'assets/':'sources/')+id.slice(2),role,mediaType,sha256:sha(b),byteLength:b.length});return {id,resourceKind,source:file('source'),artifact:file('asset'),importer:{id:importer,version:'1.0.0'},artifactFormatVersion,targetProfile:'web-shared/1',dependencies,settings,provenance};};
 const result=buildResourceManifest({format:'egret.resource-build/1',projectId:'p_animation_outfits',targetProfile:'web-shared/1',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},entries:[
 row('e_warm','image','egret.png','png/1','image/png',[]),row('e_cool','image','egret.png','png/1','image/png',[]),
 row('e_atlas','spine-atlas','egret.spine-atlas','spine-atlas/4.3-1','text/plain',['e_warm','e_cool'],{coreVersion:'4.3.13',pageNames:['warm.png','cool.png']}),
 row('e_character','spine','egret.spine-json','spine-json/4.3-1','application/json',['e_atlas'],{coreVersion:'4.3.13'}),
 row('e_sparks','image','egret.png','png/1','image/png',[]),row('e_sequence','sequence','egret.sequence','sequence/1','application/json',['e_sparks'])]});
 if(!result.ok)throw Error(JSON.stringify(result.diagnostics));return {manifest:result.value,values};
}
export function author(out){fs.mkdirSync(path.join(out,'assets'),{recursive:true});fs.mkdirSync(path.join(out,'sources'),{recursive:true});const content=buildOriginalContent();for(const e of content.manifest.entries){fs.writeFileSync(path.join(out,e.source.path),content.values.get(e.id));fs.writeFileSync(path.join(out,e.artifact.path),content.values.get(e.id));}fs.writeFileSync(path.join(out,'manifest.json'),canonicalTextBytes(JSON.stringify(content.manifest,null,2)));return content;}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){const out=fileURLToPath(new URL('../../work/animation-outfits/',import.meta.url));author(out);console.log('Original content: '+out);}
