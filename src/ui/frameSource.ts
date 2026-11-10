// Where the Scan screen gets its pictures from: the webcam, or (with ?demo=1
// in the address) computer-generated cube faces so the app can be tried and
// tested without a camera.
import { rotateReading } from '../cube/assemble';
import { applyMoves } from '../cube/geometry';
import { parseMoves } from '../cube/moves';
import { FACE_TO_COLOR, SOLVED, type Color, type Face } from '../cube/types';
import { grabFrame, startCamera, stopCamera } from '../vision/camera';
import type { RGB } from '../vision/colorMath';
import type { Frame } from '../vision/sampleColors';
import { renderFace } from '../vision/synthetic';

export interface FrameSource {
  /** The element to show on screen. */
  readonly view: HTMLElement;
  /** Holds the most recently grabbed picture, never mirrored. */
  readonly canvas: HTMLCanvasElement;
  /** Whether the view should be shown flipped left-to-right, like a mirror. */
  readonly mirrored: boolean;
  start(): Promise<void>;
  /** The current picture, or null if there is none yet. */
  grab(): Frame | null;
  stop(): void;
  /** Called if the source stops by itself (camera unplugged, permission withdrawn). */
  onEnded: (() => void) | null;
}

export function createCameraSource(): FrameSource {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  let stream: MediaStream | null = null;

  const source: FrameSource = {
    view: video,
    canvas,
    mirrored: true,
    onEnded: null,
    async start() {
      stream = await startCamera(video);
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => source.onEnded?.());
      }
    },
    grab() {
      return stream ? grabFrame(video, canvas) : null;
    },
    stop() {
      if (stream) stopCamera(stream);
      stream = null;
      video.srcObject = null;
    },
  };
  return source;
}

const DEMO_SCRAMBLE = "R U F' L2 D B";
const DEMO_RGB: Record<Color, RGB> = {
  W: [235, 235, 235],
  Y: [240, 210, 20],
  R: [190, 30, 40],
  O: [245, 110, 20],
  B: [20, 70, 180],
  G: [20, 150, 70],
};
/** How each demo face is presented: which face, quarter turns, tilt, position, size. */
const DEMO_SHOTS = [
  { face: 2, turns: 1, angle: -12, cx: 300, cy: 230, size: 190 },
  { face: 0, turns: 3, angle: 18, cx: 360, cy: 250, size: 170 },
  { face: 4, turns: 0, angle: 5, cx: 250, cy: 200, size: 210 },
  { face: 1, turns: 2, angle: -25, cx: 380, cy: 260, size: 160 },
  { face: 5, turns: 1, angle: 30, cx: 320, cy: 240, size: 200 },
  { face: 3, turns: 2, angle: -4, cx: 290, cy: 270, size: 180 },
];
const DEMO_SHOT_MS = 2500;

export function createDemoSource(): FrameSource {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const facelets = applyMoves(SOLVED, parseMoves(DEMO_SCRAMBLE));
  let startedAt = 0;
  let running = false;

  return {
    view: canvas,
    canvas,
    mirrored: false,
    onEnded: null,
    async start() {
      startedAt = performance.now();
      running = true;
    },
    grab() {
      if (!running || !context) return null;
      const elapsed = performance.now() - startedAt;
      const shot = DEMO_SHOTS[Math.floor(elapsed / DEMO_SHOT_MS) % DEMO_SHOTS.length];
      // For the first fifth of each shot the cube is "being turned": nothing to see.
      const turning = elapsed % DEMO_SHOT_MS < DEMO_SHOT_MS / 5;
      const block = facelets
        .slice(9 * shot.face, 9 * shot.face + 9)
        .split('')
        .map((letter) => DEMO_RGB[FACE_TO_COLOR[letter as Face]]);
      const frame = renderFace({
        width: 640,
        height: 480,
        colors: rotateReading(block, shot.turns),
        cx: shot.cx + Math.sin(elapsed / 90),
        cy: shot.cy + Math.cos(elapsed / 70),
        size: turning ? 0 : shot.size,
        angleDeg: shot.angle,
        background: [52, 56, 64],
        noise: 4,
        seed: Math.floor(elapsed),
      });
      context.putImageData(new ImageData(frame.data as Uint8ClampedArray<ArrayBuffer>, 640, 480), 0, 0);
      return frame;
    },
    stop() {
      running = false;
    },
  };
}
