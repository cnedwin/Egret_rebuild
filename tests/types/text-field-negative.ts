import { createTextField } from '@egret/engine/text';
import type { TextField,TextFieldStatus,TextRasterCache,TextRasterRequestInput,TextRasterMetrics } from '@egret/engine/text';
import type { Engine,Scope,DisplayObject } from '@egret/engine';
declare const engine:Engine,scope:Scope,cache:TextRasterCache,field:TextField,status:TextFieldStatus,input:TextRasterRequestInput,node:DisplayObject;

// TEXT_FIELD_CASE missing-factory-arguments TS2554
createTextField();
// TEXT_FIELD_CASE extra-factory-argument TS2554
createTextField(engine,scope,cache,scope);
// TEXT_FIELD_CASE readonly-status-state TS2540
status.state='ready';
// TEXT_FIELD_CASE readonly-desired-revision TS2540
status.desiredRevision=2;
// TEXT_FIELD_CASE readonly-committed-revision TS2540
status.committedRevision=2;
// TEXT_FIELD_CASE readonly-pending TS2540
status.pending=false;
// TEXT_FIELD_CASE readonly-metrics TS2540
status.metrics=undefined;
// TEXT_FIELD_CASE no-public-cache TS2339
field.cache;
// TEXT_FIELD_CASE no-public-lease TS2339
field.textureLease;
// TEXT_FIELD_CASE no-caller-cancellation TS2554
field.prepare({signal:scope.signal});
// TEXT_FIELD_CASE no-automatic-text-property TS2339
field.text='A';
// TEXT_FIELD_CASE missing-request TS2554
field.setRequest();
// TEXT_FIELD_CASE incomplete-request TS2740
field.setRequest({text:'A'});
// TEXT_FIELD_CASE promise-result TS2739
const synchronousMetrics:TextRasterMetrics=field.prepare();
// TEXT_FIELD_CASE opaque-node TS2739
const structuralField:TextField=node;
// TEXT_FIELD_CASE no-runtime-type-value TS2693
new TextField();
// TEXT_FIELD_CASE invalid-status-state TS2322
const badState:TextFieldStatus['state']='pending';
// TEXT_FIELD_CASE readonly-content-bounds TS2540
field.getStatus().metrics!.contentBounds.x=1;
void [input,synchronousMetrics,structuralField,badState];
