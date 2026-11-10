import { describe, expect, test } from 'vitest';
import Cube from '../vendor/cubejs/index.js';
import { STICKERS, applyMove, applyMoves, layer, quarterTurnAngle } from './geometry';
import { formatMove } from './moves';
import { FACES, SOLVED, type Move } from './types';

const ALL_MOVES: Move[] = FACES.flatMap((face) => ([1, 2, 3] as const).map((turns) => ({ face, turns })));
const SCRAMBLE = "R U F' L2 D B";

describe('STICKERS', () => {
  test('has 54 distinct position/normal pairs', () => {
    expect(STICKERS).toHaveLength(54);
    const keys = new Set(STICKERS.map((s) => `${s.pos.join(',')}|${s.normal.join(',')}`));
    expect(keys.size).toBe(54);
  });

  test('puts each face centre at index 9f+4, sitting on its own normal', () => {
    for (let f = 0; f < 6; f++) {
      const s = STICKERS[9 * f + 4];
      expect(s.pos).toEqual(s.normal);
    }
  });

  test('every sticker lies on the face its normal points out of', () => {
    for (const s of STICKERS) {
      const axis = s.normal.findIndex((n) => n !== 0);
      expect(s.pos[axis]).toBe(s.normal[axis]);
    }
  });
});

describe('applyMove', () => {
  test.each(ALL_MOVES)('$face x$turns from solved matches the reference solver library', (m) => {
    expect(applyMove(SOLVED, m)).toBe(new Cube().move(formatMove(m)).asString());
  });

  test.each(ALL_MOVES)('$face x$turns from a scramble matches the reference solver library', (m) => {
    const start = new Cube().move(SCRAMBLE).asString();
    expect(applyMove(start, m)).toBe(new Cube().move(SCRAMBLE).move(formatMove(m)).asString());
  });

  test.each(FACES.map((face) => ({ face })))('four quarter turns of $face return to the start', ({ face }) => {
    const start = new Cube().move(SCRAMBLE).asString();
    const m: Move = { face, turns: 1 };
    expect(applyMoves(start, [m, m, m, m])).toBe(start);
  });

  test('a clockwise quarter turn of the right face brings the front stickers to the top', () => {
    const after = applyMove(SOLVED, { face: 'R', turns: 1 });
    // U face, right column (indices 2, 5, 8) now shows the front colour.
    expect([after[2], after[5], after[8]]).toEqual(['F', 'F', 'F']);
  });
});

describe('layer and quarterTurnAngle', () => {
  test('layer names the axis and side of each face', () => {
    expect(layer('U')).toEqual({ axis: 1, coord: 1 });
    expect(layer('D')).toEqual({ axis: 1, coord: -1 });
    expect(layer('R')).toEqual({ axis: 0, coord: 1 });
    expect(layer('L')).toEqual({ axis: 0, coord: -1 });
    expect(layer('F')).toEqual({ axis: 2, coord: 1 });
    expect(layer('B')).toEqual({ axis: 2, coord: -1 });
  });

  test('a clockwise turn is -90 degrees about a positive-side normal and +90 about a negative-side one', () => {
    expect(quarterTurnAngle('U')).toBeCloseTo(-Math.PI / 2);
    expect(quarterTurnAngle('R')).toBeCloseTo(-Math.PI / 2);
    expect(quarterTurnAngle('F')).toBeCloseTo(-Math.PI / 2);
    expect(quarterTurnAngle('D')).toBeCloseTo(Math.PI / 2);
    expect(quarterTurnAngle('L')).toBeCloseTo(Math.PI / 2);
    expect(quarterTurnAngle('B')).toBeCloseTo(Math.PI / 2);
  });
});
