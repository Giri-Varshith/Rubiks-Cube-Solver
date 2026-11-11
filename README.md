# Rubik's Cube Solver

Hold your scrambled 3x3x3 cube up to your webcam. The app reads the six faces,
works out the whole cube, and walks you through a solution of about twenty
moves, one move at a time, with an animated 3D cube.

Everything runs on your own computer. There are no accounts, no API keys and
nothing to pay for. The camera picture never leaves the browser tab.

## Running it

You need [Node.js](https://nodejs.org) 22.12 or newer (24 is fine).

**Easiest:** double-click `start.bat`. The first time, it installs the
libraries (this needs the internet once), then opens the app in your browser.

**From a terminal:**

```bash
npm install
```

```bash
npm start
```

The app opens at `http://localhost:5173`. To stop it, close the terminal
window or press Ctrl+C in it.

The first time, your browser asks whether the page may use the camera. Choose
**Allow**. If you chose Block by mistake, click the camera icon in the address
bar, allow it, and press **Retry**.

## Using it

### 1. Scan

Show each of the six faces to the camera. Any order, turned any way.

- The app draws an outline round the face it has found. Hold still; the
  outline thickens and turns green, then the face is captured into one of the
  six slots on the right.
- Each face you show gets its own picture. Showing the very same face again
  (turned any way) replaces its picture. The `×` on a picture removes it.
  **Start over** clears everything.
- If the same face ends up captured twice, for example after the light
  changed, remove one with `×`. Pictures whose centre squares look alike to the
  camera are outlined in amber as a reminder to check; in warm or dim light
  two different faces can be outlined too, and that is fine.
- Colours that look wrong here do not matter yet. You check and correct every
  square on the next step.
- When all six are in, look over the pictures, then press **Check the cube**.
  Nothing moves on until you do.
- The picture is shown like a mirror so your movements feel natural.

Tips for a good scan:

- Use even light. Avoid a lamp shining straight onto the cube (glare turns
  any colour white).
- Let the face fill about a third of the picture.
- Keep fingers off the face you are showing. Hold the cube by its sides.
- Hold the face flat towards the camera, not tilted away.

**Line-up mode** is the fallback if the app struggles to find the cube. A
dashed square appears; fill it with one face and press Space or **Capture**.
Keep the face upright and square to the picture in this mode.

**Show what the app sees** draws every sticker-like shape it found (yellow),
the nine points it is reading, and the colour values. It is there for
diagnosing problems.

### 2. Check colours

This is where misread colours are corrected.

Each face's photo is shown beside the colours the app read. If a square is
wrong, click it and pick the right colour. The app says whether the cube is
possible; if it is not, it explains why in plain words and outlines the
squares worth checking. **Back to scanning** returns to the camera with your
six faces kept, so you can redo just the one that went wrong.

A cube that is nearly solved can sometimes fit together in more than one way
(a face that is all one colour looks the same whichever way it is turned). The
app then shows the possibilities in 3D and asks you to pick the one that
matches the cube in your hands.

### 3. Solve

Turn your cube so the **white centre is on top** and the **green centre faces
you**, and keep it that way round for every move. The instructions are from
your point of view, not the camera's: "right side" is your right hand.

Press **Next** to see a move, then do the same on your cube. **Show again**
replays it. **Back** steps back one move and tells you how to undo it on your
cube. Keys: Right arrow or Space = Next, Left arrow =
Back, R = show again. Drag the 3D cube to look at it from another side.

If you lose your place, press **I'm lost — scan again**. The app re-reads the
cube and gives a fresh solution from wherever you are.

## If something goes wrong

| What you see | What to do |
|---|---|
| The face is never outlined | Better light, move the cube closer, hold it flat. Otherwise use Line-up mode. |
| Red and orange get mixed up | Scan in whiter, brighter light, then fix the odd square on the Check screen. |
| "There are 10 red squares and 8 orange ones" | One square was misread. Compare the outlined squares with the photos and click to correct. |
| "One corner looks twisted" and the squares are right | A corner of the cube has been turned by hand. It cannot be solved by normal moves; twist that corner back. |
| Every scan says pieces "cannot be together" although the squares match the photos | Your camera software may be flipping the picture. Turn off any "mirror" or "flip" option in the webcam's own settings (or in a virtual camera app) and scan again. |
| Two of the six pictures show the same face | Remove one with `×` and show the face that is missing. |
| "Six pictures are already captured and this face is not one of them" | Two of the pictures show the same face. Remove one with `×`, then show the missing face. |
| "Something went wrong working out the solution" | The solver gave up after 20 seconds. Scan the cube again. |
| "The browser was not allowed to use the camera" | Click the camera icon in the address bar, choose Allow, press Retry. |
| "The camera is being used by another app" | Close the other app (a video call, the Camera app) and press Retry. |

## Trying it without a camera

Add `?demo=1` to the address (`http://localhost:5173/?demo=1`). The app feeds
itself computer-generated cube pictures instead of the webcam, so you can see
the whole flow.

## Tuning

Every threshold lives in `src/config.ts`. If scanning is unreliable with your
cube, camera or lighting, these are the ones to try. Restart is not needed;
the page reloads when you save the file.

| Setting | Default | Effect of changing it |
|---|---|---|
| `detectWidth` | 480 | Picture width used when looking for the cube. Higher finds smaller cubes but is slower. |
| `cannyLow` / `cannyHigh` | 30 / 90 | Edge-finding thresholds. Lower them if the cube's squares are not found in soft light; raise them if far too many yellow shapes appear in the debug view. |
| `minStickerFrac` / `maxStickerFrac` | 0.02 / 0.25 | Smallest and largest sticker considered, as a fraction of the picture width. Lower the first if the cube is far away. |
| `minRectFill` | 0.7 | How square-like a shape must be. Lower it for very rounded stickers; raise it if background shapes get picked up. |
| `maxAspect` | 1.35 | How stretched a sticker may look. Raise it to accept a cube tilted further away. |
| `latticeTolerance` | 0.35 | How far a sticker may sit from its place in the 3x3 grid. Raise it if a face is found only now and then. |
| `minNeighbours` | 6 | How many stickers besides one must be found (so 7 of 9). Lower it if glare hides stickers; raise it if non-cubes are detected. |
| `patchFrac` | 0.33 | Size of the area sampled for each colour. Lower it for small or heavily bevelled stickers. |
| `steadyMs` | 700 | How long to hold still before capture. Raise it if faces are captured mid-movement. |
| `steadyMoveFrac` | 0.15 | How much hand shake is tolerated. Raise it if captures rarely trigger. |
| `steadyColorDelta` | 8 | How much colour flicker is tolerated. Raise it for noisy cameras or dim rooms. |
| `sameFaceDelta` | 10 | How closely all nine squares must match an earlier picture to count as the same face shown again. Raise it if the same face keeps being captured twice; lower it if a different face ever replaces a picture. |
| `sameHueDeg` / `greyChroma` / `minChromaRatio` | 12 / 30 / 0.5 | Only control which pictures get the amber "look alike" outline. They never decide where a face goes. |
| `solveTimeoutMs` | 20000 | How long to wait for a solution before giving up. |
| `scanIntervalMs` | 80 | Time between looks at the camera. Raise it on a slow laptop. |
| `nothingSeenMs` | 8000 | How long with no face found before the app suggests Line-up mode. |
| `moveMs` | 450 | Length of each move animation, in milliseconds. |

## For developers

```bash
npm test
```

runs the automated tests (cube logic, colour naming, face detection on
generated pictures, solver).

```bash
npm run typecheck
```

```bash
npm run build
```

Layout:

- `src/cube/` cube logic: geometry and moves, validity rules, fitting six faces together.
- `src/vision/` camera, face detection (OpenCV.js), colour sampling and naming.
- `src/solver/` the solver, run in a background worker.
- `src/ui/` the three screens and the 3D cube.
- `src/vendor/cubejs/` the solver library's source (see below).
- `docs/superpowers/` the design spec and the implementation plan.

## Libraries and licences

| Library | Used for | Licence |
|---|---|---|
| [OpenCV.js](https://github.com/TechStark/opencv-js) | Finding the cube in the picture | Apache-2.0 |
| [cubejs](https://github.com/ldez/cubejs) | Kociemba two-phase solver | MIT |
| [three.js](https://threejs.org) | 3D cube | MIT |
| [Vite](https://vite.dev), [TypeScript](https://www.typescriptlang.org), [Vitest](https://vitest.dev) | Building and testing | MIT / Apache-2.0 / MIT |

The two cubejs source files are copied into `src/vendor/cubejs/` with their
licence, not installed from npm. The npm package wrongly lists an old copy of
npm itself as a dependency, which would pull in dozens of packages with known
security advisories. The copied files are unchanged apart from being converted
to an ES module.

All versions are pinned exactly in `package.json`. `npm audit` reports no
known vulnerabilities.

## Limits of version 1

- Standard 3x3x3 cubes with the usual colours (white opposite yellow, green
  opposite blue, red opposite orange).
- You hold the cube white-up, green-front while solving, and press Next
  yourself after each move.

Planned for version 2: a "teach me the method" mode that solves layer by layer
with explanations, and the camera checking each move as you make it.
