// SPDX-License-Identifier: Apache-2.0
// Reviewed package ownership is deliberately coarser than inferred symbol coverage.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fingerprintFile} from './lib/file-identity.mjs';

const names=['contracts','engine','project','runtime'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function sourcePackage(file){
 return file.match(/^packages\/(contracts|runtime|project)\/src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/)?.[1]
  ??file.match(/^packages\/(engine)\/(?:src|web|rendering)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/)?.[1]??null;
}
function read(root,file){
 const pin=fingerprintFile(root,file),raw=fs.readFileSync(path.join(root,file));
 if(raw.length!==pin.bytes||createHash('sha256').update(raw).digest('hex')!==pin.sha256)throw Error('Input changed while reading '+file);
 return {pin,raw};
}
function verify(root,pin){
 if(!pin||typeof pin.path!=='string'||!same(read(root,pin.path).pin,pin))throw Error('Stale reviewed input '+pin?.path);
}
export function dependencySelection(root,changedPackages){
 const catalog=JSON.parse(read(root,'tools/incremental-test-catalog.json').raw);
 if(catalog.schemaVersion!==1||!same(Object.keys(catalog.packages??{}).sort(),names)||!Array.isArray(catalog.tests))throw Error('Unknown dependency catalog');
 const policy=['tools/prepush.mjs','tools/test.mjs','tools/verify.mjs'];
 if(!Array.isArray(catalog.policy)||!same(catalog.policy.map(x=>x.path).sort(),policy))throw Error('Missing complete gate schedule pins');
 catalog.policy.forEach(pin=>verify(root,pin));
 const graph={};
 for(const name of names){
  const entry=catalog.packages[name];
  if(entry.manifest?.path!=='packages/'+name+'/package.json')throw Error('Wrong package manifest owner');
  verify(root,entry.manifest);
  const manifest=JSON.parse(read(root,entry.manifest.path).raw);
  const dependencies=Object.keys(manifest.dependencies??{}).filter(x=>x.startsWith('@egret/')).map(x=>x.slice(7)).sort();
  if(manifest.name!=='@egret/'+name||dependencies.some(x=>!names.includes(x))||!same(dependencies,[...entry.dependencies].sort())||new Set(entry.dependencies).size!==entry.dependencies.length)throw Error('Unknown package dependency graph');
  graph[name]=dependencies;
 }
 const visiting=new Set(),visited=new Set();
 function visit(name){if(visiting.has(name))throw Error('Cyclic package graph');if(visited.has(name))return;visiting.add(name);graph[name].forEach(visit);visiting.delete(name);visited.add(name);}
 names.forEach(visit);
 const affected=new Set(changedPackages);
 if([...affected].some(x=>!names.includes(x)))throw Error('Unknown changed package');
 for(let progress=true;progress;){progress=false;for(const name of names)if(!affected.has(name)&&graph[name].some(x=>affected.has(x))){affected.add(name);progress=true;}}
 const actual=fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x).sort();
 const declared=catalog.tests.map(x=>x.file?.path);
 if(!same(actual,[...declared].sort())||new Set(declared).size!==declared.length)throw Error('Test catalog membership differs');
 const selected=[],shared=[],omitted=[];
 for(const row of catalog.tests){
  verify(root,row.file);
  if(!Array.isArray(row.support))throw Error('Missing reviewed support inputs');
  for(const pin of row.support){if(!pin.path.startsWith('tests/')||!pin.path.endsWith('.mjs'))throw Error('Unknown support owner');verify(root,pin);}
  if(row.packages===null){shared.push(row.file.path);selected.push(row.file.path);continue;}
  if(!Array.isArray(row.packages)||!row.packages.length||row.packages.some(x=>!names.includes(x))||new Set(row.packages).size!==row.packages.length)throw Error('Unknown test ownership');
  (row.packages.some(x=>affected.has(x))?selected:omitted).push(row.file.path);
 }
 if(!selected.length||!omitted.length)throw Error('No safe reduction; complete test set required');
 return {changedPackages:[...new Set(changedPackages)].sort(),affectedPackages:[...affected].sort(),selectedTests:selected.sort(),sharedTests:shared.sort(),omittedTests:omitted.sort(),catalog:read(root,'tools/incremental-test-catalog.json').pin};
}
