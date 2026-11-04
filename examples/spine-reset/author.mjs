// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {PNG} from 'pngjs';
import {buildResourceManifest} from '@egret/contracts/resources';
import {canonicalTextBytes,samePhysicalPath} from '../../tools/lib/file-identity.mjs';
import {skeletonSource,atlasText,colors} from './content.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function author(out){
 const provenance={origin:'Original Egret two-version RESET geometry',license:'Apache-2.0',notice:'Programmatic geometry and pixels, not a certified Editor export.'};
 for(const version of ['v1','v2']){
  const png=color=>PNG.sync.write({width:2,height:2,data:Buffer.from(Array(4).fill(color).flat())},{colorType:6,inputColorType:6,bitDepth:8});
  const values=new Map([['e_body',png(colors[version][0])],['e_head',png(colors[version][1])],['e_atlas',Buffer.from(atlasText)],['e_character',Buffer.from(JSON.stringify(skeletonSource(version)))]]);
  const row=(id,resourceKind,importer,artifactFormatVersion,mediaType,dependencies,settings={})=>{const b=values.get(id),file=role=>({id:'f_'+role+'_'+id.slice(2),path:(role==='asset'?'assets/':'sources/')+id.slice(2),role,mediaType,sha256:sha(b),byteLength:b.length});return {id,resourceKind,source:file('source'),artifact:file('asset'),importer:{id:importer,version:'1.0.0'},artifactFormatVersion,targetProfile:'web-shared/1',dependencies,settings,provenance};};
  const result=buildResourceManifest({format:'egret.resource-build/1',projectId:'p_spine_reset',targetProfile:'web-shared/1',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},entries:[
   row('e_body','image','egret.png','png/1','image/png',[]),row('e_head','image','egret.png','png/1','image/png',[]),
   row('e_atlas','spine-atlas','egret.spine-atlas','spine-atlas/4.3-1','text/plain',['e_body','e_head'],{coreVersion:'4.3.13',pageNames:['body.png','head.png']}),
   row('e_character','spine','egret.spine-json','spine-json/4.3-1','application/json',['e_atlas'],{coreVersion:'4.3.13'})]});
  if(!result.ok)throw Error(JSON.stringify(result.diagnostics));const dir=path.join(out,version);fs.mkdirSync(path.join(dir,'assets'),{recursive:true});fs.mkdirSync(path.join(dir,'sources'),{recursive:true});
  for(const e of result.value.entries){fs.writeFileSync(path.join(dir,e.source.path),values.get(e.id));fs.writeFileSync(path.join(dir,e.artifact.path),values.get(e.id));}
  fs.writeFileSync(path.join(dir,'manifest.json'),canonicalTextBytes(JSON.stringify(result.value,null,2)));
 }
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){author(fileURLToPath(new URL('../../work/spine-reset/',import.meta.url)));console.log('Authored original two-version Spine RESET assets');}
