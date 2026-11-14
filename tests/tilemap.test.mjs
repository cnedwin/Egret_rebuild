// SPDX-License-Identifier: Apache-2.0
// Tiled maps read into data, and drawn as chunks of meshes on a real Engine with leased textures.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {createTileMap,importTiledMap,TILE_FLIP_MASK} from '@egret/engine/tilemap';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const H=0x80000000,V=0x40000000,D=0x20000000;
/** A tileset of 4 by 2 tiles of 16, with a margin of 1 and a spacing of 2: an image of 72 by 36. */
const ground={firstgid:1,name:'ground',tilewidth:16,tileheight:16,columns:4,tilecount:8,spacing:2,margin:1,image:'ground.png',imagewidth:72,imageheight:36,
 tiles:[{id:3,properties:[{name:'solid',type:'bool',value:true},{name:'cost',type:'int',value:5}],type:'wall'},{id:5,animation:[{tileid:5,duration:100},{tileid:6,duration:200}]}]};
/** Taller tiles: 16 by 32, as trees standing on a cell. */
const trees={firstgid:9,name:'trees',tilewidth:16,tileheight:32,columns:2,tilecount:2,spacing:0,margin:0,image:'trees.png',imagewidth:32,imageheight:32};
function tiled(extra={}){
 return {type:'map',orientation:'orthogonal',width:6,height:4,tilewidth:16,tileheight:16,infinite:false,backgroundcolor:'#80203040',
  properties:[{name:'title',type:'string',value:'Courtyard'}],tilesets:[ground,trees],
  layers:[
   {type:'tilelayer',name:'floor',width:6,height:4,data:[1,2,3,4,1,2, 5,6,7,8,5,6, 1,(2|H)>>>0,(3|V)>>>0,(4|D)>>>0,0,0, 0,0,0,0,0,4],opacity:1,visible:true},
   {type:'group',name:'props',offsetx:2,opacity:0.5,layers:[{type:'tilelayer',name:'trees',width:6,height:4,offsety:3,data:[0,0,0,0,0,0, 0,9,0,10,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0]}]},
   {type:'objectgroup',name:'spawns',objects:[{id:1,name:'hero',type:'spawn',x:24,y:40,width:0,height:0,point:true,properties:[{name:'facing',type:'string',value:'east'}]},
    {id:2,name:'pond',class:'water',x:64,y:16,width:32,height:16,ellipse:true},{id:3,name:'wall',x:0,y:0,polygon:[{x:0,y:0},{x:10,y:0},{x:10,y:5}]},{id:4,name:'sign',x:5,y:5,width:40,height:10,text:{text:'山门'}},{id:5,x:1,y:1,gid:(2|H)>>>0}]},
  ],...extra};
}
let id=0;
async function lease(engine,width,height){
 const key=++id,type=egret.createAssetType('tilemap-literal-'+key,()=>true),value=egret.createTexture(egret.createImageData2D({width,height,pixels:new Uint8Array(width*height*4)}));
 engine.assets.register(type,{load:async()=>value,dispose:()=>value.dispose()});
 return engine.assets.acquire(egret.createAssetRef(type,'tiles-'+key));
}
async function fixture(run,{map=importTiledMap(tiled()),chunkSize=4}={}){
 const engine=await egret.createEngine({host:host().adapter});
 try{
  const textures={ground:await lease(engine,72,36),trees:await lease(engine,32,32)};
  const tiles=createTileMap({map,textures,chunkSize});
  engine.stage.addChild(tiles.display);
  try{await run({engine,tiles,map,textures});}finally{tiles.dispose();for(const value of Object.values(textures))value.release();}
 }finally{await engine.dispose();}
}
/** The quads of a geometry: four corners of place and of the image each. */
const quads=geometry=>Array.from({length:geometry.positions.length/8},(_,k)=>({at:Array.from(geometry.positions.slice(k*8,k*8+8)),uv:Array.from(geometry.uvs.slice(k*8,k*8+8))}));
const px=(x,y)=>[x/72,y/36];

