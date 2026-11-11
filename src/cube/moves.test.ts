import { describe, expect, test } from 'vitest';
import { applyMove } from './geometry';
import { describeMove, formatMove, invertMove, parseMoves } from './moves';
import { FACES, SOLVED, type Face } from './types';

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

// The wording must match what actually happens to the cube, for someone holding it
// white on top (U) and green facing them (F). Each check follows the front or top
// stickers through a clockwise turn and asks where they went.
describe('describeMove agrees with the real turn directions', () => {
  const after = (face: Face) => applyMove(SOLVED, { face, turns: 1 });
  const at = (f: string, face: Face, cells: number[]) => cells.map((cell) => f[9 * FACES.indexOf(face) + cell]);

  test('Right side "up, away from you": the front stickers on the right go up to the top', () => {
    expect(describeMove({ face: 'R', turns: 1 })).toContain('up, away from you');
    expect(at(after('R'), 'U', [2, 5, 8])).toEqual(['F', 'F', 'F']);
  });

  test('Left side "down, towards you": the front stickers on the left go down to the bottom', () => {
    expect(describeMove({ face: 'L', turns: 1 })).toContain('down, towards you');
    expect(at(after('L'), 'D', [0, 3, 6])).toEqual(['F', 'F', 'F']);
  });

  test('Top layer "to the left": the front row of the top layer ends up on the left side', () => {
    expect(describeMove({ face: 'U', turns: 1 })).toContain('to the left');
    expect(at(after('U'), 'L', [0, 1, 2])).toEqual(['F', 'F', 'F']);
  });

  test('Bottom layer "to the right": the front row of the bottom layer ends up on the right side', () => {
    expect(describeMove({ face: 'D', turns: 1 })).toContain('to the right');
    expect(at(after('D'), 'R', [6, 7, 8])).toEqual(['F', 'F', 'F']);
  });

  test('Front face "clockwise": the top stickers next to the front go round to the right side', () => {
    expect(describeMove({ face: 'F', turns: 1 })).toMatch(/turn it clockwise$/);
    expect(at(after('F'), 'R', [0, 3, 6])).toEqual(['U', 'U', 'U']);
  });

  test('Back face "anticlockwise as you look from the front": the top stickers next to the back go round to the left side', () => {
    expect(describeMove({ face: 'B', turns: 1 })).toContain('anticlockwise as you look from the front');
    expect(at(after('B'), 'L', [0, 3, 6])).toEqual(['U', 'U', 'U']);
  });
});
