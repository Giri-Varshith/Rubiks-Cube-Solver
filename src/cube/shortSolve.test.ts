import { describe, expect, test } from 'vitest';
import Cube from '../vendor/cubejs/index.js';
import { applyMoves } from './geometry';
import { formatMove, parseMoves } from './moves';
import { findShortSolution } from './shortSolve';
import { SOLVED } from './types';

const scrambled = (alg: string) => applyMoves(SOLVED, parseMoves(alg));

describe('findShortSolution', () => {
  test('a solved cube needs no moves', () => {
    expect(findShortSolution(SOLVED)).toEqual([]);
  });

  test.each(['U', "U'", 'U2', 'D', 'R', "F'", 'B2', 'L'])('a cube one %s turn from solved is solved in one move', (move) => {
    const f = scrambled(move);
    const answer = findShortSolution(f)!;
    expect(answer).toHaveLength(1);
    expect(applyMoves(f, answer)).toBe(SOLVED);
  });

  test.each([
    ['U D', 2],
    ["U D' U2", 2], // two top turns merge into one
    ["R U F'", 3],
    ["R2 U' L D2", 4],
    ["U R U' R' F2", 5],
    ["F R U R' U' F'", 6],
  ])('a cube scrambled with "%s" gets the shortest answer, %i moves', (alg, length) => {
    const f = scrambled(alg);
    const answer = findShortSolution(f)!;
    expect(answer.map(formatMove).join(' ')).not.toBe('');
    expect(applyMoves(f, answer)).toBe(SOLVED);
    expect(answer).toHaveLength(length);
  });

  test('gives up (returns null) on a cube more than six moves from solved', () => {
    expect(findShortSolution(scrambled("R U F' L2 D B R' U2 F L' D' B2 R U'"))).toBeNull();
  });

  test('is quick: 50 random cubes checked in well under two seconds', () => {
    findShortSolution(scrambled('R')); // builds the lookup table
    const start = performance.now();
    for (let i = 0; i < 50; i++) findShortSolution(Cube.random().asString());
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
