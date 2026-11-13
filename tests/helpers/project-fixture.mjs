// SPDX-License-Identifier: Apache-2.0
// Owned copies of the four packages, their resolution aliases and the type tools, for the test
// files that change one input and expect one refusal. Nothing outside the copy is written.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,symlinkSync,rmSync,realpathSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ownerRelativePath,samePhysicalPath} from '../../tools/lib/file-identity.mjs';

export const repository=fileURLToPath(new URL('../..',import.meta.url));
export const parent=path.join(repository,'work');
export const run=(args,cwd=repository)=>spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});

// Every fixture copies actual packages/dependencies; an owned junction shares the runtime singleton.
// The separate contracts resolution copy retains its explicit root bridge and duplicate-identity control.
// Package/dist mutations still reach the same resolution inputs.
export function isolated(action) {
  mkdirSync(parent,{recursive:true});
  const root=mkdtempSync(path.join(parent,'project-boundary-'));
  const write=(relative,content)=>{
    const file=path.join(root,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,typeof content==='string'?content:JSON.stringify(content));
    const mirrored=relative.match(/^packages\/(contracts|runtime|engine|project)\/(package.json|dist\/.*)$/);
    if(mirrored) {const target=path.join(root,'node_modules/@egret',mirrored[1],mirrored[2]);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,readFileSync(file));}
  };
  const edit=(relative,change)=>{const file=path.join(root,relative);write(relative,change(readFileSync(file,'utf8')));};
  try {
    for(const name of ['contracts','runtime','engine','project']) {
      for(const entry of ['package.json','tsconfig.json','src','dist',...(name==='engine'?['web','rendering','tsconfig.web.json','tsconfig.rendering.json']:[])]) cpSync(path.join(repository,'packages',name,entry),path.join(root,'packages',name,entry),{recursive:true});
      mkdirSync(path.join(root,'node_modules/@egret'),{recursive:true});
      if(name==='runtime') {
        const runtimeRoot=path.join(root,'packages',name),runtimeLink=path.join(root,'node_modules/@egret',name);
        symlinkSync(runtimeRoot,runtimeLink,'junction');
        assert.equal(realpathSync(runtimeLink),realpathSync(runtimeRoot));
      } else cpSync(path.join(root,'packages',name),path.join(root,'node_modules/@egret',name),{recursive:true});
    }
    for(const name of ['jsonc-parser','robust-predicates']) {
      const require=createRequire(path.join(repository,'packages',name==='jsonc-parser'?'project':'engine','package.json'));
      const entry=realpathSync(require.resolve(name));
      const installed=name==='jsonc-parser'?path.resolve(path.dirname(entry),'../..'):path.dirname(entry);
      cpSync(installed,path.join(root,'node_modules',name),{recursive:true});
    }
    // Preserve the actual contracts root bytes in packages; only its resolution copy is a bridge.
    const contractsRoot = readFileSync(path.join(root,'packages/contracts/dist/index.js'));
    assert.deepEqual(readFileSync(path.join(root,'node_modules/@egret/contracts/dist/index.js')), contractsRoot);
    write('node_modules/@egret/contracts/dist/index.js', "export * from '../../../../packages/contracts/dist/index.js';\n");
    assert.deepEqual(readFileSync(path.join(root,'packages/contracts/dist/index.js')), contractsRoot);
    // The optional metadata entry must use the same genuine admission registry.
    // Only the resolution copy is a bridge; canonical source/emission stays real.
    const resourceEntry = 'packages/contracts/dist/resources/index.js';
    const resourceBytes = readFileSync(path.join(root,resourceEntry));
    assert.deepEqual(readFileSync(path.join(root,'node_modules/@egret/contracts/dist/resources/index.js')),resourceBytes);
    write('node_modules/@egret/contracts/dist/resources/index.js',"export * from '../../../../../packages/contracts/dist/resources/index.js';\n");
    assert.deepEqual(readFileSync(path.join(root,resourceEntry)),resourceBytes);
    // Manifest bindings also retain one canonical private owner across the
    // optional Engine and browser resolution copies. No binding is synthesized.
    const bindingEntry = 'packages/engine/dist/manifestResourceState.js';
    const bindingBytes = readFileSync(path.join(root,bindingEntry));
    assert.deepEqual(readFileSync(path.join(root,'node_modules/@egret/engine/dist/manifestResourceState.js')),bindingBytes);
    write('node_modules/@egret/engine/dist/manifestResourceState.js',"export * from '../../../../packages/engine/dist/manifestResourceState.js';\n");
    assert.deepEqual(readFileSync(path.join(root,bindingEntry)),bindingBytes);
    // The explicit GL facade shares the original Host factory.
    // Bridge only the resolution copy; source and emitted package bytes stay real.
    for(const name of ['web/WebGL2Host']) {
      const relative='packages/engine/dist/'+name+'.js';
      const actual=readFileSync(path.join(root,relative));
      const resolution='node_modules/@egret/engine/dist/'+name+'.js';
      assert.deepEqual(readFileSync(path.join(root,resolution)),actual);
      write(resolution,"export * from '../../../../../"+relative+"';\n");
      assert.deepEqual(readFileSync(path.join(root,relative)),actual);
    }
    write('tools/check-boundaries.mjs',readFileSync(path.join(repository,'tools/check-boundaries.mjs'),'utf8'));
    return action({root,write,edit,check:()=>run(['tools/check-boundaries.mjs'],root)});
  } finally {
    const resolved=realpathSync(root);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('project-boundary-'));
    const runtimeLink=path.join(resolved,'node_modules/@egret/runtime');
    if(existsSync(runtimeLink)) assert.equal(realpathSync(runtimeLink),realpathSync(path.join(resolved,'packages/runtime')),'runtime junction stays in the owned copied graph');
    rmSync(resolved,{recursive:true,force:true});
    assert.equal(existsSync(resolved),false);
  }
}

