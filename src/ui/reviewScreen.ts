// The Review screen: check what the camera read, fix any square, then solve.
import { assemble, faceletToCell, type Assembly } from '../cube/assemble';
import { COLORS, COLOR_HEX, COLOR_NAME, COLOR_TO_FACE, SOLVED, type Color, type FaceReading, type Facelets } from '../cube/types';
import { classify } from '../vision/classify';
import type { ScannedFace } from '../vision/slots';
import { Cube3D } from './cube3d';
import { button, el } from './dom';
import { createFaceGrid } from './faceGrid';

export function mountReviewScreen(
  root: HTMLElement,
  o: { faces: ScannedFace[]; onSolve(f: Facelets): void; onRescan(): void },
): () => void {
  const cards = el('div', { class: 'review-cards' });
  const status = el('div', { class: 'review-status' });
  const actions = el('div', { class: 'button-row' });
  const chooser = el('div', { class: 'chooser' });
  const screen = el(
    'section',
    { class: 'screen review-screen' },
    el(
      'p',
      { class: 'lead' },
      'Here is what the camera read. Each photo is beside the colours the app saw. If a square is wrong, click it and pick the right colour.',
    ),
    status,
    chooser,
    actions,
    cards,
  );
  root.append(screen);

  let readings: FaceReading[];
  try {
    readings = classify(o.faces.map((face) => face.samples));
  } catch {
    status.className = 'review-status bad';
    status.textContent = 'Something went wrong reading the colours. Please scan the cube again.';
    actions.append(button('Scan again', () => o.onRescan(), 'btn primary'));
    return () => screen.remove();
  }

  let selected: { face: number; cell: number } | null = null;
  let viewer: Cube3D | null = null;
  let candidateIndex = 0;
  let shownCandidates: Facelets[] = [];

  function closeViewer(): void {
    viewer?.dispose();
    viewer = null;
    chooser.replaceChildren();
  }

  /** Which squares of which card to outline, from the first problem found. */
  function flagged(assembly: Assembly): Map<number, number[]> {
    const byCard = new Map<number, number[]>();
    const problem = assembly.problems[0];
    if (!problem) return byCard;
    for (const facelet of problem.facelets) {
      const { face, cell } = faceletToCell(facelet, assembly.rotations);
      const card = readings.findIndex((reading) => COLOR_TO_FACE[reading[4]] === face);
      if (card >= 0) byCard.set(card, [...(byCard.get(card) ?? []), cell]);
    }
    return byCard;
  }

  function renderCards(assembly: Assembly): void {
    const flags = flagged(assembly);
    cards.replaceChildren();
    readings.forEach((reading, face) => {
      const grid = createFaceGrid(
        reading.map((colour) => COLOR_HEX[colour]),
        {
          highlight: flags.get(face) ?? [],
          labels: reading.map((colour, cell) => (cell === 4 ? `${COLOR_NAME[colour]} (centre, fixed)` : `${COLOR_NAME[colour]} — click to change`)),
          onCellClick: (cell) => {
            if (cell === 4) return;
            selected = selected && selected.face === face && selected.cell === cell ? null : { face, cell };
            render();
          },
        },
      );
      if (selected?.face === face) grid.children[selected.cell]?.classList.add('selected');

      const card = el(
        'div',
        { class: 'review-card' },
        el('div', { class: 'review-card-title' }, `${COLOR_NAME[reading[4]]} centre`),
        el('div', { class: 'review-pair' }, el('img', { class: 'review-photo', alt: 'Photo of this face', src: o.faces[face].snapshot }), grid),
      );
      if (selected?.face === face) {
        const picker = el('div', { class: 'picker' }, el('span', { class: 'hint' }, 'Change to:'));
        for (const colour of COLORS) {
          const swatch = button('', () => recolour(face, selected!.cell, colour), 'picker-swatch');
          swatch.style.background = COLOR_HEX[colour];
          swatch.title = COLOR_NAME[colour];
          swatch.setAttribute('aria-label', COLOR_NAME[colour]);
          picker.append(swatch);
        }
        card.append(picker);
      }
      cards.append(card);
    });
  }

  function recolour(face: number, cell: number, colour: Color): void {
    readings = readings.map((reading, i) => (i === face ? reading.map((c, j) => (j === cell ? colour : c)) : reading));
    selected = null;
    candidateIndex = 0;
    render();
  }

  function renderChooser(candidates: Facelets[]): void {
    shownCandidates = candidates;
    if (!viewer) {
      const stage = el('div', { class: 'cube-stage small' });
      const label = el('span', { class: 'hint chooser-label' });
      const step = (by: number): void => {
        candidateIndex = (candidateIndex + by + shownCandidates.length) % shownCandidates.length;
        render();
      };
      chooser.replaceChildren(
        stage,
        el('div', { class: 'button-row' }, button('◀ Previous', () => step(-1)), label, button('Next ▶', () => step(1))),
      );
      viewer = new Cube3D(stage);
    }
    viewer.setState(candidates[candidateIndex]);
    const label = chooser.querySelector('.chooser-label');
    if (label) label.textContent = `Option ${candidateIndex + 1} of ${candidates.length} (white on top, green facing you)`;
  }

  function render(): void {
    const assembly = assemble(readings);
    const { candidates, problems } = assembly;
    actions.replaceChildren();
    status.className = 'review-status';

    if (candidates.length === 1 && candidates[0] === SOLVED) {
      closeViewer();
      status.classList.add('good');
      status.textContent = 'Your cube is already solved.';
    } else if (candidates.length === 1) {
      closeViewer();
      status.classList.add('good');
      status.textContent = 'This cube checks out.';
      actions.append(button('Solve it ▶', () => o.onSolve(candidates[0]), 'btn primary'));
    } else if (candidates.length > 1) {
      candidateIndex = Math.min(candidateIndex, candidates.length - 1);
      status.textContent = `This pattern can fit together in ${candidates.length} ways. Pick the one that matches your cube.`;
      renderChooser(candidates);
      actions.append(button('Solve this one ▶', () => o.onSolve(candidates[candidateIndex]), 'btn primary'));
    } else {
      closeViewer();
      status.classList.add('bad');
      const more = problems.length > 1 ? el('div', { class: 'hint' }, `and ${problems.length - 1} more`) : null;
      status.replaceChildren(el('div', {}, problems[0]?.message ?? 'These faces do not fit together into a cube.'));
      if (more) status.append(more);
      status.append(el('div', { class: 'hint' }, 'Squares worth checking are outlined in red. Compare them with the photos.'));
    }
    actions.append(button('Scan again', () => o.onRescan(), candidates.length === 0 ? 'btn' : 'btn subtle'));
    renderCards(assembly);
  }

  render();

  return () => {
    viewer?.dispose();
    screen.remove();
  };
}
