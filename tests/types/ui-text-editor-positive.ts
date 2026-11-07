// SPDX-License-Identifier: Apache-2.0
import type {Engine,Scope} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createUiTextEditor} from '@egret/engine/ui/editing';
import type {UiTextEditorChange,UiTextEditorTarget} from '@egret/engine/ui/editing';
import {createBrowserTextEditor,createBrowserEditorFontProvider} from '@egret/engine/web/editing';
import type {BrowserEditorFontSet,EditorParagraphFontLoader,BrowserTextEditorSnapshot} from '@egret/engine/web/editing';
import type {ParagraphCache} from '@egret/engine/paragraph';
import type {FontContentLoader} from '@egret/engine/resources';
declare const engine:Engine,scope:Scope,cache:ParagraphCache,fonts:BrowserEditorFontSet,paragraphProvider:EditorParagraphFontLoader,loader:FontContentLoader,canvas:HTMLCanvasElement;
const editor=createUiTextEditor({engine,scope,cache,mode:'multiline',value:'Hello 中文',style:{fontSet:fonts.key,fontFamilies:fonts.fontFamilies,fontSize:20,locale:'und',direction:'ltr',fillColor:0xffffff},onChange(change:UiTextEditorChange){void change.contentRevision;}});
const root=createUiRoot({engine,scope,id:'editor',viewport:{width:200,height:200},density:1,tree:{kind:'leaf',id:'body',content:editor.content}});
const target:UiTextEditorTarget={kind:'leaf',id:'body'};
const bridge=createBrowserTextEditor({editor,root,target,canvas,fonts,logicalWidth:200,logicalHeight:200,label:'Body',onInvalidate(){void editor.snapshot();}});
const snapshot:BrowserTextEditorSnapshot=bridge.snapshot();void snapshot;
editor.setValue('Next',{selection:{anchor:0,focus:2},expectedRevision:editor.snapshot().revision,cancelComposition:true});
editor.setSelection({anchor:2,focus:0,affinity:'upstream'});editor.getTextGeometry(root,target)?.getCaret(0);
bridge.activate({x:1,y:1});bridge.sync();bridge.finish();bridge.setFontSet(fonts);bridge.setInteractive(false);bridge.dispose();
const provider=createBrowserEditorFontProvider({engine,scope,paragraphProvider});void provider.load(scope,loader,['e_font']);void provider.close();
