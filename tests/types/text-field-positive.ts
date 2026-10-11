import { createTextField } from '@egret/engine/text';
import type { TextField, TextFieldStatus, TextRasterCache, TextRasterMetrics, TextRasterRequestInput } from '@egret/engine/text';
import type { DisplayObject, Engine, Scope } from '@egret/engine';
import type { Rectangle2D } from '@egret/engine';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?
  (<T>()=>T extends B?1:2)extends(<T>()=>T extends A?1:2)?true:false:false;
type Assert<T extends true>=T;
type Factory=Assert<Equal<typeof createTextField,(engine:Engine,scope:Scope,cache:TextRasterCache)=>TextField>>;
type Status=Assert<Equal<TextFieldStatus,{
  readonly state:'unprepared'|'ready'|'disposed';readonly desiredRevision:number;
  readonly committedRevision:number|undefined;readonly pending:boolean;readonly metrics:TextRasterMetrics|undefined;
}>>;
type Setter=Assert<Equal<TextField['setRequest'],(input:TextRasterRequestInput)=>void>>;
type Prepare=Assert<Equal<TextField['prepare'],()=>Promise<TextRasterMetrics>>>;
type Observe=Assert<Equal<TextField['getStatus'],()=>TextFieldStatus>>;
type Dispose=Assert<Equal<TextField['dispose'],()=>void>>;
type Display=Assert<TextField extends DisplayObject?true:false>;
declare const engine:Engine,scope:Scope,cache:TextRasterCache,input:TextRasterRequestInput;
const field:TextField=createTextField(engine,scope,cache);
field.setRequest(input);
const preparing:Promise<TextRasterMetrics>=field.prepare();
const snapshot:TextFieldStatus=field.getStatus();
const bounds:Rectangle2D=field.getBounds();
engine.stage.addChild(field);scope.use(field);field.dispose();
void [preparing,snapshot,bounds];
export type {Factory,Status,Setter,Prepare,Observe,Dispose,Display};
