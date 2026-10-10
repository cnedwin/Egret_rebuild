// Public-root dependency entry only. This private module performs no parsing policy.
export { createScanner, visit } from "jsonc-parser";
// Upstream ambient const enums are type-only under the unchanged strict NodeNext flags.
export type { JSONScanner, JSONVisitor, JSONPath, ParseOptions, ScanError, SyntaxKind, ParseErrorCode } from "jsonc-parser";
