import { DEFAULT_PROJECT_LIMITS, parseProjectSnapshot, serializeProjectSnapshot, parseProjectTransaction, createProjectStore, openProjectHistory } from '@egret/project';
import type { ProjectId, EntityId, FileId, TransactionId, ProjectRevision, Sha256, JsonValue, JsonObject, ProjectVersionPins, ProjectReference, ProjectEntity, ProjectFileRole, ProjectFile, ProjectSnapshot, ProjectTransactionSource, ProjectTransactionScope, ProjectOperation, ProjectEditTransaction, ProjectRestoreTransaction, ProjectTransaction, ProjectHistory, ProjectDiff, ProjectDiagnosticCode, ProjectDiagnostic, ProjectValueResult, ProjectTransactionReceipt, ProjectCommitResult, ProjectLimits, ProjectStore } from '@egret/project';

// All 29 names are consumed through the built public declaration root.
type ConsumerTypes = [ProjectId, EntityId, FileId, TransactionId, ProjectRevision, Sha256, JsonValue, JsonObject, ProjectVersionPins, ProjectReference, ProjectEntity, ProjectFileRole, ProjectFile, ProjectSnapshot, ProjectTransactionSource, ProjectTransactionScope, ProjectOperation, ProjectEditTransaction, ProjectRestoreTransaction, ProjectTransaction, ProjectHistory, ProjectDiff, ProjectDiagnosticCode, ProjectDiagnostic, ProjectValueResult<ProjectSnapshot>, ProjectTransactionReceipt, ProjectCommitResult, ProjectLimits, ProjectStore];
declare const all: ConsumerTypes;
void all;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type LimitsSignature = Assert<Equal<typeof DEFAULT_PROJECT_LIMITS, ProjectLimits>>;
type ParseSnapshotSignature = Assert<Equal<typeof parseProjectSnapshot, (text: string, limits?: Partial<ProjectLimits>) => ProjectValueResult<ProjectSnapshot>>>;
type SerializeSnapshotSignature = Assert<Equal<typeof serializeProjectSnapshot, (snapshot: ProjectSnapshot, limits?: Partial<ProjectLimits>) => ProjectValueResult<string>>>;
type ParseTransactionSignature = Assert<Equal<typeof parseProjectTransaction, (text: string, limits?: Partial<ProjectLimits>) => ProjectValueResult<ProjectTransaction>>>;
type CreateSignature = Assert<Equal<typeof createProjectStore, (baseline: ProjectSnapshot, limits?: Partial<ProjectLimits>) => ProjectValueResult<ProjectStore>>>;
type OpenSignature = Assert<Equal<typeof openProjectHistory, (text: string, limits?: Partial<ProjectLimits>) => ProjectValueResult<ProjectStore>>>;

const parsed = parseProjectSnapshot('{}', { maxReplayWorkUnits: 100 });
if (parsed.ok) {
  const serialized: ProjectValueResult<string> = serializeProjectSnapshot(parsed.value);
  const created = createProjectStore(parsed.value);
  if (created.ok) {
    const store: ProjectStore = created.value;
    const journal = store.exportHistory();
    if (journal.ok) {
      const reopened: ProjectValueResult<ProjectStore> = openProjectHistory(journal.value);
      void reopened;
    }
    const command = parseProjectTransaction('{}');
    if (command.ok) {
      const committed = store.commit(command.value);
      if (committed.status === 'rejected') {
        const head: ProjectSnapshot = committed.snapshot;
        void head;
      } else {
        const receipt: ProjectTransactionReceipt = committed.receipt;
        const diff: ProjectDiff = receipt.diff;
        void diff;
      }
    }
  }
  void serialized;
}
declare const projectId: ProjectId;
declare const transactionId: TransactionId;
const source: ProjectTransactionSource = {actorId:'a',actorKind:'tool',toolId:'a',toolVersion:'1',intent:''};
const edit: ProjectEditTransaction = {command:'edit',toolProtocolVersion:'1.0',projectId,transactionId,baseRevision:0,source,scope:{entityIds:[],fileIds:[],metadata:true,roots:false},operations:[{op:'setMetadata',name:'',versions:{engineVersion:'1',resourceFormatVersion:'1',toolProtocolVersion:'1.0'}}]};
const restore: ProjectRestoreTransaction = {command:'restore',toolProtocolVersion:'1.0',projectId,transactionId,baseRevision:1,source,targetRevision:0};
void edit; void restore;
