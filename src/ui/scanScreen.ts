// The Scan screen: show the six faces to the camera, in any order, turned any way.
import { CONFIG } from '../config';
import { cameraErrorText } from '../vision/camera';
import { labToRgb, type Lab } from '../vision/colorMath';
import { detectFace, fixedLattice, type Detection } from '../vision/detectFace';
import { sampleColors, type Frame, type Point } from '../vision/sampleColors';
import { placeFace, type ScannedFace } from '../vision/slots';
import { StabilityTracker } from '../vision/stability';
import { button, el } from './dom';
import { createFaceGrid } from './faceGrid';
import { createCameraSource, createDemoSource } from './frameSource';

const LOOP_MS = 80; // about twelve looks a second
const SNAPSHOT_PX = 120;
const NOTHING_SEEN_MS = 8000;

const cssColour = (lab: Lab): string => `rgb(${labToRgb(lab).join(',')})`;

/** Cut the face out of the picture, straightened so it lines up with the grid of colours. */
function makeSnapshot(picture: HTMLCanvasElement, corners: Point[]): string {
  const out = document.createElement('canvas');
  out.width = SNAPSHOT_PX;
  out.height = SNAPSHOT_PX;
  const context = out.getContext('2d');
  if (!context || corners.length !== 4) return '';
  const [topLeft, topRight, , bottomLeft] = corners;
  const ux = (topRight.x - topLeft.x) / SNAPSHOT_PX;
  const uy = (topRight.y - topLeft.y) / SNAPSHOT_PX;
  const vx = (bottomLeft.x - topLeft.x) / SNAPSHOT_PX;
  const vy = (bottomLeft.y - topLeft.y) / SNAPSHOT_PX;
  const det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-9) return '';
  // Inverse of the map (snapshot pixel -> picture pixel).
  const a = vy / det;
  const c = -vx / det;
  const b = -uy / det;
  const d = ux / det;
  context.setTransform(a, b, c, d, -(a * topLeft.x + c * topLeft.y), -(b * topLeft.x + d * topLeft.y));
  context.drawImage(picture, 0, 0);
  return out.toDataURL('image/jpeg', 0.85);
}

