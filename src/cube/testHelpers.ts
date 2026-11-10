// Test-only helpers shared by several test files.
import { rotateReading } from './assemble';
import { FACES, FACE_TO_COLOR, type Face, type FaceReading, type Facelets } from './types';

/** A small seeded random number generator (mulberry32), so tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomTurns(rng: () => number): number[] {
  return Array.from({ length: 6 }, () => Math.floor(rng() * 4));
}

export function randomOrder(rng: () => number): number[] {
  const order = [0, 1, 2, 3, 4, 5];
  for (let i = 5; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Cut a cube into six face readings the way a camera would see them:
 * face i is shown turned so that `turns[i]` clockwise quarter turns would
 * restore it, and the faces arrive in the given order.
 */
export function cut(f: Facelets, turns: number[], order: number[]): FaceReading[] {
  const readings = FACES.map((_, i) => {
    const block = f.slice(9 * i, 9 * i + 9).split('').map((letter) => FACE_TO_COLOR[letter as Face]);
    return rotateReading(block, (4 - (turns[i] % 4)) % 4);
  });
  return order.map((i) => readings[i]);
}
