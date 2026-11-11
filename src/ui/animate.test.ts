import { describe, expect, test } from 'vitest';
import { animate, type Clock } from './animate';

/** A clock driven by hand: time only moves when the test says so. */
function fakeClock() {
  let time = 0;
  let frames: ((now: number) => void)[] = [];
  let timers: { at: number; run: () => void }[] = [];
  const clock: Clock = {
    now: () => time,
    frame: (callback) => void frames.push(callback),
    later: (callback, ms) => void timers.push({ at: time + ms, run: callback }),
  };
  return {
    clock,
    /** Move time on, running due timers; draw a frame only if the window is visible. */
    advance(ms: number, visible: boolean) {
      time += ms;
      const due = timers.filter((t) => t.at <= time);
      timers = timers.filter((t) => t.at > time);
      due.forEach((t) => t.run());
      if (visible) {
        const waiting = frames;
        frames = [];
        waiting.forEach((callback) => callback(time));
      }
    },
  };
}

const settled = async (promise: Promise<void>) => {
  let done = false;
  void promise.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe('animate', () => {
  test('with the window visible it draws its way from start to finish', async () => {
    const { clock, advance } = fakeClock();
    const seen: number[] = [];
    const promise = animate({ ms: 400, draw: (t) => seen.push(t), cancelled: () => false }, clock);
    for (let i = 0; i < 5; i++) advance(100, true);
    expect(seen).toEqual([0.25, 0.5, 0.75, 1]);
    expect(await settled(promise)).toBe(true);
  });

  test('with the window hidden (no frames at all) it still finishes, shortly after the time is up', async () => {
    const { clock, advance } = fakeClock();
    const seen: number[] = [];
    const promise = animate({ ms: 400, draw: (t) => seen.push(t), cancelled: () => false }, clock);
    advance(300, false);
    expect(await settled(promise)).toBe(false);
    advance(400, false);
    expect(seen).toEqual([1]);
    expect(await settled(promise)).toBe(true);
  });

  test('finishing happens only once, even if a late frame arrives after the timer', async () => {
    const { clock, advance } = fakeClock();
    const seen: number[] = [];
    const promise = animate({ ms: 400, draw: (t) => seen.push(t), cancelled: () => false }, clock);
    advance(900, false);
    advance(100, true);
    expect(seen).toEqual([1]);
    expect(await settled(promise)).toBe(true);
  });

  test('when cancelled it stops drawing and still lets the caller carry on', async () => {
    const { clock, advance } = fakeClock();
    const seen: number[] = [];
    let cancelled = false;
    const promise = animate({ ms: 400, draw: (t) => seen.push(t), cancelled: () => cancelled }, clock);
    advance(100, true);
    cancelled = true;
    advance(100, true);
    advance(1000, true);
    expect(seen).toEqual([0.25]);
    expect(await settled(promise)).toBe(true);
  });
});
