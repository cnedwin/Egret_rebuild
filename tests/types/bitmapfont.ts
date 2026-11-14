// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the bitmapfont entry: what it may write, and five things it may not.
import {createBitmapText,layoutBitmapText,parseBitmapFont} from '@egret/engine/bitmapfont';
import type {BitmapFont,BitmapGlyph,BitmapText,BitmapTextGlyph,BitmapTextLayout,BitmapTextLayoutOptions,BitmapTextLine,BitmapTextOptions} from '@egret/engine/bitmapfont';
import type {AssetLease,Scope,Texture} from '@egret/engine';
declare const scope:Scope,page:AssetLease<Texture>,source:string;
const font:BitmapFont=parseBitmapFont(source),first:BitmapGlyph|undefined=font.glyph(65),pair:number=font.kerning(65,66);void first;void pair;
const layoutOptions:BitmapTextLayoutOptions={maxWidth:200,align:'center',letterSpacing:1,lineSpacing:4,kerning:true,fallback:null};
const laid:BitmapTextLayout=layoutBitmapText(font,'武林天下',layoutOptions),lines:readonly BitmapTextLine[]=laid.lines,glyphs:readonly BitmapTextGlyph[]=laid.glyphs;void lines;void glyphs;
const options:BitmapTextOptions={font,pages:[page],text:'Score 100',color:0xffd34d,align:'right',maxWidth:120};
const label:BitmapText=scope.use(createBitmapText(options));
label.text='Score 200';label.color=0xffffff;label.maxWidth=undefined;label.align='left';label.letterSpacing=2;label.lineSpacing=0;
const size:number=label.width+label.height;void size;
// @ts-expect-error text needs its font
createBitmapText({pages:[page]});
// @ts-expect-error a line is aligned left, centre or right
label.align='middle';
// @ts-expect-error the text is a string
label.text=100;
// @ts-expect-error what was laid out is read, not written
label.layout=laid;
// @ts-expect-error a font is read, not changed
font.lineHeight=10;
