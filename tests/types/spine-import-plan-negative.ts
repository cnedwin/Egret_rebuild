import {createSpineImportPlan,SPINE_IMPORT_LIMITS} from '@egret/project/spine';
import type {SpineImportInput,SpineTextSource,SpinePageBinding,SpineProvenance,SpineImportPlan,SpineImportResult,SpineImportDiagnostic,SpineImportDiagnosticCode,SpineSourceSpan,SpinePagePlan,SpineRegionPlan} from '@egret/project/spine';
declare const input:SpineImportInput;
declare const source:SpineTextSource;
declare const provenance:SpineProvenance;
declare const plan:SpineImportPlan;
declare const result:SpineImportResult;
declare const diagnostic:SpineImportDiagnostic;
declare const page:SpinePagePlan;
declare const region:SpineRegionPlan;
// SPINE_IMPORT_CASE required-input
createSpineImportPlan();
// SPINE_IMPORT_CASE numeric-text
const numericText:SpineTextSource={id:'s',text:1,provenance};
// SPINE_IMPORT_CASE numeric-source-id
const numericId:SpineTextSource={id:1,text:'{}',provenance};
// SPINE_IMPORT_CASE required-provenance
const missingProvenance:SpineTextSource={id:'s',text:'{}'};
// SPINE_IMPORT_CASE required-provenance-notice
const missingNotice:SpineProvenance={origin:'a',license:'Apache-2.0'};
// SPINE_IMPORT_CASE no-limit-override
createSpineImportPlan({...input,limits:{maxJsonDepth:100}});
// SPINE_IMPORT_CASE no-fetch-callback
createSpineImportPlan({...input,fetch:()=>source});
// SPINE_IMPORT_CASE required-asset-id
const missingAssetId:SpinePageBinding={pageName:'page.png',provenance};
// SPINE_IMPORT_CASE numeric-asset-id
const numericAssetId:SpinePageBinding={pageName:'page.png',assetId:1,provenance};
// SPINE_IMPORT_CASE readonly-plan-version
plan.planVersion=1;
// SPINE_IMPORT_CASE readonly-page-name
page.name='other.png';
// SPINE_IMPORT_CASE readonly-region-width
region.width=2;
// SPINE_IMPORT_CASE readonly-output-array
plan.pages.push(page);
// SPINE_IMPORT_CASE readonly-limit
SPINE_IMPORT_LIMITS.maxJsonDepth=100;
// SPINE_IMPORT_CASE exact-input-source
const wrongSource:SpineImportDiagnostic['source']='file';
// SPINE_IMPORT_CASE no-input-text-span
const wrongSpan:SpineSourceSpan={source:'input',sourceId:'s',offset:0,length:1,line:1,column:1};
// SPINE_IMPORT_CASE closed-code
const wrongCode:SpineImportDiagnosticCode='SPINE_READY';
// SPINE_IMPORT_CASE no-ready-acceptance
const ready:SpineImportPlan['acceptance']['rendering']='passed';
// SPINE_IMPORT_CASE readonly-diagnostic
diagnostic.pointer='/other';
// SPINE_IMPORT_CASE no-value-in-failure
if(!result.ok)void result.value;
// SPINE_IMPORT_CASE no-type-runtime
void SpineImportInput;
// SPINE_IMPORT_CASE no-span-runtime
void SpineSourceSpan;
