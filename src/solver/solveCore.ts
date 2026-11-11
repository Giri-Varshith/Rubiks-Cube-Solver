// The only file that talks to the solver library (Kociemba two-phase, vendored cubejs).
import { applyMoves } from '../cube/geometry';
import { parseMoves } from '../cube/moves';
import { findShortSolution } from '../cube/shortSolve';
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

// How long a solution the library may return. 22 is its normal setting and
// answers in milliseconds; 24 is a fallback that should never be needed.
// (The library throws when it finds nothing within the given length.)
// Do NOT try small values here to get short answers: on some cubes, such as
// one that is only top and bottom turns from solved, the library takes many
// seconds or longer to give up. Short answers come from findShortSolution.
const LIBRARY_DEPTHS = [22, 24];

function librarySearch(f: Facelets): string | null {
  for (const depth of LIBRARY_DEPTHS) {
    try {
      const answer = Cube.fromString(f).solve(depth);
      if (typeof answer === 'string' && answer.trim().length > 0) return answer;
    } catch {
      // Nothing within this length; try the next.
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

  // Within six moves of solved: the exact shortest answer, found directly.
  let moves = findShortSolution(f);
  if (moves === null) {
    initTables();
    const answer = librarySearch(f);
    if (answer == null) throw new Error('No solution was found');
    moves = parseMoves(answer);
  }
  if (applyMoves(f, moves) !== SOLVED) throw new Error('Solution failed its self-check');
  return moves;
}
