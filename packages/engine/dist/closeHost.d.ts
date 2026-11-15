import type { DiagnosticHandler, HostAdapter } from "@egret/contracts";
/** Deadline rejects the caller; it never cancels or destroys borrowed host work. */
export declare function closeHost(host: HostAdapter, timeoutMs: number, releaseSurface: () => void, errors: unknown[], onDiagnostic: DiagnosticHandler | undefined): Promise<void>;
//# sourceMappingURL=closeHost.d.ts.map