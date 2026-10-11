import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import type { TextRasterPlan } from '@egret/engine/text';
const provider=createCanvasTextRasterProvider();
declare const plan:TextRasterPlan;
// CANVAS_TEXT_CASE no-options TS2554
createCanvasTextRasterProvider({});
// CANVAS_TEXT_CASE no-supplied-document TS2554
createCanvasTextRasterProvider(document);
// CANVAS_TEXT_CASE not-constructor TS7009
new createCanvasTextRasterProvider();
// CANVAS_TEXT_CASE readonly-identity TS2540
provider.identity='replacement';
// CANVAS_TEXT_CASE readonly-profile TS2540
provider.profile='canvas-explicit-lines-v1';
// CANVAS_TEXT_CASE no-dispose TS2339
provider.dispose();
// CANVAS_TEXT_CASE no-font-loader TS2339
provider.loadFont('OwnedFace');
// CANVAS_TEXT_CASE release-not-promise TS2322
const released:Promise<void>=provider.release(plan);
// CANVAS_TEXT_CASE measure-arguments TS2554
provider.measure();
// CANVAS_TEXT_CASE raster-arguments TS2554
provider.rasterize(plan);
// CANVAS_TEXT_CASE forged-plan TS2739
provider.release({});
// CANVAS_TEXT_CASE no-provider-options TS2339
provider.maxPlans=100;
void released;
