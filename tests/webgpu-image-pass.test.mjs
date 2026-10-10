import test from 'node:test';
import assert from 'node:assert/strict';

let createWebGPUImagePipeline,encodeWebGPUImage,moduleFault;
try{({createWebGPUImagePipeline,encodeWebGPUImage}=await import('../packages/engine/dist/web/webgpuImagePass.js'));}catch(error){moduleFault=error;}
function imagePass(name,body){test(name,async()=>{
 if(moduleFault)assert.equal(moduleFault.code,'ERR_MODULE_NOT_FOUND','red must be the absent Task2 module');
 assert.equal(typeof createWebGPUImagePipeline,'function',`image pipeline required: ${moduleFault}`);
 assert.equal(typeof encodeWebGPUImage,'function',`image encoder required: ${moduleFault}`);
 await body();
});}
function recordedPass(calls){return Object.fromEntries(['setPipeline','setViewport','setScissorRect','setVertexBuffer','setBindGroup','draw'].map(key=>[key,(...args)=>calls.push([key,...args])]));}

// Mock descriptor/WGSL policy only; real shader validation and sampled pixels belong to later gates.
imagePass('image_pipeline_has_16B_layout_and_single_opacity',async()=>{
 for(const format of ['rgba8unorm','bgra8unorm']){
  const module={},expectedPipeline={},calls=[];let shaderDescriptor,descriptor;
  const pipelinePromise=Promise.resolve(expectedPipeline);
  const promise=createWebGPUImagePipeline(d=>{calls.push('shader');shaderDescriptor=d;return module;},d=>{calls.push('pipeline');descriptor=d;return pipelinePromise;},format);
  assert.equal(promise,pipelinePromise);assert.equal(await promise,expectedPipeline);assert.deepEqual(calls,['shader','pipeline']);
  assert.deepEqual(descriptor,{layout:'auto',vertex:{module,entryPoint:'vertexMain',buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:'float32x2'},{shaderLocation:1,offset:8,format:'float32x2'}]}]},fragment:{module,entryPoint:'fragmentMain',targets:[{format,blend:{color:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'}},writeMask:15}]},primitive:{topology:'triangle-list',cullMode:'none'},multisample:{count:1,alphaToCoverageEnabled:false}});
  const code=shaderDescriptor.code;
  assert.match(code,/@group\(0\)\s*@binding\(0\)\s*var\s+image\s*:\s*texture_2d<f32>/);
  assert.match(code,/@group\(0\)\s*@binding\(1\)\s*var\s+imageSampler\s*:\s*sampler/);
  assert.match(code,/@group\(0\)\s*@binding\(2\)\s*var<uniform>\s+draw\s*:\s*DrawUniform/);
  const uniform=code.match(/struct\s+DrawUniform\s*\{([^}]+)\}/)?.[1];assert.ok(uniform);
  assert.equal((uniform.match(/:\s*f32/g)??[]).length,4);assert.match(uniform,/opacity\s*:\s*f32/);
  assert.match(code,/position\s*=\s*vec4<f32>\(position,\s*0\.0,\s*1\.0\)/);
  assert.match(code,/out\.uv\s*=\s*uv/);assert.doesNotMatch(code,/@interpolate\(flat\)/);
  assert.match(code,/textureSampleLevel\(image,\s*imageSampler,\s*input\.uv,\s*0\.0\)\s*\*\s*draw\.opacity/);
  assert.equal((code.match(/draw\.opacity/g)??[]).length,1);assert.equal((code.match(/textureSampleLevel\(/g)??[]).length,1);
  assert.doesNotMatch(code,/\b(?:pow|clamp|textureSample|textureLoad)\s*\(/);
 }
});

// A shared view's two draws must consume their supplied distinct binding groups in painter order.
imagePass('image_encoder_uses_supplied_bindings_in_order',()=>{
 const calls=[],pass=recordedPass(calls),pipeline={},vertices={},view={};
 const quarter={view,uniform:new Float32Array([.25,0,0,0])},threeQuarters={view,uniform:new Float32Array([.75,0,0,0])};
 assert.equal(quarter.uniform.byteLength,16);assert.equal(threeQuarters.uniform.byteLength,16);
 encodeWebGPUImage(pass,pipeline,vertices,quarter,6,16,8);
 encodeWebGPUImage(pass,pipeline,vertices,threeQuarters,6,16,8);
 const expected=bindings=>[['setPipeline',pipeline],['setViewport',0,0,16,8,0,1],['setScissorRect',0,0,16,8],['setVertexBuffer',0,vertices],['setBindGroup',0,bindings],['draw',6,1,0,0]];
 assert.deepEqual(calls,[...expected(quarter),...expected(threeQuarters)]);
 assert.notEqual(calls[4][2],calls[10][2]);
});

imagePass('image_pipeline_preserves_captured_method_failures',async()=>{
 const shaderFault=Error('shader fault'),pipelineFault=Error('pipeline fault');let pipelineCalls=0;
 assert.throws(()=>createWebGPUImagePipeline(()=>{throw shaderFault;},()=>{pipelineCalls++;return Promise.resolve({});},'rgba8unorm'),e=>e===shaderFault);
 assert.equal(pipelineCalls,0);
 await assert.rejects(createWebGPUImagePipeline(()=>({}),()=>Promise.reject(pipelineFault),'rgba8unorm'),e=>e===pipelineFault);
});

imagePass('image_encoder_propagates_pass_failure',()=>{
 const calls=[],pass=recordedPass(calls),sentinel=Error('binding fault');
 pass.setBindGroup=(...args)=>{calls.push(['setBindGroup',...args]);throw sentinel;};
 assert.throws(()=>encodeWebGPUImage(pass,'pipeline','vertices','bindings',6,16,16),e=>e===sentinel);
 assert.deepEqual(calls.map(c=>c[0]),['setPipeline','setViewport','setScissorRect','setVertexBuffer','setBindGroup']);
});

imagePass('empty_image_encoding_performs_no_pass_calls',()=>{
 const calls=[],pass=recordedPass(calls);
 encodeWebGPUImage(pass,'pipeline','vertices','bindings',0,16,16);
 assert.deepEqual(calls,[]);
 const inaccessible=new Proxy({},{get(){throw Error('empty image must not read a pass method');}});
 assert.equal(encodeWebGPUImage(inaccessible,'pipeline','vertices','bindings',0,16,16),undefined);
});
