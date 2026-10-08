const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
async function main(){
  const {chromium}=require(process.argv[2]||'playwright');const label=process.argv[3]||'green';if(!/^[a-z0-9-]+$/.test(label))throw new Error('Invalid run label');
  const {server,port,runToken}=await import(pathToFileURL(path.join(__dirname,'server.mjs')).href);let browser;
  try{
    let launchMode;try{browser=await chromium.launch({headless:true});launchMode='bundled_chromium';}catch{browser=await chromium.launch({headless:true,channel:'msedge'});launchMode='installed_edge_fresh_test_profile';}
    const page=await browser.newPage({viewport:{width:1000,height:1100}}),errors=[],diagnostics=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',c=>{if(['error','warning'].includes(c.type()))diagnostics.push({type:c.type(),message:c.text()});});
    await page.goto(`http://127.0.0.1:${port}/?token=${runToken}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.probeReport,{timeout:60000});await page.locator('#state').filter({hasText:'已保存'}).waitFor({timeout:10000});
    const report=await page.evaluate(()=>window.probeReport);report.label=label;report.browserVersion=browser.version();report.launchMode=launchMode;report.pageErrors=errors;report.consoleDiagnostics=diagnostics;
    report.sourceHashes=[];const sources=JSON.parse(await fs.readFile(path.join(__dirname,'sources.json'),'utf8'));
    for(const relative of ['reference-chain.mjs','ui-pass.mjs','integration-tests.mjs','probe.js','index.html','server.mjs','run-headless.cjs','sources.json',...sources.files.map(x=>x.path)]){try{report.sourceHashes.push({path:relative,sha256:crypto.createHash('sha256').update(await fs.readFile(path.join(__dirname,relative))).digest('hex')});}catch(e){if(e.code!=='ENOENT')throw e;}}
    const evidence=path.resolve(__dirname,'../../evidence'),file=path.join(evidence,'asset-reference-probe-results.json');await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');await fs.copyFile(file,path.join(evidence,`asset-reference-${label}-${report.runId}.json`));
    if(report.counts.failed===0){await page.locator('#demo').click();await page.waitForTimeout(250);}
    const screenshot=path.join(evidence,'asset-reference-probe.png');await page.screenshot({path:screenshot,fullPage:true});await fs.copyFile(screenshot,path.join(evidence,`asset-reference-${label}-${report.runId}.png`));
    console.log(JSON.stringify({runId:report.runId,counts:report.counts,browser:report.browserVersion,errors,diagnostics,failures:report.results.filter(r=>r.status==='failed').map(r=>({id:r.id,error:r.actual.error}))}));process.exitCode=report.counts.failed||errors.length?1:0;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
