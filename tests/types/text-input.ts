// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the text input entry: what it may write, and five things it may not.
import {createBrowserTextInput} from '@egret/engine/web/text-input';
import type {BrowserTextInput,BrowserTextInputRequest,BrowserTextInputChange,BrowserTextInputSnapshot} from '@egret/engine/web/text-input';
declare const canvas:HTMLCanvasElement;
const input:BrowserTextInput=createBrowserTextInput({canvas,logicalWidth:480,logicalHeight:300,zIndex:2,isolateKeys:true,onError:(cause:unknown)=>{void cause;}});
const request:BrowserTextInputRequest={x:0,y:0,width:100,height:30,value:'',maxLength:8,inputMode:'text',enterKeyHint:'done',color:0xffffff,blur:'commit',
 onChange:(change:BrowserTextInputChange)=>{const text:string=change.value,held:boolean=change.composing;void text;void held;},onCommit:(value:string)=>{void value;},onCancel:()=>{}};
input.open(request);input.open({...request,multiline:true});input.move({x:1,y:2,width:3,height:4});input.resize(1,1);input.sync();input.setValue('');input.commit();input.cancel();
const snapshot:BrowserTextInputSnapshot=input.getSnapshot(),state:'idle'|'open'|'disposed'=snapshot.state;void state;input.dispose();
// @ts-expect-error a session needs its rectangle
input.open({value:''});
// @ts-expect-error a colour is a number
input.open({...request,color:'#ffffff'});
// @ts-expect-error the canvas is required
createBrowserTextInput({logicalWidth:1,logicalHeight:1});
// @ts-expect-error a snapshot is read-only
snapshot.value='';
// @ts-expect-error the root entry does not have the factory
import {createBrowserTextInput as leaked} from '@egret/engine';
void leaked;
