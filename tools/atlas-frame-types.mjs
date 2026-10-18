// SPDX-License-Identifier: Apache-2.0
import {spawnSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,samePhysicalPath} from './lib/file-identity.mjs';
const root=realpathSync(fileURLToPath(new URL('..',import.meta.url)));
if(process.argv.length!==2)throw Error('Atlas types accept no arguments');
for(const owner of ['contracts','runtime','engine'])if(!samePhysicalPath(realpathSync(path.join(root,'node_modules/@egret',owner)),realpathSync(path.join(root,'packages',owner))))throw Error('Atlas foreign SDK alias');
const file='tests/types/atlas-frame-diagnostic-expectations.json';
const inventory=JSON.parse(readFileSync(path.join(root,file),'utf8'));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(root, 'tools/lib/m13-strict-successor.mjs');
if (m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634') throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');
const m13 = selectM13StrictSuccessor(root, 'atlas-frame', inventory);

const snapshot=[file,'tools/atlas-frame-types.mjs',...(m13?.inputPins ?? inventory.inputPins).map(p=>p.path),...inventory.groups.flatMap(g=>[g.fixture.path,g.config.path])].map(p=>fingerprintFile(root,p));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function verify(){m13?.recheck();for(const p of [...snapshot,...(m13?.inputPins ?? inventory.inputPins),...inventory.groups.flatMap(g=>[g.fixture,g.config])])if(!equal(fingerprintFile(root,p.path),p))throw Error('Atlas changed strict input '+p.path);}
function tuples(raw){const rows=[];for(const line of raw.replaceAll('\r\n','\n').split('\n')){if(!line)continue;const m=/^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);if(m)rows.push([m[1].replaceAll('\\','/'),+m[2],+m[3],+m[4],m[5]]);else if(/^ {2,}\S/.test(line)&&rows.length)rows.at(-1)[4]+='\n'+line;else throw Error('Unconsumed atlas compiler output');}return rows;}
if(inventory.kind!=='ATLAS_FRAME_ACTUAL_STRICT_DIAGNOSTICS'||inventory.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS'||!equal(inventory.groups.map(g=>g.lane),['positive','negative','import-negative']))throw Error('Atlas actual observation missing');
for(const group of inventory.groups){
 verify();const source=readFileSync(path.join(root,group.fixture.path),'utf8');
 if(/@ts-(?:expect-error|ignore|nocheck)/.test(source))throw Error('Atlas suppression refused');
 const cases=source.split('\n').flatMap((line,index)=>line.startsWith('// ATLAS_CASE ')?[{name:line.slice(14),line:index+2}]:[]);
 if(!equal(cases,group.cases)||!equal(cases.map(c=>c.line),group.tuples.map(t=>t[1]))||group.tuples.some(t=>t[0]!==group.fixture.path))throw Error('Atlas named case/tuple bijection changed');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p',group.config.path,'--pretty','false'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4194304});
 process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');verify();
 if(result.error||result.signal||result.status!==group.expectedExit||result.stderr!==''||!equal(tuples(result.stdout),m13?.group(group.lane).tuples ?? group.tuples))throw Error('Atlas strict exit/complete tuple mismatch '+group.lane);
 m13?.verifyClosure(group.lane);
 console.log('Atlas strict '+group.lane+' PASS '+JSON.stringify(m13?.group(group.lane).tuples ?? group.tuples));
}
verify();console.log('Atlas frame strict public consumers PASS.');