test('TM01 a Tiled map is read into frozen data: tilesets, tile layers, groups and objects',()=>{
 const map=importTiledMap(tiled());
 assert.deepEqual([map.orientation,map.width,map.height,map.tileWidth,map.tileHeight,map.infinite,map.backgroundColor,map.properties],['orthogonal',6,4,16,16,false,0x203040,{title:'Courtyard'}]);
 assert.ok(Object.isFrozen(map)&&Object.isFrozen(map.layers)&&Object.isFrozen(map.tilesets[0])&&Object.isFrozen(map.layers[2].objects[0]));
 const set=map.tilesets[0];
 assert.deepEqual([set.name,set.firstGid,set.columns,set.tileCount,set.spacing,set.margin,set.image,set.imageWidth,set.imageHeight],['ground',1,4,8,2,1,'ground.png',72,36]);
 assert.deepEqual([set.tiles.get(3).properties,set.tiles.get(3).type,set.tiles.get(5).animation],[{solid:true,cost:5},'wall',[{tileId:5,duration:100},{tileId:6,duration:200}]]);
 assert.deepEqual(map.layers.map(layer=>[layer.type,layer.name]),[['tile','floor'],['tile','props/trees'],['object','spawns']]);
 const treesLayer=map.layers[1];
 // A group gives its layers its offset and opacity.
 assert.deepEqual([treesLayer.offsetX,treesLayer.offsetY,treesLayer.opacity,treesLayer.visible,treesLayer.startX,treesLayer.data[7]],[2,3,0.5,true,0,9]);
 assert.deepEqual(Array.from(map.layers[0].data.slice(12,18)),[1,(2|H)>>>0,(3|V)>>>0,(4|D)>>>0,0,0]);
 const objects=map.layers[2].objects;
 assert.deepEqual(objects.map(o=>[o.id,o.name,o.type,o.shape]),[[1,'hero','spawn','point'],[2,'pond','water','ellipse'],[3,'wall','','polygon'],[4,'sign','','text'],[5,'','','rectangle']]);
 assert.deepEqual([objects[0].properties,objects[2].points,objects[3].text,objects[4].gid,objects[0].rotation,objects[0].visible],[{facing:'east'},[{x:0,y:0},{x:10,y:0},{x:10,y:5}],'山门',(2|H)>>>0,0,true]);
 assert.equal(TILE_FLIP_MASK,0xe0000000);
});

test('TM02 layers in base64, infinite maps in chunks, and tilesets kept in their own files',()=>{
 const words=[1,0,(3|H)>>>0,8],bytes=new Uint8Array(new Uint32Array(words).buffer);
 const encoded=Buffer.from(bytes).toString('base64');
 const flat=importTiledMap(tiled({width:2,height:2,layers:[{type:'tilelayer',name:'b',width:2,height:2,encoding:'base64',data:encoded}]}));
 assert.deepEqual(Array.from(flat.layers[0].data),words);
 // An infinite map: two chunks laid into one grid from their lowest corner.
 const endless=importTiledMap(tiled({infinite:true,width:0,height:0,layers:[{type:'tilelayer',name:'far',chunks:[{x:-2,y:0,width:2,height:1,data:[1,2]},{x:2,y:-1,width:1,height:2,data:[3,4]}]}]}));
 const far=endless.layers[0];
 assert.deepEqual([endless.infinite,far.startX,far.startY,far.width,far.height,Array.from(far.data)],[true,-2,-1,5,2,[0,0,0,0,3, 1,2,0,0,4]]);
 const empty=importTiledMap(tiled({infinite:true,layers:[{type:'tilelayer',name:'none',chunks:[]}]}));
 assert.deepEqual([empty.layers[0].width,empty.layers[0].data.length],[0,0]);
 // A tileset of its own file is given by the source the map names.
 const {firstgid,...own}=ground;
 const external=importTiledMap(tiled({tilesets:[{firstgid:1,source:'ground.tsj'},trees]}),{tilesets:{'ground.tsj':own}});
 assert.deepEqual([external.tilesets[0].name,external.tilesets[0].firstGid],['ground',1]);
 assert.throws(()=>importTiledMap(tiled({tilesets:[{firstgid:1,source:'ground.tsj'},trees]})),coded('TILEMAP_TILESET_MISSING'));
});

