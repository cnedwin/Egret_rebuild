import {createMeshGeometry3D,createSceneFrame3D} from '@egret/engine/scene3d';
import type {Matrix4,MeshGeometry3D,SceneFrame3D,SceneProjectionInput3D} from '@egret/engine/scene3d';
declare const geometry: MeshGeometry3D;
declare const scene: SceneFrame3D;
const identity: Matrix4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const projection: SceneProjectionInput3D={kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:0,far:2};
// SCENE3D_CASE typed-array-positions
createMeshGeometry3D({positions:new Float32Array(9),colors:[0,0,0,0,0,0,0,0,0],indices:[0,1,2]});
// SCENE3D_CASE invalid-projection-kind
createSceneFrame3D({projection:{...projection,kind:'camera'},draws:[]});
// SCENE3D_CASE short-matrix-tuple
createSceneFrame3D({projection,draws:[{geometry,modelView:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0]}]});
// SCENE3D_CASE missing-projection
createSceneFrame3D({draws:[]});
// SCENE3D_CASE missing-geometry
createSceneFrame3D({projection,draws:[{modelView:identity}]});
// SCENE3D_CASE readonly-geometry-slot
geometry.positions[0]=7;
// SCENE3D_CASE readonly-geometry-wrapper
geometry.logicalBytes=0;
// SCENE3D_CASE readonly-frame-draw
scene.draws[0]={geometry,mvp:identity};
// SCENE3D_CASE readonly-frame-uniform
scene.uniformBytes=0;
// SCENE3D_CASE readonly-mvp-slot
scene.draws[0]!.mvp[0]=2;
