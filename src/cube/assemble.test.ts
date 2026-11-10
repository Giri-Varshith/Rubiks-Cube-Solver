import { describe, expect, test } from 'vitest';
import Cube from '../vendor/cubejs/index.js';
import { assemble, faceletToCell, rotateReading } from './assemble';
import { cut, randomOrder, randomTurns, seededRandom } from './testHelpers';
import { COLOR_TO_FACE, FACE_TO_COLOR, SOLVED, type Color, type Face } from './types';

describe('rotateReading', () => {
  test('one clockwise quarter turn moves the bottom-left cell to the top-left', () => {
    expect(rotateReading([0, 1, 2, 3, 4, 5, 6, 7, 8], 1)).toEqual([6, 3, 0, 7, 4, 1, 8, 5, 2]);
  });

  test('four quarter turns change nothing', () => {
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(rotateReading(cells, 4)).toEqual(cells);
    expect(rotateReading(rotateReading(rotateReading(rotateReading(cells, 1), 1), 1), 1)).toEqual(cells);
  });
});

describe('assemble', () => {
  test('rebuilds 30 random cubes from faces shown in any order, turned any way', () => {
    const rng = seededRandom(1);
    for (let i = 0; i < 30; i++) {
      const original = Cube.random().asString();
      const result = assemble(cut(original, randomTurns(rng), randomOrder(rng)));
      expect(result.candidates, original).toEqual([original]);
      expect(result.bestGuess).toBe(original);
      expect(result.problems).toEqual([]);
    }
  });

  test('a solved cube gives one answer however the faces were turned', () => {
    const result = assemble(cut(SOLVED, [1, 2, 3, 0, 1, 2], [5, 3, 1, 0, 2, 4]));
    expect(result.candidates).toEqual([SOLVED]);
  });

  test('faceletToCell points each square of the best guess back at the scanned square it came from', () => {
    const rng = seededRandom(2);
    const original = Cube.random().asString();
    const readings = cut(original, randomTurns(rng), randomOrder(rng));
    const result = assemble(readings);
    const byFace = new Map<Face, Color[]>(readings.map((r) => [COLOR_TO_FACE[r[4]], r]));
    for (let i = 0; i < 54; i++) {
      const { face, cell } = faceletToCell(i, result.rotations);
      expect(byFace.get(face)![cell]).toBe(FACE_TO_COLOR[result.bestGuess[i] as Face]);
    }
  });

  test('one misread square gives no valid cube, a best guess and a reason', () => {
    const rng = seededRandom(3);
    const original = Cube.random().asString();
    const readings = cut(original, randomTurns(rng), randomOrder(rng));
    readings[0][0] = readings[0][0] === 'W' ? 'Y' : 'W';
    const result = assemble(readings);
    expect(result.candidates).toEqual([]);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.bestGuess).toHaveLength(54);
  });

  test('a single misread keeps the best guess close to the real cube', () => {
    const rng = seededRandom(4);
    const original = Cube.random().asString();
    const turns = randomTurns(rng);
    const readings = cut(original, turns, [0, 1, 2, 3, 4, 5]);
    readings[2][1] = readings[2][1] === 'W' ? 'Y' : 'W';
    const result = assemble(readings);
    const differing = [...result.bestGuess].filter((ch, i) => ch !== original[i]).length;
    expect(differing).toBe(1);
  });

  test('faces from two different cubes do not crash and are explained', () => {
    const rng = seededRandom(5);
    const a = cut(Cube.random().asString(), randomTurns(rng), [0, 1, 2, 3, 4, 5]);
    const b = cut(Cube.random().asString(), randomTurns(rng), [0, 1, 2, 3, 4, 5]);
    const mixed = [a[0], a[1], a[2], b[3], b[4], b[5]];
    const result = assemble(mixed);
    expect(result.candidates).toEqual([]);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.bestGuess).toHaveLength(54);
  });

  test('two faces with the same centre colour are rejected', () => {
    const readings = cut(SOLVED, [0, 0, 0, 0, 0, 0], [0, 1, 2, 3, 4, 5]);
    readings[1] = [...readings[0]];
    expect(() => assemble(readings)).toThrow();
  });

  test('anything other than six faces of nine is rejected', () => {
    const readings = cut(SOLVED, [0, 0, 0, 0, 0, 0], [0, 1, 2, 3, 4, 5]);
    expect(() => assemble(readings.slice(0, 5))).toThrow();
    expect(() => assemble([...readings.slice(0, 5), readings[5].slice(0, 8)])).toThrow();
  });

  test('takes well under half a second', () => {
    const rng = seededRandom(6);
    const readings = cut(Cube.random().asString(), randomTurns(rng), randomOrder(rng));
    assemble(readings); // warm up
    const start = performance.now();
    assemble(readings);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
