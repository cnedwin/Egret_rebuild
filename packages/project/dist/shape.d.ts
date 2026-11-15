import type { JsonValue } from "@egret/contracts";
import type { ShapeNodeCheck } from "./internal.js";
import type { FormatNode } from "./format-shape.generated.js";
export declare function resolveFormatNode(node: FormatNode): FormatNode;
export declare function matchesNodeType(value: JsonValue, node: FormatNode): boolean;
export declare function inspectShapeNode(value: JsonValue | undefined, node: FormatNode, _jsonPointer: string): ShapeNodeCheck;
//# sourceMappingURL=shape.d.ts.map