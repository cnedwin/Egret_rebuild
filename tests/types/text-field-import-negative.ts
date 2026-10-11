// TEXT_FIELD_IMPORT_CASE root-factory TS2724
import {createTextField as rootFactory} from '@egret/engine';
// TEXT_FIELD_IMPORT_CASE runtime-text-factory TS2305
import {createTextField as runtimeTextFactory} from '@egret/runtime/text';
// TEXT_FIELD_IMPORT_CASE runtime-root-factory TS2724
import {createTextField as runtimeFactory} from '@egret/runtime';
// TEXT_FIELD_IMPORT_CASE web-factory TS2305
import {createTextField as webFactory} from '@egret/engine/web';
// TEXT_FIELD_IMPORT_CASE gpu-factory TS2305
import {createTextField as gpuFactory} from '@egret/engine/webgpu';
// TEXT_FIELD_IMPORT_CASE root-field-type TS2305
import type {TextField as RootField} from '@egret/engine';
// TEXT_FIELD_IMPORT_CASE runtime-field-type TS2305
import type {TextField as RuntimeField} from '@egret/runtime/text';
// TEXT_FIELD_IMPORT_CASE root-status-type TS2305
import type {TextFieldStatus as RootStatus} from '@egret/engine';
// TEXT_FIELD_IMPORT_CASE private-leaf-factory TS2724
import {createTextFieldLeaf} from '@egret/engine/text';
// TEXT_FIELD_IMPORT_CASE private-registration TS2305
import {registerTextFieldEngine} from '@egret/engine/text';
// TEXT_FIELD_IMPORT_CASE private-engine-module TS2307
import {createTextField as privateFactory} from '@egret/engine/textField';
// TEXT_FIELD_IMPORT_CASE private-runtime-module TS2307
import {createTextFieldLeaf as privateLeaf} from '@egret/runtime/text/TextField';
void [rootFactory,runtimeTextFactory,runtimeFactory,webFactory,gpuFactory,createTextFieldLeaf,registerTextFieldEngine,privateFactory,privateLeaf];
export type {RootField,RuntimeField,RootStatus};