test('TM03 what the importer cannot read it refuses, with its own reason',()=>{
 const layer=extra=>tiled({layers:[{type:'tilelayer',name:'x',width:6,height:4,data:Array(24).fill(0),...extra}]});
 const cases=[
  ['TILEMAP_ORIENTATION_UNSUPPORTED',tiled({orientation:'isometric'})],['TILEMAP_ORIENTATION_UNSUPPORTED',tiled({orientation:undefined})],
  ['TILEMAP_COMPRESSION_UNSUPPORTED',layer({encoding:'base64',compression:'zlib',data:'AAAA'})],
  ['TILEMAP_LAYER_UNSUPPORTED',tiled({layers:[{type:'imagelayer',name:'sky',image:'sky.png'}]})],
  ['TILEMAP_TILESET_UNSUPPORTED',tiled({tilesets:[{firstgid:1,name:'loose',tilewidth:16,tileheight:16,columns:0,tilecount:2,tiles:[]}]})],
  ['TILEMAP_DATA_INVALID',null],['TILEMAP_DATA_INVALID',tiled({type:'tileset'})],['TILEMAP_DATA_INVALID',tiled({width:0})],['TILEMAP_DATA_INVALID',tiled({tilewidth:1.5})],
  ['TILEMAP_DATA_INVALID',tiled({tilesets:'x'})],['TILEMAP_DATA_INVALID',tiled({backgroundcolor:'red'})],['TILEMAP_DATA_INVALID',tiled({properties:[{name:'a',value:1},{name:'a',value:2}]})],
  ['TILEMAP_DATA_INVALID',tiled({properties:[{name:'a',value:[1]}]})],['TILEMAP_DATA_INVALID',tiled({tilesets:[{...ground,imagewidth:60}]})],['TILEMAP_DATA_INVALID',tiled({tilesets:[ground,{...trees,firstgid:5}]})],
  ['TILEMAP_DATA_INVALID',layer({data:Array(23).fill(0)})],['TILEMAP_DATA_INVALID',layer({data:[...Array(23).fill(0),99]})],['TILEMAP_DATA_INVALID',layer({data:[...Array(23).fill(0),-1]})],
  ['TILEMAP_DATA_INVALID',layer({encoding:'base64',data:'not base64!'})],['TILEMAP_DATA_INVALID',layer({encoding:'base64',data:'AAAA'})],['TILEMAP_DATA_INVALID',layer({encoding:'xml'})],
  ['TILEMAP_DATA_INVALID',layer({opacity:2})],['TILEMAP_DATA_INVALID',tiled({layers:[{type:'objectgroup',name:'o',objects:[{id:1,x:'1',y:0}]}]})],
  ['TILEMAP_DATA_INVALID',tiled({tilesets:[{...ground,tiles:[{id:9}]}]})],['TILEMAP_DATA_INVALID',tiled({tilesets:[{...ground,tiles:[{id:1,animation:[]}]}]})],
 ];
 for(const [code,json] of cases)assert.throws(()=>importTiledMap(json),coded(code),code+' '+JSON.stringify(json)?.slice(0,140));
 for(const bad of [null,7,{tilesets:7}])assert.throws(()=>importTiledMap(tiled(),bad),coded('TILEMAP_OPTIONS_INVALID'));
 // Thirty-two groups deep is allowed; deeper is not.
 let deep={type:'tilelayer',name:'leaf',width:6,height:4,data:Array(24).fill(1)};
 for(let i=0;i<32;i++)deep={type:'group',name:'g',layers:[deep]};
 assert.equal(importTiledMap(tiled({layers:[deep]})).layers[0].name,'g/'.repeat(32)+'leaf');
 assert.throws(()=>importTiledMap(tiled({layers:[{type:'group',name:'g',layers:[deep]}]})),coded('TILEMAP_DATA_INVALID'));
});

