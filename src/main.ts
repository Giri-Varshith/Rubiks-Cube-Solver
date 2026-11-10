// TEMPORARY wiring for building the Solve screen: a fixed scramble, solved by the worker.
import { applyMoves } from './cube/geometry';
import { parseMoves } from './cube/moves';
import { SOLVED } from './cube/types';
import { initSolver, solve } from './solver/solverClient';
import { el } from './ui/dom';
import { mountSolveScreen } from './ui/solveScreen';

const app = document.getElementById('app') as HTMLElement;
app.append(el('h1', {}, "Rubik's Cube Solver"));
const status = el('p', { class: 'status' }, 'Preparing solver…');
app.append(status);

const scrambled = applyMoves(SOLVED, parseMoves("R U F' L2 D B"));
void initSolver()
  .then(() => solve(scrambled))
  .then((moves) => {
    status.remove();
    mountSolveScreen(app, { facelets: scrambled, moves, onRescan: () => location.reload() });
  })
  .catch((err: unknown) => {
    status.textContent = `Solver failed: ${err instanceof Error ? err.message : String(err)}`;
  });
