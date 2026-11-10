// Test-only: loads OpenCV in Node. The browser uses opencv.ts.
// require() is used because the test runner's import() stalls on the OpenCV
// module object (it has a `then` method and so looks like a promise).
import { createRequire } from 'node:module';
import type { CvHandle } from './opencv';

let pending: Promise<CvHandle> | null = null;

export function loadCvForTest(): Promise<CvHandle> {
  if (!pending) {
    pending = new Promise<CvHandle>((resolve) => {
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = require('@techstark/opencv-js');
      if (mod.Mat) resolve({ cv: mod });
      else mod.onRuntimeInitialized = () => resolve({ cv: mod });
    });
  }
  return pending;
}
