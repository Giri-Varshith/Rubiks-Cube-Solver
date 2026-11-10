// Keeps track of where the user is in the solution. No drawing happens here.
//
// Every step is animated, and while an animation is running nothing else may
// start (the `busy` flag). That is what keeps the step counter and the 3D cube
// from ever disagreeing, however fast the buttons are pressed.
import { applyMove } from '../cube/geometry';
import { invertMove } from '../cube/moves';
import type { Facelets, Move } from '../cube/types';

export class SolveController {
  readonly moves: Move[];
  /** How many moves have been done, 0..moves.length. */
  index = 0;
  /** The cube after `index` moves. */
  state: Facelets;
  /** True while a step's animation is running. */
  busy = false;

  constructor(start: Facelets, moves: Move[]) {
    this.state = start;
    this.moves = moves;
  }

  get done(): boolean {
    return this.index >= this.moves.length;
  }

  /** The move about to be done, or null at the end. */
  get current(): Move | null {
    return this.moves[this.index] ?? null;
  }

  /** The move just done, or null at the start. */
  get last(): Move | null {
    return this.index > 0 ? this.moves[this.index - 1] : null;
  }

  /** Advance one move. Returns the move to animate, or null if busy or at the end. */
  next(): Move | null {
    if (this.busy || this.done) return null;
    const move = this.moves[this.index];
    this.state = applyMove(this.state, move);
    this.index++;
    this.busy = true;
    return move;
  }

  /** Go back one move. Returns the opposite move to animate, or null if busy or at the start. */
  back(): Move | null {
    if (this.busy || this.index === 0) return null;
    const undo = invertMove(this.moves[this.index - 1]);
    this.state = applyMove(this.state, undo);
    this.index--;
    this.busy = true;
    return undo;
  }

  /** Show the last move again: the cube to rewind to, and the move to animate from there. */
  replay(): { rewind: Facelets; move: Move } | null {
    if (this.busy || this.index === 0) return null;
    const move = this.moves[this.index - 1];
    this.busy = true;
    return { rewind: applyMove(this.state, invertMove(move)), move };
  }

  /** The animation has finished. */
  settle(): void {
    this.busy = false;
  }
}
