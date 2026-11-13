// SPDX-License-Identifier: Apache-2.0
// Align native scope timings with system samples before attributing driver work.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const driverScopes = new Map([
  ['JY.ANGLE.DriverEGLCreateSyncKHR', 'TraceEGLAPI::eglCreateSyncKHR'],
  ['JY.ANGLE.DriverGLFlush', 'TraceGLAPI::glFlush'],
]);

function rows(csv) {
  const lines = csv.trimEnd().split(/\r?\n/);
  const fields = line => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)]
    .map(([, quoted, bare]) => quoted === undefined ? bare : quoted.replaceAll('""', '"'));
  const keys = fields(lines.shift());
  return lines.map(line => Object.fromEntries(fields(line).map((value, i) =>
    [keys[i], value === '[NULL]' ? null : value])));
}

function query(binary, trace, sql) {
  return rows(execFileSync(binary, ['query', trace, sql], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true,
  }));
}

function align(chrome, sql) {
  const clocks = sql(`
    SELECT DISTINCT b.clock_value - m.clock_value AS offset_ns
    FROM clock_snapshot b JOIN clock_snapshot m USING (snapshot_id)
    WHERE b.clock_id=6 AND m.clock_id=3
  `).map(row => Number(row.offset_ns));
  const marks = sql(`
    SELECT name, ts FROM slice WHERE name GLOB 'egret-jy133-clock-*'
    UNION
    SELECT trim(EXTRACT_ARG(arg_set_id, 'buf')), ts FROM ftrace_event
    WHERE name='print' AND EXTRACT_ARG(arg_set_id, 'buf') GLOB '*egret-jy133-clock-*'
  `);
  const pairs = (chrome.brackets ?? []).flatMap(pair => {
    const before = chrome.clockMarkers?.find(mark => mark.name === pair.before);
    const after = chrome.clockMarkers?.find(mark => mark.name === pair.after);
    if (!pair.kernelMarker || !before || !after || before.pid !== after.pid ||
        before.tid !== after.tid || after.ts < before.ts) return [];
    if (Number.isFinite(pair.low) && (before.ts < pair.low * 1e6 - 100 ||
        after.ts > pair.high * 1e6 + 100)) return [];
    // A kernel marker occurs between the two browser markers. A loose
    // snapshot match selects the marker, then the exact interval is retained.
    const candidates = marks.filter(row => row.name === pair.tag ||
      row.name?.split('|').includes(pair.tag)).map(row => Number(row.ts));
    const matching = candidates.filter(ts => clocks.some(offset =>
      ts >= before.ts * 1000 + offset - 200_000 && ts <= after.ts * 1000 + offset + 200_000));
    if (matching.length !== 1) return [];
    return [{ tag: pair.tag, beforeUs: before.ts, afterUs: after.ts, systemNs: matching[0],
      offsetMinNs: matching[0] - after.ts * 1000 - 1000,
      offsetMaxNs: matching[0] - before.ts * 1000 + 1000 }];
  });
  const start = pairs.filter(pair => /-start(?:-\d+)?$/.test(pair.tag));
  const end = pairs.filter(pair => /-end(?:-\d+)?$/.test(pair.tag));
  const min = pairs.length ? Math.max(...pairs.map(pair => pair.offsetMinNs)) : null;
  const max = pairs.length ? Math.min(...pairs.map(pair => pair.offsetMaxNs)) : null;
  const clock = sql("SELECT int_value FROM metadata WHERE name='trace_time_clock_id'")[0]?.int_value;
  const verified = chrome.clockDomain === 'LINUX_CLOCK_MONOTONIC' && Number(clock) === 6 &&
    clocks.length > 0 && clocks.every(offset => offset >= min && offset <= max) &&
    start.length > 0 && end.length > 0 && min <= max;
  return { verified, chromeClock: chrome.clockDomain ?? null, systemClock: clock ?? null,
    snapshotOffsetsNs: clocks, offsetMinNs: min, offsetMaxNs: max, pairs,
    captureStartUs: verified ? Math.max(...start.map(pair => pair.afterUs)) : null,
    captureEndUs: verified ? Math.min(...end.map(pair => pair.beforeUs)) : null,
    reason: verified ? null : 'Independent BOOTTIME/MONOTONIC start/end bracket match unavailable' };
}

