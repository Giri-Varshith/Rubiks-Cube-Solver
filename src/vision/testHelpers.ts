// Test-only helpers for the vision modules.
import { cut } from '../cube/testHelpers';
import type { Color, FaceReading, Facelets } from '../cube/types';
import { rgbToLab, type Lab, type RGB } from './colorMath';

/** Typical sticker colours of a real cube under neutral light (sRGB). */
export const REF: Record<Color, RGB> = {
  W: [235, 235, 235],
  Y: [240, 210, 20],
  R: [190, 30, 40],
  O: [245, 110, 20],
  B: [20, 70, 180],
  G: [20, 150, 70],
};

export interface Lighting {
  gain: number;
  tint: RGB;
}

export const LIGHTINGS: Record<string, Lighting> = {
  neutral: { gain: 1, tint: [1, 1, 1] },
  warm: { gain: 1, tint: [1.1, 1.0, 0.8] },
  cool: { gain: 1, tint: [0.9, 1.0, 1.15] },
  dim: { gain: 0.6, tint: [1, 1, 1] },
};

/** What a camera would record for a colour under some lighting, with optional random noise per channel. */
export function light(rgb: RGB, lighting: Lighting, noise = 0, rng: () => number = Math.random): RGB {
  return rgb.map((v, i) => {
    const lit = v * lighting.gain * lighting.tint[i] + (rng() * 2 - 1) * noise;
    return Math.max(0, Math.min(255, Math.round(lit)));
  }) as RGB;
}

/** Simulate scanning a whole cube: six faces of nine Lab samples, plus the true colours. */
export function scanCube(
  f: Facelets,
  turns: number[],
  order: number[],
  lighting: Lighting,
  noise: number,
  rng: () => number,
): { faces: Lab[][]; truth: FaceReading[] } {
  const truth = cut(f, turns, order);
  const faces = truth.map((reading) => reading.map((colour) => rgbToLab(light(REF[colour], lighting, noise, rng))));
  return { faces, truth };
}
