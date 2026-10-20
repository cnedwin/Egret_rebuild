// SPDX-License-Identifier: Apache-2.0
// Independent finite literals/reference composition; no app, SDK or render import.
import { createHash } from 'node:crypto';

function freeze(value){if(value!==null&&typeof value==='object'){for(const entry of Object.values(value))freeze(entry);Object.freeze(value);}return value;}
function fault(code,message,details){const error=new Error(message);error.code='P03_ORACLE_'+code;if(details!==undefined)error.details=freeze(details);throw error;}
function exactKeys(value,keys){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function bytes(value,length,code){if(!(value instanceof Uint8Array)||value.byteLength!==length)fault(code,'Exact Uint8Array byte domain required');return value;}
const K=[0,0,0,255],W=[255,255,255,255],R=[255,0,0,255],G=[0,255,0,255],B=[0,0,255,255],Y=[255,255,0,255];
const CARD=[64,64,64,255],DARK=[32,32,32,255],SKIN=[255,192,128,255];
const SETS=freeze({classic:{outer:R,trim:G},summer:{outer:B,trim:Y},mix:{outer:R,trim:Y}});
export const REFERENCE_ENVIRONMENT=freeze({browser:'Microsoft Edge',browserVersion:'155.0.4283.45',playwrightVersion:'1.62.1',
  platform:'win32',arch:'x64',release:'10.0.26300',browserLanguage:'zh-CN',extraLaunchFlags:[]});
export const REFERENCE_PINS=freeze({
  left:{bytes:12288,sha256:'f972dbeb2c4d4f314b4ab922a4ec9afd7569ec156eb90c4757cf3a728bcee394'},
  right:{bytes:12288,sha256:'941dc2c181e97c65da54d60969c27b140a8431abd75c4da8a10ff08d3569092b'},
});
export const FRAME_CASES=freeze({
  'classic-left-pose0':{left:'classic',right:'classic',selected:'left',seconds:0,pose:0},
  'classic-right-pose0':{left:'classic',right:'classic',selected:'right',seconds:0,pose:0},
  'classic-right-before-boundary':{left:'classic',right:'classic',selected:'right',seconds:0.125-2**-20,pose:0},
  'classic-right-pose1':{left:'classic',right:'classic',selected:'right',seconds:0.125,pose:1},
  'summer-right-pose1':{left:'summer',right:'classic',selected:'right',seconds:0.125,pose:1},
  'mix-right-pose1':{left:'mix',right:'classic',selected:'right',seconds:0.125,pose:1},
  'removed-left-right-pose1':{left:'absent',right:'classic',selected:'right',seconds:0.125,pose:1},
});

function admittedEnvironment(environment){
  if(!exactKeys(environment,Object.keys(REFERENCE_ENVIRONMENT)))fault('REFERENCE_ENVIRONMENT','Original reference environment keys required');
  // Independent direct-Canvas repetition found identical complete references and metrics for this exact patch.
  for(const key of Object.keys(REFERENCE_ENVIRONMENT)){
    const admitted=key==='browserVersion'?['155.0.4283.45','155.0.4283.62'].includes(environment[key]):equal(environment[key],REFERENCE_ENVIRONMENT[key]);
    if(!admitted)fault('REFERENCE_ENVIRONMENT','Independent reference unavailable for changed '+key);
  }
}
function admittedReferences(references){
  if(!exactKeys(references,['left','right']))fault('REFERENCE_IDENTITY','Exactly both original CJK references required');
  for(const key of ['left','right']){
    const pin=REFERENCE_PINS[key],raw=bytes(references[key],pin.bytes,'REFERENCE_IDENTITY');
    if(createHash('sha256').update(raw).digest('hex')!==pin.sha256)fault('REFERENCE_IDENTITY','Original '+key+' reference raw hash differs');
  }
}
function pointRows(profile,state){
  const rows=[];
  const point=(name,x,y,rgba)=>rows.push({name,point:[x,y],expected:rgba});
  for(const [side,offset] of [['left',0],['right',80]])for(const [layer,ys] of [['outer',[69,72,75]],['trim',[81,84,87]]]){
    const expected=state[side]==='absent'?CARD:SETS[state[side]][layer];
    for(let row=0;row<3;row++)for(let column=0;column<3;column++)point(side+'.'+layer+'.'+row+'.'+column,[50,56,62][column]+offset,ys[row],expected);
  }
  for(const [side,offset] of [['left',0],['right',80]]){
    const absent=state[side]==='absent',selected=state.selected===side;
    point(side+'.head',56+offset,54,absent?CARD:SKIN);
    point(side+'.leg',45+offset,87,absent?CARD:state.pose===0?DARK:selected?W:CARD);
    point(side+'.selection-surround',30+offset,50,absent?CARD:selected?W:CARD);
  }
  point('badge.red',10,10,R);point('badge.green',22,10,G);
  point('ahem.first-X',35,11,W);point('ahem.gap',43,11,K);point('ahem.second-X',51,11,W);
  point('depth.front',96,64,profile==='canvas-2d'?K:R);point('depth.back',32,24,profile==='canvas-2d'?K:B);
  return rows;
}
function comparePoints(raw,profile,state){
  return pointRows(profile,state).map(row=>{
    const offset=(row.point[1]*192+row.point[0])*4,actual=Array.from(raw.subarray(offset,offset+4));
    return {...row,expected:[...row.expected],actual,mismatchChannels:actual.reduce((count,value,channel)=>count+Number(value!==row.expected[channel]),0)};
  });
}
function glyphRegion(raw,profile,state,references){
  const reference=references[state.selected],failures=[];let mismatchedChannels=0,changedChannels=0,maxDifference=0,partialAlphaPixels=0;
  for(let sy=4;sy<20;sy++)for(let sx=4;sx<68;sx++){
    const alpha=reference[(sy*128+sx)*4+3],x=sx+68,y=sy+4;
    const partial=alpha>0&&alpha<255;if(partial)partialAlphaPixels++;
    const expected=[alpha,alpha,profile==='webgpu-scene-textured'&&y>=16?255:alpha,255],offset=(y*192+x)*4;
    for(let channel=0;channel<4;channel++){
      const tolerance=channel<3&&partial?1:0,delta=Math.abs(raw[offset+channel]-expected[channel]);
      maxDifference=Math.max(maxDifference,delta);if(delta!==0)changedChannels++;
      if(delta>tolerance){mismatchedChannels++;if(failures.length<16)failures.push({point:[x,y],channel,expected:expected[channel],actual:raw[offset+channel],tolerance});}
    }
  }
  const result={id:state.selected,sourceRGBA:REFERENCE_PINS[state.selected],sourceROI:[4,4,64,16],sceneROI:[72,8,64,16],
    pixels:1024,channels:4096,partialAlphaPixels,partialAlphaRGBTolerance:1,opaqueAndOutputAlphaTolerance:0,
    changedChannels,maxDifference,mismatchedChannels,failures,failuresTruncated:mismatchedChannels>failures.length};
  if(mismatchedChannels!==0)fault('GLYPH_MISMATCH','Fixed CJK ROI comparison failed',result);
  return result;
}

/** Compare only the frozen finite domain; this does not authenticate frame origin. */
export function comparePreparedFrame(input){
  if(!exactKeys(input,['rgba','profile','frame','control','references','environment']))fault('INPUT_INVALID','Closed oracle input fields required');
  const {rgba,profile,frame,control,references,environment}=input;
  if(!['canvas-2d','webgpu-scene-textured'].includes(profile)||!Object.hasOwn(FRAME_CASES,frame)
    ||!['ordinary','manual-old-A-outer','manual-old-B-trim'].includes(control)
    ||(control!=='ordinary'&&frame!=='summer-right-pose1'))fault('INPUT_INVALID','Only assigned profile/frame/control combinations are admitted');
  const raw=bytes(rgba,98304,'RGBA_INVALID');admittedEnvironment(environment);admittedReferences(references);
  const state=FRAME_CASES[frame],samples=comparePoints(raw,profile,state),mismatches=samples.filter(row=>row.mismatchChannels!==0);
  const glyph=glyphRegion(raw,profile,state,references);
  if(control==='ordinary'){
    if(mismatches.length!==0)fault('POINT_MISMATCH','Ordinary literal point comparison failed',{mismatches});
  }else{
    const layer=control==='manual-old-A-outer'?'outer':'trim',wrong=layer==='outer'?R:G;
    const assigned=samples.filter(row=>row.name.startsWith('left.'+layer+'.')).map(row=>row.name).sort();
    if(!equal(mismatches.map(row=>row.name).sort(),assigned)||mismatches.some(row=>!equal(row.actual,wrong)))
      fault('CONTROL_MISMATCH','The exact assigned nine wrong-layer colors were not the sole point failures',{control,assigned,mismatches});
  }
  return freeze({status:control==='ordinary'?'ORDINARY_DOMAIN_PASS':'ASSIGNED_CONTROL_DETECTED',ordinaryAccepted:control==='ordinary',
    nativeAcceptance:'OPEN',profile,frame,control,expectedState:state,pointCount:samples.length,samples,pointMismatches:mismatches,glyph,
    scope:'49 literal points and two fixed-string CJK ROI choices only; complete RGBA retention is not exhaustive image acceptance.'});
}
