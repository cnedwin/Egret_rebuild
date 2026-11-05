// SPDX-License-Identifier: Apache-2.0
/** Fixed separable box kernel and source-over Alpha mask, in linear PMA space.
 * Native targets encode sRGB on store; integer loads decode once on read. */
export type SharedEffectPass='horizontal'|'vertical'|'composite';
export const EFFECT_PASSES:readonly SharedEffectPass[]=['horizontal','vertical','composite'];
export function sharedEffectGLSL(mode:SharedEffectPass):string {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D sourceTexture;
uniform highp sampler2D maskTexture;
layout(std140) uniform Effect { vec4 params[28]; };
layout(location=0) out vec4 fragmentColor;
vec2 localPoint(vec2 point,int base) {
  vec4 m=params[base],t=params[base+1];
  return vec2(m.x*point.x+m.z*point.y,m.y*point.x+m.w*point.y)+t.xy;
}
bool inside(vec2 point,int base) {
  vec2 p=localPoint(point,base)-params[base+1].zw;
  return all(greaterThanEqual(p,vec2(0.0)))&&all(lessThan(p,params[base+2].xy));
}
void main(){
  ivec2 size=textureSize(sourceTexture,0),at=ivec2(gl_FragCoord.xy);
`+(mode==='composite'?`
  vec2 point=vec2(gl_FragCoord.x,float(size.y)-gl_FragCoord.y);
  for(int i=0;i<8;i++){if(i>=int(params[0].z))break;if(!inside(point,4+i*3)){fragmentColor=vec4(0.0);return;}}
  float alpha=1.0;
  if(params[0].w>0.5){if(!inside(point,1)){fragmentColor=vec4(0.0);return;}
    vec2 uv=(localPoint(point,1)-params[2].zw)/params[3].xy;
    alpha=texelFetch(maskTexture,ivec2(floor(uv*vec2(textureSize(maskTexture,0)))),0).a;}
  fragmentColor=texelFetch(sourceTexture,at,0)*alpha;
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
struct Params { values:array<vec4<f32>,28> }
@group(0) @binding(0) var<uniform> params:Params;
@group(0) @binding(1) var sourceTexture:texture_2d<f32>;
`+(mode==='composite'?'@group(0) @binding(2) var maskTexture:texture_2d<f32>;':'')+`
fn localPoint(point:vec2<f32>,base:u32)->vec2<f32>{let m=params.values[base];let t=params.values[base+1u];return vec2<f32>(m.x*point.x+m.z*point.y,m.y*point.x+m.w*point.y)+t.xy;}
fn inside(point:vec2<f32>,base:u32)->bool{let p=localPoint(point,base)-params.values[base+1u].zw;return all(p>=vec2<f32>(0.0))&&all(p<params.values[base+2u].xy);}
@vertex fn vertexMain(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));return vec4<f32>(p[index],0.0,1.0);}
@fragment fn fragmentMain(@builtin(position) position:vec4<f32>)->@location(0) vec4<f32>{
 let at=vec2<i32>(position.xy);let size=vec2<i32>(textureDimensions(sourceTexture));
`+(mode==='composite'?`
 for(var i=0u;i<8u;i++){if(i>=u32(params.values[0].z)){break;}if(!inside(position.xy,4u+i*3u)){return vec4<f32>(0.0);}}
 var alpha=1.0;
 if(params.values[0].w>0.5){if(!inside(position.xy,1u)){return vec4<f32>(0.0);}let uv=(localPoint(position.xy,1u)-params.values[2].zw)/params.values[3].xy;alpha=textureLoad(maskTexture,vec2<i32>(floor(uv*vec2<f32>(textureDimensions(maskTexture)))),0).a;}
 return textureLoad(sourceTexture,at,0)*alpha;
`:`
 var sum=vec4<f32>(0.0);let radius=i32(params.values[0].x);
 for(var i=-16;i<=16;i++){if(abs(i)>radius){continue;}let p=at+`+(mode==='horizontal'?'vec2<i32>(i,0)':'vec2<i32>(0,i)')+`;if(all(p>=vec2<i32>(0))&&all(p<size)){sum+=textureLoad(sourceTexture,p,0);}}
 return sum/f32(2*radius+1);
`)+`}`});
  const target:GPUColorTargetState={format:'rgba8unorm-srgb',writeMask:15};
  if(mode==='composite')target.blend={color:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'}};
  return pipeline({layout:'auto',vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets:[target]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode:'none'},multisample:{count:1,alphaToCoverageEnabled:false}});
}
