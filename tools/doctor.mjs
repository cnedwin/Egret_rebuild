// SPDX-License-Identifier: Apache-2.0
// Read-only diagnostics: report actual runtime identity rather than PATH intent.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localPackage} from './lib/local-package.mjs';
import {samePhysicalPath} from './lib/file-identity.mjs';
export const repository=fileURLToPath(new URL('..',import.meta.url));
export function inspectEnvironment(root=repository,{preinstall=false}={}){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const checks=[];
 const add=(name,ok,actual,repair)=>checks.push({name,ok,actual,repair:ok?null:repair});
 const read=file=>{try{return fs.readFileSync(path.join(root,file),'utf8').trim();}catch{return null;}};
 const child=spawnSync(process.execPath,['-p','process.versions.node'],{encoding:'utf8'});
 add('node',process.versions.node===pkg.engines.node,process.versions.node,'Select Node '+pkg.engines.node+' before running pnpm; check wrappers that hardcode another Node.');
 add('child-node',child.status===0&&child.stdout.trim()===process.versions.node,child.stdout?.trim(),'Ensure child processes use the selected Node.');
 for(const file of ['.node-version','.nvmrc'])add(file,read(file)===pkg.engines.node,read(file),'Synchronize version files with package.json.');
 let manager='missing';
 try{
  if(process.env.npm_execpath){
   const metadata=JSON.parse(fs.readFileSync(path.resolve(path.dirname(process.env.npm_execpath),'../package.json'),'utf8'));
   if(metadata.name==='pnpm')manager=metadata.version;
  }else{
   const result=process.platform==='win32'
    ?spawnSync('cmd.exe',['/d','/c','pnpm --version'],{encoding:'utf8'})
    :spawnSync('pnpm',['--version'],{encoding:'utf8'});
   if(result.status===0)manager=result.stdout.trim();
  }
 }catch{}
 add('pnpm',pkg.packageManager==='pnpm@11.25.0'&&manager==='11.25.0',manager,'Select pnpm 11.25.0 under Node 26.7.0; keep packageManager pinned.');
 const pwsh=spawnSync('pwsh',['-NoProfile','-Command','$PSVersionTable.PSVersion.ToString()'],{encoding:'utf8'});
 add('powershell',pwsh.status===0&&pwsh.stdout.trim()==='7.6.5',pwsh.stdout?.trim()||'missing','Install PowerShell 7.6.5 and expose pwsh in this terminal.');
 const git=spawnSync('git',['--version'],{cwd:root,encoding:'utf8'});
 add('git',git.status===0,git.stdout?.trim()||'missing','Install Git and open a new terminal.');
 if(!preinstall){
  if(process.platform==='win32'&&process.arch==='x64'){
   const native=read('node_modules/@typescript/typescript-win32-x64/package.json');
   let meta;try{meta=JSON.parse(native);}catch{}
   let owned=false;try{localPackage(root,path.join(root,'node_modules/@typescript/typescript-win32-x64'),'@typescript/typescript-win32-x64','7.0.2');owned=true;}catch{}
   add('native-compiler-alias',owned&&meta?.name==='@typescript/typescript-win32-x64'&&meta?.version==='7.0.2',meta?.version??'missing','Run pnpm setup:dev to prepare the declared local compiler alias.');
  }
  for(const [file,version] of [['node_modules/typescript/package.json',pkg.devDependencies.typescript],['node_modules/jsonc-parser/package.json','3.3.1'],['packages/engine/node_modules/robust-predicates/package.json','3.0.3']]){
   let actual;try{actual=JSON.parse(read(file)).version;}catch{}
   let owned=false;try{localPackage(root,path.dirname(path.join(root,file)),file.includes('robust-predicates')?'robust-predicates':file.split('/')[1],version);owned=true;}catch{}
   add(file,owned&&actual===version,actual??'missing','Run pnpm setup:dev with the pinned package manager.');
  }
  for(const name of ['contracts','runtime','engine','project']){
   let ok=false;try{ok=samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret',name)),fs.realpathSync(path.join(root,'packages',name)));}catch{}
   add('@egret/'+name,ok,ok?'local workspace':'missing or foreign','Run pnpm setup:dev; do not create aliases manually.');
  }
 }
 return {ok:checks.every(c=>c.ok),scope:preinstall?'prerequisites':'installed development environment',node:{parent:process.versions.node,child:child.stdout?.trim()},checks};
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--preinstall')||args.length>1)throw Error('Usage: node tools/doctor.mjs [--preinstall]');
 const result=inspectEnvironment(repository,{preinstall:args.includes('--preinstall')});console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
}
