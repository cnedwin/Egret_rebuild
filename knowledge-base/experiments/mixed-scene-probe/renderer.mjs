import { buildBatches } from './batch-model.mjs';
// Authored WebGL2 lab. No engine/editor, asset importer or performance claim.
export function createLab(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true, depth: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const W = canvas.width, H = canvas.height, debug = gl.getExtension('WEBGL_debug_renderer_info');
  const environment = { userAgent: navigator.userAgent, version: gl.getParameter(gl.VERSION), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable', hardwareClassification: 'renderer_string_not_hardware_certification', secureContext: isSecureContext, crossOriginIsolated, width: W, height: H };
  function program(vs, fs) {
    const shaders = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map((type, i) => { const s = gl.createShader(type); gl.shaderSource(s, [vs, fs][i]); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; });
    const p = gl.createProgram(); for (const s of shaders) gl.attachShader(p, s); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    for (const s of shaders) gl.deleteShader(s); return p;
  }
  function texture(width, height, pixels) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (pixels instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    else { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }
    return t;
  }
  function resources() {
    const uiProgram = program('#version 300 es\nlayout(location=0) in vec2 p; layout(location=1) in vec2 uv; layout(location=2) in vec4 color; out vec2 t; out vec4 c; void main(){gl_Position=vec4(p,0.,1.);t=uv;c=color;}', '#version 300 es\nprecision highp float; in vec2 t; in vec4 c; uniform sampler2D atlas; out vec4 o; void main(){o=texture(atlas,t)*c;}');
    const uiVAO = gl.createVertexArray(), uiBuffer = gl.createBuffer(); gl.bindVertexArray(uiVAO); gl.bindBuffer(gl.ARRAY_BUFFER, uiBuffer);
    for (const [location, count, offset] of [[0, 2, 0], [1, 2, 8], [2, 4, 16]]) { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, count, gl.FLOAT, false, 32, offset); }
    const meshProgram = program('#version 300 es\nlayout(location=0) in vec3 p; layout(location=1) in vec3 color; uniform float angle; uniform float aspect; out vec3 c; void main(){float s=sin(angle),co=cos(angle);vec3 q=vec3(co*p.x+s*p.z,p.y,-s*p.x+co*p.z)+vec3(0.,.05,-3.);float f=1.7320508;gl_Position=vec4(q.x*f/aspect,q.y*f,-1.0100503*q.z-.20100503,-q.z);c=color;}', '#version 300 es\nprecision highp float; in vec3 c; out vec4 o; void main(){o=vec4(c,1.);}');
    const meshVAO = gl.createVertexArray(), meshBuffer = gl.createBuffer(); gl.bindVertexArray(meshVAO); gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
    const positions = [[-.6,-.6,.6],[.6,-.6,.6],[.6,.6,.6],[-.6,.6,.6],[-.6,-.6,-.6],[.6,-.6,-.6],[.6,.6,-.6],[-.6,.6,-.6]];
    const faces = [[0,1,2,3],[1,5,6,2],[5,4,7,6],[4,0,3,7],[3,2,6,7],[4,5,1,0]], colors = [[.2,.55,.95],[.1,.3,.7],[.1,.2,.45],[.15,.4,.8],[.35,.7,1],[.1,.25,.55]], data = [];
    faces.forEach((face, i) => { for (const index of [0,1,2,0,2,3]) data.push(...positions[face[index]], ...colors[i]); });
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); for (const [location, offset] of [[0,0],[1,12]]) { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset); }
    const glyph = document.createElement('canvas'); glyph.width = 128; glyph.height = 32; const ctx = glyph.getContext('2d'); ctx.fillStyle = '#d7eaff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('EGRET / UI', 3, 24);
    const textures = { white: texture(1,1,new Uint8Array([255,255,255,255])), sequence: texture(3,1,new Uint8Array([255,40,40,255,40,255,80,255,50,100,255,255])), glyph: texture(128,32,glyph) };
    return { uiProgram, uiVAO, uiBuffer, meshProgram, meshVAO, meshBuffer, textures };
  }
  let gpu = resources();
  function ensure() { if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL state validation error'); }
  function clear(color = [0,0,0,0]) { gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.depthMask(true); gl.clearColor(...color); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); }
  function ui(commands, batches = buildBatches(commands,4096)) {
    gl.useProgram(gpu.uiProgram); gl.bindVertexArray(gpu.uiVAO); gl.bindBuffer(gl.ARRAY_BUFFER,gpu.uiBuffer); gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(gl.getUniformLocation(gpu.uiProgram,'atlas'),0);
    for (const b of batches) {
      gl.bindTexture(gl.TEXTURE_2D,gpu.textures[b.texture]);
      gl.blendFuncSeparate(gl.SRC_ALPHA,b.pipeline === 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      if (b.clip) { gl.enable(gl.SCISSOR_TEST); gl.scissor(b.clip[0],b.clip[1],b.clip[2]-b.clip[0],b.clip[3]-b.clip[1]); } else gl.disable(gl.SCISSOR_TEST);
      const vertices = [];
      for (const c of b.commands) {
        const [l,bt,r,t] = c.rect, points = c.points ?? [[l,bt],[r,bt],[r,t],[l,t]], uv = c.uv ?? [0,0,1,1], uvPoints = [[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]];
        for (const i of [0,1,2,0,2,3]) vertices.push(points[i][0]/W*2-1,points[i][1]/H*2-1,...uvPoints[i],...c.color);
      }
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,vertices.length/8);
    }
    ensure(); return { drawCalls: batches.length, vertices: commands.length*6 };
  }
  function mesh(angle) { gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.useProgram(gpu.meshProgram); gl.bindVertexArray(gpu.meshVAO); gl.uniform1f(gl.getUniformLocation(gpu.meshProgram,'angle'),angle); gl.uniform1f(gl.getUniformLocation(gpu.meshProgram,'aspect'),W/H); gl.drawArrays(gl.TRIANGLES,0,36); ensure(); }
  function bones(time) {
    const root = [94,25], a = .3 + time*.65, end = [root[0]+Math.cos(a)*28,root[1]+Math.sin(a)*28], tipAngle = a-.6-time*.4, tip = [end[0]+Math.cos(tipAngle)*24,end[1]+Math.sin(tipAngle)*24];
    const segment = (start,end,color) => { const dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy),nx=-dy/len*3,ny=dx/len*3; const points=[[start[0]+nx,start[1]+ny],[end[0]+nx,end[1]+ny],[end[0]-nx,end[1]-ny],[start[0]-nx,start[1]-ny]]; return { points, rect:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],color,pipeline:'straight',clip:null,texture:'white' }; };
    ui([segment(root,end,[1,.7,.2,1]),segment(end,tip,[1,.3,.2,1])]);
  }
  function scene(time) {
    clear([.03,.05,.09,1]); mesh(time);
    const r = (rect,color,clip=null,texture='white',uv=[0,0,1,1]) => ({rect,color,clip,texture,uv,pipeline:'straight'});
    const commands=[r([0,164,256,192],[.08,.13,.22,.96]),r([8,8,72,156],[.06,.1,.18,.95]),r([184,8,248,156],[.06,.1,.18,.95]),r([8,168,136,188],[1,1,1,1],null,'glyph')];
    for(let i=0;i<9;i++) commands.push(r([12,138-i*17,68,152-i*17],[.13+i*.018,.23,.36,.9],[12,24,68,152]));
    for(let i=0;i<4;i++) commands.push(r([192,70+i*19,240,85+i*19],[.18,.3+i*.05,.5,.95]));
    commands.push(r([80,168,176,187],[.2,.55,.95,.5]),r([200,16,232,48],[1,1,1,1],null,'sequence',[1/3,0,2/3,1])); ui(commands); bones(time);
  }
  const read = (x,y) => { const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p]; };
  const readAll = () => { const p=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p]; };
  async function restore() {
    const ext=gl.getExtension('WEBGL_lose_context'); if(!ext) throw new Error('Context loss extension unavailable');
    const event = name => new Promise((resolve,reject)=>{ const listener=e=>{e.preventDefault();clearTimeout(timer);resolve();};const timer=setTimeout(()=>{canvas.removeEventListener(name,listener);reject(new Error(name+' timed out'));},8000);canvas.addEventListener(name,listener,{once:true}); });
    const lost=event('webglcontextlost');ext.loseContext();await lost;await new Promise(resolve=>setTimeout(resolve,0));const restored=event('webglcontextrestored');ext.restoreContext();await restored;gpu=resources();
  }
  return { environment,clear,read,readAll,ui,mesh,bones,scene,restore };
}
