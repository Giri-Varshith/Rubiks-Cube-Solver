# Rubik's Cube Solver — Design (V1)

Date: 2026-11-10
Status: awaiting review

## 1. Purpose

The user cannot solve a Rubik's cube and wants to get theirs solved. They hold
the cube up to the laptop webcam; the app works out the faces, the colours and
how the cube is being held, then guides them move by move to a solved cube.

Constraints from the user:

- Free. No paid services, accounts or API keys.
- Open-source libraries wherever possible.
- No security risk: everything runs locally, nothing leaves the laptop.
- Runs on this laptop (Windows 11, Node 24 already installed).
- Standard 3x3x3 cube with the standard six colours.

Assumption (not stated by the user): the built-in webcam in ordinary room
lighting.

## 2. Scope

### In V1

1. Scan the six faces by webcam, in any order, each turned any way.
2. Work out automatically how the six faces fit together.
3. Review screen to check and correct what was read.
4. Compute a short solution (about 20 moves).
5. Animated 3D step-by-step guide with plain-language move descriptions.
6. Re-scan at any time to get a fresh solution from the current position.
7. Line-up fallback for scanning when free detection struggles.

### Deferred to V2 (not built now, but not designed out)

- "Teach me the method" mode: layer-by-layer solution with explanations.
- Camera confirms every move as it is made and advances automatically.

### Out of scope

- Cubes other than 3x3x3, non-standard colour schemes, phone/tablet layouts,
  hosting on the internet, saving sessions.

## 3. User flow

Three screens, always in this order, with a way back to Scan from the others.

### 3.1 Scan

- Live camera picture, shown mirrored (like a mirror, so movements feel
  natural). Reading is always done on the un-mirrored picture.
- Six empty slots across the bottom. Each fills with the nine colours and a
  small snapshot when a face is captured.
- The app outlines the 3x3 grid it has found. When the reading has held steady
  for about 0.7 seconds, the face is captured with a visible flash and a
  "Got it — show another face" message.
- Showing a face that is already captured replaces that slot (this is how the
  user re-does a bad capture).
- Tips are shown: even lighting, avoid glare, keep fingers off the face.
- A "Line-up mode" switch: a fixed square is drawn in the middle of the
  picture; the user fills it with the face and presses Space or a Capture
  button. No automatic finding is involved.
- A "Show what the app sees" switch: draws the candidate squares, the chosen
  grid and the sampled colour of each cell. This is for tuning and for the
  user to report problems.
- When all six slots are full, the app moves to Review.

### 3.2 Review

- Six cards, one per face. Each card shows the snapshot taken by the camera
  beside the 3x3 grid of colours the app read, in the same orientation, so the
  user can compare them without picking the cube up.
- Clicking a grid square opens a six-colour picker to correct it. Centres are
  not editable.
- A status line:
  - valid: "This cube checks out" and a Solve button;
  - not valid: a plain-language reason (section 6.3) with the suspect squares
    outlined, and Solve disabled.
- If more than one arrangement of the faces is valid (only happens for very
  symmetric patterns), the user flips through the candidates in a 3D view and
  picks the one that matches their cube.
- If the cube is already solved, say so and stop.
- "Scan again" returns to Scan with all slots cleared.

### 3.3 Solve

- Instruction on how to hold the cube: white centre on top, green centre
  facing you. Shown with the 3D cube in exactly that pose.
- 3D cube in the scanned state. The view can be dragged to look around; a
  button resets it.
- One move at a time. For each move: the notation (for example `R'`), a plain
  description (for example "Right side: turn it down, towards you"), and the
  animation.
- Controls: Next, Back, Replay; Right/Left arrow keys and Space do the same.
  A progress line ("Move 7 of 20") and the full move list with the current
  move highlighted.
- "I'm lost — scan again" returns to Scan with all slots cleared.
- After the last move: a "Solved!" message.

## 4. Architecture

A single-page web app, built with Vite and TypeScript, served on
`http://localhost` only. No framework: plain TypeScript and the DOM. No backend.

| Concern | Library | Licence |
|---|---|---|
| Build / dev server | Vite, TypeScript | MIT / Apache-2.0 |
| Finding the face in a frame | OpenCV.js (`@techstark/opencv-js`) | Apache-2.0 |
| Solver (Kociemba two-phase) | `cubejs` | MIT |
| 3D cube | `three` | MIT |
| Tests | Vitest | MIT |

Security posture:

- All dependencies pinned to exact versions; lockfile committed.
- Everything is bundled; no CDN or other network request at runtime.
- The dev server listens on localhost only.
- Camera frames are processed in memory in the browser tab and never stored
  or sent anywhere. Snapshots for the Review screen live only in memory.
- `npm audit` must report no known high or critical issues at delivery.

### 4.1 Modules

Each module has one job and is testable on its own.

