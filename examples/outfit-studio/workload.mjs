// SPDX-License-Identifier: Apache-2.0
export const workload = Object.freeze({
  authored:6000, visible:600, records:50000, actors:8, sequences:80, clipLevels:8,
  bones:120, slots:96, weightedVertices:2000,
  mutations:Object.freeze({static:0,sparse:60,full:6000}), clockStep:1/60, displacement:.25,
  dragThreshold:6, drawerLimit:12, cameraScale:Object.freeze([.65,2.5]),
  text:'Outfits 颜色 · العربية 🆕'
});
const rect = (x,y,width,height) => Object.freeze({x,y,width,height});
const layouts = {
  desktop:{
    id:'X-D60/1',width:1024,height:768,ratio:1,rows:32,residentCap:48,rowHeights:[15,17],
    roster:rect(20,16,300,220),vault:rect(20,248,300,512),map:rect(340,20,664,728)
  },
  portrait:{
    id:'X-MTouch/1',width:360,height:640,ratio:2,rows:8,residentCap:24,rowHeights:[22,26],
    roster:rect(8,248,344,146),vault:rect(8,406,344,192),map:rect(8,8,344,232)
  },
  landscape:{
    id:'X-MTouch/1',width:640,height:360,ratio:2,rows:8,residentCap:24,rowHeights:[22,26],
    roster:rect(8,8,246,146),vault:rect(8,156,246,192),map:rect(264,8,368,344)
  }
};
for (const value of Object.values(layouts)) { Object.freeze(value.rowHeights); Object.freeze(value); }

const mixedLayouts = Object.freeze(Object.fromEntries(Object.entries(layouts).map(([key,layout]) =>
  [key,Object.freeze({...layout,id:layout.id.replace('/1','/2'),mixed:true})])));

export function fixedProfile(name, landscape = false) {
  if (name === 'x-d60') return layouts.desktop;
  if (name === 'x-mtouch') return landscape ? layouts.landscape : layouts.portrait;
  if (name === 'x-d60-2') return mixedLayouts.desktop;
  if (name === 'x-mtouch-2') return landscape ? mixedLayouts.landscape : mixedLayouts.portrait;
  if (name === null) return undefined;
  throw new Error('Choose x-d60, x-mtouch, x-d60-2 or x-mtouch-2');
}

export function vaultRecords({rowHeights}) {
  return Array.from({length:workload.records}, (_, index) => ({
    key:'outfit-'+index, contentVersion:1, estimatedHeight:rowHeights[index%2], value:index
  }));
}
