// First-party Apache-2.0. Independent WC1 recipe; no Egret plan or image helpers.
export const RECIPE_ID = 'wc1-owned-ahem-complete-line-reference-v1';
const RAW = ['width','actualBoundingBoxLeft','actualBoundingBoxAscent','actualBoundingBoxRight','actualBoundingBoxDescent'];
const states = new WeakMap();
export function failure(outcome, stage, message, detail = null, cause) {
  const error = new Error(message, arguments.length < 5 ? undefined : {cause});
  Object.assign(error,{outcome,stage,detail}); return error;
}
// Presence is independent of the raw value; never mutate caller/native throws.
export function createFailureState(){return {present:false,value:undefined,phase:null,cleanup:[]};}
export function rememberFailure(state,value,phase='operation'){if(!state.present){state.present=true;state.value=value;state.phase=phase;}return value;}
export function rememberCleanup(state,value,phase){state.cleanup.push({phase,value});rememberFailure(state,value,phase);}
function dataProperty(value,key){
  if((typeof value!=='object'||value===null)&&typeof value!=='function')return {present:false};
  try{for(let item=value,depth=0;item!==null&&depth<8;item=Object.getPrototypeOf(item),depth++){const d=Object.getOwnPropertyDescriptor(item,key);if(d)return 'value'in d?{present:true,value:d.value}:{present:true,accessor:true};}}catch{return {present:false,unreadable:true};}
  return {present:false};
}
function rawValue(value){const kind=value===null?'null':typeof value;
  if(kind==='undefined'||kind==='null')return {kind,value:null};
  if(kind==='number')return {kind,value:Number.isFinite(value)?value:String(value),negativeZero:Object.is(value,-0)};
  if(kind==='string')return {kind,value:value.slice(0,8192),truncated:value.length>8192};
  if(kind==='boolean')return {kind,value};
  if(kind==='bigint'||kind==='symbol')return {kind,value:String(value).slice(0,8192)};
  return {kind,value:null,identityHeldInMemory:true};
}
function diagnosticData(value,depth=0,seen=new Set()){
  if(value===null||typeof value!=='object')return rawValue(value).value;
  if(depth>=6||seen.has(value))return '[bounded diagnostic]';seen.add(value);
  try{const result=Array.isArray(value)?[]:{};const descriptors=Object.getOwnPropertyDescriptors(value);let count=0;for(const key of Object.keys(descriptors)){if(key==='length'&&Array.isArray(value))continue;if(++count>128){result.diagnosticTruncated=true;break;}const d=descriptors[key];result[key]='value'in d?diagnosticData(d.value,depth+1,seen):'[accessor not invoked]';}return result;}catch{return '[unreadable diagnostic]';}finally{seen.delete(value);}
}
export function serializeThrown(value,includeCause=true){
  const read=key=>dataProperty(value,key),message=read('message'),name=read('name'),cause=read('cause'),detail=read('detail');
  const raw=rawValue(value),text=typeof message.value==='string'?message.value:(raw.kind==='object'||raw.kind==='function'?'Opaque thrown value':String(value));
  return {present:true,rawPrimary:raw,name:typeof name.value==='string'?name.value:'Thrown '+raw.kind,code:diagnosticData(read('code').value),outcome:diagnosticData(read('outcome').value),stage:diagnosticData(read('stage').value),message:text.slice(0,8192),detail:detail.present?diagnosticData(detail.value):null,
    cause:includeCause&&cause.present&&!cause.accessor?serializeThrown(cause.value,false):null,causePresent:cause.present,causeAccessorNotInvoked:Boolean(cause.accessor)};
}
function requireValue(value, stage, detail) { if (!value) throw failure('INCOMPLETE',stage,'Required independent native capability or recipe was not established',detail); }
export function equal(actual, expected, stage) {
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(expected))) throw failure('FAIL',stage,'Established independent witness differs',{actual,expected});
}
function exactBytes(actual,expected,stage) {
  let mismatchCount=0,maxDifference=0,first=null;
  if(actual.length!==expected.length)throw failure('FAIL',stage,'Independent byte lengths differ',{actualLength:actual.length,expectedLength:expected.length});
  for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i]){mismatchCount++;maxDifference=Math.max(maxDifference,Math.abs(actual[i]-expected[i]));first??={index:i,actual:actual[i],expected:expected[i]};}
  if(mismatchCount)throw failure('FAIL',stage,'Strict independent byte equality differs; no tolerance',{mismatchCount,maxDifference,first});
}
export function sample(bytes,width,height,x,y) {
  requireValue(Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&x>=0&&y>=0&&x<width&&y<height,'sample',{x,y,width,height});
  const index=4*(y*width+x); return Array.from(bytes.subarray(index,index+4));
}
export function canonicalMetrics(native, row, density) {
  let union, advance=0;
  const lines=native.map((item,index)=>{
    const r=item.raw, values=RAW.map(name=>r[name]);
    requireValue(values.every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1048576)&&r.width>=0,'native-metrics',item);
    equal(r.width,row.advances[index],'owned-outline-advance'); advance=Math.max(advance,r.width);
    let left=-r.actualBoundingBoxLeft,top=-r.actualBoundingBoxAscent,right=r.actualBoundingBoxRight,bottom=r.actualBoundingBoxDescent;
    requireValue(left<=right&&top<=bottom,'ordered-native-ink',item);
    const hasInk=left<right&&top<bottom, baselineY=20+index*10;
    if (!hasInk) left=top=right=bottom=0;
    const inkBounds=hasInk?{x:left===0?0:left,y:top+baselineY===0?0:top+baselineY,width:right-left,height:bottom-top}:undefined;
    if(hasInk){const bounds=[left,top+baselineY,right,bottom+baselineY];union=union?[Math.min(union[0],bounds[0]),Math.min(union[1],bounds[1]),Math.max(union[2],bounds[2]),Math.max(union[3],bounds[3])]:bounds;}
    const range=row.ranges[index];return {source:{start:range[0],end:range[1],breakEnd:range[2]},advance:r.width===0?0:r.width,baselineY,inkBounds};
  });
  const bounds=(left,top,right,bottom)=>({x:left===0?0:left,y:top===0?0:top,width:right-left,height:bottom-top});
  const logicalBounds={x:0,y:0,width:advance,height:lines.length*10};
  const inkBounds=union?bounds(...union):undefined;
  const contentBounds=union?bounds(Math.min(0,union[0]),Math.min(0,union[1]),Math.max(advance,union[2]),Math.max(lines.length*10,union[3])):{...logicalBounds};
  let raster;
  if(union){const pixelLeft=Math.floor(density*union[0])-2,pixelTop=Math.floor(density*union[1])-2,right=Math.ceil(density*union[2])+2,bottom=Math.ceil(density*union[3])+2,width=right-pixelLeft,height=bottom-pixelTop,byteLength=width*height*4;
    requireValue([pixelLeft,pixelTop,right,bottom,width,height,byteLength].every(Number.isSafeInteger)&&width>0&&height>0&&width<=4096&&height<=4096&&width*height<=1048576&&byteLength<=4194304,'raster-budget',{width,height,byteLength});
    raster={pixelLeft,pixelTop,width,height,byteLength,density,x:pixelLeft/density,y:pixelTop/density,logicalWidth:width/density,logicalHeight:height/density};}
  return {logicalBounds,inkBounds,contentBounds,lines,raster};
}
export function textState(context, canvas, family) {
  canvas.lang='und';context.setTransform(1,0,0,1,0,0);context.font=`normal 400 20px ${JSON.stringify(family)}`;
  context.textAlign='left';context.textBaseline='alphabetic';context.direction='ltr';context.globalAlpha=1;context.globalCompositeOperation='source-over';context.fillStyle='#2753a1';
  context.shadowColor='rgba(0, 0, 0, 0)';context.shadowBlur=0;context.shadowOffsetX=0;context.shadowOffsetY=0;context.filter='none';
  const optional={};
  for(const[name,value]of [['lang','und'],['fontKerning','auto'],['fontStretch','normal'],['fontVariantCaps','normal'],['letterSpacing','0px'],['wordSpacing','0px'],['textRendering','auto']]){
    if(name==='lang'&&!(name in context)){optional[name]={exposed:false,canvasLang:'und'};continue;}
    requireValue(name in context,'required-state',{name});context[name]=value;requireValue(context[name]===value,'required-state',{name,value,actual:context[name]});optional[name]=value;
  }
  requireValue(canvas.lang==='und'&&context.textAlign==='left'&&context.textBaseline==='alphabetic'&&context.direction==='ltr'&&context.globalAlpha===1&&context.globalCompositeOperation==='source-over'&&context.fillStyle==='#2753a1'&&context.font.includes(family),'state');
  return {canvasLang:canvas.lang,font:context.font,textAlign:context.textAlign,textBaseline:context.textBaseline,direction:context.direction,fill:context.fillStyle,alpha:1,composite:'source-over',optional};
}
export function ownSurface(width,height,errors=createFailureState(),readback=true) {
  const canvas=document.createElement('canvas');
  try{canvas.width=width;canvas.height=height;
    // Readback surfaces retain their hint; draw-only sources match the host's first acquisition.
    const context=canvas.getContext('2d',readback?{alpha:true,colorSpace:'srgb',willReadFrequently:true}:{colorSpace:'srgb'});
    requireValue(context&&typeof context.getContextAttributes==='function','2d-context');
    const attrs=context.getContextAttributes();requireValue(attrs.alpha===true&&attrs.colorSpace==='srgb','context-attributes',attrs);
    return {canvas,context,attributes:{alpha:attrs.alpha,colorSpace:attrs.colorSpace,willReadFrequently:attrs.willReadFrequently??null}};
  }catch(cause){rememberFailure(errors,cause,'reference-surface-operation');for(const name of ['width','height'])try{canvas[name]=0;}catch(cleanup){rememberCleanup(errors,cleanup,'reference-surface-'+name);}throw cause;}
}
export function nativeBytes(surface) {
  const {canvas,context}=surface, image=context.getImageData(0,0,canvas.width,canvas.height,{colorSpace:'srgb',pixelFormat:'rgba-unorm8'}),data=image.data;
  requireValue(image.colorSpace==='srgb'&&(!('pixelFormat' in image)||image.pixelFormat==='rgba-unorm8')&&Object.getPrototypeOf(data)===Uint8ClampedArray.prototype&&Object.getPrototypeOf(data.buffer)===ArrayBuffer.prototype&&data.byteLength===canvas.width*canvas.height*4,'native-byte-shape');
  return new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice();
}
export function retireSurface(surface,errors=createFailureState()) {
  if(!surface)return {widthReset:true,heightReset:true};let cleanupPresent=false,firstCleanup;
  const capture=(value,phase)=>{rememberCleanup(errors,value,phase);if(!cleanupPresent){cleanupPresent=true;firstCleanup=value;}};
  for(const name of ['width','height'])try{surface.canvas[name]=0;}catch(error){capture(error,'reference-retire-'+name);}
  let record={widthReset:false,heightReset:false};
  try{record={widthReset:surface.canvas.width===0,heightReset:surface.canvas.height===0};if(!record.widthReset||!record.heightReset)capture(failure('INCOMPLETE','reference-retirement','Owned surface cleanup failed',record),'reference-retire-state');}catch(error){capture(error,'reference-retire-state');}finally{surface.context=null;surface.canvas=null;}
  if(cleanupPresent)throw firstCleanup;return record;
}
export function sceneBytes(entry,{origin=[20,20],alpha=1,clip,overlay=false,omitOrigin=false}={},errors=createFailureState()) {
  const scene=ownSurface(80,80,errors);let source=null;
  let primaryPresent=false;
  try{
    if(entry.metrics.raster)source=ownSurface(entry.metrics.raster.width,entry.metrics.raster.height,errors,false);
    const c=scene.context;c.imageSmoothingEnabled=false;c.clearRect(0,0,80,80);
    if(source){const r=entry.metrics.raster;source.context.putImageData(new ImageData(new Uint8ClampedArray(entry.ownedBytes.buffer,entry.ownedBytes.byteOffset,entry.ownedBytes.byteLength),r.width,r.height,{colorSpace:'srgb'}),0,0);
      c.save();if(clip){c.beginPath();c.rect(origin[0]+clip.x,origin[1]+clip.y,clip.width,clip.height);c.clip();}c.globalAlpha=alpha;
      c.drawImage(source.canvas,origin[0]+(omitOrigin?0:r.x),origin[1]+(omitOrigin?0:r.y),r.logicalWidth,r.logicalHeight);c.restore();}
    if(overlay){c.fillStyle='#ff0000';c.globalAlpha=1;c.fillRect(28,28,4,4);}return nativeBytes(scene);
  }catch(error){primaryPresent=true;rememberFailure(errors,error,'reference-scene-operation');throw error;}finally{let cleanupPresent=false,firstCleanup;for(const surface of [source,scene])try{retireSurface(surface,errors);}catch(error){if(!cleanupPresent){cleanupPresent=true;firstCleanup=error;}}if(cleanupPresent&&!primaryPresent)throw firstCleanup;}
}
export function collectReference(cases,family,ownedFace,selection,errors=createFailureState()) {
  requireValue(cases.recipeId===RECIPE_ID&&cases.rows.length===7&&JSON.stringify(cases.source.densities)==='[1,1.5]','recipe');
  requireValue(document.fonts.has(ownedFace)&&ownedFace.status==='loaded'&&ownedFace.family===family&&selection.beforeAddAdvance!==selection.afterAddAdvance&&selection.afterAddAdvance===400,'owned-face-selection',selection);
  const surface=ownSurface(1,1,errors),ownedSurfaces=[],entries=[];
  const metadata={schemaVersion:1,recipeId:RECIPE_ID,family,selection,contextAttributes:surface.attributes,entries:[],controlPreconditions:[],allocation:{outsideT1:true,physicalPeak:'UNKNOWN',retainedRawBufferCap:28}};
  let primaryPresent=false;
  try{
    for(const density of cases.source.densities)for(const row of cases.rows){
      const state=textState(surface.context,surface.canvas,family),native=[];
      for(const[start,end,breakEnd]of row.ranges){const text=row.text.slice(start,end),m=surface.context.measureText(text),raw={},negativeZero={};for(const name of RAW){raw[name]=m[name];negativeZero[name]=Object.is(m[name],-0);}native.push({text,source:{start,end,breakEnd},raw,negativeZero});}
      const metrics=canonicalMetrics(native,row,density),r=metrics.raster;let ownedBytes=new Uint8Array(0),rasterState=null;
      if(r){const raster=ownSurface(r.width,r.height,errors);ownedSurfaces.push(raster);rasterState=textState(raster.context,raster.canvas,family);raster.context.setTransform(density,0,0,density,-r.pixelLeft,-r.pixelTop);
        for(let i=0;i<row.ranges.length;i++)raster.context.fillText(native[i].text,0,20+10*i);ownedBytes=nativeBytes(raster);ownedSurfaces.pop();retireSurface(raster,errors);}
      const entry={id:row.id+'-d'+String(density).replace('.','_'),row:row.id,text:row.text,density,native,metrics,ownedBytes,state,rasterState};entry.sceneBytes=sceneBytes(entry,{},errors);
      for(const point of row.interiors)equal(sample(entry.sceneBytes,80,80,20+point[0],20+point[1]),cases.scene.opaque,'predeclared-outline-interior');
      for(const point of row.gaps)equal(sample(entry.sceneBytes,80,80,20+point[0],20+point[1]),cases.scene.clear,'predeclared-outline-gap');
      if(!r)equal(Array.from(new Set(entry.sceneBytes)),[0],'blank-reference');
      entries.push(entry);metadata.entries.push({id:entry.id,row:row.id,text:row.text,density,native,metrics,state,rasterState,ownedBytes:ownedBytes.length,sceneBytes:entry.sceneBytes.length});
    }
    for(const density of [1,1.5]){
      const lf=entries.find(e=>e.row==='LF'&&e.density===density),crlf=entries.find(e=>e.row==='CRLF'&&e.density===density);
      exactBytes(lf.ownedBytes,crlf.ownedBytes,'strict-reference-LF-CRLF-owned');exactBytes(lf.sceneBytes,crlf.sceneBytes,'strict-reference-LF-CRLF-scene');
    }
    for(const control of cases.controls){const e=entries.find(item=>item.row===control.row&&item.density===control.density),r=e.metrics.raster;requireValue(r,'control-raster');let actual;
      if(control.mode==='noOp'){const clearSurface=ownSurface(80,80,errors);let controlPrimaryPresent=false;try{actual=sample(nativeBytes(clearSurface),80,80,...control.scenePoint);equal(sample(e.sceneBytes,80,80,...control.scenePoint),control.expected,'no-op-independent-baseline');}catch(error){controlPrimaryPresent=true;rememberFailure(errors,error,'reference-control-operation');throw error;}finally{try{retireSurface(clearSurface,errors);}catch(cleanup){if(!controlPrimaryPresent)throw cleanup;}}}else{
        const p=control.logicalPoint,x=Math.floor(p[0]*e.density-r.pixelLeft),y=Math.floor(p[1]*e.density-r.pixelTop),s=ownSurface(r.width,r.height,errors);
        let controlPrimaryPresent=false;
        try{textState(s.context,s.canvas,family);if(control.mode==='omitOrigin'){s.context.setTransform(e.density,0,0,e.density,0,0);for(let i=0;i<e.native.length;i++)s.context.fillText(e.native[i].text,0,20+10*i);}actual=sample(nativeBytes(s),r.width,r.height,x,y);
          equal(sample(e.ownedBytes,r.width,r.height,x,y),control.expected,'control-independent-baseline');}catch(error){controlPrimaryPresent=true;rememberFailure(errors,error,'reference-control-operation');throw error;}finally{try{retireSurface(s,errors);}catch(cleanup){if(!controlPrimaryPresent)throw cleanup;}}}
      equal(actual,control.mutant,'control-independent-mutation');metadata.controlPreconditions.push({...control,actual,established:true});
    }
    const table={metadata,entries};states.set(table,{disposed:false,entries});return table;
  }catch(error){primaryPresent=true;rememberFailure(errors,error,'reference-operation');for(const s of ownedSurfaces)try{retireSurface(s,errors);}catch{}throw error;
  }finally{try{retireSurface(surface,errors);}catch(cleanup){if(!primaryPresent)throw cleanup;}}
}
export function disposeReference(table) {
  const state=states.get(table);requireValue(state,'reference-authority');if(!state.disposed){for(const row of state.entries){row.ownedBytes=null;row.sceneBytes=null;}state.disposed=true;}
  return {disposed:state.disposed,retainedRawBuffers:0,physicalReclamation:'UNKNOWN'};
}
