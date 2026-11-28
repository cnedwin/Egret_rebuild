// SPDX-License-Identifier: Apache-2.0
// Public Play and browser-kit integration: real browser keyboard, pointer, file chooser and download.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const [entry]=process.argv.slice(2);
assert(entry&&path.isAbsolute(entry),'Usage: node tests/play-form-file-browser.mjs <absolute Playwright index.mjs>');
const root=fileURLToPath(new URL('..',import.meta.url));
const base=fs.readFileSync(path.join(root,'examples/screen-check/index.html'),'utf8');
const imports=JSON.parse(base.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
imports['@egret/engine/web/kit']='/packages/engine/dist/web/kit.js';
const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0;overflow:hidden}</style><script type="importmap">'+JSON.stringify({imports})+'</script><script type="module">'+String.raw`
import {play} from '@egret/engine/play';
import {pickBrowserTextFile,downloadBrowserTextFile} from '@egret/engine/web/kit';
import {createUiSemantics} from '@egret/engine/ui/semantics';
import {createBrowserSemantics} from '@egret/engine/web/semantics';
const semantics=createUiSemantics(), fixture={selected:null,selectionDone:false,edited:null,imported:null,fileError:null,fileDone:false,cancelled:0};
const choices=Array.from({length:20},(_,i)=>({value:i,text:'Option '+i,disabled:i===8}));
let game,view,projection,abortPick,abortSelect;
const parts=['choose','edit','import','export'].map(name=>({type:'button',name,text:name[0].toUpperCase()+name.slice(1),height:52,width:'fill'}));
const binds={
 choose:{tap:()=>{fixture.selectionDone=false;abortSelect=new AbortController();void game.select(fixture.empty?[]:choices,{title:'Choose item',value:7,cancel:'Cancel',signal:abortSelect.signal}).then(v=>{fixture.selected=v??null;fixture.selectionDone=true;});}},
 edit:{tap:()=>view.edit('edit',{label:'Edit name',value:'Initial',select:'all',onCommit:value=>fixture.edited=value,onCancel:()=>fixture.cancelled++})},
 import:{tap:()=>{fixture.imported=null;fixture.fileError=null;fixture.fileDone=false;abortPick=new AbortController();void pickBrowserTextFile({accept:'.json,application/json',maxBytes:64,signal:abortPick.signal}).then(file=>fixture.imported=file??null,e=>fixture.fileError=e.code??e.message).finally(()=>fixture.fileDone=true);}},
 export:{tap:()=>downloadBrowserTextFile('save.json','{"save":"武林"}',{mimeType:'application/json'})}
};
const g=await play({width:720,height:480,portrait:{width:420,height:720},fit:'expand',semantics,setup(value){
  game=value;
  view=game.show({root:{type:'panel',name:'main',layout:'column',width:260,height:244,anchor:'center',gap:6,padding:4,children:parts}}, {bind:binds,gamepad:true});
}});
projection=createBrowserSemantics({semantics,canvas:game.canvas,width:game.screen.width,height:game.screen.height});
game.browser.onScreenChange(()=>projection.sync({width:game.screen.width,height:game.screen.height}));
fixture.focus=()=>{const item=semantics.snapshot.nodes.find(n=>n.id===semantics.snapshot.focused);return item?.name??null;};
fixture.tapPoint=name=>{const n=semantics.snapshot.nodes.find(n=>n.name===name&&!n.hidden&&!n.inert&&!n.disabled&&n.bounds.width>0);if(!n)return null;const r=game.canvas.getBoundingClientRect(),s=game.browser.screen;return{x:r.left+(n.bounds.x+n.bounds.width/2)*r.width/s.width,y:r.top+(n.bounds.y+n.bounds.height/2)*r.height/s.height};};
fixture.reorder=()=>view.replaceChildren('main',[parts[1],parts[0],...parts.slice(2)],binds);
fixture.hide=()=>view.hide();fixture.show=()=>view.show();
fixture.editing=()=>game.editing&&view.editing;
fixture.dispose=()=>{projection.dispose();g.dispose();};
fixture.abortPick=()=>abortPick.abort();fixture.abortSelect=()=>abortSelect.abort();
fixture.asking=()=>game.asking;
fixture.unauthorized={};
// DevTools evaluation can itself grant transient activation; wait until the browser reports none.
const checkUngestured=()=>{
 if(navigator.userActivation?.isActive){setTimeout(checkUngestured,50);return;}
 void pickBrowserTextFile().then(()=>fixture.unauthorized.pick='accepted',e=>fixture.unauthorized.pick=e.code??e.message);
 try{downloadBrowserTextFile('not-authorized.txt','text');fixture.unauthorized.save='accepted';}catch(e){fixture.unauthorized.save=e.code??e.message;}
};
setTimeout(checkUngestured,0);
window.fixture=fixture;
`+'</script>';
const server=http.createServer((req,res)=>{
 try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);return;}
 const file=path.resolve(root,'.'+u.pathname),relative=path.relative(root,file);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('outside');
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream'}).end(fs.readFileSync(file));}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=await import(pathToFileURL(entry));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:800,height:600},acceptDownloads:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>window.fixture,undefined,{timeout:8000}).catch(cause=>{throw Error(errors.join('; ')||String(cause));});
 await page.waitForTimeout(6000);
 await page.waitForFunction(()=>fixture.unauthorized.pick);
 assert.deepEqual(await page.evaluate(()=>fixture.unauthorized),{pick:'BROWSER_FILE_GESTURE_REQUIRED',save:'BROWSER_FILE_GESTURE_REQUIRED'});
 const click=async name=>{await page.waitForFunction(name=>window.fixture.tapPoint(name),name);const p=await page.evaluate(name=>fixture.tapPoint(name),name);await page.mouse.click(p.x,p.y);};
 const waitFocus=name=>page.waitForFunction(name=>fixture.focus()===name,name);
 await click('Choose');await waitFocus('Option 7');assert.equal(await page.evaluate(()=>fixture.asking()),true);
 await page.keyboard.press('ArrowDown');await waitFocus('Option 9');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>fixture.selectionDone&&fixture.selected===9);await waitFocus('Choose');
 await click('Choose');await waitFocus('Option 7');await page.keyboard.press('Escape');await page.waitForFunction(()=>fixture.selectionDone&&fixture.selected===null);await waitFocus('Choose');
 await click('Choose');await waitFocus('Option 7');await page.evaluate(()=>fixture.abortSelect());await page.waitForFunction(()=>fixture.selectionDone&&fixture.selected===null&&!fixture.asking());await waitFocus('Choose');
 await page.evaluate(()=>fixture.empty=true);await click('Choose');await waitFocus('Cancel');await page.keyboard.press('Enter');await page.waitForFunction(()=>fixture.selectionDone&&fixture.selected===null);await waitFocus('Choose');await page.evaluate(()=>fixture.empty=false);
 await click('Edit');await page.waitForFunction(()=>fixture.editing()&&document.activeElement?.closest('[data-egret-text-input]'));
 await page.keyboard.insertText('武林名称');const before=await page.evaluate(()=>{window.sameInput=document.activeElement;return document.activeElement.value;});assert.equal(before,'武林名称');
 await page.evaluate(()=>fixture.reorder());await page.setViewportSize({width:420,height:720});
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>fixture.editing()&&document.activeElement===window.sameInput&&document.activeElement.value==='武林名称'),true);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>fixture.edited==='武林名称'&&!fixture.editing());await waitFocus('Edit');
 await click('Edit');await page.waitForFunction(()=>fixture.editing());await page.evaluate(()=>fixture.hide());await page.waitForFunction(()=>!fixture.editing()&&fixture.cancelled===1);await page.evaluate(()=>fixture.show());
 let chooserPromise=page.waitForEvent('filechooser');await click('Import');let chooser=await chooserPromise;
 await chooser.setFiles({name:'old-save.json',mimeType:'application/json',buffer:Buffer.from('{"slot":"旧档"}')});
 await page.waitForFunction(()=>fixture.imported?.name==='old-save.json');
 assert.equal(await page.evaluate(()=>fixture.imported.text),'{"slot":"旧档"}');
 assert.equal(await page.locator('input[type=file]').count(),0);
 chooserPromise=page.waitForEvent('filechooser');await click('Import');chooser=await chooserPromise;
 await chooser.setFiles({name:'too-large.json',mimeType:'application/json',buffer:Buffer.alloc(65)});
 await page.waitForFunction(()=>fixture.fileError==='BROWSER_FILE_TOO_LARGE');
 assert.equal(await page.locator('input[type=file]').count(),0);
 chooserPromise=page.waitForEvent('filechooser');await click('Import');chooser=await chooserPromise;
 await chooser.setFiles([]);await page.waitForFunction(()=>fixture.fileDone&&fixture.imported===null&&fixture.fileError===null);
 assert.equal(await page.locator('input[type=file]').count(),0);
 chooserPromise=page.waitForEvent('filechooser');await click('Import');chooser=await chooserPromise;
 await page.evaluate(()=>fixture.abortPick());await page.waitForFunction(()=>fixture.fileDone&&fixture.imported===null&&fixture.fileError===null);
 assert.equal(await page.locator('input[type=file]').count(),0);
 const downloadPromise=page.waitForEvent('download');await click('Export');const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'save.json');assert.equal(fs.readFileSync(await download.path(),'utf8'),'{"save":"武林"}');
 assert.equal(await page.locator('a[download]').count(),0);
 await click('Choose');await waitFocus('Option 7');await page.evaluate(()=>fixture.dispose());await page.waitForFunction(()=>fixture.selectionDone&&fixture.selected===null);
 assert.deepEqual(errors,[]);await context.close();
 console.log('Play select, native editing across keyed relayout and resize, file import/limit and actual download passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
