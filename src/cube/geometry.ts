// The single source of truth for where every sticker sits in 3D.
// Both the move logic and the 3D view are built on this, so what is animated
// cannot disagree with what is computed.
//
// Axes: +x = Right, +y = Up, +z = Front (towards the person holding the cube).
import { FACES, type Face, type Facelets, type Move } from './types';

export type Vec3 = [number, number, number];

export interface Sticker {
  /** Which small cube the sticker is on; each coordinate is -1, 0 or 1. */
  pos: Vec3;
  /** Which way the sticker faces. */
  normal: Vec3;
}

const NORMALS: Record<Face, Vec3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/** Position of the sticker at row r, column c (0..2) of a face, read as seen from outside. */
function positionOn(face: Face, r: number, c: number): Vec3 {
  switch (face) {
    case 'U':
      return [c - 1, 1, r - 1];
    case 'R':
      return [1, 1 - r, 1 - c];
    case 'F':
      return [c - 1, 1 - r, 1];
    case 'D':
      return [c - 1, -1, 1 - r];
    case 'L':
      return [-1, 1 - r, c - 1];
    case 'B':
      return [1 - c, 1 - r, -1];
  }
}

/** All 54 stickers; the array index is the facelet index in a Facelets string. */
export const STICKERS: readonly Sticker[] = FACES.flatMap((face) =>
  Array.from({ length: 9 }, (_, i) => ({
    pos: positionOn(face, Math.floor(i / 3), i % 3),
    normal: [...NORMALS[face]] as Vec3,
  })),
);

const key = (pos: Vec3, normal: Vec3): string => `${pos[0]},${pos[1]},${pos[2]}|${normal[0]},${normal[1]},${normal[2]}`;

const INDEX_BY_PLACE = new Map<string, number>(STICKERS.map((s, i) => [key(s.pos, s.normal), i]));

/** Which slab of the cube a face turn moves: the axis (0 = x, 1 = y, 2 = z) and which side of it. */
export function layer(face: Face): { axis: 0 | 1 | 2; coord: -1 | 1 } {
  const n = NORMALS[face];
  const axis = n.findIndex((v) => v !== 0) as 0 | 1 | 2;
  return { axis, coord: n[axis] as -1 | 1 };
}

/**
 * The rotation, in radians about the positive axis, of ONE clockwise quarter
 * turn of a face. Clockwise as seen from outside is -90 degrees about the
 * face's outward normal (right-hand rule).
 */
export function quarterTurnAngle(face: Face): number {
  return (-layer(face).coord * Math.PI) / 2;
}

/**
 * The rotation to draw for a whole move, in radians about the positive axis.
 * An anticlockwise turn is one quarter turn the other way, not three clockwise.
 */
export function turnAngle(m: Move): number {
  return quarterTurnAngle(m.face) * (m.turns === 3 ? -1 : m.turns);
}

/** Rotate a vector by +90 degrees (sign = 1) or -90 degrees (sign = -1) about the positive axis. */
function rotateQuarter(v: Vec3, axis: 0 | 1 | 2, sign: 1 | -1): Vec3 {
  const [x, y, z] = v;
  let out: Vec3;
  if (axis === 0) out = [x, -sign * z, sign * y];
  else if (axis === 1) out = [sign * z, y, -sign * x];
  else out = [-sign * y, sign * x, z];
  // Avoid negative zero so lookups by string key are stable.
  return out.map((n) => n + 0) as Vec3;
}

const moveCache = new Map<string, number[]>();

/** For a move, where each facelet index ends up. */
function destinations(m: Move): number[] {
  const cacheKey = `${m.face}${m.turns}`;
  const cached = moveCache.get(cacheKey);
  if (cached) return cached;

  const { axis, coord } = layer(m.face);
  const sign: 1 | -1 = quarterTurnAngle(m.face) > 0 ? 1 : -1;
  const dest = STICKERS.map((s, i) => {
    if (s.pos[axis] !== coord) return i;
    let pos = s.pos;
    let normal = s.normal;
    for (let t = 0; t < m.turns; t++) {
      pos = rotateQuarter(pos, axis, sign);
      normal = rotateQuarter(normal, axis, sign);
    }
    const index = INDEX_BY_PLACE.get(key(pos, normal));
    if (index === undefined) throw new Error('Rotated sticker left the cube');
    return index;
  });
  moveCache.set(cacheKey, dest);
  return dest;
}

export function applyMove(f: Facelets, m: Move): Facelets {
  const dest = destinations(m);
  const out = new Array<string>(54);
  for (let i = 0; i < 54; i++) out[dest[i]] = f[i];
  return out.join('');
}

export function applyMoves(f: Facelets, ms: Move[]): Facelets {
  return ms.reduce(applyMove, f);
}
