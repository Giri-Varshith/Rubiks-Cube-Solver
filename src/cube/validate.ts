// Is a 54-sticker cube physically possible, and if not, why not (in plain words)?
import { STICKERS, type Vec3 } from './geometry';
import { COLOR_NAME, FACES, FACE_TO_COLOR, type Face, type Facelets } from './types';

export type ProblemKind =
  | 'count'
  | 'badEdge'
  | 'duplicateEdge'
  | 'badCorner'
  | 'duplicateCorner'
  | 'flip'
  | 'twist'
  | 'parity';

export interface Problem {
  kind: ProblemKind;
  /** Plain-language explanation for the person using the app. */
  message: string;
  /** Facelet indices worth highlighting. */
  facelets: number[];
}

export interface Validation {
  valid: boolean;
  problems: Problem[];
  /** How many different real pieces were found, 0..20. Used to pick a best guess. */
  correctPieces: number;
}

const OPPOSITE: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

const letterAt = (index: number): Face => FACES[Math.floor(index / 9)];
const isUpDown = (letter: string): boolean => letter === 'U' || letter === 'D';
const isFrontBack = (letter: string): boolean => letter === 'F' || letter === 'B';
const sortLetters = (letters: string[]): string => [...letters].sort().join('');

interface Slot {
  /**
   * The slot's facelet indices. Edges: the reference facelet first (the one on
   * the top/bottom face, else the one on the front/back face). Corners: the
   * top/bottom facelet first, then clockwise as seen from outside.
   */
  facelets: number[];
  /** The slot's own letters in facelet order, e.g. "URF". */
  home: string;
  /** Sorted letters: the identity of the piece that belongs here. */
  id: string;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function buildSlots(): { edges: Slot[]; corners: Slot[] } {
  const byCubie = new Map<string, number[]>();
  STICKERS.forEach((s, i) => {
    const k = s.pos.join(',');
    byCubie.set(k, [...(byCubie.get(k) ?? []), i]);
  });

  const edges: Slot[] = [];
  const corners: Slot[] = [];
  for (const indices of byCubie.values()) {
    if (indices.length === 2) {
      const first = indices.find((i) => isUpDown(letterAt(i))) ?? indices.find((i) => isFrontBack(letterAt(i)))!;
      const second = indices.find((i) => i !== first)!;
      const facelets = [first, second];
      edges.push({ facelets, home: facelets.map(letterAt).join(''), id: sortLetters(facelets.map(letterAt)) });
    } else if (indices.length === 3) {
      const first = indices.find((i) => isUpDown(letterAt(i)))!;
      const [p, q] = indices.filter((i) => i !== first);
      // (a, b, c) runs clockwise seen from outside exactly when (a x b) . c < 0.
      const clockwise = dot(cross(STICKERS[first].normal, STICKERS[p].normal), STICKERS[q].normal) < 0;
      const facelets = clockwise ? [first, p, q] : [first, q, p];
      corners.push({ facelets, home: facelets.map(letterAt).join(''), id: sortLetters(facelets.map(letterAt)) });
    }
  }
  return { edges, corners };
}

const { edges: EDGE_SLOTS, corners: CORNER_SLOTS } = buildSlots();
const EDGE_HOME = new Map(EDGE_SLOTS.map((s, i) => [s.id, i]));
const CORNER_HOME = new Map(CORNER_SLOTS.map((s, i) => [s.id, i]));

export const EDGE_FACELETS: readonly number[] = EDGE_SLOTS.flatMap((s) => s.facelets);
export const CORNER_FACELETS: readonly number[] = CORNER_SLOTS.flatMap((s) => s.facelets);

interface PieceReading {
  /** Letters on the slot's facelets, in slot order. */
  letters: string;
  /** Sorted letters. */
  id: string;
  /** Home slot index, or -1 if no such piece exists. */
  home: number;
  /** A corner with three colours that do belong together, but running the wrong way round. */
  mirrored?: boolean;
}

function readEdge(f: Facelets, slot: Slot): PieceReading {
  const a = f[slot.facelets[0]];
  const b = f[slot.facelets[1]];
  const id = a < b ? a + b : b + a;
  const real = a !== b && OPPOSITE[a] !== b;
  return { letters: a + b, id, home: real ? (EDGE_HOME.get(id) ?? -1) : -1 };
}

function readCorner(f: Facelets, slot: Slot): PieceReading {
  const letters = f[slot.facelets[0]] + f[slot.facelets[1]] + f[slot.facelets[2]];
  const id = sortLetters(letters.split(''));
  const home = CORNER_HOME.get(id) ?? -1;
  if (home < 0) return { letters, id, home: -1 };
  // Same three colours but running the other way round is a mirror image, not a real piece.
  const homeLetters = CORNER_SLOTS[home].home;
  const sameHandedness = (homeLetters + homeLetters).includes(letters);
  return sameHandedness ? { letters, id, home } : { letters, id, home: -1, mirrored: true };
}

/** True when the permutation (slot -> home slot) is odd. */
function isOdd(perm: number[]): boolean {
  const seen = new Array<boolean>(perm.length).fill(false);
  let swaps = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let length = 0;
    for (let j = i; !seen[j]; j = perm[j]) {
      seen[j] = true;
      length++;
    }
    swaps += length - 1;
  }
  return swaps % 2 === 1;
}

