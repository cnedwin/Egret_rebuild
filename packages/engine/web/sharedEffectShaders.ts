// SPDX-License-Identifier: Apache-2.0
/** Fixed separable box kernel, a spread of the group's alpha for a glow or an outline, Egret's colour matrix, and
 * source-over Alpha mask, in linear PMA space. Native targets encode sRGB on store; integer loads decode once on read. */
export type SharedEffectPass='horizontal'|'vertical'|'spread'|'composite';
export const EFFECT_PASSES:readonly SharedEffectPass[]=['horizontal','vertical','spread','composite'];
/** The uniform of a group, in vectors of four floats; see prepareEffects2D for what each holds. */
const VECTORS=36;
/** The bytes of one group's uniform, as prepareEffects2D fills it. */
export const EFFECT_UNIFORM_BYTES=VECTORS*16;
export function sharedEffectGLSL(mode:SharedEffectPass):string {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D sourceTexture;
uniform highp sampler2D maskTexture;
uniform highp sampler2D glowTexture;
layout(std140) uniform Effect { vec4 params[${VECTORS}]; };
layout(location=0) out vec4 fragmentColor;
vec2 localPoint(vec2 point,int base) {
  vec4 m=params[base],t=params[base+1];
  return vec2(m.x*point.x+m.z*point.y,m.y*point.x+m.w*point.y)+t.xy;
}
bool inside(vec2 point,int base) {
  vec2 p=localPoint(point,base)-params[base+1].zw;
  return all(greaterThanEqual(p,vec2(0.0)))&&all(lessThan(p,params[base+2].xy));
}
vec3 decodeColor(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
vec3 encodeColor(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
float alphaAt(highp sampler2D image,ivec2 p,ivec2 size){return all(greaterThanEqual(p,ivec2(0)))&&all(lessThan(p,size))?texelFetch(image,p,0).a:0.0;}
void main(){
  ivec2 size=textureSize(sourceTexture,0),at=ivec2(gl_FragCoord.xy);
`+(mode==='composite'?`
  vec2 point=vec2(gl_FragCoord.x,float(size.y)-gl_FragCoord.y);
  for(int i=0;i<8;i++){if(i>=int(params[0].z))break;if(!inside(point,4+i*3)){fragmentColor=vec4(0.0);return;}}
  float alpha=1.0;
  if(params[0].w>0.5){if(!inside(point,1)){fragmentColor=vec4(0.0);return;}
    vec2 uv=(localPoint(point,1)-params[2].zw)/params[3].xy;
    alpha=texelFetch(maskTexture,ivec2(floor(uv*vec2(textureSize(maskTexture,0)))),0).a;}
  vec4 c=texelFetch(sourceTexture,at,0);
  // Egret's matrix works on colour as it is seen, without its alpha multiplied in, and its offsets are of 0 to 255.
  if(params[28].x>0.5){
    vec4 v=vec4(c.a>0.0?encodeColor(clamp(c.rgb/c.a,0.0,1.0)):vec3(0.0),c.a);
    vec4 o=clamp(vec4(dot(params[31],v),dot(params[32],v),dot(params[33],v),dot(params[34],v))+params[35],0.0,1.0);
    c=vec4(decodeColor(o.rgb)*o.a,o.a);
  }
  int kind=int(params[28].y+0.5);
  if(kind>0){
    // The other direction of the spread the scratch target holds: an average for a glow, a maximum for an outline.
    int r=int(params[28].z);float g=0.0;
    for(int j=-16;j<=16;j++){if(abs(j)>r)continue;float t=alphaAt(glowTexture,at+ivec2(0,j),size);g=kind==2?max(g,t):g+t;}
    if(kind==1)g/=float(2*r+1);
    vec3 color=params[29].rgb;float strength=params[28].w,opacity=params[29].a;bool knockout=params[30].w>0.5;
    if(params[30].z>0.5){
      float k=clamp((1.0-g)*strength,0.0,1.0)*opacity;
      c=knockout?vec4(color*k*c.a,k*c.a):vec4(c.rgb*(1.0-k)+color*k*c.a,c.a);
    }else{
      float k=(kind==2?g:clamp(g*strength,0.0,1.0))*opacity;
      c=knockout?vec4(color*k,k)*(1.0-c.a):c+vec4(color*k,k)*(1.0-c.a);
    }
  }
  fragmentColor=c*alpha;
`:mode==='spread'?`
  // Across, from where the glow is moved from: the stage's y runs down, the target's up.
  int r=int(params[28].z),kind=int(params[28].y+0.5);ivec2 from=at-ivec2(int(params[30].x),-int(params[30].y));float g=0.0;
  for(int i=-16;i<=16;i++){if(abs(i)>r)continue;float t=alphaAt(sourceTexture,from+ivec2(i,0),size);g=kind==2?max(g,t):g+t;}
  if(kind==1)g/=float(2*r+1);
  fragmentColor=vec4(0.0,0.0,0.0,g);
`:`
  vec4 sum=vec4(0.0);int radius=int(params[0].x);
  for(int i=-16;i<=16;i++){if(abs(i)>radius)continue;ivec2 p=at+`+(mode==='horizontal'?'ivec2(i,0)':'ivec2(0,i)')+`;
    if(all(greaterThanEqual(p,ivec2(0)))&&all(lessThan(p,size)))sum+=texelFetch(sourceTexture,p,0);}
  fragmentColor=sum/float(2*radius+1);
`)+`}
`;
}
export function createSharedEffectPipeline(shader:(d:GPUShaderModuleDescriptor)=>GPUShaderModule,pipeline:(d:GPURenderPipelineDescriptor)=>Promise<GPURenderPipeline>,mode:SharedEffectPass):Promise<GPURenderPipeline>{
  const module=shader({code:`
struct Params { values:array<vec4<f32>,${VECTORS}> }
@group(0) @binding(0) var<uniform> params:Params;
@group(0) @binding(1) var sourceTexture:texture_2d<f32>;
`+(mode==='composite'?'@group(0) @binding(2) var maskTexture:texture_2d<f32>;\n@group(0) @binding(3) var glowTexture:texture_2d<f32>;':'')+`
fn localPoint(point:vec2<f32>,base:u32)->vec2<f32>{let m=params.values[base];let t=params.values[base+1u];return vec2<f32>(m.x*point.x+m.z*point.y,m.y*point.x+m.w*point.y)+t.xy;}
fn inside(point:vec2<f32>,base:u32)->bool{let p=localPoint(point,base)-params.values[base+1u].zw;return all(p>=vec2<f32>(0.0))&&all(p<params.values[base+2u].xy);}
fn decodeColor(c:vec3<f32>)->vec3<f32>{return select(pow((c+0.055)/1.055,vec3<f32>(2.4)),c/12.92,c<vec3<f32>(0.04045));}
fn encodeColor(c:vec3<f32>)->vec3<f32>{return select(1.055*pow(c,vec3<f32>(1.0/2.4))-0.055,c*12.92,c<vec3<f32>(0.0031308));}
@vertex fn vertexMain(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));return vec4<f32>(p[index],0.0,1.0);}
`+(mode==='composite'?`fn glowAt(p:vec2<i32>,size:vec2<i32>)->f32{if(all(p>=vec2<i32>(0))&&all(p<size)){return textureLoad(glowTexture,p,0).a;}return 0.0;}
`:mode==='spread'?`fn alphaAt(p:vec2<i32>,size:vec2<i32>)->f32{if(all(p>=vec2<i32>(0))&&all(p<size)){return textureLoad(sourceTexture,p,0).a;}return 0.0;}
`:'')+`@fragment fn fragmentMain(@builtin(position) position:vec4<f32>)->@location(0) vec4<f32>{
 let at=vec2<i32>(position.xy);let size=vec2<i32>(textureDimensions(sourceTexture));
`+(mode==='composite'?`
 for(var i=0u;i<8u;i++){if(i>=u32(params.values[0].z)){break;}if(!inside(position.xy,4u+i*3u)){return vec4<f32>(0.0);}}
 var alpha=1.0;
 if(params.values[0].w>0.5){if(!inside(position.xy,1u)){return vec4<f32>(0.0);}let uv=(localPoint(position.xy,1u)-params.values[2].zw)/params.values[3].xy;alpha=textureLoad(maskTexture,vec2<i32>(floor(uv*vec2<f32>(textureDimensions(maskTexture)))),0).a;}
 var c=textureLoad(sourceTexture,at,0);
 if(params.values[28].x>0.5){
  var s=vec3<f32>(0.0);if(c.a>0.0){s=encodeColor(clamp(c.rgb/c.a,vec3<f32>(0.0),vec3<f32>(1.0)));}
  let v=vec4<f32>(s,c.a);
  let o=clamp(vec4<f32>(dot(params.values[31],v),dot(params.values[32],v),dot(params.values[33],v),dot(params.values[34],v))+params.values[35],vec4<f32>(0.0),vec4<f32>(1.0));
  c=vec4<f32>(decodeColor(o.rgb)*o.a,o.a);
 }
 let kind=i32(params.values[28].y+0.5);
 if(kind>0){
  let r=i32(params.values[28].z);var g=0.0;
  for(var j=-16;j<=16;j++){if(abs(j)>r){continue;}let t=glowAt(at+vec2<i32>(0,j),size);if(kind==2){g=max(g,t);}else{g+=t;}}
  if(kind==1){g=g/f32(2*r+1);}
  let color=params.values[29].rgb;let strength=params.values[28].w;let opacity=params.values[29].a;let knockout=params.values[30].w>0.5;
  if(params.values[30].z>0.5){
   let k=clamp((1.0-g)*strength,0.0,1.0)*opacity;
   if(knockout){c=vec4<f32>(color*k*c.a,k*c.a);}else{c=vec4<f32>(c.rgb*(1.0-k)+color*k*c.a,c.a);}
  }else{
   var k=clamp(g*strength,0.0,1.0)*opacity;if(kind==2){k=g*opacity;}
   if(knockout){c=vec4<f32>(color*k,k)*(1.0-c.a);}else{c=c+vec4<f32>(color*k,k)*(1.0-c.a);}
  }
 }
 return c*alpha;
`:mode==='spread'?`
 let r=i32(params.values[28].z);let kind=i32(params.values[28].y+0.5);let from=at-vec2<i32>(i32(params.values[30].x),i32(params.values[30].y));var g=0.0;
 for(var i=-16;i<=16;i++){if(abs(i)>r){continue;}let t=alphaAt(from+vec2<i32>(i,0),size);if(kind==2){g=max(g,t);}else{g+=t;}}
 if(kind==1){g=g/f32(2*r+1);}
 return vec4<f32>(0.0,0.0,0.0,g);
`:`
 var sum=vec4<f32>(0.0);let radius=i32(params.values[0].x);
 for(var i=-16;i<=16;i++){if(abs(i)>radius){continue;}let p=at+`+(mode==='horizontal'?'vec2<i32>(i,0)':'vec2<i32>(0,i)')+`;if(all(p>=vec2<i32>(0))&&all(p<size)){sum+=textureLoad(sourceTexture,p,0);}}
 return sum/f32(2*radius+1);
`)+`}`});
  const target:GPUColorTargetState={format:'rgba8unorm-srgb',writeMask:15};
  if(mode==='composite')target.blend={color:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'}};
  return pipeline({layout:'auto',vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets:[target]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode:'none'},multisample:{count:1,alphaToCoverageEnabled:false}});
}