function contains(outer, inner) {
  return outer.pid === inner.pid && outer.tid === inner.tid &&
    outer.ts <= inner.ts && outer.ts + outer.dur >= inner.ts + inner.dur;
}

function nativeAttribution(events, scope) {
  const sameThread = events.filter(event => event.pid === scope.wrapper.pid && event.tid === scope.wrapper.tid);
  const batches = sameThread.filter(event => event.ph === 'X' &&
    event.name === 'CommandBufferService:PutChanged' && contains(event, scope.wrapper));
  const batch = batches.length === 1 ? batches[0] : null;
  const flushes = sameThread.filter(event => event.name === 'kFlush').toSorted((a, b) => a.ts - b.ts);
  const active = new Map();
  const enclosing = [];
  for (const event of flushes) {
    if (event.ph === 'X' && contains(event, scope.wrapper)) enclosing.push(event);
    const id = event.id2?.local ?? event.id2?.global ?? event.id;
    if (id === undefined) continue;
    if (event.ph === 'b') active.set(id, event);
    if (event.ph === 'e' && active.has(id)) {
      const begin = active.get(id);
      active.delete(id);
      const flush = { ...begin, dur: event.ts - begin.ts };
      if (contains(flush, scope.wrapper)) enclosing.push(flush);
    }
  }
  const flush = enclosing.length === 1 ? enclosing[0] : null;
  return {
    path: scope.wrapper.name === driverScopes.get('JY.ANGLE.DriverEGLCreateSyncKHR') ? 'egl-create-sync' :
      scope.wrapper.name === driverScopes.get('JY.ANGLE.DriverGLFlush') ?
        flush ? 'native-gl-in-kFlush' : 'native-gl-kFlush-unverified' : 'legacy-validation-only',
    commandBatch: batch ? { handler: batch.args?.handler ?? null,
      putOffset: batch.args?.put_offset ?? null, tsUs: batch.ts, wallUs: batch.dur } : null,
    kFlush: flush ? { tsUs: flush.ts, wallUs: flush.dur,
      afterGlUs: flush.ts + flush.dur - scope.wrapper.ts - scope.wrapper.dur } : null,
  };
}

function bounds(lane, clock) {
  const lo = lane.span.ts * 1000;
  const hi = (lane.span.ts + lane.span.dur) * 1000;
  return {
    lo: lo + clock.offsetMinNs, hi: hi + clock.offsetMaxNs,
    interiorLo: lo + clock.offsetMaxNs, interiorHi: hi + clock.offsetMinNs,
    reference: lo + clock.snapshotOffsetsNs[0], referenceEnd: hi + clock.snapshotOffsetsNs[0],
  };
}