test('TM04 each tile layer is a container of chunks, and each chunk one mesh for each tileset it draws from',async()=>fixture(({tiles,textures})=>{
 assert.deepEqual(tiles.layers.map(layer=>layer.name),['floor','props/trees']);
 const floor=tiles.layer('floor'),props=tiles.layer('props/trees');
 assert.deepEqual(floor.chunks.map(chunk=>[chunk.column,chunk.row,chunk.meshes.map(m=>[m.tileset,m.tiles])]),[[0,0,[['ground',12]]],[4,0,[['ground',5]]]]);
 assert.deepEqual(props.chunks.map(chunk=>chunk.meshes.map(m=>[m.tileset,m.tiles])),[[['trees',2]],[]]);
 assert.equal(floor.chunks[0].meshes[0].mesh.textureLease,textures.ground);
 assert.deepEqual([tiles.display.numChildren,floor.display.numChildren,props.display.x,props.display.y,props.display.alpha],[2,2,2,3,0.5]);
 assert.equal(floor.chunks[0].meshes[0].mesh.parent.parent,floor.display);
}));

test('TM05 a tile is cut from its tileset past the margin and the spacing, and turned as its flags say',async()=>fixture(({tiles})=>{
 const first=quads(tiles.layer('floor').chunks[0].meshes[0].geometry);
 // Tile 1 is the first of the set: at (1,1) in the image.
 assert.deepEqual(first[0].at,[0,0,16,0,16,16,0,16]);
 assert.deepEqual(first[0].uv,[...px(1,1),...px(17,1),...px(17,17),...px(1,17)]);
 // Tile 6 is the second of the second row: past one tile and one spacing each way.
 assert.deepEqual(first[5].at,[16,16,32,16,32,32,16,32]);
 assert.deepEqual(first[5].uv,[...px(19,19),...px(35,19),...px(35,35),...px(19,35)]);
 const corners=uv=>[uv.slice(0,2),uv.slice(2,4),uv.slice(4,6),uv.slice(6,8)];
 const [a,b,c,d]=corners(px(37,1).concat(px(53,1),px(53,17),px(37,17)));
 // Turned across, upside down, and about the diagonal.
 assert.deepEqual(corners(first[9].uv),[px(35,1),px(19,1),px(19,17),px(35,17)]);
 assert.deepEqual(corners(first[10].uv),[d,c,b,a]);
 const diagonal=corners(first[11].uv);
 assert.deepEqual(diagonal,corners(px(55,1).concat(px(55,17),px(71,17),px(71,1))));
 assert.ok(first.every(q=>q.at.length===8));
 // The geometry is two triangles a tile, fully lit.
 const g=tiles.layer('floor').chunks[0].meshes[0].geometry;
 assert.deepEqual([g.indexCount,Array.from(g.indices.slice(0,6)),g.lightColors.every(v=>v===1)],[72,[0,1,2,0,2,3],true]);
}));

test('TM06 a tile taller than its cell stands on the bottom of the cell',async()=>fixture(({tiles})=>{
 const tree=quads(tiles.layer('props/trees').chunks[0].meshes[0].geometry);
 assert.deepEqual(tree[0].at,[16,0,32,0,32,32,16,32]);
 assert.deepEqual(tree[0].uv,[0,0,0.5,0,0.5,1,0,1]);
 assert.deepEqual(tree[1].uv,[0.5,0,1,0,1,1,0.5,1]);
}));

