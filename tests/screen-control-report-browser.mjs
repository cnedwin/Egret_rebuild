// SPDX-License-Identifier: Apache-2.0
// Real native Play/overlay control receipts, including clipping, direct
// controls, actual input interference and explicitly authored painted faces.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { controlFindings } from '../tools/verify-screens.mjs';

const [playwright] = process.argv.slice(2);
if (!playwright || !path.isAbsolute(playwright))
  throw Error('Usage: node tests/screen-control-report-browser.mjs <absolute Playwright index.mjs>');
const root = fileURLToPath(new URL('..', import.meta.url));
const example = fs.readFileSync(path.join(root, 'examples/screen-check/index.html'), 'utf8');
const imports = JSON.parse(example.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' +
  '<style>html,body{margin:0;overflow:hidden}#sceneParent{position:fixed;inset:0}canvas{display:block;width:100%;height:100%}</style>' +
  '<script type="importmap">' + JSON.stringify(imports) + '</script><script type="module">' + String.raw`
import { Sprite } from '@egret/engine';
import { play } from '@egret/engine/play';
import { createWorld3DOverlay } from '@egret/engine/webgl2/world3d';
import { createActionControl, registerScreenOccluder } from '@egret/engine/ui';
import { createUiSemantics, semanticBoundsOf } from '@egret/engine/ui/semantics';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
const semantics=createUiSemantics();
const handles=[];
const populate=(stage,pointer,safe,isPlay,playGame)=>{
  const make=(parent,x,y,w,h,name,color=0x288e96)=>{
    const s=new Sprite();s.x=x;s.y=y;s.name=name??'';
    s.graphics.beginFill(color).drawRect(0,0,w,h).endFill();
    parent.addChild(s);return s;
  };
  const addSemantic=(id,node,name,role='button')=>handles.push(semantics.add({
    id,role,describe:()=>({name,bounds:semanticBoundsOf(node)}),...(role==='button'?{onActivate(){}}:{})
  }));
  const action=(parent,x,y,w,h,id,name)=>{
    const s=make(parent,x,y,w,h,'');s.touchEnabled=true;s.hitArea={x:0,y:0,width:w,height:h};
    handles.push(createActionControl({input:pointer,target:s,onActivate(){}}));addSemantic(id,s,name);return s;
  };
  let advanceList;
  if(isPlay){
    const list=playGame.show({
      label:'Example native scroll',
      root:{type:'panel',name:'list',anchor:'top-left',x:8,y:8,width:180,height:96,scroll:'vertical',layout:'column',gap:0,children:[
        {type:'button',name:'rowA',text:'Row A',width:'fill',height:64},
        {type:'button',name:'rowB',text:'Row B',width:'fill',height:64},
        {type:'button',name:'rowC',text:'Row C',width:'fill',height:64}
      ]}
    },{bind:{rowA:{tap(){}},rowB:{tap(){}},rowC:{tap(){}}}});
    advanceList=()=>list.scroll('list').scrollTo(64);
  }else{
    const clip=make(stage,safe.x+8,safe.y+8,180,96,'');
    clip.clipRect={x:0,y:0,width:180,height:96};
    const rows=new Sprite();clip.addChild(rows);
    action(rows,0,0,180,64,'rowA','Row A');action(rows,0,64,180,64,'rowB','Row B');
    action(rows,0,128,180,64,'rowC','Row C');
    advanceList=()=>{rows.y=-64;semantics.publish()};
  }
  const x=safe.x+200,y=safe.y+8;
  const parent=make(stage,x,y,116,74,'');
  handles.push(registerScreenOccluder(parent,{name:'Control holder',rect:{x:0,y:0,width:116,height:74}}));
  const direct=action(parent,8,6,70,64,'direct','Direct action');
  const pane=make(stage,x+32,y+16,64,48,'',0x8d3544);
  const cover=registerScreenOccluder(pane,{name:'Status card',rect:{x:0,y:0,width:64,height:48}});
  handles.push(cover);
  // An alpha-zero face and an actual ancestor must not be reported as cover.
  const transparent=make(stage,x+32,y+16,64,48,'');transparent.alpha=0;
  handles.push(registerScreenOccluder(transparent,{name:'Transparent',rect:{x:0,y:0,width:64,height:48}}));
  action(stage,x,y+92,130,92,'outer','Independent outer');
  action(stage,x+25,y+108,60,60,'inner','Independent inner');
  const holder=action(stage,x,y+202,130,92,'holder','Actual parent');
  action(holder,25,16,60,60,'descendant','Actual child');
  action(stage,x,y+312,70,64,'blocked','Blocked action');
  const blocker=make(stage,x+20,y+322,50,44,'Input shield');
  blocker.touchEnabled=true;blocker.hitArea={x:0,y:0,width:50,height:44};
  addSemantic('shield',blocker,'Input shield','group');
  window.screenFixture={advanceList,disposeCover:()=>cover.dispose(),direct:()=>semanticBoundsOf(direct)};
};
if(new URLSearchParams(location.search).get('host')==='overlay'){
  const place=document.createElement('div');place.id='sceneParent';const scene=document.createElement('canvas');
  place.appendChild(scene);document.body.appendChild(place);scene.getContext('2d').fillRect(0,0,100,100);
  const overlay=await createWorld3DOverlay(scene,{width:480,height:270,fit:'expand'});
  const projection=createBrowserSemantics({semantics,canvas:overlay.canvas,width:overlay.game.screen.width,height:overlay.game.screen.height});
  overlay.game.scope.use({dispose(){projection.dispose()}});
  populate(overlay.game.stage,overlay.game.pointer,overlay.game.screen.safe,false);semantics.publish();
  window.screenFixture.dispose=()=>overlay.dispose();
}else{
  const g=await play({width:480,height:270,fit:'expand',semantics,setup(game){
    populate(game.browser.stage,game.browser.pointer,game.browser.screen.safe,true,game);
  }});
  window.screenFixture.dispose=()=>g.dispose();
}
` + '</script>';
const mime = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    const file = path.resolve(root, '.' + u.pathname);
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('outside fixture root');
    const bytes = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = await import(pathToFileURL(playwright));
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
try {
  for (const host of ['play', 'overlay']) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', error => { errors.push(String(error)); console.error(host, error); });
      page.on('response', response => { if (response.status() >= 400) console.error(host, response.status(), response.url()); });
      page.on('console', message => { if (message.type() === 'error') console.error(host, message.text()); });
      await page.addInitScript(() => {
        window.screenReceipt = { sequence: 0 };
        window.__egretAgent = {
          insets: { left: 0, top: 59, right: 0, bottom: 34 },
          controls(controls, screen) {
            window.screenReceipt = { sequence: window.screenReceipt.sequence + 1, controls, screen };
          }
        };
      });
      await page.goto('http://127.0.0.1:' + server.address().port + '/?host=' + host);
      await page.waitForFunction(host => window.screenFixture && window.screenReceipt.sequence > (host === 'play' ? 0 : 1), host);
      const first = await page.evaluate(() => window.screenReceipt);
      assert.deepEqual(errors, [], host);
      const by = name => first.controls.find(c => c.name === name);
      if (!by('Row A') || !by('Row B')) console.error(host, JSON.stringify(first));
      assert.ok(by('Row A') && by('Row B'), host + ': fully and partly exposed rows');
      assert.equal(by('Row C'), undefined, host + ': completely clipped row is absent');
      assert.ok(by('Row B').authored.height > by('Row B').height, host + ': retained authored touch extent');
      assert.ok(by('Direct action'), host + ': direct native action has its actual semantic name');
      assert.deepEqual(by('Direct action').coveredBy, ['Status card'], host + ': only unrelated painted face covers it');
      assert.equal(by('Blocked action').blockedBy, 'Input shield', host + ': actual native interception');
      const findings = controlFindings(first.controls, first.screen.safe, true);
      assert.ok(!findings.some(f => f.check === 'inSafeArea'), host + ': visible rows do not false-fail');
      assert.ok(!findings.some(f => f.check === 'touchTarget' && f.control === 'Row B'), host + ': partial row is not inherently small');
      const overlaps = findings.filter(f => f.check === 'apart').map(f => f.controls.join('|'));
      assert.ok(overlaps.includes('Independent outer|Independent inner'), host + ': unrelated containment');
      assert.ok(!overlaps.includes('Actual parent|Actual child'), host + ': true ancestor');
      await page.evaluate(() => { window.screenFixture.advanceList(); window.screenFixture.disposeCover(); });
      await page.waitForFunction(sequence => window.screenReceipt.sequence > sequence, first.sequence);
      const after = await page.evaluate(() => window.screenReceipt);
      assert.ok(after.controls.some(c => c.name === 'Row C') && !after.controls.some(c => c.name === 'Row A'), host);
      assert.equal(after.controls.find(c => c.name === 'Direct action').coveredBy, undefined, host + ': disposed face stops reporting');
      assert.deepEqual(errors, [], host);
      await page.evaluate(() => window.screenFixture.dispose());
      console.log(host + ': clipped and direct controls, native occlusion, independent containment and disposal verified');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
