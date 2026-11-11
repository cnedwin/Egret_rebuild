// SPDX-License-Identifier: Apache-2.0
import {createMatrix4,multiplyMatrix4} from './matrix4.js';
import type {Matrix4} from './matrix4.js';
import {isMeshGeometry3D} from './meshGeometry3D.js';
import type {MeshGeometry3D} from './meshGeometry3D.js';
import {createAuthoredSceneFrame3D,isSceneWorldCard3D,Scene3DError} from './sceneFrame3D.js';
import type {SceneDirectionalLighting3D,SceneFrame3D,SceneLambertDraw3D,SceneLambertSurface3D,SceneMeshTexture3D,SceneProjectionInput3D,SceneWorldCard3D} from './sceneFrame3D.js';

type Vec3=readonly [number,number,number];
export type SceneWorldProjectionInput3D={
    readonly kind:'perspective'; readonly verticalFov:number; readonly aspect:number;
    readonly near:number; readonly far:number;
}|{
    readonly kind:'orthographic'; readonly height:number; readonly aspect:number;
    readonly near:number; readonly far:number;
};
export interface SceneWorldCameraInput3D {
    readonly eye:Vec3;
    readonly target:Vec3;
    readonly up?:Vec3;
    readonly projection:SceneWorldProjectionInput3D;
}
declare const cameraBrand:unique symbol;
export interface SceneWorldCamera3D {
    readonly [cameraBrand]:true;
    readonly projectionKind:SceneWorldProjectionInput3D['kind'];
}
export interface SceneWorldNodeInput3D {
    readonly id:string;
    readonly parentId?:string;
    readonly localMatrix:readonly number[];
    readonly meshes?:readonly MeshGeometry3D[];
    readonly cards?:readonly SceneWorldCard3D[];
}
export interface SceneWorld3D {
    readonly nodeCount:number;
    capture(camera:SceneWorldCamera3D):SceneFrame3D;
    withNodeTransform(id:string,localMatrix:readonly number[]):SceneWorld3D;
    withNodes(nodes:readonly SceneWorldNodeInput3D[]):SceneWorld3D;
}
export interface SceneLambertWorld3D extends SceneWorld3D {
    withLighting(input: SceneDirectionalLighting3D): SceneLambertWorld3D;
    withNodes(nodes: readonly SceneWorldNodeInput3D[]): SceneLambertWorld3D;
    withNodeTransform(id: string, localMatrix: readonly number[]): SceneLambertWorld3D;
}
interface OwnedNode {
    readonly id:string;
    readonly parentId:string|undefined;
    readonly localMatrix:Matrix4;
    readonly meshes:readonly MeshGeometry3D[];
    readonly cards:readonly SceneWorldCard3D[];
}
const cameras=new WeakMap<SceneWorldCamera3D,{readonly view:Matrix4;readonly projection:SceneProjectionInput3D}>();
const MAX_NODES=256;
const MAX_DRAWS=64;
const UP:Vec3=[0,1,0];

