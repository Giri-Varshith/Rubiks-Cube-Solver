// Colour maths. Colours are compared in CIE L*a*b*, where straight-line
// distance roughly matches how different two colours look.

/** sRGB, each channel 0..255. */
export type RGB = [number, number, number];

/** CIE L*a*b* (D65): L = lightness 0..100, a = green-red, b = blue-yellow. */
export type Lab = [number, number, number];

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labCurve(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
}

export function rgbToLab(rgb: RGB): Lab {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  // Linear sRGB -> XYZ, then scaled by the D65 white point.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const fx = labCurve(x);
  const fy = labCurve(y);
  const fz = labCurve(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Distance between two colours. A lightnessWeight below 1 makes brightness count for less. */
export function labDistance(p: Lab, q: Lab, lightnessWeight = 1): number {
  const dL = (p[0] - q[0]) * lightnessWeight;
  const da = p[1] - q[1];
  const db = p[2] - q[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** How colourful a sample is (0 = grey). */
export function chroma(lab: Lab): number {
  return Math.hypot(lab[1], lab[2]);
}

/** Hue angle in degrees, 0..360 (red is near 40, yellow near 95, green near 150, blue near 290). */
export function hueDeg(lab: Lab): number {
  const degrees = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function labCurveInverse(t: number): number {
  const cubed = t * t * t;
  return cubed > 216 / 24389 ? cubed : (116 * t - 16) / (24389 / 27);
}

/** Back from L*a*b* to sRGB, for showing a sampled colour on screen. Clamped to what a screen can show. */
export function labToRgb(lab: Lab): RGB {
  const fy = (lab[0] + 16) / 116;
  const fx = fy + lab[1] / 500;
  const fz = fy - lab[2] / 200;
  const x = labCurveInverse(fx) * 0.95047;
  const y = labCurveInverse(fy);
  const z = labCurveInverse(fz) * 1.08883;
  return [
    linearToSrgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    linearToSrgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    linearToSrgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  ];
}