test('TM07 a tile is read and changed by its cell, and only its chunk is drawn again',async()=>fixture(({tiles})=>{
 const t=tiles.tileAt('floor',3,0);
 assert.deepEqual([t.gid,t.tileset.name,t.id,t.properties,t.flippedHorizontally],[4,'ground',3,{solid:true,cost:5},false]);
 const f=tiles.tileAt('floor',1,2);
 assert.deepEqual([f.gid,f.flippedHorizontally,f.flippedVertically,f.flippedDiagonally,f.properties],[2,true,false,false,{}]);
 assert.deepEqual([tiles.tileAt('floor',4,2),tiles.tileAt('floor',6,0),tiles.tileAt('floor',-1,0)],[undefined,undefined,undefined]);
 assert.deepEqual(tiles.propertiesOf(4),{solid:true,cost:5});
 assert.deepEqual([tiles.propertiesOf(0),tiles.propertiesOf(9),tiles.propertiesOf((4|H)>>>0)],[{},{},{solid:true,cost:5}]);
 const before=tiles.layer('floor').chunks,mesh=before[0].meshes[0].mesh,right=before[1].meshes[0].geometry;
 tiles.setTile('floor',0,0,0);
 let now=tiles.layer('floor').chunks;
 assert.deepEqual([now[0].meshes[0].tiles,now[0].meshes[0].mesh===mesh,now[1].meshes[0].geometry===right],[11,true,true]);
 // A tile of another set in a chunk adds its mesh behind or in front as the sets are ordered.
 tiles.setTile('floor',2,3,10);
 now=tiles.layer('floor').chunks;
 assert.deepEqual(now[0].meshes.map(m=>[m.tileset,m.tiles]),[['ground',11],['trees',1]]);
 assert.deepEqual([now[0].meshes[0].mesh.parent.getChildIndex(now[0].meshes[0].mesh),now[0].meshes[1].mesh.parent.getChildIndex(now[0].meshes[1].mesh)],[0,1]);
 tiles.setTile('floor',2,3,0);
 assert.equal(tiles.layer('floor').chunks[0].meshes.length,1);
 // The same tile again changes nothing; a whole chunk emptied lets its mesh go.
 const same=tiles.layer('floor').chunks[1].meshes[0].geometry;tiles.setTile('floor',4,0,1);
 assert.equal(tiles.layer('floor').chunks[1].meshes[0].geometry,same);
 for(const [c,r] of [[4,0],[5,0],[4,1],[5,1],[5,3]])tiles.setTile('floor',c,r,0);
 const gone=tiles.layer('floor').chunks[1];
 assert.deepEqual([gone.meshes.length],[0]);
 for(const bad of [[ 'floor',6,0,1],['floor',0.5,0,1]])assert.throws(()=>tiles.setTile(...bad),coded('TILEMAP_CELL_INVALID'));
 for(const gid of [11,-1,1.5,2**32])assert.throws(()=>tiles.setTile('floor',0,0,gid),coded('TILEMAP_TILE_INVALID'),String(gid));
 assert.throws(()=>tiles.setTile('nothing',0,0,1),coded('TILEMAP_LAYER_UNKNOWN'));
 assert.throws(()=>tiles.layer('spawns'),coded('TILEMAP_LAYER_UNKNOWN'));
 assert.throws(()=>tiles.propertiesOf(-1),coded('TILEMAP_TILE_INVALID'));
}));

test('TM08 cells and points of the map, and the chunks that a view meets',async()=>fixture(({tiles})=>{
 assert.deepEqual([tiles.cellAt(17,33),tiles.cellAt(-0.5,0),tiles.cellOrigin(2,3)],[{column:1,row:2},{column:-1,row:0},{x:32,y:48}]);
 for(const bad of [()=>tiles.cellAt(NaN,0),()=>tiles.cellOrigin(1.5,0)])assert.throws(bad,coded('TILEMAP_CELL_INVALID'));
 // Two chunks a layer: the first covers x 0 to 64, the second 64 to 128 (the props layer two units further right).
 assert.equal(tiles.cull({x:0,y:0,width:30,height:30}),2);
 assert.deepEqual(tiles.layers.flatMap(l=>l.chunks.map(c=>c.visible)),[true,false,true,false]);
 assert.deepEqual(tiles.layer('floor').chunks.map(c=>tiles.layer('floor').display.getChildAt(tiles.layer('floor').chunks.indexOf(c)).visible),[true,false]);
 assert.equal(tiles.cull({x:65,y:0,width:10,height:10}),3);
 assert.equal(tiles.cull({x:200,y:0,width:10,height:10}),0);
 // A tree reaches a cell above its chunk.
 assert.equal(tiles.cull({x:0,y:-20,width:10,height:5}),1);
 assert.equal(tiles.cull({x:0,y:0,width:500,height:500}),4);
 for(const bad of [null,{x:0},{x:0,y:0,width:-1,height:1}])assert.throws(()=>tiles.cull(bad),coded('TILEMAP_OPTIONS_INVALID'));
}));

