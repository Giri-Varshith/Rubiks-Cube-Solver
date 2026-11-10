// Promise-based access to the solver worker.
import type { Facelets, Move } from '../cube/types';
import type { SolverReply, SolverRequest } from './solver.worker';

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve(moves: Move[]): void; reject(error: Error): void }>();

/** Start the worker (once) and resolve when its tables are built. */
export function initSolver(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<SolverReply>) => {
      const reply = event.data;
      if ('ready' in reply) {
        resolve();
        return;
      }
      const entry = waiting.get(reply.id);
      if (!entry) return;
      waiting.delete(reply.id);
      if ('error' in reply) entry.reject(new Error(reply.error));
      else entry.resolve(reply.moves);
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'The solver could not be started');
      reject(error);
      for (const entry of waiting.values()) entry.reject(error);
      waiting.clear();
      ready = null;
      worker = null;
    };
  });
  return ready;
}

export async function solve(facelets: Facelets): Promise<Move[]> {
  await initSolver();
  return new Promise<Move[]>((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    const request: SolverRequest = { id, facelets };
    worker!.postMessage(request);
  });
}
