import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,rmSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const helper=path.join(root,'tests/helpers/project-denied-host.mjs');
const run=args=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const values=['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot'];
function warning(stderr) {
  const known=/\(node:\d+\) ExperimentalWarning: VM Modules is an experimental feature and might change at any time\r?\n\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/g;
  const matches=[...stderr.matchAll(known)];
  assert.equal(matches.length,1,'expected exactly the known Node experimental VM warning');
  assert.equal(stderr.replace(known,''),'','unexpected successful-harness stderr');
  return matches[0][0];
}

test('unmodified actual built public graph evaluates with denied hosts and exact entry/environment',t=>{
  const result=run(['--experimental-vm-modules',helper,'--project-root']);
  assert.equal(result.status,0,result.stdout+result.stderr);t.diagnostic('Retained known harness diagnostic:\n'+warning(result.stderr));
  const report=JSON.parse(result.stdout);
  assert.deepEqual(report.projectExports,values);
  assert.equal(report.mode,'built-root-unmodified');
  assert.equal(report.entry,realpathSync(path.join(root,'packages/project/dist/index.js')));
  assert.equal(report.environment.node,process.version);
  assert.equal(report.environment.moduleLoader,'VM SourceTextModule + actual installed public-root CJS graph');
  assert.deepEqual(report.deniedHostAccesses,[]);
  assert.ok(report.projectGraph.includes('dist/store.js')&&report.projectGraph.includes('dist/restore.js')&&report.projectGraph.includes('dist/format-shape.generated.js'));
  assert.equal(new Set(report.projectGraph).size,report.projectGraph.length);
  assert.deepEqual(report.libraryGraph,['lib/umd/main.js','lib/umd/impl/format.js','lib/umd/impl/scanner.js','lib/umd/impl/string-intern.js','lib/umd/impl/edit.js','lib/umd/impl/parser.js']);
  t.diagnostic(JSON.stringify(report));
});

test('instrumented authority-entry audit observes no project-state/store creation during root evaluation',t=>{
  const result=run(['--experimental-vm-modules',helper,'--project-root','--audit-store-authority']);
  assert.equal(result.status,0,result.stdout+result.stderr);t.diagnostic('Retained known harness diagnostic:\n'+warning(result.stderr));
  const report=JSON.parse(result.stdout);
  assert.equal(report.mode,'built-root-authority-instrumented');
  assert.deepEqual(report.authorityEntries,['state.js:createState','store.js:makeStore','commit.js:commitPrepared','history.js:openHistoryDocument']);
  assert.deepEqual(report.storeAuthorityCalls,[]);
});

test('every denied host getter has a real failing module-evaluation control',()=>{
  for(const name of ['window','document','navigator','process','Buffer','fetch','XMLHttpRequest','WebSocket','setTimeout','clearTimeout','setInterval','clearInterval','setImmediate','clearImmediate','queueMicrotask','requestAnimationFrame','cancelAnimationFrame','Date','performance','crypto','console','Math.random','ProjectStore']) {
    const result=run(['--experimental-vm-modules',helper,'--probe-host',name]);
    assert.notEqual(result.status,0,name);assert.ok(result.stderr.includes(`Denied host access: ${name}`),result.stderr);
  }
});

test('copied actual built root host and store-authority side effects fail during evaluation',t=>{
  const parent=path.join(root,'work');mkdirSync(parent,{recursive:true});
  const dir=mkdtempSync(path.join(parent,'project-host-control-'));
  try {
    cpSync(path.join(root,'packages/project/dist'),dir,{recursive:true});
    const entry=path.join(dir,'index.js'),original=readFileSync(entry,'utf8');
    writeFileSync(entry,original+'\nvoid globalThis.fetch;\n');
    const host=run(['--experimental-vm-modules',helper,'--project-root','--built-directory',dir]);
    assert.notEqual(host.status,0);assert.match(host.stderr,/Denied host access: fetch/);
    t.diagnostic(`Copied host side effect: exit ${host.status}; ${host.stderr.match(/^Error: .+/m)?.[0]}`);
    const literal='{"projectSchemaVersion":"1.0","projectId":"p_a","revision":0,"name":"","versions":{"engineVersion":"1","resourceFormatVersion":"1","toolProtocolVersion":"1.0"},"roots":[],"entities":[],"files":[],"retiredEntityIds":[],"retiredFileIds":[]}';
    writeFileSync(entry,original+`\nimport {createProjectStore as eagerCreate} from './api.js';\neagerCreate(${literal});\n`);
    const authority=run(['--experimental-vm-modules',helper,'--project-root','--built-directory',dir,'--audit-store-authority']);
    assert.notEqual(authority.status,0);assert.match(authority.stderr,/Denied store authority during import: createState/);
    t.diagnostic(`Copied eager creation: exit ${authority.status}; ${authority.stderr.match(/^Error: .+/m)?.[0]}`);
    writeFileSync(entry,original);assert.equal(readFileSync(entry,'utf8'),original);
  } finally {
    const resolved=realpathSync(dir);assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('project-host-control-'));
    rmSync(resolved,{recursive:true,force:true});
  }
});

test('successful full-root audit rejects extra stderr beside the retained exact known warning',()=>{
  const args=`process.argv.push('--project-root');await import(${JSON.stringify(pathToFileURL(helper).href)});process.stderr.write('INDEPENDENT_PROJECT_UNEXPECTED_DIAGNOSTIC\\n');`;
  const result=run(['--experimental-vm-modules','--input-type=module','--eval',args]);
  assert.equal(result.status,0,result.stdout+result.stderr);assert.deepEqual(JSON.parse(result.stdout).deniedHostAccesses,[]);
  assert.throws(()=>warning(result.stderr),/unexpected successful-harness stderr/);
});

test('native Node ESM uses built project root and shipped CJS dependency interop separately from VM simulation',()=>{
  // jsonc-parser resolves from its actual project package, not an undeclared root dependency.
  const projectRequire=createRequire(path.join(root,'packages/project/package.json'));
  const source=`import * as project from '@egret/project';import {createScanner,visit} from 'jsonc-parser';if(JSON.stringify(Object.keys(project))!==${JSON.stringify(JSON.stringify(values))}||typeof createScanner!=='function'||typeof visit!=='function')throw Error('native public root mismatch');`;
  const result=spawnSync(process.execPath,['--input-type=module','--eval',source],{cwd:path.join(root,'packages/project'),encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');
  const shipped=path.resolve(path.dirname(realpathSync(projectRequire.resolve('jsonc-parser'))),'../esm/main.js');
  const limitation=run(['--input-type=module','--eval',`await import(${JSON.stringify(pathToFileURL(shipped).href)});`]);
  assert.notEqual(limitation.status,0);assert.match(limitation.stderr,/ERR_MODULE_NOT_FOUND/);assert.match(limitation.stderr,/[\\/]impl[\\/]format/);
});
