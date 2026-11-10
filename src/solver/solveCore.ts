// The only file that talks to the solver library (Kociemba two-phase, vendored cubejs).
import { applyMoves } from '../cube/geometry';
import { parseMoves } from '../cube/moves';
import { SOLVED, type Facelets, type Move } from '../cube/types';
import { validate } from '../cube/validate';
import Cube from '../vendor/cubejs/index.js';

let tablesReady = false;

/** Build the solver's lookup tables. Takes a second or two; safe to call more than once. */
export function initTables(): void {
  if (tablesReady) return;
  Cube.initSolver();
  tablesReady = true;
}

// Search depths to try, in order. The library looks for a solution of at most
// the given length, and throws when there is none. Shallow depths are tried
// first so a cube that is only a few turns from solved gets a few moves, not
// twenty; they fail within milliseconds. 22 always succeeds in practice.
const DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 22, 24, 30];

function search(f: Facelets): string | null {
  for (const depth of DEPTHS) {
    try {
      const answer = Cube.fromString(f).solve(depth);
      if (typeof answer === 'string' && answer.trim().length > 0) return answer;
    } catch {
      // Nothing that short; try a deeper search.
    }
  }
  return null;
}

/**
 * Moves that solve the cube. The answer is checked before it is returned:
 * applying the moves to the cube must give the solved cube, so wrong
 * instructions can never reach the screen.
 */
export function solveFacelets(f: Facelets): Move[] {
  // The solver library can search forever on an impossible cube, so never hand it one.
  if (!validate(f).valid) throw new Error('This cube is not physically possible, so it cannot be solved');
  if (f === SOLVED) return [];

  initTables();
  const answer = search(f);
  if (answer == null) throw new Error('No solution was found');

  const moves = parseMoves(answer);
  if (applyMoves(f, moves) !== SOLVED) throw new Error('Solution failed its self-check');
  return moves;
}
