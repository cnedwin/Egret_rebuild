// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '../EgretError.js';
import type { UiHeightRecord, UiHeightUpdate, UiHeightView, UiHeightJournal, UiRowRange, UiScrollAnchor } from './types.js';
const CAP=50000, MAX_HEIGHT=1048576, MAX_TOTAL=2**40;
function invalid():never {throw new EgretError('UI_INVALID');}
function finite(value:unknown,min:number,max:number):number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)invalid();return value===0?0:value;}
function counter(value:unknown):number {const n=finite(value,0,Number.MAX_SAFE_INTEGER);return n%1===0?n:invalid();}
function key(value:unknown):string {if(typeof value!=='string'||value.length===0||value.length>128)invalid();return value;}
function index(value:number,max:number):number {if(!Number.isInteger(value)||value<0||value>max)invalid();return value;}
function arrayCount(value:unknown):number {
 if(!Array.isArray(value))invalid();const count=value.length;
 if(typeof count!=='number'||!Number.isInteger(count)||count<0)invalid();if(count>CAP)throw new EgretError('UI_LIMIT');return count===0?0:count;
}
function fields(value:unknown,allowed:readonly string[]):Record<string,unknown> {
 if(value===null||typeof value!=='object')invalid();const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)invalid();
 const result:Record<string,unknown>={};for(const name of Reflect.ownKeys(value)){if(typeof name!=='string'||!allowed.includes(name))invalid();result[name]=(value as Record<string,unknown>)[name];}return result;
}
abstract class HeightView implements UiHeightView {
 public abstract readonly size:number; public abstract readonly totalHeight:number; public abstract readonly measuredCount:number;
 public abstract keyAt(i:number):string;public abstract versionAt(i:number):number;public abstract heightAt(i:number):number;public abstract indexOf(k:string):number;
 protected abstract cell(i:number):number;
 public prefix(end:number):number {index(end,this.size);let sum=0;for(let i=end;i>0;i-=i&-i)sum+=this.cell(i);return sum===0?0:sum;}
 public find(offset:number):number {
  finite(offset,-Number.MAX_VALUE,Number.MAX_VALUE);if(!this.size)return -1;if(offset<0)return 0;
  let found=0,sum=0,bit=1;while(bit*2<=this.size)bit*=2;
  for(;bit>0;bit=Math.floor(bit/2)){const next=found+bit;if(next<=this.size&&sum+this.cell(next)<=offset){sum+=this.cell(next);found=next;}}
  return Math.min(found,this.size-1);
 }
 public clampScroll(scroll:number,viewport:number):number {finite(scroll,-Number.MAX_VALUE,Number.MAX_VALUE);finite(viewport,Number.MIN_VALUE,16384);return Math.max(0,Math.min(scroll,Math.max(0,this.totalHeight-viewport)));}
 public range(scroll:number,viewport:number,overscan=2):UiRowRange {
  const s=this.clampScroll(scroll,viewport);finite(overscan,0,32);if(!Number.isInteger(overscan))invalid();if(!this.size)return Object.freeze({start:0,end:0,visibleStart:0,visibleEnd:0});
  const visibleStart=this.find(s);let visibleEnd=visibleStart,top=this.prefix(visibleStart);while(visibleEnd<this.size&&top<s+viewport){top+=this.heightAt(visibleEnd);visibleEnd++;}
  return Object.freeze({start:Math.max(0,visibleStart-overscan),end:Math.min(this.size,visibleEnd+overscan),visibleStart,visibleEnd});
 }
 public anchor(scroll:number):UiScrollAnchor|undefined {finite(scroll,-Number.MAX_VALUE,Number.MAX_VALUE);if(!this.size)return undefined;const s=Math.max(0,Math.min(scroll,this.totalHeight));const i=this.find(s);return Object.freeze({key:this.keyAt(i),offset:s-this.prefix(i)});}
 public preserveAnchor(anchor:UiScrollAnchor|undefined,old:UiHeightView,viewport:number):number {
  if(!anchor||!this.size)return this.clampScroll(0,viewport);key(anchor.key);finite(anchor.offset,0,MAX_HEIGHT);
  let at=this.indexOf(anchor.key),offset=anchor.offset;
  if(at<0){offset=0;const previous=old.indexOf(anchor.key);if(previous>=0){for(let i=previous+1;i<old.size;i++){at=this.indexOf(old.keyAt(i));if(at>=0)break;}if(at<0)for(let i=previous-1;i>=0;i--){at=this.indexOf(old.keyAt(i));if(at>=0)break;}}if(at<0)at=0;}
  return this.clampScroll(this.prefix(at)+Math.min(offset,this.heightAt(at)),viewport);
 }
}
/** O(n) structural rebuild; point candidates retain only sparse changed cells. */
export class UiHeightIndex extends HeightView {
 readonly #keys:string[]=[];readonly #versions:number[]=[];readonly #heights:Float64Array;readonly #tree:Float64Array;readonly #positions=new Map<string,number>();readonly #measured:Uint8Array;
 readonly #width:number;readonly #density:number;#measuredCount=0;#revision=0;
 public constructor(records:readonly UiHeightRecord[],width:number,density:number,previous?:UiHeightIndex){
  super();const count=arrayCount(records);this.#width=finite(width,Number.MIN_VALUE,16384);this.#density=finite(density,Number.MIN_VALUE,8);
  this.#heights=new Float64Array(count);this.#tree=new Float64Array(count+1);this.#measured=new Uint8Array(count);
  const canReuse=previous!==undefined&&previous.#width===width&&previous.#density===density;
  for(let i=0;i<count;i++){
   const record=fields(records[i],['key','contentVersion','estimatedHeight','value']);const k=key(record.key),v=counter(record.contentVersion),estimate=finite(record.estimatedHeight,1,MAX_HEIGHT);
   if(this.#positions.has(k))throw new EgretError('UI_DUPLICATE_KEY');this.#keys.push(k);this.#versions.push(v);this.#positions.set(k,i);
   const old=canReuse?previous.#positions.get(k):undefined;const reuse=old!==undefined&&previous!.#versions[old]===v&&previous!.#measured[old]===1;
   const h=reuse?previous!.#heights[old]!:estimate;this.#heights[i]=h;if(reuse){this.#measured[i]=1;this.#measuredCount++;}this.#tree[i+1]=h;
  }
  // Linear Fenwick construction, including validation before exposing this value.
  let total=0;for(let i=1;i<=count;i++){total+=this.#heights[i-1]!;const parent=i+(i&-i);if(parent<=count)this.#tree[parent]=this.#tree[parent]!+this.#tree[i]!;}
  if(!Number.isFinite(total)||total>MAX_TOTAL)throw new EgretError('UI_LIMIT');
 }
 public get size():number{return this.#keys.length;}
 public get totalHeight():number{return this.prefix(this.size);}
 public get measuredCount():number{return this.#measuredCount;}
 /** Numeric typed-array bytes only; string, map and JS heap storage excluded. */
 public get logicalBytes():number{return this.#tree.byteLength+this.#heights.byteLength+this.#measured.byteLength;}
 public keyAt(i:number):string{return this.#keys[index(i,this.size-1)]!;}
 public versionAt(i:number):number{return this.#versions[index(i,this.size-1)]!;}
 public heightAt(i:number):number{return this.#heights[index(i,this.size-1)]!;}
 public indexOf(k:string):number{return this.#positions.get(k)??-1;}
 protected cell(i:number):number{return this.#tree[i]!;}
 public stageHeights(updates:readonly UiHeightUpdate[]):UiHeightJournal {
  const count=arrayCount(updates);const captured:{i:number,h:number}[]=[],seen=new Set<string>();
  // Validate all records before allocating journal cells or writing committed state.
  for(let u=0;u<count;u++){const update=fields(updates[u],['key','contentVersion','height']);const k=key(update.key),v=counter(update.contentVersion),h=finite(update.height,1,MAX_HEIGHT);if(seen.has(k))throw new EgretError('UI_DUPLICATE_KEY');seen.add(k);const i=this.#positions.get(k);if(i===undefined)throw new EgretError('UI_UNKNOWN_KEY');if(this.#versions[i]===v)captured.push({i,h});}
  const cells=new Map<number,number>(),heights=new Map<number,number>();let work=0,measured=this.#measuredCount,total=this.totalHeight;
  for(const {i,h} of captured){const delta=h-this.#heights[i]!;heights.set(i,h);if(this.#measured[i]===0)measured++;total+=delta;if(delta!==0)for(let c=i+1;c<=this.size;c+=c&-c){cells.set(c,(cells.get(c)??this.#tree[c]!)+delta);work++;}}
  if(!Number.isFinite(total)||total>MAX_TOTAL)throw new EgretError('UI_LIMIT');
  const base=this,revision=this.#revision;let consumed=false;
  return new class extends HeightView implements UiHeightJournal {
   public readonly cellWork=work;public readonly changedCount=heights.size;
   public get size():number{return base.size;}public get totalHeight():number{return total;}public get measuredCount():number{return measured;}
   public keyAt(i:number):string{return base.keyAt(i);}public versionAt(i:number):number{return base.versionAt(i);}public indexOf(k:string):number{return base.indexOf(k);}
   public heightAt(i:number):number{index(i,this.size-1);return heights.get(i)??base.#heights[i]!;}
   protected cell(i:number):number{return cells.get(i)??base.#tree[i]!;}
   public apply():void {
    if(consumed||base.#revision!==revision)throw new EgretError('UI_STALE');if(base.#revision===Number.MAX_SAFE_INTEGER)throw new EgretError('UI_LIMIT');consumed=true;
    for(const [i,h] of heights){base.#heights[i]=h;base.#measured[i]=1;}for(const [i,h] of cells)base.#tree[i]=h;base.#measuredCount=measured;base.#revision++;
   }
  }();
 }
}