function invalid(field:string):never {
    throw new Scene3DError('SCENE3D_INPUT_INVALID',field);
}
function budget():never {throw new Scene3DError('SCENE3D_BUDGET');}
function source<T>(read:()=>T):T {
    try{return read();}catch(cause){throw new Scene3DError('SCENE3D_INPUT_READ_FAILED',cause);}
}
function vector(value:unknown,field:string):Vec3 {
    const array=source(()=>Array.isArray(value)?value:undefined);
    if(!array||source(()=>array.length)!==3)invalid(field);
    const result=source(()=>[array[0],array[1],array[2]] as const);
    if(!result.every(v=>typeof v==='number'&&Number.isFinite(v)))invalid(field);
    return result as Vec3;
}
function unit(vector:Vec3,field:string):Vec3 {
    const length=Math.hypot(vector[0],vector[1],vector[2]);
    if(!Number.isFinite(length)||length===0)invalid(field);
    if(length>=2**-1022)return [vector[0]/length,vector[1]/length,vector[2]/length];
    // A subnormal hypot can round away a significant part of the true length.
    const largest=Math.max(Math.abs(vector[0]),Math.abs(vector[1]),Math.abs(vector[2]));
    const scaled:Vec3=[vector[0]/largest,vector[1]/largest,vector[2]/largest];
    const scaledLength=Math.hypot(scaled[0],scaled[1],scaled[2]);
    return [scaled[0]/scaledLength,scaled[1]/scaledLength,scaled[2]/scaledLength];
}
function cross(a:Vec3,b:Vec3):Vec3 {
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
}
function dot(a:Vec3,b:Vec3):number {return (a[0]*b[0]+a[1]*b[1])+a[2]*b[2];}
function finite(value:unknown,field:string):number {
    if(typeof value!=='number'||!Number.isFinite(value))invalid(field);
    return value;
}
function cameraProjection(input:SceneWorldProjectionInput3D):SceneProjectionInput3D {
    if(!input||typeof input!=='object')invalid('projection');
    const {kind,aspect:rawAspect,near:rawNear,far:rawFar}=source(()=>({
        kind:input.kind,aspect:input.aspect,near:input.near,far:input.far,
    }));
    const aspect=finite(rawAspect,'aspect'),near=finite(rawNear,'near'),far=finite(rawFar,'far');
    if(aspect<=0||near<0||far<=near)invalid('projection');
    let halfHeight:number;
    if(kind==='perspective'){
        const angle=finite(source(()=>(input as Extract<SceneWorldProjectionInput3D,{kind:'perspective'}>).verticalFov),'verticalFov');
        if(angle<=0||angle>=Math.PI||near<=0)invalid('perspective');
        halfHeight=near*Math.tan(angle/2);
    }else if(kind==='orthographic'){
        halfHeight=finite(source(()=>(input as Extract<SceneWorldProjectionInput3D,{kind:'orthographic'}>).height),'height')/2;
    }else invalid('projection.kind');
    const halfWidth=aspect*halfHeight;
    if(!Number.isFinite(halfHeight)||!Number.isFinite(halfWidth)||halfHeight<=0||halfWidth<=0)invalid('projection.extents');
    return Object.freeze({kind,left:-halfWidth,right:halfWidth,bottom:-halfHeight,top:halfHeight,near,far});
}
export function createSceneCamera3D(input:SceneWorldCameraInput3D):SceneWorldCamera3D {
    if(!input||typeof input!=='object')invalid('camera');
    const fields=source(()=>({eye:input.eye,target:input.target,up:input.up,projection:input.projection}));
    const eye=vector(fields.eye,'eye'),target=vector(fields.target,'target'),up=vector(fields.up===undefined?UP:fields.up,'up');
    const back=unit([eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]],'eye/target');
    const right=unit(cross(unit(up,'up'),back),'up/eye/target');
    const vertical=cross(back,right);
    // Column-major world-to-view transform. Camera looks down negative view Z.
    const view=createMatrix4([
        right[0],vertical[0],back[0],0,right[1],vertical[1],back[1],0,right[2],vertical[2],back[2],0,
        -dot(right,eye),-dot(vertical,eye),-dot(back,eye),1,
    ]);
    const projection=cameraProjection(fields.projection);
    const camera=Object.freeze({projectionKind:projection.kind}) as SceneWorldCamera3D;
    cameras.set(camera,{view,projection});
    return camera;
}
function localMatrix(input:readonly number[]):Matrix4 {
    const matrix=createMatrix4(input);
    if(matrix[3]!==0||matrix[7]!==0||matrix[11]!==0||matrix[15]!==1)invalid('node.localMatrix');
    return matrix;
}
function checkId(id:unknown):asserts id is string {
    if(typeof id!=='string'||id.length===0||id.length>96)invalid('node.id');
}
function normalizeLighting(input: SceneDirectionalLighting3D): SceneDirectionalLighting3D {
    if (!input || typeof input !== 'object') invalid('lighting');
    const raw = source(() => ({direction: input.direction, ambient: input.ambient, intensity: input.intensity}));
    const ambient = finite(raw.ambient, 'lighting.ambient'), intensity = finite(raw.intensity, 'lighting.intensity');
    if (ambient < 0 || intensity < 0 || ambient + intensity > 1) invalid('lighting range');
    const direction = unit(vector(raw.direction, 'lighting.direction'), 'lighting.direction');
    return Object.freeze({direction: Object.freeze(direction), ambient, intensity});
}

