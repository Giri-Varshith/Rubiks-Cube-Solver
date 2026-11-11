// Promise-based access to the solver worker, with a time limit so the app can
// never be left waiting forever.
import { CONFIG } from '../config';
import type { Facelets, Move } from '../cube/types';
import type { SolverReply, SolverRequest } from './solver.worker';

/** The parts of a Worker this client uses (so tests can supply a stand-in). */
export interface WorkerLike {
  postMessage(message: SolverRequest): void;
  terminate(): void;
  onmessage: ((event: { data: SolverReply }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}

export interface SolverClient {
  /** Start the worker (once) and resolve when its tables are built. */
  init(): Promise<void>;
  /** Solve a cube. Rejects if the worker fails or takes longer than the time limit. */
  solve(facelets: Facelets): Promise<Move[]>;
}

export function createSolverClient(makeWorker: () => WorkerLike, timeoutMs: number): SolverClient {
  let worker: WorkerLike | null = null;
  let ready: Promise<void> | null = null;
  let rejectReady: ((error: Error) => void) | null = null;
  let nextId = 1;
  const waiting = new Map<
    number,
    { resolve(moves: Move[]): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
  >();

  /** Stop the worker and fail everything that was waiting on it. The next call starts a fresh one. */
  function shutDown(error: Error): void {
    worker?.terminate();
    worker = null;
    ready = null;
    rejectReady?.(error);
    rejectReady = null;
    for (const entry of waiting.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    waiting.clear();
  }

  function init(): Promise<void> {
    if (ready) return ready;
    const started = makeWorker();
    worker = started;
    ready = new Promise<void>((resolve, reject) => {
      rejectReady = reject;
      started.onmessage = (event) => {
        if (worker !== started) return;
        const reply = event.data;
        if ('ready' in reply) {
          rejectReady = null;
          resolve();
          return;
        }
        const entry = waiting.get(reply.id);
        if (!entry) return;
        waiting.delete(reply.id);
        clearTimeout(entry.timer);
        if ('error' in reply) entry.reject(new Error(reply.error));
        else entry.resolve(reply.moves);
      };
      started.onerror = (event) => {
        if (worker !== started) return;
        shutDown(new Error(event.message || 'The solver could not be started'));
      };
    });
    // Callers that only use solve() never look at this promise; do not let its failure go unhandled.
    ready.catch(() => undefined);
    return ready;
  }

  function solve(facelets: Facelets): Promise<Move[]> {
    return new Promise<Move[]>((resolve, reject) => {
      const id = nextId++;
      // The limit covers starting the worker as well as the search itself.
      const timer = setTimeout(() => shutDown(new Error('The solver took too long')), timeoutMs);
      waiting.set(id, { resolve, reject, timer });
      init().then(
        () => {
          if (waiting.has(id)) worker?.postMessage({ id, facelets });
        },
        () => undefined, // shutDown has already rejected this request
      );
    });
  }

  return { init, solve };
}

const client = createSolverClient(
  () => new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
  CONFIG.solveTimeoutMs,
);

export const initSolver = client.init;
export const solve = client.solve;
