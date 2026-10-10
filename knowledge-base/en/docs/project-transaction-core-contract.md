# Project transaction core contract

[简体中文](../../Cns/docs/工程事务核心合同.md) | English

Normative contract for the 0.14.0 engineering preview; package version 0.0.0 and protocol 1.0 remain unchanged. Historical independent draft PASS establishes normative closure only. Scoped implementation tests and measurements have separate [evidence](project-transaction-core-evidence.md); final preview review and delivery remain pending at this documentation-authoring checkpoint, with subsequent evidence tracked separately. Original frozen specification identities are retained in the source record (repository-root `source-origin.json`).

## Authority and exact surface

Internal engine-package dependency DAG: project → contracts only. Pinned, attributed, license-compatible public JSON parser/tokenizer/canonicalization dependencies are permitted after fixture and headless-import verification; jsonc-parser3.3.1 is the admitted private scanner/visitor dependency; see the implementation evidence for its actual scope; no runtime/engine/toolchain/legacy reverse edge. No DOM, Node, GPU, filesystem, network, timers, randomness, model or MCP facilities. At import, no host access, IO, timers, randomness, scheduling, or project-store authority creation/mutation occurs. Pure module definitions and constant/cache setup are allowed. Project data is authored authority; runtime and derivative builds do not write it implicitly. File digest/length syntax does not establish content availability, integrity or authorization. Unknown domain payloads survive with explicit unchecked warnings.

The appendix supplies every public TypeScript signature. Its only extension is maxReplayWorkUnits in ProjectLimits. All fields are required except explicit Diagnostic optional fields. Envelopes reject unknown properties; data/details are open JSON dictionaries. Project/history/tool schemas are exactly string "1.0"; every declared enum is closed. Partial limits reject unknown keys, undefined values and nonpositive unsafe integers; omitted keys use defaults. Returned readonly types are also deeply immutable at runtime.

IDs: 3–128 ASCII characters, matching ^p_[A-Za-z0-9][A-Za-z0-9_-]*$ and corresponding e_/f_/t_ patterns. No normalization. Revision/baseRevision/targetRevision/byteLength are integers 0…9007199254740991, excluding negative zero. General JSON data accepts finite doubles and normalizes -0 to 0. Empty roots/references/record/retired/scope arrays are legal; edit operations contain 1…configured maximum entries. name: 0…256 UTF-8 bytes. kind/expectedKind/dataSchemaVersion/version pins/slot/source actorId/toolId/toolVersion: 1…128. intent: 0…1024. mediaType: 1…128 printable ASCII bytes excluding spaces. These constrained fields exclude U+0000…001F/U+007F; arbitrary data strings may contain properly escaped controls. sha256: exactly 64 lowercase hexadecimal digits.

Roots remain ordered and unique. References remain ordered with unique slot per entity. Final targets exist and exactly match expectedKind/expectedRole. General cycles are allowed, without asserting domain-tree validity. Identity cannot change entity kind or file role; dataSchemaVersion changes remain semantically unchecked.

## Input and canonical bytes

Require strict token behavior, not a handwritten parser. Parsing rejects decoded duplicate keys at every depth, lone surrogates, non-JSON numbers and trailing garbage. Integer fields must have an exactly integral safe mathematical token value before double conversion: 9007199254740991.1 must not round into an accepted integer. Negative-zero token forms reject in integer fields. General data numbers use ECMAScript double parsing, rejecting nonfinite results.

