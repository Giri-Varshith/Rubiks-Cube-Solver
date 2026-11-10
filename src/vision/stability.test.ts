import { describe, expect, test } from 'vitest';
import type { Lab } from './colorMath';
import type { Detection } from './detectFace';
import { StabilityTracker } from './stability';

const STEP = 1000 / 15; // fifteen readings a second

function detection(x = 320, y = 240, pitch = 60): Detection {
  return { points: Array.from({ length: 9 }, () => ({ x, y })), corners: [], pitch, candidates: [] };
}
// points[4] is the grid centre the tracker watches.

const faceA: Lab[] = Array.from({ length: 9 }, (_, i) => [50 + i, 10, 10] as Lab);
const faceB: Lab[] = Array.from({ length: 9 }, (_, i) => [50 + i, -30, 40] as Lab);

/** Feed readings from a start time; returns the times at which the tracker fired. */
function feed(
  tracker: StabilityTracker,
  from: number,
  count: number,
  reading: (n: number) => { det: Detection | null; colors: Lab[] | null },
): { fired: number[]; results: Lab[][]; end: number } {
  const fired: number[] = [];
  const results: Lab[][] = [];
  let t = from;
  for (let n = 0; n < count; n++, t += STEP) {
    const { det, colors } = reading(n);
    const out = tracker.push(t, det, colors);
    if (out) {
      fired.push(Math.round(t));
      results.push(out);
    }
  }
  return { fired, results, end: t };
}

const steady = (colors: Lab[]) => () => ({ det: detection(), colors });

describe('StabilityTracker', () => {
  test('a steady reading is captured once, at the first reading 700 ms or more after it appeared', () => {
    const tracker = new StabilityTracker();
    const { fired, results } = feed(tracker, 0, 20, steady(faceA));
    expect(fired).toEqual([733]);
    expect(results[0]).toEqual(faceA);
  });

  test('holding the same face for three more seconds does not capture it again', () => {
    const tracker = new StabilityTracker();
    const first = feed(tracker, 0, 15, steady(faceA));
    expect(first.fired).toHaveLength(1);
    expect(feed(tracker, first.end, 45, steady(faceA)).fired).toEqual([]);
  });

  test('losing the face restarts the wait', () => {
    const tracker = new StabilityTracker();
    // Lost at the 7th reading (400 ms); steady again from 467 ms, so it fires at 467 + 733 = 1200 ms.
    const { fired } = feed(tracker, 0, 30, (n) => (n === 6 ? { det: null, colors: null } : { det: detection(), colors: faceA }));
    expect(fired).toEqual([1200]);
  });

  test('a face that keeps moving is never captured', () => {
    const tracker = new StabilityTracker();
    const { fired } = feed(tracker, 0, 60, (n) => ({ det: detection(100 + n * 30, 240, 60), colors: faceA }));
    expect(fired).toEqual([]);
  });

  test('a small wobble does not stop a capture', () => {
    const tracker = new StabilityTracker();
    const { fired } = feed(tracker, 0, 20, (n) => ({ det: detection(320 + (n % 2) * 4, 240, 60), colors: faceA }));
    expect(fired).toEqual([733]);
  });

  test('one cell flickering (a finger or glare crossing it) blocks capture until it settles', () => {
    const tracker = new StabilityTracker();
    const flicker = faceA.map((c, i) => (i === 2 ? ([c[0], c[1] + 30, c[2]] as Lab) : c));
    const during = feed(tracker, 0, 45, (n) => ({ det: detection(), colors: n % 2 === 0 ? faceA : flicker }));
    expect(during.fired).toEqual([]);
    const after = feed(tracker, during.end, 20, steady(faceA));
    expect(after.fired).toHaveLength(1);
    // The last flicker reading was one step before `during.end`, so the wait ends about 700 ms after that.
    expect(after.fired[0] - Math.round(during.end)).toBeGreaterThanOrEqual(600);
    expect(after.fired[0] - Math.round(during.end)).toBeLessThanOrEqual(800);
  });

  test('a different face is captured after its own 700 ms', () => {
    const tracker = new StabilityTracker();
    const first = feed(tracker, 0, 15, steady(faceA));
    const second = feed(tracker, first.end, 20, steady(faceB));
    expect(second.fired).toHaveLength(1);
    expect(second.fired[0] - Math.round(first.end)).toBe(733);
    expect(second.results[0]).toEqual(faceB);
  });

  test('progress runs from 0 to 1 across the wait', () => {
    const tracker = new StabilityTracker();
    expect(tracker.progress()).toBe(0);
    feed(tracker, 0, 6, steady(faceA)); // last reading at 333 ms
    expect(tracker.progress()).toBeGreaterThan(0.4);
    expect(tracker.progress()).toBeLessThan(0.6);
    tracker.push(400, null, null);
    expect(tracker.progress()).toBe(0);
  });

  test('the captured value is the middle value, so one odd reading does not shift it', () => {
    const tracker = new StabilityTracker();
    const nudged = faceA.map((c) => [c[0] + 4, c[1], c[2]] as Lab);
    const { results } = feed(tracker, 0, 20, (n) => ({ det: detection(), colors: n === 5 ? nudged : faceA }));
    expect(results[0]).toEqual(faceA);
  });

  test('after reset the same face can be captured again', () => {
    const tracker = new StabilityTracker();
    const first = feed(tracker, 0, 15, steady(faceA));
    tracker.reset();
    expect(feed(tracker, first.end, 15, steady(faceA)).fired).toHaveLength(1);
  });
});

describe('StabilityTracker.alreadyCaptured', () => {
  test('is true only while the face just captured is still being shown', () => {
    const tracker = new StabilityTracker();
    expect(tracker.alreadyCaptured()).toBe(false);
    const first = feed(tracker, 0, 11, steady(faceA)); // not yet captured
    expect(first.fired).toEqual([]);
    expect(tracker.alreadyCaptured()).toBe(false);
    const second = feed(tracker, first.end, 3, steady(faceA)); // captured, still showing
    expect(second.fired).toHaveLength(1);
    expect(tracker.alreadyCaptured()).toBe(true);
    tracker.push(second.end, detection(), faceB);
    expect(tracker.alreadyCaptured()).toBe(false);
    tracker.push(second.end + STEP, null, null);
    expect(tracker.alreadyCaptured()).toBe(false);
  });

  test('a new face held in a shaky hand is not reported as already captured', () => {
    const tracker = new StabilityTracker();
    // The grid jumps by half a cell every reading, so the wait keeps restarting.
    feed(tracker, 0, 30, (n) => ({ det: detection(100 + (n % 2) * 30, 240, 60), colors: faceA }));
    expect(tracker.progress()).toBe(0);
    expect(tracker.alreadyCaptured()).toBe(false);
  });
});