export function mountScanScreen(root: HTMLElement, o: { onComplete(faces: ScannedFace[]): void }): () => void {
  const demo = new URLSearchParams(window.location.search).has('demo');
  const source = demo ? createDemoSource() : createCameraSource();
  const tracker = new StabilityTracker();

  let slots: ScannedFace[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cv: any = null;
  let visionFailed = false;
  let lineUp = false;
  let debug = false;
  let running = false;
  let finished = false;
  let unmounted = false;
  let timer = 0;
  let lastSeenAt = performance.now();
  let messageUntil = 0;
  let latest: { frame: Frame; det: Detection | null; colors: Lab[] | null } | null = null;

  // --- Elements ---
  const overlay = el('canvas', { class: 'overlay' });
  const cameraMessage = el('div', { class: 'camera-message' });
  const cameraView = el('div', { class: `camera-view${source.mirrored ? ' mirrored' : ''}` }, source.view, overlay);
  const cameraBox = el('div', { class: 'camera-box' }, cameraView, cameraMessage);
  const statusLine = el('p', { class: 'scan-status' });
  const readout = el('pre', { class: 'debug-readout' });
  const slotsBox = el('div', { class: 'slots' });
  const slotsTitle = el('h3', {});
  const tips = el(
    'ul',
    { class: 'tips' },
    el('li', {}, 'Use even light. Avoid a lamp shining straight on the cube.'),
    el('li', {}, 'Let the face fill about a third of the picture.'),
    el('li', {}, 'Keep your fingers off the face you are showing.'),
    el('li', {}, 'Hold still until the outline fills and the face is captured.'),
    el('li', {}, 'Faces can be shown in any order and turned any way.'),
  );

  const lineUpBox = el('input', { type: 'checkbox' });
  const debugBox = el('input', { type: 'checkbox' });
  const captureButton = button('Capture (Space)', () => captureNow(), 'btn primary');
  captureButton.hidden = true;
  const startOverButton = button('Start over', () => startOver(), 'btn subtle');

  const screen = el(
    'section',
    { class: 'screen scan-screen' },
    el(
      'p',
      { class: 'lead' },
      'Show each of the six faces of your cube to the camera. Hold each one still for a moment until it is captured.',
      demo ? el('span', { class: 'demo-tag' }, ' Demo mode: computer-generated pictures, no camera.') : null,
    ),
    el(
      'div',
      { class: 'scan-layout' },
      el(
        'div',
        { class: 'camera-column' },
        cameraBox,
        statusLine,
        el(
          'div',
          { class: 'button-row' },
          el('label', { class: 'toggle' }, lineUpBox, ' Line-up mode'),
          el('label', { class: 'toggle' }, debugBox, ' Show what the app sees'),
          captureButton,
          startOverButton,
        ),
        readout,
      ),
      el('div', { class: 'side-column' }, slotsTitle, slotsBox, el('h3', {}, 'Tips'), tips),
    ),
  );
  root.append(screen);

  // --- Messages ---
  function setStatus(text: string, holdMs = 0): void {
    if (holdMs === 0 && performance.now() < messageUntil) return;
    statusLine.textContent = text;
    if (holdMs > 0) messageUntil = performance.now() + holdMs;
  }

  function showCameraMessage(text: string, retry: boolean): void {
    cameraMessage.replaceChildren(el('p', {}, text));
    if (retry) cameraMessage.append(button('Retry', () => void start(), 'btn primary'));
    cameraMessage.classList.add('show');
  }

  // --- Slots ---
  function renderSlots(flash = -1): void {
    slotsTitle.textContent = `Faces captured: ${slots.length} of 6`;
    slotsBox.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const face = slots[i];
      if (!face) {
        slotsBox.append(el('div', { class: 'slot empty' }, el('div', { class: 'slot-placeholder' }, String(i + 1))));
        continue;
      }
      const remove = button('×', () => removeSlot(i), 'slot-remove');
      remove.title = 'Remove this face';
      remove.setAttribute('aria-label', 'Remove this face');
      const picture = el('img', { class: 'slot-photo', alt: 'Captured face', src: face.snapshot });
      const slot = el('div', { class: `slot${i === flash ? ' flash' : ''}` }, picture, createFaceGrid(face.samples.map(cssColour)), remove);
      slotsBox.append(slot);
    }
  }

  function removeSlot(index: number): void {
    if (finished) return;
    slots = slots.filter((_, i) => i !== index);
    tracker.reset();
    renderSlots();
  }

  function startOver(): void {
    if (finished) return;
    slots = [];
    tracker.reset();
    renderSlots();
    setStatus('Cleared. Show any face of the cube to the camera.', 2000);
  }

  function capture(samples: Lab[], det: Detection): void {
    if (finished) return;
    const placed = placeFace(slots, { samples, snapshot: makeSnapshot(source.canvas, det.corners) });
    slots = placed.slots;
    renderSlots(placed.index);
    if (slots.length >= 6) {
      finished = true;
      setStatus('All six faces captured.', 5000);
      window.setTimeout(() => {
        if (unmounted) return;
        stop();
        o.onComplete(slots.slice(0, 6));
      }, 700);
      return;
    }
    setStatus(placed.replaced ? 'Updated that face. Show another face.' : `Got it — show another face (${slots.length} of 6).`, 2500);
  }

  function captureNow(): void {
    if (!lineUp || !latest?.det || !latest.colors) return;
    capture(latest.colors, latest.det);
  }

  // --- Drawing over the camera picture ---
  function drawOverlay(frame: Frame, det: Detection | null, colors: Lab[] | null): void {
    if (overlay.width !== frame.width) overlay.width = frame.width;
    if (overlay.height !== frame.height) overlay.height = frame.height;
    const context = overlay.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, overlay.width, overlay.height);
    const line = Math.max(2, frame.width / 220);

    const outline = (points: Point[]): void => {
      context.beginPath();
      points.forEach((p, i) => (i === 0 ? context.moveTo(p.x, p.y) : context.lineTo(p.x, p.y)));
      context.closePath();
      context.stroke();
    };

    if (debug && det) {
      context.strokeStyle = 'rgba(255, 221, 0, 0.9)';
      context.lineWidth = Math.max(1, line / 2);
      det.candidates.forEach(outline);
    }
    if (!det) return;

    const progress = lineUp ? 0 : tracker.progress();
    context.lineWidth = line * (1 + progress);
    context.strokeStyle = lineUp ? 'rgba(255, 255, 255, 0.9)' : progress > 0 ? '#3ecf8e' : '#4ea1ff';
    context.setLineDash(lineUp ? [line * 4, line * 3] : []);
    outline(det.corners);
    context.setLineDash([]);

    // Grid lines, so it is clear which nine cells are being read.
    context.lineWidth = Math.max(1, line / 2);
    const [tl, tr, br, bl] = det.corners;
    const mix = (p: Point, q: Point, t: number): Point => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    for (const t of [1 / 3, 2 / 3]) {
      context.beginPath();
      const a = mix(tl, tr, t);
      const b = mix(bl, br, t);
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      const c = mix(tl, bl, t);
      const d = mix(tr, br, t);
      context.moveTo(c.x, c.y);
      context.lineTo(d.x, d.y);
      context.stroke();
    }

    if (debug && colors) {
      det.points.forEach((p, i) => {
        context.beginPath();
        context.arc(p.x, p.y, det.pitch * 0.18, 0, Math.PI * 2);
        context.fillStyle = cssColour(colors[i]);
        context.fill();
        context.strokeStyle = '#000';
        context.lineWidth = Math.max(1, line / 2);
        context.stroke();
      });
    }
  }

  function showReadout(det: Detection | null, colors: Lab[] | null): void {
    if (!debug) {
      readout.textContent = '';
      return;
    }
    const lines = [`stickers found: ${det ? det.candidates.length : 0}   face found: ${det ? 'yes' : 'no'}`];
    if (det && colors) {
      lines.push(`cell spacing: ${det.pitch.toFixed(0)} px   steady: ${(tracker.progress() * 100).toFixed(0)}%`);
      for (let row = 0; row < 3; row++) {
        lines.push(
          colors
            .slice(row * 3, row * 3 + 3)
            .map((lab) => `L${lab[0].toFixed(0).padStart(3)} a${lab[1].toFixed(0).padStart(4)} b${lab[2].toFixed(0).padStart(4)}`)
            .join('  |  '),
        );
      }
    }
    readout.textContent = lines.join('\n');
  }

  // --- The loop ---
  function look(): void {
    if (!running || finished) return;
    try {
      lookOnce();
    } catch (err) {
      // One bad pass must not stop the camera loop.
      console.error('Scan pass failed', err);
    }
    if (running && !finished) timer = window.setTimeout(look, LOOP_MS);
  }

  function lookOnce(): void {
    const frame = source.grab();
    if (frame) {
      cameraView.style.aspectRatio = `${frame.width} / ${frame.height}`;
      let det: Detection | null = null;
      if (lineUp) {
        det = fixedLattice(frame.width, frame.height);
      } else if (cv) {
        try {
          det = detectFace(cv, frame);
        } catch (err) {
          console.error('Face detection failed', err);
          visionUnavailable();
        }
      }
      const colors = det ? sampleColors(frame, det.points, Math.max(3, CONFIG.patchFrac * det.pitch)) : null;
      latest = { frame, det, colors };
      const now = performance.now();

      if (lineUp) {
        setStatus('Fill the dashed square with one face, then press Space or Capture.');
      } else {
        const captured = tracker.push(now, det, colors);
        if (det) lastSeenAt = now;
        if (captured && det) {
          capture(captured, det);
        } else if (!cv && !visionFailed) {
          setStatus('Loading the vision engine…');
        } else if (det && tracker.progress() > 0) {
          setStatus('Hold still…');
        } else if (det) {
          setStatus('That face is captured. Show a different face.');
        } else if (now - lastSeenAt > NOTHING_SEEN_MS) {
          setStatus('Having trouble? Check the tips, or try Line-up mode.');
        } else {
          setStatus('Show any face of the cube to the camera and hold it still.');
        }
      }
      drawOverlay(frame, det, colors);
      showReadout(det, colors);
    }
  }

  function visionUnavailable(): void {
    cv = null;
    visionFailed = true;
    lineUp = true;
    lineUpBox.checked = true;
    lineUpBox.disabled = true;
    captureButton.hidden = false;
    setStatus('Automatic finding is unavailable. Line-up mode is on.', 6000);
  }

  function stop(): void {
    running = false;
    window.clearTimeout(timer);
    source.stop();
  }

  async function start(): Promise<void> {
    cameraMessage.classList.remove('show');
    try {
      await source.start();
    } catch (err) {
      if (!unmounted) {
        showCameraMessage(cameraErrorText(err), true);
        messageUntil = 0;
        setStatus('Waiting for the camera.');
      }
      return;
    }
    if (unmounted) {
      source.stop();
      return;
    }
    running = true;
    lastSeenAt = performance.now();
    look();
  }

  source.onEnded = () => {
    if (unmounted || finished) return;
    stop();
    showCameraMessage(cameraErrorText({ name: 'NotReadableError' }), true);
  };

  // --- Controls ---
  lineUpBox.addEventListener('change', () => {
    lineUp = lineUpBox.checked;
    captureButton.hidden = !lineUp;
    tracker.reset();
    messageUntil = 0;
  });
  debugBox.addEventListener('change', () => {
    debug = debugBox.checked;
  });
  function onKey(event: KeyboardEvent): void {
    if (event.key === ' ' && lineUp) {
      event.preventDefault();
      captureNow();
    }
  }
  window.addEventListener('keydown', onKey);

  // --- Go ---
  renderSlots();
  setStatus('Starting…');
  // OpenCV is big, so it is loaded in the background while the camera starts.
  void import('../vision/opencv')
    .then((module) => module.loadOpenCV())
    .then((handle) => {
      if (!visionFailed) cv = handle.cv;
    })
    .catch((err: unknown) => {
      console.error('OpenCV failed to load', err);
      visionUnavailable();
    });
  void start();

  return () => {
    unmounted = true;
    stop();
    window.removeEventListener('keydown', onKey);
    screen.remove();
  };
}