Live inputs permit plain Object.prototype/null-prototype objects and Array.prototype arrays. Inspect own descriptors and read only checked data-descriptor values, never getters. Objects reject nonenumerable own keys. Arrays exempt only intrinsic own data length and require exactly enumerable data indices 0…length-1; frozen flags are accepted; holes, extra keys/symbols/accessors reject. Reject custom prototypes, cycles, functions, undefined, BigInt, Date, Map and typed arrays; live strings/keys also reject lone surrogates. Shared acyclic aliases can clone, but traversal bounds expanded logical JSON size/depth before materialization, charging repeated aliases. Proxy traps cannot be sandboxed; reflection failures become PROJECT_INPUT_INVALID, malicious clients use text. Null-prototype clones retain inert __proto__/constructor own data. Live numbers validate only supplied already-rounded values; pre-rounding provenance such as a literal 9007199254740991.1 cannot be recovered. Text integer tokens use bounded sign/coefficient/fraction/exponent analysis and normalized decimal comparison to MAX_SAFE, without constructing huge powers.

Canonical object keys sort by UTF-16 code units, never localeCompare; emit keys directly rather than relying on JSON.stringify integer-key enumeration. Sort entity/file collections by ID, retired sets and scope ID sets. Preserve root/reference/operation order. Strings follow JSON.stringify escaping with original non-ASCII code points; no NFC. Numbers follow ECMAScript JSON representation, data -0 becomes 0. Compact output has no BOM, whitespace or newline. This is a custom protocol, not RFC8785 certification. Snapshot/history/transaction identity/record diff share these bytes. Scope permutations have identical retry identity; operation permutations do not.

Paths are ≤1024 UTF-8 bytes and relative POSIX. Reject absolute/drive/UNC/backslash paths, empty/dot/dot-dot components, controls, : * ? " < > |, trailing spaces/dots and Windows device components CON/PRN/AUX/NUL/COM1…9/LPT1…9, including extensions and case variants. Collision key is exactly path.normalize("NFC").toLowerCase(), using ECMAScript locale-independent Unicode lowercase. Retain original spelling. This does not claim full Unicode case folding or all filesystem aliases; later target adapters recheck actual destinations. No archive, symlink, resolved-containment or IO validation occurs.

## Commit lifecycle and failure atomicity

1. Bound, safely clone and validate command/schema/IDs/canonical bytes. For a valid known transaction ID, check identity before CAS: identical canonical command returns replayed, current head and original receipt, without mutation; valid changed command rejects PROJECT_TRANSACTION_ID_REUSED; syntactically or structurally invalid altered commands fail schema first. Rejected commands do not reserve IDs and may be corrected. Valid retry still succeeds at journal/revision capacity.
2. New IDs require matching project and exact current base revision. Revision overflow rejects PROJECT_LIMIT_EXCEEDED. No rebase. Scope ID sets are unique and namespace-correct. Every direct record target must be declared; metadata/roots operations require their flags. Scope may contain unused IDs; indirectly referenced targets need not be declared. Restore has no scope and explicitly denotes complete-project recovery.
3. Each entity/file target appears once; metadata/roots each once. Remove absent rejects. Put adds or completely replaces; retired IDs cannot be added; live kind/role cannot change. No cascade deletion. Validate references against the completed candidate, allowing forward references.
4. Publish head, immutable command and receipt/retry index at one synchronous point only after every operation, final reference, lifecycle and byte/journal bound passes. Expected rejection retains head identity, prior snapshots and history bytes. No user callbacks. Runtime OOM is not a recoverable product-error guarantee. Every fresh accepted command, including a no-op, increments revision once. Diff excludes revision/retirement changes, sorts ID arrays, compares full canonical record content, compares metadata name+versions and ordered roots.
5. Removal retires identity. Restore revives the same logical entity/file identity; it does not assign that ID to a newly introduced identity or promise JavaScript reference equality. Restore retires (current active ∪ retired ∪ target retired) minus restored active IDs. Authored name/versions/roots/entities/files match the target exactly; revision and retirement knowledge never rewind. IDs introduced after the target become retired. Restored identities still cannot change kind/role.
6. Baseline revision may be nonzero; earliestRevision is that value. A standalone snapshot retains retired IDs but not old dedup receipts or restore history. Creating a store from it is an explicit new history boundary. Durable exact retry requires exportHistory/openProjectHistory.
7. Baseline plus successful commands is sole persisted authority, without rejected/replayed entries, separate head/receipts or implicit pruning. Open validates the entire history before exposing a store: unique transaction IDs, contiguous CAS and restore target between baseline and the prior head. Duplicate retry entries in a journal reject PROJECT_HISTORY_INVALID, even when ordinary commit would replay. Receipts/retry indices are reconstructed. Structurally and semantically valid malicious edits cannot be detected without future authenticated digests; this journal is immutable through API ownership, not tamper-evident storage.
8. Retain baseline, commands, current head, derived receipt/retry index and small derived prefix-cost array P, without caching every complete snapshot. The next section is the sole cost rule. Actual reconstruction uses an explicit stack or equivalent iterative traversal, checks budget before expansion and discards working states afterward. Sharing/memoization does not change admission; actual memory observations are recorded in the implementation evidence, while the true transient peak remains unestablished.

