// SPDX-License-Identifier: Apache-2.0
// Narrow fixed-CLI adapter. Compiler stdout/stderr are retained before parsing;
// tuples are actual unsuppressed CLI diagnostics, never guessed Compiler API data.
import {readFileSync,writeFileSync,mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {canonicalTextBytes,fingerprintFile,ownerRelativePath,samePhysicalPath} from '../../../../tools/lib/file-identity.mjs';
const experiment=fileURLToPath(new URL('../',import.meta.url)),repository=fileURLToPath(new URL('../../../../',import.meta.url)),file=process.argv[2],require=createRequire(import.meta.url);
if(process.argv.length!==3||!file||!/^(?:positive|negative-[a-z-]+)\.ts$/.test(file))throw new Error('TYPE_LANE_ARGUMENT');
const record={compilerVersion:null,file,unsuppressed:true,tupleFormat:['file','line','column','code','message'],diagnosticTuples:[],cli:null,collectorFailure:null,temporaryConfigCleanup:'not_created'};
let temporary,configPath;
function parseActualDiagnostics(bytes){
  const output=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replaceAll('\r\n','\n');if(!output)return [];
  if(output.includes('\r')||!output.endsWith('\n'))throw new Error('TYPE_CLI_INCOMPLETE_OUTPUT');
  const rows=[];for(const line of output.slice(0,-1).split('\n')){
    const match=/^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if(match){rows.push({file:ownerRelativePath(repository,resolve(repository,match[1])),line:Number(match[2]),column:Number(match[3]),code:Number(match[4]),message:match[5]});}
    else if(rows.length&&/^ {2,}\S/.test(line))rows.at(-1).message+='\n'+line;
    else throw new Error('TYPE_CLI_UNCONSUMED_OUTPUT: '+line);
  }return rows;
}
try{
  const metadataPath=realpathSync(require.resolve('typescript/package.json')),compilerOwner=dirname(metadataPath),metadata=JSON.parse(readFileSync(metadataPath,'utf8'));
  record.compilerVersion=metadata.version;
  if(metadata.name!=='typescript'||metadata.version!=='7.0.2'||metadata.bin?.tsc!=='./bin/tsc')throw new Error('TYPE_CLI_FIXED_COMPILER_REQUIRED');
  const sourcePath=fileURLToPath(new URL(file,import.meta.url)),source=readFileSync(sourcePath,'utf8');if(/@ts-(?:ignore|expect-error|nocheck)\b/.test(source))throw new Error('TYPE_CLI_SUPPRESSED_SOURCE');
  record.sourcePin=fingerprintFile(experiment,'type-tests/'+file);record.compilerPackage=fingerprintFile(compilerOwner,'package.json');
  const temporaryOwner=realpathSync(tmpdir());temporary=mkdtempSync(join(temporaryOwner,'egret-f2c-type-lane-'));configPath=join(temporary,'tsconfig.json');
  const config={extends:join(experiment,'tsconfig.json'),compilerOptions:{noEmit:true,declaration:false,rootDir:join(experiment,'type-tests')},files:[sourcePath],include:[],exclude:[]};
  writeFileSync(configPath,canonicalTextBytes(JSON.stringify(config,null,2)),{flag:'wx'});record.config=config;
  const args=[join(compilerOwner,'bin/tsc'),'--project',configPath,'--pretty','false'];
  const environment={...process.env};delete environment.NODE_OPTIONS;delete environment.NODE_PATH;
  const result=spawnSync(process.execPath,args,{cwd:repository,env:environment,windowsHide:true,timeout:60000,maxBuffer:16777216});
  const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0);
  record.cli={exitStatus:result.status,signal:result.signal,timeoutMs:60000,stdoutBase64:stdout.toString('base64'),stderrBase64:stderr.toString('base64'),stdout:stdout.toString('utf8'),stderr:stderr.toString('utf8'),error:result.error?{name:result.error.name,code:result.error.code,message:result.error.message,stack:result.error.stack}:null};
  if(result.error||result.signal!==null||![0,1].includes(result.status)||stderr.length)throw new Error('TYPE_CLI_SETTLEMENT_REFUSED');
  record.diagnosticTuples=parseActualDiagnostics(stdout);
  const laneKey=ownerRelativePath(repository,sourcePath);
  if(record.diagnosticTuples.some(row=>row.file!==laneKey||[2307,2688,6053,5058,5083,5110].includes(row.code)))throw new Error('TYPE_CLI_SETUP_DIAGNOSTIC_NOT_LANE_REFUSAL');
}catch(error){record.collectorFailure={name:error.name,code:error.code??null,message:error.message,stack:error.stack};}
finally{
  if(temporary)try{
    // Only this fresh, canonical temporary directory is recursively removed.
    if(!samePhysicalPath(dirname(temporary),realpathSync(tmpdir()))||!samePhysicalPath(temporary,realpathSync(temporary)))throw new Error('TYPE_CLI_TEMP_OWNER_CHANGED');
    ownerRelativePath(temporary,configPath);rmSync(temporary,{recursive:true});record.temporaryConfigCleanup='removed';
  }catch(error){record.temporaryConfigCleanup='failed';record.cleanupFailure={name:error.name,message:error.message,stack:error.stack};}
}
console.log(JSON.stringify(record));
process.exitCode=record.collectorFailure||record.temporaryConfigCleanup==='failed'?2:record.cli.exitStatus;
