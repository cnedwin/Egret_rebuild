// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,toolbarPixels,toolbarHits} from '../examples/ui-data-panel/fixture.mjs';
// Independent linear scene reference checks the frozen literal domain without SDK code.
function keyAt(c,x,y){const [ox,oy]=c.origin,[w,h]=c.viewport;if(x<ox||x>=ox+w||y<oy||y>=oy+h)return null;const offset=y-oy+c.scroll;let sum=0;for(let i=0;i<30;i++){const height=c.replacement&&i===2?80:[24,40,64][i%3];if(offset<sum+height)return 'row-'+String(i).padStart(2,'0');sum+=height;}return null;}
test('frozen browser hit literals agree with independently authored linear geometry',()=>{
 for(const [name,c]of Object.entries(cases)){for(const [x,y,key]of c.hits){if(x>=700){const side=x<900&&y>=32&&y<152?'side-0'+Math.floor((y-32)/40):null;assert.equal(side,key,name+' independent B hit '+x+','+y);continue;}assert.equal(c.origin?keyAt(c,x,y):null,key,name+' '+x+','+y);}if(c.origin)assert.equal(keyAt(c,c.origin[0],c.origin[1]),c.anchor[0],name+' anchor');}
});
test('every browser phase has independent clip/interior pixels and pointer samples',()=>{
 assert.equal(Object.keys(cases).length,9);assert.equal(toolbarPixels.length,6);assert.equal(toolbarHits.length,2);assert.equal(Object.values(cases).reduce((n,c)=>n+c.pixels.length,0),154);assert.equal(Object.values(cases).reduce((n,c)=>n+c.hits.length,0),35);for(const c of Object.values(cases)){assert.ok(c.pixels.length>=7);assert.ok(c.hits.length);for(const [x,y,rgba]of c.pixels){assert.ok(Number.isInteger(x)&&x>=0&&x<960&&Number.isInteger(y)&&y>=0&&y<640);assert.equal(rgba.length,4);assert.ok(rgba.every(v=>Number.isInteger(v)&&v>=0&&v<=255));}}
});
test('frozen exact solid and bitmap pixels agree with independent geometry and source cells',()=>{
 for(const [name,c]of Object.entries(cases))for(const [x,y,actual]of c.pixels){let expected=[23,32,51,255];
  if(x>=700&&x<900&&y>=12&&y<32)expected=x<796?[68,96,128,255]:[128,80,48,255];
  else if(x>=700&&x<900&&y>=32&&y<152){expected=[112,80,160,255];const lx=x-700,ly=(y-32)%40;if(lx>=8&&lx<24&&ly>=4&&ly<12)expected=lx<16?[255,0,0,255]:[0,255,0,255];}
  else if(c.origin){const key=keyAt(c,x,y);if(key!==null){const i=Number(key.slice(4));expected=c.replacement&&i===2?[160,48,144,255]:[[40,100,80,255],[52,92,156,255],[160,80,48,255]][i%3];let prefix=0;for(let n=0;n<i;n++)prefix+=c.replacement&&n===2?80:[24,40,64][n%3];const lx=x-c.origin[0],ly=y-c.origin[1]+c.scroll-prefix;if(lx>=8&&lx<24&&ly>=4&&ly<12)expected=lx<16?[255,0,0,255]:[0,255,0,255];}}
  assert.deepEqual(actual,expected,name+' '+x+','+y);
 }
});
