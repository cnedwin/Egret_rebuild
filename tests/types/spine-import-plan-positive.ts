import {createSpineImportPlan, SPINE_IMPORT_LIMITS} from '@egret/project/spine';
import type {SpineImportInput, SpineTextSource, SpinePageBinding, SpineProvenance, SpineImportPlan, SpineImportResult, SpineImportDiagnostic, SpineImportDiagnosticCode, SpineSourceSpan, SpinePagePlan, SpineRegionPlan} from '@egret/project/spine';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Expect<T extends true>=T;
type AllTypes=[SpineImportInput,SpineTextSource,SpinePageBinding,SpineProvenance,SpineImportPlan,SpineImportResult,SpineImportDiagnostic,SpineImportDiagnosticCode,SpineSourceSpan,SpinePagePlan,SpineRegionPlan];
type Signature=Expect<Equal<typeof createSpineImportPlan,(input:SpineImportInput)=>SpineImportResult>>;
type InputKeys=Expect<Equal<keyof SpineImportInput,'skeleton'|'atlas'|'pages'>>;
type DiagnosticSource=Expect<Equal<SpineImportDiagnostic['source'],'input'|'skeleton'|'atlas'>>;
type SpanSource=Expect<Equal<SpineSourceSpan['source'],'skeleton'|'atlas'>>;
type PlanKeys=Expect<Equal<keyof SpineImportPlan,'planVersion'|'sourceDeclarations'|'exportVersion'|'runtimeCandidate'|'names'|'pages'|'observations'|'acceptance'>>;
type Acceptance=Expect<Equal<SpineImportPlan['acceptance'],{readonly animationSemantics:'not_run';readonly rendering:'not_run';readonly licenseEntitlement:'unverified';readonly featureInventory:'partial'}>>;
type RuntimeCandidate=Expect<Equal<SpineImportPlan['runtimeCandidate'],{readonly series:'4.3';readonly package:'@esotericsoftware/spine-core';readonly sourceTag:'spine-ts-4.3.13';readonly sourceCommit:'b7beb2ccbbce667a12c02f44d070644f59b04968';readonly artifactVerification:'not_run'}>>;
type LimitKeys=Expect<Equal<keyof typeof SPINE_IMPORT_LIMITS,'maxSkeletonUtf8Bytes'|'maxAtlasUtf8Bytes'|'maxJsonDepth'|'maxJsonNodes'|'maxJsonProperties'|'maxJsonStringUtf8Bytes'|'maxJsonKeyUtf8Bytes'|'maxSourceIdUtf8Bytes'|'maxAssetIdUtf8Bytes'|'maxNameUtf8Bytes'|'maxPagePathUtf8Bytes'|'maxProvenanceFieldUtf8Bytes'|'maxProvenanceTotalUtf8Bytes'|'maxAtlasPages'|'maxAtlasRegions'|'maxAtlasFieldsPerSection'|'maxAtlasLineUtf8Bytes'|'maxAtlasPageDimension'|'maxAtlasRegionCoordinate'|'maxAtlasPackedDimension'|'maxAtlasOffset'|'maxAtlasOriginalDimension'|'maxAtlasIndex'|'maxNamesPerCollection'|'maxObservations'|'maxSuccessDiagnostics'|'maxDiagnosticPointerUtf8Bytes'|'maxObservationValueUtf8Bytes'>>;
const provenance:SpineProvenance={origin:'original programmatic fixture',license:'Apache-2.0',notice:'Egret community fixture'};
const skeleton:SpineTextSource={id:'skeleton:original',text:'{"skeleton":{"spine":"4.3.13"}}',provenance};
const atlas:SpineTextSource={id:'atlas:original',text:'page.png\nsize: 1,1\n',provenance};
const binding:SpinePageBinding={pageName:'page.png',assetId:'page:original',provenance};
const result:SpineImportResult=createSpineImportPlan({skeleton,atlas,pages:[binding]});
if(result.ok){
  const plan:SpineImportPlan=result.value;
  const page:SpinePagePlan|undefined=plan.pages[0];
  const region:SpineRegionPlan|undefined=page?.regions[0];
  const partial:'partial'=plan.acceptance.featureInventory;
  const unverified:'unverified'=plan.acceptance.licenseEntitlement;
  const version:1=plan.planVersion;
  const observations:readonly SpineImportPlan['observations'][number][]=plan.observations;
  void region;void partial;void unverified;void version;void observations;
}else{
  const diagnostic:SpineImportDiagnostic|undefined=result.diagnostics[0];
  const code:SpineImportDiagnosticCode|undefined=diagnostic?.code;
  const span:SpineSourceSpan|undefined=diagnostic?.span;
  void code;void span;
}
const ceiling:number=SPINE_IMPORT_LIMITS.maxJsonDepth;
void ceiling;
export type ExactSpinePlannerContract=AllTypes|Signature|InputKeys|DiagnosticSource|SpanSource|PlanKeys|Acceptance|RuntimeCandidate|LimitKeys;
