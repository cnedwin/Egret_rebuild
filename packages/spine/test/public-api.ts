// SPDX-License-Identifier: Apache-2.0
// Compile with ES-only ambient types; the private vendor DOM declarations must not leak.
import {createSpineContentLoader} from '@egret/spine';
import type {SpineAsset,SpineAssetInfo,SpinePageInfo,SpineContentBinding,SpineContentGroup,SpineContentLoader,SpineContentOptions,SpineContentProviders,SpineContentProviderFactory,SpineContentStatus} from '@egret/spine';
import type {Engine,Scope} from '@egret/engine';
import type {AdmittedResourceManifest} from '@egret/contracts/resources';
declare const engine:Engine,scope:Scope,manifest:AdmittedResourceManifest,factory:SpineContentProviderFactory;
const options:SpineContentOptions={allowPrerelease:false,maxSetupBytes:1024};
const loader:SpineContentLoader=createSpineContentLoader(engine,scope,manifest,factory,options);
const group:SpineContentGroup=loader.load(scope,['e_skeleton'],{priority:'background'});
const asset:SpineAsset=group.getSpine('e_skeleton'),info:SpineAssetInfo=asset.info,page:SpinePageInfo=info.pages[0]!;
const alpha:false=page.sourcePremultiplied,version:'4.3.13'=info.coreVersion,status:SpineContentStatus=loader.getStatus();
declare const bindings:readonly SpineContentBinding[];const ports:SpineContentProviders=factory(bindings);
void [alpha,version,status,ports,group.ready,asset.isDisposed,loader.close()];

import {createSpineInstance} from '@egret/spine';
import type {SpineInstance,SpineInstanceOptions,SpineInstanceSnapshot,SpinePlaybackEvent,SpineAnimationOptions,SpineQueuedAnimationOptions,SpineBonePose,SpineInstanceState,SpinePlaybackEventKind} from '@egret/spine';
const playerOptions:SpineInstanceOptions={maxSegments:8,maxEvents:1024,onEvent:(event:SpinePlaybackEvent)=>{const kind:SpinePlaybackEventKind=event.kind;void kind;}};
const player:SpineInstance=createSpineInstance(asset,scope,playerOptions);
const animation:SpineAnimationOptions={loop:true,mixSeconds:0.1},queued:SpineQueuedAnimationOptions={...animation,delaySeconds:0};
player.setAnimation(0,'walk',animation);player.addAnimation(0,'idle',queued);player.setSkin('default');player.setSkins(['default','outfit'] as const);player.setTransform(0,0);player.setRate(1);player.setPaused(false);player.clearTrack(1);
const pose:SpineInstanceSnapshot=player.advance({tickId:1,elapsedSeconds:0.05,deltaSeconds:0.05}),bone:SpineBonePose=pose.bones[0]!,state:SpineInstanceState=pose.state;
const selectedSkins:readonly string[]=pose.skins;void selectedSkins;
void [bone,state,player.isDisposed,player.getSnapshot()];player.dispose();

import {createSpineDisplay} from '@egret/spine';
import type {SpineDisplay,SpineDisplayOptions,SpineDisplayStatus} from '@egret/spine';
const displayOptions:SpineDisplayOptions={colorProfile:'egret-shared-linear/1',maxCommands:256,maxVertices:65536,maxIndices:196608};
const display:SpineDisplay=createSpineDisplay(player,scope,displayOptions),displayStatus:SpineDisplayStatus=display.getStatus();
engine.stage.addChild(display.node);display.node.x=10;display.node.visible=false;void displayStatus;display.dispose();

import {Mesh2D} from '@egret/engine';
import type {AssetLease,Texture,SharedGeometry2D,DisplayObject} from '@egret/engine';
declare const borrowed:AssetLease<Texture>,ownedGeometry:SharedGeometry2D;
const binding=Mesh2D.createBinding(borrowed,ownedGeometry);const opaqueNode:DisplayObject=binding.node;scope.use(binding);engine.stage.addChild(opaqueNode);const candidate=binding.prepare(borrowed,ownedGeometry);candidate.commit();binding.dispose();