function sampleEvidence(lanes, clock, sql) {
  if (lanes.length === 0) return [];
  const values = lanes.map(({ span }, i) => {
    const window = bounds(lanes[i], clock);
    const ints = [i, span.pid, span.tid, window.lo, window.hi,
      window.interiorLo, window.interiorHi, window.reference, window.referenceEnd];
    assert(ints.every(Number.isSafeInteger), 'Chrome scope contains non-integral or unsafe timestamp/identity');
    return '(' + ints.join(',') + ')';
  }).join(',');
  const selected = `
    WITH RECURSIVE selected(lane,pid,tid,lo,hi,core_lo,core_hi,reference,reference_hi) AS (VALUES ${values}),
    targets AS (
      SELECT w.*,t.utid FROM selected w JOIN thread t ON t.tid=w.tid AND t.name='CrGpuMain'
      JOIN process p ON p.upid=t.upid AND p.pid=w.pid
      WHERE COALESCE(t.start_ts,w.lo)<=w.lo AND COALESCE(t.end_ts,w.hi)>=w.hi
    )`;
  const samples = sql(selected + `,
    observed AS (
      SELECT w.lane,'linux.perf' AS source,s.id,s.ts,s.callsite_id,s.cpu,s.cpu_mode,s.unwind_error,
             s.ts-w.reference AS offset_ns,s.ts>=w.core_lo AND s.ts<w.core_hi AS inside,
             s.ts>=w.reference AND s.ts<w.reference_hi AS at_snapshot
      FROM targets w JOIN perf_sample s USING (utid) WHERE s.ts>=w.lo AND s.ts<w.hi
      UNION ALL
      SELECT w.lane,'chrome.in-process',s.id,s.ts,s.callsite_id,NULL,NULL,NULL,
             s.ts-w.reference,s.ts>=w.core_lo AND s.ts<w.core_hi,s.ts>=w.reference AND s.ts<w.reference_hi
      FROM targets w JOIN cpu_profile_stack_sample s USING (utid) WHERE s.ts>=w.lo AND s.ts<w.hi
    ), frames(lane,source,id,callsite,depth) AS (
      SELECT lane,source,id,callsite_id,0 FROM observed WHERE callsite_id IS NOT NULL
      UNION ALL
      SELECT f.lane,f.source,f.id,c.parent_id,f.depth+1 FROM frames f
      JOIN stack_profile_callsite c ON c.id=f.callsite WHERE c.parent_id IS NOT NULL AND f.depth<127
    )
    SELECT o.*,f.depth,COALESCE(NULLIF(sf.deobfuscated_name,''),sf.name) AS symbol,
      sm.name AS mapping,sm.build_id,CASE WHEN sf.rel_pc IS NULL THEN NULL ELSE printf('0x%x',sf.rel_pc) END AS rel_pc
    FROM observed o LEFT JOIN frames f USING (lane,source,id)
    LEFT JOIN stack_profile_callsite c ON c.id=f.callsite
    LEFT JOIN stack_profile_frame sf ON sf.id=c.frame_id
    LEFT JOIN stack_profile_mapping sm ON sm.id=sf.mapping
    ORDER BY o.lane,o.ts,o.source,o.id,f.depth
  `);
  const states = sql(selected + `
    SELECT w.lane,s.state,s.cpu,s.io_wait,s.blocked_function,
      MAX(s.ts,w.lo)-w.reference AS from_ns,MIN(s.ts+s.dur,w.hi)-w.reference AS to_ns,
      MAX(0,MIN(s.ts+s.dur,w.core_hi)-MAX(s.ts,w.core_lo)) AS interior_ns,
      MAX(0,MIN(s.ts+s.dur,w.reference_hi)-MAX(s.ts,w.reference)) AS snapshot_ns
    FROM targets w JOIN thread_state s USING (utid)
    WHERE s.dur>0 AND s.ts<w.hi AND s.ts+s.dur>w.lo ORDER BY w.lane,s.ts
  `);
  const locks = sql(selected + `
    SELECT w.lane,e.name,e.ts-w.reference AS offset_ns,
      e.ts>=w.core_lo AND e.ts<w.core_hi AS inside,
      a.key,a.display_value AS value
    FROM targets w JOIN ftrace_event e USING (utid) JOIN args a USING (arg_set_id)
    WHERE e.ts>=w.lo AND e.ts<w.hi AND e.name LIKE '%futex%'
      AND (a.key GLOB '*uaddr' OR a.key GLOB '*uaddr[12]')
    ORDER BY w.lane,e.ts,a.key
  `);
  return lanes.map((lane, i) => {
    const grouped = new Map();
    for (const row of samples.filter(row => Number(row.lane) === i)) {
      const key = row.source + ':' + row.id;
      if (!grouped.has(key)) grouped.set(key, { source: row.source, offsetNs: Number(row.offset_ns),
        inside: row.inside === '1', atSnapshot: row.at_snapshot === '1',
        cpu: row.cpu, cpuMode: row.cpu_mode, unwindError: row.unwind_error, frames: [] });
      if (row.depth !== null) grouped.get(key).frames.push({ depthFromLeaf: Number(row.depth), symbol: row.symbol,
        mapping: row.mapping, buildId: row.build_id, relativePc: row.rel_pc });
    }
    const observations = [...grouped.values()];
    const interior = observations.filter(sample => sample.inside);
    const withStack = interior.filter(sample => sample.frames.some(frame => frame.relativePc !== null));
    const vendorFrames = observations.filter(sample => sample.inside || sample.atSnapshot)
      .flatMap(sample => sample.frames.filter(frame =>
        frame.relativePc && frame.mapping && /(?:\/vendor\/|\/odm\/|adreno|qualcomm|\/apex\/com\.qti)/i.test(frame.mapping))
        .map(frame => ({ offsetNs: sample.offsetNs, source: sample.source,
          bracketGuaranteed: sample.inside, ...frame })));
    const threadStates = states.filter(row => Number(row.lane) === i).map(row => ({
      state: row.state, fromNs: Number(row.from_ns), toNs: Number(row.to_ns),
      guaranteedInteriorNs: Number(row.interior_ns), snapshotNs: Number(row.snapshot_ns),
      cpu: row.cpu, ioWait: row.io_wait,
      blockedFunction: row.blocked_function,
    }));
    const interiorCpuNs = threadStates.filter(row => row.state === 'Running')
      .reduce((sum, row) => sum + row.guaranteedInteriorNs, 0);
    const interiorOffCpuNs = threadStates.filter(row => row.state && row.state !== 'Running')
      .reduce((sum, row) => sum + row.guaranteedInteriorNs, 0);
    const snapshotCpuNs = threadStates.filter(row => row.state === 'Running')
      .reduce((sum, row) => sum + row.snapshotNs, 0);
    const snapshotOffCpuNs = threadStates.filter(row => row.state && row.state !== 'Running')
      .reduce((sum, row) => sum + row.snapshotNs, 0);
    const snapshotCoverageNs = snapshotCpuNs + snapshotOffCpuNs;
    const interiorCoverageNs = interiorCpuNs + interiorOffCpuNs;
    const addresses = locks.filter(row => Number(row.lane) === i && row.inside === '1' && row.value);
    return { ...lane, systemBoundsNs: bounds(lane, clock), observations, vendorFrames, threadStates,
      interiorSamples: interior.length, interiorSamplesWithFrames: withStack.length, interiorCoverageNs,
      interiorCpuNs: interiorCoverageNs ? interiorCpuNs : null,
      interiorOffCpuNs: interiorCoverageNs ? interiorOffCpuNs : null,
      snapshotSamples: observations.filter(sample => sample.atSnapshot).length,
      snapshotCoverageNs, snapshotCpuNs: snapshotCoverageNs ? snapshotCpuNs : null,
      snapshotOffCpuNs: snapshotCoverageNs ? snapshotOffCpuNs : null,
      lockAddressStatus: addresses.length ? 'Observed futex address argument only; lock owner and cause unverified' :
        'No captured futex address inside the guaranteed interval; lock identity and owner unknown',
      addresses,
      evidence: vendorFrames.some(frame => frame.bracketGuaranteed) ?
        'Bracket-guaranteed vendor frames; resolve symbols using matching module Build IDs' :
        vendorFrames.length ? 'Vendor frames are inside at the clock snapshot only; bracket bounds do not guarantee membership' :
          withStack.length ? 'Bracket-guaranteed native frames observed; no vendor module identified' :
            'No bracket-guaranteed native frames',
    };
  });
}

