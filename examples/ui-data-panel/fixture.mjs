// SPDX-License-Identifier: Apache-2.0
// Literal expectations frozen before browser launch. No product planner imported.
export const CLEAR=[23,32,51,255],GREEN=[40,100,80,255],BLUE=[52,92,156,255],BROWN=[160,80,48,255],PURPLE=[112,80,160,255],MAGENTA=[160,48,144,255];
// Independent B geometry: (700,12), 200x148 column; 20-high toolbar then 128-high list.
export const toolbarPixels=[[720,20,[68,96,128,255]],[795,20,[68,96,128,255]],[796,20,[128,80,48,255]],[899,31,[128,80,48,255]],[700,11,CLEAR],[900,20,CLEAR]];
export const toolbarHits=[[720,20,null],[796,20,null]];
const outside=[...toolbarPixels,[0,0,CLEAR],[699,40,CLEAR],[900,40,CLEAR],[800,40,PURPLE],[800,151,PURPLE],[800,152,CLEAR]];
export const cases=Object.freeze({
 initial:{origin:[24,32],viewport:[420,360],scroll:0,density:1,anchor:['row-00',0],pixels:[...outside,[200,40,GREEN],[200,56,BLUE],[200,96,BROWN],[23,40,CLEAR],[24,40,GREEN],[443,40,GREEN],[444,40,CLEAR],[200,391,BROWN],[200,392,CLEAR],[34,38,[255,0,0,255]],[42,38,[0,255,0,255]]],hits:[[200,40,'row-00'],[200,56,'row-01'],[200,96,'row-02'],[444,40,null],[710,40,'side-00'],...toolbarHits]},
 scroll:{origin:[24,32],viewport:[420,360],scroll:92,density:1,anchor:['row-02',28],pixels:[...outside,[200,32,BROWN],[200,67,BROWN],[200,68,GREEN],[200,92,BLUE],[200,391,BROWN],[200,392,CLEAR]],hits:[[200,40,'row-02'],[200,68,'row-03'],[200,92,'row-04'],[200,392,null]]},
 resize:{origin:[24,32],viewport:[600,480],scroll:92,density:2,anchor:['row-02',28],pixels:[...outside,[200,40,BROWN],[623,40,BROWN],[624,40,CLEAR],[200,511,BLUE],[200,512,CLEAR]],hits:[[600,40,'row-02'],[624,40,null],[200,511,'row-13']]},
 move:{origin:[48,64],viewport:[600,480],scroll:92,density:2,anchor:['row-02',28],pixels:[...outside,[47,72,CLEAR],[48,72,BROWN],[647,72,BROWN],[648,72,CLEAR],[200,99,BROWN],[200,100,GREEN],[200,543,BLUE],[200,544,CLEAR]],hits:[[200,72,'row-02'],[200,100,'row-03'],[47,72,null]]},
 recycle:{origin:[48,64],viewport:[600,480],scroll:640,density:2,anchor:['row-15',0],pixels:[...outside,[200,64,GREEN],[200,87,GREEN],[200,88,BLUE],[200,128,BROWN]],hits:[[200,72,'row-15'],[200,96,'row-16']]},
 return:{origin:[48,64],viewport:[600,480],scroll:92,density:2,anchor:['row-02',28],pixels:[...outside,[200,72,BROWN],[200,99,BROWN],[200,100,GREEN]],hits:[[200,72,'row-02']]},
 pending:{origin:[48,64],viewport:[600,480],scroll:92,density:2,anchor:['row-02',28],pixels:[...outside,[200,72,BROWN],[200,99,BROWN],[200,100,GREEN],[200,115,GREEN]],hits:[[200,72,'row-02'],[200,108,'row-03'],[710,40,'side-00'],...toolbarHits]},
 complete:{origin:[48,64],viewport:[600,480],scroll:92,density:2,anchor:['row-02',28],replacement:true,pixels:[...outside,[200,72,MAGENTA],[200,115,MAGENTA],[200,116,GREEN]],hits:[[200,72,'row-02'],[200,108,'row-02'],[200,116,'row-03'],[710,40,'side-00'],...toolbarHits]},
 'dispose-a':{pixels:[...outside,[200,72,CLEAR],[200,116,CLEAR]],hits:[[200,72,null],[710,40,'side-00'],...toolbarHits]},
});
export const assets=Object.freeze([
 ['examples/canvas-text/assets/ahem.ttf',22572,'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc'],
 ['tools/browser-png/assets/rgb-red-green.png',72,'917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d'],
]);
export const sourceReferences=Object.freeze(['examples/canvas-text/assets/provenance.json','examples/canvas-text/assets/Ahem-COPYING.txt','examples/canvas-text/assets/Ahem-README.txt','tools/browser-png/assets/provenance.json']);
