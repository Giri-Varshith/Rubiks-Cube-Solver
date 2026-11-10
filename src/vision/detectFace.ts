// Find a cube face in a camera frame.
//
// Step 1 (OpenCV): find every blob in the picture that looks like one sticker:
//         roughly square, of a plausible size.
// Step 2 (plain geometry): look for stickers of similar size sitting on a 3x3
//         grid. A real face gives nine (a few may be missing); clutter does not.
//
// The nine sample points come from the fitted grid, not from the blobs, so a
// cell whose blob was missed (a logo, glare) is still sampled in the right place.
import { CONFIG } from '../config';
import type { Frame, Point } from './sampleColors';

export interface Detection {
  /** Nine sample points, row by row, in frame pixels. */
  points: Point[];
  /** The four corners of the face outline, clockwise from top-left. */
  corners: Point[];
  /** Spacing between neighbouring cells, in frame pixels. */
  pitch: number;
  /** Outlines of everything that looked like a sticker (for the debug view). */
  candidates: Point[][];
}

interface Candidate {
  x: number;
  y: number;
  /** Side length of the (roughly square) blob. */
  side: number;
  /** Unit vector along the blob's side that points mostly to the right. */
  ux: number;
  uy: number;
  quad: Point[];
}

interface Lattice {
  /** Position of grid cell (0, 0). */
  ox: number;
  oy: number;
  /** Step to the next column (mostly rightwards) and to the next row (mostly downwards). */
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  /** Top-left cell of the chosen 3x3 window, in grid steps from (0, 0). */
  i0: number;
  j0: number;
  cells: number;
  residual: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function findCandidates(cv: any, frame: Frame, scale: number): Candidate[] {
  const width = Math.round(frame.width * scale);
  const height = Math.round(frame.height * scale);
  const minSide = CONFIG.minStickerFrac * width;
  const maxSide = CONFIG.maxStickerFrac * width;

  const src = new cv.Mat(frame.height, frame.width, cv.CV_8UC4);
  const small = new cv.Mat();
  const blurred = new cv.Mat();
  const planes = new cv.MatVector();
  const edges = cv.Mat.zeros(height, width, cv.CV_8UC1);
  const channelEdges = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const found: Candidate[] = [];

  try {
    src.data.set(frame.data);
    cv.resize(src, small, new cv.Size(width, height), 0, 0, cv.INTER_AREA);
    cv.GaussianBlur(small, blurred, new cv.Size(5, 5), 0);

    // Edges are looked for in red, green and blue separately and combined, so
    // two neighbouring colours of the same brightness still show a boundary.
    cv.split(blurred, planes);
    for (let c = 0; c < 3; c++) {
      const plane = planes.get(c);
      cv.Canny(plane, channelEdges, 30, 90);
      cv.bitwise_or(edges, channelEdges, edges);
      plane.delete();
    }
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 2);

    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area >= minSide * minSide * 0.6 && area <= maxSide * maxSide) {
        const rect = cv.minAreaRect(contour);
        const w = rect.size.width;
        const h = rect.size.height;
        const side = Math.sqrt(w * h);
        const aspect = Math.max(w, h) / Math.max(1e-6, Math.min(w, h));
        if (side >= minSide && side <= maxSide && aspect <= CONFIG.maxAspect && area / (w * h) >= CONFIG.minRectFill) {
          // Direction of one side, turned by quarter turns until it points mostly right.
          let angle = (rect.angle * Math.PI) / 180;
          while (angle > Math.PI / 4) angle -= Math.PI / 2;
          while (angle <= -Math.PI / 4) angle += Math.PI / 2;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const hw = side / 2;
          const quad = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([a, b]) => ({
            x: rect.center.x + a * hw * ux - b * hw * uy,
            y: rect.center.y + a * hw * uy + b * hw * ux,
          }));
          found.push({ x: rect.center.x, y: rect.center.y, side, ux, uy, quad });
        }
      }
      contour.delete();
    }
  } finally {
    src.delete();
    small.delete();
    blurred.delete();
    planes.delete();
    edges.delete();
    channelEdges.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }

  // An edge drawn round a sticker gives an inner and an outer outline; keep one.
  const kept: Candidate[] = [];
  for (const c of found) {
    const duplicate = kept.some(
      (k) => Math.hypot(k.x - c.x, k.y - c.y) < 0.25 * k.side && Math.min(k.side, c.side) / Math.max(k.side, c.side) > 0.8,
    );
    if (!duplicate) kept.push(c);
  }
  return kept;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Least-squares fit of position = origin + i*U + j*V. Returns null if the cells are all in one line. */
