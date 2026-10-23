// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '../EgretError.js';
import type { UiLayoutNode, UiLayoutTree, UiLayoutBox, UiLayoutPlan, UiDirtyKind, UiSize, UiMeasurement, UiFill } from './types.js';
const CAP=1048576;
const allowed=['id','kind','explicitWidth','explicitHeight','minWidth','minHeight','maxWidth','maxHeight','padding','gap','crossAlign','children','measure','fill','source','initialScrollOffset'];
function invalid():never {throw new EgretError('UI_INVALID');}
function finite(value:unknown,min=0,max=CAP):number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)invalid();return value===0?0:value;}
function integer(value:unknown,max:number):number {const n=finite(value,0,max);if(!Number.isInteger(n))invalid();return n;}
function fields(value:unknown,names:readonly string[]):Record<string,unknown> {
 if(value===null||typeof value!=='object')invalid();const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)invalid();const result:Record<string,unknown>={};
 for(const k of Reflect.ownKeys(value)){if(typeof k!=='string'||!names.includes(k))invalid();result[k]=(value as Record<string,unknown>)[k];}return result;
}
function arrayCount(value:unknown,max:number):number {
 if(!Array.isArray(value))invalid();const count=value.length;
 if(typeof count!=='number'||!Number.isInteger(count)||count<0)invalid();if(count>max)throw new EgretError('UI_LIMIT');return count===0?0:count;
}
function id(value:unknown):string {if(typeof value!=='string'||!value.length||value.length>128)invalid();return value;}
function readonlyMap<K,V>(map:Map<K,V>):ReadonlyMap<K,V> {
 return Object.freeze({get size(){return map.size;},get:(key:K)=>map.get(key),has:(key:K)=>map.has(key),entries:()=>map.entries(),keys:()=>map.keys(),values:()=>map.values(),[Symbol.iterator]:()=>map[Symbol.iterator](),forEach:(cb:(value:V,key:K,map:ReadonlyMap<K,V>)=>void,thisArg?:unknown)=>map.forEach((value,key)=>cb.call(thisArg,value,key,readonlyMap(map)))});
}
const capturedTrees=new WeakSet<UiLayoutTree>();
/** Bounded capture reads each authored property once and retains no mutable child arrays. */
export function captureUiLayout(tree:UiLayoutNode,limits:{readonly maxNodes?:number;readonly maxDepth?:number}={}):UiLayoutTree {
 const l=fields(limits,['maxNodes','maxDepth']);const maxNodes=l.maxNodes===undefined?4096:integer(l.maxNodes,4096),maxDepth=l.maxDepth===undefined?64:integer(l.maxDepth,64);if(!maxNodes||!maxDepth)invalid();
 const seen=new Set<object>(),nodes=new Map<string,UiLayoutNode>();let lists=0;
 function visit(value:unknown,depth:number):UiLayoutNode {
  if(depth>maxDepth||nodes.size>=maxNodes)throw new EgretError('UI_LIMIT');if(value===null||typeof value!=='object')invalid();if(seen.has(value))throw new EgretError('UI_LAYOUT_CYCLE');seen.add(value);
  const raw=fields(value,allowed),name=id(raw.id),kind=raw.kind;if(nodes.has(name))throw new EgretError('UI_DUPLICATE_ID');if(kind!=='leaf'&&kind!=='row'&&kind!=='column'&&kind!=='virtualList')invalid();
  const minWidth=raw.minWidth===undefined?0:finite(raw.minWidth),minHeight=raw.minHeight===undefined?0:finite(raw.minHeight),maxWidth=raw.maxWidth===undefined?CAP:finite(raw.maxWidth),maxHeight=raw.maxHeight===undefined?CAP:finite(raw.maxHeight);
  if(minWidth>maxWidth||minHeight>maxHeight)invalid();const explicitWidth=raw.explicitWidth===undefined?undefined:finite(raw.explicitWidth),explicitHeight=raw.explicitHeight===undefined?undefined:finite(raw.explicitHeight);
  if(explicitWidth!==undefined&&(explicitWidth<minWidth||explicitWidth>maxWidth)||explicitHeight!==undefined&&(explicitHeight<minHeight||explicitHeight>maxHeight))invalid();
  const padding=raw.padding===undefined?0:finite(raw.padding),gap=raw.gap===undefined?0:finite(raw.gap),crossAlign=raw.crossAlign??'start';if(!['start','center','end','stretch'].includes(crossAlign as string))invalid();
  const base:UiLayoutNode={id:name,kind,minWidth,minHeight,maxWidth,maxHeight,padding,gap,crossAlign:crossAlign as NonNullable<UiLayoutNode['crossAlign']>,...(explicitWidth===undefined?{}:{explicitWidth}),...(explicitHeight===undefined?{}:{explicitHeight})};
  nodes.set(name,base);
  let result:UiLayoutNode;
  if(kind==='row'||kind==='column'){
   if(raw.measure!==undefined||raw.fill!==undefined||raw.source!==undefined||raw.initialScrollOffset!==undefined)invalid();const count=arrayCount(raw.children,maxNodes),authoredChildren=raw.children as readonly unknown[];
   // Index reads are bounded; holes are refused by visit rather than skipped.
   const children:UiLayoutNode[]=[];for(let i=0;i<count;i++)children.push(visit(authoredChildren[i],depth+1));result={...base,children:Object.freeze(children)};
  }else if(kind==='leaf'){
   if(raw.children!==undefined||raw.source!==undefined||raw.initialScrollOffset!==undefined)invalid();if(raw.measure!==undefined&&typeof raw.measure!=='function')invalid();
   let fill:UiFill|undefined;if(raw.fill!==undefined){const f=fields(raw.fill,['color','alpha']);fill=Object.freeze({color:integer(f.color,0xffffff),alpha:f.alpha===undefined?1:finite(f.alpha,0,1)});}
   result={...base,...(raw.measure===undefined?{}:{measure:raw.measure as NonNullable<UiLayoutNode['measure']>}),...(fill===undefined?{}:{fill})};
  }else {
   if(++lists>1)throw new EgretError('UI_LIMIT');if(raw.children!==undefined||raw.measure!==undefined||raw.fill!==undefined||padding!==0||gap!==0)invalid();if(raw.source===undefined)invalid();
   const initialScrollOffset=raw.initialScrollOffset===undefined?0:finite(raw.initialScrollOffset,-Number.MAX_VALUE,Number.MAX_VALUE);result={...base,source:raw.source,initialScrollOffset};
  }
  result=Object.freeze(result);nodes.set(name,result);return result;
 }
 const root=visit(tree,1),result=Object.freeze({root,nodes:readonlyMap(nodes)});capturedTrees.add(result);return result;
}
interface Measured { readonly node:UiLayoutNode;readonly intrinsicWidth:number;readonly intrinsicHeight:number;readonly contentMeasured:boolean;readonly width:number;readonly height:number;readonly dependencyRevision:number;readonly availableWidth:number;readonly availableHeight:number;readonly density:number;readonly children:readonly Measured[] }
const caches=new WeakMap<UiLayoutPlan,ReadonlyMap<string,Measured>>();
function sameLeaf(a:UiLayoutNode,b:UiLayoutNode):boolean {return a.kind===b.kind&&a.measure===b.measure&&a.explicitWidth===b.explicitWidth&&a.explicitHeight===b.explicitHeight&&a.minWidth===b.minWidth&&a.minHeight===b.minHeight&&a.maxWidth===b.maxWidth&&a.maxHeight===b.maxHeight&&a.padding===b.padding;}
function bounded(value:number):number {return finite(value);}
function resolve(intrinsic:number,explicit:number|undefined,min:number,max:number):number{return bounded(explicit??Math.max(min,Math.min(max,intrinsic)));}
/** One postorder measure and preorder arrange. No convergence callbacks or live scene writes. */
export function planUiLayout(tree:UiLayoutTree,viewport:UiSize,density:number,previous?:UiLayoutPlan,dirty?:ReadonlyMap<string,UiDirtyKind>):UiLayoutPlan {
 if(!capturedTrees.has(tree))invalid();const vp=fields(viewport,['width','height']);const width=finite(vp.width,Number.MIN_VALUE,16384),height=finite(vp.height,Number.MIN_VALUE,16384);finite(density,Number.MIN_VALUE,8);
 const before=previous===undefined?undefined:caches.get(previous),next=new Map<string,Measured>();let measurementCalls=0,reusedMeasurements=0;
 if(dirty)for(const [name,kind] of dirty){if(!tree.nodes.has(name)||!['measure','arrange','paint','interaction','semantic'].includes(kind))invalid();}
 function measure(node:UiLayoutNode,availableWidth:number,availableHeight:number,forcedWidth?:number,forcedHeight?:number,ancestorMeasureDirty=false):Measured {
  const pad=node.padding!,minW=node.minWidth!,minH=node.minHeight!,maxW=node.maxWidth!,maxH=node.maxHeight!;
  const explicitW=node.explicitWidth??forcedWidth,explicitH=node.explicitHeight??forcedHeight;
  const aw=Math.max(0,resolve(availableWidth,explicitW,minW,maxW)-pad*2),ah=Math.max(0,resolve(availableHeight,explicitH,minH,maxH)-pad*2);
  const dirtyMeasure=ancestorMeasureDirty||dirty?.get(node.id)==='measure';let measuredWidth=0,measuredHeight=0,dependencyRevision=0,contentMeasured=false;const children:Measured[]=[];
  if(node.kind==='leaf'){
   const prior=before?.get(node.id);
   if(!dirtyMeasure&&prior&&(!node.measure||explicitW!==undefined&&explicitH!==undefined||prior.contentMeasured)&&sameLeaf(prior.node,node)&&prior.availableWidth===aw&&prior.availableHeight===ah&&prior.density===density){measuredWidth=prior.intrinsicWidth;measuredHeight=prior.intrinsicHeight;dependencyRevision=prior.dependencyRevision;reusedMeasurements++;const result={node,intrinsicWidth:measuredWidth,intrinsicHeight:measuredHeight,contentMeasured:prior.contentMeasured,width:resolve(measuredWidth,explicitW,minW,maxW),height:resolve(measuredHeight,explicitH,minH,maxH),dependencyRevision,availableWidth:aw,availableHeight:ah,density,children};next.set(node.id,result);return result;}
   if(node.measure&&(explicitW===undefined||explicitH===undefined)){
    const raw=fields(node.measure(Object.freeze({availableWidth:aw,availableHeight:ah,density})),['width','height','dependencyRevision']);measurementCalls++;contentMeasured=true;measuredWidth=finite(raw.width)+pad*2;measuredHeight=finite(raw.height)+pad*2;dependencyRevision=integer(raw.dependencyRevision,Number.MAX_SAFE_INTEGER);
   }else{measuredWidth=pad*2;measuredHeight=pad*2;}
  }else if(node.kind==='virtualList'){
   if(explicitW===undefined||explicitH===undefined)throw new EgretError('UI_LAYOUT_CYCLE');if(explicitW<=0||explicitH<=0||explicitW>16384||explicitH>16384)invalid();measuredWidth=explicitW;measuredHeight=explicitH;
  }else {
   const row=node.kind==='row',stretch=node.crossAlign==='stretch';if(stretch&&(row?explicitH:explicitW)===undefined)throw new EgretError('UI_LAYOUT_CYCLE');
   for(const child of node.children!){const forcedW=!row&&stretch&&child.explicitWidth===undefined?resolve(aw,undefined,child.minWidth!,child.maxWidth!):undefined,forcedH=row&&stretch&&child.explicitHeight===undefined?resolve(ah,undefined,child.minHeight!,child.maxHeight!):undefined;children.push(measure(child,aw,ah,forcedW,forcedH,dirtyMeasure));}
   let main=0,cross=0;for(const child of children){main+=row?child.width:child.height;cross=Math.max(cross,row?child.height:child.width);dependencyRevision=Math.max(dependencyRevision,child.dependencyRevision);}
   main+=Math.max(0,children.length-1)*node.gap!;measuredWidth=(row?main:cross)+pad*2;measuredHeight=(row?cross:main)+pad*2;
  }
  const result:Measured={node,intrinsicWidth:measuredWidth,intrinsicHeight:measuredHeight,contentMeasured,width:resolve(measuredWidth,explicitW,minW,maxW),height:resolve(measuredHeight,explicitH,minH,maxH),dependencyRevision,availableWidth:aw,availableHeight:ah,density,children};next.set(node.id,result);return result;
 }
 const measured=measure(tree.root,width,height),boxes:UiLayoutBox[]=[];
 function arrange(m:Measured,x:number,y:number,parentId:string|undefined,order:number):void {
  finite(x,-CAP,CAP);finite(y,-CAP,CAP);finite(x+m.width,-CAP,CAP);finite(y+m.height,-CAP,CAP);const node=m.node,pad=node.padding!,innerX=x+pad,innerY=y+pad,innerWidth=Math.max(0,m.width-pad*2),innerHeight=Math.max(0,m.height-pad*2);
  boxes.push(Object.freeze({id:node.id,parentId,order,x:x===0?0:x,y:y===0?0:y,width:m.width,height:m.height,innerX,innerY,innerWidth,innerHeight,clip:node.kind==='virtualList',dependencyRevision:m.dependencyRevision}));
  const row=node.kind==='row';let cursor=0;for(let i=0;i<m.children.length;i++){const child=m.children[i]!,available=row?innerHeight:innerWidth,size=row?child.height:child.width,free=available-size,align=node.crossAlign;const cross=align==='center'?free/2:align==='end'?free:0;arrange(child,innerX+(row?cursor:cross),innerY+(row?cross:cursor),node.id,i);cursor+=(row?child.width:child.height)+node.gap!;}
 }
 arrange(measured,0,0,undefined,0);const result=Object.freeze({boxes:Object.freeze(boxes),measurementCalls,reusedMeasurements});caches.set(result,next);return result;
}
