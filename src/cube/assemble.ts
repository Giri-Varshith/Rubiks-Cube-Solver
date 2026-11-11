// Fit six scanned faces together into one cube.
//
// The camera sees each face from outside, but turned by some unknown number
// of quarter turns. The centre colour says which face it is. There are only
// 4^6 = 4096 ways the six faces could be turned, so every one is tried and the
// arrangement that forms a physically possible cube is kept.
import { COLOR_TO_FACE, FACES, type Face, type FaceReading, type Facelets } from './types';
import { quickCheck, validate, type Problem } from './validate';

/** For a clockwise quarter turn: new cell j shows old cell QUARTER[j]. */
const QUARTER = [6, 3, 0, 7, 4, 1, 8, 5, 2];

/** SOURCE[k][j]: after k clockwise quarter turns, cell j shows original cell SOURCE[k][j]. */
const SOURCE: number[][] = [[0, 1, 2, 3, 4, 5, 6, 7, 8]];
for (let k = 1; k < 4; k++) SOURCE.push(QUARTER.map((j) => SOURCE[k - 1][j]));

/** Turn a 3x3 grid clockwise (as the viewer sees it) by a number of quarter turns. */
export function rotateReading<T>(cells: T[], quarterTurns: number): T[] {
  const k = ((quarterTurns % 4) + 4) % 4;
  return SOURCE[k].map((from) => cells[from]);
}

export interface Assembly {
  /** Every distinct physically possible cube the faces can form. Normally exactly one. */
  candidates: Facelets[];
  /** candidates[0] if there is one, otherwise the arrangement with the most real pieces. */
  bestGuess: Facelets;
  /** Clockwise quarter turns applied to each scanned face to make bestGuess. */
  rotations: Record<Face, number>;
  /** Why bestGuess is not a possible cube. Empty when candidates is not. */
  problems: Problem[];
}

export function assemble(readings: FaceReading[]): Assembly {
  if (readings.length !== 6 || readings.some((r) => r.length !== 9)) {
    throw new Error('Assembling a cube needs six faces of nine squares each');
  }
  const byFace = new Map<Face, FaceReading>();
  for (const reading of readings) {
    const face = COLOR_TO_FACE[reading[4]];
    if (!face || byFace.has(face)) throw new Error('The six faces must have six different centre colours');
    byFace.set(face, reading);
  }

  // blocks[f][k] = the nine face letters of face f after k quarter turns.
  const blocks = FACES.map((face) => {
    const letters = byFace.get(face)!.map((colour) => COLOR_TO_FACE[colour]);
    return [0, 1, 2, 3].map((k) => rotateReading(letters, k).join(''));
  });

  const candidates = new Set<Facelets>();
  let bestScore = -1;
  let best: { facelets: Facelets; turns: number[] } | null = null;
  let firstValid: { facelets: Facelets; turns: number[] } | null = null;

  for (let code = 0; code < 4096; code++) {
    const turns = [code & 3, (code >> 2) & 3, (code >> 4) & 3, (code >> 6) & 3, (code >> 8) & 3, (code >> 10) & 3];
    const facelets =
      blocks[0][turns[0]] + blocks[1][turns[1]] + blocks[2][turns[2]] + blocks[3][turns[3]] + blocks[4][turns[4]] + blocks[5][turns[5]];
    const { valid, correctPieces } = quickCheck(facelets);
    if (valid) {
      candidates.add(facelets);
      firstValid ??= { facelets, turns };
    } else if (correctPieces > bestScore) {
      bestScore = correctPieces;
      best = { facelets, turns };
    }
  }

  const chosen = firstValid ?? best!;
  const rotations = Object.fromEntries(FACES.map((face, i) => [face, chosen.turns[i]])) as Record<Face, number>;
  return {
    candidates: [...candidates],
    bestGuess: chosen.facelets,
    rotations,
    problems: firstValid ? [] : validate(chosen.facelets).problems,
  };
}

/** Which scanned square (face and cell 0..8, as the camera saw it) a facelet of the assembled cube came from. */
export function faceletToCell(index: number, rotations: Record<Face, number>): { face: Face; cell: number } {
  const face = FACES[Math.floor(index / 9)];
  const k = ((rotations[face] % 4) + 4) % 4;
  return { face, cell: SOURCE[k][index % 9] };
}

const ALL_PAIRS: [number, number][] = [];
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) ALL_PAIRS.push([a, b]);

/**
 * Assemble the faces, and if they do not fit together, see whether swapping
 * the centre colours of two faces makes them fit.
 *
 * Why: when one centre square is read as another face's colour (a logo printed
 * on it, or glare), colour alone cannot say which of the two look-alike
 * centres is the real one, and the two faces can end up with each other's
 * names. Only a right naming forms a possible cube, so the pieces settle it.
 *
 * More than one swap can work (swapping a different pair of opposite faces
 * also gives a possible, but different, cube). So pairs are tried in the order
 * given, most likely mix-up first, and the first that works is used. Pass the
 * pairs ordered by how alike the two centre readings looked.
 */
export function repairCentres(
  readings: FaceReading[],
  pairsToTry: [number, number][] = ALL_PAIRS,
): { readings: FaceReading[]; assembly: Assembly } {
  const assembly = assemble(readings);
  if (assembly.candidates.length > 0) return { readings, assembly };

  for (const [a, b] of pairsToTry) {
    const swapped = readings.map((reading) => [...reading]);
    [swapped[a][4], swapped[b][4]] = [swapped[b][4], swapped[a][4]];
    const attempt = assemble(swapped);
    if (attempt.candidates.length > 0) return { readings: swapped, assembly: attempt };
  }
  return { readings, assembly };
}