async function main() {
  const [directory, processor, runList, ...flags] = process.argv.slice(2);
  assert(directory && processor, 'Usage: node analyze-angle-stacks.mjs <capture-dir> <trace_processor> [1,2] [--output=/path/analysis.json] [--legacy-validation]');
  assert(flags.every(flag => flag === '--legacy-validation' || flag.startsWith('--output=')), 'Unknown analyzer option');
  const files = new Set(await readdir(directory));
  const runs = runList ? runList.split(',').map(Number) :
    [...files].flatMap(file => file.match(/^chrome-trace-(\d+)\.json$/)?.slice(1).map(Number) ?? []).toSorted((a, b) => a - b);
  assert(runs.length > 0 && runs.every(run => Number.isSafeInteger(run) && run > 0), 'Expected positive capture run numbers');
  const results = [];
  for (const run of runs) {
    const summary = JSON.parse(await readFile(path.join(directory, `chrome-trace-${run}.json`), 'utf8'));
    const rawName = `chrome-raw-${run}.json.gz`;
    const raw = files.has(rawName) ? JSON.parse(gunzipSync(await readFile(path.join(directory, rawName)),
      { maxOutputLength: 256 * 1024 * 1024 })).traceEvents : [];
    const scopes = [...driverScopes].flatMap(([name, wrapper]) => (summary.angle?.[name]?.longest ?? [])
      .filter(scope => scope.webgl && scope.span.name === name && scope.wrapper.name === wrapper &&
        contains(scope.wrapper, scope.span) && contains(scope.webgl, scope.wrapper)).slice(0, 3));
    if (scopes.length === 0 && flags.includes('--legacy-validation')) {
      const legacy = summary.windows?.flatMap(window => window.events)
        .filter(event => event.name === 'RasterDecoderImpl::DoEndRasterCHROMIUM')
        .toSorted((a, b) => b.dur - a.dur)[0];
      if (legacy) scopes.push({ span: legacy, wrapper: legacy, webgl: null });
    }
    const lanes = scopes.flatMap(scope => {
      const attribution = nativeAttribution(raw, scope);
      return [{ label: 'wrapper', ...scope, span: scope.wrapper, attribution },
        ...(scope.span === scope.wrapper ? [] : [{ label: 'driver', ...scope, attribution }])];
    });
    const file = [`system-sched-boottime-${run}.pftrace`, `system-sched-${run}.pftrace`].find(name => files.has(name));
    const sql = file ? statement => query(processor, path.join(directory, file), statement) : null;
    const integrity = sql ? sql("SELECT name,value FROM stats WHERE severity IN ('error','data_loss') AND value>0") : [];
    const clock = sql ? align(summary, sql) : { verified: false, reason: 'Matching system trace unavailable' };
    const trusted = clock.verified && summary.dataLossOccurred === false;
    const accepted = trusted ? lanes.filter(({ span }) =>
      span.ts >= clock.captureStartUs && span.ts + span.dur <= clock.captureEndUs) : [];
    const diagnostics = sampleEvidence(accepted, clock, sql);
    results.push({ run, systemTrace: file ?? null, rawChromeTrace: files.has(rawName) ? rawName : null,
      chromeDataLoss: summary.dataLossOccurred ?? null, integrity, clock, diagnostics,
      scopeStatus: scopes.length ? 'Scoped wrapper/driver windows selected' : 'No matching diagnostic WebGL spans in summary',
      unmatchedLanes: lanes.filter(lane => !accepted.includes(lane)),
      note: 'Stack samples are discrete observations. Thread intervals include snapshot-aligned and bracket-guaranteed times. Native wall time does not measure GPU execution.',
    });
  }
  const output = flags.find(flag => flag.startsWith('--output='))?.slice('--output='.length) ??
    path.join(directory, 'angle-native-stack-analysis.json');
  await writeFile(output, JSON.stringify(results, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(results.map(result => ({ run: result.run, aligned: result.clock.verified,
    lanes: result.diagnostics.length, unmatched: result.unmatchedLanes.length, output }))));
}

export { align, bounds, nativeAttribution, rows, sampleEvidence };
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