test('TM09 an infinite layer is drawn from where its chunks begin',async()=>{
 const map=importTiledMap(tiled({infinite:true,layers:[{type:'tilelayer',name:'far',chunks:[{x:-2,y:-1,width:1,height:1,data:[1]}]}]}));
 await fixture(({tiles})=>{
  assert.deepEqual(quads(tiles.layer('far').chunks[0].meshes[0].geometry)[0].at,[-32,-16,-16,-16,-16,0,-32,0]);
  assert.deepEqual([tiles.tileAt('far',-2,-1).gid,tiles.tileAt('far',0,0)],[1,undefined]);
 },{map});
});

test('TM10 options are checked, a set without its image cannot be drawn, and nothing is left behind',async()=>{
 const engine=await egret.createEngine({host:host().adapter});
 try{
  const map=importTiledMap(tiled()),groundLease=await lease(engine,72,36),treeLease=await lease(engine,32,32);
  for(const options of [null,{},{map:{},textures:{}},{map,textures:null},{map,textures:{},chunkSize:3},{map,textures:{},chunkSize:129},{map,textures:{},chunkSize:4.5}])assert.throws(()=>createTileMap(options),coded('TILEMAP_OPTIONS_INVALID'));
  assert.throws(()=>createTileMap({map,textures:{ground:groundLease}}),error=>error.code==='TILEMAP_TEXTURE_MISSING'&&error.cause.message==='trees');
  // A map whose layers use one set needs only that set's image.
  const flat=importTiledMap(tiled({layers:[{type:'tilelayer',name:'only',width:6,height:4,data:Array(24).fill(2)}]}));
  const tiles=createTileMap({map:flat,textures:{ground:groundLease}});
  // Thirty-two cells a chunk unless said otherwise: one chunk holds the whole layer.
  assert.equal(tiles.layer('only').chunks.length,1);
  tiles.dispose();tiles.dispose();
  assert.deepEqual([tiles.state,tiles.display.isDisposed],['closed',true]);
  assert.throws(()=>tiles.setTile('only',0,0,1),coded('TILEMAP_CLOSED'));
  assert.throws(()=>tiles.cull({x:0,y:0,width:1,height:1}),coded('TILEMAP_CLOSED'));
  groundLease.release();treeLease.release();
 }finally{await engine.dispose();}
});

