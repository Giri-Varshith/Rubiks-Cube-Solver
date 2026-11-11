import { describe, expect, test } from 'vitest';
import { COLORS, type Color } from '../cube/types';
import { rgbToLab } from './colorMath';
import { placeFace, type ScannedFace } from './slots';
import { LIGHTINGS, REF, light, type Lighting } from './testHelpers';

/** A face whose centre is the given colour; the other cells are a fixed mix. */
function face(centre: Color, lighting: Lighting): ScannedFace {
  const cells: Color[] = ['W', 'G', 'B', 'Y', centre, 'O', 'R', 'B', 'G'];
  return { samples: cells.map((c) => rgbToLab(light(REF[c], lighting))), snapshot: '' };
}

describe('placeFace', () => {
  test('six different centres fill six slots', () => {
    let slots: ScannedFace[] = [];
    for (const colour of COLORS) slots = placeFace(slots, face(colour, LIGHTINGS.neutral)).slots;
    expect(slots).toHaveLength(6);
  });

  test.each(Object.keys(LIGHTINGS))('red and orange centres stay two separate faces under %s light', (name) => {
    const first = placeFace([], face('R', LIGHTINGS[name]));
    const second = placeFace(first.slots, face('O', LIGHTINGS[name]));
    expect(second.slots).toHaveLength(2);
    expect(second.replaced).toBe(false);
    expect(second.index).toBe(1);
  });

  test.each(Object.keys(LIGHTINGS))('white and yellow centres stay two separate faces under %s light', (name) => {
    const first = placeFace([], face('W', LIGHTINGS[name]));
    expect(placeFace(first.slots, face('Y', LIGHTINGS[name])).slots).toHaveLength(2);
  });

  test('the same face shown again a little darker replaces its own slot', () => {
    const warm = LIGHTINGS.warm;
    const first = placeFace([], face('R', warm));
    const darker = face('R', { gain: 0.85, tint: warm.tint });
    const second = placeFace(first.slots, darker);
    expect(second.slots).toHaveLength(1);
    expect(second.replaced).toBe(true);
    expect(second.index).toBe(0);
    expect(second.slots[0]).toBe(darker);
  });

  test('does not change the array it was given', () => {
    const slots: ScannedFace[] = [];
    placeFace(slots, face('B', LIGHTINGS.neutral));
    expect(slots).toHaveLength(0);
  });
});

describe('placeFace: the same face shown again must replace its slot, not take a new one', () => {
  const cases = COLORS.flatMap((colour) => [0.7, 0.8, 1.2, 1.3].map((gain) => ({ colour, gain })));

  test.each(cases)('$colour centre re-shown at brightness x$gain', ({ colour, gain }) => {
    const first = placeFace([], face(colour, LIGHTINGS.neutral));
    const second = placeFace(first.slots, face(colour, { gain, tint: [1, 1, 1] }));
    expect(second.slots).toHaveLength(1);
    expect(second.replaced).toBe(true);
  });

  test.each(COLORS.filter((c) => c !== 'W'))('%s centre re-shown with mild glare on it', (colour) => {
    const first = placeFace([], face(colour, LIGHTINGS.neutral));
    const glared = face(colour, LIGHTINGS.neutral);
    // A quarter of the way to white, as a soft reflection does.
    const [r, g, b] = REF[colour];
    glared.samples[4] = rgbToLab([r + (255 - r) * 0.25, g + (255 - g) * 0.25, b + (255 - b) * 0.25]);
    expect(placeFace(first.slots, glared).slots).toHaveLength(1);
  });
});

describe('placeFace: different faces must never share a slot', () => {
  const pairs = COLORS.flatMap((a, i) => COLORS.slice(i + 1).map((b) => ({ a, b })));
  const cases = Object.keys(LIGHTINGS).flatMap((name) => pairs.map((pair) => ({ name, ...pair })));

  test.each(cases)('$a and $b centres under $name light', ({ name, a, b }) => {
    const first = placeFace([], face(a, LIGHTINGS[name]));
    expect(placeFace(first.slots, face(b, LIGHTINGS[name])).slots).toHaveLength(2);
  });
});
