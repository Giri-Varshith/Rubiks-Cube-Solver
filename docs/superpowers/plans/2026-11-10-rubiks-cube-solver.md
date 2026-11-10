# Rubik's Cube Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web app that scans a 3x3x3 Rubik's cube by webcam, works out the full cube state, and guides the user move by move to a solved cube.

**Architecture:** Single-page Vite + TypeScript app with no backend and no UI framework. Pure-logic modules (`cube`, `vision`, `solver`) are tested in Node with Vitest; thin DOM screens (`ui`) sit on top. One geometry module is the source of truth for both move logic and the 3D view.

**Tech Stack:** Vite, TypeScript, Vitest, three.js, OpenCV.js (`@techstark/opencv-js`), cubejs.

**Spec:** `docs/superpowers/specs/2026-11-10-rubiks-cube-solver-design.md`

## Global Constraints

- Free and open source only; no accounts, API keys, CDNs or runtime network requests. Everything is bundled.
- Dev server listens on localhost only (Vite default; do not set `server.host`).
- Dependencies pinned to exact versions (no `^` or `~`); `package-lock.json` kept.
  - `cubejs` 1.3.2, `@techstark/opencv-js` 4.12.0-release.1.
  - `three`, `@types/three`, `vite`, `typescript`, `vitest`: the newest version published at least 14 days before 2026-11-10 (read from `npm view <pkg> time`).
- `npm audit` reports no high or critical issues at delivery.
- Camera frames and snapshots stay in memory; nothing is written to disk or storage.
- Only `vision/opencv.ts` and `vision/detectFace.ts` import OpenCV; only `solver/solveCore.ts` imports cubejs; only `ui/cube3d.ts` imports three. `cube/` and `vision/` never import from `ui/` or from each other, except that both may import `cube/types.ts`.
- All tunable numbers live in `src/config.ts`; no thresholds inline elsewhere.
- Colour-to-face mapping: W=U, Y=D, G=F, B=B, R=R, O=L. Facelet order: U, R, F, D, L, B, nine per face, row-major as seen from outside (U with B at top, D with F at top, side faces with U at top).
- User-facing text is plain language with no cube notation, except the move letter shown beside its description.
- Version control: git, branch `v1-build`. Commit at the end of every task with a `feat:`/`test:`/`docs:` style message.
- Tests are colocated as `src/**/<name>.test.ts`. Run with `npm test` (`vitest run`).

## Review Focus

1. **Face tilted away from the camera (perspective), not just rotated in the picture.** Expected: the grid is found correctly or not at all; never a wrong grid. Test in Task 7.
2. **A finger or glare crossing one cell while the cube is otherwise still.** Expected: no capture while any cell is changing. Test in Task 8.
3. **Red and orange centres under warm light look close; the same face re-shown slightly brighter looks different.** Expected: red and orange stay two slots; the brighter repeat replaces its own slot. Test in Task 6.
4. **Faces that do not belong to one consistent cube** (a layer was turned between captures, or misreads). Expected: Review gets a best guess and reasons; nothing throws. Test in Task 4.
5. **Next pressed repeatedly while a move is still animating.** Expected: extra presses are ignored; the step counter and the 3D cube never disagree. Test in Task 9.

## File Structure

```
package.json  tsconfig.json  vite.config.ts  index.html  start.bat  README.md
src/
  main.ts                 app shell and screen switching
  config.ts               every tunable number
  cubejs.d.ts             type declaration for cubejs
  styles.css
  cube/
    types.ts              Color, Face, Facelets, Move, FaceReading, constants
    geometry.ts           facelet <-> 3D sticker mapping; applyMove
    moves.ts              parse / format / invert / describe moves
    validate.ts           validity rules and plain-language problems
    assemble.ts           six readings -> cube by rotation search
  vision/
    colorMath.ts          RGB -> Lab, distance, chroma, hue
    classify.ts           54 Lab samples -> colour names
    slots.ts              which slot a captured face goes into
    sampleColors.ts       frame + points -> nine Lab
    synthetic.ts          draw a fake cube face into a pixel buffer
    opencv.ts             load OpenCV.js once
    detectFace.ts         frame -> nine sample points
    stability.ts          when is a reading steady
    camera.ts             webcam open/close/grab, error text
  solver/
    solveCore.ts          cubejs wrapper with self-check
    solver.worker.ts      runs solveCore off the main thread
    solverClient.ts       promise API to the worker
  ui/
    faceGrid.ts           3x3 swatch component
    cube3d.ts             three.js cube
    solveController.ts    step position logic for the Solve screen
    scanScreen.ts  reviewScreen.ts  solveScreen.ts
```

---

