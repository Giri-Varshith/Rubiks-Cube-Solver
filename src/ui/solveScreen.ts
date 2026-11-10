// The step-by-step guide: an animated 3D cube and one move at a time.
import { describeMove, formatMove } from '../cube/moves';
import type { Facelets, Move } from '../cube/types';
import { Cube3D } from './cube3d';
import { button, el } from './dom';
import { SolveController } from './solveController';

export function mountSolveScreen(
  root: HTMLElement,
  o: { facelets: Facelets; moves: Move[]; onRescan(): void },
): () => void {
  const controller = new SolveController(o.facelets, o.moves);
  const total = o.moves.length;

  const stage = el('div', { class: 'cube-stage' });
  const moveLetter = el('div', { class: 'move-letter' });
  const moveText = el('div', { class: 'move-text' });
  const progress = el('div', { class: 'move-progress' });
  const banner = el('div', { class: 'solved-banner' });
  const list = el('div', { class: 'move-list' });
  const chips = o.moves.map((move, i) => el('span', { class: 'chip', title: `Move ${i + 1}: ${describeMove(move)}` }, formatMove(move)));
  list.append(...chips);

  const backButton = button('◀ Back', () => void back());
  const replayButton = button('↻ Show again', () => void replay());
  const nextButton = button('Next ▶', () => void next(), 'btn primary');
  const viewButton = button('Reset view', () => cube.resetView(), 'btn subtle');
  const rescanButton = button("I'm lost — scan again", () => o.onRescan(), 'btn subtle');

  const screen = el(
    'section',
    { class: 'screen solve-screen' },
    el(
      'p',
      { class: 'hold-note' },
      'Hold the cube with the ',
      el('strong', {}, 'white centre on top'),
      ' and the ',
      el('strong', {}, 'green centre facing you'),
      '. Keep it that way round for every move. The picture shows the cube as you see it.',
    ),
    el(
      'div',
      { class: 'solve-layout' },
      el('div', { class: 'cube-column' }, stage, el('p', { class: 'hint' }, 'Drag the cube to look around it.')),
      el(
        'div',
        { class: 'guide-column' },
        progress,
        el('div', { class: 'move-card' }, moveLetter, moveText),
        banner,
        el('div', { class: 'button-row' }, backButton, replayButton, nextButton),
        el('p', { class: 'hint' }, 'Keys: → or Space for Next, ← for Back, R to show the move again.'),
        el('h3', {}, 'All the moves'),
        list,
        el('div', { class: 'button-row' }, viewButton, rescanButton),
      ),
    ),
  );
  root.append(screen);

  // If the browser cannot draw 3D, the written moves still work.
  let cube: Pick<Cube3D, 'setState' | 'animateMove' | 'resetView' | 'dispose'>;
  try {
    cube = new Cube3D(stage);
  } catch (err) {
    console.error('3D view unavailable', err);
    stage.classList.add('unavailable');
    stage.textContent = 'The 3D picture is not available in this browser. Follow the written moves.';
    cube = { setState() {}, animateMove: () => Promise.resolve(), resetView() {}, dispose() {} };
  }
  cube.setState(controller.state);

  function render(): void {
    const last = controller.last;
    banner.textContent = '';
    banner.classList.remove('show');
    if (total === 0) {
      progress.textContent = 'No moves needed';
      moveLetter.textContent = '✓';
      moveText.textContent = 'Your cube is already solved.';
    } else if (!last) {
      progress.textContent = `${total} moves to go`;
      moveLetter.textContent = '';
      moveText.textContent = 'Press Next to see the first move, then do the same on your cube.';
    } else {
      progress.textContent = `Move ${controller.index} of ${total}`;
      moveLetter.textContent = formatMove(last);
      moveText.textContent = describeMove(last);
      if (controller.done) {
        banner.textContent = 'Solved! That was the last move.';
        banner.classList.add('show');
      }
    }
    chips.forEach((chip, i) => {
      chip.classList.toggle('done', i < controller.index - 1);
      chip.classList.toggle('current', i === controller.index - 1);
    });
    backButton.disabled = controller.busy || controller.index === 0;
    replayButton.disabled = controller.busy || controller.index === 0;
    nextButton.disabled = controller.busy || controller.done;
  }

  async function play(move: Move): Promise<void> {
    render();
    await cube.animateMove(move);
    cube.setState(controller.state);
    controller.settle();
    render();
  }

  async function next(): Promise<void> {
    const move = controller.next();
    if (move) await play(move);
  }

  async function back(): Promise<void> {
    const undo = controller.back();
    if (undo) await play(undo);
  }

  async function replay(): Promise<void> {
    const again = controller.replay();
    if (!again) return;
    cube.setState(again.rewind);
    await play(again.move);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault();
      void next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      void back();
    } else if (event.key === 'r' || event.key === 'R') {
      void replay();
    }
  }
  window.addEventListener('keydown', onKey);
  render();

  return () => {
    window.removeEventListener('keydown', onKey);
    cube.dispose();
    screen.remove();
  };
}
