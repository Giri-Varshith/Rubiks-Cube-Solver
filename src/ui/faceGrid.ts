// A 3x3 grid of colour swatches for one cube face.
import { el } from './dom';

export function createFaceGrid(
  cssColors: string[],
  o: { onCellClick?(cell: number): void; highlight?: number[]; suggest?: number[]; labels?: string[] } = {},
): HTMLElement {
  const grid = el('div', { class: 'face-grid' });
  cssColors.forEach((colour, cell) => {
    const clickable = o.onCellClick !== undefined;
    const square = clickable ? el('button', { class: 'cell', type: 'button' }) : el('div', { class: 'cell' });
    square.style.background = colour;
    if (o.labels?.[cell]) {
      square.title = o.labels[cell];
      square.setAttribute('aria-label', o.labels[cell]);
    }
    if (o.highlight?.includes(cell)) square.classList.add('flag');
    if (o.suggest?.includes(cell)) square.classList.add('suggest');
    if (clickable) square.addEventListener('click', () => o.onCellClick?.(cell));
    grid.append(square);
  });
  return grid;
}
