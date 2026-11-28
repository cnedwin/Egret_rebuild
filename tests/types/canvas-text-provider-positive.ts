import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import type { TextRasterProvider, TextRasterRequestInput, TextRasterMetrics } from '@egret/engine/text';
import type { Engine, Scope } from '@egret/engine';
import type { CancellationSignal } from '@egret/contracts';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?
  (<T>()=>T extends B?1:2)extends(<T>()=>T extends A?1:2)?true:false:false;
type Assert<T extends true>=T;
type Schedule=<T>(job:()=>T,signal:CancellationSignal)=>Promise<Awaited<T>>;
type Factory=Assert<Equal<typeof createCanvasTextRasterProvider,(options?:{readonly schedule?:Schedule})=>TextRasterProvider>>;
declare const engine:Engine,scope:Scope,request:TextRasterRequestInput;
declare const schedule:Schedule;
const provider:TextRasterProvider=createCanvasTextRasterProvider();
const scheduled:TextRasterProvider=createCanvasTextRasterProvider({schedule});
const cache=createTextRasterCache(engine.assets,{provider});
const field=createTextField(engine,scope,cache);
field.setRequest(request);
const preparing:Promise<TextRasterMetrics>=field.prepare();
engine.stage.addChild(field);
field.dispose();cache.dispose();
void preparing;void scheduled;
export type {Factory};
