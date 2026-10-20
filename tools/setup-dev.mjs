// SPDX-License-Identifier: Apache-2.0
// Repeatable setup uses the invoking, pinned pnpm CLI under the selected Node.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {localPackage} from './lib/local-package.mjs';
import {samePhysicalPath} from './lib/file-identity.mjs';
import {spawnSync} from 'node:child_process';
import {inspectEnvironment,repository} from './doctor.mjs';
const options=process.argv.slice(2);
if(options.length>1||options.some(option=>option!=='--no-build'))throw Error('Usage: pnpm setup:dev [--no-build]');
const build=!options.includes('--no-build');
const prerequisites=inspectEnvironment(repository,{preinstall:true});
if(!prerequisites.ok){console.error(JSON.stringify(prerequisites,null,2));process.exit(1);}
const cli=process.env.npm_execpath;
if(!cli||!path.isAbsolute(cli))throw Error('Invoke using pnpm setup:dev (pnpm 11.25.0).');
const metadata=JSON.parse(fs.readFileSync(path.resolve(path.dirname(cli),'../package.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(repository,'package.json'),'utf8'));
if(metadata.name!=='pnpm'||'pnpm@'+metadata.version!==pkg.packageManager)throw Error('Pinned pnpm CLI required: '+pkg.packageManager);
function run(command,args){const result=spawnSync(command,args,{cwd:repository,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);}
run(process.execPath,[cli,'install','--frozen-lockfile','--ignore-scripts']);
// Git hooks are versioned repository policy; setup never changes global config.
const previous=spawnSync('git',['config','--local','--get','core.hooksPath'],{cwd:repository,encoding:'utf8'});
if(previous.status===0&&previous.stdout.trim()!=='.githooks')throw Error('Existing custom hooksPath: resolve explicitly before setup changes it.');
if(previous.status!==0&&previous.status!==1)throw Error('Cannot inspect repository hook configuration.');
run('git',['config','--local','core.hooksPath','.githooks']);
// Existing Windows source collectors require this exact, locally owned alias.
if(process.platform==='win32'&&process.arch==='x64'){
 const native='@typescript/typescript-win32-x64';
 const require=createRequire(fs.realpathSync(path.join(repository,'node_modules/typescript/package.json')));
 const source=localPackage(repository,path.dirname(require.resolve(native+'/package.json')),native,'7.0.2');
 const metadata=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
 if(metadata.name!==native||metadata.version!=='7.0.2')throw Error('Unexpected native compiler package');
 const destination=path.join(repository,'node_modules',native);
 let exists;try{exists=fs.lstatSync(destination);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(exists){if(!samePhysicalPath(fs.realpathSync(destination),fs.realpathSync(source)))throw Error('Existing native compiler alias has a different owner');}
 else {fs.mkdirSync(path.dirname(destination),{recursive:true});fs.symlinkSync(source,destination,'junction');}
}
// Hoisted installation keeps third-party files physical at the root; the
// renderer's historical public import map still needs its package-local alias.
{
 const source=localPackage(repository,path.join(repository,'node_modules/robust-predicates'),'robust-predicates','3.0.3');
 const metadata=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
 if(metadata.name!=='robust-predicates'||metadata.version!=='3.0.3')throw Error('Unexpected renderer dependency');
 const destination=path.join(repository,'packages/engine/node_modules/robust-predicates');
 let exists;try{exists=fs.lstatSync(destination);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(exists){if(!samePhysicalPath(fs.realpathSync(destination),source))throw Error('Existing renderer alias has a different owner');}
 else {fs.mkdirSync(path.dirname(destination),{recursive:true});fs.symlinkSync(source,destination,process.platform==='win32'?'junction':'dir');}
}
run(process.execPath,['tools/doctor.mjs']);
// CI immediately runs the complete merge check, which owns its single build.
if(build)run(process.execPath,['tools/build.mjs']);
console.log(build?'Setup complete. Run pnpm check:quick, then pnpm example:browser.':'Setup complete without a build. Run the complete merge check before acceptance.');
