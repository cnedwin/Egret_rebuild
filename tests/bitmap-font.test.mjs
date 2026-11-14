// SPDX-License-Identifier: Apache-2.0
// Bitmap fonts: the BMFont and Egret forms read, text laid out in them, and drawn on a real Engine as one mesh for each page.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {createBitmapText,layoutBitmapText,parseBitmapFont} from '@egret/engine/bitmapfont';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const WU=0x6b66,LIN=0x6797,COMMA=0xff0c;
const TEXT=[
 'info face="Test Sans" size=-16 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1',
 'common lineHeight=20 base=16 scaleW=48 scaleH=16 pages=2 packed=0',
 'page id=0 file="test_0.png"',
 'page id=1 file="test_1.png"',
 'chars count=7',
 'char id=32   x=0  y=0 width=0  height=0  xoffset=0 yoffset=0 xadvance=5  page=0 chnl=15',
 'char id=65   x=0  y=0 width=10 height=12 xoffset=1 yoffset=4 xadvance=11 page=0 chnl=15',
 'char id=66   x=10 y=0 width=9  height=12 xoffset=1 yoffset=4 xadvance=10 page=0 chnl=15',
 'char id=63   x=20 y=0 width=8  height=12 xoffset=0 yoffset=4 xadvance=8  page=0 chnl=15',
 'char id='+WU+' x=0  y=0 width=16 height=16 xoffset=0 yoffset=2 xadvance=18 page=1 chnl=15',
 'char id='+LIN+' x=16 y=0 width=16 height=16 xoffset=0 yoffset=2 xadvance=18 page=1 chnl=15',
 'char id='+COMMA+' x=32 y=0 width=8  height=16 xoffset=0 yoffset=2 xadvance=18 page=1 chnl=15',
 'kernings count=1',
 'kerning first=65 second=66 amount=-2',
].join('\r\n');
const CHARS=[[32,0,0,0,0,0,0,5,0],[65,0,0,10,12,1,4,11,0],[66,10,0,9,12,1,4,10,0],[63,20,0,8,12,0,4,8,0],[WU,0,0,16,16,0,2,18,1],[LIN,16,0,16,16,0,2,18,1],[COMMA,32,0,8,16,0,2,18,1]];
const XML='<?xml version="1.0"?>\n<!-- a comment with <char id="1"/> in it -->\n<font>\n <info face="Test Sans" size="16"/>\n <common lineHeight="20" base="16" scaleW="48" scaleH="16" pages="2"/>\n <pages><page id="0" file="test_0.png"/><page id=\'1\' file="test_1.png"/></pages>\n <chars count="7">\n'
 +CHARS.map(([id,x,y,w,h,ox,oy,a,p])=>'  <char id="'+id+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" xoffset="'+ox+'" yoffset="'+oy+'" xadvance="'+a+'" page="'+p+'" chnl="15" />\n').join('')
 +' </chars>\n <kernings count="1"><kerning first="65" second="66" amount="-2" /></kernings>\n</font>\n';
const JSON_FONT={pages:['test_0.png','test_1.png'],info:{face:'Test Sans',size:16},common:{lineHeight:20,base:16,scaleW:48,scaleH:16},
 chars:CHARS.map(([id,x,y,width,height,xoffset,yoffset,xadvance,page])=>({id,x,y,width,height,xoffset,yoffset,xadvance,page,chnl:15})),kernings:[{first:65,second:66,amount:-2}]};
const EGRET={file:'numbers.png',frames:{'1':{x:0,y:0,w:8,h:12,offX:1,offY:2,sourceW:10,sourceH:16},'2':{x:8,y:0,w:9,h:14,offX:0,offY:1,sourceW:10,sourceH:16},'.':{x:17,y:0,w:4,h:4}}};
const font=parseBitmapFont(TEXT);
const glyphRow=g=>[g.id,g.x,g.y,g.width,g.height,g.xOffset,g.yOffset,g.xAdvance,g.page];

test('BF01 the text, XML and JSON forms of BMFont are read alike, with their pages, characters and kerning',()=>{
 for(const [source,format] of [[TEXT,'text'],[XML,'xml'],[JSON_FONT,'json'],[JSON.stringify(JSON_FONT),'json'],[String.fromCharCode(0xfeff)+'\n  '+XML,'xml']]){
  const read=parseBitmapFont(source);
  assert.equal(read.format,format);
  assert.deepEqual([read.face,read.size,read.lineHeight,read.base,read.pages],['Test Sans',16,20,16,['test_0.png','test_1.png']],format);
  assert.deepEqual(read.glyphs.map(glyphRow),[...CHARS].sort((a,b)=>a[0]-b[0]),format);
  assert.deepEqual(glyphRow(read.glyph(65)),CHARS[1]);
  assert.equal(read.glyph(64),undefined);
  assert.deepEqual([read.kerning(65,66),read.kerning(66,65),read.kerning(65,65)],[-2,0,0]);
  assert.ok(Object.isFrozen(read)&&Object.isFrozen(read.glyphs)&&Object.isFrozen(read.glyphs[0])&&Object.isFrozen(read.pages));
 }
 // Escaped attributes, single quotes and fonts that leave out what they may.
 const xml=parseBitmapFont('<font><info face="A&amp;B &#x6B66;&#26519; &lt;&quot;&gt;&apos;&bogus;"/><common lineHeight="10" base="8"/><page id="0" file="a.png"/></font>');
 assert.deepEqual([xml.face,xml.size,xml.glyphs.length],['A&B 武林 <">\'&bogus;',10,0]);
 const bare=parseBitmapFont('common lineHeight=10 base=8\npage id=0 file=plain.png\nchar id=65 x=0 y=0 width=1 height=1 xadvance=2\n\n   \n');
 assert.deepEqual([bare.face,bare.size,bare.pages[0],glyphRow(bare.glyph(65))],['',10,'plain.png',[65,0,0,1,1,0,0,2,0]]);
 assert.equal(parseBitmapFont({pages:['a.png'],common:{lineHeight:4,base:3},chars:[]}).face,'');
});

test('BF02 Egret\'s own fonts of frames are read: the size before trimming is the advance, and the tallest is the line',()=>{
 const read=parseBitmapFont(EGRET);
 assert.deepEqual([read.format,read.pages,read.lineHeight,read.base,read.size,read.face],['egret',['numbers.png'],16,16,16,'']);
 assert.deepEqual(read.glyphs.map(glyphRow),[[46,17,0,4,4,0,0,4,0],[49,0,0,8,12,1,2,10,0],[50,8,0,9,14,0,1,10,0]]);
 assert.deepEqual(parseBitmapFont(JSON.stringify({file:'f.png',frames:{'武':{x:0,y:0,w:20,h:22}}})).glyph(WU).xAdvance,20);
});

test('BF03 a font that cannot be read is refused with its own code',()=>{
 const without=line=>TEXT.split('\r\n').filter(l=>!l.startsWith(line)).join('\n');
 const swap=(from,to)=>TEXT.replace(from,to);
 const bad=[7,null,[],'','{"pages":',without('common'),swap('lineHeight=20','lineHeight=0'),swap('lineHeight=20','lineHeight=2.5'),swap('base=16','base=x'),without('page id=0'),swap('page id=1','page id=2'),
  swap('page id=1 file="test_1.png"','page id=0 file="again.png"'),swap('page id=1 file="test_1.png"','page id=1'),without('page'),
  swap('char id=66','char id=65'),swap('page=1 chnl=15\r\nchar id='+LIN,'page=2 chnl=15\r\nchar id='+LIN),swap('x=10','x=-1'),swap('width=9','width=-9'),swap('char id=63','char id=1114112'),swap('char id=63','char id=-1'),
  swap('xadvance=8 ','xadvance=8.5 '),swap('x=20 y=0','x=20 y=1e3'),TEXT+'\r\nkerning first=65 second=66 amount=1',TEXT+'\r\nkerning first=65 second=1114112 amount=1',TEXT+'\r\nkerning first=-1 second=65 amount=1',
  TEXT+'\r\nkerning first=65 second=67 amount=x','<fonts><common lineHeight="1" base="1"/></fonts>','<!-- <font> -->',
  {...JSON_FONT,common:null},{...JSON_FONT,pages:'a.png'},{...JSON_FONT,chars:{}},{...JSON_FONT,kernings:{}},{...JSON_FONT,info:7},{...JSON_FONT,info:{face:7}},{...JSON_FONT,pages:[7]},{...JSON_FONT,chars:[7]},
  {...JSON_FONT,kernings:[7]},{...JSON_FONT,chars:[{id:1,x:0,y:0,width:1,height:1}]},{...JSON_FONT,kernings:[{first:1,second:2}]},{...JSON_FONT,info:{size:'big'}},
  {file:7,frames:{}},{file:'a.png',frames:[]},{file:'a.png',frames:{ab:{x:0,y:0,w:1,h:1}}},{file:'a.png',frames:{a:7}},{file:'a.png',frames:{a:{x:0,y:0,w:1}}},{file:'a.png',frames:{}}];
 for(const source of bad)assert.throws(()=>parseBitmapFont(source),coded('BITMAP_FONT_INVALID'),typeof source==='string'?source.slice(-60):JSON.stringify(source));
});

test('BF04 a line is laid out by advances and kerning, each character at its offsets',()=>{
 const laid=layoutBitmapText(font,'AB');
 assert.deepEqual(laid.glyphs.map(g=>[g.codePoint,g.page,g.line,g.x,g.y,g.width,g.height,g.sourceX,g.sourceY]),[[65,0,0,1,4,10,12,0,0],[66,0,0,10,4,9,12,10,0]]);
 assert.deepEqual([laid.width,laid.height,laid.missing,laid.lines],[19,20,0,[{text:'AB',width:19,x:0,y:0}]]);
 assert.deepEqual(layoutBitmapText(font,'AB',{kerning:false}).glyphs.map(g=>g.x),[1,12]);
 const spaced=layoutBitmapText(font,'AB A',{letterSpacing:3});
 assert.deepEqual([spaced.width,spaced.glyphs.map(g=>g.x)],[11+3-2+10+3+5+3+11,[1,13,34]]);
 // A space draws nothing; one at the end of a line is not part of its width.
 assert.deepEqual([layoutBitmapText(font,'A  ').width,layoutBitmapText(font,'A  ').glyphs.length,layoutBitmapText(font,'  A').width],[11,1,21]);
 assert.ok(Object.isFrozen(laid)&&Object.isFrozen(laid.glyphs)&&Object.isFrozen(laid.lines[0]));
});

test('BF05 lines break at line ends, with the height of the font\'s line and the spacing between them',()=>{
 const two=layoutBitmapText(font,'A\r\nBB\rA\nB',{lineSpacing:4});
 assert.deepEqual(two.lines.map(l=>[l.text,l.width,l.y]),[['A',11,0],['BB',20,24],['A',11,48],['B',10,72]]);
 assert.deepEqual([two.height,two.width],[4*20+3*4,20]);
 assert.deepEqual(two.glyphs.map(g=>[g.line,g.y]),[[0,4],[1,28],[1,28],[2,52],[3,76]]);
 const empty=layoutBitmapText(font,'');
 assert.deepEqual([empty.lines.length,empty.height,empty.width,empty.glyphs.length],[0,0,0,0]);
 const trailing=layoutBitmapText(font,'A\n');
 assert.deepEqual([trailing.lines.map(l=>l.text),trailing.height],[['A',''],40]);
});

test('BF06 a width wraps after spaces, between ideographs, never before closing marks, and breaks a word too long',()=>{
 const lines=(text,maxWidth,options={})=>layoutBitmapText(font,text,{maxWidth,...options}).lines.map(l=>l.text);
 assert.deepEqual(lines('AB AB AB',45),['AB AB','AB']);
 assert.deepEqual(lines('AB AB AB',43),['AB AB','AB']);
 assert.deepEqual(lines('AB AB AB',42.9),['AB','AB','AB']);
 assert.deepEqual(lines('AB    AB',30),['AB','AB']);
 assert.deepEqual(lines('AAAAA',25),['AA','AA','A']);
 assert.deepEqual(lines('AAAAA',0),['A','A','A','A','A']);
 assert.deepEqual(lines('武林武林',40),['武林','武林']);
 assert.deepEqual(lines('武林，武林',40),['武','林，','武林']);
 assert.deepEqual(lines('AB武林',40),['AB武','林']);
 assert.deepEqual(lines('武AB',30),['武','AB']);
 assert.deepEqual(lines('A\n\nAAA',25),['A','','AA','A']);
 const box=layoutBitmapText(font,'AB AB AB',{maxWidth:45,align:'center'});
 assert.deepEqual([box.width,box.lines.map(l=>l.x),box.glyphs.map(g=>g.x)],[45,[1,13],[2,11,26,35,14,23]]);
 assert.deepEqual(layoutBitmapText(font,'AB AB AB',{maxWidth:45,align:'right'}).lines.map(l=>l.x),[2,26]);
 // Without a width the widest line is the box the others are aligned in.
 assert.deepEqual(layoutBitmapText(font,'A\nAB AB',{align:'right'}).lines.map(l=>[l.x,l.width]),[[32,11],[0,43]]);
 assert.deepEqual(layoutBitmapText(font,'A\nAB AB',{align:'center'}).lines.map(l=>l.x),[16,0]);
});

test('BF07 a character the font does not have is counted, and drawn as the fallback or not at all; a missing space still has a width',()=>{
 const euro=layoutBitmapText(font,'A€B');
 assert.deepEqual([euro.missing,euro.glyphs.map(g=>[g.codePoint,g.sourceX,g.x]),euro.width],[1,[[65,0,1],[0x20ac,20,11],[66,10,20]],29]);
 const none=layoutBitmapText(font,'A€B',{fallback:null});
 assert.deepEqual([none.missing,none.glyphs.map(g=>g.x),none.width],[1,[1,12],21]);
 assert.deepEqual(layoutBitmapText(font,'A€',{fallback:'B'}).glyphs.map(g=>g.sourceX),[0,10]);
 assert.deepEqual(layoutBitmapText(font,'A€',{fallback:'Z'}).glyphs.length,1);
 const numbers=parseBitmapFont(EGRET),gap=layoutBitmapText(numbers,'1 2');
 assert.deepEqual([gap.missing,gap.glyphs.map(g=>g.x),gap.width],[0,[1,16],10+6+10]);
 assert.deepEqual(layoutBitmapText(numbers,'1　2').glyphs.map(g=>g.x),[1,16]);
 assert.deepEqual(layoutBitmapText(font,'A　A').glyphs.map(g=>g.x),[1,22]);
});

test('BF08 the options of a layout are checked',()=>{
 for(const options of [null,7,{maxWidth:-1},{maxWidth:NaN},{maxWidth:'9'},{align:'middle'},{letterSpacing:NaN},{lineSpacing:Infinity},{kerning:1},{fallback:'ab'},{fallback:''},{fallback:7}])
  assert.throws(()=>layoutBitmapText(font,'A',options),coded('BITMAP_TEXT_OPTIONS_INVALID'),JSON.stringify(options));
 assert.throws(()=>layoutBitmapText(font,7),coded('BITMAP_TEXT_OPTIONS_INVALID'));
 assert.throws(()=>layoutBitmapText({...font},'A'),coded('BITMAP_TEXT_OPTIONS_INVALID'));
 assert.equal(layoutBitmapText(font,'A',{fallback:'😀'}).missing,0);
});

let id=0;
async function fixture(run,sizes=[[32,16],[48,16]]){
 const engine=await egret.createEngine({host:host().adapter}),pages=[];
 for(const [width,height] of sizes){
  const key=++id,type=egret.createAssetType('bitmap-font-page-'+key,()=>true),value=egret.createTexture(egret.createImageData2D({width,height,pixels:new Uint8Array(width*height*4)}));
  engine.assets.register(type,{load:async()=>value,dispose:()=>value.dispose()});
  pages.push(await engine.assets.acquire(egret.createAssetRef(type,'page-'+key)));
 }
 const made=[];const make=options=>{const text=createBitmapText({font,pages,...options});made.push(text);engine.stage.addChild(text.display);return text;};
 try{await run({engine,pages,make});}finally{for(const text of made)text.dispose();for(const page of pages)page.release();await engine.dispose();}
}

test('BF09 text is drawn as one mesh for each page it uses, each character a quad of its page, tinted by its colour',async()=>fixture(({pages,make})=>{
 const label=make({text:'AB武',color:0xff8000});
 assert.equal(label.meshes.length,2);
 const [latin,han]=label.meshes,g=latin.geometry;
 assert.deepEqual(Array.from(g.positions),[1,4,11,4,11,16,1,16, 10,4,19,4,19,16,10,16]);
 assert.deepEqual(Array.from(g.uvs),[0,0,10/32,0,10/32,12/16,0,12/16, 10/32,0,19/32,0,19/32,12/16,10/32,12/16]);
 assert.deepEqual(Array.from(g.indices),[0,1,2,0,2,3,4,5,6,4,6,7]);
 // The colour as it is seen, in the linear light the renderer multiplies by.
 assert.deepEqual(Array.from(g.lightColors.slice(0,4)),[1,((128/255+0.055)/1.055)**2.4,0,1]);
 assert.deepEqual(Array.from(han.geometry.positions),[19,2,35,2,35,18,19,18]);
 assert.deepEqual(Array.from(han.geometry.uvs),[0,0,16/48,0,16/48,1,0,1]);
 assert.equal(latin.texture??pages[0],pages[0]);
 assert.deepEqual([label.width,label.height,label.layout.glyphs.length],[37,20,3]);
 // A page no longer used keeps its mesh, hidden; text again uses it again.
 label.text='AB';
 assert.deepEqual([label.meshes.length,label.display.numChildren,han.visible],[1,2,false]);
 label.text='林';
 assert.deepEqual([label.meshes,han.visible,latin.visible],[[han],true,false]);
 label.text='';
 assert.deepEqual([label.meshes.length,label.width,label.height],[0,0,0]);
 const white=make({text:'A'});
 assert.deepEqual(Array.from(white.meshes[0].geometry.lightColors),Array(16).fill(1));
 // Dark channels are a straight line in linear light, the rest a curve.
 const dark=make({text:'A',color:0x0a0b00});
 assert.deepEqual(Array.from(dark.meshes[0].geometry.lightColors.slice(0,3)),[10/255/12.92,((11/255+0.055)/1.055)**2.4,0]);
 assert.equal(make({}).meshes.length,0);
}));

test('BF10 what a text shows is changed by its setters, which check what they are given and change nothing when they refuse it',async()=>fixture(({make})=>{
 const label=make({text:'AB AB AB'});
 const before=label.meshes[0].geometry;
 label.text='AB AB AB';
 assert.equal(label.meshes[0].geometry,before,'the same text is not drawn again');
 label.maxWidth=45;
 assert.deepEqual([label.layout.lines.length,label.width,label.height,label.maxWidth],[2,45,40,45]);
 label.align='right';label.lineSpacing=5;
 assert.deepEqual([label.layout.lines.map(l=>[l.x,l.y]),label.align,label.lineSpacing],[[[2,0],[26,25]],'right',5]);
 label.letterSpacing=1;
 // One more unit between characters, and two of each no longer fit in the width together.
 assert.deepEqual([label.letterSpacing,label.layout.lines.map(l=>[l.text,l.width])],[1,[['AB',20],['AB',20],['AB',20]]]);
 label.maxWidth=undefined;
 assert.deepEqual([label.layout.lines.length,label.maxWidth],[1,undefined]);
 label.color=0x00ff00;
 assert.deepEqual([label.color,Array.from(label.meshes[0].geometry.lightColors.slice(0,4))],[0x00ff00,[0,1,0,1]]);
 const laid=label.layout;
 for(const bad of [()=>{label.text=7;},()=>{label.color=-1;},()=>{label.color=0x1000000;},()=>{label.color=1.5;},()=>{label.maxWidth=-1;},()=>{label.align='middle';},()=>{label.align=undefined;},
  ()=>{label.letterSpacing=NaN;},()=>{label.letterSpacing=undefined;},()=>{label.lineSpacing='1';},()=>{label.lineSpacing=undefined;}])assert.throws(bad,coded('BITMAP_TEXT_OPTIONS_INVALID'));
 assert.equal(label.layout,laid);
 assert.deepEqual([label.text,label.color,label.align,label.letterSpacing,label.lineSpacing],['AB AB AB',0x00ff00,'right',1,5]);
 assert.ok(Object.isFrozen(label));
}));

test('BF11 a text needs a font this entry read, a leased texture for each of its pages, and characters that lie on them',async()=>{
 await fixture(({pages})=>{
  for(const options of [null,{pages},{font:{...font},pages},{font,pages:[pages[0]]},{font,pages:[pages[0],{}]},{font,pages:'ab'},{font,pages,text:7},{font,pages,color:-1},{font,pages,color:0x1000000},{font,pages,align:'up'},{font,pages,maxWidth:-5}])
   assert.throws(()=>createBitmapText(options),coded('BITMAP_TEXT_OPTIONS_INVALID'),JSON.stringify(options));
 });
 await fixture(({pages})=>{assert.throws(()=>createBitmapText({font,pages}),coded('BITMAP_FONT_INVALID'));},[[32,16],[39,16]]);
 await fixture(({pages})=>{assert.throws(()=>createBitmapText({font,pages}),coded('BITMAP_FONT_INVALID'));},[[27,16],[48,16]]);
 await fixture(({pages})=>{assert.throws(()=>createBitmapText({font,pages}),coded('BITMAP_FONT_INVALID'));},[[32,11],[48,16]]);
 await fixture(({make})=>{assert.equal(make({}).state,'active');},[[28,12],[40,16]]);
});

test('BF12 more characters on one page than a mesh can hold are refused, and the text stays as it was',async()=>fixture(({make})=>{
 const label=make({text:'A'.repeat(16384)});
 assert.equal(label.meshes[0].geometry.vertexCount,65536);
 label.text='B';
 assert.throws(()=>{label.text='A'.repeat(16385);},coded('BITMAP_TEXT_TOO_LONG'));
 assert.throws(()=>make({text:'B'.repeat(16385)}),coded('BITMAP_TEXT_TOO_LONG'));
 assert.deepEqual([label.text,label.layout.glyphs.length,label.meshes[0].geometry.vertexCount],['B',1,4]);
 label.text='武'.repeat(16384)+'A'.repeat(16384);
 assert.equal(label.meshes.length,2);
}));

test('BF13 a disposed text lets go of its meshes and display, and takes nothing more',async()=>fixture(({make})=>{
 const label=make({text:'A武'}),meshes=label.meshes,display=label.display;
 label.dispose();label.dispose();
 assert.deepEqual([label.state,meshes.every(mesh=>mesh.isDisposed),display.isDisposed],['closed',true,true]);
 for(const bad of [()=>{label.text='B';},()=>{label.color=0;},()=>{label.maxWidth=4;},()=>{label.align='left';}])assert.throws(bad,coded('BITMAP_TEXT_CLOSED'));
 assert.equal(label.text,'A武');
}));

test('BF14 a strict consumer compiles against the entry, and five misuses are refused; the entry has its three functions alone',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/bitmapfont.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.deepEqual(Object.keys(await import('@egret/engine/bitmapfont')).sort(),['createBitmapText','layoutBitmapText','parseBitmapFont']);
 for(const entry of ['@egret/engine','@egret/engine/particles','@egret/runtime'])for(const name of ['createBitmapText','parseBitmapFont'])assert.equal(name in await import(entry),false,entry);
});

