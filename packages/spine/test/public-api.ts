// SPDX-License-Identifier: Apache-2.0
// Compile with ES-only ambient types; the private vendor DOM declarations must not leak.
import {createSpineContentLoader} from '@egret/spine';
import type {SpineAsset,SpineAssetInfo,SpinePageInfo,SpineContentBinding,SpineContentGroup,SpineContentLoader,SpineContentOptions,SpineContentProviders,SpineContentProviderFactory,SpineContentStatus} from '@egret/spine';
import type {Engine,Scope} from '@egret/engine';
import type {AdmittedResourceManifest} from '@egret/contracts/resources';
declare const engine:Engine,scope:Scope,manifest:AdmittedResourceManifest,factory:SpineContentProviderFactory;
const options:SpineContentOptions={allowPrerelease:false,maxSetupBytes:1024};
const loader:SpineContentLoader=createSpineContentLoader(engine,scope,manifest,factory,options);
const group:SpineContentGroup=loader.load(scope,['e_skeleton'],{priority:'background'});
const asset:SpineAsset=group.getSpine('e_skeleton'),info:SpineAssetInfo=asset.info,page:SpinePageInfo=info.pages[0]!;
const alpha:false=page.sourcePremultiplied,version:'4.3.13'=info.coreVersion,status:SpineContentStatus=loader.getStatus();
declare const bindings:readonly SpineContentBinding[];const ports:SpineContentProviders=factory(bindings);
void [alpha,version,status,ports,group.ready,asset.isDisposed,loader.close()];
