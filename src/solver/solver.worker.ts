// Runs the solver off the main thread so the page never freezes.
import type { Facelets, Move } from '../cube/types';
import { initTables, solveFacelets } from './solveCore';

export type SolverRequest = { id: number; facelets: Facelets };
export type SolverReply = { ready: true } | { id: number; moves: Move[] } | { id: number; error: string };

const scope = self as unknown as {
  postMessage(message: SolverReply): void;
  onmessage: ((event: MessageEvent<SolverRequest>) => void) | null;
};

scope.onmessage = (event) => {
  const { id, facelets } = event.data;
  try {
    scope.postMessage({ id, moves: solveFacelets(facelets) });
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

initTables();
scope.postMessage({ ready: true });
