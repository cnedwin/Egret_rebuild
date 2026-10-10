import type { ProjectLimits, ProjectValueResult } from "./public.js";
import { inputDiagnostic } from "./diagnostics.js";

export const DEFAULT_PROJECT_LIMITS: ProjectLimits = Object.freeze({
  maxSnapshotUtf8Bytes: 16777216, maxHistoryUtf8Bytes: 67108864, maxTransactionUtf8Bytes: 4194304,
  maxJsonDepth: 32, maxStringUtf8Bytes: 65536, maxEntities: 100000, maxFiles: 50000,
  maxReferencesPerEntity: 4096, maxOperationsPerTransaction: 10000, maxTransactions: 1024,
  maxReplayWorkUnits: 10000000
});

// Read only checked own data descriptors: overrides cannot invoke getters.
// Known positive safe integers must fit fixed ceilings; the resolved copy and
// unchanged defaults are frozen before any document or store uses them.
export function resolveLimits(input?: Partial<ProjectLimits>): ProjectValueResult<ProjectLimits> {
  const invalid = (): ProjectValueResult<never> => Object.freeze({ ok: false, diagnostics: Object.freeze([inputDiagnostic("PROJECT_INPUT_INVALID", "", "Limit overrides must be known positive bounded safe integers.")]) });
  if (input === undefined) return Object.freeze({ ok: true, value: DEFAULT_PROJECT_LIMITS, diagnostics: Object.freeze([]) });
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return invalid();
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return invalid();
    const result = { ...DEFAULT_PROJECT_LIMITS };
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== "string" || !Object.hasOwn(DEFAULT_PROJECT_LIMITS, key)) return invalid();
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return invalid();
      const limit = key as keyof ProjectLimits;
      const value: unknown = descriptor.value;
      const ceiling = limit === "maxJsonDepth" ? 64 : DEFAULT_PROJECT_LIMITS[limit] * 16;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > ceiling) return invalid();
      result[limit] = value;
    }
    return Object.freeze({ ok: true, value: Object.freeze(result), diagnostics: Object.freeze([]) });
  } catch { return invalid(); }
}
