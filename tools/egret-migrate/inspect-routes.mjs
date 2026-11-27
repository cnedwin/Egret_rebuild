// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { inspectLegacyProject, readProjectFile, refuse } from './inspect.mjs';
import { inspectHostUsage } from './host-usage.mjs';
import { inspectOriginalRoute } from './original-route.mjs';

function webRoute(report) {
  if (report.profile === 'published-js-only') return { status: 'needs-source', nextAction: 'supply-editable-project' };
  if (report.conversion?.reasons?.length) {
    const reasons = report.conversion.reasons;
    const nextAction = reasons.includes('MIGRATE_SOURCE_LIMIT')
      ? 'select-supported-gameplay-slice'
      : reasons.some(s => ['MIGRATE_SOURCE_ORDER', 'MIGRATE_SOURCE_MISSING', 'MIGRATE_UNLISTED_SOURCE'].includes(s))
        ? 'restore-authored-source-order'
        : 'resolve-listed-conversion-reasons';
    const reviewRanges = [];
    const scripts = report.inventory?.scripts;
    if (reasons.includes('MIGRATE_SOURCE_LIMIT') && !reasons.includes('MIGRATE_SOURCE_ORDER') && scripts?.sourceLimit) {
      // These are spans to inspect with the original load order intact. A boundary is not proof
      // that a script can be deferred or converted apart from the rest of the game.
      for (let start = 0; start < scripts.sourceOrder.length; start += scripts.sourceLimit) {
        const end = Math.min(start + scripts.sourceLimit, scripts.sourceOrder.length);
        reviewRanges.push({
          start,
          endExclusive: end,
          first: scripts.sourceOrder[start],
          last: scripts.sourceOrder[end - 1]
        });
      }
    }
    return { status: 'review-required', reasons, nextAction, ...(reviewRanges.length && { reviewRanges }) };
  }
  return { status: 'eligible', nextAction: 'convert-selected-profile-and-compare', profile: report.profile };
}

/** Route advice is additive. Conversion continues to use its original admission and input fingerprint. */
export function inspectRoutes(source, config = {}, options = {}) {
  source = path.resolve(source);
  if (options.compilerSha256 && !options.compiler)
    refuse('MIGRATE_ARGUMENTS', '--compiler-sha256 requires --compiler.');
  const publishedOnly =
    !config.profile &&
    !['sources', 'theme', 'resources', 'bones'].some(key => config[key] !== undefined) &&
    !fs.existsSync(path.join(source, 'egretProperties.json')) &&
    fs.existsSync(path.join(source, 'manifest.json'));
  const report = publishedOnly
    ? { schemaVersion: 1, profile: 'published-js-only' }
    : inspectLegacyProject(source, config);
  const web = webRoute(report);
  const android = inspectOriginalRoute(source, report, options);
  let sources = report.inventory?.scripts.sourceOrder ?? report.sources?.map(s => s.path) ?? [];
  let scanScope = 'authored-manifest-sources';
  if (report.inventory) sources = [...report.inventory.scripts.extraInitial, ...sources];
  if (publishedOnly && options.compiler) {
    // The original source tree is absent. Inspect the declared business scripts without scanning the engine itself.
    const manifest = JSON.parse(
      readProjectFile(source, 'manifest.json', 16 * 1024 * 1024)
        .bytes.toString('utf8')
        .replace(/^\uFEFF/, '')
    );
    if (Array.isArray(manifest.game) && android.groups) sources = manifest.game;
    scanScope = 'published-business-scripts';
  }
  const hostUsage = {
    scope: scanScope,
    ...inspectHostUsage(
      source,
      sources,
      options.compiler,
      options.compilerSha256,
      [options.published, options.prepared].filter(Boolean)
    )
  };
  if (hostUsage.findings && Object.keys(hostUsage.findings).length)
    android.reviewBeforeGameplay = Object.keys(hostUsage.findings);
  return { ...report, routes: { schemaVersion: 1, web, android, hostUsage } };
}