test('TM11 the edges the importer allows, and the ways round a straight map does not show',()=>{
 const layer=extra=>tiled({layers:[{type:'tilelayer',name:'x',width:6,height:4,data:Array(24).fill(0),...extra}]});
 // Words of four different bytes, in base64, read low byte first.
 const four=Buffer.from(new Uint8Array(new Uint32Array([0x00000102,0x00000201]).buffer)).toString('base64');
 assert.throws(()=>importTiledMap(tiled({width:2,height:1,layers:[{type:'tilelayer',name:'b',width:2,height:1,encoding:'base64',data:four}]})),error=>error.code==='TILEMAP_DATA_INVALID'&&/tile 258/.test(error.cause.message));
 const plain=Buffer.from(new Uint8Array(new Uint32Array([((8|D|V|H)>>>0),3]).buffer)).toString('base64');
 assert.deepEqual(Array.from(importTiledMap(tiled({width:2,height:1,layers:[{type:'tilelayer',name:'b',width:2,height:1,encoding:'base64',data:plain}]})).layers[0].data),[(8|D|V|H)>>>0,3]);
 for(const bad of ['AAAAAAA','AAAAAAAAA=','AA=AAAAA'])assert.throws(()=>importTiledMap(tiled({width:2,height:1,layers:[{type:'tilelayer',name:'b',width:2,height:1,encoding:'base64',data:bad}]})),coded('TILEMAP_DATA_INVALID'),bad);
 // Tilesets out of order are put in order; the last tile of a set is its own, the next one is not.
 const ordered=importTiledMap(tiled({tilesets:[trees,ground]}));
 assert.deepEqual(ordered.tilesets.map(s=>s.name),['ground','trees']);
 importTiledMap(tiled({tilesets:[{...ground,tiles:[{id:7,animation:[{tileid:7,duration:1}]}]},trees]}));
 for(const tiles of [[{id:8}],[{id:1,animation:[{tileid:8,duration:1}]}],[{id:1,animation:'x'}],[{id:1,animation:[{tileid:1,duration:0}]}],[7]])assert.throws(()=>importTiledMap(tiled({tilesets:[{...ground,tiles},trees]})),coded('TILEMAP_DATA_INVALID'),JSON.stringify(tiles));
 assert.equal(importTiledMap(tiled({tilesets:[{...ground,tiles:[{id:1,type:''}]},trees]})).tilesets[0].tiles.get(1).type,undefined);
 // A set that does not fit its image down as well as across.
 // The set fills its image of 72 by 36 exactly: one pixel less either way is too small.
 assert.throws(()=>importTiledMap(tiled({tilesets:[{...ground,imageheight:35},trees]})),coded('TILEMAP_DATA_INVALID'));
 assert.throws(()=>importTiledMap(tiled({tilesets:[{...ground,imagewidth:71},trees]})),coded('TILEMAP_DATA_INVALID'));
 // Properties: nothing is read as nothing; a value that is no value is refused.
 assert.deepEqual(importTiledMap(tiled({properties:[{name:'n',value:null},{name:'o',value:{a:1}}]})).properties,{n:'',o:'{"a":1}'});
 for(const value of [Infinity,NaN,[1],()=>{}])assert.throws(()=>importTiledMap(tiled({properties:[{name:'a',value}]})),coded('TILEMAP_DATA_INVALID'),String(value));
 assert.throws(()=>importTiledMap(tiled({properties:{a:1}})),coded('TILEMAP_DATA_INVALID'));
 // Opacity at either end; a hidden group hides its layers; a polyline is a line of points.
 for(const opacity of [0,1])importTiledMap(layer({opacity}));
 const hidden=importTiledMap(tiled({layers:[{type:'group',name:'g',visible:false,layers:[{type:'tilelayer',name:'t',width:6,height:4,data:Array(24).fill(0)}]}]}));
 assert.equal(hidden.layers[0].visible,false);
 const line=importTiledMap(tiled({layers:[{type:'objectgroup',name:'o',objects:[{id:1,x:0,y:0,polyline:[{x:1,y:2}]}]}]})).layers[0].objects[0];
 assert.deepEqual([line.shape,line.points],['polyline',[{x:1,y:2}]]);
 // Data of a layer in a form it cannot be read in.
 assert.throws(()=>importTiledMap(layer({data:'1,2,3'})),coded('TILEMAP_DATA_INVALID'));
 assert.throws(()=>importTiledMap(layer({offsetx:'1'})),coded('TILEMAP_DATA_INVALID'));
 // Without saying it is infinite a map is not, and needs a size.
 const {infinite,...finite}=tiled();
 assert.equal(importTiledMap(finite).infinite,false);
 assert.throws(()=>importTiledMap({...finite,width:0}),coded('TILEMAP_DATA_INVALID'));
 // The largest tile and the most tilesets and layers there may be.
 importTiledMap(tiled({tilewidth:4096,tileheight:4096}));
 assert.throws(()=>importTiledMap(tiled({tilewidth:4097})),coded('TILEMAP_DATA_INVALID'));
 const many=n=>Array.from({length:n},(_,i)=>({...trees,name:'s'+i,firstgid:1+i*2}));
 assert.equal(importTiledMap(tiled({tilesets:many(256),layers:[]})).tilesets.length,256);
 assert.throws(()=>importTiledMap(tiled({tilesets:many(257),layers:[]})),coded('TILEMAP_DATA_INVALID'));
 const layers=n=>Array.from({length:n},(_,i)=>({type:'objectgroup',name:'o'+i,objects:[]}));
 assert.equal(importTiledMap(tiled({layers:layers(256)})).layers.length,256);
 assert.throws(()=>importTiledMap(tiled({layers:layers(257)})),coded('TILEMAP_DATA_INVALID'));
 const objects=n=>[{type:'objectgroup',name:'o',objects:Array.from({length:n},(_,i)=>({id:i,x:0,y:0}))}];
 assert.equal(importTiledMap(tiled({layers:objects(100000)})).layers[0].objects.length,100000);
 assert.throws(()=>importTiledMap(tiled({layers:objects(100001)})),coded('TILEMAP_DATA_INVALID'));
});

