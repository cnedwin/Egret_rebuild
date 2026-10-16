// SPDX-License-Identifier: Apache-2.0
// Public controlled-port and literal-source checks only; no browser, PNG or font acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine,createEngineForProfile,Sprite,TEXTURED_FRAME_PROFILE_2D} from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';

const root=fileURLToPath(new URL('../',import.meta.url));
const example='examples/resource-scene/';
const read=key=>readFileSync(path.join(root,key),'utf8');
// Fixed public bindings come from the selected contract, never from the candidate's discovered imports.
const expectedMap=Object.freeze({
  '@egret/engine':'../../packages/engine/dist/index.js',
  '@egret/engine/web':'../../packages/engine/dist/web/index.js',
  '@egret/engine/text':'../../packages/engine/dist/text.js',
  '@egret/engine/web/text':'../../packages/engine/dist/web/text.js',
  '@egret/engine/web/image':'../../packages/engine/dist/web/image.js',
  '@egret/engine/web/input':'../../packages/engine/dist/web/input.js',
  '@egret/engine/scene3d':'../../packages/engine/dist/rendering/scene3d.js',
  '@egret/engine/webgpu/scene3d':'../../packages/engine/dist/web/scene3d.js',
  '@egret/runtime':'../../packages/runtime/dist/index.js',
  '@egret/runtime/text':'../../packages/runtime/dist/text/index.js',
  '@egret/contracts':'../../packages/contracts/dist/index.js',
  '#egret-mouse-input':'../../packages/engine/dist/mouseInput.js',
  '#egret-textured-frame-state':'../../packages/engine/dist/internal/texturedFrameState.js',
  'robust-predicates':'../../packages/engine/node_modules/robust-predicates/index.js',
});
const publicEntries=new Set(['@egret/engine','@egret/engine/web','@egret/engine/text',
  '@egret/engine/web/text','@egret/engine/web/image','@egret/engine/web/input',
  '@egret/engine/scene3d','@egret/engine/webgpu/scene3d']);
const gpuEntries=new Set(['@egret/engine/scene3d','@egret/engine/webgpu/scene3d']);

