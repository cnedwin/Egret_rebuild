// SPDX-License-Identifier: Apache-2.0
// Capture actual browser composition, not just successful GL readback: mobile WebKit
// can stop showing an otherwise live GL canvas when its backing dimensions change.
// The fixture uses only public SDK entrypoints and procedural geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const [playwright, output, backend = 'webkit'] = process.argv.slice(2);
if (!playwright || !path.isAbsolute(playwright) || !output || !['webkit', 'chromium'].includes(backend))
  throw Error('Usage: node tests/world3d-presentation-resize-browser.mjs <absolute Playwright index.mjs> <output directory> [webkit|chromium]');
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.resolve(output);
fs.mkdirSync(out, { recursive: true });
const example = fs.readFileSync(path.join(root, 'examples/world3d/overlay.html'), 'utf8');
const imports = JSON.parse(example.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;overflow:hidden;background:rgb(19,71,90)}canvas{display:block;width:100vw;height:100vh}</style><script type="importmap">' + JSON.stringify(imports) + '</script><canvas id="scene"></canvas><script type="module">' + String.raw`
import { Mesh3D, RenderTarget3D, Scene3D, createBoxGeometry3D, createPerspectiveCamera3D, createUnlitMaterial3D } from '@egret/engine/world3d';
import {createWebGL2Renderer3D,createWorld3DApp} from '@egret/engine/webgl2/world3d';
const canvas=document.querySelector('canvas');
const params=new URLSearchParams(location.search);
const mode=params.get('mode');
const transparent=params.has('alpha');
const scene=new Scene3D();
if(!transparent) scene.background=[0.09,0.3,0.1];
const material=createUnlitMaterial3D({color:[0.86,0.11,0.045]});
const mesh=new Mesh3D(createBoxGeometry3D({width:2,height:2,depth:1}),material);
scene.addChild(mesh);
const camera=createPerspectiveCamera3D({fov:50,aspect:1,near:0.1,far:100});
camera.setPosition(0,0,5);
let renderer, app, raf=0, painted=0, readback=null, disposed=false, tickDelta=0;
const snapshot=()=>{
  const gl=renderer.context,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const pixel=(x,y)=>{const data=new Uint8Array(4);gl.readPixels(Math.floor((w-1)*x),Math.floor((h-1)*(1-y)),1,1,gl.RGBA,gl.UNSIGNED_BYTE,data);return Array.from(data)};
  const size=renderer.renderSize??canvas;
  return {canvas:[canvas.width,canvas.height],render:[size.width,size.height],css:[canvas.clientWidth,canvas.clientHeight],
    aspect:camera.aspect,center:pixel(.5,.5),corner:pixel(.08,.08),glError:gl.getError(),draws:renderer.info.drawCalls,
    scale:app?.resolutionScale,tickDelta,quality:app?.quality,policy:renderer.presentationResize,painted:++painted};
};
if(mode==='auto'){
  // Deliberately high test thresholds trigger real adaptive resizing even in fast headless hosts.
  app=await createWorld3DApp(canvas,{quality:'low',dynamicResolution:{min:.6,max:1,step:.2,lowFps:10000,highFps:10001,downAfter:.2,upAfter:1}});
  renderer=app.renderer;
  app.show(scene,camera,{onFrameTiming:sample=>{tickDelta=sample.deltaSeconds;readback=snapshot()}});
}else{
  renderer=createWebGL2Renderer3D({canvas,presentationResize:mode,alpha:transparent,antialias:false,shadows:false,preserveDrawingBuffer:true});
  renderer.setSize(393,659);
  function frame(){
    if(disposed) return;
    const size=renderer.renderSize??canvas;
    camera.aspect=size.width/size.height;
    if(renderer.render(scene,camera))readback=snapshot();
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
}
window.fixture={
  get:()=>readback,
  quality:value=>app.setQuality(value),
  resize:(w,h)=>renderer.setSize(w,h),
  fit:ratio=>renderer.resizeToDisplaySize(ratio),
  post:enabled=>{Object.assign(renderer.postProcess,{enabled,bloom:false,ssao:false,dof:false,fxaa:false,brightness:1.15,saturation:0.85,contrast:1.1})},
  offscreen:()=>{
    const target=new RenderTarget3D(32,32);
    const old=renderer.renderSize;
    try{const ok=renderer.render(scene,camera,target);return {ok,same:JSON.stringify(renderer.renderSize)===JSON.stringify(old)}}
    finally{target.dispose()}
  },
  stop:()=>{disposed=true;cancelAnimationFrame(raf);app?.dispose();if(!app)renderer.dispose()}
};
` + '</script>';
const mime = {'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'};
const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/') {
      res.writeHead(200, {'Content-Type':'text/html'}); res.end(html); return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(u.pathname));
    if (!file.startsWith(path.resolve(root) + path.sep)) throw Error('outside root');
    const data = fs.readFileSync(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] ?? 'application/octet-stream'}); res.end(data);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const pw = await import(pathToFileURL(playwright).href);
const browser = await pw[backend].launch(backend === 'chromium'
  ? { ...(process.env.EGRET_BROWSER_CHANNEL ? { channel: process.env.EGRET_BROWSER_CHANNEL } : {}),
      args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] }
  : {});
const errors = [], cases = [];
try {
  const context = await browser.newContext({...(backend==='webkit'?pw.devices['iPhone 15 Pro']:{}), viewport:{width:393,height:659}, deviceScaleFactor:1});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => {if(msg.type()==='error') errors.push(msg.text())});
  page.on('response', r => {if(r.status()>=400) errors.push(r.status()+' '+r.url())});
  const url = 'http://127.0.0.1:' + server.address().port;
  const open = async (mode, alpha=false) => {
    await page.setViewportSize({width:393,height:659});
    await page.goto(url+'/?mode='+mode+(alpha?'&alpha':''));
    await page.waitForFunction(()=>window.fixture?.get()?.painted>=2,null,{timeout:30000});
  };
  const sample = async (name, after=()=>true) => {
    await page.waitForFunction(after,null,{timeout:15000});
    await page.waitForTimeout(150);
    const readback=await page.evaluate(()=>fixture.get());
    const png=PNG.sync.read(await page.screenshot({path:path.join(out,name+'.png'),scale:'css'}));
    const pixel=(x,y)=>Array.from(png.data.subarray((Math.floor((png.height-1)*y)*png.width+Math.floor((png.width-1)*x))*4,(Math.floor((png.height-1)*y)*png.width+Math.floor((png.width-1)*x))*4+4));
    const result={name,...readback,screenCenter:pixel(.5,.5),screenCorner:pixel(.08,.08)};
    cases.push(result);
    return result;
  };
  const near = (actual, expected, tolerance=5) => {
    assert.ok(actual.slice(0,3).every((v,i)=>Math.abs(v-expected[i])<=tolerance),JSON.stringify({actual,expected,tolerance}));
  };
  const visible = (entry, alpha=false) => {
    assert.equal(entry.glError,0,entry.name);
    near(entry.screenCenter,entry.center);
    if(alpha) {
      assert.equal(entry.corner[3],0);
      near(entry.screenCorner,[19,71,90,255]);
    } else near(entry.screenCorner,entry.corner);
    assert.ok(entry.center[0]>entry.center[1]*1.5,'red box drawn at center');
    assert.ok(Math.abs(entry.aspect-entry.render[0]/entry.render[1])<0.001,entry.name);
  };
  await open('direct');
  const directBefore=await sample('direct-initial');
  visible(directBefore);
  await page.evaluate(()=>fixture.resize(235,395));
  const directAfter=await sample('direct-shrink',()=>fixture.get().render[0]===235);
  assert.equal(directAfter.glError,0);
  assert.deepEqual(directAfter.canvas,[235,395]);
  near(directAfter.center,directBefore.center);
  // Direct composition may already be fixed in some browser versions; report rather
  // than require a browser bug to stay present. Stable mode must pass in every host.
  const directResizeVisible=directAfter.screenCenter.slice(0,3).every((v,i)=>Math.abs(v-directAfter.center[i])<=5);
  if(process.env.EGRET_EXPECT_WEBKIT_RESIZE_BLANK==='1')assert.equal(directResizeVisible,false);
  await page.evaluate(()=>fixture.stop());

  await open('stable');
  const initial=await sample('stable-initial');visible(initial);
  await page.evaluate(()=>fixture.resize(235,395));
  const shrink=await sample('stable-shrink',()=>fixture.get().render[0]===235);visible(shrink);
  assert.deepEqual(shrink.canvas,initial.canvas);near(shrink.center,initial.center);near(shrink.corner,initial.corner);
  assert.equal(shrink.draws,initial.draws+1);
  await page.evaluate(()=>fixture.resize(315,528));
  const recover=await sample('stable-recover',()=>fixture.get().render[0]===315);visible(recover);
  assert.deepEqual(recover.canvas,initial.canvas);
  assert.deepEqual(await page.evaluate(()=>fixture.offscreen()),{ok:true,same:true});
  await page.evaluate(()=>fixture.resize(393,659));
  const full=await sample('stable-full',()=>fixture.get().render[0]===393);visible(full);
  assert.equal(full.draws,initial.draws);
  await page.evaluate(()=>fixture.post(true));
  const postFull=await sample('stable-post-full');visible(postFull);
  await page.evaluate(()=>fixture.resize(235,395));
  const postShrink=await sample('stable-post-shrink',()=>fixture.get().render[0]===235);visible(postShrink);
  near(postShrink.center,postFull.center);near(postShrink.corner,postFull.corner);
  await page.setViewportSize({width:659,height:393});
  await page.evaluate(()=>fixture.fit(.6));
  const landscape=await sample('stable-landscape',()=>fixture.get().render[0]===395);visible(landscape);
  assert.deepEqual(landscape.canvas,initial.canvas);assert.ok(landscape.aspect>1);
  await page.setViewportSize({width:393,height:659});
  await page.evaluate(()=>fixture.fit(.6));
  const portrait=await sample('stable-portrait',()=>fixture.get().render[0]===235);visible(portrait);
  assert.deepEqual(portrait.canvas,initial.canvas);assert.ok(portrait.aspect<1);
  await page.evaluate(()=>fixture.stop());

  // Transparent canvas composition exercises the retained alpha, without
  // assuming the post chain has transparent-background semantics.
  await open('stable',true);
  const alpha=await sample('stable-alpha-initial');visible(alpha,true);
  await page.evaluate(()=>fixture.resize(235,395));
  const alphaShrink=await sample('stable-alpha-shrink',()=>fixture.get().render[0]===235);visible(alphaShrink,true);
  near(alphaShrink.center,alpha.center);
  await page.evaluate(()=>fixture.stop());

  await open('auto');
  const auto=await sample('app-auto-adaptive',()=>fixture.get().scale<1);
  visible(auto);
  if(backend==='webkit') {
    assert.equal(auto.policy,'stable');
    assert.ok(auto.canvas[0]>auto.render[0],JSON.stringify(auto));
  } else {
    assert.equal(auto.policy,'direct');
    assert.deepEqual(auto.canvas,auto.render);
  }
  // High-level quality changes must keep the same renderer + adapt the scene.
  await page.evaluate(()=>fixture.quality('medium'));
  const quality=await sample('app-auto-medium',()=>fixture.get().quality==='medium');
  visible(quality);
  await page.setViewportSize({width:659,height:393});
  const appLandscape=await sample('app-auto-landscape',()=>fixture.get().aspect>1);
  visible(appLandscape);
  if(backend==='webkit')assert.deepEqual(appLandscape.canvas,auto.canvas);
  await page.evaluate(()=>fixture.stop());
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({backend,directResizeVisible,cases},null,2));
  await context.close();
} finally {
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({backend,cases,errors},null,2));
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
