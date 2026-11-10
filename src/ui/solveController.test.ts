import { describe, expect, test } from 'vitest';
import { applyMoves } from '../cube/geometry';
import { invertMove, parseMoves } from '../cube/moves';
import { SOLVED } from '../cube/types';
import { SolveController } from './solveController';

const solution = parseMoves("B' D' L2 F U' R'");
const scrambled = applyMoves(SOLVED, parseMoves("R U F' L2 D B"));

const fresh = () => new SolveController(scrambled, solution);

/** Do one step and let its animation finish. */
function step(c: SolveController, what: 'next' | 'back'): void {
  expect(c[what]()).not.toBeNull();
  c.settle();
}

describe('SolveController', () => {
  test('starts at the scanned cube with no moves done', () => {
    const c = fresh();
    expect(c.index).toBe(0);
    expect(c.state).toBe(scrambled);
    expect(c.done).toBe(false);
    expect(c.busy).toBe(false);
  });

  test('stepping through every move ends on the solved cube', () => {
    const c = fresh();
    for (const move of solution) {
      expect(c.next()).toEqual(move);
      c.settle();
    }
    expect(c.state).toBe(SOLVED);
    expect(c.index).toBe(solution.length);
    expect(c.done).toBe(true);
    expect(c.next()).toBeNull();
  });

  test('back hands over the opposite of the last move and restores the cube before it', () => {
    const c = fresh();
    step(c, 'next');
    step(c, 'next');
    const afterOne = applyMoves(scrambled, [solution[0]]);
    expect(c.back()).toEqual(invertMove(solution[1]));
    c.settle();
    expect(c.index).toBe(1);
    expect(c.state).toBe(afterOne);
  });

  test('replay rewinds one move and plays it again without changing the position', () => {
    const c = fresh();
    step(c, 'next');
    step(c, 'next');
    step(c, 'next');
    const replay = c.replay();
    expect(replay).toEqual({ rewind: applyMoves(scrambled, solution.slice(0, 2)), move: solution[2] });
    c.settle();
    expect(c.index).toBe(3);
    expect(c.state).toBe(applyMoves(scrambled, solution.slice(0, 3)));
  });

  test('at the start there is nothing to go back to or replay', () => {
    const c = fresh();
    expect(c.back()).toBeNull();
    expect(c.replay()).toBeNull();
    expect(c.busy).toBe(false);
  });

  test('pressing Next again while a move is still animating is ignored', () => {
    const c = fresh();
    expect(c.next()).toEqual(solution[0]);
    expect(c.busy).toBe(true);
    expect(c.next()).toBeNull();
    expect(c.next()).toBeNull();
    expect(c.index).toBe(1);
    c.settle();
    expect(c.next()).toEqual(solution[1]);
    expect(c.index).toBe(2);
  });

  test('Back, Replay and Next cannot interrupt each other mid-animation', () => {
    const c = fresh();
    step(c, 'next');
    step(c, 'next');
    expect(c.back()).not.toBeNull();
    expect(c.next()).toBeNull();
    expect(c.back()).toBeNull();
    expect(c.replay()).toBeNull();
    expect(c.index).toBe(1);
    c.settle();
    expect(c.replay()).not.toBeNull();
    expect(c.next()).toBeNull();
    expect(c.back()).toBeNull();
    expect(c.index).toBe(1);
  });

  test('an already solved cube is done straight away', () => {
    const c = new SolveController(SOLVED, []);
    expect(c.done).toBe(true);
    expect(c.next()).toBeNull();
  });

  test('the current move is the one about to be done', () => {
    const c = fresh();
    expect(c.current).toEqual(solution[0]);
    step(c, 'next');
    expect(c.current).toEqual(solution[1]);
    for (let i = 1; i < solution.length; i++) step(c, 'next');
    expect(c.current).toBeNull();
  });
});

describe('SolveController.last', () => {
  test('is the move just done, and nothing at the start', () => {
    const c = fresh();
    expect(c.last).toBeNull();
    step(c, 'next');
    expect(c.last).toEqual(solution[0]);
    step(c, 'next');
    step(c, 'back');
    expect(c.last).toEqual(solution[0]);
  });
});
