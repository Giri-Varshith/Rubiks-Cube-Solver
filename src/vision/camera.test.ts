import { describe, expect, test } from 'vitest';
import { cameraErrorText } from './camera';
import { labToRgb, rgbToLab, type RGB } from './colorMath';

describe('cameraErrorText', () => {
  test('permission refused', () => {
    expect(cameraErrorText({ name: 'NotAllowedError' })).toBe(
      'The browser was not allowed to use the camera. Tap or click the camera or settings icon by the address bar, choose Allow, then press Retry.',
    );
  });

  test('no camera', () => {
    expect(cameraErrorText({ name: 'NotFoundError' })).toBe('No camera was found. Plug one in or turn it on, then press Retry.');
  });

  test('camera busy', () => {
    expect(cameraErrorText({ name: 'NotReadableError' })).toBe(
      'The camera is being used by another app. Close that app, then press Retry.',
    );
  });

  test('anything else', () => {
    expect(cameraErrorText(new Error('x'))).toBe('The camera could not be started. Press Retry.');
    expect(cameraErrorText(undefined)).toBe('The camera could not be started. Press Retry.');
  });
});

describe('labToRgb', () => {
  test.each<[string, RGB]>([
    ['white', [255, 255, 255]],
    ['black', [0, 0, 0]],
    ['cube red', [190, 30, 40]],
    ['cube orange', [245, 110, 20]],
    ['cube blue', [20, 70, 180]],
    ['mid grey', [128, 128, 128]],
  ])('turns %s back into the colour it came from', (_name, rgb) => {
    const back = labToRgb(rgbToLab(rgb));
    back.forEach((v, i) => expect(Math.abs(v - rgb[i])).toBeLessThanOrEqual(1));
  });

  test('stays inside 0..255 for colours a screen cannot show', () => {
    for (const v of labToRgb([50, 120, -120])) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});
