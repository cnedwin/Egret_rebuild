// Original NS1 route checks separate absent named exports from package resolution.
// Existing optional entries must retain their own declarations without this API.
import * as Engine from "@egret/engine";
import * as Runtime from "@egret/runtime";
// NSI engine-insets-not-value
void Engine.NineSliceInsets2D;
// NSI engine-options-not-value
void Engine.NineSliceGeometry2DOptions;
// NSI runtime-insets-not-value
void Runtime.NineSliceInsets2D;
// NSI runtime-options-not-value
void Runtime.NineSliceGeometry2DOptions;

// NSI canvas-no-factory
import { createNineSliceGeometry2D as canvasFactory } from "@egret/engine/web";
// NSI canvas-no-insets-type
import type { NineSliceInsets2D as CanvasInsets } from "@egret/engine/web";
// NSI canvas-no-options-type
import type { NineSliceGeometry2DOptions as CanvasOptions } from "@egret/engine/web";
// NSI webgpu-no-factory
import { createNineSliceGeometry2D as webGPUFactory } from "@egret/engine/webgpu";
// NSI webgpu-no-insets-type
import type { NineSliceInsets2D as WebGPUInsets } from "@egret/engine/webgpu";
// NSI webgpu-no-options-type
import type { NineSliceGeometry2DOptions as WebGPUOptions } from "@egret/engine/webgpu";
// NSI scene3d-no-factory
import { createNineSliceGeometry2D as sceneFactory } from "@egret/engine/scene3d";
// NSI scene3d-no-insets-type
import type { NineSliceInsets2D as SceneInsets } from "@egret/engine/scene3d";
// NSI scene3d-no-options-type
import type { NineSliceGeometry2DOptions as SceneOptions } from "@egret/engine/scene3d";
// NSI webgpu-scene3d-no-factory
import { createNineSliceGeometry2D as sceneHostFactory } from "@egret/engine/webgpu/scene3d";
// NSI webgpu-scene3d-no-insets-type
import type { NineSliceInsets2D as SceneHostInsets } from "@egret/engine/webgpu/scene3d";
// NSI webgpu-scene3d-no-options-type
import type { NineSliceGeometry2DOptions as SceneHostOptions } from "@egret/engine/webgpu/scene3d";
// NSI engine-text-no-factory
import { createNineSliceGeometry2D as engineTextFactory } from "@egret/engine/text";
// NSI engine-text-no-insets-type
import type { NineSliceInsets2D as EngineTextInsets } from "@egret/engine/text";
// NSI engine-text-no-options-type
import type { NineSliceGeometry2DOptions as EngineTextOptions } from "@egret/engine/text";
// NSI runtime-text-no-factory
import { createNineSliceGeometry2D as runtimeTextFactory } from "@egret/runtime/text";
// NSI runtime-text-no-insets-type
import type { NineSliceInsets2D as RuntimeTextInsets } from "@egret/runtime/text";
// NSI runtime-text-no-options-type
import type { NineSliceGeometry2DOptions as RuntimeTextOptions } from "@egret/runtime/text";
// NSI mouse-input-no-factory
import { createNineSliceGeometry2D as inputFactory } from "@egret/engine/web/input";
// NSI mouse-input-no-insets-type
import type { NineSliceInsets2D as InputInsets } from "@egret/engine/web/input";
// NSI mouse-input-no-options-type
import type { NineSliceGeometry2DOptions as InputOptions } from "@egret/engine/web/input";
// NSI canvas-text-no-factory
import { createNineSliceGeometry2D as canvasTextFactory } from "@egret/engine/web/text";
// NSI canvas-text-no-insets-type
import type { NineSliceInsets2D as CanvasTextInsets } from "@egret/engine/web/text";
// NSI canvas-text-no-options-type
import type { NineSliceGeometry2DOptions as CanvasTextOptions } from "@egret/engine/web/text";
// NSI contracts-no-factory
import { createNineSliceGeometry2D as contractsFactory } from "@egret/contracts";
// NSI contracts-no-insets-type
import type { NineSliceInsets2D as ContractsInsets } from "@egret/contracts";
// NSI contracts-no-options-type
import type { NineSliceGeometry2DOptions as ContractsOptions } from "@egret/contracts";

// This separate group tests package-export refusal, not a named-export oracle.
// NSI runtime-no-new-subpath
import { createNineSliceGeometry2D as runtimeSubpathFactory } from "@egret/runtime/nine-slice";
// NSI engine-no-new-subpath
import { createNineSliceGeometry2D as engineSubpathFactory } from "@egret/engine/nine-slice";
// NSI runtime-source-not-public
import { createNineSliceGeometry2D as runtimeSourceFactory } from "@egret/runtime/src/NineSliceGeometry2D.js";
// NSI engine-source-not-public
import { createNineSliceGeometry2D as engineSourceFactory } from "@egret/engine/src/NineSliceGeometry2D.js";

void canvasFactory; void webGPUFactory; void sceneFactory; void sceneHostFactory;
void engineTextFactory; void runtimeTextFactory; void inputFactory; void canvasTextFactory;
void contractsFactory; void runtimeSubpathFactory; void engineSubpathFactory;
void runtimeSourceFactory; void engineSourceFactory;
export type { CanvasInsets, CanvasOptions, WebGPUInsets, WebGPUOptions,
  SceneInsets, SceneOptions, SceneHostInsets, SceneHostOptions, EngineTextInsets, EngineTextOptions,
  RuntimeTextInsets, RuntimeTextOptions, InputInsets, InputOptions, CanvasTextInsets, CanvasTextOptions,
  ContractsInsets, ContractsOptions };
