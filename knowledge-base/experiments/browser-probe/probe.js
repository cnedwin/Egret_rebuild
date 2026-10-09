const results = [];
const labels = { passed: '通过', failed: '未通过', unsupported: '不可用', inconclusive: '未能确认' };
const assert = (condition, detail) => { if (!condition) throw new Error(detail); };
async function check(name, fn) {
  try { results.push({ name, status: 'passed', observations: await fn() ?? {} }); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); }
}
const pixelNear = (pixel, wanted) => wanted.every((v, i) => Math.abs(pixel[i] - v) <= 2);
const environment = { userAgent: navigator.userAgent, secureContext: isSecureContext, crossOriginIsolated,
  sharedArrayBufferPresent: typeof SharedArrayBuffer === 'function', webgpuInterfacePresent: Boolean(navigator.gpu) };
const { runId } = await (await fetch('/meta')).json();
const canvas = document.querySelector('#gl');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
if (!gl) results.push({ name: 'WebGL2上下文', status: 'unsupported', observations: { context: null } });
else {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  environment.webglVersion = gl.getParameter(gl.VERSION);
  environment.webglRenderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
  environment.webglVendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : 'unavailable';
  environment.hardwareClassification = /swiftshader|llvmpipe|software|warp/i.test(environment.webglRenderer) ? 'software_renderer_indicated' : 'renderer_string_not_hardware_certification';
  results.push({ name: 'WebGL2上下文', status: 'passed', observations: { version: environment.webglVersion } });
  function render(reverse = false) {
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader)); return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; uniform float z; void main(){gl_Position=vec4(p,z,1.0);}');
    const fs = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; uniform vec4 c; out vec4 o; void main(){o=c;}');
    const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program)); gl.useProgram(program);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 32, 32);
    const depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 32, 32);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    assert(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE, 'Framebuffer incomplete');
    gl.viewport(0,0,32,32); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.clearColor(0,0,0,1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const c = gl.getUniformLocation(program, 'c'); const z = gl.getUniformLocation(program, 'z');
    const draw = (color, position) => { gl.uniform4fv(c, color); gl.uniform1f(z, position); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    draw([.1,.2,.8,1], .2); draw([1,0,0,1], .8); // Far opaque red must be occluded by blue.
    const read = (x,y) => { const pixel = new Uint8Array(4); gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel); return [...pixel]; };
    const opaque = read(16,16);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(8,8,16,16);
    for (const color of reverse ? [[0,1,0,.5],[1,0,0,.5]] : [[1,0,0,.5],[0,1,0,.5]]) draw(color,0);
    const center = read(16,16); const outside = read(4,4); const error = gl.getError();
    // Copy the FBO pixels into the visible canvas for inspection.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null); gl.disable(gl.SCISSOR_TEST);
    gl.blitFramebuffer(0,0,32,32,0,0,32,32,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.depthMask(true); gl.deleteFramebuffer(fbo); gl.deleteRenderbuffer(depth); gl.deleteTexture(texture);
    gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    assert(error === gl.NO_ERROR, `GL error ${error}`); return { opaque, center, outside };
  }
  let baseline;
  await check('深度测试保留近处不透明图元', () => { baseline = render(); assert(pixelNear(baseline.opaque,[26,51,204,255]), 'Unexpected depth result'); return baseline.opaque; });
  await check('透明UI按顺序叠加的像素', () => { assert(baseline && pixelNear(baseline.center,[70,140,51,255]), 'Unexpected transparent composition'); return baseline.center; });
  await check('矩形裁剪不影响范围外像素', () => { assert(baseline && pixelNear(baseline.outside,[26,51,204,255]), 'Scissor leaked'); return baseline.outside; });
  await check('交换透明绘制顺序得到可检测反例', () => {
    const reversed = render(true); assert(baseline && reversed.center.some((v,i) => i < 3 && Math.abs(v-baseline.center[i]) > 20), 'Order error was not detected');
    return { original: baseline.center, reversed: reversed.center };
  });
  const loss = gl.getExtension('WEBGL_lose_context');
  if (!loss) results.push({ name: '上下文丢失后重建图形资源', status: 'unsupported', observations: { extension: false } });
  else await check('上下文丢失后重建图形资源', async () => {
    function eventOnce(name) { return new Promise((resolve,reject) => {
      const listener = event => { event.preventDefault(); clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { canvas.removeEventListener(name,listener); reject(new Error(`${name} timed out`)); },8000);
      canvas.addEventListener(name,listener,{once:true});
    }); }
    const lost = eventOnce('webglcontextlost'); loss.loseContext(); await lost;
    // Promise continuations may resume during event dispatch; wait for a later task
    // so the browser can commit whether restoration was allowed by preventDefault.
    await new Promise(resolve => setTimeout(resolve,0));
    const restored = eventOnce('webglcontextrestored'); loss.restoreContext(); await restored;
    const rebuilt = render(); assert(pixelNear(rebuilt.center,[70,140,51,255]), 'Restored pixels differ'); return rebuilt.center;
  });
}
if (!navigator.gpu) results.push({ name: 'WebGPU设备与清屏读回', status: 'unsupported', observations: { interface: false } });
else {
  let adapter;
  try { adapter = await navigator.gpu.requestAdapter(); }
  catch (error) { results.push({ name: 'WebGPU适配器', status: 'inconclusive', error: error.message }); }
  if (!adapter) results.push({ name: 'WebGPU设备与清屏读回', status: 'unsupported', observations: { adapter: null, interface: true } });
  else await check('WebGPU设备与清屏读回', async () => {
    const device = await adapter.requestDevice(); device.pushErrorScope('validation');
    const texture = device.createTexture({ size:[1,1,1],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC });
    const buffer = device.createBuffer({ size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST });
    const encoder = device.createCommandEncoder(); const pass = encoder.beginRenderPass({ colorAttachments:[{view:texture.createView(),clearValue:{r:.25,g:.5,b:.75,a:1},loadOp:'clear',storeOp:'store'}] });
    pass.end(); encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow:256},[1,1,1]); device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ); const pixel = [...new Uint8Array(buffer.getMappedRange()).slice(0,4)]; buffer.unmap();
    const validation = await device.popErrorScope(); texture.destroy(); buffer.destroy(); device.destroy();
    assert(!validation, validation?.message); assert(pixelNear(pixel,[64,128,191,255]), 'WebGPU pixels differ'); return { pixel, hardware: 'not_certified' };
  });
}
const counts = Object.fromEntries(Object.keys(labels).map(status => [status,results.filter(r => r.status === status).length]));
const report = { schemaVersion:1,experiment:'browser_graphics_probe',runId,checkedAtUtc:new Date().toISOString(),environment,counts,results,
  limitations:['One local desktop browser session only.','API and pixel observations do not certify hardware acceleration, mobile, mini-game hosts, real scenes or production support.','No frame-time, power, package-size, text/skeleton or old-project migration acceptance.'] };
for (const row of results) {
  const tr = document.createElement('tr');
  for (const value of [row.name,labels[row.status],JSON.stringify(row.observations ?? row.error)]) { const td=document.createElement('td');td.textContent=value;tr.appendChild(td); }
  document.querySelector('#results').appendChild(tr);
}
document.querySelector('#environment').textContent = JSON.stringify({environment,limitations:report.limitations},null,2);
const saved = await (await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)})).json();
document.querySelector('#state').textContent = `检查完成：通过 ${counts.passed}，未通过 ${counts.failed}，不可用 ${counts.unsupported}，未能确认 ${counts.inconclusive}；结果${saved.saved?'已保存':'未保存'}`;
