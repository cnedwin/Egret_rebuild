// SPDX-License-Identifier: Apache-2.0
/**
 * Requirements describe the whole game, including scripts loaded later and channel SDKs.
 * Both pinned arm64 VMs include WebAssembly; only standard includes Intl and ICU.
 */
export function selectV8Profile(requested, requirements = []) {
  if (!Array.isArray(requirements) || requirements.some(feature => feature !== 'Intl' && feature !== 'WebAssembly') ||
      new Set(requirements).size !== requirements.length) {
    throw new Error('requiredV8Features must be a unique list of Intl and/or WebAssembly');
  }
  const profile = requested ?? (requirements.includes('Intl') ? 'standard' : 'trimmed');
  if (!['webview', 'standard', 'trimmed'].includes(profile)) throw new Error('Unknown Android script host: ' + profile);
  if (profile === 'webview' && requirements.length) throw new Error('requiredV8Features requires an embedded V8 host');
  if (profile === 'trimmed' && requirements.includes('Intl')) throw new Error('Intl requires the standard embedded V8 host');
  return profile;
}
