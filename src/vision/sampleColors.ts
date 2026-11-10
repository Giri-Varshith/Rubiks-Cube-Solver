// Read the colour at each of the nine cells of a face.
import { rgbToLab, type Lab } from './colorMath';

/** A picture as raw RGBA bytes; the same shape as the browser's ImageData. */
export interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 === 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/**
 * The colour around each point: the per-channel median of a square patch
 * patchPx wide, so a speck of glare or a few stray pixels do not matter.
 * Patches are clipped to the frame; a point outside it reads the nearest pixel.
 */
export function sampleColors(frame: Frame, points: Point[], patchPx: number): Lab[] {
  const half = Math.max(0, Math.floor(patchPx / 2));
  const clampX = (x: number) => Math.max(0, Math.min(frame.width - 1, x));
  const clampY = (y: number) => Math.max(0, Math.min(frame.height - 1, y));

  return points.map((point) => {
    const cx = clampX(Math.round(point.x));
    const cy = clampY(Math.round(point.y));
    const x0 = clampX(cx - half);
    const x1 = clampX(cx + half);
    const y0 = clampY(cy - half);
    const y1 = clampY(cy + half);

    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];
    for (let y = y0; y <= y1; y++) {
      let offset = (y * frame.width + x0) * 4;
      for (let x = x0; x <= x1; x++, offset += 4) {
        r.push(frame.data[offset]);
        g.push(frame.data[offset + 1]);
        b.push(frame.data[offset + 2]);
      }
    }
    return rgbToLab([median(r), median(g), median(b)]);
  });
}
