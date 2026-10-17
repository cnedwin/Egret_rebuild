// SPDX-License-Identifier: Apache-2.0
// An alias is accepted only after its package has a physical owner in this checkout.
import fs from 'node:fs';
import path from 'node:path';
import {fingerprintFile,ownerRelativePath} from './file-identity.mjs';
export function localPackage(root,directory,name,version){
 const owner=fs.realpathSync(directory);
 const relative=ownerRelativePath(root,path.join(owner,'package.json'));
 if(!relative.startsWith('node_modules/'))throw Error('Dependency is not owned by this checkout');
 fingerprintFile(root,relative);
 const metadata=JSON.parse(fs.readFileSync(path.join(owner,'package.json'),'utf8'));
 if(metadata.name!==name||metadata.version!==version)throw Error('Unexpected dependency identity: '+name);
 return owner;
}
