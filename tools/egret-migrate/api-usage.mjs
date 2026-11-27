// SPDX-License-Identifier: Apache-2.0
const roots = new Set(['egret', 'eui', 'RES', 'dragonBones']);

/** Inventory emitted property expressions. Type-only references have disappeared at this point. */
export function collectLegacyUses(ts, entries, code, file, definitions) {
  const syntax = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const kind = ts.SyntaxKind;
  const access = node =>
    node && (node.kind === kind.PropertyAccessExpression || node.kind === kind.ElementAccessExpression);
  function visit(node) {
    if (access(node) && !(access(node.parent) && node.parent.expression === node)) {
      const parts = [];
      let cursor = node;
      while (access(cursor)) {
        if (cursor.kind === kind.PropertyAccessExpression) parts.push(cursor.name.text);
        else parts.push(cursor.argumentExpression?.kind === kind.StringLiteral ? cursor.argumentExpression.text : null);
        cursor = cursor.expression;
      }
      if (cursor.kind === kind.Identifier && roots.has(cursor.text)) {
        parts.reverse();
        const firstDynamic = parts.indexOf(null);
        const members = firstDynamic < 0 ? parts : parts.slice(0, firstDynamic);
        const dynamic = firstDynamic >= 0;
        const key = JSON.stringify([cursor.text, members, dynamic]);
        let entry = entries.get(key);
        if (!entry) {
          entry = { namespace: cursor.text, members, dynamic, uses: 0, examples: [] };
          entries.set(key, entry);
        }
        entry.uses++;
        const assignment = node.parent;
        if (
          definitions &&
          !dynamic &&
          members.length === 1 &&
          assignment.kind === kind.BinaryExpression &&
          assignment.left === node &&
          assignment.operatorToken.kind === kind.EqualsToken &&
          (assignment.right.kind === kind.FunctionExpression || assignment.right.kind === kind.ArrowFunction)
        ) {
          const pos = syntax.getLineAndCharacterOfPosition(node.getStart(syntax));
          definitions.push({
            namespace: cursor.text,
            name: members[0],
            file,
            line: pos.line + 1,
            column: pos.character + 1
          });
        }
        if (entry.examples.length < 3) {
          const pos = syntax.getLineAndCharacterOfPosition(node.getStart(syntax));
          entry.examples.push({ file, line: pos.line + 1, column: pos.character + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
}
