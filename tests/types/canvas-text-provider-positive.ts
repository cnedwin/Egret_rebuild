import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import type { TextRasterProvider, TextRasterRequestInput, TextRasterMetrics } from '@egret/engine/text';
import type { Engine, Scope } from '@egret/engine';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?
  (<T>()=>T extends B?1:2)extends(<T>()=>T extends A?1:2)?true:false:false;
type Assert<T extends true>=T;
type Factory=Assert<Equal<typeof createCanvasTextRasterProvider,()=>TextRasterProvider>>;
declare const engine:Engine,scope:Scope,request:TextRasterRequestInput;
const provider:TextRasterProvider=createCanvasTextRasterProvider();
const cache=createTextRasterCache(engine.assets,{provider});
const field=createTextField(engine,scope,cache);
field.setRequest(request);
const preparing:Promise<TextRasterMetrics>=field.prepare();
engine.stage.addChild(field);
field.dispose();cache.dispose();
void preparing;
export type {Factory};
