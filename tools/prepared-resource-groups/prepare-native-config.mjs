// SPDX-License-Identifier: Apache-2.0
// First-party configuration authoring only. No SDK, collector or browser is evaluated.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireThat=(value,message)=>{if(!value)throw new Error(message);};
const equal=(actual,expected,message)=>requireThat(JSON.stringify(actual)===JSON.stringify(expected),message);
const physical=process.platform==='win32'?path.win32:path.posix;
const argumentsMap=new Map();
for(let at=2;at<process.argv.length;at++){
  const name=process.argv[at];
  requireThat(['--playwright','--workdir','--profile','--kind'].includes(name)&&!argumentsMap.has(name)
    &&process.argv[at+1],'Unique --playwright/--workdir/--profile/--kind values required');
  argumentsMap.set(name,process.argv[++at]);
}
requireThat(argumentsMap.size===4,'Exactly four named configuration arguments required');
const profile=argumentsMap.get('--profile'),kind=argumentsMap.get('--kind');
requireThat(['canvas-2d','webgpu-scene-textured'].includes(profile),'Fixed native profile required');
requireThat(['ordinary','manual-old-A-outer','manual-old-B-trim'].includes(kind),'Fixed native scenario required');
for(const name of ['--playwright','--workdir'])requireThat(path.isAbsolute(argumentsMap.get(name)),name+' must be absolute');
const repository=fs.realpathSync(fileURLToPath(new URL('../..',import.meta.url)));

// Authenticate the complete helper spelling and original bytes before importing it.
let helper = repository;
for (const [index, part] of 'tools/lib/file-identity.mjs'.split('/').entries()) {
  requireThat(fs.readdirSync(helper).includes(part), 'File-identity spelling differs');
  helper = physical.join(helper, part); const stat = fs.lstatSync(helper);
  requireThat(!stat.isSymbolicLink() && (index < 2 ? stat.isDirectory() : stat.isFile()), 'File-identity component differs');
}
const helperRaw = fs.readFileSync(helper), helperURL = pathToFileURL(helper);
requireThat(helperRaw.length === 5065 && hash(helperRaw) === '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569', 'File-identity bootstrap raw bytes differ');
requireThat(physical.relative(repository, fs.realpathSync(helper)).split(physical.sep).join('/') === 'tools/lib/file-identity.mjs'
  && physical.relative(helper, fileURLToPath(helperURL)) === '', 'File-identity physical owner differs');
