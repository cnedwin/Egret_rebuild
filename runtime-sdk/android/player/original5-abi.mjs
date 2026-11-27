// SPDX-License-Identifier: Apache-2.0
/** Select the compatibility contract before running the unmodified core in its fresh isolate. */
export function original5NativeAbi(coreSource, explicit) {
  // Some published tags report the same JS engine version. Both of the known
  // early cores use ABI 4. Never infer the native contract from the game version.
  const versions = new Set([...coreSource.matchAll(/\.engineVersion\s*=\s*["'](5\.3\.\d+)["']/g)].map(match => match[1]));
  if (versions.size > 1) throw new Error('Ambiguous original core version');
  const [version] = versions;
  const known = /^5\.3\.(1|2)$/.test(version) ? 4 : /^5\.3\.(5|6|7|8|9|10)$/.test(version) ? 5 : undefined;
  const declarations = new Set([...coreSource.matchAll(/\brequiredNrABIVersion\s*=\s*(\d+)\b/g)].map(match => Number(match[1])));
  if (declarations.size > 1) throw new Error('Ambiguous native ABI in original core');
  const [declared] = declarations;
  const nativeAbi = explicit ?? declared ?? known ?? 5;
  if ((nativeAbi !== 4 && nativeAbi !== 5) || (known && nativeAbi !== known) ||
      (declared !== undefined && declared !== nativeAbi)) {
    throw new Error('Native ABI disagrees with the original engine core');
  }
  if (version && !known && declared === undefined && explicit === undefined) throw new Error('Specify nativeAbi for this unqualified 5.3.x core');
  return nativeAbi;
}
