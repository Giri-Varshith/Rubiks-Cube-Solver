// Reading, writing and describing moves.
import type { Face, Move } from './types';

const MOVE_PATTERN = /^([URFDLB])([2']?)$/;

/** Parse a solution such as "R U2 F'". An empty string is no moves. */
export function parseMoves(s: string): Move[] {
  return s
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const match = MOVE_PATTERN.exec(token);
      if (!match) throw new Error(`Not a cube move: "${token}"`);
      const turns = match[2] === '2' ? 2 : match[2] === "'" ? 3 : 1;
      return { face: match[1] as Face, turns };
    });
}

export function formatMove(m: Move): string {
  return m.face + (m.turns === 2 ? '2' : m.turns === 3 ? "'" : '');
}

export function invertMove(m: Move): Move {
  return { face: m.face, turns: (4 - m.turns) as 1 | 2 | 3 };
}

// Written for someone holding the cube white-up, green-front, who does not
// know notation. [what to turn, clockwise quarter turn, anticlockwise quarter turn]
const WORDS: Record<Face, [string, string, string]> = {
  R: ['Right side', 'up, away from you', 'down, towards you'],
  L: ['Left side', 'down, towards you', 'up, away from you'],
  U: ['Top layer', 'to the left', 'to the right'],
  D: ['Bottom layer', 'to the right', 'to the left'],
  F: ['Front face', 'clockwise', 'anticlockwise'],
  B: ['Back face', 'anticlockwise as you look from the front', 'clockwise as you look from the front'],
};

export function describeMove(m: Move): string {
  const [part, clockwise, anticlockwise] = WORDS[m.face];
  const how = m.turns === 2 ? 'halfway round' : m.turns === 1 ? clockwise : anticlockwise;
  return `${part}: turn it ${how}`;
}
