// Every tunable number in the app lives here. See the README's tuning section.
export const CONFIG = {
  // --- Finding the face in the picture ---
  /** The camera frame is scaled to this width (px) before looking for the cube. */
  detectWidth: 480,
  /** Edge-finding thresholds (Canny). Lower finds fainter edges but also more clutter. */
  cannyLow: 30,
  cannyHigh: 90,
  /** Smallest sticker side worth considering, as a fraction of detectWidth. */
  minStickerFrac: 0.02,
  /** Largest sticker side worth considering, as a fraction of detectWidth. */
  maxStickerFrac: 0.25,
  /** A sticker must fill at least this much of its bounding rotated rectangle. */
  minRectFill: 0.7,
  /** A sticker's long side may be at most this many times its short side. */
  maxAspect: 1.35,
  /** How far (as a fraction of cell spacing) a sticker may sit from its expected grid position. */
  latticeTolerance: 0.35,
  /** How many of the eight cells around the centre must be found. */
  minNeighbours: 6,

  // --- Reading colours ---
  /** Side of the colour-sampling patch, as a fraction of cell spacing. */
  patchFrac: 0.33,

  // --- Deciding a reading is steady ---
  /** How long (ms) a reading must hold still before it is captured. */
  steadyMs: 700,
  /** Allowed drift of the grid centre during that time, as a fraction of cell spacing. */
  steadyMoveFrac: 0.15,
  /** Allowed colour drift per cell during that time (Lab distance). */
  steadyColorDelta: 8,
  /** If all nine cells are within this of the last capture, it is still the same face. */
  sameFaceDelta: 10,

  // --- Telling the six faces apart (by the colour of the centre square) ---
  // Brightness is deliberately ignored: the same face shown a little brighter,
  // darker or with a soft reflection must still count as the same face.
  /** Two centres whose hues are within this many degrees are the same face. Red and orange are about 20 apart. */
  sameHueDeg: 12,
  /** Centres less colourful than this are both treated as white. */
  greyChroma: 30,
  /** If one centre is less than this fraction as colourful as the other, they are different faces (white vs yellow). */
  minChromaRatio: 0.5,

  // --- Solver ---
  /** Give up on working out a solution after this long (ms) and offer to scan again. */
  solveTimeoutMs: 20000,

  // --- Solve screen ---
  /** Length of one move animation (ms). */
  moveMs: 450,

  // --- Scan screen ---
  /** Time between looks at the camera (ms). 80 is about twelve a second. */
  scanIntervalMs: 80,
  /** With no face found for this long (ms), suggest the tips and Line-up mode. */
  nothingSeenMs: 8000,
};
