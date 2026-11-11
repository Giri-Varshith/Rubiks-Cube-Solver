// Reading instructions aloud with the computer's own voice.
//
// Browsers offer two kinds of voice: ones built into the computer, and
// "online" ones where the text is sent away to be turned into sound. Only
// built-in voices are used here, in keeping with nothing leaving the computer.
import { CONFIG } from '../config';

export interface VoiceLike {
  name: string;
  lang: string;
  /** True when the voice is produced on this device. */
  localService: boolean;
  default: boolean;
}

/** The on-device English voice to use, or null if the computer has none. */
export function pickVoice<V extends VoiceLike>(voices: V[]): V | null {
  const usable = voices.filter((v) => v.localService && /^en([-_]|$)/i.test(v.lang));
  return usable.find((v) => v.default) ?? usable.find((v) => /^en[-_]US$/i.test(v.lang)) ?? usable[0] ?? null;
}

export interface Speaker {
  /** Whether this browser can speak at all. */
  readonly supported: boolean;
  /** Say something, replacing anything still being said. onDone runs when it finishes or cannot be said. */
  say(text: string, onDone?: () => void): void;
  /** Stop talking. */
  hush(): void;
}

export function createSpeaker(): Speaker {
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  const supported = !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
  // Browsers load their list of voices a moment after the page starts; asking early gets it going.
  if (supported) synth.getVoices();
  /** Changes every time something new is said, so an old sentence finishing late is ignored. */
  let turn = 0;

  return {
    supported,
    say(text, onDone) {
      const mine = ++turn;
      const done = () => {
        if (mine === turn) onDone?.();
      };
      if (!supported) {
        done();
        return;
      }
      synth.cancel();
      const voice = pickVoice(synth.getVoices());
      if (!voice) {
        // No on-device English voice (or the list is not loaded yet): stay silent rather than use an online one.
        done();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = CONFIG.speechRate;
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
    },
    hush() {
      turn++;
      if (supported) synth.cancel();
    },
  };
}
