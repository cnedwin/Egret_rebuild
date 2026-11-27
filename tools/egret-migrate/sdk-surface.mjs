// SPDX-License-Identifier: Apache-2.0
import path from 'node:path';

const roots = new Set(['egret', 'eui', 'RES', 'dragonBones']);

/** Describe the SDK declarations actually loaded by this compiler, including hidden and erased entries. */
export function collectSdkSurface(ts, program, projectRoot) {
  const k = ts.SyntaxKind;
  const sources = [],
    records = new Map(),
    constructors = new Set(),
    interfaces = [];
  function typePath(node) {
    if (!node) return undefined;
    if (node.kind === k.Identifier) return node.text;
    if (node.kind === k.QualifiedName) return typePath(node.left) + '.' + typePath(node.right);
    return undefined;
  }
  for (const syntax of program.getSourceFiles()) {
    const file = path.relative(projectRoot, path.resolve(syntax.fileName)).split(path.sep).join('/');
    if (!syntax.isDeclarationFile || !/^libs\/modules\/[^/]+\/[^/]+\.d\.ts$/i.test(file)) continue;
    sources.push(file);
    function privacy(node, name, inherited) {
      if (inherited !== 'public') return inherited;
      if (node.modifiers?.some(v => v.kind === k.PrivateKeyword)) return 'private';
      if (node.modifiers?.some(v => v.kind === k.ProtectedKeyword)) return 'protected';
      const tags = syntax.text.slice(node.pos, node.getStart(syntax));
      if (/@(?:private|internal)\b/.test(tags)) return 'internal';
      if (/^(?:egret|eui)\.sys(?:\.|$)/.test(name) || name.split('.').some(part => part.startsWith('$')))
        return 'internal';
      return 'public';
    }
    function note(node, name, kind, placement, visibility) {
      const key = JSON.stringify([name, placement, kind, visibility]);
      if (!records.has(key))
        records.set(key, {
          name,
          kind,
          placement,
          visibility,
          source: file,
          line: syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1
        });
    }
    function walk(node, owner = '', visibility = 'public') {
      const leaf = node.name?.text;
      const name = owner ? owner + '.' + leaf : leaf;
      if (node.kind === k.ModuleDeclaration && typeof leaf === 'string') {
        // A quoted external module is available by import, not on the classic global object.
        if (node.name.kind === k.StringLiteral || (!owner && !roots.has(leaf))) return;
        const access = privacy(node, name, visibility);
        note(node, name, 'namespace', 'namespace', access);
        if (node.body?.kind === k.ModuleDeclaration) walk(node.body, name, access);
        else for (const item of node.body?.statements ?? []) walk(item, name, access);
        return;
      }
      if (!owner) return;
      if (node.kind === k.VariableStatement) {
        for (const decl of node.declarationList.declarations) {
          if (typeof decl.name?.text !== 'string') continue;
          const key = owner + '.' + decl.name.text,
            access = privacy(node, key, visibility);
          note(decl, key, 'variable', 'namespace', access);
          const memberList = decl.type?.members;
          if (!memberList) continue;
          // A singleton object such as OrientationMode or ExternalInterface can expose real members without being newable.
          if (
            memberList.some(
              member =>
                member.kind === k.ConstructSignature &&
                member.type?.kind === k.TypeReference &&
                [decl.name.text, key].includes(typePath(member.type.typeName))
            )
          )
            constructors.add(key);
          for (const member of memberList) {
            if (typeof member.name?.text !== 'string') continue;
            const part = key + '.' + member.name.text;
            note(
              member,
              part,
              member.kind === k.MethodSignature ? 'method' : 'property',
              'static',
              privacy(member, part, access)
            );
          }
        }
        return;
      }
      if (typeof leaf !== 'string') return;
      const access = privacy(node, name, visibility);
      if (node.kind === k.ClassDeclaration || node.kind === k.EnumDeclaration) {
        const isEnum = node.kind === k.EnumDeclaration;
        const inlineEnum = isEnum && node.modifiers?.some(x => x.kind === k.ConstKeyword);
        note(
          node,
          name,
          inlineEnum ? 'const-enum' : isEnum ? 'enum' : 'class',
          inlineEnum ? 'type' : 'namespace',
          access
        );
        for (const member of node.members) {
          if (typeof member.name?.text !== 'string') continue;
          const key = name + '.' + member.name.text;
          const placement = inlineEnum
            ? 'type'
            : isEnum || member.modifiers?.some(x => x.kind === k.StaticKeyword)
              ? 'static'
              : 'instance';
          const kind = isEnum ? 'enum-value' : member.kind === k.MethodDeclaration ? 'method' : 'property';
          note(member, key, kind, placement, privacy(member, key, access));
        }
      } else if (node.kind === k.InterfaceDeclaration || node.kind === k.TypeAliasDeclaration) {
        note(node, name, node.kind === k.InterfaceDeclaration ? 'interface' : 'type', 'type', access);
        // Some 5.x hosts declare an interface and a separate same-name constructor value.
        // Resolve after visiting every declaration so source order and namespace merging are immaterial.
        if (node.kind === k.InterfaceDeclaration)
          interfaces.push([
            name,
            () => {
              for (const member of node.members) {
                if (typeof member.name?.text !== 'string') continue;
                const key = name + '.' + member.name.text;
                note(
                  member,
                  key,
                  member.kind === k.MethodSignature ? 'method' : 'property',
                  'instance',
                  privacy(member, key, access)
                );
              }
            }
          ]);
      } else if (node.kind === k.FunctionDeclaration) note(node, name, 'function', 'namespace', access);
    }
    for (const node of syntax.statements) walk(node);
  }
  for (const [name, addMembers] of interfaces) if (constructors.has(name)) addMembers();
  return {
    schemaVersion: 1,
    sources: sources.sort(),
    entries: [...records.values()].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : a.placement.localeCompare(b.placement)
    )
  };
}