function originalMap(html){
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match=>/\btype\s*=\s*(['"])importmap\1/i.test(match[1]));
  assert.equal(scripts.length,1,'one original authored import map');
  assert.doesNotMatch(scripts[0][1],/\bsrc\s*=/i,'the map itself is inline');
  return JSON.parse(scripts[0][2]);
}
function exactMap(value){
  assert.deepEqual(Object.keys(value),['imports'],'no scopes or additional import-map authority');
  assert.deepEqual(value.imports,expectedMap,'all fourteen exact original aliases');
}
function canvasPort(){
  const draws=[],contexts=[];
  const context={isContextLost:()=>false,setTransform(){},clearRect(){},save(){},restore(){},
    beginPath(){},closePath(){},rect(){},clip(){},
    fillRect(x,y,width,height){draws.push({x,y,width,height,style:this.fillStyle});}};
  const canvas={width:0,height:0,getContext(kind){contexts.push(kind);return context;}};
  return {canvas,draws,contexts};
}

// This bounded reader covers literal ESM forms used by these example files.
// It does not prove arbitrary JavaScript control flow or conditional-import reachability.
function imports(source){
  const result=[];
  for(const expression of [/^\s*import\s+(?:(?!['"])[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*export\s+(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s+from\s+['"]([^'"]+)['"]/gm]){
    for(const match of source.matchAll(expression))result.push({specifier:match[1],dynamic:false});
  }
  for(const match of source.matchAll(/\bimport\s*\(([^)]*)\)/g)){
    const literal=/^\s*(['"])([^'"]+)\1\s*$/.exec(match[1]);
    assert.ok(literal,'selected source projection requires literal dynamic imports');
    result.push({specifier:literal[2],dynamic:true});
  }
  return result;
}
function publicExampleEdges(){
  const visited=new Set();
  function visit(key,canvasStatic){
    const identity=key+'|'+canvasStatic;if(visited.has(identity))return;visited.add(identity);
    assert.ok(key.startsWith(example)&&!key.includes('\\'),'example modules stay inside their own logical subtree');
    assert.match(key,/\.(?:mjs|js)$/);
    for(const edge of imports(read(key))){
      const specifier=edge.specifier;
      if(specifier.startsWith('.')){
        const target=path.posix.normalize(path.posix.join(path.posix.dirname(key),specifier));
        assert.ok(target.startsWith(example),'no relative private SDK/package escape');
        if(canvasStatic&&!edge.dynamic)assert.notEqual(path.posix.basename(target),'gpu-scene.mjs','GPU recipe must not be a static Canvas dependency');
        visit(target,canvasStatic&&!edge.dynamic);
      }else{
        assert.ok(publicEntries.has(specifier),'only the selected public Engine entries: '+specifier);
        if(canvasStatic&&!edge.dynamic)assert.ok(!gpuEntries.has(specifier),'ordinary Canvas source has no static 3D entry');
      }
    }
  }
  visit(example+'main.mjs',true);
}

test('P02 browser composition has genuine public prerequisites and finite source boundaries',async t=>{
  await t.test('healthy actual Engine and CanvasHost compose through a controlled public Canvas port',async()=>{
    const port=canvasPort(),host=createCanvasHost({canvas:port.canvas,pixelRatio:1}),diagnostics=[];
    const engine=await createEngine({host,onDiagnostic:value=>{diagnostics.push(value);}});
    try{
      const sprite=new Sprite();sprite.graphics.beginFill(0xff0000);sprite.graphics.drawRect(0,0,2,2);sprite.graphics.endFill();
      engine.stage.addChild(sprite);engine.renderFrame({width:192,height:128,clearColor:0,clearAlpha:1});
      assert.deepEqual(port.contexts,['2d']);assert.equal(port.canvas.width,192);assert.equal(port.canvas.height,128);
      assert.ok(port.draws.some(row=>row.style==='#ff0000'&&row.x===0&&row.y===0&&row.width===2&&row.height===2));
    }finally{await engine.dispose();}
    assert.deepEqual(diagnostics,[]);
    assert.throws(()=>host.start(),error=>error.code==='CANVAS_HOST_CLOSED');
  });
  await t.test('a fresh genuine CanvasHost rejects the textured Engine profile before starting',async()=>{
    const port=canvasPort(),host=createCanvasHost({canvas:port.canvas});
    try{
      await assert.rejects(createEngineForProfile({host},TEXTURED_FRAME_PROFILE_2D),error=>error.code==='ENGINE_RENDER_PROFILE_UNSUPPORTED');
      assert.deepEqual(port.contexts,[]);
    }finally{await host.close();}
  });
  await t.test('the original authored map is exact and its runtime-text/scopes/wildcard controls reject',()=>{
    const baseline=originalMap(read(example+'index.html'));exactMap(baseline);
    for(const change of [value=>{delete value.imports['@egret/runtime/text'];},
      value=>{value.scopes={'/':{'@egret/engine':'./other.mjs'}};},
      value=>{value.imports['@egret/engine/']='../../packages/engine/dist/';}]){
      exactMap(originalMap(read(example+'index.html')));
      const bad=structuredClone(baseline);change(bad);assert.throws(()=>exactMap(bad),{code:'ERR_ASSERTION'});
    }
  });
  await t.test('browser main exists and its literal imports preserve the public/static Canvas boundary',()=>{
    assert.ok(existsSync(path.join(root,example+'main.mjs')),'RS_MAIN_REQUIRED: the real browser composition main.mjs is missing');
    publicExampleEdges();
    assert.deepEqual(JSON.parse(read('packages/engine/package.json')).dependencies,
      {'@egret/contracts':'workspace:*','@egret/runtime':'workspace:*','robust-predicates':'3.0.3'});
    assert.deepEqual(JSON.parse(read('packages/runtime/package.json')).dependencies,{'@egret/contracts':'workspace:*'});
  });
});
