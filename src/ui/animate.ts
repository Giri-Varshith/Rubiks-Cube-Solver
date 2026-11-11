// Runs an animation that is guaranteed to finish.
//
// Browsers stop drawing animation frames while a window is hidden, minimised
// or covered. Left to frames alone, a move would then never complete and the
// Solve screen would stay "busy" for ever, ignoring Next (and voice commands,
// which are most useful exactly when you are not looking at the window).
// So a timer stands behind the frames and finishes the job if they stop.

export interface Clock {
  now(): number;
  /** Ask for the next animation frame. */
  frame(callback: (now: number) => void): void;
  /** Run something after a delay, whether or not the window is visible. */
  later(callback: () => void, ms: number): void;
}

const browserClock: Clock = {
  now: () => performance.now(),
  frame: (callback) => void requestAnimationFrame(callback),
  later: (callback, ms) => void setTimeout(callback, ms),
};

/** How long after the animation should have ended the timer steps in (ms). */
const GRACE_MS = 250;

/**
 * Call draw(t) with t going from 0 to 1 over `ms` milliseconds; the last call
 * is always draw(1), unless cancelled() became true first. Resolves when over.
 */
export function animate(
  o: { ms: number; draw(t: number): void; cancelled(): boolean },
  clock: Clock = browserClock,
): Promise<void> {
  const start = clock.now();
  const duration = Math.max(1, o.ms);

  return new Promise<void>((resolve) => {
    let over = false;
    const finish = (drawLast: boolean) => {
      if (over) return;
      over = true;
      if (drawLast) o.draw(1);
      resolve();
    };

    const tick = (now: number) => {
      if (over) return;
      if (o.cancelled()) {
        finish(false);
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        finish(true);
      } else {
        o.draw(t);
        clock.frame(tick);
      }
    };
    clock.frame(tick);
    clock.later(() => finish(!o.cancelled()), duration + GRACE_MS);
  });
}