interface SceneNormalTransform {
    readonly normalMatrix: readonly number[];
    readonly mirrored: boolean;
}
function normalTransform(matrix: Matrix4): SceneNormalTransform {
    const scale = Math.max(...[0,1,2,4,5,6,8,9,10].map(index => Math.abs(matrix[index]!)));
    if (!Number.isFinite(scale) || scale === 0) invalid('lit node normal transform');
    const c0: Vec3 = [matrix[0]! / scale, matrix[1]! / scale, matrix[2]! / scale];
    const c1: Vec3 = [matrix[4]! / scale, matrix[5]! / scale, matrix[6]! / scale];
    const c2: Vec3 = [matrix[8]! / scale, matrix[9]! / scale, matrix[10]! / scale];
    const n0 = cross(c1,c2), n1 = cross(c2,c0), n2 = cross(c0,c1);
    const determinant = dot(c0,n0);
    const matrixNorm = Math.max(...c0.map((value,row) => Math.abs(value) + Math.abs(c1[row]!) + Math.abs(c2[row]!)));
    const adjugateNorm = Math.max(...[n0,n1,n2].map(column => Math.abs(column[0]) + Math.abs(column[1]) + Math.abs(column[2])));
    const reciprocalCondition = Math.abs(determinant) / (matrixNorm * adjugateNorm);
    if (!Number.isFinite(reciprocalCondition) || reciprocalCondition < 2 ** -16) invalid('lit node normal transform');
    const cofactor = [...n0,...n1,...n2];
    const largest = Math.max(...cofactor.map(Math.abs));
    const mirrored = determinant < 0;
    // This bounded cofactor matrix is direction-equivalent to the inverse transpose.
    // Preserve determinant sign before fragment normalization and double-sided facing.
    const normalMatrix = Object.freeze(cofactor.map(value => Math.fround((mirrored ? -value : value) / largest) || 0));
    return Object.freeze({normalMatrix, mirrored});
}