### Task 1: Project scaffold and library smoke tests

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/styles.css`, `src/config.ts`, `src/cubejs.d.ts`, `src/cube/types.ts`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Produces (`src/cube/types.ts`):
  ```ts
  export type Color = 'W' | 'Y' | 'R' | 'O' | 'B' | 'G';
  export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
  export const FACES: readonly Face[];            // ['U','R','F','D','L','B']
  export const COLOR_TO_FACE: Record<Color, Face>; // W:U Y:D G:F B:B R:R O:L
  export const FACE_TO_COLOR: Record<Face, Color>;
  export const COLOR_HEX: Record<Color, string>;   // W #f4f4f4, Y #ffd500, R #c41e3a, O #ff6f00, B #0051ba, G #009e60
  export type Facelets = string;                   // 54 chars
  export const SOLVED: Facelets;                   // 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
  export interface Move { face: Face; turns: 1 | 2 | 3 }
  export type FaceReading = Color[];               // 9, row order as the camera saw it
  ```
- Produces (`src/config.ts`): `export const CONFIG` with these starting values:
  ```ts
  detectWidth: 480,          // px, frame is scaled to this for detection
  minStickerFrac: 0.02,      // sticker side as a fraction of detectWidth, min
  maxStickerFrac: 0.25,      // max
  minRectFill: 0.7,          // contour area / rotated-rect area
  maxAspect: 1.35,           // long side / short side
  latticeTolerance: 0.35,    // match radius as a fraction of cell pitch
  minNeighbours: 6,          // of 8
  patchFrac: 0.33,           // sample patch as a fraction of cell pitch
  steadyMs: 700,
  steadyMoveFrac: 0.15,      // allowed grid drift as a fraction of cell pitch
  steadyColorDelta: 8,       // allowed per-cell Lab drift
  sameFaceDelta: 10,         // all nine cells within this of last capture = same face still shown
  sameCentreDelta: 13,       // slot matching threshold
  lightnessWeight: 0.5,
  moveMs: 450,               // animation length
  ```
- Produces (`src/cubejs.d.ts`): `declare module 'cubejs'` typing `Cube.initSolver(): void`, `Cube.fromString(s: string): Cube`, `Cube.random(): Cube`, and instance `asString(): string`, `move(alg: string): Cube`, `solve(maxDepth?: number): string`, `isSolved(): boolean`.

- [ ] **Step 1: Write `package.json`** with scripts `start` (`vite --open`), `build` (`vite build`), `test` (`vitest run`), `"type": "module"`, and the pinned dependencies from Global Constraints. Run `npm install`. Expected: completes; `package-lock.json` created.

- [ ] **Step 2: Write the smoke tests** in `src/smoke.test.ts`:

  ```ts
  test('cubejs solves a scramble', () => {
    Cube.initSolver();
    const c = new Cube(); c.move("R U F' L2 D B");
    const s = c.asString();
    expect(s).toHaveLength(54);
    const d = Cube.fromString(s); d.move(d.solve());
    expect(d.isSolved()).toBe(true);
  }, 60_000);

  test('OpenCV loads in Node and has what detection needs', async () => {
    const cv = await loadCvForTest();   // await the module's ready promise / onRuntimeInitialized
    for (const fn of ['cvtColor','GaussianBlur','Canny','dilate','findContours','contourArea','minAreaRect','resize','matFromArray'])
      expect(typeof cv[fn]).toBe('function');
  }, 60_000);
  ```

- [ ] **Step 3: Run `npm test`.** Expected: both pass. If the OpenCV import shape differs from expectation, record the working import in a comment at the top of the test; Task 7's `opencv.ts` uses the same one.

- [ ] **Step 4: Write `tsconfig.json`** (strict, `moduleResolution: bundler`, `lib: ["ES2022","DOM","WebWorker"]`), `vite.config.ts` (defaults plus `test: { environment: 'node' }`), `index.html` with `<div id="app">`, `src/main.ts` rendering the heading "Rubik's Cube Solver", `src/config.ts`, `src/cube/types.ts`, `src/cubejs.d.ts`.

- [ ] **Step 5: Verify.** Run `npx tsc --noEmit` (expected: no errors) and `npm run build` (expected: build succeeds).

---

### Task 2: Cube geometry and moves

**Files:**
- Create: `src/cube/geometry.ts`, `src/cube/moves.ts`
- Test: `src/cube/geometry.test.ts`, `src/cube/moves.test.ts`

**Interfaces:**
- Consumes: `types.ts`.
- Produces (`geometry.ts`):
  ```ts
  export type Vec3 = [number, number, number];
  export interface Sticker { pos: Vec3; normal: Vec3 }
  export const STICKERS: readonly Sticker[];   // 54, index = facelet index
  export function layer(face: Face): { axis: 0 | 1 | 2; coord: -1 | 1 };
  export function quarterTurnAngle(face: Face): number; // radians about the +axis for ONE clockwise turn
  export function applyMove(f: Facelets, m: Move): Facelets;
  export function applyMoves(f: Facelets, ms: Move[]): Facelets;
  ```
- Produces (`moves.ts`):
  ```ts
  export function parseMoves(s: string): Move[];   // "R U2 F'" -> moves; '' or whitespace -> []; throws on anything else
  export function formatMove(m: Move): string;     // "R", "R2", "R'"
  export function invertMove(m: Move): Move;
  export function describeMove(m: Move): string;   // spec section 6.5, verbatim
  ```

Geometry decisions (axes: U=+y, D=-y, F=+z, B=-z, R=+x, L=-x; `r`,`c` are row and column 0..2 within the face):

| Face | `pos` | `normal` |
|---|---|---|
| U | `(c-1, 1, r-1)` | `(0,1,0)` |
| R | `(1, 1-r, 1-c)` | `(1,0,0)` |
| F | `(c-1, 1-r, 1)` | `(0,0,1)` |
| D | `(c-1, -1, 1-r)` | `(0,-1,0)` |
| L | `(-1, 1-r, c-1)` | `(-1,0,0)` |
| B | `(1-c, 1-r, -1)` | `(0,0,-1)` |

A clockwise quarter turn of a face is a rotation of -90 degrees about that face's outward normal (right-hand rule), applied to every sticker whose `pos` lies in the layer. `applyMove` rotates `pos` and `normal`, then looks up the destination facelet index by `(pos, normal)`.

- [ ] **Step 1: Write failing tests** (`geometry.test.ts`):
  - `STICKERS` has 54 entries, all `(pos, normal)` pairs distinct, centre of each face at index `9*f + 4` with `pos === normal`.
  - For each of the 18 moves `X`, `X2`, `X'`: `applyMove(SOLVED, m)` equals `new Cube().move(formatMove(m)).asString()`; and the same from a scrambled start (`"R U F' L2 D B"`).
  - Four quarter turns of any face return the start state.