function fitGrid(cells: { i: number; j: number; x: number; y: number }[]): Omit<Lattice, 'i0' | 'j0' | 'cells' | 'residual'> | null {
  let n = 0, si = 0, sj = 0, sii = 0, sij = 0, sjj = 0; // prettier-ignore
  let sx = 0, six = 0, sjx = 0, sy = 0, siy = 0, sjy = 0; // prettier-ignore
  for (const c of cells) {
    n++;
    si += c.i;
    sj += c.j;
    sii += c.i * c.i;
    sij += c.i * c.j;
    sjj += c.j * c.j;
    sx += c.x;
    six += c.i * c.x;
    sjx += c.j * c.x;
    sy += c.y;
    siy += c.i * c.y;
    sjy += c.j * c.y;
  }
  // Solve the 3x3 normal equations [n si sj; si sii sij; sj sij sjj] p = rhs by Cramer's rule.
  const det = n * (sii * sjj - sij * sij) - si * (si * sjj - sij * sj) + sj * (si * sij - sii * sj);
  if (Math.abs(det) < 1e-9) return null;
  const solve = (r0: number, r1: number, r2: number): [number, number, number] => [
    (r0 * (sii * sjj - sij * sij) - si * (r1 * sjj - sij * r2) + sj * (r1 * sij - sii * r2)) / det,
    (n * (r1 * sjj - sij * r2) - r0 * (si * sjj - sij * sj) + sj * (si * r2 - r1 * sj)) / det,
    (n * (sii * r2 - r1 * sij) - si * (si * r2 - r1 * sj) + r0 * (si * sij - sii * sj)) / det,
  ];
  const [ox, ux, vx] = solve(sx, six, sjx);
  const [oy, uy, vy] = solve(sy, siy, sjy);
  return { ox, oy, ux, uy, vx, vy };
}

type Grid = Omit<Lattice, 'i0' | 'j0' | 'cells' | 'residual'>;

/** Which grid cells are occupied by a candidate, for a given grid. */
function occupy(grid: Grid, candidates: Candidate[]): Map<string, { i: number; j: number; x: number; y: number; miss: number }> {
  const det = grid.ux * grid.vy - grid.uy * grid.vx;
  const occupied = new Map<string, { i: number; j: number; x: number; y: number; miss: number }>();
  if (Math.abs(det) < 1e-9) return occupied;
  for (const c of candidates) {
    const dx = c.x - grid.ox;
    const dy = c.y - grid.oy;
    // Position in grid steps.
    const a = (dx * grid.vy - dy * grid.vx) / det;
    const b = (grid.ux * dy - grid.uy * dx) / det;
    const i = Math.round(a);
    const j = Math.round(b);
    if (Math.abs(i) > 2 || Math.abs(j) > 2) continue;
    const miss = Math.max(Math.abs(a - i), Math.abs(b - j));
    if (miss > CONFIG.latticeTolerance) continue;
    const key = `${i},${j}`;
    const existing = occupied.get(key);
    if (!existing || miss < existing.miss) occupied.set(key, { i, j, x: c.x, y: c.y, miss });
  }
  return occupied;
}

function bestWindow(occupied: Map<string, { miss: number }>): { i0: number; j0: number; cells: number; residual: number } {
  let best = { i0: -1, j0: -1, cells: 0, residual: Infinity };
  for (let i0 = -2; i0 <= 0; i0++) {
    for (let j0 = -2; j0 <= 0; j0++) {
      let cells = 0;
      let residual = 0;
      for (let i = i0; i < i0 + 3; i++) {
        for (let j = j0; j < j0 + 3; j++) {
          const hit = occupied.get(`${i},${j}`);
          if (hit) {
            cells++;
            residual += hit.miss;
          }
        }
      }
      if (cells > best.cells || (cells === best.cells && residual < best.residual)) best = { i0, j0, cells, residual };
    }
  }
  return best;
}

