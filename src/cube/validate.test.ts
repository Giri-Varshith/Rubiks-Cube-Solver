import { describe, expect, test } from 'vitest';
import Cube from '../vendor/cubejs/index.js';
import { SOLVED } from './types';
import { validate } from './validate';

// Facelet indices used below (face block * 9 + row * 3 + column):
//   top-front edge:   7 (top),  19 (front)
//   top-right edge:   5 (top),  10 (right)
//   front-bottom edge: 25 (front), 28 (bottom)
//   top-right-front corner: 8 (top), 9 (right), 20 (front)
const set = (f: string, changes: Record<number, string>): string =>
  f
    .split('')
    .map((ch, i) => changes[i] ?? ch)
    .join('');
const swap = (f: string, a: number, b: number): string => set(f, { [a]: f[b], [b]: f[a] });
const kinds = (f: string): string[] => validate(f).problems.map((p) => p.kind);

describe('validate: possible cubes', () => {
  test('the solved cube is valid', () => {
    expect(validate(SOLVED)).toEqual({ valid: true, problems: [], correctPieces: 20 });
  });

  test('50 random cubes are valid', () => {
    for (let i = 0; i < 50; i++) {
      const f = Cube.random().asString();
      expect(validate(f), f).toEqual({ valid: true, problems: [], correctPieces: 20 });
    }
  });
});

describe('validate: impossible cubes', () => {
  test('a wrong colour count is reported in plain words', () => {
    const result = validate(set(SOLVED, { 7: 'R' }));
    expect(result.valid).toBe(false);
    const count = result.problems.find((p) => p.kind === 'count');
    expect(count?.message).toBe('There are 10 red squares and 8 white ones. One of the red squares is probably white.');
    expect(count?.facelets).toContain(7);
  });

  test('one flipped edge is only a flip problem', () => {
    expect(kinds(swap(SOLVED, 7, 19))).toEqual(['flip']);
  });

  test('one twisted corner is only a twist problem', () => {
    const f = set(SOLVED, { 8: SOLVED[9], 9: SOLVED[20], 20: SOLVED[8] });
    expect(kinds(f)).toEqual(['twist']);
  });

  test('two swapped edges are only a parity problem', () => {
    expect(kinds(swap(swap(SOLVED, 7, 5), 19, 10))).toEqual(['parity']);
  });

  test('two pieces with the same colours are reported, with the squares to check', () => {
    // top-right edge becomes white/green (a second top-front edge); counts kept at nine each.
    const result = validate(set(SOLVED, { 10: 'F', 25: 'R' }));
    const ks = result.problems.map((p) => p.kind);
    expect(ks).toContain('duplicateEdge');
    expect(ks).not.toContain('count');
    expect(result.correctPieces).toBeLessThan(20);
    const dup = result.problems.find((p) => p.kind === 'duplicateEdge' && p.message.includes('white/green'));
    expect(dup?.message).toBe('Two pieces have the same colours (white/green edge). One of these squares was read wrongly.');
    expect([...(dup?.facelets ?? [])].sort((a, b) => a - b)).toEqual([5, 7, 10, 19]);
  });

  test('an edge with colours from opposite faces is a bad edge', () => {
    const result = validate(set(SOLVED, { 19: 'D' }));
    const bad = result.problems.find((p) => p.kind === 'badEdge');
    expect(bad?.message).toBe('A piece has colours that cannot be together (white/yellow). One of these squares was read wrongly.');
    expect([...(bad?.facelets ?? [])].sort((a, b) => a - b)).toEqual([7, 19]);
  });

  test('a mirror-image corner is a bad corner', () => {
    expect(kinds(swap(SOLVED, 9, 20))).toEqual(['badCorner']);
  });

  test('a mirror-image corner is explained as a mix-up, not as colours that cannot go together', () => {
    // White, red and green do belong on one corner; here two of them have changed places.
    const [problem] = validate(swap(SOLVED, 9, 20)).problems;
    expect(problem.message).toBe(
      'A corner piece has the right three colours (white/green/red) but two of them are the wrong way round. Two squares have probably swapped colours; red and orange are the usual pair.',
    );
    expect([...problem.facelets].sort((x, y) => x - y)).toEqual([8, 9, 20]);
  });

  test('a corner with colours from opposite faces keeps the plain message', () => {
    // The right-hand square of the top-right-front corner turned yellow: white and yellow on one piece.
    const bad = validate(set(SOLVED, { 9: 'D' })).problems.find((p) => p.kind === 'badCorner');
    expect(bad?.message).toBe('A piece has colours that cannot be together (white/yellow/green). One of these squares was read wrongly.');
  });

  test('flip, twist and parity are not guessed at while pieces are wrong', () => {
    const ks = kinds(set(SOLVED, { 19: 'D' }));
    expect(ks).not.toContain('flip');
    expect(ks).not.toContain('twist');
    expect(ks).not.toContain('parity');
  });

  test('no message uses a bare face letter', () => {
    const broken = [
      set(SOLVED, { 7: 'R' }),
      swap(SOLVED, 7, 19),
      set(SOLVED, { 8: SOLVED[9], 9: SOLVED[20], 20: SOLVED[8] }),
      swap(swap(SOLVED, 7, 5), 19, 10),
      set(SOLVED, { 10: 'F', 25: 'R' }),
      set(SOLVED, { 19: 'D' }),
      swap(SOLVED, 9, 20),
    ];
    for (const f of broken) {
      for (const p of validate(f).problems) expect(p.message).not.toMatch(/\b[URFDLB]\b/);
    }
  });
});
