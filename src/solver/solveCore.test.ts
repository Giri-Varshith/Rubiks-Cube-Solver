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

describe('solveFacelets on cubes near the end of a solution (a re-scan)', () => {
  test('one top-layer turn from solved is one move, at once', () => {
    const f = new Cube().move('U').asString();
    const start = performance.now();
    expect(solveFacelets(f)).toEqual([{ face: 'U', turns: 3 }]);
    expect(performance.now() - start).toBeLessThan(1000);
  }, 30_000);

  test('a top turn and a bottom turn from solved is two moves, at once', () => {
    const f = new Cube().move("U D'").asString();
    const start = performance.now();
    const moves = solveFacelets(f);
    expect(applyMoves(f, moves)).toBe(SOLVED);
    expect(moves).toHaveLength(2);
    expect(performance.now() - start).toBeLessThan(1000);
  }, 30_000);

  test('re-scanning part-way through a solution always answers quickly', () => {
    for (let i = 0; i < 10; i++) {
      const start = Cube.random().asString();
      const solution = solveFacelets(start);
      for (const left of [2, 4, 6, 8, 10]) {
        if (left >= solution.length) continue;
        const midway = applyMoves(start, solution.slice(0, solution.length - left));
        const t0 = performance.now();
        const rest = solveFacelets(midway);
        expect(performance.now() - t0, `${left} moves left`).toBeLessThan(2000);
        expect(applyMoves(midway, rest)).toBe(SOLVED);
        if (left <= 6) expect(rest.length).toBeLessThanOrEqual(left);
      }
    }
  }, 120_000);
});
