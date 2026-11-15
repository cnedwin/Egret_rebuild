// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the browser game entry: what it may write, and what it may not.
import {createBrowserGame,createBrowserStatsPanel} from '@egret/engine/web/game';
import type {BrowserGame,BrowserGameBackend,BrowserGameFit,BrowserGameLabel,BrowserGameLabelOptions,BrowserGameOptions,BrowserStatsPanel,BrowserStatsPanelOptions,BrowserStatsSample,BrowserStatsSnapshot} from '@egret/engine/web/game';
import {animate,Bitmap,Sprite} from '@egret/engine';
import type {Motion} from '@egret/engine';
declare const canvas:HTMLCanvasElement;
const options:BrowserGameOptions={canvas,width:480,height:270,backend:'auto',pixelRatio:1.5,clearColor:0x1b1f2a,clearAlpha:1,update(seconds:number){void seconds;},onError(error:unknown){void error;},pointer:true,keyboard:false,stats:true,fit:'contain',fitTo:canvas.parentElement??undefined as never,autoStart:false};
const game:BrowserGame=await createBrowserGame(options);
const backend:BrowserGameBackend=game.backend,fit:BrowserGameFit='cover';void backend;void fit;
const hero=game.stage.addChild(game.scope.use(new Sprite()));
hero.name='hero';hero.skewX=10;hero.width=40;const wide:number=hero.width+hero.height;void wide;
const found=game.stage.getChildByName('hero');void found;
// A tap is one listener, and a motion is one chain.
if(game.pointer!==undefined)hero.on(game.pointer.events.tap,event=>{const x:number=event.payload.globalX;void x;});
const motion:Motion<Sprite>=animate(game.engine,game.scope,hero).to({x:100,alpha:0.5},0.5,'quadOut').wait(0.2).call(()=>{}).loop(2).onFinish(()=>{}).start();
motion.pause();motion.resume();motion.stop();
// An image and a line of text, each from one call.
const picture=new Bitmap(await game.loadTexture('/image.png'));void picture;
const labelOptions:BrowserGameLabelOptions={text:'金币 0',fontSize:14,color:0xf0c030,locale:'zh'};
const label:BrowserGameLabel=await game.createLabel(labelOptions);
label.text='金币 1';await label.ready;game.stage.addChild(label.display);label.set({color:0xffffff});
const place:{x:number;y:number}=game.toStage(10,20);void place;
const pending:number=game.host.getStatus().pendingFrames;void pending;
game.loop.start();
// The panel, by the game or by hand.
const panelOptions:BrowserStatsPanelOptions={canvas,label:'mine',intervalMs:250};
const panel:BrowserStatsPanel=game.stats??createBrowserStatsPanel(panelOptions);
const sample:BrowserStatsSample={now:1,pendingFrames:0,frames:1,skipped:0};panel.sample(sample);
const numbers:BrowserStatsSnapshot=panel.snapshot(),fps:number=numbers.fps+numbers.commands;void fps;
await game.dispose();
// @ts-expect-error a game needs its canvas and the size of its stage
createBrowserGame({canvas});
// @ts-expect-error a backend is one of three words
createBrowserGame({canvas,width:1,height:1,backend:'canvas'});
// @ts-expect-error a fit is one of four words
createBrowserGame({canvas,width:1,height:1,fit:'fill'});
// @ts-expect-error what the game made is read, not replaced
game.backend='webgl2';
// @ts-expect-error a motion moves numbers the object has
animate(game.engine,game.scope,hero).to({speed:1},1);
// @ts-expect-error an easing is a name the motion knows, or a function
animate(game.engine,game.scope,hero).to({x:1},1,'fast');
// @ts-expect-error a snapshot is read, not written
numbers.fps=60;