test('BF15 the edges of the scripts broken between characters, opening marks, characters of no size, and the edges of what a font may name',()=>{
 const inside=[0x2e80,0x9fff,0xac00,0xd7af,0xf900,0xfaff,0xff00,0xffef,0x20000,0x3ffff],outside=[0x2e7f,0xa000,0xabff,0xd7b0,0xf8ff,0xfb00,0xfeff,0xfff0,0x1ffff,0x40000];
 const codes=[65,40,1,2,...inside,...outside];
 const wide=parseBitmapFont({pages:['p.png'],common:{lineHeight:10,base:8},chars:codes.map((id,i)=>({id,x:0,y:0,width:id===1?0:10,height:id===2?0:10,xoffset:0,yoffset:0,xadvance:10,page:0}))});
 const first=(text,maxWidth)=>layoutBitmapText(wide,text,{maxWidth}).lines.map(l=>l.text);
 // After a character that may be broken after, a line ends there rather than in the middle of the Latin that follows.
 for(const code of inside)assert.deepEqual(first(String.fromCodePoint(code)+'AAA',25)[0],String.fromCodePoint(code),code.toString(16));
 for(const code of outside)assert.deepEqual(first(String.fromCodePoint(code)+'AAA',25)[0],String.fromCodePoint(code)+'A',code.toString(16));
 // A line may end before an opening mark, never after it.
 assert.deepEqual(first('A(AA',25),['A','(A','A']);
 // Characters of no width or no height move the pen and draw nothing.
 const blank=layoutBitmapText(wide,String.fromCodePoint(1,2,65));
 assert.deepEqual([blank.glyphs.map(g=>[g.codePoint,g.x]),blank.width],[[[65,20]],30]);
 // The ends of what may be named: the last code point, a character of no size at the origin, kerning of the first and last.
 const edges=parseBitmapFont('common lineHeight=4 base=3\npage id=0 file=e.png\nchar id=0 x=0 y=0 width=0 height=0 xadvance=0\nchar id=1114111 x=0 y=0 width=1 height=1 xadvance=1\nkerning first=0 second=1114111 amount=3\nkerning first=1114111 second=0 amount=-3');
 assert.deepEqual([edges.glyph(0x10ffff).id,edges.kerning(0,0x10ffff),edges.kerning(0x10ffff,0)],[0x10ffff,3,-3]);
 for(const pair of ['first=1114112 second=0','first=0 second=1114112','first=0 second=-1'])
  assert.throws(()=>parseBitmapFont('common lineHeight=4 base=3\npage id=0 file=e.png\nkerning '+pair+' amount=1'),coded('BITMAP_FONT_INVALID'),pair);
 assert.equal(parseBitmapFont('<font><info face="&#x10FFFF;&#x110000;"/><common lineHeight="1" base="1"/><page id="0" file="a"/></font>').face,String.fromCodePoint(0x10ffff)+'&#x110000;');
 // The cause of a refusal names the line it is on.
 assert.throws(()=>parseBitmapFont(TEXT.replace('x=10','x=ten')),error=>error.code==='BITMAP_FONT_INVALID'&&error.cause.message==='line 8: x');
 assert.throws(()=>parseBitmapFont({file:7,frames:{a:{x:0,y:0,w:1,h:1}}}),coded('BITMAP_FONT_INVALID'));
});
