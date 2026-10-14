// SPDX-License-Identifier: Apache-2.0
import {createBitmapButton,createMouseInput} from '@egret/engine/web/input';
import type {BitmapButtonOptions,BitmapButton,BitmapButtonState,MouseInput,MouseInputPayload} from '@egret/engine/web/input';
import type {Engine,Scope,AssetLease,Texture,TextureRegion2D,Bitmap} from '@egret/engine';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Expect<T extends true>=T;
type State=Expect<Equal<BitmapButtonState,'up'|'pressed'|'disabled'|'disposed'>>;
type Factory=Expect<Equal<typeof createBitmapButton,(options:BitmapButtonOptions)=>BitmapButton>>;
type Keys=Expect<Equal<Extract<keyof BitmapButton,string>,'display'|'state'|'enabled'|'dispose'>>;
type Options=Expect<Equal<BitmapButtonOptions,{readonly engine:Engine;readonly scope:Scope;readonly input:MouseInput;readonly textureLease:AssetLease<Texture>;readonly skins:{readonly up:TextureRegion2D;readonly pressed:TextureRegion2D;readonly disabled:TextureRegion2D};readonly enabled?:boolean;readonly onActivate:(payload:MouseInputPayload)=>void}>>;
declare const engine:Engine;
declare const scope:Scope;
declare const textureLease:AssetLease<Texture>;
const input=createMouseInput({engine,scope,width:100,height:80});
const skins={up:{x:0,y:0,width:8,height:6},pressed:{x:8,y:0,width:8,height:6},disabled:{x:16,y:0,width:8,height:6}};
const options:BitmapButtonOptions={engine,scope,input,textureLease,skins,onActivate(payload){const x:number=payload.globalX;const pointer:'mouse'=payload.pointerType;const primary:0=payload.button;void[x,pointer,primary];}};
const button:BitmapButton=scope.use(createBitmapButton(options));
const disabled:BitmapButton=createBitmapButton({...options,enabled:false});
const bitmap:Bitmap=button.display;
const state:BitmapButtonState=button.state;
const enabled:boolean=button.enabled;
button.enabled=false;button.enabled=true;
engine.stage.addChild(bitmap);
const retired:void=button.dispose();
// A void callback type permits async implementations; runtime admission is separate.
createBitmapButton({...options,onActivate:async()=>{}}).dispose();
void[disabled,state,enabled,retired];
export type ExactBitmapButtonContract=State|Factory|Keys|Options;
