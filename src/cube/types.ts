// Shared cube vocabulary. No logic lives here.

/** Sticker colours: White, Yellow, Red, Orange, Blue, Green. */
export type Color = 'W' | 'Y' | 'R' | 'O' | 'B' | 'G';

/** Faces: Up, Right, Front, Down, Left, Back. */
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

/** Face order used everywhere a cube is written as a string. */
export const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export const COLORS: readonly Color[] = ['W', 'Y', 'R', 'O', 'B', 'G'];

/** Standard colour scheme: which face each centre colour marks. */
export const COLOR_TO_FACE: Record<Color, Face> = { W: 'U', Y: 'D', G: 'F', B: 'B', R: 'R', O: 'L' };

export const FACE_TO_COLOR: Record<Face, Color> = { U: 'W', D: 'Y', F: 'G', B: 'B', R: 'R', L: 'O' };

export const COLOR_HEX: Record<Color, string> = {
  W: '#f4f4f4',
  Y: '#ffd500',
  R: '#c41e3a',
  O: '#ff6f00',
  B: '#0051ba',
  G: '#009e60',
};

export const COLOR_NAME: Record<Color, string> = {
  W: 'white',
  Y: 'yellow',
  R: 'red',
  O: 'orange',
  B: 'blue',
  G: 'green',
};

/**
 * A whole cube as 54 face letters: U, R, F, D, L, B blocks of nine, each
 * block row by row as seen from outside (U with B at the top, D with F at the
 * top, side faces with U at the top).
 */
export type Facelets = string;

export const SOLVED: Facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** One turn of one face: 1 = quarter turn clockwise, 2 = half turn, 3 = quarter turn anticlockwise. */
export interface Move {
  face: Face;
  turns: 1 | 2 | 3;
}

/** Nine colours of one face, row by row, as the camera saw it. */
export type FaceReading = Color[];