## Bounds and diagnostics

Existing defaults: snapshot 16777216 bytes; history 67108864; transaction 4194304; depth 32 with root container at 1; string/key 65536 bytes; entity active+retired 100000; file active+retired 50000; references/entity 4096; operations/edit 10000; commands 1024. maxReplayWorkUnits default 10000000. Hard ceilings are defaults ×16, except depth 64. Overrides remain positive safe integers and are frozen. These protect the initial implementation, not accepted project size or performance targets. R008/V006 must not silently exclude complete supported projects to fit them.

Depth applies separately to each logical snapshot/transaction with root container=1 and resets at embedded history boundaries. The fixed history wrapper accepts only its specified object+transactions-array shape, without consuming payload depth. Public snapshot/transaction text parsers count complete raw input including whitespace. Open bounds whole raw history text; embedded baseline/command raw spans run from opening { through matching }, excluding outside whitespace, and obey local byte limits alongside local canonical limits. Live inputs have canonical bounds only. Check Unicode before UTF-8 counting; payload keys/values obey string bounds. Return first error plus at most one KIND_UNCHECKED/CONTENT_UNVERIFIED count summary each. Diagnostic bounds are independent of caller document/string/depth limits: message≤1024 UTF-8, canonical details≤4096, jsonPointer≤1024 UTF-8. Oversized pointers stop at the longest complete-segment safe ancestor and set details.pointerTruncated=true. Never include raw data/source. Traverse declared envelope order, canonical identity collections and authored arrays. Priority: raw size→input/schema→retry→CAS→scope/operations→final references→limits/history. Retry diagnostics describe current head; original receipt remains unchanged.

## Acceptance boundary and risks

This package does not complete V003, editor acceptance or legacy migration. Preserve complete R008/V006: import → independent new editable project → equivalent gameplay → continued visual/code/AI editing → real target publication and update.

Review risks: restore/no-reuse distinctions, checkpoint loss of dedup authority, integer token rounding, custom key ordering, Proxy/OOM limits, portable-path assumptions, reconstruction CPU/peak memory and nonauthenticated journal modification. Replay accounting below is the accepted protocol rule; it does not establish a RAM or performance target.

## Authoritative identity, cost and error rules

Active entity/file IDs are unique within their respective namespaces; each retired set is unique and disjoint from corresponding active IDs. Roots resolve to existing entities. Scope/root/slot uniqueness is checked explicitly. expectedKind has kind constraints (1…128 UTF-8 bytes, no controls); baseRevision/targetRevision share revision safe-integer rules.

nodeCount charges 1 per scalar/container plus 1 per object own key, without separate array-index charges. Baseline index=0, commands start at1; targetIndex=targetRevision-baseline.revision.

- P[0]=nodeCount(baseline).
- P[j]=P[j-1]+nodeCount(command[j])+nodeCount(snapshot[j])+(restore ? P[targetIndex] : 0).
- Saturate safely at maxReplayWorkUnits+1; fresh admission checks projected P[j], known retry adds nothing. This conservative protocol may reject short journals that an optimized implementation executes cheaply.

