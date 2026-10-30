// SPDX-License-Identifier: Apache-2.0
// Original programmatic data, not Editor exports or an independent animation corpus.
import {createHash} from 'node:crypto';import {PNG} from 'pngjs';
import {buildResourceManifest} from '@egret/contracts/resources';
import {createImageData2D,createTexture,createTextureView} from '@egret/engine';
export const provenance={origin:'Egret original numerical Spine content fixture',license:'Apache-2.0',notice:'Programmatically authored source/pixels; no Editor-export certification or commercial art.'};
export function source(version='4.3.13'){return {skeleton:{spine:version},bones:[{name:'root'},{name:'child',parent:'root',x:1}],slots:[{name:'first',bone:'root',attachment:'red'},{name:'second',bone:'child',attachment:'blue'}],skins:[{name:'default',attachments:{first:{red:{width:2,height:2}},second:{blue:{width:2,height:2}}}}],animations:{idle:{}}};}
export const atlas='a.png\nsize: 2,2\nfilter: Nearest,Nearest\nrepeat: none\npma: false\nred\nbounds: 0,0,2,2\n\nb.png\nsize: 2,2\nfilter: Nearest,Nearest\nrepeat: none\npma: false\nblue\nbounds: 0,0,2,2\nrotate: 90\n';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function fixture({version='4.3.13',atlasText=atlas,includeBinary=false,mutate=()=>{}}={}){
 const png=color=>PNG.sync.write({width:2,height:2,data:Buffer.from(Array.from({length:4},()=>color).flat())},{colorType:6,inputColorType:6,bitDepth:8});
 const values=new Map([['e_a',png([255,0,0,255])],['e_b',png([0,0,255,255])],['e_atlas',Buffer.from(atlasText)],['e_json',Buffer.from(JSON.stringify(source(version)))],['e_binary',Buffer.from([0])]]);
 const row=(id,kind,importer,format,mediaType,dependencies,settings)=>{const bytes=values.get(id),file=(asset)=>({id:(asset?'f_a_':'f_s_')+id.slice(2),path:(asset?'assets/':'sources/')+id.slice(2),role:asset?'asset':'source',mediaType,sha256:sha(bytes),byteLength:bytes.length});return {id,resourceKind:kind,source:file(false),artifact:file(true),importer:{id:importer,version:'1.0.0'},settings,artifactFormatVersion:format,targetProfile:'web-shared/1',dependencies,provenance};};
 const entries=[row('e_a','image','egret.png','png/1','image/png',[],{}),row('e_b','image','egret.png','png/1','image/png',[],{}),row('e_atlas','spine-atlas','egret.spine-atlas','spine-atlas/4.3-1','text/plain',['e_a','e_b'],{coreVersion:'4.3.13',pageNames:['a.png','b.png']}),row('e_json','spine','egret.spine-json','spine-json/4.3-1','application/json',['e_atlas'],{coreVersion:'4.3.13'}),row('e_binary','spine','egret.spine-binary','spine-binary/4.3-1','application/octet-stream',['e_atlas'],{coreVersion:'4.3.13'})].filter(e=>e.id!=='e_binary'||includeBinary);mutate(entries);
 const result=buildResourceManifest({format:'egret.resource-build/1',projectId:'p_spine',targetProfile:'web-shared/1',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},entries});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));
 return {manifest:result.value,values};
}
export function ports(fixture,control={}){
 const loads=[],textures=[],retired=[],gates=[];
 const factory=bindings=>{const idFor=new Map(bindings.map(b=>[b.binding.ref.id,b.id]));
 async function load(ref,context){const id=idFor.get(ref.id);loads.push(id);if(control.fail===id)throw Error('Assigned source failure');let value;if(id==='e_a'||id==='e_b'){const png=PNG.sync.read(fixture.values.get(id));const image=createImageData2D({width:png.width,height:png.height,pixels:new Uint8Array(png.data)});if(control.page==='crop')value=createTexture(createImageData2D({width:4,height:4,pixels:new Uint8Array(64)}),{x:0,y:0,width:2,height:2});else if(control.page==='view')value=createTextureView(image,{packed:{x:0,y:0,width:2,height:2},logicalWidth:2,logicalHeight:2,trimX:0,trimY:0,quarterTurn:0});else value=createTexture(image);if(control.page==='disposed')value.dispose();textures.push(value);}else value=control.replace?.[id]??(id==='e_binary'?new Uint8Array(fixture.values.get(id)):fixture.values.get(id).toString('utf8'));
 if(control.hold===id){let resolve;const promise=new Promise(yes=>resolve=yes);gates.push({id,resolve:()=>resolve(value),value,signal:context.signal});return promise;}return value;}
 return {textures:{load,dispose(value){retired.push(value);value.dispose();}},metadata:{load,dispose(){control.retireMetadata?.();}}};};
 return {factory,loads,textures,retired,gates,resolve(){for(const gate of gates)gate.resolve();}};
}
export function codes(error){const found=[],seen=new Set();function visit(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(typeof v.code==='string')found.push(v.code);visit(v.cause);}visit(error);return found;}
