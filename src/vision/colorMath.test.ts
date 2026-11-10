import { describe, expect, test } from 'vitest';
import { chroma, hueDeg, labDistance, rgbToLab } from './colorMath';

describe('rgbToLab', () => {
  test('white is L 100 with no colour', () => {
    const [L, a, b] = rgbToLab([255, 255, 255]);
    expect(L).toBeCloseTo(100, 0);
    expect(Math.abs(a)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
  });

  test('pure red matches the published value', () => {
    const [L, a, b] = rgbToLab([255, 0, 0]);
    expect(Math.abs(L - 53.2)).toBeLessThan(0.5);
    expect(Math.abs(a - 80.1)).toBeLessThan(0.5);
    expect(Math.abs(b - 67.2)).toBeLessThan(0.5);
  });

  test('black is L 0', () => {
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 5);
  });
});

describe('labDistance, chroma, hueDeg', () => {
  test('distance is the straight-line distance by default', () => {
    expect(labDistance([50, 0, 0], [53, 4, 0])).toBeCloseTo(5);
  });

  test('a lightness weight of 0 ignores brightness', () => {
    expect(labDistance([20, 10, 10], [80, 10, 10], 0)).toBeCloseTo(0);
    expect(labDistance([20, 10, 10], [80, 13, 14], 0)).toBeCloseTo(5);
  });

  test('chroma is how colourful a sample is', () => {
    expect(chroma([50, 3, 4])).toBeCloseTo(5);
  });

  test('hue runs from 0 to 360 degrees', () => {
    expect(hueDeg([50, 10, 0])).toBeCloseTo(0);
    expect(hueDeg([50, 0, 10])).toBeCloseTo(90);
    expect(hueDeg([50, -10, 0])).toBeCloseTo(180);
    expect(hueDeg([50, 0, -10])).toBeCloseTo(270);
  });
});
