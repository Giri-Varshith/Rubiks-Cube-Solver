// Listening for voice commands, on this device only.
//
// Browsers can recognise speech in two ways: by sending the sound to an online
// service (the long-standing default) or, in newer browsers, entirely on the
// device. This app promises that nothing leaves the computer, so the
// microphone is switched on ONLY when the browser has confirmed that
// on-device recognition is available. There is no online fallback: if the
// browser cannot do it locally, voice commands are simply off.
import { ALL_PHRASES, pickCommand, type VoiceCommand } from './voiceCommands';

export type ListenerState =
  /** Not switched on. */
  | 'off'
  /** This browser has no speech recognition at all. */
  | 'unsupported'
  /** It has speech recognition, but cannot (or will not confirm it can) do it on this device. */
  | 'unavailable'
  /** Fetching the browser's speech pack, once. */
  | 'downloading'
  | 'listening'
  /** The microphone was refused. */
  | 'blocked';

/** The parts of the browser's SpeechRecognition object used here. */
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /** Present only in browsers that can recognise speech on the device. */
  processLocally?: boolean;
  phrases?: unknown;
  onresult: ((event: never) => void) | null;
  onerror: ((event: never) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

export interface RecognitionCtor {
  new (): RecognitionLike;
  available?(options: { langs: string[]; processLocally: boolean }): Promise<string>;
  install?(options: { langs: string[]; processLocally: boolean }): Promise<boolean>;
}

interface ResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface Listener {
  /** Switch on. Checks on-device recognition is available first; may take a moment the first time. */
  start(): Promise<void>;
  /** Switch off. */
  stop(): void;
  /** Stop hearing for a moment (while the app itself is speaking). */
  pause(): void;
  resume(): void;
}

const LANGUAGE = 'en-US';
const ON_DEVICE = { langs: [LANGUAGE], processLocally: true };

export function createListener(
  Recognition: RecognitionCtor | undefined,
  handlers: { onState(state: ListenerState): void; onCommand(command: VoiceCommand): void; onHeard(text: string): void },
): Listener {
  let recogniser: RecognitionLike | null = null;
  /** The user wants it on. */
  let wanted = false;
  let paused = false;
  /** Something that will not fix itself (permission refused, speech pack missing). */
  let gaveUp = false;

  /** Every start, first or repeat, goes through here, and is on-device or not at all. */
  function listenNow(): void {
    if (!recogniser || !wanted || paused || gaveUp) return;
    recogniser.processLocally = true;
    try {
      recogniser.start();
    } catch {
      // Already listening: nothing to do.
    }
  }

  function setUp(r: RecognitionLike): void {
    r.lang = LANGUAGE;
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.processLocally = true;
    try {
      // Tell the recogniser which few phrases to expect, where the browser supports that.
      const Phrase = (globalThis as { SpeechRecognitionPhrase?: new (phrase: string, boost: number) => unknown }).SpeechRecognitionPhrase;
      if (Phrase && 'phrases' in r) r.phrases = ALL_PHRASES.map((phrase) => new Phrase(phrase, 6));
    } catch {
      // Optional; recognition works without it.
    }

    r.onresult = ((event: ResultEvent) => {
      if (!wanted || paused) return; // while paused, anything heard is the app's own voice
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const guesses: string[] = [];
        for (let k = 0; k < result.length; k++) guesses.push(result[k].transcript);
        if (guesses.length === 0) continue;
        handlers.onHeard(guesses[0].trim());
        const command = pickCommand(guesses);
        if (command) handlers.onCommand(command);
      }
    }) as (event: never) => void;

    r.onerror = ((event: { error: string }) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        gaveUp = true;
        wanted = false; // so that switching on again starts afresh
        handlers.onState('blocked');
      } else if (event.error === 'language-not-supported') {
        gaveUp = true;
        wanted = false;
        handlers.onState('unavailable');
      }
      // 'no-speech', 'aborted' and the like are just quiet spells.
    }) as (event: never) => void;

    // Browsers stop listening after a silence; carry on unless told otherwise.
    r.onend = () => listenNow();
  }

  return {
    async start() {
      if (wanted) return;
      if (!Recognition) {
        handlers.onState('unsupported');
        return;
      }
      // A browser that cannot tell us on-device recognition is available does not get the microphone.
      if (typeof Recognition.available !== 'function' || typeof Recognition.install !== 'function') {
        handlers.onState('unavailable');
        return;
      }
      const candidate = new Recognition();
      if (!('processLocally' in candidate)) {
        handlers.onState('unavailable');
        return;
      }

      wanted = true;
      paused = false;
      gaveUp = false;
      try {
        let availability = await Recognition.available(ON_DEVICE);
        if (availability !== 'available' && availability !== 'unavailable') {
          handlers.onState('downloading');
          availability = (await Recognition.install(ON_DEVICE)) ? 'available' : 'unavailable';
        }
        if (availability !== 'available') {
          wanted = false;
          handlers.onState('unavailable');
          return;
        }
      } catch {
        wanted = false;
        handlers.onState('unavailable');
        return;
      }
      if (!wanted) return; // switched off while checking

      recogniser = candidate;
      setUp(candidate);
      handlers.onState('listening');
      listenNow();
    },

    stop() {
      wanted = false;
      paused = false;
      try {
        recogniser?.abort();
      } catch {
        // Not listening.
      }
      handlers.onState('off');
    },

    pause() {
      if (!wanted || paused || !recogniser) return;
      paused = true;
      try {
        recogniser.abort();
      } catch {
        // Not listening.
      }
    },

    resume() {
      if (!wanted || !paused) return;
      paused = false;
      listenNow();
    },
  };
}

/** The browser's recogniser, if it has one. */
export function browserRecognition(): RecognitionCtor | undefined {
  const w = globalThis as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
