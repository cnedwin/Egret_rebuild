import type { ProjectId, EntityId, FileId, TransactionId, ProjectSnapshot, ProjectEditTransaction, ProjectRestoreTransaction, ProjectVersionPins, ProjectFileRole, ProjectTransactionSource, ProjectOperation, ProjectHistory, ProjectValueResult, ProjectCommitResult } from '@egret/project';
declare const projectId: ProjectId;
declare const entityId: EntityId;
declare const fileId: FileId;
declare const transactionId: TransactionId;
declare const snapshot: ProjectSnapshot;
declare const edit: ProjectEditTransaction;
declare const restore: ProjectRestoreTransaction;
declare const pins: ProjectVersionPins;
declare const source: ProjectTransactionSource;
declare const result: ProjectValueResult<ProjectSnapshot>;
declare const commit: ProjectCommitResult;

// @ts-expect-error PROJECT_CASE project-entity TS2322
const wrongProject: ProjectId = entityId;
// @ts-expect-error PROJECT_CASE project-file TS2322
const wrongFile: FileId = projectId;
// @ts-expect-error PROJECT_CASE project-transaction TS2322
const wrongTransaction: TransactionId = projectId;
// @ts-expect-error PROJECT_CASE entity-file TS2322
const wrongEntity: EntityId = fileId;
// @ts-expect-error PROJECT_CASE entity-transaction TS2322
const otherEntity: EntityId = transactionId;
// @ts-expect-error PROJECT_CASE file-transaction TS2322
const otherFile: FileId = transactionId;
// @ts-expect-error PROJECT_CASE readonly-nested TS2540
snapshot.versions.toolProtocolVersion = '1.0';
// @ts-expect-error PROJECT_CASE readonly-data TS2542
snapshot.entities[0]!.data['value'] = 1;
// @ts-expect-error PROJECT_CASE readonly-array TS2339
snapshot.entities.push(snapshot.entities[0]!);
const {scope, ...withoutScope} = edit;
// @ts-expect-error PROJECT_CASE missing-scope TS2741
const missingScope: ProjectEditTransaction = withoutScope;
// @ts-expect-error PROJECT_CASE restore-scope TS2353
const restoreScope: ProjectRestoreTransaction = {...restore, scope};
// @ts-expect-error PROJECT_CASE restore-operations TS2353
const restoreOperations: ProjectRestoreTransaction = {...restore, operations:edit.operations};
// @ts-expect-error PROJECT_CASE snapshot-version TS2322
const snapshotVersion: ProjectSnapshot = {...snapshot, projectSchemaVersion:'2.0'};
// @ts-expect-error PROJECT_CASE history-version TS2322
const historyVersion: ProjectHistory = {historySchemaVersion:'2.0',baseline:snapshot,transactions:[]};
// @ts-expect-error PROJECT_CASE protocol-version TS2322
const protocol: ProjectVersionPins = {...pins, toolProtocolVersion:'2.0'};
// @ts-expect-error PROJECT_CASE file-role TS2322
const role: ProjectFileRole = 'script';
// @ts-expect-error PROJECT_CASE actor-kind TS2322
const actor: ProjectTransactionSource = {...source, actorKind:'human'};
// @ts-expect-error PROJECT_CASE operation-enum TS2322
const operation: ProjectOperation = {op:'deleteEntity'};
if (!result.ok) {
  // @ts-expect-error PROJECT_CASE failed-value TS2339
  result.value;
}
if (commit.status === 'rejected') {
  // @ts-expect-error PROJECT_CASE rejected-receipt TS2339
  commit.receipt;
}
// @ts-expect-error PROJECT_CASE private-import TS2307
import type { Prepared } from '@egret/project/internal';
// @ts-expect-error PROJECT_CASE deep-import TS2307
import { makeStore } from '@egret/project/dist/store.js';
// @ts-expect-error PROJECT_CASE private-root TS2305
import { makeStore as leakedStore } from '@egret/project';
// @ts-expect-error PROJECT_CASE dom-global TS2584
document.createElement('canvas');
// @ts-expect-error PROJECT_CASE window-global TS2304
window.location;
// @ts-expect-error PROJECT_CASE fetch-global TS2304
fetch('https://invalid.example');
// @ts-expect-error PROJECT_CASE node-global TS2591
process.exit(0);
// @ts-expect-error PROJECT_CASE buffer-global TS2591
Buffer.from('a');
void wrongProject; void wrongFile; void wrongTransaction; void wrongEntity; void otherEntity; void otherFile;
void missingScope; void restoreScope; void restoreOperations; void snapshotVersion; void historyVersion; void protocol; void role; void actor; void operation;
