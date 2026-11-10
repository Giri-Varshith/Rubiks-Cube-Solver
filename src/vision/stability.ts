// Decides when a reading has held still long enough to capture.
import { CONFIG } from '../config';
import { labDistance, type Lab } from './colorMath';
import type { Detection } from './detectFace';

interface Window {
  startMs: number;
  x: number;
  y: number;
  first: Lab[];
  readings: Lab[][];
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 === 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function allWithin(a: Lab[], b: Lab[], limit: number): boolean {
  return a.every((sample, i) => labDistance(sample, b[i]) <= limit);
}

export class StabilityTracker {
  private window: Window | null = null;
  private lastFired: Lab[] | null = null;
  private lastTimeMs = 0;
  private suppressed = false;

  /**
   * Feed one reading (or nulls when no face was found). Returns the nine
   * captured colours when the face has held still for long enough, else null.
   *
   * The wait restarts if the face is lost, the grid drifts, or any cell
   * changes colour (a finger or glare crossing it). After a capture, the same
   * face is not captured again until a different one is shown.
   */
  push(timeMs: number, det: Detection | null, colors: Lab[] | null): Lab[] | null {
    this.lastTimeMs = timeMs;
    this.suppressed = false;
    if (!det || !colors || colors.length !== 9) {
      this.window = null;
      return null;
    }
    if (this.lastFired && allWithin(colors, this.lastFired, CONFIG.sameFaceDelta)) {
      this.suppressed = true;
      this.window = null;
      return null;
    }

    const centre = det.points[4];
    const w = this.window;
    const drifted = w !== null && Math.hypot(centre.x - w.x, centre.y - w.y) > CONFIG.steadyMoveFrac * det.pitch;
    const changed = w !== null && !allWithin(colors, w.first, CONFIG.steadyColorDelta);
    if (w === null || drifted || changed) {
      this.window = { startMs: timeMs, x: centre.x, y: centre.y, first: colors, readings: [colors] };
      return null;
    }

    w.readings.push(colors);
    if (timeMs - w.startMs < CONFIG.steadyMs) return null;

    const captured = Array.from({ length: 9 }, (_, cell) =>
      [0, 1, 2].map((channel) => median(w.readings.map((reading) => reading[cell][channel]))) as Lab,
    );
    this.lastFired = captured;
    this.suppressed = true;
    this.window = null;
    return captured;
  }

  /** How far through the wait the current reading is, 0..1. */
  progress(): number {
    if (!this.window) return 0;
    return Math.max(0, Math.min(1, (this.lastTimeMs - this.window.startMs) / CONFIG.steadyMs));
  }

  /** True while the face being shown is the one that was just captured. */
  alreadyCaptured(): boolean {
    return this.suppressed;
  }

  /** Forget everything, including the last capture. */
  reset(): void {
    this.suppressed = false;
    this.window = null;
    this.lastFired = null;
    this.lastTimeMs = 0;
  }
}
