// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';

export type CapturedSequenceMarker = Readonly<{
  id: string;
  timeSeconds: number;
  markerIndex: number;
}>;

export type SequencePosition = Readonly<{
  playIndex: number;
  positionSeconds: number;
  complete: boolean;
}>;

export type PlannedSequenceEvent = Readonly<{
  kind: 'marker';
  id: string;
  markerIndex: number;
  playIndex: number;
  timelineSeconds: number;
  positionSeconds: number;
}> | Readonly<{
  kind: 'complete';
  totalPlays: number;
  timelineSeconds: number;
}>;

export interface SequenceEventPlanOptions {
  readonly includeStart?: boolean;
  readonly includeComplete?: boolean;
}

const MAX_TIME = 2 ** 32;
const MAX_PLAYS = 1_000_000;
const MAX_MARKERS = 64;
const MAX_EVENTS = 1_024;
const EMPTY_EVENTS: readonly PlannedSequenceEvent[] = Object.freeze([]);

interface Bounds {
  readonly plays: number;
  readonly endpoint: number;
  readonly finite: boolean;
}

function boundsFor(duration: number, totalPlays: number | 'infinite'): Bounds {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_TIME) {
    throw new EgretError('ANIMATION_TIME_LIMIT');
  }
  const finite = totalPlays !== 'infinite';
  const plays = finite ? totalPlays : MAX_PLAYS;
  if (!Number.isInteger(plays) || plays < 1 || plays > MAX_PLAYS) {
    throw new EgretError('ANIMATION_TIME_LIMIT');
  }
  const endpoint = plays * duration;
  if (!Number.isFinite(endpoint) || endpoint <= 0 || (finite && endpoint > MAX_TIME)) {
    throw new EgretError('ANIMATION_TIME_LIMIT');
  }
  return { plays, endpoint, finite };
}

function assertTime(time: number, bounds: Bounds): void {
  if (!Number.isFinite(time) || time < 0 || time > MAX_TIME ||
      (bounds.finite ? time > bounds.endpoint : time >= bounds.endpoint)) {
    throw new EgretError('ANIMATION_TIME_LIMIT');
  }
}

/** B(k) is the shared binary64 authority for sampling and marker boundaries. */
function boundary(duration: number, index: number): number {
  return index === 0 ? 0 : index * duration;
}

/** Locate one admitted position without dividing by a possibly subnormal duration. */
export function locatePosition(
  duration: number,
  totalPlays: number | 'infinite',
  time: number,
): SequencePosition {
  const bounds = boundsFor(duration, totalPlays);
  assertTime(time, bounds);
  if (bounds.finite && time === bounds.endpoint) {
    return Object.freeze({
      playIndex: bounds.plays - 1,
      positionSeconds: duration,
      complete: true,
    });
  }

  // The sentinel is strictly beyond time; at most 20 bisections select its play.
  let low = 0;
  let high = bounds.plays;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (boundary(duration, middle) <= time) low = middle;
    else high = middle;
  }
  const start = boundary(duration, low);
  const end = boundary(duration, low + 1);
  if (!(start < end)) throw new EgretError('ANIMATION_PRECISION_LIMIT');
  const positionSeconds = time === start ? 0 : time - start;
  if (time !== start && !(positionSeconds > 0 && positionSeconds < duration)) {
    throw new EgretError('ANIMATION_PRECISION_LIMIT');
  }
  return Object.freeze({ playIndex: low, positionSeconds, complete: false });
}

function occurrence(duration: number, markerTime: number, playIndex: number): number {
  if (markerTime === 0) return boundary(duration, playIndex);
  if (markerTime === duration) return boundary(duration, playIndex + 1);
  return boundary(duration, playIndex) + markerTime;
}

/** Return the first actual play whose occurrence is strictly after time. */
function occurrenceUpperBound(
  duration: number,
  markerTime: number,
  plays: number,
  time: number,
): number {
  let low = 0;
  let high = plays;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (occurrence(duration, markerTime, middle) <= time) low = middle + 1;
    else high = middle;
  }
  return low;
}

