// The only place (with detectFace.ts) that touches OpenCV.
//
// Two traps, both avoided here:
//  1. The OpenCV module object has a `then` method, so it looks like a promise.
//     Awaiting it, returning it from an async function, or loading it with a
//     dynamic import() can stall forever. It is imported statically and only
//     ever handed around inside a { cv } wrapper.
//  2. Its WebAssembly part finishes loading some time after the import.
//
// To load OpenCV lazily, dynamically import THIS file, not the library.
import cvModule from '@techstark/opencv-js';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CvHandle {
  cv: any;
}

let pending: Promise<CvHandle> | null = null;

export function loadOpenCV(): Promise<CvHandle> {
  if (!pending) {
    pending = new Promise<CvHandle>((resolve, reject) => {
      const mod: any = cvModule;
      if (mod.Mat) {
        resolve({ cv: mod });
        return;
      }
      const previous = mod.onRuntimeInitialized;
      mod.onRuntimeInitialized = () => {
        if (typeof previous === 'function') previous();
        resolve({ cv: mod });
      };
      mod.onAbort = (reason: unknown) => reject(new Error(`OpenCV failed to start: ${String(reason)}`));
    });
  }
  return pending;
}
