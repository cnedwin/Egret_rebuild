// MOUSE_INPUT_CASE no-root-factory
import {createMouseInput} from '@egret/engine';
// MOUSE_INPUT_CASE no-root-types
import type {MouseInput} from '@egret/engine';
// MOUSE_INPUT_CASE no-default-web-factory
import {createMouseInput as defaultWebInput} from '@egret/engine/web';
// MOUSE_INPUT_CASE no-default-web-types
import type {MouseInputOptions} from '@egret/engine/web';
// MOUSE_INPUT_CASE no-gpu-input
import {createMouseInput as gpuInput} from '@egret/engine/webgpu';
// MOUSE_INPUT_CASE no-gpu-input-types
import type {MouseInputState} from '@egret/engine/webgpu';
// MOUSE_INPUT_CASE no-runtime-factory
import {createMouseInput as runtimeInput} from '@egret/runtime';
// MOUSE_INPUT_CASE no-engine-display-assembly
import {createDisplayInputOperations} from '@egret/engine';
// MOUSE_INPUT_CASE no-engine-display-assembly-type
import type {DisplayInputOperations} from '@egret/engine';
// MOUSE_INPUT_CASE no-optional-owner-port
import {createMouseInputOwner} from '@egret/engine/web/input';
// MOUSE_INPUT_CASE no-optional-native-port
import type {MouseInputNativeFactory} from '@egret/engine/web/input';
// MOUSE_INPUT_CASE no-cancel-seventh-type
import type {MouseInputCancelPayload} from '@egret/engine/web/input';
// MOUSE_INPUT_CASE no-deep-browser-module
import {createMouseInput as deepBrowserInput} from '@egret/engine/web/MouseInput';
// MOUSE_INPUT_CASE no-deep-owner-module
import {createMouseInputOwner as deepOwner} from '@egret/engine/src/mouseInput';
// MOUSE_INPUT_CASE no-deep-registry
import {requireMouseInputEngine} from '@egret/engine/internal/mouseInputFactoryState';
void createMouseInput;void defaultWebInput;void gpuInput;void runtimeInput;void createDisplayInputOperations;void createMouseInputOwner;void deepBrowserInput;void deepOwner;void requireMouseInputEngine;
