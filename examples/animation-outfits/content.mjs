// SPDX-License-Identifier: Apache-2.0
// Original geometric source, not an Editor export or commercial artwork.
export const counts=Object.freeze({spine:20,sequences:200});
export const sequenceInput=Object.freeze({atlasWidth:2,atlasHeight:1,frames:[{x:0,y:0,width:1,height:1,durationSeconds:.5},{x:1,y:0,width:1,height:1,durationSeconds:.5}]});
export const atlasText='warm.png\nsize: 2,2\nfilter: Nearest,Nearest\nrepeat: none\npma: false\nwarm\nbounds: 0,0,2,2\n\ncool.png\nsize: 2,2\nfilter: Nearest,Nearest\nrepeat: none\npma: false\ncool\nbounds: 0,0,2,2\n';
export function skeletonSource(){return {
 skeleton:{spine:'4.3.13'},bones:[{name:'root'},{name:'head',parent:'root',y:13}],
 slots:[{name:'body',bone:'root',attachment:'body'},{name:'head',bone:'head',attachment:'head'}],
 skins:[{name:'default',attachments:{body:{body:{path:'warm',width:20,height:20}},head:{head:{path:'cool',width:12,height:10}}}},
 {name:'cool-coat',attachments:{body:{body:{path:'cool',width:20,height:20}}}},
 {name:'warm-hat',attachments:{head:{head:{path:'warm',width:12,height:10}}}}],
 events:{beat:{}},animations:{sway:{bones:{root:{translate:[{time:0,x:0},{time:.5,x:6},{time:1,x:0}]}},events:[{time:.5,name:'beat'}]},rise:{bones:{head:{translate:[{time:0,y:0},{time:.5,y:4},{time:1,y:0}]}}}}
};}
