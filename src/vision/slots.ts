// Which of the six slots a newly captured face belongs in.
// Faces are told apart by the colour of their centre square.
import { CONFIG } from '../config';
import { labDistance, type Lab } from './colorMath';

export interface ScannedFace {
  /** Nine colour samples, row by row, as the camera saw them. */
  samples: Lab[];
  /** Small picture of the face as a data URL, for the Review screen. */
  snapshot: string;
}

/**
 * Put a captured face into the slots. If its centre colour is close to a face
 * already captured, it replaces that one (this is how a bad capture is
 * re-done); otherwise it takes a new slot. Returns a new array.
 */
export function placeFace(
  slots: ScannedFace[],
  face: ScannedFace,
): { slots: ScannedFace[]; index: number; replaced: boolean } {
  let nearest = -1;
  let nearestDistance = Infinity;
  slots.forEach((slot, i) => {
    const d = labDistance(slot.samples[4], face.samples[4], CONFIG.lightnessWeight);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = i;
    }
  });

  if (nearest >= 0 && nearestDistance < CONFIG.sameCentreDelta) {
    const next = [...slots];
    next[nearest] = face;
    return { slots: next, index: nearest, replaced: true };
  }
  return { slots: [...slots, face], index: slots.length, replaced: false };
}