interface Analysis {
  counts: Record<string, number>;
  countsOk: boolean;
  edges: PieceReading[];
  corners: PieceReading[];
  correctPieces: number;
  allPiecesOk: boolean;
  flipOk: boolean;
  twistOk: boolean;
  parityOk: boolean;
}

function analyse(f: Facelets): Analysis {
  const counts: Record<string, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (let i = 0; i < 54; i++) counts[f[i]] = (counts[f[i]] ?? 0) + 1;
  const countsOk = FACES.every((face) => counts[face] === 9) && Object.keys(counts).length === 6;

  const edges = EDGE_SLOTS.map((slot) => readEdge(f, slot));
  const corners = CORNER_SLOTS.map((slot) => readCorner(f, slot));
  const edgeIds = new Set(edges.filter((e) => e.home >= 0).map((e) => e.id));
  const cornerIds = new Set(corners.filter((c) => c.home >= 0).map((c) => c.id));
  const correctPieces = edgeIds.size + cornerIds.size;
  const allPiecesOk = correctPieces === 20;

  let flipOk = true;
  let twistOk = true;
  let parityOk = true;
  if (allPiecesOk) {
    let flips = 0;
    for (const e of edges) {
      // Where the piece's leading colour (top/bottom if it has one, else front/back) sits: 0 = on the reference facelet.
      const leadingAt = isUpDown(e.letters[0]) || isUpDown(e.letters[1]) ? (isUpDown(e.letters[0]) ? 0 : 1) : isFrontBack(e.letters[0]) ? 0 : 1;
      flips += leadingAt;
    }
    flipOk = flips % 2 === 0;

    let twists = 0;
    for (const c of corners) twists += [0, 1, 2].find((i) => isUpDown(c.letters[i]))!;
    twistOk = twists % 3 === 0;

    parityOk = isOdd(edges.map((e) => e.home)) === isOdd(corners.map((c) => c.home));
  }

  return { counts, countsOk, edges, corners, correctPieces, allPiecesOk, flipOk, twistOk, parityOk };
}

/** The fast answer, with no messages. Used when trying thousands of arrangements. */
export function quickCheck(f: Facelets): { valid: boolean; correctPieces: number } {
  const a = analyse(f);
  return { valid: a.countsOk && a.allPiecesOk && a.flipOk && a.twistOk && a.parityOk, correctPieces: a.correctPieces };
}

