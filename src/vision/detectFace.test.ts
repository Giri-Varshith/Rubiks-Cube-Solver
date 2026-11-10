import { beforeAll, describe, expect, test } from 'vitest';
import { rotateReading } from '../cube/assemble';
import { seededRandom } from '../cube/testHelpers';
import { COLORS } from '../cube/types';
import type { RGB } from './colorMath';
import { loadCvForTest } from './cvForTest';
import { detectFace, fixedLattice, type Detection } from './detectFace';
import { cellCentre, renderFace, type FaceRender } from './synthetic';
import { REF } from './testHelpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cv: any;
beforeAll(async () => {
  cv = (await loadCvForTest()).cv;
}, 60_000);

function randomColors(seed: number): RGB[] {
  const rng = seededRandom(seed);
  return Array.from({ length: 9 }, () => REF[COLORS[Math.floor(rng() * 6)]]);
}

const base = (extra: Partial<FaceRender> = {}): FaceRender => ({
  width: 640,
  height: 480,
  colors: randomColors(21),
  cx: 320,
  cy: 240,
  size: 200,
  ...extra,
});

/**
 * 'none' if nothing was found. Otherwise the detection is right only if all
 * nine points land on nine different true cells in the true layout or a
 * quarter-turn of it (never a mirror image); the number of quarter turns is
 * returned. Anything else is 'wrong'.
 */
function judge(o: FaceRender, det: Detection | null): 'none' | 'wrong' | 0 | 1 | 2 | 3 {
  if (!det) return 'none';
  if (det.points.length !== 9) return 'wrong';
  const tolerance = 0.3 * (o.size / 3) * (1 - (o.shear ?? 0));
  for (const k of [0, 1, 2, 3] as const) {
    const trueCellFor = rotateReading([0, 1, 2, 3, 4, 5, 6, 7, 8], k);
    const ok = det.points.every((p, j) => {
      const truth = cellCentre(o, trueCellFor[j]);
      return Math.hypot(p.x - truth.x, p.y - truth.y) <= tolerance;
    });
    if (ok) return k;
  }
  return 'wrong';
}

const detect = (o: FaceRender) => judge(o, detectFace(cv, renderFace(o)));

describe('detectFace finds the face', () => {
  test('straight on, in the middle', () => {
    expect(detect(base())).toBe(0);
  });

  test.each([-40, -20, 10, 30])('turned %i degrees in the picture', (angleDeg) => {
    expect(detect(base({ angleDeg }))).toBe(0);
  });

  test.each([
    [90, 120, 100],
    [150, 500, 130],
    [300, 380, 260],
  ])('at size %i, centred on (%i, %i)', (size, cx, cy) => {
    expect(detect(base({ size, cx, cy }))).toBe(0);
  });

  test('in a full-size 1280x720 camera frame', () => {
    expect(detect(base({ width: 1280, height: 720, cx: 800, cy: 300, size: 320, angleDeg: 12 }))).toBe(0);
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('against a cluttered, noisy background (seed %i)', (seed) => {
    const o = base({ background: 'clutter', noise: 6, seed, colors: randomColors(100 + seed), angleDeg: seed * 7 - 35 });
    expect(detect(o)).toBe(0);
  });

  test('with thin gaps between the cells, like a stickerless cube', () => {
    expect(detect(base({ gapFrac: 0.05, angleDeg: 8 }))).toBe(0);
  });

  test('with a logo on the centre cell', () => {
    expect(detect(base({ logo: true, angleDeg: -15 }))).toBe(0);
  });

  test('squeezed a little, as when tilted away from the camera', () => {
    expect(detect(base({ shear: 0.15, angleDeg: 5 }))).toBe(0);
  });

  test('reports the outline and the cell spacing in frame pixels', () => {
    const o = base({ size: 210 });
    const det = detectFace(cv, renderFace(o))!;
    expect(det.pitch).toBeGreaterThan(60);
    expect(det.pitch).toBeLessThan(80);
    expect(det.corners).toHaveLength(4);
    // Clockwise from top-left: the first corner is up and to the left of the third.
    expect(det.corners[0].x).toBeLessThan(det.corners[2].x);
    expect(det.corners[0].y).toBeLessThan(det.corners[2].y);
    expect(Math.abs(det.corners[0].x - (320 - 105))).toBeLessThan(12);
    expect(Math.abs(det.corners[2].y - (240 + 105))).toBeLessThan(12);
  });
});

describe('detectFace is never confidently wrong', () => {
  test('an all-white face on a pale background is found or skipped', () => {
    const colors = Array.from({ length: 9 }, () => REF.W);
    expect(['none', 0, 1, 2, 3]).toContain(detect(base({ colors, background: [200, 200, 200] })));
  });

  test.each([0.25, 0.4])('a face squeezed by %f is found or skipped', (shear) => {
    expect(['none', 0]).toContain(detect(base({ shear })));
  });

  test('a face half out of the picture is found or skipped', () => {
    expect(['none', 0]).toContain(detect(base({ cx: 40, cy: 240 })));
  });
});

describe('detectFace finds nothing when there is no face', () => {
  test('a face with one corner cell poking out of the picture is skipped, not read from the edge', () => {
    // Turned 44 degrees and pushed up so the top cell centre is just above the frame,
    // while the other eight stickers are still fully visible.
    const o = base({ angleDeg: 44, cy: 88 });
    expect(cellCentre(o, 0).y).toBeLessThan(0);
    expect(detect(o)).toBe('none');
  });

  test('a plain background', () => {
    expect(detect(base({ size: 0 }))).toBe('none');
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('clutter only (seed %i)', (seed) => {
    expect(detect(base({ size: 0, background: 'clutter', noise: 6, seed }))).toBe('none');
  });

  test('only four squares in a 2x2 block', () => {
    const dark: RGB = [18, 18, 18];
    const colors = [REF.R, REF.G, dark, REF.B, REF.Y, dark, dark, dark, dark];
    expect(detect(base({ colors }))).toBe('none');
  });
});

describe('fixedLattice (line-up mode)', () => {
  test('gives nine points, row by row, inside a centred square', () => {
    const det = fixedLattice(640, 480);
    expect(det.points).toHaveLength(9);
    const side = 0.6 * 480;
    for (const p of det.points) {
      expect(Math.abs(p.x - 320)).toBeLessThan(side / 2);
      expect(Math.abs(p.y - 240)).toBeLessThan(side / 2);
    }
    expect(det.points[4]).toEqual({ x: 320, y: 240 });
    expect(det.points[0].x).toBeLessThan(det.points[1].x);
    expect(det.points[0].y).toBeLessThan(det.points[3].y);
    expect(det.pitch).toBeCloseTo(side / 3);
    expect(det.corners[0]).toEqual({ x: 320 - side / 2, y: 240 - side / 2 });
  });
});
