// SPDX-License-Identifier: Apache-2.0
// Unsuppressed negatives: freeze actual diagnostic tuples only after execution.
import { createF2CoreResources } from '../dist/index.js';
import type { F2CoreResources,F2CoreInstance,F2CoreCreateOptions } from '../dist/index.js';
import type { Engine,Scope,AssetRef,Texture } from '@egret/engine';
import type { SpineImportInput } from '@egret/project/spine';
declare const engine:Engine,scope:Scope,input:SpineImportInput,pageRef:AssetRef<Texture>,resources:F2CoreResources,instance:F2CoreInstance;
const fake:Texture={width:16,height:16,isDisposed:false,dispose(){}};
