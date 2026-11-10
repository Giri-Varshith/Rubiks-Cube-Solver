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
