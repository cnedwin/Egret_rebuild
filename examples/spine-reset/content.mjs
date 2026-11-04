// SPDX-License-Identifier: Apache-2.0
// Independently authored geometric assets; no Editor export or commercial art.
export const atlasText='body.png\nsize: 2,2\nfilter: Nearest,Nearest\nrepeat: none\npma: false\nbody\nbounds: 0,0,2,2\n\nhead.png\nsize: 2,2\nfilter: Nearest,Nearest\nrepeat: none\npma: false\nhead\nbounds: 0,0,2,2\n';
export function skeletonSource(version){return {skeleton:{spine:'4.3.13'},bones:[{name:'root'},{name:'head',parent:'root',y:12}],slots:[{name:'body',bone:'root',attachment:'body'},{name:'head',bone:'head',attachment:'head'}],skins:[{name:'default',attachments:{body:{body:{width:version==='v1'?16:12,height:12}},head:{head:{width:8,height:8}}}},{name:'hat',attachments:{head:{head:{width:10,height:8}}}}],events:{beat:{}},animations:{move:{bones:{root:{translate:[{time:0,x:0},{time:.1,x:6}]}},events:[{time:0,name:'beat'},{time:.05,name:'beat'}]},idle:{}}};}
export const colors={v1:[[255,0,0,255],[0,0,255,255]],v2:[[0,255,0,255],[255,255,0,255]]};
