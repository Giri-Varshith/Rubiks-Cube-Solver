import { describe, expect, test } from 'vitest';
import { describeMove, formatMove, invertMove, parseMoves } from './moves';

describe('parseMoves', () => {
  test('reads quarter, half and anticlockwise turns', () => {
    expect(parseMoves("R U2 F'")).toEqual([
      { face: 'R', turns: 1 },
      { face: 'U', turns: 2 },
      { face: 'F', turns: 3 },
    ]);
  });

  test('an empty or blank string is no moves', () => {
    expect(parseMoves('')).toEqual([]);
    expect(parseMoves('  ')).toEqual([]);
  });

  test('rejects anything that is not a move', () => {
    expect(() => parseMoves('X')).toThrow();
    expect(() => parseMoves('R3')).toThrow();
    expect(() => parseMoves('RU')).toThrow();
  });
});

describe('formatMove and invertMove', () => {
  test('the inverse of a clockwise turn is anticlockwise', () => {
    expect(formatMove(invertMove({ face: 'R', turns: 1 }))).toBe("R'");
    expect(formatMove(invertMove({ face: 'R', turns: 3 }))).toBe('R');
  });

  test('a half turn is its own inverse', () => {
    expect(formatMove(invertMove({ face: 'U', turns: 2 }))).toBe('U2');
  });
});

describe('describeMove', () => {
  const table: [string, string][] = [
    ['R', 'Right side: turn it up, away from you'],
    ["R'", 'Right side: turn it down, towards you'],
    ['R2', 'Right side: turn it halfway round'],
    ['L', 'Left side: turn it down, towards you'],
    ["L'", 'Left side: turn it up, away from you'],
    ['L2', 'Left side: turn it halfway round'],
    ['U', 'Top layer: turn it to the left'],
    ["U'", 'Top layer: turn it to the right'],
    ['U2', 'Top layer: turn it halfway round'],
    ['D', 'Bottom layer: turn it to the right'],
    ["D'", 'Bottom layer: turn it to the left'],
    ['D2', 'Bottom layer: turn it halfway round'],
    ['F', 'Front face: turn it clockwise'],
    ["F'", 'Front face: turn it anticlockwise'],
    ['F2', 'Front face: turn it halfway round'],
    ['B', 'Back face: turn it anticlockwise as you look from the front'],
    ["B'", 'Back face: turn it clockwise as you look from the front'],
    ['B2', 'Back face: turn it halfway round'],
  ];

  test.each(table)('%s reads "%s"', (notation, text) => {
    expect(describeMove(parseMoves(notation)[0])).toBe(text);
  });
});
