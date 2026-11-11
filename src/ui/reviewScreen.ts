// The Review screen: check what the camera read, fix any square, then solve.
import { assemble, faceletToCell, repairCentres, suggestSwaps, type Assembly, type SwapSuggestion } from '../cube/assemble';
import { COLORS, COLOR_HEX, COLOR_NAME, COLOR_TO_FACE, SOLVED, type Color, type FaceReading, type Facelets } from '../cube/types';
import { centreLookAlikes, classify } from '../vision/classify';
import type { ScannedFace } from '../vision/slots';
import { Cube3D } from './cube3d';
import { button, el } from './dom';
import { createFaceGrid } from './faceGrid';
import { describeSquare, rankSwaps } from './swapHints';

export function mountReviewScreen(
  root: HTMLElement,
  o: { faces: ScannedFace[]; onSolve(f: Facelets): void; onBack(): void },
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

  const samples = o.faces.map((face) => face.samples);
  let readings: FaceReading[];
  try {
    // If two faces came out with each other's centre colour (a logo or glare on a centre), put that right.
    readings = repairCentres(classify(samples), centreLookAlikes(samples)).readings;
  } catch {
    status.className = 'review-status bad';
    status.textContent = 'Something went wrong reading the colours. Go back and scan the faces again.';
    actions.append(button('◀ Back to scanning', () => o.onBack(), 'btn primary'));
    return () => screen.remove();
  }

  let selected: { face: number; cell: number } | null = null;
  let viewer: Cube3D | null = null;
  let candidateIndex = 0;
  let shownCandidates: Facelets[] = [];
  let chooserBuilt = false;
  /** Which of the suggested swaps is on show, when the faces do not fit together. */
  let swapIndex = 0;

  function closeViewer(): void {
    viewer?.dispose();
    viewer = null;
    chooserBuilt = false;
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

  function renderCards(assembly: Assembly, swap: SwapSuggestion | null): void {
    // With a likely swap on show, only its two squares are outlined; otherwise the squares of the first problem.
    const flags = swap ? new Map<number, number[]>() : flagged(assembly);
    const suggested = (face: number): number[] =>
      swap ? [swap.a, swap.b].filter((square) => square.face === face).map((square) => square.cell) : [];
    cards.replaceChildren();
    readings.forEach((reading, face) => {
      const grid = createFaceGrid(
        reading.map((colour) => COLOR_HEX[colour]),
        {
          highlight: flags.get(face) ?? [],
          suggest: suggested(face),
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
    swapIndex = 0;
    render();
  }

  /** Give two squares each other's colour. */
  function applySwap(swap: SwapSuggestion): void {
    const next = readings.map((reading) => [...reading]);
    [next[swap.a.face][swap.a.cell], next[swap.b.face][swap.b.cell]] = [next[swap.b.face][swap.b.cell], next[swap.a.face][swap.a.cell]];
    readings = next;
    selected = null;
    candidateIndex = 0;
    swapIndex = 0;
    render();
  }

  function renderChooser(candidates: Facelets[]): void {
    shownCandidates = candidates;
    if (!chooserBuilt) {
      chooserBuilt = true;
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
      try {
        viewer = new Cube3D(stage);
      } catch (err) {
        // No 3D in this browser: the options can still be stepped through and chosen.
        console.error('3D view unavailable', err);
        stage.classList.add('unavailable');
        stage.textContent = 'The 3D picture is not available in this browser.';
      }
    }
    viewer?.setState(candidates[candidateIndex]);
    const label = chooser.querySelector('.chooser-label');
    if (label) label.textContent = `Option ${candidateIndex + 1} of ${candidates.length} (white on top, green facing you)`;
  }

  function render(): void {
    const assembly = assemble(readings);
    const { candidates, problems } = assembly;
    actions.replaceChildren();
    status.className = 'review-status';
    let shownSwap: SwapSuggestion | null = null;
    // Only worked out when the faces do not fit: the most likely pairs of swapped squares, best first.
    const swaps = candidates.length === 0 ? rankSwaps(suggestSwaps(readings), samples).slice(0, 5) : [];

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
    } else if (swaps.length > 0) {
      // The usual case: two squares have each other's colour (red and orange are easily confused).
      closeViewer();
      status.classList.add('bad');
      swapIndex = Math.min(swapIndex, swaps.length - 1);
      const swap = swaps[swapIndex];
      shownSwap = swap;
      status.replaceChildren(
        el('div', {}, 'Nearly there. The faces would fit together if two squares swapped colours.'),
        el(
          'div',
          { class: 'swap-detail' },
          `Look at your real cube: ${describeSquare(readings, swap.a)} and ${describeSquare(readings, swap.b)}. They are outlined in blue below.`,
        ),
        el('div', { class: 'hint' }, 'If those two are the other way round on your cube, press “Swap these two”. Red and orange are the colours most often mixed up. You can also click any square to change it yourself.'),
      );
      actions.append(button('Swap these two', () => applySwap(swap), 'btn primary'));
      if (swaps.length > 1) {
        actions.append(
          button(`Not those? Show another pair (${swapIndex + 1} of ${swaps.length})`, () => {
            swapIndex = (swapIndex + 1) % swaps.length;
            render();
          }),
        );
      }
    } else {
      closeViewer();
      status.classList.add('bad');
      const more = problems.length > 1 ? el('div', { class: 'hint' }, `and ${problems.length - 1} more`) : null;
      status.replaceChildren(el('div', {}, problems[0]?.message ?? 'These faces do not fit together into a cube.'));
      if (more) status.append(more);
      if ((problems[0]?.facelets.length ?? 0) > 0) {
        status.append(el('div', { class: 'hint' }, 'Squares worth checking are outlined in red. Compare them with the photos.'));
      }
    }
    actions.append(button('◀ Back to scanning', () => o.onBack(), candidates.length === 0 ? 'btn' : 'btn subtle'));
    renderCards(assembly, shownSwap);
  }

  render();

  return () => {
    viewer?.dispose();
    screen.remove();
  };
}
