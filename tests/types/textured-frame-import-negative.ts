// Keep forbidden imports isolated from working positive/misuse declarations.
// @ts-expect-error FRAME_PROFILE_IMPORT_CASE root-registrar TS2305
import {registerSharedFrame} from '@egret/engine';
// @ts-expect-error FRAME_PROFILE_IMPORT_CASE root-workspace-capture-port TS2305
import {collectSharedFrameContent} from '@egret/engine';
void registerSharedFrame; void collectSharedFrameContent;
