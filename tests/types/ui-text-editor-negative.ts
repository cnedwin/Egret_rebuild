// SPDX-License-Identifier: Apache-2.0
import type {UiTextEditor,TextEditSelection} from '@egret/engine/ui/editing';
import type {BrowserTextEditor,BrowserEditorFontSet} from '@egret/engine/web/editing';
declare const editor:UiTextEditor,bridge:BrowserTextEditor,fonts:BrowserEditorFontSet;
editor.setValue(123);
editor.setSelection({anchor:0,focus:0,affinity:'sideways'});
editor.mode='single-line';
bridge.setFontSet({key:fonts.key,fontFamilies:fonts.fontFamilies,identities:[],isDisposed:false,closed:Promise.resolve(),dispose(){}});
const selection:TextEditSelection={anchor:0,focus:'end'};void selection;
bridge.sync({width:100});
