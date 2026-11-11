// Which of the six slots a newly captured face belongs in.
// Faces are told apart by the colour of their centre square.
import { CONFIG } from '../config';
import { chroma, hueDeg, type Lab } from './colorMath';

export interface ScannedFace {
  /** Nine colour samples, row by row, as the camera saw them. */
  samples: Lab[];
  /** Small picture of the face as a data URL, for the Review screen. */
  snapshot: string;
}

function hueGap(a: Lab, b: Lab): number {
  const d = Math.abs(hueDeg(a) - hueDeg(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * How alike two centre colours are: a number (smaller is closer) if they look
 * like the same face, or null if they are different faces. Only hue and
 * colourfulness are compared, never brightness.
 */
export function centreMatch(a: Lab, b: Lab): number | null {
  const ca = chroma(a);
  const cb = chroma(b);
  if (ca < CONFIG.greyChroma && cb < CONFIG.greyChroma) return 0; // both white
  if (Math.min(ca, cb) < CONFIG.minChromaRatio * Math.max(ca, cb)) return null; // one much paler than the other
  const gap = hueGap(a, b);
  return gap <= CONFIG.sameHueDeg ? gap : null;
}

/**
 * Put a captured face into the slots. If its centre colour matches a face
 * already captured, it replaces that one (this is how a bad capture is
 * re-done); otherwise it takes a new slot. Returns a new array.
 */
export function placeFace(
  slots: ScannedFace[],
  face: ScannedFace,
): { slots: ScannedFace[]; index: number; replaced: boolean } {
  let nearest = -1;
  let nearestScore = Infinity;
  slots.forEach((slot, i) => {
    const score = centreMatch(slot.samples[4], face.samples[4]);
    if (score !== null && score < nearestScore) {
      nearestScore = score;
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
