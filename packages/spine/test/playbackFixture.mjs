// SPDX-License-Identifier: Apache-2.0
// Original numerical animation fixture; not an Editor export or commercial artwork.
import { source } from './fixtures.mjs';
export function playbackSource() {
 const data=source();
 data.events={step:{int:7,float:1.5,string:'original'},step2:{}};
 data.animations={move:{bones:{root:{translate:[{time:0,x:0},{time:.12,x:12}]}},events:[{time:.02,name:'step'},{time:.04,name:'step2'}]},hold:{bones:{root:{translate:[{time:0,x:30},{time:.12,x:30}]}}},rise:{bones:{child:{translate:[{time:0,y:0},{time:.12,y:4}]}}},idle:{}};
 data.skins.push({name:'alternate',attachments:{first:{red:{path:'blue',width:2,height:2}},second:{blue:{path:'red',width:2,height:2}}}});
 return data;
}
