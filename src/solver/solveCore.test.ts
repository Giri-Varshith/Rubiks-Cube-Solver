import { beforeAll, describe, expect, test } from 'vitest';
import Cube from '../vendor/cubejs/index.js';
import { assemble } from '../cube/assemble';
import { applyMoves } from '../cube/geometry';
import { cut, randomOrder, randomTurns, seededRandom } from '../cube/testHelpers';
import { SOLVED } from '../cube/types';
import { initTables, solveFacelets } from './solveCore';

beforeAll(() => initTables(), 60_000);

describe('solveFacelets', () => {
  test('a solved cube needs no moves', () => {
    expect(solveFacelets(SOLVED)).toEqual([]);
  });

  test('solves 20 random cubes in 24 moves or fewer', () => {
    for (let i = 0; i < 20; i++) {
      const f = Cube.random().asString();
      const moves = solveFacelets(f);
      expect(applyMoves(f, moves), f).toBe(SOLVED);
      expect(moves.length).toBeLessThanOrEqual(24);
    }
  }, 60_000);

  test('a cube one turn from solved is solved by one move', () => {
    const f = new Cube().move('R').asString();
    expect(solveFacelets(f)).toEqual([{ face: 'R', turns: 3 }]);
  });

  test('refuses a cube that is not physically possible', () => {
    const flipped = SOLVED.split('');
    [flipped[7], flipped[19]] = [flipped[19], flipped[7]];
    expect(() => solveFacelets(flipped.join(''))).toThrow();
  });

  test('scanned faces, shuffled and turned, can be assembled and solved end to end', () => {
    const rng = seededRandom(11);
    for (let i = 0; i < 5; i++) {
      const original = Cube.random().asString();
      const { candidates } = assemble(cut(original, randomTurns(rng), randomOrder(rng)));
      expect(applyMoves(candidates[0], solveFacelets(candidates[0]))).toBe(SOLVED);
    }
  }, 60_000);
});

describe('solveFacelets on cubes that are nearly solved', () => {
  test.each([
    ["R U F'", 3],
    ["R2 U' L D2", 4],
    ["F R U R' U' F'", 6],
  ])('a cube scrambled with "%s" is solved in at most %i moves', (scramble, max) => {
    const f = new Cube().move(scramble).asString();
    const moves = solveFacelets(f);
    expect(applyMoves(f, moves)).toBe(SOLVED);
    expect(moves.length).toBeLessThanOrEqual(max);
  });
});