test('TM12 the edges the drawn map allows, and chunks that do not divide the layer',async()=>{
 const map=importTiledMap(tiled({width:5,height:6,layers:[{type:'tilelayer',name:'f',width:5,height:6,data:Array.from({length:30},(_,i)=>1+(i%8))}]}));
 await fixture(({tiles})=>{
  // Four by four: the chunks to the right and below are cut short and hold only their own cells.
  assert.deepEqual(tiles.layer('f').chunks.map(c=>[c.column,c.row,c.meshes[0].tiles]),[[0,0,16],[4,0,4],[0,4,8],[4,4,2]]);
  assert.deepEqual([tiles.tileAt('f',4,5).gid,tiles.tileAt('f',5,5),tiles.tileAt('f',4,6),tiles.tileAt('f',0,-1)],[6,undefined,undefined,undefined]);
  // A tile with every flag is one of a set.
  tiles.setTile('f',0,0,(8|H|V|D)>>>0);
  assert.equal(tiles.tileAt('f',0,0).gid,8);
  assert.throws(()=>tiles.setTile('f',0,0,0xffffffff),coded('TILEMAP_TILE_INVALID'));
  // A view that only touches a chunk shows it.
  assert.equal(tiles.cull({x:64,y:64,width:0,height:0}),4);
  assert.equal(tiles.cull({x:-10,y:-10,width:10,height:10}),1);
  assert.equal(tiles.cull({x:0,y:0,width:0,height:0}),1);
  for(const bad of [{x:NaN,y:0,width:1,height:1},{x:0,y:NaN,width:1,height:1},{x:0,y:0,width:NaN,height:1},{x:0,y:0,width:1,height:NaN},{x:0,y:0,width:1,height:-1}])assert.throws(()=>tiles.cull(bad),coded('TILEMAP_OPTIONS_INVALID'),JSON.stringify(bad));
 },{map});
 const engine=await egret.createEngine({host:host().adapter});
 try{
  const groundLease=await lease(engine,72,36),treeLease=await lease(engine,32,32),textures={ground:groundLease,trees:treeLease},small=importTiledMap(tiled());
  for(const chunkSize of [4,128])createTileMap({map:small,textures,chunkSize}).dispose();
  for(const map of [{...small,orientation:'isometric'},{...small,layers:7},{...small,tilesets:7}])assert.throws(()=>createTileMap({map,textures}),coded('TILEMAP_OPTIONS_INVALID'));
  // A chunk whose first tile is of the second set: the sets are drawn back to front in their order all the same.
  const tiles=createTileMap({map:importTiledMap(tiled({layers:[{type:'tilelayer',name:'m',width:6,height:4,data:[10,...Array(23).fill(0)]}]})),textures,chunkSize:4});
  tiles.setTile('m',1,0,1);
  const [first,second]=tiles.layer('m').chunks[0].meshes;
  assert.deepEqual([first.tileset,second.tileset,first.mesh.parent.getChildIndex(first.mesh),second.mesh.parent.getChildIndex(second.mesh)],['ground','trees',0,1]);
  tiles.dispose();groundLease.release();treeLease.release();
 }finally{await engine.dispose();}
});

test('TM13 a strict consumer compiles against the entry, and five misuses are refused; the entry has its three values alone',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/tilemap.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.deepEqual(Object.keys(await import('@egret/engine/tilemap')).sort(),['TILE_FLIP_MASK','createTileMap','importTiledMap']);
 for(const entry of ['@egret/engine','@egret/engine/camera','@egret/runtime'])for(const name of ['createTileMap','importTiledMap'])assert.equal(name in await import(entry),false,entry);
});

test('TM14 the map of the example is a Tiled map that imports',async()=>{
 const {readFileSync}=await import('node:fs');
 const map=importTiledMap(JSON.parse(readFileSync(new URL('../examples/tilemap/courtyard.tmj',import.meta.url),'utf8')));
 assert.deepEqual([map.width,map.height,map.layers.map(l=>l.name),map.tilesets.map(s=>s.name)],[64,40,['ground','above/details','above/trees','places'],['terrain','trees']]);
});
