// SPDX-License-Identifier: Apache-2.0
// Original literal schedule: no SDK import, sampling call or controller algorithm.
export const colors=Object.freeze([[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255]]);
export const markers=Object.freeze([{id:'zero',timeSeconds:0},{id:'half',timeSeconds:0.5},{id:'halfAgain',timeSeconds:0.5},{id:'end',timeSeconds:1}]);
// State tuple: elapsed, local position, play, frame, state, rate, total plays, event count.
export const schedule=Object.freeze([
 {name:'initial',clock:0,A:[0,0,0,0,'running',1,2,1],B:[0,0,0,0,'running',2,'infinite',1],events:[['A','zero',0,0,0,0,1,'start'],['B','zero',0,0,0,0,1,'start']]},
 {name:'quarter',clock:0.25,A:[0.25,0.25,0,1,'running',1,2,1],B:[0.5,0.5,0,2,'running',2,'infinite',3],events:[['B','half',0,0.5,0.5,1,2,'clock'],['B','halfAgain',0,0.5,0.5,1,3,'clock']]},
 {name:'half',clock:0.5,A:[0.5,0.5,0,2,'running',1,2,3],B:[1,0,1,0,'running',2,'infinite',5],events:[['A','half',0,0.5,0.5,2,2,'clock'],['A','halfAgain',0,0.5,0.5,2,3,'clock'],['B','end',0,1,1,2,4,'clock'],['B','zero',1,1,0,2,5,'clock']]},
 {name:'three-quarter',clock:0.75,A:[0.75,0.75,0,3,'running',1,2,3],B:[1.5,0.5,1,2,'running',2,'infinite',7],events:[['B','half',1,1.5,0.5,3,6,'clock'],['B','halfAgain',1,1.5,0.5,3,7,'clock']]},
 {name:'one',clock:1,A:[1,0,1,0,'running',1,2,5],B:[2,0,2,0,'running',2,'infinite',9],events:[['A','end',0,1,1,4,4,'clock'],['A','zero',1,1,0,4,5,'clock'],['B','end',1,2,1,4,8,'clock'],['B','zero',2,2,0,4,9,'clock']]},
 {name:'pause-rate',clock:1,action:'pause-rate',A:[1,0,1,0,'running',2,2,5],B:[2,0,2,0,'paused',2,'infinite',9],events:[]},
 {name:'one-quarter',clock:1.25,A:[1.5,0.5,1,2,'running',2,2,7],B:[2,0,2,0,'paused',2,'infinite',9],events:[['A','half',1,1.5,0.5,5,6,'clock'],['A','halfAgain',1,1.5,0.5,5,7,'clock']]},
 {name:'complete',clock:1.5,A:[2,1,1,3,'completed',2,2,9],B:[2,0,2,0,'paused',2,'infinite',9],events:[['A','end',1,2,1,6,8,'clock'],['A','complete',2,2,null,6,9,'clock']]},
 {name:'seek-resume',clock:1.5,action:'seek-resume',A:[2,1,1,3,'completed',2,2,9],B:[0.25,0.25,0,1,'running',2,'infinite',9],events:[]},
 {name:'one-three-quarter',clock:1.75,A:[2,1,1,3,'completed',2,2,9],B:[0.75,0.75,0,3,'running',2,'infinite',11],events:[['B','half',0,0.5,0.5,7,10,'clock'],['B','halfAgain',0,0.5,0.5,7,11,'clock']]},
 {name:'two',clock:2,A:[2,1,1,3,'completed',2,2,9],B:[1.25,0.25,1,1,'running',2,'infinite',13],events:[['B','end',0,1,1,8,12,'clock'],['B','zero',1,1,0,8,13,'clock']]},
]);
export function expectedEvent(row){const [owner,id,playIndex,timelineSeconds,positionSeconds,clockTickId,sequence,source]=row;return {owner,...(id==='complete'?{kind:'complete',totalPlays:playIndex,timelineSeconds,clockTickId,sequence,source}:{kind:'marker',id,markerIndex:{zero:0,half:1,halfAgain:2,end:3}[id],playIndex,timelineSeconds,positionSeconds,clockTickId,sequence,source})};}
export const fixedPixels=Object.freeze([[0,0,[23,32,51,255]],[10,10,[68,96,128,255]],[95,40,[23,32,51,255]],[191,40,[23,32,51,255]],[36,40,[255,255,255,255]],[132,40,[255,255,255,255]],[24,64,[23,32,51,255]],[120,64,[23,32,51,255]]]);
export const decimalLiterals=Object.freeze([[0.9999999999999999,4,0.19999999999999984,1],[1,5,0,0],[1.0000000000000002,5,2.220446049250313e-16,0],[0.6,2,0.19999999999999996,1],[0.6000000000000001,3,0,0]]);