createProjectStore checks all local baseline limits, canonical empty-history-envelope bytes and P[0] before returning. Each commit checks complete projected history bytes and P[j]. Every successful create/commit/export, including empty journals, must reopen under identical limits. P is a small derived array, never persisted authority; compute admission in one iterative prefix pass, never a recursive cost oracle. Actual reconstruction uses explicit-stack/iterative expansion; memoization does not change P. No former-kind/role tombstone metadata is needed.

| Condition | Normative code |
|---|---|
| malformed ID | PROJECT_ID_INVALID |
| duplicate active/retired/root/slot/scope | PROJECT_ID_DUPLICATE (details.reason identifies collection) |
| active-retired overlap, put retired, kind/role change | PROJECT_ID_REUSED |
| valid changed known transaction | PROJECT_TRANSACTION_ID_REUSED |
| wrong project, absent remove, invalid limits | PROJECT_INPUT_INVALID |
| missing root/reference target | PROJECT_REFERENCE_MISSING |
| expected kind/role mismatch | PROJECT_REFERENCE_TYPE_MISMATCH |
| CAS mismatch | PROJECT_REVISION_CONFLICT |
| out-of-scope / duplicate operation target | PROJECT_SCOPE_VIOLATION / PROJECT_OPERATION_DUPLICATE |
| restore outside retained range | PROJECT_RESTORE_UNAVAILABLE |
| numeric/byte/count/work excess | PROJECT_LIMIT_EXCEEDED |

