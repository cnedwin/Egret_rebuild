// SPDX-License-Identifier: Apache-2.0
// Controlled real-browser two-canvas timing comparison. No screenshots or synchronous readback during samples.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const [playwright]=process.argv.slice(2);
if(!playwright||!path.isAbsolute(playwright))throw Error('Usage: node tests/world3d-overlay-timing-browser.mjs <Playwright index.mjs>');
const root=fileURLToPath(new URL('..',import.meta.url));
const imports=JSON.parse(fs.readFileSync(path.join(root,'examples/world3d/overlay.html'),'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;overflow:hidden}#place{position:fixed;inset:0}canvas{display:block;width:100%;height:100%}</style><script type="importmap">'+JSON.stringify(imports)+'</script><div id="place"><canvas id="scene"></canvas></div><script type="module">'+String.raw`
import { Sprite } from '@egret/engine';
import { createBitmapText } from '@egret/engine/bitmapfont';
import { Mesh3D, Scene3D, createBoxGeometry3D, createDirectionalLight3D, createPerspectiveCamera3D, createStandardMaterial3D } from '@egret/engine/world3d';
import { createWorld3DApp, createWorld3DOverlay } from '@egret/engine/webgl2/world3d';
const canvas=document.querySelector('#scene');
let recording=false, dynamic=false, counter, overlay, step=0;
let rows={world:[],view:[],ui:[]};
const record=(key,s)=>{if(recording)rows[key].push(s)};
const app=await createWorld3DApp(canvas,{quality:'low',backend:'webgl2',dynamicResolution:false,onLoopTiming:s=>record('world',s)});
const scene=new Scene3D(),geometry=createBoxGeometry3D({width:.7,height:.7,depth:.7}),material=createStandardMaterial3D({color:0x4caad8});
const boxes=Array.from({length:80},(_,i)=>{const box=new Mesh3D(geometry,material);box.setPosition((i%10-4.5)*1.05,Math.floor(i/10)%2*.25,(Math.floor(i/10)-3.5)*1.05);scene.addChild(box);return box;});
const sun=createDirectionalLight3D({intensity:2});sun.setPosition(3,6,5);scene.addChild(sun);
const camera=createPerspectiveCamera3D({fov:50});camera.setPosition(2,9,12);camera.lookAt(0,0,0);
app.show(scene,camera,{onFrameTiming:s=>record('view',s),onUpdate:seconds=>{for(const box of boxes)box.rotationY+=seconds;}});
const waitFrames=n=>new Promise(resolve=>{const tick=()=>{if(--n<=0)resolve();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
window.fixture={
  async overlay(){
    overlay=await createWorld3DOverlay(canvas,{width:844,height:390,fit:'expand',pixelRatio:1,renderMode:'on-demand',measureSharedFrames:true,onFrameTiming:s=>record('ui',s),update:()=>{if(dynamic&&counter)counter.text=String(++step%10000).padStart(4,'0');}});
    const game=overlay.game,panel=new Sprite();panel.graphics.beginFill(0x182033,.85).drawRect(0,0,210,54).endFill();game.stage.addChild(panel);
    const glyphs=await game.createGlyphFont({characters:'0123456789',fontSize:34,fontFamilies:['Arial','sans-serif']});
    counter=game.scope.use(createBitmapText({...glyphs,text:'0000'}));counter.display.x=10;counter.display.y=6;panel.addChild(counter.display);
    await waitFrames(15);
  },
  async sample(mode){
    dynamic=mode==='dynamic';await waitFrames(15);
    const before=overlay?.game.host.getSharedFrameTiming?.();
    rows={world:[],view:[],ui:[]};recording=true;
    await new Promise(resolve=>{const collect=()=>{if(rows.world.length>=60&&(!overlay||rows.ui.length>=60))resolve();else requestAnimationFrame(collect)};requestAnimationFrame(collect)});
    recording=false;
    const after=overlay?.game.host.getSharedFrameTiming?.();
    return {mode,rows,host:before&&after?{before:before.totals,after:after.totals}:null,worldInfo:{drawCalls:app.renderer.info.drawCalls,triangles:app.renderer.info.triangles}};
  },
  renderer(){const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)},
  async gpuSample(){
    app.stop();if(overlay)overlay.game.loop.stop();
    const measure=app.renderer.measureFrame(()=>app.renderer.render(scene,camera),{gpuTiming:true});
    await waitFrames(8);app.renderer.pollFrameTimings();
    return measure.passes.map(p=>({kind:p.kind,cpuSubmissionMs:p.cpuSubmissionMs,gpuTime:p.gpuTime}));
  },
  async dispose(){if(overlay)await overlay.dispose();app.dispose();}
};
`+'</script>';
const mime={'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.html':'text/html'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.resolve(root)+path.sep))throw Error('outside root');const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(data)}catch{if(!res.headersSent)res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(playwright).href);
const hardware=process.env.EGRET_BROWSER_HARDWARE==='1';
const browser=await chromium.launch({args:[...(hardware?['--enable-gpu','--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--ignore-gpu-blocklist']});
const p95=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*.95)-1]??0};
try{
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error(e)});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.fixture,undefined,{timeout:30000});
  const renderer=await page.evaluate(()=>fixture.renderer());
  if(hardware)assert.ok(!/swiftshader|software/i.test(renderer),'hardware path may not silently fall back');
  const baseline=await page.evaluate(()=>fixture.sample('3D-only'));
  await page.evaluate(()=>fixture.overlay());
  const retained=await page.evaluate(()=>fixture.sample('static'));
  const changed=await page.evaluate(()=>fixture.sample('dynamic'));
  for(const sample of [baseline,retained,changed]){
    const {world,view,ui}=sample.rows;
    assert.ok(world.length>=60&&view.length===world.length);
    assert.ok(world.every(x=>x.outcome==='advanced')&&view.every(x=>x.outcome==='rendered'));
    assert.ok(world.every((x,i)=>view[i].callbackStartMs>=x.callbackStartMs&&view[i].callbackEndMs<=x.callbackEndMs),'view CPU is contained in 3D clock advance');
    if(sample!==baseline){
      assert.ok(ui.length>=60);
      const raf=new Set(world.map(x=>x.rafTimestampMs));
      assert.ok(ui.filter(x=>raf.has(x.rafTimestampMs)).length>=ui.length-2,'same browser timestamp correlation');
    }
  }
  assert.equal(baseline.rows.ui.length,0);
  assert.ok(retained.rows.ui.every(s=>s.outcome==='retained'&&s.renderMs===0&&s.pendingFrames===undefined),'static UI retained with no host admission');
  assert.ok(changed.rows.ui.some(s=>s.outcome==='submitted'),'dynamic glyph counter produced accepted UI submissions');
  const report=[baseline,retained,changed].map(s=>({
    mode:s.mode,world:s.rows.world.length,ui:s.rows.ui.length,
    rafP95:p95(s.rows.world.slice(1).map((x,i)=>x.rafTimestampMs-s.rows.world[i].rafTimestampMs)),
    worldAdvanceP95:p95(s.rows.world.map(x=>x.advanceMs)),viewUpdateP95:p95(s.rows.view.map(x=>x.updateMs)),viewRenderP95:p95(s.rows.view.map(x=>x.renderMs)),
    uiUpdateP95:p95(s.rows.ui.map(x=>x.updateMs)),uiRenderP95:p95(s.rows.ui.map(x=>x.renderMs)),
    outcomes:Object.fromEntries([...new Set(s.rows.ui.map(x=>x.outcome))].map(outcome=>[outcome,s.rows.ui.filter(x=>x.outcome===outcome).length])),
    nativePhaseCounts:s.host?Object.fromEntries(Object.keys(s.host.after).map(k=>[k,s.host.after[k].count-s.host.before[k].count])):null,
    worldInfo:s.worldInfo
  }));
  const gpu=await page.evaluate(()=>fixture.gpuSample());
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({renderer,hardware,report,separateGpuSample:gpu,errors},null,2));
  const out=process.env.EGRET_TIMING_REPORT;
  if(out)fs.writeFileSync(out,JSON.stringify({renderer,hardware,baseline,retained,changed,gpu,errors},null,2));
  await page.evaluate(()=>fixture.dispose());
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