function assemble(nodes: readonly OwnedNode[],
    textures?: ReadonlyMap<MeshGeometry3D, SceneMeshTexture3D | SceneLambertSurface3D>,
    lighting?: SceneDirectionalLighting3D): SceneWorld3D {
    const byId=new Map(nodes.map(node=>[node.id,node]));
    if(byId.size!==nodes.length)invalid('duplicate node.id');
    const transforms=new Map<string,Matrix4>();
    const active=new Set<string>();
    const resolve=(node:OwnedNode):Matrix4=>{
        const saved=transforms.get(node.id);
        if(saved)return saved;
        if(active.has(node.id))invalid('node hierarchy cycle');
        active.add(node.id);
        let transform=node.localMatrix;
        if(node.parentId!==undefined){
            const parent=byId.get(node.parentId);
            if(!parent)invalid('node.parentId');
            transform=multiplyMatrix4(resolve(parent),transform);
        }
        active.delete(node.id);
        transforms.set(node.id,transform);
        return transform;
    };
    // Resolve graph order once per world revision. Draw order remains authored.
    const draws=nodes.flatMap(node=>{
        const transform=resolve(node);
        let basis: SceneNormalTransform | undefined;
        return node.meshes.map(geometry => {
            const surface = textures?.get(geometry);
            const normal = surface && 'normals' in surface
                ? {...(basis ??= normalTransform(transform)), normals: surface.normals} : undefined;
            return {geometry, transform, normal};
        });
    });
    // Keep prepared normal transforms across light-only edits of the same revision.
    const cards=nodes.flatMap(node=>node.cards.map(card=>({card,transform:resolve(node)})));
    function publish(light?: SceneDirectionalLighting3D): SceneWorld3D {
        const world = {
            nodeCount: nodes.length,
            capture(camera: SceneWorldCamera3D) {
                const owned = cameras.get(camera);
                if (!owned) invalid('camera identity');
                const lambert = light ? new Map<number, SceneLambertDraw3D>() : undefined;
                const commands = draws.map((draw,index) => {
                    if (lambert && draw.normal && light) {
                        lambert.set(index, Object.freeze({...draw.normal, lighting: light}));
                    }
                    return {geometry: draw.geometry, modelView: multiplyMatrix4(owned.view,draw.transform)};
                });
                return createAuthoredSceneFrame3D({projection: owned.projection, draws: commands},
                    cards.length ? cards.map(draw=>({card:draw.card,modelView:multiplyMatrix4(owned.view,draw.transform)})) : undefined,
                    textures, lambert);
            },
            withNodes(input: readonly SceneWorldNodeInput3D[]) {
                return assemble([...nodes,...captureNodes(input,nodes.length,draws.length+cards.length)],textures,light);
            },
            withNodeTransform(id: string, input: readonly number[]) {
                if (!byId.has(id)) invalid('node.id');
                const transform = localMatrix(input);
                return assemble(nodes.map(node=>node.id===id?{...node,localMatrix:transform}:node),textures,light);
            },
        };
        return Object.freeze(light ? {...world, withLighting(input: SceneDirectionalLighting3D) {
            return publish(normalizeLighting(input));
        }} : world);
    }
    return publish(lighting);
}
function captureNodes(input:readonly SceneWorldNodeInput3D[],existingNodes:number,drawCount:number):OwnedNode[] {
    if(!source(()=>Array.isArray(input)))invalid('nodes');
    const count=source(()=>input.length);
    if(!Number.isSafeInteger(count)||count<0)invalid('nodes.length');
    if(count>MAX_NODES-existingNodes)budget();
    const nodes:OwnedNode[]=[];
    for(let index=0;index<count;index++){
        const row=source(()=>input[index]);
        if(!row||typeof row!=='object')invalid('node');
        const {id,parentId,localMatrix:matrix,meshes,cards}=source(()=>({
            id:row.id,parentId:row.parentId,localMatrix:row.localMatrix,meshes:row.meshes,cards:row.cards,
        }));
        checkId(id);
        if(parentId!==undefined)checkId(parentId);
        const attached:MeshGeometry3D[]=[];
        if(meshes!==undefined){
            if(!source(()=>Array.isArray(meshes)))invalid('node.meshes');
            const length=source(()=>meshes.length);
            if(!Number.isSafeInteger(length)||length<0)invalid('node.meshes.length');
            if(length>MAX_DRAWS-drawCount)budget();
            for(let meshIndex=0;meshIndex<length;meshIndex++){
                const mesh=source(()=>meshes[meshIndex]);
                if(!isMeshGeometry3D(mesh))invalid('node.meshes identity');
                attached.push(mesh);
            }
            drawCount+=length;
        }
        const attachedCards:SceneWorldCard3D[]=[];
        if(cards!==undefined){
            if(!source(()=>Array.isArray(cards)))invalid('node.cards');
            const length=source(()=>cards.length);
            if(!Number.isSafeInteger(length)||length<0)invalid('node.cards.length');
            if(length>MAX_DRAWS-drawCount)budget();
            for(let cardIndex=0;cardIndex<length;cardIndex++){
                const card=source(()=>cards[cardIndex]);
                if(!isSceneWorldCard3D(card))invalid('node.cards identity');
                attachedCards.push(card);
            }
            drawCount+=length;
        }
        nodes.push({id,parentId,localMatrix:localMatrix(matrix),meshes:Object.freeze(attached),cards:Object.freeze(attachedCards)});
    }
    return nodes;
}
export function createSceneWorld3D(input:readonly SceneWorldNodeInput3D[]):SceneWorld3D {
    return assemble(captureNodes(input,0,0));
}

/** The GLB binder provides immutable UVs and opaque images before publication. */
export function createTexturedSceneWorld3D(input: readonly SceneWorldNodeInput3D[],
    textures: ReadonlyMap<MeshGeometry3D, SceneMeshTexture3D>): SceneWorld3D {
    return assemble(captureNodes(input,0,0), new Map(textures));
}

/** The explicit Lambert binder owns the normals and image leases at publication. */
export function createLambertSceneWorld3D(input: readonly SceneWorldNodeInput3D[],
    surfaces: ReadonlyMap<MeshGeometry3D, SceneLambertSurface3D>, lighting: SceneDirectionalLighting3D): SceneLambertWorld3D {
    return assemble(captureNodes(input,0,0), new Map(surfaces), normalizeLighting(lighting)) as SceneLambertWorld3D;
}
