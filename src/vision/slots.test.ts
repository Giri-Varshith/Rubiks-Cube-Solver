import { describe, expect, test } from 'vitest';
import { seededRandom } from '../cube/testHelpers';
import { COLORS, type Color } from '../cube/types';
import { rgbToLab } from './colorMath';
import { lookAlikeSlots, placeFace, type ScannedFace } from './slots';
import { LIGHTINGS, REF, light, type Lighting } from './testHelpers';

// Rooms a real webcam meets, beyond the four standard test lightings.
const ROOMS: Record<string, Lighting> = {
  ...LIGHTINGS,
  'a warm bulb': { gain: 1, tint: [1.15, 0.95, 0.6] },
  'a dim warm bulb': { gain: 0.5, tint: [1.15, 0.95, 0.6] },
  'a very warm bulb': { gain: 0.9, tint: [1.2, 0.9, 0.45] },
  'a dim room': { gain: 0.35, tint: [1, 1, 1] },
  'a very dim room': { gain: 0.25, tint: [1, 1, 1] },
};

const OTHER_CELLS: Color[] = ['W', 'G', 'B', 'Y', 'W', 'O', 'R', 'B', 'G'];

/** A face with the given centre. Every other square is the same from face to face: the hardest case to tell apart. */
function face(centre: Color, lighting: Lighting, noise = 0, seed = 1): ScannedFace {
  const rng = seededRandom(seed);
  const cells = OTHER_CELLS.map((c, i) => (i === 4 ? centre : c));
  return { samples: cells.map((c) => rgbToLab(light(REF[c], lighting, noise, rng))), snapshot: '' };
}

/** The same picture turned clockwise by quarter turns. */
function turned(f: ScannedFace, quarterTurns: number): ScannedFace {
  let samples = f.samples;
  for (let k = 0; k < quarterTurns; k++) samples = [6, 3, 0, 7, 4, 1, 8, 5, 2].map((from) => samples[from]);
  return { samples, snapshot: '' };
}

describe('placeFace: different faces always get their own slot', () => {
  test.each(Object.keys(ROOMS))('all six faces can be captured in %s light', (room) => {
    let slots: ScannedFace[] = [];
    for (const colour of COLORS) {
      const placed = placeFace(slots, face(colour, ROOMS[room]));
      expect(placed.replaced, `${colour} face`).toBe(false);
      slots = placed.slots;
    }
    expect(slots).toHaveLength(6);
  });

  const pairs = COLORS.flatMap((a, i) => COLORS.slice(i + 1).map((b) => ({ a, b })));
  const cases = Object.keys(ROOMS).flatMap((room) => pairs.map((pair) => ({ room, ...pair })));
  test.each(cases)('$a and $b centres in $room light, even with every other square the same', ({ room, a, b }) => {
    const first = placeFace([], face(a, ROOMS[room]));
    const second = placeFace(first.slots, face(b, ROOMS[room]));
    expect(second.slots).toHaveLength(2);
    expect(second.replaced).toBe(false);
    expect(second.index).toBe(1);
  });

  test('a face that differs from an earlier one in a single square is kept as its own picture', () => {
    const first = face('R', LIGHTINGS.neutral);
    const other = face('R', LIGHTINGS.neutral);
    other.samples[0] = rgbToLab(REF.O);
    expect(placeFace([first], other).slots).toHaveLength(2);
  });
});

describe('placeFace: the same face shown again replaces its own picture', () => {
  test.each(COLORS)('%s-centred face shown again with ordinary camera noise', (colour) => {
    const first = placeFace([], face(colour, LIGHTINGS.neutral, 3, 1));
    const again = face(colour, LIGHTINGS.neutral, 3, 2);
    const second = placeFace(first.slots, again);
    expect(second.slots).toHaveLength(1);
    expect(second.replaced).toBe(true);
    expect(second.index).toBe(0);
    expect(second.slots[0]).toBe(again);
  });

  // Moving the cube a little changes how brightly each face is lit.
  const drift = COLORS.flatMap((colour) => [0.9, 1.1].map((gain) => ({ colour, gain })));
  test.each(drift)('$colour-centred face shown again at brightness x$gain', ({ colour, gain }) => {
    const first = placeFace([], face(colour, LIGHTINGS.neutral));
    const second = placeFace(first.slots, face(colour, { gain, tint: [1, 1, 1] }));
    expect(second.slots).toHaveLength(1);
    expect(second.replaced).toBe(true);
  });

  test.each([1, 2, 3])('shown again turned by %i quarter turns', (quarterTurns) => {
    const original = face('G', LIGHTINGS.warm, 3, 1);
    const first = placeFace([face('B', LIGHTINGS.warm), original], turned(face('G', LIGHTINGS.warm, 3, 2), quarterTurns));
    expect(first.slots).toHaveLength(2);
    expect(first.replaced).toBe(true);
    expect(first.index).toBe(1);
  });

  test('shown again much brighter, it is kept as a second picture rather than risk replacing a different face', () => {
    const first = placeFace([], face('Y', LIGHTINGS.neutral));
    const second = placeFace(first.slots, face('Y', { gain: 1.3, tint: [1, 1, 1] }));
    expect(second.slots).toHaveLength(2);
  });

  test('does not change the array it was given', () => {
    const slots: ScannedFace[] = [];
    placeFace(slots, face('B', LIGHTINGS.neutral));
    expect(slots).toHaveLength(0);
  });
});

describe('lookAlikeSlots: pairs worth a second look (never used to block anything)', () => {
  test('six clearly different faces raise no flags', () => {
    expect(lookAlikeSlots(COLORS.map((colour) => face(colour, LIGHTINGS.neutral)))).toEqual([]);
  });

  test('the same face captured twice at different brightness is flagged', () => {
    const slots = [face('B', LIGHTINGS.neutral), face('Y', LIGHTINGS.neutral), face('Y', { gain: 1.3, tint: [1, 1, 1] })];
    expect(lookAlikeSlots(slots)).toEqual([[1, 2]]);
  });

  test('white and yellow under a warm bulb are flagged, since the camera sees their centres as alike', () => {
    const room = ROOMS['a warm bulb'];
    expect(lookAlikeSlots([face('W', room), face('R', room), face('Y', room)])).toEqual([[0, 2]]);
  });
});
