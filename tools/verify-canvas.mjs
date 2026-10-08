import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
function option(name, fallback) { const index=args.indexOf(name);return index < 0 ? fallback : args[index+1]; }
const modulePath=option('--playwright',process.env.PLAYWRIGHT_MODULE);
if(!modulePath) throw Error('Configure --playwright or PLAYWRIGHT_MODULE with the installed Playwright module');
const playwright=await import(pathToFileURL(resolve(modulePath, 'index.mjs')).href);
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=resolve(option('--output','../runs/canvas-browser'));mkdirSync(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,`.${pathname}`);
    if(!file.startsWith(root+sep)) {res.writeHead(403);res.end();return;}
    const body=await readFile(file);
    const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml'}[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200,{'content-type':type});res.end(body);
  }catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await playwright.chromium.launch({channel:option('--channel','msedge'),headless:true});
  const page=await browser.newPage({viewport:{width:800,height:650},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console ${m.text()}`);});
  page.on('requestfailed',r=>errors.push(`request ${r.url()} ${r.failure()?.errorText}`));
  page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
  await page.goto(`${origin}/examples/canvas-scene/index.html`);
  await page.waitForFunction(()=>document.querySelector('#scene').getContext('2d').getImageData(80,60,1,1).data[2]>100);
  await page.screenshot({path:resolve(output,'example-before.png')});
  const before=await page.locator('#scene').evaluate(c=>c.toDataURL());
  await page.locator('#scene').click({position:{x:170,y:100}});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Rendered 1'));
  const after=await page.locator('#scene').evaluate(c=>c.toDataURL());
  if(before===after)throw Error('Pointer did not change real pixels');
  await page.screenshot({path:resolve(output,'example-after.png')});
  const checks=await page.evaluate(async()=> (await import('/tools/canvas-browser-checks.mjs')).verifyPixels());
  const counterexample=await page.evaluate(async()=>{try{await(await import('/tools/canvas-browser-checks.mjs')).verifyPixels(true);return {failed:false};}catch(e){return{failed:true,message:e.message};}});
  if(!counterexample.failed || !counterexample.message.includes('literal overlap'))throw Error('No-op executor passed pixel oracle');
  await page.screenshot({path:resolve(output,'acceptance.png')});
  if(errors.length)throw Error(JSON.stringify(errors));
  const packageVersion=JSON.parse(await readFile(resolve(modulePath,'package.json'),'utf8')).version;
  console.log(JSON.stringify({browser:await browser.version(),playwright:packageVersion,channel:option('--channel','msedge'),headless:true,deviceScaleFactor:1,pointerPixelsChanged:true,checks,counterexample,unexpectedErrors:errors,limits:'Desktop Canvas only; no device, GPU or performance conclusion'},null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
