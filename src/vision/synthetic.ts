// Draws a computer-generated cube face into a pixel buffer.
// Used by the tests, and by the app's demo mode (?demo=1) so the whole flow
// can be tried without a camera.
import type { RGB } from './colorMath';
import type { Frame, Point } from './sampleColors';

export interface FaceRender {
  width: number;
  height: number;
  /** Nine cell colours, row by row. */
  colors: RGB[];
  /** Face centre, in pixels. */
  cx: number;
  cy: number;
  /** Face side, in pixels. */
  size: number;
  /** Rotation in the picture, clockwise on screen. Default 0. */
  angleDeg?: number;
  /** Horizontal squeeze 0..0.4, imitating a face tilted away from the camera. Default 0. */
  shear?: number;
  /** Dark gap between cells, as a fraction of a cell. Default 0.12. */
  gapFrac?: number;
  /** A plain colour, or 'clutter' for random rectangles. Default [60, 60, 60]. */
  background?: RGB | 'clutter';
  /** Random noise added to every channel, plus or minus this much. Default 0. */
  noise?: number;
  /** Draw a dark disc on the centre cell, like a maker's logo. Default false. */
  logo?: boolean;
  /** Seed for the clutter and the noise. Default 1. */
  seed?: number;
}

const PLASTIC: RGB = [18, 18, 18];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function axes(o: FaceRender): { cos: number; sin: number; squeeze: number } {
  const angle = ((o.angleDeg ?? 0) * Math.PI) / 180;
  return { cos: Math.cos(angle), sin: Math.sin(angle), squeeze: 1 - (o.shear ?? 0) };
}

/** Where the centre of cell 0..8 really is in the picture. */
export function cellCentre(o: FaceRender, cell: number): Point {
  const { cos, sin, squeeze } = axes(o);
  const cellSize = o.size / 3;
  const u = ((cell % 3) - 1) * cellSize * squeeze;
  const v = (Math.floor(cell / 3) - 1) * cellSize;
  return { x: o.cx + u * cos - v * sin, y: o.cy + u * sin + v * cos };
}

export function renderFace(o: FaceRender): Frame {
  const { width, height } = o;
  const data = new Uint8ClampedArray(width * height * 4);
  const rng = seeded(o.seed ?? 1);

  // Background.
  const plain: RGB = o.background && o.background !== 'clutter' ? o.background : [60, 60, 60];
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = plain[0];
    data[p * 4 + 1] = plain[1];
    data[p * 4 + 2] = plain[2];
    data[p * 4 + 3] = 255;
  }
  if (o.background === 'clutter') {
    for (let n = 0; n < 40; n++) {
      const w = 10 + Math.floor(rng() * 140);
      const h = 10 + Math.floor(rng() * 140);
      const x0 = Math.floor(rng() * width);
      const y0 = Math.floor(rng() * height);
      const colour: RGB = [Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256)];
      for (let y = y0; y < Math.min(height, y0 + h); y++) {
        for (let x = x0; x < Math.min(width, x0 + w); x++) {
          const i = (y * width + x) * 4;
          data[i] = colour[0];
          data[i + 1] = colour[1];
          data[i + 2] = colour[2];
        }
      }
    }
  }

  // The face, drawn over the background.
  const { cos, sin, squeeze } = axes(o);
  const half = o.size / 2;
  const cellSize = o.size / 3;
  const gap = (o.gapFrac ?? 0.12) * cellSize;
  const reach = Math.ceil(half * Math.SQRT2) + 2;
  const xStart = Math.max(0, Math.floor(o.cx - reach));
  const xEnd = Math.min(width - 1, Math.ceil(o.cx + reach));
  const yStart = Math.max(0, Math.floor(o.cy - reach));
  const yEnd = Math.min(height - 1, Math.ceil(o.cy + reach));
  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      const dx = x - o.cx;
      const dy = y - o.cy;
      // Undo the rotation, then the squeeze, to get face coordinates.
      const u = (dx * cos + dy * sin) / squeeze;
      const v = -dx * sin + dy * cos;
      if (u < -half || u >= half || v < -half || v >= half) continue;

      const col = Math.min(2, Math.floor((u + half) / cellSize));
      const row = Math.min(2, Math.floor((v + half) / cellSize));
      const inU = u + half - col * cellSize;
      const inV = v + half - row * cellSize;
      const inGap = inU < gap / 2 || inU > cellSize - gap / 2 || inV < gap / 2 || inV > cellSize - gap / 2;

      let colour: RGB = inGap ? PLASTIC : o.colors[row * 3 + col];
      if (o.logo && row === 1 && col === 1 && Math.hypot(inU - cellSize / 2, inV - cellSize / 2) < cellSize * 0.3) {
        colour = [30, 30, 30];
      }
      const i = (y * width + x) * 4;
      data[i] = colour[0];
      data[i + 1] = colour[1];
      data[i + 2] = colour[2];
    }
  }

  const noise = o.noise ?? 0;
  if (noise > 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] += (rng() * 2 - 1) * noise;
      data[i + 1] += (rng() * 2 - 1) * noise;
      data[i + 2] += (rng() * 2 - 1) * noise;
    }
  }
  return { data, width, height };
}
