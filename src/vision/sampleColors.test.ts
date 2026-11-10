import { describe, expect, test } from 'vitest';
import type { Color } from '../cube/types';
import { labDistance, rgbToLab, type RGB } from './colorMath';
import { sampleColors } from './sampleColors';
import { cellCentre, renderFace, type FaceRender } from './synthetic';
import { REF } from './testHelpers';

const CELLS: Color[] = ['W', 'G', 'B', 'Y', 'R', 'O', 'R', 'B', 'G'];
const colors: RGB[] = CELLS.map((c) => REF[c]);
const base: FaceRender = { width: 640, height: 480, colors, cx: 320, cy: 240, size: 210 };
const points = (o: FaceRender) => Array.from({ length: 9 }, (_, cell) => cellCentre(o, cell));

describe('renderFace and cellCentre', () => {
  test('a frame has four bytes per pixel', () => {
    const frame = renderFace(base);
    expect(frame.width).toBe(640);
    expect(frame.height).toBe(480);
    expect(frame.data.length).toBe(640 * 480 * 4);
  });

  test('the centre cell is at the face centre and the top-left cell is up and to the left', () => {
    expect(cellCentre(base, 4)).toEqual({ x: 320, y: 240 });
    const topLeft = cellCentre(base, 0);
    expect(topLeft.x).toBeCloseTo(250);
    expect(topLeft.y).toBeCloseTo(170);
  });

  test('a positive angle turns the face clockwise on screen', () => {
    const turned = cellCentre({ ...base, angleDeg: 90 }, 0);
    // The top-left cell moves to the top-right.
    expect(turned.x).toBeCloseTo(390);
    expect(turned.y).toBeCloseTo(170);
  });

  test('the same seed gives the same picture', () => {
    const a = renderFace({ ...base, background: 'clutter', noise: 6, seed: 3 });
    const b = renderFace({ ...base, background: 'clutter', noise: 6, seed: 3 });
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });
});

describe('sampleColors', () => {
  test('reads each cell colour from a clean picture', () => {
    const frame = renderFace(base);
    const samples = sampleColors(frame, points(base), 20);
    samples.forEach((lab, i) => expect(labDistance(lab, rgbToLab(colors[i])), `cell ${i}`).toBeLessThan(1));
  });

  test('reads each cell colour from a turned, squeezed picture', () => {
    const o: FaceRender = { ...base, angleDeg: 25, shear: 0.15, cx: 200, cy: 300, size: 150 };
    const samples = sampleColors(renderFace(o), points(o), 12);
    samples.forEach((lab, i) => expect(labDistance(lab, rgbToLab(colors[i])), `cell ${i}`).toBeLessThan(1));
  });

  test('the median shrugs off speckles', () => {
    const frame = renderFace(base);
    // Blacken one pixel in twenty.
    for (let p = 0; p < frame.width * frame.height; p += 20) frame.data.fill(0, p * 4, p * 4 + 3);
    const samples = sampleColors(frame, points(base), 20);
    samples.forEach((lab, i) => expect(labDistance(lab, rgbToLab(colors[i])), `cell ${i}`).toBeLessThan(3));
  });

  test('a point on the very edge of the frame does not throw', () => {
    const frame = renderFace(base);
    expect(() =>
      sampleColors(
        frame,
        [
          { x: 0, y: 0 },
          { x: 639.6, y: 479.6 },
          { x: -5, y: 900 },
        ],
        20,
      ),
    ).not.toThrow();
  });
});
