// SPDX-License-Identifier: Apache-2.0
import type { CancellationSignal } from '@egret/contracts';
import { Bitmap } from '../Bitmap.js';
import { DisplayObjectContainer } from '../DisplayObjectContainer.js';
import { CancellationController } from '../CancellationController.js';
import { EgretError } from '../EgretError.js';
import { Scope } from '../Scope.js';
import { assertTextFieldScope } from '../textDisplayState.js';
import type { EngineContext } from '../ownership.js';
import { claimOwner, prepareChildInsertion, publishPreparedChildInsertion } from '../ownership.js';
import { childCountOf, parentOf, removeNode } from '../displayTreeState.js';
import { assertManagedEdgeMutable } from '../ui/managedState.js';
import { snapshotParagraphRequest } from './request.js';
import type { ParagraphMetrics, ParagraphRequest, ParagraphRequestInput, ParagraphStatus, PreparedParagraph } from './types.js';

export interface ParagraphCachePort {
  readonly context: EngineContext;
  assertOpen(): void;
  generation(): number;
  acquire(request: ParagraphRequestInput, signal: CancellationSignal): Promise<PreparedParagraph>;
}
interface Demand { readonly revision: number; readonly generation: number; readonly controller: CancellationController; readonly promise: Promise<ParagraphMetrics>; readonly reject: (cause: unknown) => void; }
interface State { readonly scope: Scope; readonly cache: ParagraphCachePort; disposed: boolean; revision: number; request: ParagraphRequest | undefined; committedRevision: number | undefined; committedGeneration: number | undefined; metrics: ParagraphMetrics | undefined; image: Bitmap | undefined; committed: PreparedParagraph | undefined; pending: Demand | undefined; }
const states=new WeakMap<object,State>();
const useScope=Scope.prototype.use,disposeContainer=DisplayObjectContainer.prototype.dispose;
const creationToken=Symbol('egret.paragraph.factory');
function stateOf(node: object): State {const s=states.get(node);if(!s)throw new EgretError('PARAGRAPH_INVALID');return s;}
function live(s: State): void {if(s.disposed)throw new EgretError('PARAGRAPH_DISPOSED');s.cache.assertOpen();assertTextFieldScope(s.scope);}
function cancel(s: State, code: string): void { const demand=s.pending;s.pending=undefined;if(demand){const error=new EgretError(code);demand.reject(error);demand.controller.abort(error);} }

class ParagraphNode extends DisplayObjectContainer {
  public constructor(scope: Scope, cache: ParagraphCachePort, token: typeof creationToken) {
    super();if(token!==creationToken)throw new EgretError('PARAGRAPH_FACTORY_REQUIRED');
    const s:State={scope,cache,disposed:false,revision:0,request:undefined,committedRevision:undefined,committedGeneration:undefined,metrics:undefined,image:undefined,committed:undefined,pending:undefined};
    states.set(this,s);live(s);Reflect.apply(useScope,scope,[this]);
  }
  public setRequest(input: ParagraphRequestInput): void {
    const s=stateOf(this);live(s);const request=snapshotParagraphRequest(input);live(s);
    if(s.request!==undefined && JSON.stringify(s.request)===JSON.stringify(request))return;
    if(!Number.isSafeInteger(s.revision+1))throw new EgretError('PARAGRAPH_REVISION_EXHAUSTED');
    s.revision++;s.request=request;cancel(s,'PARAGRAPH_STALE');
  }
  public prepare(): Promise<ParagraphMetrics> {
    const s=stateOf(this);
    try {
      live(s);const request=s.request;if(!request)throw new EgretError('PARAGRAPH_REQUEST_REQUIRED');
      const revision=s.revision,generation=s.cache.generation();
      if(s.pending?.revision===revision && s.pending.generation===generation)return s.pending.promise;
      if(s.committedRevision===revision && s.committedGeneration===generation && s.metrics)return Promise.resolve(s.metrics);
      cancel(s,'PARAGRAPH_STALE');const controller=new CancellationController();
      let fulfill!: (value: ParagraphMetrics) => void, reject!: (cause: unknown) => void;
      const promise=new Promise<ParagraphMetrics>((resolve,fail)=>{fulfill=resolve;reject=fail;});
      // Demand authority exists before an injected provider can synchronously reenter.
      s.pending={revision,generation,controller,promise,reject};
      const work=s.cache.acquire(request,controller.signal).then(prepared=>{
        let image: Bitmap | undefined, published=false;
        try {
          live(s);
          if(s.revision!==revision || s.cache.generation()!==generation || controller.signal.aborted)throw new EgretError('PARAGRAPH_STALE');
          image=new Bitmap(prepared.lease);
          // The paragraph retires its internal bitmap; share Scope identity without
          // appending a retained Scope registration for every text replacement.
          claimOwner(image,s.scope);image.x=prepared.offsetX;image.y=prepared.offsetY;image.scaleX=1/prepared.density;image.scaleY=1/prepared.density;
          const previousImage=s.image,previous=s.committed;
          // Capture and validate the private insertion without invoking public subclass hooks.
          assertManagedEdgeMutable(this,image);
          const insertion=prepareChildInsertion(this,image,childCountOf(this));
          live(s);
          if(s.revision!==revision || s.cache.generation()!==generation || controller.signal.aborted)throw new EgretError('PARAGRAPH_STALE');
          assertManagedEdgeMutable(this,image);
          if(previousImage && parentOf(previousImage)===this)assertManagedEdgeMutable(this,previousImage);
          // Private publication and removal contain no overridable hooks or external callbacks.
          publishPreparedChildInsertion(insertion);
          if(previousImage && parentOf(previousImage)===this)removeNode(this,previousImage);
          s.image=image;s.committed=prepared;s.metrics=prepared.metrics;s.committedRevision=revision;s.committedGeneration=generation;published=true;
          if(s.pending?.controller===controller)s.pending=undefined;
          try {previousImage?.dispose();}finally {previous?.lease.release();}
          return prepared.metrics;
        }finally {if(!published){image?.dispose();prepared.lease.release();}}
      }).catch(cause=>{if(s.pending?.controller===controller)s.pending=undefined;throw cause;});
      void work.then(fulfill,reject);return promise;
    }catch(cause){return Promise.reject(cause);}
  }
  public getStatus(): ParagraphStatus {
    const s=stateOf(this);return Object.freeze({state:s.disposed?'disposed':s.metrics?'ready':'unprepared',desiredRevision:s.revision,committedRevision:s.committedRevision,pending:s.pending!==undefined,metrics:s.metrics,...(s.committed?.geometry?{geometry:s.committed.geometry}:{})});
  }
  public override dispose(): void {
    const s=stateOf(this);if(s.disposed)return;s.disposed=true;
    const committed=s.committed;s.committed=undefined;s.image=undefined;s.request=undefined;
    // Scope closure cancels pending demand before native work can publish a late result.
    try {cancel(s,'PARAGRAPH_DISPOSED');}finally {try {Reflect.apply(disposeContainer,this,[]);}finally {committed?.lease.release();}}
  }
}
export function createParagraphNode(scope: Scope, cache: ParagraphCachePort): DisplayObjectContainer {return new ParagraphNode(scope,cache,creationToken);}