const finiteAnimation:SpineAnimationOptions={plays:3,mixSeconds:0.1};
const finiteQueue:SpineQueuedAnimationOptions={plays:2,delaySeconds:0};
player.setAnimation(0,'walk',finiteAnimation);player.addAnimation(0,'walk',finiteQueue);
const totalPlays:number|null=pose.tracks[0]!.plays,consumedCompletions:number=pose.tracks[0]!.completedPlays;
void [totalPlays,consumedCompletions];
// @ts-expect-error Plays is numeric, never an upstream runtime object or a string.
player.setAnimation(0,'walk',{plays:'2'});
// @ts-expect-error Snapshot progress is immutable.
pose.tracks[0]!.completedPlays=99;

import {createSpineResetSlot} from '@egret/spine';
import type {SpineResetInitial,SpineResetRequest,SpineResetActive,SpineResetState,SpineResetTicket,SpineResetSlot} from '@egret/spine';
import type {DisplayObjectContainer,SharedRenderFrame2D} from '@egret/engine';
declare const resetTarget:DisplayObjectContainer;
const initialReset:SpineResetInitial={version:'v1',instance:player,display};
const resetSlot:SpineResetSlot=createSpineResetSlot(engine,scope,resetTarget,initialReset);
const resetRequest:SpineResetRequest={policy:'reset',version:'v2',loader,assetId:'e_json',animation:'walk',skins:['default'],plays:2};
const resetTicket:SpineResetTicket=resetSlot.request(resetRequest);
const resetState:SpineResetState=resetTicket.state,resetFrame:SharedRenderFrame2D=resetTicket.capture({width:64,height:64});
const resetActive:SpineResetActive=resetTicket.commit();resetSlot.getActive().instance.advance({tickId:90,elapsedSeconds:10,deltaSeconds:0.05});
void [resetState,resetFrame,resetActive,resetTicket.ready,resetSlot.isDisposed];

import type {SpinePreserveRequest} from '@egret/spine';
const preserveRequest:SpinePreserveRequest={version:'v3',loader,assetId:'e_json',onEvent:(event:SpinePlaybackEvent)=>{void event;}};
const preserveTicket:SpineResetTicket=resetSlot.requestPreserving(preserveRequest),preserved:SpineResetActive=preserveTicket.commit();
void [preserveTicket.ready,preserveTicket.state,preserved.instance.getSnapshot().tracks];
// @ts-expect-error The playback is the active player's: a preserving request names no animation.
resetSlot.requestPreserving({version:'v3',loader,assetId:'e_json',animation:'walk'});
// @ts-expect-error A preserving request has no policy field; reset requests go through request.
resetSlot.requestPreserving({policy:'reset',version:'v3',loader,assetId:'e_json'});
// @ts-expect-error The asset is required.
resetSlot.requestPreserving({version:'v3',loader});
resetSlot.dispose();

import type {SpineSeekLimits,SpineSeekRequest,SpineSeekState,SpineSeekTicket} from '@egret/spine';
const seekLimits:SpineSeekLimits={maxSegments:3600,sliceSegments:120,maxEvents:1024,historyAdvances:3600,historyCommands:1024};
const seekable:SpineInstance=createSpineInstance(asset,scope,{seek:seekLimits});
const seekRequest:SpineSeekRequest={elapsedSeconds:1.5,events:'replay'},seekTicket:SpineSeekTicket=seekable.seek(seekRequest);
const seekReady:boolean=seekTicket.step(),seekState:SpineSeekState=seekTicket.state,seekWork:number=seekTicket.totalSegments-seekTicket.completedSegments+seekTicket.targetSeconds;
const sought:SpineInstanceSnapshot=seekTicket.commit();seekTicket.cancel();
void [seekReady,seekState,seekWork,sought.elapsedSeconds,seekable.seek({elapsedSeconds:0})];
// @ts-expect-error A seek names the time it goes to.
seekable.seek({events:'replay'});
// @ts-expect-error Events are suppressed or replayed, nothing else.
seekable.seek({elapsedSeconds:1,events:'reverse'});
// @ts-expect-error The progress of a seek is read, not written.
seekTicket.completedSegments=0;
// @ts-expect-error The limits are numbers.
createSpineInstance(asset,scope,{seek:{maxSegments:'3600'}});
