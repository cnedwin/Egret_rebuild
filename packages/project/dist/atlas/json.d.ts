import type { CapturedInput, PlanningContext } from './input.js';
import type { AtlasSourceSpan } from './types.js';
export interface JsonProperty {
    readonly key: string;
    readonly pointer: string;
    readonly span: AtlasSourceSpan;
    node?: JsonNode;
}
export interface JsonNode {
    readonly kind: 'object' | 'array' | 'literal';
    readonly pointer: string;
    span: AtlasSourceSpan;
    readonly value?: unknown;
    readonly properties?: JsonProperty[];
    readonly elements?: JsonNode[];
}
export interface ParsedMetadata {
    readonly root: JsonNode;
    readonly utf8Bytes: number;
}
export declare function readMetadata(context: PlanningContext, input: CapturedInput['source']): ParsedMetadata;
//# sourceMappingURL=json.d.ts.map