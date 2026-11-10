import { expect, test } from 'vitest';
import Cube from './vendor/cubejs/index.js';
import { loadCvForTest } from './vision/cvForTest';

test('the vendored solver solves a scramble', () => {
  Cube.initSolver();
  const c = new Cube();
  c.move("R U F' L2 D B");
  const s = c.asString();
  expect(s).toHaveLength(54);
  const d = Cube.fromString(s);
  d.move(d.solve());
  expect(d.isSolved()).toBe(true);
}, 60_000);

test('OpenCV loads in Node and has what detection needs', async () => {
  const { cv } = await loadCvForTest();
  for (const fn of ['cvtColor', 'GaussianBlur', 'Canny', 'dilate', 'findContours', 'contourArea', 'minAreaRect', 'resize', 'matFromArray']) {
    expect(typeof cv[fn], fn).toBe('function');
  }
}, 60_000);
