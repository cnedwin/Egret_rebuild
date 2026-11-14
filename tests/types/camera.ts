// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the camera entry: what it may write, and six things it may not.
import {createCamera2D} from '@egret/engine/camera';
import type {Camera2D,Camera2DOptions,CameraFollowOptions,CameraLayerOptions,CameraPoint,CameraRect,CameraShakeOptions,CameraSnapshot,CameraTarget} from '@egret/engine/camera';
import type {DisplayObject,Scope} from '@egret/engine';
declare const scope:Scope,world:DisplayObject,hero:DisplayObject,hills:DisplayObject;
const bounds:CameraRect={x:0,y:0,width:1600,height:900};
const options:Camera2DOptions={world,width:480,height:270,center:{x:0,y:0},zoom:1,minZoom:0.5,maxZoom:3,rotation:0,bounds,shakeOffset:12,shakeRotation:2,shakeDecay:1,shakeFrequency:15,seed:7,roundToPixel:true};
const camera:Camera2D=scope.use(createCamera2D(options));
const follow:CameraFollowOptions={smoothing:0.2,deadZone:{width:80,height:50},offset:{x:0,y:-20}};
const target:CameraTarget=hero,spot:CameraTarget=()=>({x:1,y:2});
camera.follow(target,follow);camera.follow(spot);camera.stopFollowing();
camera.lookAt(10,20);camera.panTo(5,5,1);camera.setZoom(2);camera.zoomTo(1,0.5);camera.setRotation(15);camera.setBounds(undefined);camera.resize(640,360);
const shake:CameraShakeOptions={trauma:0.5};camera.shake(shake);camera.shake();
const layer:CameraLayerOptions={factor:{x:0.3,y:0.1},zoomFactor:0.5};const remove:()=>void=camera.addLayer(hills,layer);remove();
camera.update(1/60);
const screen:CameraPoint=camera.worldToScreen(1,2),back:CameraPoint=camera.screenToWorld(screen.x,screen.y),seen:boolean=camera.isVisible(bounds);void back;void seen;
const picture:CameraSnapshot=camera.snapshot(),view:CameraRect=picture.view,zoom:number=camera.zoom,state:'active'|'closed'=camera.state;void view;void zoom;void state;
// @ts-expect-error the camera needs a world to place
createCamera2D({width:1,height:1});
// @ts-expect-error a target is a display object or a function
camera.follow({x:1,y:2});
// @ts-expect-error a shake is given its trauma by name
camera.shake(0.5);
// @ts-expect-error the zoom is set, not written
camera.zoom=2;
// @ts-expect-error a snapshot is read, not written
picture.zoom=3;
// @ts-expect-error a pan has a time
camera.panTo(1,2);