const colourName = (letter: string): string => COLOR_NAME[FACE_TO_COLOR[letter as Face]] ?? 'unknown';
const colourList = (letters: string): string => letters.split('').map(colourName).join('/');

function countProblems(f: Facelets, counts: Record<string, number>): Problem[] {
  const over = Object.keys(counts).filter((k) => counts[k] > 9);
  const under = FACES.filter((k) => (counts[k] ?? 0) < 9);
  return over.map((letter, i) => {
    const other = under[i % Math.max(under.length, 1)] ?? letter;
    const facelets = [...f].flatMap((ch, index) => (ch === letter ? [index] : []));
    return {
      kind: 'count' as const,
      message:
        `There are ${counts[letter]} ${colourName(letter)} squares and ${counts[other] ?? 0} ${colourName(other)} ones. ` +
        `One of the ${colourName(letter)} squares is probably ${colourName(other)}.`,
      facelets,
    };
  });
}

function pieceProblems(slots: Slot[], readings: PieceReading[], what: 'edge' | 'corner'): Problem[] {
  const problems: Problem[] = [];
  const badKind = what === 'edge' ? 'badEdge' : 'badCorner';
  const duplicateKind = what === 'edge' ? 'duplicateEdge' : 'duplicateCorner';

  readings.forEach((reading, i) => {
    if (reading.home >= 0) return;
    problems.push({
      kind: badKind,
      message: reading.mirrored
        ? `A corner piece has the right three colours (${colourList(reading.letters)}) but two of them are the wrong way round. ` +
          'Two squares have probably swapped colours; red and orange are the usual pair.'
        : `A piece has colours that cannot be together (${colourList(reading.letters)}). One of these squares was read wrongly.`,
      facelets: [...slots[i].facelets],
    });
  });

  const slotsById = new Map<string, number[]>();
  readings.forEach((reading, i) => {
    if (reading.home < 0) return;
    slotsById.set(reading.id, [...(slotsById.get(reading.id) ?? []), i]);
  });
  for (const [id, where] of slotsById) {
    if (where.length < 2) continue;
    const homeLetters = slots[(what === 'edge' ? EDGE_HOME : CORNER_HOME).get(id)!].home;
    problems.push({
      kind: duplicateKind,
      message: `Two pieces have the same colours (${colourList(homeLetters)} ${what}). One of these squares was read wrongly.`,
      facelets: where.flatMap((i) => slots[i].facelets),
    });
  }
  return problems;
}

export function validate(f: Facelets): Validation {
  if (f.length !== 54) throw new Error(`A cube has 54 squares, got ${f.length}`);
  const a = analyse(f);
  const problems: Problem[] = [];

  if (!a.countsOk) problems.push(...countProblems(f, a.counts));
  problems.push(...pieceProblems(EDGE_SLOTS, a.edges, 'edge'));
  problems.push(...pieceProblems(CORNER_SLOTS, a.corners, 'corner'));

  if (a.allPiecesOk) {
    if (!a.flipOk) {
      problems.push({
        kind: 'flip',
        message:
          'One edge piece looks flipped. Check the highlighted squares; if they are right, an edge of your cube has been put in backwards and it cannot be solved by normal moves.',
        facelets: [...EDGE_FACELETS],
      });
    }
    if (!a.twistOk) {
      problems.push({
        kind: 'twist',
        message:
          'One corner looks twisted. Check the highlighted squares; if they are right, a corner of your cube has been turned by hand and it cannot be solved by normal moves.',
        facelets: [...CORNER_FACELETS],
      });
    }
    if (!a.parityOk) {
      problems.push({
        kind: 'parity',
        message:
          'Two pieces look swapped. Check the squares; if they are right, your cube has been taken apart and put back differently and it cannot be solved by normal moves.',
        facelets: [],
      });
    }
  }

  return { valid: problems.length === 0, problems, correctPieces: a.correctPieces };
}
