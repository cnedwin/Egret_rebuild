// SPDX-License-Identifier: Apache-2.0
import {Bitmap,Sprite,createAssetRef,createAssetType,createImageData2D,createTexture,isTexture} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {attachStudioTouch} from './touch.mjs';
import {vaultRecords,workload} from './workload.mjs';

const maxPickNodes = 12000;
export const fixedPickOptions = Object.freeze({maxNodes:maxPickNodes});
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));

function rectangle(parent,color,x,y,width,height,alpha = 1) {
  const node = new Sprite();
  node.x = x;
  node.y = y;
  node.graphics.beginFill(color,alpha).drawRect(0,0,width,height).endFill();
  parent.addChild(node);
  return node;
}

function countVisible(root, skip) {
  if (!root.visible || skip.has(root)) return 0;
  let result = 1;
  for (let i = 0; i < (root.numChildren ?? 0); i++) result += countVisible(root.getChildAt(i),skip);
  return result;
}

export async function createStudioWorkload(engine, scope) {
  const root = scope.use(new Sprite());
  root.touchChildren = false;
  engine.stage.addChild(root);
  const structural = [root];
  let inside = root;
  for (let i = 0; i < workload.clipLevels; i++) {
    inside = inside.addChild(new Sprite());
    inside.clipRect = {x:-i*.125,y:-i*.125,width:35+i*.25,height:21+i*.25};
    structural.push(inside);
  }

  const type = createAssetType('studio-wardrobe-mask',isTexture);
  engine.assets.register(type,{
    async load() {
      const bytes = new Uint8Array(4*4*4);
      for (let i = 0; i < 16; i++) bytes.set([255,255,255,i%4 < 2 ? 255 : 48],i*4);
      return createTexture(createImageData2D({width:4,height:4,pixels:bytes}));
    },
    dispose(texture) { texture.dispose(); }
  });
  const lease = scope.use(await engine.assets.acquire(createAssetRef(type,'wardrobe'),{signal:scope.signal}));
  const mask = scope.use(new Bitmap(lease));
  const masked = inside.addChild(new Sprite());
  masked.renderEffect = {alphaMask:mask,maskRect:{x:25,y:1,width:8,height:3}};
  const blurred = inside.addChild(new Sprite());
  blurred.renderEffect = {blurRadius:2};
  structural.push(masked,rectangle(masked,0x55baba,25,1,8,3),blurred,rectangle(blurred,0x87abdc,25,5,7,1.5));

  const cells = Array.from({length:workload.authored-structural.length},(_,index) => {
    const cell = rectangle(inside,[0x304764,0x3a5170,0x416278,0x496683][index%4],
      1+index%32,1+Math.floor(index/32)%19,.7,.63,.72);
    cell.visible = false;
    return cell;
  });
  // The first sixty entries are leaves. The full schedule also changes authored containers.
  const nodes = cells.concat(structural);
  const bases = nodes.map(node => node.x);
  let visibleCells = 0, visible = 0, mutations = 0, update = 0;
  return {
    root,
    layout({map}) {
      root.x = map.x+5;
      root.y = map.y+5;
      root.scaleX = (map.width-10)/35;
      root.scaleY = (map.height-10)/21;
      bases[cells.length] = root.x;
      for (const [index,node] of nodes.entries()) node.x = bases[index];
      update = 0;
    },
    sync(castRoot) {
      const skip = new Set([root,castRoot]);
      let outside = 0;
      for (let i = 0; i < engine.stage.numChildren; i++) outside += countVisible(engine.stage.getChildAt(i),skip);
      const target = workload.visible - outside - structural.length;
      if (target < 0 || target > 608) throw new Error('Studio visible-node budget exceeded');
      for (let i = Math.min(target,visibleCells); i < Math.max(target,visibleCells); i++) cells[i].visible = i < target;
      visibleCells = target;
      visible = outside + structural.length + visibleCells;
    },
    mutate(mode) {
      mutations = workload.mutations[mode];
      const offset = ++update%2 ? workload.displacement : 0;
      for (let i = 0; i < mutations; i++) nodes[i].x = bases[i]+offset;
    },
    inspect() { return {authored:nodes.length,visible,visibleCells,clipLevels:workload.clipLevels,mutations,update}; }
  };
}

function control(root,x,y,width,height,color) {
  const node = rectangle(root,color,x,y,width,height,.94);
  node.hitArea = {x:0,y:0,width,height};
  node.touchEnabled = true;
  node.touchChildren = false;
  return {node,bounds:{x,y,width,height}};
}