- [ ] **Step 2: Run** `npm test -- geometry`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `geometry.ts`.**
- [ ] **Step 4: Run** `npm test -- geometry`. Expected: PASS.
- [ ] **Step 5: Write failing tests** (`moves.test.ts`):
  - `parseMoves("R U2 F'")` → `[{face:'R',turns:1},{face:'U',turns:2},{face:'F',turns:3}]`; `parseMoves('  ')` → `[]`; `parseMoves('X')` throws.
  - `formatMove(invertMove({face:'R',turns:1}))` → `"R'"`; inverse of `U2` is `U2`.
  - `describeMove` for all 18 moves equals the spec 6.5 table exactly, e.g. `R` → `"Right side: turn it up, away from you"`, `U'` → `"Top layer: turn it to the right"`, `B` → `"Back face: turn it anticlockwise as you look from the front"`, `F2` → `"Front face: turn it halfway round"`.
- [ ] **Step 6: Implement `moves.ts`; run** `npm test -- moves`. Expected: PASS.

---

### Task 3: Validation

**Files:**
- Create: `src/cube/validate.ts`
- Test: `src/cube/validate.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `STICKERS` from `geometry.ts`.
- Produces:
  ```ts
  export type ProblemKind = 'count' | 'badEdge' | 'duplicateEdge' | 'badCorner' | 'duplicateCorner' | 'flip' | 'twist' | 'parity';
  export interface Problem { kind: ProblemKind; message: string; facelets: number[] } // facelets to highlight
  export interface Validation { valid: boolean; problems: Problem[]; correctPieces: number } // 0..20 distinct real pieces
  export function validate(f: Facelets): Validation;
  ```

Decisions:
- Edge and corner positions are derived from `STICKERS` (cubies with two or three stickers), not typed in by hand.
- A real edge has two different, non-opposite face letters; a real corner has three mutually adjacent letters in the correct clockwise order (a mirrored corner is `badCorner`).
- `flip`, `twist` and `parity` are only evaluated when all 20 pieces are real and distinct.
- Message copy (colour names in lower case; `{a}/{b}` are colour names):
  - count: `There are {n} {colour} squares and {m} {other} ones. One of the {colour} squares is probably {other}.` (one problem per over-counted colour, paired with an under-counted one; `facelets` = all squares of the over-counted colour)
  - badEdge / badCorner: `A piece has colours that cannot be together ({a}/{b}[/{c}]). One of these squares was read wrongly.`
  - duplicateEdge / duplicateCorner: `Two pieces have the same colours ({a}/{b}[/{c}] {edge|corner}). One of these squares was read wrongly.`
  - flip: `One edge piece looks flipped. Check the highlighted squares; if they are right, an edge of your cube has been put in backwards and it cannot be solved by normal moves.` (`facelets` = all edge facelets)
  - twist: `One corner looks twisted. Check the highlighted squares; if they are right, a corner of your cube has been turned by hand and it cannot be solved by normal moves.` (`facelets` = all corner facelets)
  - parity: `Two pieces look swapped. Check the squares; if they are right, your cube has been taken apart and put back differently and it cannot be solved by normal moves.` (`facelets` = `[]`)

- [ ] **Step 1: Write failing tests:**
  - `SOLVED` and 50 cubes from `Cube.random().asString()` → `valid`, no problems, `correctPieces === 20`.
  - Recolour one U-face edge sticker on `SOLVED` to `R` (ten R, eight U) → problem kinds include `count`, and the message reads "There are 10 red squares and 8 white ones. One of the red squares is probably white."
  - Swap the two stickers of one edge → exactly `['flip']`.
  - Cycle the three stickers of one corner → exactly `['twist']`.
  - Swap two whole edges (both stickers each) → exactly `['parity']`.
  - Copy the UF edge's colours onto the UR edge and fix counts elsewhere so counts stay 9 each → kinds include `duplicateEdge`, and `correctPieces < 20`.
  - Put U and D colours on one edge → `badEdge`.
  - Every `message` contains no face letters in isolation (regex `/\b[URFDLB]\b/` does not match).
- [ ] **Step 2: Run** `npm test -- validate`. Expected: FAIL.
- [ ] **Step 3: Implement `validate.ts`.**
- [ ] **Step 4: Run** `npm test -- validate`. Expected: PASS.

---

### Task 4: Assembly

**Files:**
- Create: `src/cube/assemble.ts`
- Test: `src/cube/assemble.test.ts`

**Interfaces:**
- Consumes: `validate`, `types.ts`.
- Produces:
  ```ts
  export function rotateReading<T>(cells: T[], quarterTurns: number): T[]; // clockwise, as seen by the viewer
  export interface Assembly {
    candidates: Facelets[];             // distinct valid cubes; length 1 in the normal case
    bestGuess: Facelets;                // candidates[0], else the arrangement with the most correctPieces
    rotations: Record<Face, number>;    // quarter turns applied to each reading to make bestGuess
    problems: Problem[];                // [] when candidates is non-empty
  }
  export function assemble(readings: FaceReading[]): Assembly;  // six readings, six distinct centre colours; throws otherwise
  export function faceletToCell(index: number, rotations: Record<Face, number>): { face: Face; cell: number }; // back to the reading as scanned
  ```

Decision: the face block in the facelet string is `rotateReading(reading, k)` for each `k` in 0..3; all 4^6 combinations are tried. Ties for best guess go to the first found.

- [ ] **Step 1: Write failing tests:**
  - `rotateReading([0..8], 1)` → `[6,3,0,7,4,1,8,5,2]`; four turns is the identity.
  - Helper `cut(f: Facelets, turns: number[], order: number[]): FaceReading[]` in the test file: splits into six blocks, converts letters to colours, un-rotates each by its turn count, shuffles by `order`.
  - For 30 random cubes with random turns and order: `candidates` is `[original]`, `problems` is `[]`.
  - `faceletToCell` round trip: for a random cube and turns, the colour at `bestGuess[i]` equals the colour at the returned face's reading cell, for all 54 `i`.
  - `SOLVED` cut any way → `candidates` is `[SOLVED]` (identical results are de-duplicated).
  - One sticker recoloured in a reading → `candidates` is `[]`, `problems.length > 0`, `bestGuess` has length 54.
  - **Review Focus 4:** three readings from one random cube and three from another → does not throw, `candidates` is `[]`, `problems.length > 0`.
  - Two readings with the same centre colour → throws.
  - Performance: one `assemble` call on a random cube takes under 500 ms.
- [ ] **Step 2: Run** `npm test -- assemble`. Expected: FAIL.
- [ ] **Step 3: Implement `assemble.ts`.**
- [ ] **Step 4: Run** `npm test -- assemble`. Expected: PASS.

---

### Task 5: Solver

**Files:**
- Create: `src/solver/solveCore.ts`, `src/solver/solver.worker.ts`, `src/solver/solverClient.ts`
- Test: `src/solver/solveCore.test.ts`

**Interfaces:**
- Consumes: `applyMoves`, `parseMoves`, `SOLVED`.
- Produces (`solveCore.ts`):
  ```ts
  export function initTables(): void;                 // idempotent
  export function solveFacelets(f: Facelets): Move[]; // [] for SOLVED; throws Error('Solution failed its self-check') if applying the moves does not give SOLVED
  ```
- Produces (`solverClient.ts`):
  ```ts
  export function initSolver(): Promise<void>;        // starts the worker once; resolves when tables are built
  export function solve(f: Facelets): Promise<Move[]>; // waits for init; rejects with the worker's error message
  ```
  Worker messages: in `{ id: number; facelets: Facelets }`, out `{ ready: true }` | `{ id; moves: Move[] }` | `{ id; error: string }`.

- [ ] **Step 1: Write failing tests** (60 s timeout):
  - `solveFacelets(SOLVED)` → `[]`.
  - For 20 random cubes: `applyMoves(f, solveFacelets(f)) === SOLVED` and length ≤ 24.
  - End to end: random cube → `cut` (from Task 4's test helper, moved to `src/cube/testHelpers.ts`) → `assemble` → `solveFacelets(candidates[0])` → `applyMoves` gives `SOLVED`.
- [ ] **Step 2: Run** `npm test -- solveCore`. Expected: FAIL.
- [ ] **Step 3: Implement `solveCore.ts`**, then the worker and client (worker created with `new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })`).
- [ ] **Step 4: Run** `npm test -- solveCore` (expected: PASS) and `npm run build` (expected: succeeds, proving the worker bundles with cubejs).

---

### Task 6: Colour maths, classification and slots

**Files:**
- Create: `src/vision/colorMath.ts`, `src/vision/classify.ts`, `src/vision/slots.ts`
- Test: `src/vision/colorMath.test.ts`, `src/vision/classify.test.ts`, `src/vision/slots.test.ts`

**Interfaces:**
- Produces (`colorMath.ts`):
  ```ts
  export type RGB = [number, number, number];   // 0..255 sRGB
  export type Lab = [number, number, number];   // CIE L*a*b*, D65
  export function rgbToLab(rgb: RGB): Lab;
  export function labDistance(a: Lab, b: Lab, lightnessWeight?: number): number; // Euclidean, L difference scaled; default weight 1
  export function chroma(lab: Lab): number;
  export function hueDeg(lab: Lab): number;     // 0..360
  ```
- Produces (`classify.ts`):
  ```ts
  export function nameAnchors(centres: Lab[]): Color[];      // six in, six distinct names out
  export function classify(faces: Lab[][]): FaceReading[];   // six faces of nine; index 4 is the centre
  ```
- Produces (`slots.ts`):
  ```ts
  export interface ScannedFace { samples: Lab[]; snapshot: string } // snapshot = data URL, '' in tests
  export function placeFace(slots: ScannedFace[], face: ScannedFace): { slots: ScannedFace[]; index: number; replaced: boolean };
  ```

Decisions:
- `nameAnchors`: the lowest-chroma centre is `W`. Sort the other five by `hueDeg`; their cyclic order must be R, O, Y, G, B. Of the five cyclic shifts, pick the one with the smallest total circular distance to the reference hues R 38, O 60, Y 93, G 150, B 290.
- `classify`: cost matrix of the 48 non-centre samples against each anchor repeated eight times, `labDistance` with weight 1; solve with the Hungarian algorithm (own implementation in `classify.ts`, about 40 lines). Centres take their anchor's name.
- `placeFace`: compare centre samples with `labDistance(a, b, CONFIG.lightnessWeight)`. If the nearest slot is under `CONFIG.sameCentreDelta`, replace it; otherwise append. Returns a new array.
- Reference cube colours for tests (sRGB): W `[235,235,235]`, Y `[240,210,20]`, R `[190,30,40]`, O `[245,110,20]`, B `[20,70,180]`, G `[20,150,70]`. Test helper `light(rgb, {gain, tint:[r,g,b], noise, rng})` multiplies channels by `gain*tint`, adds seeded noise, clamps.

- [ ] **Step 1: Write failing tests:**
  - `colorMath`: white `[255,255,255]` → L≈100, a≈0, b≈0 (±0.5); `[255,0,0]` → `[53.2, 80.1, 67.2]` (±0.5); `labDistance` with weight 0 ignores lightness.
  - `nameAnchors`: reference colours in any order are named correctly under each of: neutral light; warm tint `[1.1,1.0,0.8]`; cool tint `[0.9,1.0,1.15]`; dim gain 0.6.
  - `classify`: build 54 samples from 20 random cubes (colours from the facelet string, shuffled face order, random face turns), noise ±8 per channel, under each of the four lightings → every reading equals the truth.
  - `classify` always returns exactly nine of each colour, even when red and orange references are replaced by near-identical colours.
  - `slots` — **Review Focus 3:** under the warm tint, a red-centred face then an orange-centred face → two slots. A red-centred face then the same face at gain 0.85 → one slot, `replaced: true`, and it holds the second face's samples. Six different centres → six slots.
- [ ] **Step 2: Run** `npm test -- vision`. Expected: FAIL.
- [ ] **Step 3: Implement the three modules.**
- [ ] **Step 4: Run** `npm test -- vision`. Expected: PASS.

---

### Task 7: Sampling and face detection

**Files:**
- Create: `src/vision/sampleColors.ts`, `src/vision/synthetic.ts`, `src/vision/opencv.ts`, `src/vision/detectFace.ts`
- Test: `src/vision/sampleColors.test.ts`, `src/vision/detectFace.test.ts`

**Interfaces:**
- Consumes: `rgbToLab`, `CONFIG`.
- Produces (`sampleColors.ts`):
  ```ts
  export interface Frame { data: Uint8ClampedArray; width: number; height: number } // RGBA, same shape as ImageData
  export interface Point { x: number; y: number }
  export function sampleColors(frame: Frame, points: Point[], patchPx: number): Lab[]; // per-channel median of a square patch, clipped to the frame
  ```
- Produces (`synthetic.ts`):
  ```ts
  export interface FaceRender {
    width: number; height: number;
    colors: RGB[];                 // nine, row order
    cx: number; cy: number;        // face centre, px
    size: number;                  // face side, px
    angleDeg?: number;             // in-picture rotation, default 0
    shear?: number;                // horizontal squeeze 0..0.4 imitating a tilt away from the camera, default 0
    gapFrac?: number;              // dark gap between cells as a fraction of a cell, default 0.12
    background?: RGB | 'clutter';  // 'clutter' = seeded random rectangles; default [60,60,60]
    noise?: number;                // per-channel, default 0
    seed?: number;
  }
  export function renderFace(o: FaceRender): Frame;
  export function cellCentre(o: FaceRender, cell: number): Point;      // where cell 0..8 truly is
  ```
- Produces (`opencv.ts`): `export function loadOpenCV(): Promise<any>;` — resolves once, using the import shape proved in Task 1.
- Produces (`detectFace.ts`):
  ```ts
  export interface Detection {
    points: Point[];        // nine sample points, row order, in frame pixels
    corners: Point[];       // four outline corners, clockwise from top-left
    pitch: number;          // cell spacing in frame pixels
    candidates: Point[][];  // sticker-like quads found, for the debug view
  }
  export function detectFace(cv: any, frame: Frame): Detection | null;
  export function fixedLattice(width: number, height: number): Detection; // line-up mode: square of side 0.6*min(width,height), centred
  ```

Algorithm for `detectFace` (spec 5.1): resize to `CONFIG.detectWidth` → grey → 5x5 Gaussian blur → Canny(30, 90) → dilate 3x3 twice → `findContours` (`RETR_LIST`) → keep contours whose `minAreaRect` side is within `minStickerFrac..maxStickerFrac` of the width, with `contourArea / rect area ≥ minRectFill` and aspect ≤ `maxAspect`; drop a candidate whose centre lies inside a smaller kept candidate (outer outlines). For each candidate as centre: axis `u` = the rect's side direction closest to +x, `v` = `u` rotated +90 degrees in image coordinates (so `u × v > 0`, never mirrored); pitch = median distance to its nearest similar-sized (±30 %) candidates lying within 25 degrees of `±u` or `±v`; count neighbours within `latticeTolerance × pitch` of the eight lattice positions. Accept the best with at least `minNeighbours`; refine the centre, `u`, `v` and pitch by least squares over the matched candidates; scale the results back to frame pixels. Every `cv.Mat` created is deleted before returning.

- [ ] **Step 1: Write failing tests** (`sampleColors.test.ts`): on a `renderFace` image with no noise, sampling at `cellCentre` gives each cell's Lab within 1.0; with 5 % salt noise the median still gives it within 3.0; a point at the frame edge does not throw.
- [ ] **Step 2: Implement `synthetic.ts` and `sampleColors.ts`; run** `npm test -- sampleColors`. Expected: PASS.
- [ ] **Step 3: Write failing tests** (`detectFace.test.ts`, 60 s timeout, 640x480 frames, colours from a random cube face using Task 6's reference colours). "Correct" means: non-null, and each of the nine `points` is within 0.3 × true cell size of a distinct true cell centre, and the mapping true→detected is the identity or a quarter-turn rotation of the grid, never a mirror.
  - Straight on, centred, size 200 → correct with rotation 0.
  - Angles -40, -20, 10, 30 degrees → correct.
  - Sizes 90, 150, 300 at off-centre positions → correct.
  - `background: 'clutter'`, noise 6 → correct for 10 seeds.
  - All-white face on background `[200,200,200]` → correct or null (never wrong).
  - Centre cell drawn with a black blob covering half of it (logo) → correct.
  - **Review Focus 1:** `shear` 0.15 → correct; `shear` 0.4 → correct or null, never wrong.
  - Plain background, clutter only, and a 2x2 arrangement of squares → null.
  - `fixedLattice(640,480)`: nine points inside the centred 288 px square, row order.
- [ ] **Step 4: Run** `npm test -- detectFace`. Expected: FAIL.
- [ ] **Step 5: Implement `opencv.ts` and `detectFace.ts`.**
- [ ] **Step 6: Run** `npm test -- detectFace`. Expected: PASS. Tune `CONFIG` values, not the tests, if a case fails; if a threshold in this plan cannot pass, change it in `config.ts` and note the new value in the README's tuning section.

---

### Task 8: Stability tracker

**Files:**
- Create: `src/vision/stability.ts`
- Test: `src/vision/stability.test.ts`

**Interfaces:**
- Consumes: `Detection`, `Lab`, `labDistance`, `CONFIG`.
- Produces:
  ```ts
  export class StabilityTracker {
    push(timeMs: number, det: Detection | null, colors: Lab[] | null): Lab[] | null; // per-cell medians when a capture fires, else null
    progress(): number;   // 0..1, how far through the steady window
    reset(): void;        // forget everything, including the last capture
  }
  ```

Rules:
- A window starts at the first detection. It restarts when detection is lost, when the centre point has moved more than `steadyMoveFrac × pitch` from the window's first point, or when any cell differs from the window's first reading by more than `steadyColorDelta`.
- When the window reaches `steadyMs`, fire: return the per-cell, per-channel median of the window's readings.
- After firing, do not fire again while all nine cells stay within `sameFaceDelta` of the fired reading. A different face (any cell beyond `sameFaceDelta`) starts a new window as normal.

- [ ] **Step 1: Write failing tests** (times fed by hand, 15 readings per second):
  - Steady identical readings fire once, at the first push at or after 700 ms, and return the readings.
  - Continuing the same readings for 3 more seconds does not fire again.
  - A `null` detection at 400 ms restarts: fires at 400 + 700.
  - Grid drifting by 0.5 × pitch each push never fires.
  - **Review Focus 2:** eight cells constant, one cell alternating between two colours 30 apart → never fires; once it stops alternating, fires 700 ms later.
  - After firing, a reading with different colours fires again 700 ms later.
  - `progress()` is 0 with no detection and about 0.5 at 350 ms.
  - Median: with one outlier reading within the allowed drift, the returned cell equals the common value.
- [ ] **Step 2: Run** `npm test -- stability`. Expected: FAIL.
- [ ] **Step 3: Implement `stability.ts`.**
- [ ] **Step 4: Run** `npm test -- stability`. Expected: PASS.

---

### Task 9: 3D cube and Solve screen

**Files:**
- Create: `src/ui/cube3d.ts`, `src/ui/solveController.ts`, `src/ui/solveScreen.ts`
- Modify: `src/main.ts`, `src/styles.css`
- Test: `src/ui/solveController.test.ts`

**Interfaces:**
- Consumes: `STICKERS`, `layer`, `quarterTurnAngle`, `applyMove`, `invertMove`, `formatMove`, `describeMove`, `COLOR_HEX`, `FACE_TO_COLOR`, `CONFIG.moveMs`.
- Produces (`solveController.ts`):
  ```ts
  export class SolveController {
    constructor(start: Facelets, moves: Move[]);
    readonly moves: Move[];
    index: number;                 // moves done so far, 0..moves.length
    state: Facelets;               // cube after `index` moves
    busy: boolean;
    next(): Move | null;           // the move to animate; null if busy or at the end; sets busy
    back(): Move | null;           // the INVERSE of the last move, to animate; null if busy or at the start; sets busy
    replay(): { rewind: Facelets; move: Move } | null; // state before the last move, and that move; null if busy or at the start; sets busy
    settle(): void;                // animation finished; clears busy
    get done(): boolean;
  }
  ```
- Produces (`cube3d.ts`):
  ```ts
  export class Cube3D {
    constructor(container: HTMLElement);       // fills the container; drag to orbit
    setState(f: Facelets): void;               // instant
    animateMove(m: Move, ms?: number): Promise<void>;
    resetView(): void;                         // camera at (4.5, 4, 6) looking at the origin: top, front and right visible
    dispose(): void;
  }
  ```
- Produces (`solveScreen.ts`): `export function mountSolveScreen(root: HTMLElement, o: { facelets: Facelets; moves: Move[]; onRescan(): void }): () => void;` (returns unmount).

Decisions:
- `Cube3D` builds 26 dark cubies and 54 coloured sticker planes placed from `STICKERS`; a move rotates the sticker and cubie objects in the layer by `quarterTurnAngle(face) × turns` (for `turns: 3`, animate -1 quarter turn the other way), then calls `setState` with the new facelets so no drift accumulates. Orbit uses three's `OrbitControls` with pan and zoom disabled.
- Screen layout: holding instruction "Hold the cube with the white centre on top and the green centre facing you." at the top; 3D cube; move letter and description; `Move {n} of {total}`; buttons Back, Replay, Next, Reset view, "I'm lost — scan again"; the move list with the current move highlighted. Keys: Right arrow and Space = Next, Left arrow = Back, R = Replay. After the last move the description area reads "Solved!". With zero moves it reads "Your cube is already solved."
- Until Task 11, `main.ts` mounts this screen directly with the scramble `"R U F' L2 D B"` and its solution from `solve()`, showing "Preparing solver…" while waiting.

- [ ] **Step 1: Write failing tests** (`solveController.test.ts`):
  - `next()` through all moves ends with `state === SOLVED`, `done`, and then `next()` returns null.
  - `back()` returns the inverse of the last move and restores the previous `state` and `index`.
  - `replay()` at index 3 returns the state at index 2 and move 3, and leaves `index` at 3.
  - **Review Focus 5:** `next()` twice without `settle()` → second returns null and `index` advances by one only; same for `back()` and for mixing them. After `settle()`, `next()` works again.
  - `back()` and `replay()` at index 0 return null.
- [ ] **Step 2: Run** `npm test -- solveController`. Expected: FAIL.
- [ ] **Step 3: Implement `solveController.ts`; run** the test. Expected: PASS.
- [ ] **Step 4: Implement `cube3d.ts`, `solveScreen.ts`, styles, and the temporary mount in `main.ts`.**
- [ ] **Step 5: Verify in the browser** (`npm start`): the cube shows the scramble; each Next animates one layer and the description matches the motion for R, L, U, D, F, B moves; after the last move every face is one colour; Back, Replay, the keys and rapid clicking behave as specified; no console errors.

---

### Task 10: Scan screen

**Files:**
- Create: `src/vision/camera.ts`, `src/ui/faceGrid.ts`, `src/ui/scanScreen.ts`
- Modify: `src/styles.css`
- Test: `src/vision/camera.test.ts`

**Interfaces:**
- Consumes: `loadOpenCV`, `detectFace`, `fixedLattice`, `sampleColors`, `StabilityTracker`, `placeFace`, `ScannedFace`, `renderFace`, `CONFIG`.
- Produces (`camera.ts`):
  ```ts
  export function startCamera(video: HTMLVideoElement): Promise<MediaStream>; // { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false }
  export function stopCamera(stream: MediaStream): void;
  export function grabFrame(source: HTMLVideoElement, canvas: HTMLCanvasElement): Frame; // un-mirrored
  export function cameraErrorText(err: unknown): string;
  ```
- Produces (`faceGrid.ts`): `export function createFaceGrid(cssColors: string[], o?: { onCellClick?(cell: number): void; highlight?: number[] }): HTMLElement;`
- Produces (`scanScreen.ts`): `export function mountScanScreen(root: HTMLElement, o: { onComplete(faces: ScannedFace[]): void }): () => void;`

Decisions:
- `cameraErrorText`: `NotAllowedError` → "The browser was not allowed to use the camera. Click the camera icon in the address bar, choose Allow, then press Retry."; `NotFoundError` → "No camera was found. Plug one in or turn it on, then press Retry."; `NotReadableError` → "The camera is being used by another app. Close that app, then press Retry."; anything else → "The camera could not be started. Press Retry."
- The video and the overlay canvas are both flipped with CSS `transform: scaleX(-1)`; all detection uses the un-flipped frame. Text is never drawn on the flipped canvas.
- Processing loop about 12 times per second. Each pass: grab frame → detection (or `fixedLattice` in line-up mode) → `sampleColors` with patch `patchFrac × pitch` → tracker. Overlay: the grid outline, and a ring showing `progress()`.
- On capture: snapshot = the face's bounding square cropped from the frame, scaled to 120x120, as a data URL; `placeFace`; flash the slot; message "Got it — show another face" (or "Updated that face" when `replaced`). Slots show the nine sampled colours as `rgb()` swatches, since names are not known yet.
- Line-up mode: Space or the Capture button captures the current frame immediately, bypassing the tracker.
- "Show what the app sees": also draws `candidates` and writes the nine Lab values under the picture.
- If nothing is detected for 8 seconds, show the tips and "Having trouble? Try Line-up mode."
- If OpenCV fails to load: message "Automatic finding is unavailable. Line-up mode is on." and line-up mode is forced on.
- The track's `ended` event shows `cameraErrorText` with Retry.
- Six slots filled → stop the camera, call `onComplete`.
- Demo mode for testing without a camera, when the page URL has `?demo=1`: frames come from `renderFace` for the six faces of the scramble `"R U F' L2 D B"`, each at a different angle and position, each shown for 2.5 seconds with small jitter, then the next. Nothing else in the screen changes.

- [ ] **Step 1: Write failing tests** (`camera.test.ts`): `cameraErrorText` for the three named errors (objects with a `name` property) and for `new Error('x')` returns the four strings above.
- [ ] **Step 2: Implement `camera.ts`; run** `npm test -- camera`. Expected: PASS.
- [ ] **Step 3: Implement `faceGrid.ts` and `scanScreen.ts`**; mount it from `main.ts` ahead of the Solve screen, logging the faces on completion.
- [ ] **Step 4: Verify in the browser** with `?demo=1`: six slots fill one by one without duplicates, each shows a snapshot and nine colours matching the picture; the outline tracks the face; the debug switch shows candidates; line-up mode captures on Space; no console errors.

---

### Task 11: Review screen and app wiring

**Files:**
- Create: `src/ui/reviewScreen.ts`
- Modify: `src/main.ts`, `src/styles.css`

**Interfaces:**
- Consumes: `classify`, `assemble`, `faceletToCell`, `Assembly`, `createFaceGrid`, `Cube3D`, `initSolver`, `solve`, `mountScanScreen`, `mountSolveScreen`, `COLOR_HEX`, `SOLVED`.
- Produces: `export function mountReviewScreen(root: HTMLElement, o: { faces: ScannedFace[]; onSolve(f: Facelets): void; onRescan(): void }): () => void;`

Decisions:
- On mount: `classify(faces.map(f => f.samples))` → readings; keep them as editable state; `assemble(readings)` after every edit.
- Six cards: snapshot (120x120) beside the grid, both in scanned orientation. Clicking a non-centre cell shows the six-colour picker; choosing a colour updates the reading and re-assembles.
- Status line:
  - one candidate equal to `SOLVED` → "Your cube is already solved." and no Solve button;
  - one candidate → "This cube checks out." and Solve;
  - several → "This pattern can fit together in {n} ways. Pick the one that matches your cube." with a `Cube3D` showing the current candidate, Previous/Next, and Solve for the shown one;
  - none → the first problem's `message`; its `facelets` mapped through `faceletToCell` and outlined on the cards; if there are more problems, "and {n} more" beneath; Solve disabled.
- "Scan again" calls `onRescan`.
- `main.ts`: start `initSolver()` at load. Screens: Scan → Review → Solve. `onSolve` shows "Preparing solver…" until `solve()` resolves, then mounts Solve; if it rejects, shows "Something went wrong working out the solution. Please scan the cube again." with a Scan again button. `onRescan` from either screen mounts a fresh Scan screen. Remove the temporary mounts from Tasks 9 and 10.

- [ ] **Step 1: Implement `reviewScreen.ts` and the wiring in `main.ts`.**
- [ ] **Step 2: Run** `npx tsc --noEmit` and `npm test`. Expected: no type errors; all tests pass.
- [ ] **Step 3: Verify in the browser** with `?demo=1`, full flow: scan completes → Review says "This cube checks out." → Solve → stepping to the end gives a solved cube → "I'm lost — scan again" returns to an empty Scan screen.
- [ ] **Step 4: Verify the error paths in the browser:** in Review, change one square to a wrong colour → the status gives a count message and squares are outlined; change it back → "This cube checks out." again. No console errors.

---

### Task 12: Delivery

**Files:**
- Create: `README.md`, `start.bat`

- [ ] **Step 1: Write `start.bat`:** runs `npm install` if `node_modules` is missing, then `npm start`.
- [ ] **Step 2: Write `README.md`:** what the app does; first run and every run; allowing the camera; scanning tips (even light, no glare, fingers off the face, fill about a third of the picture); what Line-up mode and "Show what the app sees" are for; a tuning section listing each `CONFIG` value with one line on what raising or lowering it does; privacy note (nothing leaves the laptop); licences of the libraries; what is planned for V2.
- [ ] **Step 3: Run** `npm audit --audit-level=high`. Expected: exit code 0.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npm run build`. Expected: all succeed.
- [ ] **Step 5: Final browser pass** with `?demo=1` from a fresh `npm start`, and once without `?demo=1` to confirm the camera permission prompt or the camera error message appears as designed.
