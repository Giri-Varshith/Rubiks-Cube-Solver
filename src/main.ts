// App shell: Scan -> Review -> Solve, with a way back to Scan from anywhere.
import type { Facelets } from './cube/types';
import { initSolver, solve } from './solver/solverClient';
import { button, el } from './ui/dom';
import { mountReviewScreen } from './ui/reviewScreen';
import { mountScanScreen } from './ui/scanScreen';
import { mountSolveScreen } from './ui/solveScreen';
import type { ScannedFace } from './vision/slots';

const STEPS = ['1 · Scan', '2 · Check', '3 · Solve'];

const app = document.getElementById('app') as HTMLElement;
const stepper = el('ol', { class: 'stepper' }, ...STEPS.map((label) => el('li', {}, label)));
const stageRoot = el('main', {});
app.append(el('header', { class: 'app-header' }, el('h1', {}, "Rubik's Cube Solver"), stepper), stageRoot);

let unmount: (() => void) | null = null;

function show(step: number, mount: (root: HTMLElement) => () => void): void {
  unmount?.();
  unmount = null;
  [...stepper.children].forEach((item, i) => {
    item.classList.toggle('current', i === step);
    item.classList.toggle('done', i < step);
  });
  unmount = mount(stageRoot);
}

/** Scan from scratch, or (coming back from the Check screen) with the faces already captured kept. */
function showScan(initialFaces?: ScannedFace[]): void {
  show(0, (root) => mountScanScreen(root, { initialFaces, onComplete: showReview }));
}

function showReview(faces: ScannedFace[]): void {
  show(1, (root) => mountReviewScreen(root, { faces, onSolve: showSolving, onBack: () => showScan(faces) }));
}

/** A simple message panel, used while the solver works and if it fails. There is always a way out. */
function mountPanel(root: HTMLElement, text: string, failed: boolean): () => void {
  const panel = el(
    'section',
    { class: 'screen panel' },
    el('p', { class: failed ? 'review-status bad' : 'status' }, text),
    button('Scan again', () => showScan(), failed ? 'btn primary' : 'btn subtle'),
  );
  root.append(panel);
  return () => panel.remove();
}

function showSolving(facelets: Facelets): void {
  show(2, (root) => mountPanel(root, 'Preparing solver…', false));
  let superseded = false;
  const previous = unmount;
  unmount = () => {
    superseded = true;
    previous?.();
  };
  solve(facelets).then(
    (moves) => {
      if (superseded) return;
      show(2, (root) => mountSolveScreen(root, { facelets, moves, onRescan: () => showScan() }));
    },
    (err: unknown) => {
      console.error('Solving failed', err);
      if (superseded) return;
      show(2, (root) => mountPanel(root, 'Something went wrong working out the solution. Please scan the cube again.', true));
    },
  );
}

// Build the solver's tables in the background while the user scans.
initSolver().catch((err: unknown) => console.error('The solver could not be started', err));
showScan();