```
src/
  main.ts                 app shell: owns app state, switches screens
  cube/
    geometry.ts           facelets <-> 3D stickers; apply a move
    validate.ts           is a 54-facelet cube physically possible, and why not
    assemble.ts           six scanned faces -> full cube (rotation search)
    moves.ts              parse a solution; plain-language text per move
  vision/
    camera.ts             open / close the webcam
    opencv.ts             load OpenCV.js once
    detectFace.ts         frame -> nine sample points, or nothing
    sampleColors.ts       frame + sample points -> nine colours
    colorMath.ts          RGB -> Lab, colour distances
    classify.ts           54 sampled colours -> six colour labels
    stability.ts          decides when a reading is steady enough to capture
  solver/
    solver.worker.ts      runs cubejs off the main thread
    solverClient.ts       promise-based API to the worker
  ui/
    scanScreen.ts
    reviewScreen.ts
    solveScreen.ts
    cube3d.ts             three.js cube, animated moves
    faceGrid.ts           3x3 colour-swatch component
  styles.css
```

Dependencies point one way: `ui` -> `vision`, `cube`, `solver`; `vision` and
`cube` do not know about the UI or about each other; only `opencv.ts` and
`detectFace.ts` touch OpenCV; only `solver.worker.ts` touches cubejs; only
`cube3d.ts` touches three.js.

### 4.2 Data model

- `Lab`: `[L, a, b]` colour.
- `ScannedFace`: nine `Lab` samples in row order as seen by the camera, plus a
  snapshot image.
- `Color`: one of `W Y R O B G`.
- `FaceReading`: nine `Color`s in camera row order (after classification).
- `Facelets`: 54-character string in the Kociemba order (U, R, F, D, L, B; nine
  per face), using face letters. This is the format cubejs takes.
- `Move`: face (`U R F D L B`) and amount (1, 2 or 3 quarter turns clockwise).

Colour-to-face mapping (standard scheme): white = U, yellow = D, green = F,
blue = B, red = R, orange = L.

## 5. Vision

### 5.1 Finding the face (`detectFace`)

Input: one camera frame, scaled down to about 480 px wide. Output: nine sample
points (the centres of the nine cells, in row order) plus the grid outline, or
nothing.

1. Greyscale, blur, Canny edges, dilate, find contours.
2. Keep contours that look like a sticker: area within a plausible range,
   fills most of its minimum-area rotated rectangle, roughly square.
3. Take each candidate in turn as the possible centre cell. Build a 3x3
   lattice from its rotation angle and from the spacing to its nearest
   similar-sized neighbours. Count how many of the eight surrounding lattice
   positions have a candidate close by.
4. Accept the best lattice if at least six of the eight neighbours are matched.
   (Cells may be missing: logos on the centre, white stickers against a bright
   background, glare.)
5. The lattice's two axes are chosen so the first points mostly right and the
   second mostly down in the picture, and so they are never mirrored. The
   reading is therefore the true face turned by less than 45 degrees; which
   quarter-turn it really is gets resolved later (section 6.2).

All nine sample points come from the lattice, not from the contours, so a cell
with no detected contour is still sampled.

In line-up mode this step is skipped: the lattice is the fixed on-screen
square.

### 5.2 Sampling (`sampleColors`)

For each sample point, take the median colour of a small patch (about a third
of a cell wide) from the full-resolution frame and convert it to Lab.

### 5.3 Steadiness (`stability`)

A reading is captured when, over about 0.7 seconds of consecutive detections,
the grid has barely moved and no cell colour has changed by more than a small
threshold. The captured values are the per-cell median over that window.

### 5.4 Which slot (`scanScreen` using `colorMath`)

Faces are told apart by their centre cell colour. A newly captured face
replaces the slot whose centre is closest in colour if that distance is under
a threshold; otherwise it fills a new slot. Lightness is weighted less than
hue so a change in brightness does not create a "new" face.

### 5.5 Naming the colours (`classify`)

Done once all six faces are captured, over all 54 samples together, so it
adapts to the room's lighting and to this particular cube.

1. The six centre samples are the anchors.
2. Name the anchors: the least saturated is white; the other five are matched
   to red, orange, yellow, green, blue by hue (best of the 120 pairings).
3. Assign the other 48 samples to the anchors by colour distance, with exactly
   eight per anchor (minimum-cost balanced assignment). This is what keeps
   red and orange apart: the nine reddest are red, the nine most orange are
   orange.

Manual corrections in Review override the result per square.

## 6. Cube logic

### 6.1 Geometry (`geometry`)

One source of truth for where every facelet sits in 3D: each of the 54
facelets maps to a cubie position `(x, y, z)` in `{-1, 0, 1}` and an outward
normal. A move is a quarter-turn rotation of the nine cubies in one layer.
Both the logical `applyMove(facelets, move)` and the 3D view are built on this
mapping, so what is animated cannot disagree with what is computed.

