// Opening, reading and closing the webcam. Frames stay in memory only.
import type { Frame } from './sampleColors';

/** Ask for the webcam and start it playing in the given video element. */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('This browser cannot use a camera'), { name: 'NotFoundError' });
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/**
 * Copy the current video picture into the canvas and return its pixels.
 * The picture is NOT mirrored, whatever the screen shows. Returns null until
 * the camera has produced its first picture.
 */
export function grabFrame(source: HTMLVideoElement, canvas: HTMLCanvasElement): Frame | null {
  const width = source.videoWidth;
  const height = source.videoHeight;
  if (!width || !height) return null;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  return { data: image.data, width, height };
}

/** A plain-language explanation of why the camera did not start. */
export function cameraErrorText(err: unknown): string {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'The browser was not allowed to use the camera. Click the camera icon in the address bar, choose Allow, then press Retry.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Plug one in or turn it on, then press Retry.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is being used by another app. Close that app, then press Retry.';
    default:
      return 'The camera could not be started. Press Retry.';
  }
}
