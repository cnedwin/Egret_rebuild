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
if ((m13HelperPin.bytes !== 85316 || m13HelperPin.sha256 !== '8d9d3604ca43eefd1d13b63c24023a1bb7347e8248e9b4b7756e00205054ee93') && (m13HelperPin.bytes !== 85991 || m13HelperPin.sha256 !== 'c160e1d8cd83e131cac6f73953412e83e3331c320d3842e3af2913b99a2bd290') && (m13HelperPin.bytes !== 88195 || m13HelperPin.sha256 !== 'c71a650058f5995c9ac0c40b4087fad09c0241f5a6c6f35c5c56ee524ac21bf6') && (m13HelperPin.bytes !== 89966 || m13HelperPin.sha256 !== '11f2455aa5f3a9b1aaa5f27692a39448452cba2bfefb10695cc469e9187a824f') && (m13HelperPin.bytes !== 91887 || m13HelperPin.sha256 !== 'c97e18f56974923679ea61b6ffad764bd5b064dea3f29e8e81122ce1f4666f08') && (m13HelperPin.bytes !== 93794 || m13HelperPin.sha256 !== '34f0b589b334c95380f61ff73a01e4ddf50ba52d5a08864320e8f461cca92071') && (m13HelperPin.bytes !== 94148 || m13HelperPin.sha256 !== '5483519fc7a3ae81d58978c675eb75da1669ab12ed8f2f5961cb5d33773c91f7') && (m13HelperPin.bytes !== 94544 || m13HelperPin.sha256 !== '194391cdb691996a30b03836a59f69d0a63cf0fa9eb9d353dc1447efe2e62414') && (m13HelperPin.bytes !== 95008 || m13HelperPin.sha256 !== '836531701fb4f5e3204f4f121509d8105b756902f173c0e3e1a4004fa059aa7a')) throw Error('M1.3 strict helper changed before import');
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
