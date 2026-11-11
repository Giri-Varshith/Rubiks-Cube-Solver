// An exact search for short solutions (up to six moves).
//
// The main solver is built for scrambled cubes and can give a long answer, or
// take a very long time, on a cube that is only a few turns from solved. That
// is exactly the cube someone has when they re-scan near the end. So short
// cases are handled here first, by meeting in the middle: every cube within
// three moves of solved is remembered once, and the cube in hand is searched
// three moves deep to see if it reaches one of them.
import { applyMove } from './geometry';
import { invertMove } from './moves';
import { FACES, SOLVED, type Facelets, type Move } from './types';

const HALF_DEPTH = 3;

const ALL_MOVES: Move[] = FACES.flatMap((face) => ([1, 2, 3] as const).map((turns) => ({ face, turns })));

/** For every cube within HALF_DEPTH moves of solved: the shortest moves that solve it. */
let nearSolved: Map<Facelets, Move[]> | null = null;

function buildNearSolved(): Map<Facelets, Move[]> {
  const table = new Map<Facelets, Move[]>([[SOLVED, []]]);
  let frontier: { state: Facelets; path: Move[] }[] = [{ state: SOLVED, path: [] }];
  for (let depth = 0; depth < HALF_DEPTH; depth++) {
    const next: { state: Facelets; path: Move[] }[] = [];
    for (const { state, path } of frontier) {
      for (const move of ALL_MOVES) {
        // Two turns of the same face in a row are one turn; skip them.
        if (path.length > 0 && path[path.length - 1].face === move.face) continue;
        const reached = applyMove(state, move);
        if (table.has(reached)) continue;
        const reachedPath = [...path, move];
        // To solve `reached`, undo the path backwards.
        table.set(reached, [...reachedPath].reverse().map(invertMove));
        next.push({ state: reached, path: reachedPath });
      }
    }
    frontier = next;
  }
  return table;
}

/**
 * The shortest solution if the cube is within six moves of solved, otherwise
 * null. Does not check that the cube is a possible one.
 */
export function findShortSolution(f: Facelets): Move[] | null {
  nearSolved ??= buildNearSolved();
  let best: Move[] | null = null;

  const consider = (state: Facelets, path: Move[]): void => {
    const rest = nearSolved!.get(state);
    if (rest && (best === null || path.length + rest.length < best.length)) best = [...path, ...rest];
  };

  let frontier: { state: Facelets; path: Move[] }[] = [{ state: f, path: [] }];
  consider(f, []);
  for (let depth = 0; depth < HALF_DEPTH; depth++) {
    // Nothing deeper can beat an answer already this short.
    if (best !== null && (best as Move[]).length <= depth + 1) break;
    const next: { state: Facelets; path: Move[] }[] = [];
    for (const { state, path } of frontier) {
      for (const move of ALL_MOVES) {
        if (path.length > 0 && path[path.length - 1].face === move.face) continue;
        const reached = applyMove(state, move);
        const reachedPath = [...path, move];
        consider(reached, reachedPath);
        next.push({ state: reached, path: reachedPath });
      }
    }
    frontier = next;
  }
  return best;
}