const identity = await import(helperURL.href);
function read(owner,relative,pin){
  const actual=identity.fingerprintFile(owner,relative),raw=fs.readFileSync(path.join(owner,relative));
  equal({bytes:raw.length,sha256:hash(raw)},{bytes:actual.bytes,sha256:actual.sha256},'Input changed while reading '+relative);
  if(pin)equal({bytes:actual.bytes,sha256:actual.sha256},pin,'Selected original raw input differs '+relative);
  return {raw,pin:actual};
}
const preparerRelative=identity.ownerRelativePath(repository,fs.realpathSync(fileURLToPath(import.meta.url)));
requireThat(preparerRelative==='tools/prepared-resource-groups/prepare-native-config.mjs','Configuration preparer owner path differs');
const preparer=read(repository,preparerRelative);
const taskRoot=fs.realpathSync(argumentsMap.get('--workdir'));
requireThat(fs.statSync(taskRoot).isDirectory(),'Existing work directory required');
requireThat(!identity.samePhysicalPath(repository,taskRoot),'External work directory required');
try{identity.ownerRelativePath(repository,taskRoot);throw new Error('Work directory belongs to repository');}
catch(cause){if(!(cause instanceof RangeError))throw cause;}
// The snapshot step authenticates Playwright's complete resolved package inventory.
const playwrightRoot=fs.realpathSync(argumentsMap.get('--playwright'));
requireThat(fs.statSync(playwrightRoot).isDirectory(),'Existing Playwright package directory required');
const runnerRelative='tools/verify-prepared-resource-groups.mjs',runner=read(repository,runnerRelative);
const oracleRelative='tools/prepared-resource-groups/oracle.mjs';
const oracle=read(repository,oracleRelative,{bytes:7944,sha256:'d213b1c082ccb3290866928c8180be6af43de11101e6213d367fd227c86d526c'});
const fixtureRelative='tools/prepared-resource-groups/native-fixture.mjs';
const fixture=read(repository,fixtureRelative,{bytes:20027,sha256:'0de059155c414c6f8e494c8501f6ff3b4e24d0581f9ec86e238e421738767b77'});
const fixtureEdges=['@egret/engine/web','./source.mjs','./dependencies.mjs','./session.mjs','../resource-scene/gpu-scene.mjs','./application.mjs'];
// These reviewed finite edges do not replace source review or the complete SDK collector.
const moduleEdges=[
  ['coordinator.mjs',['@egret/engine']],
  ['source.mjs',['@egret/engine','@egret/engine/web/image']],
  ['session.mjs',['@egret/engine','@egret/engine/text','./coordinator.mjs']],
  ['dependencies.mjs',['@egret/engine','@egret/engine/web/image','@egret/engine/web/text']],
  ['application.mjs',['@egret/engine','@egret/engine/web','@egret/engine/web/input','./source.mjs','./dependencies.mjs','./session.mjs','../resource-scene/gpu-scene.mjs']],
];
const supplementaryModules=moduleEdges.map(([name,reviewedEdges])=>({...read(repository,'examples/prepared-resource-groups/'+name).pin,reviewedEdges}));
const stem='prepared-resource-'+profile+'-'+kind;
const configPath=path.join(taskRoot,stem+'-config.json'),snapshot=path.join(taskRoot,stem+'-input-snapshot.json'),output=path.join(taskRoot,stem+'-run');
for(const target of [configPath,snapshot,output]){
  identity.ownerRelativePath(taskRoot,target);
  try{fs.lstatSync(target);throw new Error('Fresh configuration, snapshot and output destinations required');}
  catch(cause){if(cause?.code!=='ENOENT')throw cause;}
}
const config={schemaVersion:1,repositoryRoot:repository,taskRoot,
  fixture:{path:path.join(repository,fixtureRelative),route:'/examples/prepared-resource-groups/__scene-fixture.mjs',
    bytes:fixture.pin.bytes,sha256:fixture.pin.sha256,exportName:'runPreparedResourceSceneFixture',reviewedEdges:fixtureEdges},
  supplementaryModules,expectedAbsentModules:[],snapshot,output,playwrightRoot,expectedPhase:'GREEN',
  caseContract:{baselineNames:['PSN00 genuine native scene prerequisite'],
    assignedNames:[kind==='ordinary'?'PSN01 ordinary application lifecycle':'PSN02 assigned wrong layer'],missingCode:null},
  nativeScenario:{profile,kind},oracle:{path:path.join(repository,oracleRelative),bytes:oracle.pin.bytes,sha256:oracle.pin.sha256}};
const raw=Buffer.from(JSON.stringify(config,null,2)+'\n','utf8');
fs.writeFileSync(configPath,raw,{flag:'wx'});
const saved=fs.readFileSync(configPath);requireThat(saved.equals(raw),'Saved configuration raw identity differs');
const configPin={path:configPath,bytes:saved.length,sha256:hash(saved)};
// Commands are printed only. Quote literal arguments for the named local shell.
const quote=value=>"'"+value.replaceAll("'",process.platform==='win32'?"''":"'\"'\"'")+"'";
const base=[process.execPath,path.join(repository,runnerRelative),'--config',configPath,'--config-sha256',configPin.sha256];
const instruction=(step,args)=>({step,shell:process.platform==='win32'?'PowerShell':'POSIX shell',cwd:repository,
  argv:args,command:(process.platform==='win32'?'& ':'')+args.map(quote).join(' ')});
console.log(JSON.stringify({status:'GREEN_CONFIG_WRITTEN_NO_EXECUTION',config:configPin,preparer:preparer.pin,runner:runner.pin,
  instructions:[instruction('snapshot-only',[...base,'--snapshot-only']),instruction('review-complete-snapshot-before-native-execution',base)],
  boundary:'Configuration authoring does not evaluate the SDK, collector, Playwright, oracle or browser; both later verifier steps remain explicit.'}));
