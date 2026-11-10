import { describe, expect, test } from 'vitest';
import Cube from '../vendor/cubejs/index.js';
import { randomOrder, randomTurns, seededRandom } from '../cube/testHelpers';
import { COLORS, type Color } from '../cube/types';
import { classify, nameAnchors } from './classify';
import { rgbToLab } from './colorMath';
import { LIGHTINGS, REF, light, scanCube } from './testHelpers';

describe('nameAnchors', () => {
  test.each(Object.keys(LIGHTINGS))('names the six centre colours under %s light, whatever order they come in', (name) => {
    const rng = seededRandom(7);
    for (let i = 0; i < 10; i++) {
      const order = randomOrder(rng).map((k) => COLORS[k]);
      const centres = order.map((colour) => rgbToLab(light(REF[colour], LIGHTINGS[name])));
      expect(nameAnchors(centres)).toEqual(order);
    }
  });

  test('always gives six different names', () => {
    const grey = rgbToLab([120, 120, 120]);
    expect(new Set(nameAnchors([grey, grey, grey, grey, grey, grey])).size).toBe(6);
  });
});

describe('classify', () => {
  test.each(Object.keys(LIGHTINGS))('reads 20 noisy random cubes correctly under %s light', (name) => {
    const rng = seededRandom(8);
    for (let i = 0; i < 20; i++) {
      const f = Cube.random().asString();
      const { faces, truth } = scanCube(f, randomTurns(rng), randomOrder(rng), LIGHTINGS[name], 8, rng);
      expect(classify(faces), name + ' ' + f).toEqual(truth);
    }
  });

  test('always returns nine of each colour, even when red and orange look almost the same', () => {
    const rng = seededRandom(9);
    const f = Cube.random().asString();
    const { faces, truth } = scanCube(f, randomTurns(rng), randomOrder(rng), LIGHTINGS.neutral, 0, rng);
    const nearRed = rgbToLab([225, 70, 30]);
    const nearOrange = rgbToLab([230, 78, 28]);
    const blurred = faces.map((face, i) =>
      face.map((sample, j) => (truth[i][j] === 'R' ? nearRed : truth[i][j] === 'O' ? nearOrange : sample)),
    );
    const counts: Record<string, number> = {};
    for (const colour of classify(blurred).flat()) counts[colour] = (counts[colour] ?? 0) + 1;
    for (const colour of COLORS) expect(counts[colour], colour).toBe(9);
  });

  test('a centre that reads a little off (a logo on it) does not drag its whole colour with it', () => {
    const rng = seededRandom(10);
    const f = Cube.random().asString();
    const { faces, truth } = scanCube(f, randomTurns(rng), randomOrder(rng), LIGHTINGS.neutral, 4, rng);
    const redFace = truth.findIndex((reading) => reading[4] === ('R' as Color));
    // The red centre is pulled a third of the way towards orange.
    const [r, o] = [REF.R, REF.O];
    faces[redFace][4] = rgbToLab([r[0] + (o[0] - r[0]) / 3, r[1] + (o[1] - r[1]) / 3, r[2] + (o[2] - r[2]) / 3]);
    expect(classify(faces)).toEqual(truth);
  });

  test('rejects anything other than six faces of nine samples', () => {
    const face = Array.from({ length: 9 }, () => rgbToLab([10, 10, 10]));
    expect(() => classify([face, face, face])).toThrow();
  });
});