interface MarkerRange {
  readonly marker: CapturedSequenceMarker;
  readonly first: number;
  readonly afterLast: number;
}

type MarkerEvent = Extract<PlannedSequenceEvent, { readonly kind: 'marker' }>;

/**
 * Plan a copied marker list's interval without writing a target or an event history.
 * Scalar bounds are checked here; locatePosition owns the candidate's local-position
 * search. Count every occurrence before expanding any event, including without a listener.
 */
export function planEvents(
  duration: number,
  totalPlays: number | 'infinite',
  markers: readonly CapturedSequenceMarker[],
  oldElapsed: number,
  newElapsed: number,
  options: SequenceEventPlanOptions,
  remainingBudget: number,
): readonly PlannedSequenceEvent[] {
  const bounds = boundsFor(duration, totalPlays);
  assertTime(oldElapsed, bounds);
  assertTime(newElapsed, bounds);
  if (newElapsed < oldElapsed) throw new EgretError('ANIMATION_TIME_LIMIT');
  if (!Number.isInteger(remainingBudget) || remainingBudget < 0 || remainingBudget > MAX_EVENTS) {
    throw new EgretError('ANIMATION_EVENT_LIMIT');
  }
  const markerCount = markers.length;
  if (markerCount > MAX_MARKERS) throw new EgretError('ANIMATION_EVENT_LIMIT');
  const includeStart = options.includeStart === true && oldElapsed === 0;
  const includeComplete = options.includeComplete === true && bounds.finite &&
    newElapsed === bounds.endpoint && newElapsed > oldElapsed;
  let eventCount = includeComplete ? 1 : 0;
  if (eventCount > remainingBudget) throw new EgretError('ANIMATION_EVENT_LIMIT');
  const ranges: MarkerRange[] = [];

  for (let index = 0; index < markerCount; index += 1) {
    const marker = markers[index]!;
    const markerTime = marker.timeSeconds;
    if (!Number.isFinite(markerTime) || markerTime < 0 || markerTime > duration) {
      throw new EgretError('ANIMATION_TIME_LIMIT');
    }
    const first = includeStart && markerTime === 0 ? 0 :
      occurrenceUpperBound(duration, markerTime, bounds.plays, oldElapsed);
    const afterLast = occurrenceUpperBound(duration, markerTime, bounds.plays, newElapsed);
    eventCount += afterLast - first;
    if (eventCount > remainingBudget) throw new EgretError('ANIMATION_EVENT_LIMIT');
    if (afterLast > first) ranges.push({ marker, first, afterLast });
  }
  if (eventCount === 0) return EMPTY_EVENTS;

  const events: MarkerEvent[] = [];
  for (const range of ranges) {
    const marker = range.marker;
    for (let playIndex = range.first; playIndex < range.afterLast; playIndex += 1) {
      const start = boundary(duration, playIndex);
      const end = boundary(duration, playIndex + 1);
      const timelineSeconds = occurrence(duration, marker.timeSeconds, playIndex);
      if (!(start < end) || (marker.timeSeconds !== 0 && marker.timeSeconds !== duration &&
          !(timelineSeconds > start && timelineSeconds < end))) {
        throw new EgretError('ANIMATION_PRECISION_LIMIT');
      }
      events.push(Object.freeze({
        kind: 'marker',
        id: marker.id,
        markerIndex: marker.markerIndex,
        playIndex,
        timelineSeconds,
        positionSeconds: marker.timeSeconds === 0 ? 0 : marker.timeSeconds,
      }));
    }
  }
  // End-of-play markers precede the next play's zero markers at the same B(k).
  // Rounded interior ties retain authored time order, then original input order.
  events.sort((left, right) => left.timelineSeconds - right.timelineSeconds ||
    left.playIndex - right.playIndex || left.positionSeconds - right.positionSeconds ||
    left.markerIndex - right.markerIndex);
  const result: PlannedSequenceEvent[] = events;
  if (includeComplete) {
    result.push(Object.freeze({
      kind: 'complete',
      totalPlays: bounds.plays,
      timelineSeconds: bounds.endpoint,
    }));
  }
  return Object.freeze(result);
}
