// SPDX-License-Identifier: Apache-2.0
// Original numerical regions/mesh/clip, not licensed Editor-export qualification.
import {playbackSource} from './playbackFixture.mjs';
export function renderingSource({blend='normal',mesh=false,weighted=false,clip=false,tint=false}={}){
 const s=playbackSource();s.bones[1].x=4;s.slots[1].blend=blend;
 for(const skin of s.skins){skin.attachments.first.red.width=8;skin.attachments.first.red.height=8;skin.attachments.second.blue.width=8;skin.attachments.second.blue.height=8;}
 if(tint){s.slots[1].color='80ff8080';s.slots[1].dark='804020';}
 if(mesh){s.skins[0].attachments.second.blue={type:'mesh',path:'blue',uvs:[0,0,0,1,1,1,1,0],triangles:[0,1,2,2,3,0],vertices:weighted?[1,1,-4,4,1,1,1,-4,-4,1,1,1,4,-4,1,1,1,4,4,1]:[-4,4,-4,-4,4,-4,4,4],hull:4,width:8,height:8};}
 if(clip){s.slots.unshift({name:'clip',bone:'root',attachment:'cut'});s.skins[0].attachments.clip={cut:{type:'clipping',end:'second',vertexCount:4,vertices:[0,4,0,-4,4,-4,4,4]}};}
 s.animations.swap={drawOrder:[{time:0,offsets:[{slot:'first',offset:1}]}]};
 s.animations.hide={slots:{first:{attachment:[{time:0,name:null}]},second:{attachment:[{time:0,name:null}]}}};
 return s;
}
