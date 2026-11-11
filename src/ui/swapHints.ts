// Words and ordering for "these two squares look swapped" on the Check colours screen.
import type { SwapSuggestion } from '../cube/assemble';
import { COLOR_NAME, type FaceReading } from '../cube/types';
import { labDistance, type Lab } from '../vision/colorMath';

const POSITION = [
  'top-left',
  'top-middle',
  'top-right',
  'middle-left',
  'centre',
  'middle-right',
  'bottom-left',
  'bottom-middle',
  'bottom-right',
];

/** A square in plain words: where it is, which face it is on, and the colour currently shown. */
export function describeSquare(readings: FaceReading[], where: { face: number; cell: number }): string {
  const reading = readings[where.face];
  return `the ${POSITION[where.cell]} square of the ${COLOR_NAME[reading[4]]}-centre face (shown as ${COLOR_NAME[reading[where.cell]]})`;
}

/**
 * Most likely mix-up first. A real mix-up is between two squares that looked
 * alike to the camera (red and orange in warm light), so suggestions are
 * ordered by how close the two squares' sampled colours were.
 */
export function rankSwaps(suggestions: SwapSuggestion[], samples: Lab[][]): SwapSuggestion[] {
  const likeness = (s: SwapSuggestion) => labDistance(samples[s.a.face][s.a.cell], samples[s.b.face][s.b.cell]);
  return [...suggestions].sort((p, q) => likeness(p) - likeness(q));
}