### 6.2 Assembly (`assemble`)

Input: six `FaceReading`s, each turned by an unknown number of quarter turns.
The centre colour says which face each one is.

- Try all 4^6 = 4096 combinations of quarter turns. For each, build the
  `Facelets` string and validate it.
- Collect the distinct valid results.
  - Exactly one: that is the cube.
  - More than one: return them all; Review asks the user to choose.
  - None: return the combination with the most correct pieces as a best guess,
    together with the validation problems, so Review can point at the suspect
    squares.

### 6.3 Validation (`validate`)

A cube is possible when:

- each colour appears exactly nine times;
- the six centres are six different colours;
- every edge position holds a real edge piece and all twelve are different;
- every corner position holds a real corner piece and all eight are different;
- total edge flip is even; total corner twist is a multiple of three;
- edge and corner permutations have the same parity.

Each failed rule has a plain-language message, for example:

- "There are 10 red squares and 8 orange ones. One of the red squares is
  probably orange."
- "Two pieces have the same colours (white/green edge). One of these squares
  was read wrongly."
- "One corner looks twisted. Check the highlighted squares; if they are right,
  a corner of your cube has been turned by hand and it cannot be solved by
  normal moves."

### 6.4 Solving (`solver`)

- The worker starts when the app loads and builds the solver's tables in the
  background (a few seconds, once per page load).
- `solve(facelets)` returns a list of `Move`s. If the user reaches Solve
  before the tables are ready, a "Preparing solver…" message is shown.
- The result is checked before it is shown: applying the moves to the scanned
  cube with `applyMove` must give the solved cube. If not, an error is shown
  instead of wrong instructions.

### 6.5 Move descriptions (`moves`)

Written for someone holding the cube white-up, green-front, who does not know
notation:

| Move | Text |
|---|---|
| R / R' / R2 | Right side: turn it up, away from you / down, towards you / halfway round |
| L / L' / L2 | Left side: turn it down, towards you / up, away from you / halfway round |
| U / U' / U2 | Top layer: turn it to the left / to the right / halfway round |
| D / D' / D2 | Bottom layer: turn it to the right / to the left / halfway round |
| F / F' / F2 | Front face: turn it clockwise / anticlockwise / halfway round |
| B / B' / B2 | Back face: turn it anticlockwise as you look from the front / clockwise as you look from the front / halfway round |

## 7. Error handling

| Situation | Behaviour |
|---|---|
| Camera permission refused or no camera | Explain how to allow it; offer Retry |
| OpenCV fails to load | Message; line-up mode still works without it |
| No face found for a while | Show the tips and suggest line-up mode |
| Cube not valid after scan | Review explains why and highlights squares; Solve disabled |
| Several valid arrangements | Review asks the user to choose |
| Solver not ready | "Preparing solver…" until ready |
| Solution fails its self-check | Error message; no moves shown |

## 8. Testing

Automated (Vitest, run with `npm test`):

- `geometry`: every one of the 18 moves gives the same result as cubejs's own
  move code; four identical quarter turns return the start state.
- `validate`: random valid cubes pass; a swapped pair of stickers, a flipped
  edge, a twisted corner and a swapped pair of edges each fail with the right
  reason.
- `assemble`: take random valid cubes, cut them into six faces, turn each by a
  random number of quarter turns and shuffle the order; the original cube must
  come back uniquely. Also the no-valid-arrangement and multi-arrangement
  paths.
- `colorMath`, `classify`: synthetic 54-sample sets with lighting tint and
  noise are labelled correctly; red and orange stay apart.
- `detectFace`: computer-generated face images (drawn into a pixel buffer) at
  a range of positions, sizes and tilts, with background clutter, noise and a
  missing centre contour; the nine sample points must land inside the right
  cells. Frames with no cube must return nothing.
- `stability`, `moves`: unit tests.
- End to end in logic: random cube -> six rotated faces -> assemble -> solve ->
  apply the moves -> solved.

Manual, in the browser: the three screens driven with the camera replaced by
generated images, including the 3D animation and the keyboard controls.

Not testable by the developer: a real cube in front of the real webcam.
Thresholds for detection, steadiness and slot matching are kept together in
one config object so they can be tuned from the user's feedback, and the
"Show what the app sees" view exists to make that feedback concrete.

## 9. Running it

- First time: `npm install`.
- Every time: `npm start`, which opens the app in the default browser at a
  localhost address. A `start.bat` does the same on double-click.
- A short README covers these steps, camera permission and scanning tips.

## 10. V2 hooks

- Teaching mode needs a second solver that produces a staged, explained move
  list. The Solve screen takes a list of moves with optional stage labels, so
  it can display either.
- Per-move tracking can reuse `detectFace` and `sampleColors` during the Solve
  screen and compare what it sees with the expected front face from
  `geometry`.
