// The words the Solve screen listens for, and the words it says.
// No microphone or speaker code here: this is plain text in, plain text out.
import { describeMove } from '../cube/moves';
import type { Move } from '../cube/types';

export type VoiceCommand = 'next' | 'back' | 'repeat';

/**
 * The only phrases that do anything. A phrase must be the WHOLE of what was
 * said: "next" works, "what comes next" does not. That keeps voice control
 * predictable, and means the app's own spoken instructions ("Back face: ...")
 * can never be taken for a command.
 */
const PHRASES: Record<VoiceCommand, string[]> = {
  next: ['next', 'next move', 'next one'],
  back: ['back', 'go back', 'previous'],
  repeat: ['repeat', 'again', 'repeat that', 'say that again'],
};

/** The words to show the user as a reminder. */
export const COMMAND_WORDS = '“next”, “repeat” or “back”';

/** Every phrase, for telling the recogniser what to expect. */
export const ALL_PHRASES: string[] = Object.values(PHRASES).flat();

const LOOKUP = new Map<string, VoiceCommand>(
  (Object.keys(PHRASES) as VoiceCommand[]).flatMap((command) => PHRASES[command].map((phrase) => [phrase, command] as const)),
);

/** What was said, as a command, or null if it was not exactly one of the phrases. */
export function parseCommand(heard: string): VoiceCommand | null {
  const tidy = heard
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return LOOKUP.get(tidy) ?? null;
}

/** The recogniser offers a few guesses at what was said; use the first that is a command. */
export function pickCommand(guesses: string[]): VoiceCommand | null {
  for (const guess of guesses) {
    const command = parseCommand(guess);
    if (command) return command;
  }
  return null;
}

/** What to read aloud for the step now on screen. */
export function speechForStep(step: { total: number; index: number; last: Move | null; undone: Move | null }): string {
  if (step.total === 0) return 'Your cube is already solved.';
  if (step.undone) return `Undo the move you just made. ${describeMove(step.undone)}.`;
  if (!step.last) return 'Hold the cube with white on top and green facing you. Say next, or press Next, for the first move.';
  const move = `Move ${step.index} of ${step.total}. ${describeMove(step.last)}.`;
  return step.index >= step.total ? `${move} That was the last move. Your cube is solved. Well done!` : move;
}
