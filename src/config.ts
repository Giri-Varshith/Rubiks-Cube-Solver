// Every tunable number in the app lives here. See the README's tuning section.
export const CONFIG = {
  // --- Finding the face in the picture ---
  /** The camera frame is scaled to this width (px) before looking for the cube. */
  detectWidth: 480,
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

  // --- Telling the six faces apart ---
  /** Two centre colours closer than this are treated as the same face. */
  sameCentreDelta: 13,
  /** How much brightness counts (0..1) when comparing centre colours. */
  lightnessWeight: 0.5,

  // --- Solve screen ---
  /** Length of one move animation (ms). */
  moveMs: 450,
};
