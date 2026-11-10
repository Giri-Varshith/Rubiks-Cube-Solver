export default class Cube {
  constructor(other?: Cube);
  static initSolver(): void;
  static fromString(s: string): Cube;
  static random(): Cube;
  static inverse(alg: string): string;
  asString(): string;
  move(alg: string): Cube;
  solve(maxDepth?: number): string;
  isSolved(): boolean;
}