function plausible(grid: Grid): boolean {
  const lenU = Math.hypot(grid.ux, grid.uy);
  const lenV = Math.hypot(grid.vx, grid.vy);
  if (lenU < 1e-6 || lenV < 1e-6) return false;
  const ratio = lenU / lenV;
  if (ratio < 0.55 || ratio > 1.8) return false;
  // Rows and columns must be near enough at right angles, and never mirrored.
  const cosine = (grid.ux * grid.vx + grid.uy * grid.vy) / (lenU * lenV);
  if (Math.abs(cosine) > 0.42) return false;
  return grid.ux * grid.vy - grid.uy * grid.vx > 0;
}

function findLattice(candidates: Candidate[]): Lattice | null {
  const needed = CONFIG.minNeighbours + 1; // of the nine cells
  let best: Lattice | null = null;

  for (const seed of candidates) {
    const similar = candidates.filter((c) => c.side >= seed.side * 0.7 && c.side <= seed.side * 1.3);
    if (similar.length < needed) continue;

    // Spacing along the seed's two axes, from its nearest similar neighbours.
    const ux = seed.ux;
    const uy = seed.uy;
    const vx = -uy;
    const vy = ux;
    const alongU: number[] = [];
    const alongV: number[] = [];
    for (const c of similar) {
      if (c === seed) continue;
      const a = (c.x - seed.x) * ux + (c.y - seed.y) * uy;
      const b = (c.x - seed.x) * vx + (c.y - seed.y) * vy;
      const near = (d: number) => Math.abs(d) > 0.8 * seed.side && Math.abs(d) < 1.9 * seed.side;
      if (Math.abs(b) < 0.35 * seed.side && near(a)) alongU.push(Math.abs(a));
      if (Math.abs(a) < 0.35 * seed.side && near(b)) alongV.push(Math.abs(b));
    }
    if (alongU.length === 0 && alongV.length === 0) continue;
    const pitchU = alongU.length > 0 ? median(alongU) : median(alongV);
    const pitchV = alongV.length > 0 ? median(alongV) : median(alongU);

    let grid: Grid = { ox: seed.x, oy: seed.y, ux: ux * pitchU, uy: uy * pitchU, vx: vx * pitchV, vy: vy * pitchV };
    let occupied = occupy(grid, similar);
    if (bestWindow(occupied).cells < needed) continue;

    // Refine the grid from everything it matched, then match again.
    for (let pass = 0; pass < 2; pass++) {
      const fitted = fitGrid([...occupied.values()]);
      if (!fitted || !plausible(fitted)) break;
      grid = fitted;
      occupied = occupy(grid, similar);
    }
    if (!plausible(grid)) continue;

    const window = bestWindow(occupied);
    if (window.cells < needed) continue;
    if (!best || window.cells > best.cells || (window.cells === best.cells && window.residual < best.residual)) {
      best = { ...grid, ...window };
    }
  }
  return best;
}

/** Look for a cube face. Returns null when there is not one clearly in view. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectFace(cv: any, frame: Frame): Detection | null {
  if (frame.width < 8 || frame.height < 8) return null;
  const scale = Math.min(1, CONFIG.detectWidth / frame.width);
  const candidates = findCandidates(cv, frame, scale);
  const lattice = findLattice(candidates);
  if (!lattice) return null;

  const at = (i: number, j: number): Point => ({
    x: (lattice.ox + i * lattice.ux + j * lattice.vx) / scale,
    y: (lattice.oy + i * lattice.uy + j * lattice.vy) / scale,
  });
  const points: Point[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) points.push(at(lattice.i0 + col, lattice.j0 + row));
  }
  const ci = lattice.i0 + 1;
  const cj = lattice.j0 + 1;
  const corners = [at(ci - 1.5, cj - 1.5), at(ci + 1.5, cj - 1.5), at(ci + 1.5, cj + 1.5), at(ci - 1.5, cj + 1.5)];
  const pitch = Math.min(Math.hypot(lattice.ux, lattice.uy), Math.hypot(lattice.vx, lattice.vy)) / scale;

  return {
    points,
    corners,
    pitch,
    candidates: candidates.map((c) => c.quad.map((p) => ({ x: p.x / scale, y: p.y / scale }))),
  };
}

/** Line-up mode: a fixed square in the middle of the picture that the user fills with the face. */
export function fixedLattice(width: number, height: number): Detection {
  const side = 0.6 * Math.min(width, height);
  const pitch = side / 3;
  const cx = width / 2;
  const cy = height / 2;
  const points: Point[] = [];
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) points.push({ x: cx + col * pitch, y: cy + row * pitch });
  }
  const h = side / 2;
  const corners = [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ];
  return { points, corners, pitch, candidates: [] };
}
