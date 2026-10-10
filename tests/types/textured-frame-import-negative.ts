// Keep forbidden imports isolated from working positive/misuse declarations.
// @ts-expect-error TEXTURED_FRAME_IMPORT_CASE root-registrar TS2305
import {registerTexturedFrame} from '@egret/engine';
// @ts-expect-error TEXTURED_FRAME_IMPORT_CASE root-workspace-capture-port TS2305
import {collectTexturedFrameContent} from '@egret/engine';
void registerTexturedFrame; void collectTexturedFrameContent;
