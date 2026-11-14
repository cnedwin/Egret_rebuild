// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the particles entry: what it may write, and five things it may not.
import {createParticleEmitter} from '@egret/engine/particles';
import type {ParticleEmitter,ParticleEmitterOptions,ParticleRange,ParticleShape,ParticleSnapshot,ParticleView} from '@egret/engine/particles';
import type {AssetLease,Scope,Texture} from '@egret/engine';
declare const scope:Scope,texture:AssetLease<Texture>;
const speed:ParticleRange=[40,120],shape:ParticleShape={kind:'circle',radius:12,edge:false};
const options:ParticleEmitterOptions={texture,maxParticles:400,rate:60,lifetime:[0.5,1.5],speed,angle:[250,290],gravity:{x:0,y:200},drag:0.5,size:{width:6,height:6},
 startScale:1,endScale:[0,0.2],startAlpha:1,endAlpha:0,startColor:0xffcc33,endColor:0xff3300,rotation:[0,360],spin:[-90,90],shape,seed:7,running:true,duration:3};
const emitter:ParticleEmitter=scope.use(createParticleEmitter(options));
emitter.x=10;emitter.y=20;emitter.start();emitter.stop();emitter.burst(20);emitter.update(1/60);emitter.clear();
const views:readonly ParticleView[]=emitter.particles(),first:number|undefined=views[0]?.alpha,picture:ParticleSnapshot=emitter.snapshot(),alive:number=emitter.alive;void first;void picture;void alive;
// @ts-expect-error an emitter needs its texture
createParticleEmitter({rate:1});
// @ts-expect-error a shape is one of three kinds
createParticleEmitter({texture,shape:{kind:'star'}});
// @ts-expect-error a burst is a number of particles
emitter.burst('many');
// @ts-expect-error whether it runs is read; it is started and stopped
emitter.running=true;
// @ts-expect-error a snapshot is read, not written
picture.alive=0;
