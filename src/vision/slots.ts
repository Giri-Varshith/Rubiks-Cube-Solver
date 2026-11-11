// Which of the six slots a newly captured face belongs in.
//
// The rule is deliberately cautious: a capture replaces an earlier one only
// when all nine squares match it (turned any way). Anything else gets its own
// slot. Getting this wrong one way costs a spare picture the user can remove;
// getting it wrong the other way (treating two different faces as one) would
// stop them ever capturing all six, so that mistake must not be possible.
//
// An earlier version went by the centre colour alone. Under an ordinary warm
// bulb the camera sees the white centre as yellowish, the two faces were
// taken for one, and scanning stuck at five faces.
import { CONFIG } from '../config';
import { chroma, hueDeg, labDistance, type Lab } from './colorMath';

export interface ScannedFace {
  /** Nine colour samples, row by row, as the camera saw them. */
  samples: Lab[];
  /** Small picture of the face as a data URL, for the Review screen. */
  snapshot: string;
}

/** For a clockwise quarter turn: new cell j shows old cell QUARTER[j]. */
const QUARTER = [6, 3, 0, 7, 4, 1, 8, 5, 2];
const TURNS: number[][] = [[0, 1, 2, 3, 4, 5, 6, 7, 8]];
for (let k = 1; k < 4; k++) TURNS.push(QUARTER.map((j) => TURNS[k - 1][j]));

/**
 * How far apart two captures are if they are the same face, allowing for it
 * being turned: the largest single-square colour difference, for the best of
 * the four ways round.
 */
function faceDifference(a: Lab[], b: Lab[]): number {
  let best = Infinity;
  for (const turn of TURNS) {
    let worst = 0;
    for (let cell = 0; cell < 9 && worst < best; cell++) {
      worst = Math.max(worst, labDistance(a[turn[cell]], b[cell]));
    }
    best = Math.min(best, worst);
  }
  return best;
}

/**
 * Put a captured face into the slots. If all nine squares match a face
 * already captured, it replaces that one; otherwise it takes a new slot.
 * Returns a new array.
 */
export function placeFace(
  slots: ScannedFace[],
  face: ScannedFace,
): { slots: ScannedFace[]; index: number; replaced: boolean } {
  let nearest = -1;
  let nearestDifference = Infinity;
  slots.forEach((slot, i) => {
    const difference = faceDifference(face.samples, slot.samples);
    if (difference <= CONFIG.sameFaceDelta && difference < nearestDifference) {
      nearestDifference = difference;
      nearest = i;
    }
  });

  if (nearest >= 0) {
    const next = [...slots];
    next[nearest] = face;
    return { slots: next, index: nearest, replaced: true };
  }
  return { slots: [...slots, face], index: slots.length, replaced: false };
}

function hueGap(a: Lab, b: Lab): number {
  const d = Math.abs(hueDeg(a) - hueDeg(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** Do two centre squares look like the same colour, ignoring brightness? */
function centresAlike(a: Lab, b: Lab): boolean {
  const ca = chroma(a);
  const cb = chroma(b);
  if (ca < CONFIG.greyChroma && cb < CONFIG.greyChroma) return true; // both near white or grey
  if (Math.min(ca, cb) < CONFIG.minChromaRatio * Math.max(ca, cb)) return false; // one much paler than the other
  return hueGap(a, b) <= CONFIG.sameHueDeg;
}

/**
 * Pairs of slots whose centre squares look alike, as [lower index, higher index].
 * This is only a hint for the user ("are these two the same face?"). It is
 * often wrong in poor light, which is why it is never used to decide anything.
 */
export function lookAlikeSlots(slots: ScannedFace[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let a = 0; a < slots.length; a++) {
    for (let b = a + 1; b < slots.length; b++) {
      if (centresAlike(slots[a].samples[4], slots[b].samples[4])) pairs.push([a, b]);
    }
  }
  return pairs;
}
