// SPDX-License-Identifier: Apache-2.0
export interface LegacyUse {
  namespace: string;
  members: readonly string[];
  dynamic: boolean;
  uses: number;
  examples: readonly { file: string; line: number; column: number }[];
}
export function checkLegacyBindings(bindings: object, entries: readonly LegacyUse[]): (
  LegacyUse & { status: 'present' | 'requires-binding' | 'runtime-value' }
)[];
