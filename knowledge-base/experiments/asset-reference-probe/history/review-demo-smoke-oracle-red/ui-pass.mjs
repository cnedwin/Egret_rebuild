export function createUIPass(gl,canvas,{fontEpoch=0}={}){
  let program,vao,texture,rectLocation,colorLocation,modeLocation,sizeLocation;
  const pendingShaders=new Set();
  let spec={raw:'白鹭 · 真实资产',font:'20px sans-serif',color:'#ffffff',resolution:1,fontEpoch},key=null;
  let raster=document.createElement('canvas');
  const diagnostics={generations:0,cacheHits:0,raw:spec.raw,fontEpoch,disposed:false,rasterCanvas:raster};
  function shader(type,source){const s=gl.createShader(type);if(!s)throw new Error('UI shader allocation failed');pendingShaders.add(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function deleteShaders(){for(const s of pendingShaders)gl.deleteShader(s);pendingShaders.clear();}
  function deleteGPUResources(){deleteShaders();if(texture)gl.deleteTexture(texture);if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);texture=null;vao=null;program=null;}
  function init(){
    const vertex=shader(gl.VERTEX_SHADER,`#version 300 es
precision highp float;uniform vec4 rect;uniform vec2 size;out vec2 uv;
const vec2 points[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
void main(){uv=points[gl_VertexID];vec2 p=rect.xy+uv*rect.zw;gl_Position=vec4(p.x/size.x*2.-1.,1.-p.y/size.y*2.,0.,1.);}`);
    const fragment=shader(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D image;uniform vec4 color;uniform int textured;out vec4 outColor;
void main(){outColor=textured==1?texture(image,uv):vec4(color.rgb*color.a,color.a);}`);
    program=gl.createProgram();if(!program)throw new Error('UI program allocation failed');gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);deleteShaders();if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    vao=gl.createVertexArray();texture=gl.createTexture();if(!vao||!texture)throw new Error('UI allocation failed');rectLocation=gl.getUniformLocation(program,'rect');colorLocation=gl.getUniformLocation(program,'color');modeLocation=gl.getUniformLocation(program,'textured');sizeLocation=gl.getUniformLocation(program,'size');key=null;
  }
  function setText(raw,style={}){
    if(diagnostics.disposed)throw new Error('UI pass disposed');if(typeof raw!=='string')throw new Error('Raw text must be a string');
    const next={...spec,...style,raw};if(!Number.isFinite(next.resolution)||next.resolution<=0)throw new Error('Resolution must be positive');
    const nextKey=JSON.stringify([raw,next.font,next.color,next.resolution,next.fontEpoch]);spec=next;diagnostics.raw=raw;diagnostics.fontEpoch=next.fontEpoch;
    if(nextKey===key){diagnostics.cacheHits++;return;}
    raster.width=Math.ceil(200*spec.resolution);raster.height=Math.ceil(64*spec.resolution);const ctx=raster.getContext('2d');ctx.scale(spec.resolution,spec.resolution);ctx.font=spec.font;ctx.fillStyle=spec.color;ctx.measureText(raw);ctx.fillText(raw,8,40);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);
    // Canvas upload and shader/blend use premultiplied alpha; no implicit Y flip.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.BROWSER_DEFAULT_WEBGL);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,raster);key=nextKey;diagnostics.generations++;
  }
  function draw(){
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindVertexArray(vao);gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.SCISSOR_TEST);gl.scissor(8,canvas.height-72,200,64);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.disable(gl.STENCIL_TEST);gl.disable(gl.POLYGON_OFFSET_FILL);gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.disable(gl.SAMPLE_COVERAGE);gl.disable(gl.RASTERIZER_DISCARD);gl.colorMask(true,true,true,true);
    gl.enable(gl.BLEND);gl.blendEquationSeparate(gl.FUNC_ADD,gl.FUNC_ADD);gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindSampler(0,null);gl.uniform1i(gl.getUniformLocation(program,'image'),0);gl.uniform2f(sizeLocation,canvas.width,canvas.height);gl.uniform4f(rectLocation,8,8,200,64);gl.uniform4f(colorLocation,.08,.25,.38,.9);gl.uniform1i(modeLocation,0);gl.drawArrays(gl.TRIANGLES,0,6);gl.uniform1i(modeLocation,1);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function restore(){if(diagnostics.disposed)return;
    // Handles from the lost context are invalid; discard, then own only new ones.
    program=null;vao=null;texture=null;pendingShaders.clear();
    try {init();setText(spec.raw,spec);} catch(error){try{deleteGPUResources();}catch{}throw error;}
  }
  function dispose(){if(diagnostics.disposed)return;deleteGPUResources();raster.width=0;raster.height=0;raster=null;diagnostics.rasterCanvas=null;key=null;diagnostics.disposed=true;}
  try {init();setText(spec.raw,spec);} catch(error){try{dispose();}catch{}throw error;}
  return {setText,draw,restore,dispose,diagnostics};
}
