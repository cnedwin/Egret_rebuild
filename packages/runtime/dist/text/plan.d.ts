import type { TextValueInvocation } from './request.js';
import type { TextPlanInput, TextRasterPlan, TextRasterRequest } from './types.js';
declare const issuerBrand: unique symbol;
/** Private per-measure authority. Only the captured createPlan reaches the provider. */
export interface TextRasterPlanIssuer {
    readonly [issuerBrand]: true;
    readonly createPlan: (input: TextPlanInput) => TextRasterPlan;
}
export declare function createTextRasterPlanIssuer(request: TextRasterRequest, invocation: TextValueInvocation): TextRasterPlanIssuer;
/** Close only after measure settles; closing never erases its own terminal-cleanup plan. */
export declare function closeTextRasterPlanIssuer(issuer: TextRasterPlanIssuer): void;
export declare function readIssuedTextRasterPlan(issuer: TextRasterPlanIssuer): TextRasterPlan | undefined;
/** Exact private issuer/invocation/plan identities are checked before public plan fields. */
export declare function requireIssuedTextRasterPlan(issuer: TextRasterPlanIssuer, value: unknown, invocation: TextValueInvocation): TextRasterPlan;
export {};
//# sourceMappingURL=plan.d.ts.map