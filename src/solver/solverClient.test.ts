import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SOLVED, type Move } from '../cube/types';
import type { SolverReply, SolverRequest } from './solver.worker';
import { createSolverClient, type WorkerLike } from './solverClient';

/** A stand-in for the real worker that the test drives by hand. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: SolverReply }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  posted: SolverRequest[] = [];
  terminated = false;
  postMessage(message: SolverRequest): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(message: SolverReply): void {
    this.onmessage?.({ data: message });
  }
}

const MOVES: Move[] = [{ face: 'R', turns: 1 }];

function setup(timeoutMs = 1000) {
  const workers: FakeWorker[] = [];
  const client = createSolverClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  }, timeoutMs);
  return { client, workers };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('solver client', () => {
  test('starts one worker and is ready when the worker says so', async () => {
    const { client, workers } = setup();
    const ready = client.init();
    void client.init();
    expect(workers).toHaveLength(1);
    workers[0].reply({ ready: true });
    await expect(ready).resolves.toBeUndefined();
  });

  test('passes the cube to the worker and returns its moves', async () => {
    const { client, workers } = setup();
    const answer = client.solve(SOLVED);
    workers[0].reply({ ready: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(workers[0].posted).toHaveLength(1);
    expect(workers[0].posted[0].facelets).toBe(SOLVED);
    workers[0].reply({ id: workers[0].posted[0].id, moves: MOVES });
    await expect(answer).resolves.toEqual(MOVES);
  });

  test("rejects with the worker's message when solving fails", async () => {
    const { client, workers } = setup();
    const answer = client.solve(SOLVED);
    workers[0].reply({ ready: true });
    await vi.advanceTimersByTimeAsync(0);
    workers[0].reply({ id: workers[0].posted[0].id, error: 'not possible' });
    await expect(answer).rejects.toThrow('not possible');
  });

  test('gives up, stops the worker and says so when an answer takes too long', async () => {
    const { client, workers } = setup(1000);
    const answer = client.solve(SOLVED);
    const outcome = expect(answer).rejects.toThrow('took too long');
    workers[0].reply({ ready: true });
    await vi.advanceTimersByTimeAsync(1001);
    await outcome;
    expect(workers[0].terminated).toBe(true);
  });

  test('after giving up, the next request starts a fresh worker and works', async () => {
    const { client, workers } = setup(1000);
    const first = client.solve(SOLVED);
    const firstOutcome = expect(first).rejects.toThrow();
    workers[0].reply({ ready: true });
    await vi.advanceTimersByTimeAsync(1001);
    await firstOutcome;

    const second = client.solve(SOLVED);
    expect(workers).toHaveLength(2);
    workers[1].reply({ ready: true });
    await vi.advanceTimersByTimeAsync(0);
    workers[1].reply({ id: workers[1].posted[0].id, moves: MOVES });
    await expect(second).resolves.toEqual(MOVES);
  });

  test('an answer that arrives in time is not cut off later', async () => {
    const { client, workers } = setup(1000);
    const answer = client.solve(SOLVED);
    workers[0].reply({ ready: true });
    await vi.advanceTimersByTimeAsync(500);
    workers[0].reply({ id: workers[0].posted[0].id, moves: MOVES });
    await expect(answer).resolves.toEqual(MOVES);
    await vi.advanceTimersByTimeAsync(5000);
    expect(workers[0].terminated).toBe(false);
  });

  test('a worker that never becomes ready is given up on too', async () => {
    const { client, workers } = setup(1000);
    const answer = client.solve(SOLVED);
    const outcome = expect(answer).rejects.toThrow('took too long');
    await vi.advanceTimersByTimeAsync(1001);
    await outcome;
    expect(workers[0].terminated).toBe(true);
  });

  test('a worker that crashes rejects what was waiting and can be restarted', async () => {
    const { client, workers } = setup();
    const answer = client.solve(SOLVED);
    const outcome = expect(answer).rejects.toThrow('boom');
    workers[0].onerror?.({ message: 'boom' });
    await outcome;
    void client.init();
    expect(workers).toHaveLength(2);
  });
});