// A successful whole gate also reaches the retained native compiler/type owners.
// Copy those real inputs; all generated sources/configurations stay inside this fixture.
export function prepareTypeFixture({root}) {
  const copy=relative=>{
    const target=path.join(root,relative);
    ownerRelativePath(root,target);
    mkdirSync(path.dirname(target),{recursive:true});
    cpSync(path.join(repository,relative),target,{recursive:true});
  };
  copy('tests/types');
  for(const relative of ['packages/engine/tests/geometry-contract-types.ts','packages/engine/tests/profile-contract-types.ts','package.json','pnpm-lock.yaml','tsconfig.base.json'])copy(relative);
  // Preserve the real tool dependency tree instead of predicting individual helper imports.
  // Every source entry is regular and owned; no external link becomes fixture authority.
  assert.equal(ownerRelativePath(realpathSync(repository),realpathSync(path.join(repository,'tools'))),'tools');
  const toolFiles=[];
  function inspectTools(relative){
    for(const entry of readdirSync(path.join(repository,relative),{withFileTypes:true})){
      assert.equal(entry.isSymbolicLink(),false,'Tool fixture input must not be a link: '+relative+'/'+entry.name);
      const file=relative+'/'+entry.name;
      if(entry.isDirectory())inspectTools(file);else{assert.equal(entry.isFile(),true,'Regular tool fixture input required: '+file);toolFiles.push(file);}
    }
  }
  inspectTools('tools');copy('tools');
  for(const file of toolFiles)assert.deepEqual(readFileSync(path.join(root,file)),readFileSync(path.join(repository,file)),file);

  // Read-only stock compiler inputs are copied, never mocked or linked outside the owner.
  const compilerOwner=realpathSync(path.join(repository,'node_modules/typescript'));
  const compilerMetadata=JSON.parse(readFileSync(path.join(compilerOwner,'package.json'),'utf8'));
  assert.equal(compilerMetadata.name,'typescript');
  assert.equal(compilerMetadata.version,'7.0.2');
  const nativeName='@typescript/typescript-'+process.platform+'-'+process.arch;
  const nativeOwner=path.dirname(realpathSync(createRequire(path.join(compilerOwner,'package.json')).resolve(nativeName+'/package.json')));
  const nativeMetadata=JSON.parse(readFileSync(path.join(nativeOwner,'package.json'),'utf8'));
  assert.equal(nativeMetadata.name,nativeName);
  assert.equal(nativeMetadata.version,compilerMetadata.version);
  const compilerTarget=path.join(root,'node_modules/typescript');
  const nativeTarget=path.join(root,'node_modules',nativeName);
  ownerRelativePath(root,compilerTarget);ownerRelativePath(root,nativeTarget);
  mkdirSync(path.dirname(nativeTarget),{recursive:true});
  cpSync(compilerOwner,compilerTarget,{recursive:true});
  cpSync(nativeOwner,nativeTarget,{recursive:true});
  assert.deepEqual(readFileSync(path.join(compilerTarget,'package.json')),readFileSync(path.join(compilerOwner,'package.json')));
  assert.deepEqual(readFileSync(path.join(nativeTarget,'package.json')),readFileSync(path.join(nativeOwner,'package.json')));

  // Type gates qualify physical public aliases against the four genuine copied packages.
  // Runtime boundary controls above retain their distinct resolution copies and bridges.
  for(const name of ['contracts','runtime','engine','project']) {
    const alias=path.join(root,'node_modules/@egret',name),target=path.join(root,'packages',name);
    if(!samePhysicalPath(realpathSync(alias),realpathSync(target))) {
      assert.equal(ownerRelativePath(realpathSync(root),realpathSync(alias)),'node_modules/@egret/'+name);
      rmSync(alias,{recursive:true,force:false});
      symlinkSync(target,alias,'junction');
    }
    assert.equal(ownerRelativePath(realpathSync(root),realpathSync(alias)),'packages/'+name);
    assert.equal(samePhysicalPath(realpathSync(alias),realpathSync(target)),true);
  }
  assert.deepEqual(readFileSync(path.join(root,'tools/check-types.mjs')),readFileSync(path.join(repository,'tools/check-types.mjs')));
}
