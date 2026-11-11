# Saved for later

Everything that has been agreed but set aside, in one place.

## Version 2

- **Teach me the method.** A second mode that solves the cube layer by layer
  (the beginner's method) and explains each stage, instead of only giving the
  shortest list of moves.
- **The camera watches every move.** While solving, the camera checks that the
  move just made was the right one and moves on by itself, or says what went
  wrong.

## Voice

- **"Back" command glitches.** Reported in Chrome; small and not yet looked
  into. To do: reproduce, then find whether it is the recogniser mishearing,
  the app hearing its own voice, or the undo step itself.
- **Bundled offline recogniser (Vosk, open source).** Voice commands today
  need a browser that can recognise speech on the device (Chrome works;
  Brave and Firefox cannot). Bundling Vosk (about a 40 MB speech model) would
  make voice commands work in every browser, still with nothing leaving the
  device.
- **Safari on iPhone and iPad.** Check the whole app there: camera, reading
  moves aloud, and whether voice commands can work on-device. Safari's own
  speech recognition may use Apple's servers, in which case the app keeps it
  off and Vosk would be the way.

## Phone

- **Real-phone trial.** The app is published on GitHub Pages and has a
  Switch camera button, but has not yet been tried on a real Android phone.
  Feedback from that trial goes here.

## Small things

- Add a licence file to the public repository (MIT suggested), if wanted.
- Known limits: a solid logo on a centre square that looks like another
  face's colour; some detection constants still live outside
  `src/config.ts`.
