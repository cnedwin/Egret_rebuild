// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the tile map entry: what it may write, and five things it may not.
import {createTileMap,importTiledMap,TILE_FLIP_MASK} from '@egret/engine/tilemap';
import type {ObjectLayerData,TileAnimationFrame,TiledImportOptions,TileInfo,TileLayerData,TileMap,TileMapChunk,TileMapData,TileMapLayer,TileMapLayerData,TileMapObject,TileMapOptions,TileMapProperties,TileMapPropertyValue,TileSetData} from '@egret/engine/tilemap';
import type {AssetLease,Scope,Texture} from '@egret/engine';
declare const scope:Scope,json:unknown,ground:AssetLease<Texture>,trees:AssetLease<Texture>;
const options:TiledImportOptions={tilesets:{'trees.tsj':{}}};
const map:TileMapData=importTiledMap(json,options);
const set:TileSetData=map.tilesets[0]!,frames:readonly TileAnimationFrame[]|undefined=set.tiles.get(0)?.animation;void frames;
for(const layer of map.layers){
 const any:TileMapLayerData=layer;void any;
 if(layer.type==='tile'){const tiles:TileLayerData=layer,cell:number=tiles.data[0]!&~TILE_FLIP_MASK;void cell;}
 else{const objects:ObjectLayerData=layer,first:TileMapObject|undefined=objects.objects[0],shape:string|undefined=first?.shape;void shape;}
}
const drawn:TileMapOptions={map,textures:{ground,trees},chunkSize:16};
const tiles:TileMap=scope.use(createTileMap(drawn));
const layer:TileMapLayer=tiles.layer('ground'),chunk:TileMapChunk|undefined=layer.chunks[0];void chunk;
const info:TileInfo|undefined=tiles.tileAt('ground',1,2),props:TileMapProperties=tiles.propertiesOf(3),value:TileMapPropertyValue|undefined=props['solid'];void info;void value;
tiles.setTile('ground',1,2,(5|0x80000000)>>>0);
const cell:{readonly column:number;readonly row:number}=tiles.cellAt(10,20),origin:{readonly x:number;readonly y:number}=tiles.cellOrigin(1,2);void cell;void origin;
const shown:number=tiles.cull({x:0,y:0,width:480,height:270});void shown;
// @ts-expect-error a tile map needs the images of its tilesets
createTileMap({map});
// @ts-expect-error a cell is two numbers
tiles.tileAt('ground',[1,2]);
// @ts-expect-error the map is read, not written
tiles.data=map;
// @ts-expect-error the data of a map is frozen
map.width=3;
// @ts-expect-error a view is a rectangle
tiles.cull(4);