Open preserves direct codes for raw syntax/size and unsupported history/project/protocol versions (PROJECT_FORMAT_UNSUPPORTED). Baseline/entry schema, semantic, lifecycle or admission failure returns PROJECT_HISTORY_INVALID with safe details={causeCode,index}, baseline index=0; no partial store escapes. Malformed integer syntax→PROJECT_INPUT_INVALID; noninteger/negative-zero/unsafe numeric value→PROJECT_LIMIT_EXCEEDED. Schema field types, Unicode and unknown fields→PROJECT_INPUT_INVALID; unknown fixed version→PROJECT_FORMAT_UNSUPPORTED. Path lexical/collision errors→PROJECT_PATH_INVALID/PROJECT_PATH_COLLISION.
## Appendix: complete candidate public signatures
```ts
declare const projectIdBrand: unique symbol;
declare const entityIdBrand: unique symbol;
declare const fileIdBrand: unique symbol;
declare const transactionIdBrand: unique symbol;

export type ProjectId = string & { readonly [projectIdBrand]: true };
export type EntityId = string & { readonly [entityIdBrand]: true };
export type FileId = string & { readonly [fileIdBrand]: true };
export type TransactionId = string & { readonly [transactionIdBrand]: true };
export type ProjectRevision = number;
export type Sha256 = string;
export type JsonValue = null | boolean | number | string
  | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

export interface ProjectVersionPins {
  readonly engineVersion: string;
  readonly resourceFormatVersion: string;
  readonly toolProtocolVersion: "1.0";
}

export type ProjectReference =
  | { readonly slot: string; readonly target: "entity";
      readonly id: EntityId; readonly expectedKind: string }
  | { readonly slot: string; readonly target: "file";
      readonly id: FileId; readonly expectedRole: ProjectFileRole };

export interface ProjectEntity {
  readonly id: EntityId;
  readonly kind: string;
  readonly dataSchemaVersion: string;
  readonly name: string;
  readonly data: JsonObject;
  readonly references: readonly ProjectReference[];
}

export type ProjectFileRole =
  "source" | "asset" | "configuration" | "legacy-original" | "other";

export interface ProjectFile {
  readonly id: FileId;
  readonly path: string;
  readonly role: ProjectFileRole;
  readonly mediaType: string;
  readonly sha256: Sha256;
  readonly byteLength: number;
}

export interface ProjectSnapshot {
  readonly projectSchemaVersion: "1.0";
  readonly projectId: ProjectId;
  readonly revision: ProjectRevision;
  readonly name: string;
  readonly versions: ProjectVersionPins;
  readonly roots: readonly EntityId[];
  readonly entities: readonly ProjectEntity[];
  readonly files: readonly ProjectFile[];
  readonly retiredEntityIds: readonly EntityId[];
  readonly retiredFileIds: readonly FileId[];
}

export interface ProjectTransactionSource {
  readonly actorId: string;
  readonly actorKind: "creator" | "agent" | "legacy-converter" | "tool";
  readonly toolId: string;
  readonly toolVersion: string;
  readonly intent: string;
}

export interface ProjectTransactionScope {
  readonly entityIds: readonly EntityId[];
  readonly fileIds: readonly FileId[];
  readonly metadata: boolean;
  readonly roots: boolean;
}

export type ProjectOperation =
  | { readonly op: "putEntity"; readonly entity: ProjectEntity }
  | { readonly op: "removeEntity"; readonly id: EntityId }
  | { readonly op: "putFile"; readonly file: ProjectFile }
  | { readonly op: "removeFile"; readonly id: FileId }
  | { readonly op: "setMetadata"; readonly name: string;
      readonly versions: ProjectVersionPins }
  | { readonly op: "setRoots"; readonly roots: readonly EntityId[] };

export interface ProjectEditTransaction {
  readonly command: "edit";
  readonly toolProtocolVersion: "1.0";
  readonly projectId: ProjectId;
  readonly transactionId: TransactionId;
  readonly baseRevision: ProjectRevision;
  readonly source: ProjectTransactionSource;
  readonly scope: ProjectTransactionScope;
  readonly operations: readonly ProjectOperation[];
}

export interface ProjectRestoreTransaction {
  readonly command: "restore";
  readonly toolProtocolVersion: "1.0";
  readonly projectId: ProjectId;
  readonly transactionId: TransactionId;
  readonly baseRevision: ProjectRevision;
  readonly source: ProjectTransactionSource;
  readonly targetRevision: ProjectRevision;
}

export type ProjectTransaction = ProjectEditTransaction | ProjectRestoreTransaction;

export interface ProjectDiff {
  readonly addedEntityIds: readonly EntityId[];
  readonly changedEntityIds: readonly EntityId[];
  readonly removedEntityIds: readonly EntityId[];
  readonly addedFileIds: readonly FileId[];
  readonly changedFileIds: readonly FileId[];
  readonly removedFileIds: readonly FileId[];
  readonly metadataChanged: boolean;
  readonly rootsChanged: boolean;
}

export type ProjectDiagnosticCode =
  | "PROJECT_INPUT_INVALID" | "PROJECT_FORMAT_UNSUPPORTED"
  | "PROJECT_LIMIT_EXCEEDED" | "PROJECT_ID_INVALID"
  | "PROJECT_ID_DUPLICATE" | "PROJECT_ID_REUSED"
  | "PROJECT_REFERENCE_MISSING" | "PROJECT_REFERENCE_TYPE_MISMATCH"
  | "PROJECT_PATH_INVALID" | "PROJECT_PATH_COLLISION"
  | "PROJECT_SCOPE_VIOLATION" | "PROJECT_OPERATION_DUPLICATE"
  | "PROJECT_REVISION_CONFLICT" | "PROJECT_TRANSACTION_ID_REUSED"
  | "PROJECT_RESTORE_UNAVAILABLE" | "PROJECT_HISTORY_INVALID"
  | "PROJECT_KIND_UNCHECKED" | "PROJECT_CONTENT_UNVERIFIED";

export interface ProjectDiagnostic {
  readonly code: ProjectDiagnosticCode;
  readonly phase: "parse" | "schema" | "references" | "transaction" | "history";
  readonly severity: "error" | "warning";
  readonly projectId?: ProjectId;
  readonly revision?: ProjectRevision;
  readonly entityId?: EntityId;
  readonly fileId?: FileId;
  readonly transactionId?: TransactionId;
  readonly jsonPointer: string;
  readonly operationIndex?: number;
  readonly message: string;
  readonly details: JsonObject;
}

export type ProjectValueResult<T> =
  | { readonly ok: true; readonly value: T;
      readonly diagnostics: readonly ProjectDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly ProjectDiagnostic[] };

export interface ProjectTransactionReceipt {
  readonly transactionId: TransactionId;
  readonly beforeRevision: ProjectRevision;
  readonly afterRevision: ProjectRevision;
  readonly source: ProjectTransactionSource;
  readonly diff: ProjectDiff;
}

export type ProjectCommitResult =
  | { readonly status: "committed" | "replayed";
      readonly snapshot: ProjectSnapshot;
      readonly receipt: ProjectTransactionReceipt;
      readonly diagnostics: readonly ProjectDiagnostic[] }
  | { readonly status: "rejected";
      readonly snapshot: ProjectSnapshot;
      readonly diagnostics: readonly ProjectDiagnostic[] };

// The baseline and commands are the persisted authority. Head/receipts are
// rebuilt on open, avoiding two independently editable copies of the truth.
export interface ProjectHistory {
  readonly historySchemaVersion: "1.0";
  readonly baseline: ProjectSnapshot;
  readonly transactions: readonly ProjectTransaction[];
}

export interface ProjectLimits {
  readonly maxSnapshotUtf8Bytes: number;
  readonly maxHistoryUtf8Bytes: number;
  readonly maxTransactionUtf8Bytes: number;
  readonly maxJsonDepth: number;
  readonly maxStringUtf8Bytes: number;
  readonly maxEntities: number;
  readonly maxFiles: number;
  readonly maxReferencesPerEntity: number;
  readonly maxOperationsPerTransaction: number;
  readonly maxTransactions: number;
  readonly maxReplayWorkUnits: number;
}

export interface ProjectStore {
  readonly limits: ProjectLimits;
  readonly earliestRevision: ProjectRevision;
  getSnapshot(): ProjectSnapshot;
  commit(transaction: ProjectTransaction): ProjectCommitResult;
  exportHistory(): ProjectValueResult<string>;
}

export const DEFAULT_PROJECT_LIMITS: ProjectLimits;
export function parseProjectSnapshot(
  text: string, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectSnapshot>;
export function serializeProjectSnapshot(
  snapshot: ProjectSnapshot, limits?: Partial<ProjectLimits>
): ProjectValueResult<string>;
export function parseProjectTransaction(
  text: string, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectTransaction>;
export function createProjectStore(
  baseline: ProjectSnapshot, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectStore>;
export function openProjectHistory(
  text: string, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectStore>;
```





## Selected invalid input ordering

Closed ordinary objects reject unknown own fields at that selected object's pointer before declared children; open data dictionaries retain valid arbitrary JSON. Union common prefixes precede branch-dependent closure/discriminator failure. For record identity schedules, own string IDs sort directly by UTF-16 even when malformed; equal keys keep authored index ties, then missing/non-string/non-object candidates keep authored order. Retired/scope sets use the same schedule, while roots/references/operations retain authored order. Diagnostics and exact numeric-token lookup always keep original input indices and escaped embedded prefixes.

After selected shape/scalar checks, collection integrity follows generated snapshot declaration order: roots uniqueness, entity ID uniqueness before slots, file ID uniqueness before paths, each retired set duplicates before active overlap, then final references and counts. History interleaves generated nodes with baseline and immediate sequential command admission; an earlier wrong CAS beats a later unsupported protocol. Fixed-wrapper classification never grants schema acceptance or prechecks later header fields. Integer nonintegral/negative-zero/unsafe values yield LIMIT_EXCEEDED; general data nonfinite values yield INPUT_INVALID at the selected node. Live Number inputs cannot recover pre-rounding provenance.
