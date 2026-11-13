// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the text field control: what it may write, and seven things it may not.
import {createTextFieldControl} from '@egret/engine/ui';
import type {TextFieldChange,TextFieldControl,TextFieldControlOptions,TextFieldEditor,TextFieldRectangle,TextFieldSession} from '@egret/engine/ui';
import {createBrowserTextInput} from '@egret/engine/web/text-input';
import type {BrowserTextInput} from '@egret/engine/web/text-input';
import type {PointerInput} from '@egret/engine/input';
import type {DisplayObject} from '@egret/engine';
declare const input:PointerInput,target:DisplayObject,canvas:HTMLCanvasElement;
// The platform text input is an editor as it is: its request takes the session the control adds and a presentation.
const platform:BrowserTextInput=createBrowserTextInput({canvas,logicalWidth:480,logicalHeight:300});
const field:TextFieldControl=createTextFieldControl({input,target,editor:platform,value:'张三',maxLength:8,placeholder:'最多 8 个字',label:'Name',
 field:()=>({x:40,y:94,width:400,height:40,fontFamily:'sans-serif',fontSize:20,color:0xf3e9d2,select:'all' as const}),
 onChange:(value:string,previous:string)=>{void value;void previous;},onInput:(change:TextFieldChange)=>{const text:string=change.value,composing:boolean=change.composing;void text;void composing;},
 onEditingChange:(editing:boolean)=>{void editing;},onPressChange:(pressed:boolean)=>{void pressed;}});
const state:readonly [string,string,boolean,boolean,boolean,boolean]=[field.value,field.draft,field.composing,field.editing,field.pressed,field.enabled];void state;
const began:boolean=field.edit();void began;
field.commit();field.cancel();field.setValue('李四');field.press();field.release();field.setEnabled(false);field.dispose();
// An editor of the application's own, with a presentation of its own.
interface Shown extends TextFieldRectangle {readonly skin:string;}
const own:TextFieldEditor<Shown&TextFieldSession>={open(request){const skin:string=request.skin,value:string=request.value,multiline:boolean=request.multiline;void skin;void value;void multiline;request.onCommit(value);},commit(){},cancel(){},setValue(value:string){void value;}};
const options:TextFieldControlOptions<Shown>={input,target,editor:own,field:()=>({x:0,y:0,width:10,height:10,skin:'dark'}),multiline:true};
createTextFieldControl(options).dispose();
// @ts-expect-error a field says where it is
createTextFieldControl({input,target,editor:platform});
// @ts-expect-error the place is a rectangle
createTextFieldControl({input,target,editor:platform,field:()=>({x:0,y:0,width:10})});
// @ts-expect-error an editor opens, commits, cancels and sets
createTextFieldControl({input,target,editor:{open(){}},field:()=>({x:0,y:0,width:10,height:10})});
// @ts-expect-error a presentation the editor does not take is refused
createTextFieldControl({input,target,editor:platform,field:()=>({x:0,y:0,width:10,height:10,fontSize:'large'})});
// @ts-expect-error the value is read-only
field.value='other';
// @ts-expect-error a change is told as the new text and the old
createTextFieldControl({input,target,editor:platform,field:()=>({x:0,y:0,width:10,height:10}),onChange:(value:number)=>{void value;}});
// @ts-expect-error the root entry does not have the factory
import {createTextFieldControl as leaked} from '@egret/engine';
void leaked;