export function createStudioReferenceView({engine,scope,input,profile,state,selection,onAction,invalidate}) {
  const {map,vault,ratio,residentCap} = profile;
  const controls = scope.use(new Sprite());
  engine.stage.addChild(controls);
  const mapNode = controls.addChild(new Sprite());
  Object.assign(mapNode,{x:map.x,y:map.y,touchEnabled:true,hitArea:{x:0,y:0,width:map.width,height:map.height}});
  const buttonY = map.y+map.height-52;
  const move = control(controls,map.x+10,buttonY,64,42,0x24658a);
  const action = control(controls,map.x+map.width-74,buttonY,64,42,0x8d5172);
  rectangle(move.node,0xcce6ff,14,19,36,4);
  rectangle(move.node,0xcce6ff,30,9,4,24);
  rectangle(action.node,0xffe5f2,23,12,18,18);

  const records = vaultRecords(profile);
  const list = createUiRoot({engine,scope,id:'studio-vault',origin:{x:vault.x,y:vault.y},viewport:{width:vault.width,height:vault.height},density:ratio,
    limits:{overscan:2,residentCap,retainedCap:1},
    tree:{kind:'virtualList',id:'catalog',explicitWidth:vault.width,explicitHeight:vault.height,source:{
      revision:1,records,
      bind(context) {
        const row = context.scope.use(new Sprite()), height = records[context.index].estimatedHeight;
        row.graphics.beginFill(context.index%2 ? 0x253a56 : 0x304863).drawRect(0,0,context.width,height).endFill();
        row.graphics.beginFill([0x68c5b7,0xeea676,0xa2baf0,0xca8cb5][context.index%4])
          .drawRect(7,3,12,height-6).endFill();
        row.graphics.beginFill(0x6b86aa).drawRect(26,height/2-1,30+(context.index%10)*6,2).endFill();
        return {content:row,measuredHeight:height};
      },
      unbind() {}
    }}
  });
  const hit = scope.use(new Sprite());
  hit.touchEnabled = true;
  engine.stage.addChild(hit);
  const header = rectangle(hit,0x6988a9,0,-8,vault.width,3);
  hit.touchChildren = false;
  const maxScroll = records.length/2*(profile.rowHeights[0]+profile.rowHeights[1])-vault.height;
  let inner = clamp(selection.scroll,0,maxScroll), drawer = selection.drawer;
  let desired = true;
  const listHandle = list.list('catalog');
  function scrollBy(delta) {
    const take = Math.sign(delta) !== Math.sign(drawer) ? Math.sign(delta)*Math.min(Math.abs(drawer),Math.abs(delta)) : 0;
    const next = clamp(inner+delta-take,0,maxScroll);
    const outer = clamp(drawer+delta-(next-inner),-workload.drawerLimit,workload.drawerLimit);
    if (next === inner && outer === drawer) return;
    inner = selection.scroll = next;
    drawer = selection.drawer = outer;
    desired = true;
    invalidate();
  }
  const roles = new Map([[mapNode,'map'],[move.node,'move'],[action.node,'action'],[hit,'vault']]);
  const touch = attachStudioTouch({input,state,classify:target => roles.get(target),
    pick:({x,y}) => engine.stage.hitTest(x,y,fixedPickOptions),
    vault:{scroll:scrollBy,keyAt({x,y}) {
      const snapshot = list.snapshot();
      const localY = y-snapshot.origin.y;
      if (x < vault.x || x >= vault.x+vault.width || localY < 0 || localY >= vault.height) return;
      const row = snapshot.rows.find(value => value.visible && localY >= value.box.y && localY < value.box.y+value.box.height);
      return row?.key;
    }},
    onAction:key => onAction('hero-'+Number(key.slice('outfit-'.length))%workload.actors),invalidate
  });
  scope.use({dispose:touch.unsubscribe});
  async function publish() {
    if (!desired) return false;
    desired = false;
    const y = vault.y-drawer;
    list.setOrigin({x:vault.x,y});
    listHandle.setScrollOffset(inner);
    const token = await list.prepare();
    if (token.status === 'pending') { desired = true; return false; }
    const result = list.commit(token);
    if (result.kind === 'stale') { desired = true; return false; }
    if (result.kind !== 'committed' && result.kind !== 'unchanged') throw new Error('Studio vault publication failed');
    Object.assign(hit,{x:vault.x,y,hitArea:{x:0,y:0,width:vault.width,height:vault.height}});
    header.alpha = drawer ? 1 : .7;
    return result.kind === 'committed';
  }
  return {touch,publish,scrollBy,drawControls() {
    move.node.alpha = touch.moving() ? .68 : 1;
    action.node.alpha = state.actions%2 ? .72 : 1;
  },inspect() {
    const {counters,scrollOffset,anchor,committedRevision,origin} = list.snapshot();
    return {counters,scrollOffset,anchor,committedRevision,drawer,map,move:move.bounds,action:action.bounds,
      vault:{...vault,y:origin.y},touch:touch.inspect()};
  }};
}
