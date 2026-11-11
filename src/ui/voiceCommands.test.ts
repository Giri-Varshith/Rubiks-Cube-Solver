import { describe, expect, test } from 'vitest';
import { parseCommand, pickCommand, speechForStep } from './voiceCommands';

describe('parseCommand: only exact, whole phrases count', () => {
  test.each([
    ['next', 'next'],
    ['Next.', 'next'],
    ['  NEXT  ', 'next'],
    ['next move', 'next'],
    ['next one', 'next'],
    ['back', 'back'],
    ['go back', 'back'],
    ['previous', 'back'],
    ['repeat', 'repeat'],
    ['again', 'repeat'],
    ['repeat that', 'repeat'],
    ['say that again', 'repeat'],
  ])('"%s" means %s', (heard, command) => {
    expect(parseCommand(heard)).toBe(command);
  });

  test.each([
    '',
    '   ',
    'next back',
    'the next one please',
    'what comes next',
    'i am back',
    'banana',
    // The app's own spoken instructions must never count as commands.
    'back face turn it clockwise as you look from the front',
    'undo the move you just made',
    'move 3 of 20 right side turn it up away from you',
  ])('"%s" is not a command', (heard) => {
    expect(parseCommand(heard)).toBeNull();
  });
});

describe('pickCommand', () => {
  test('takes the first of the recogniser\'s guesses that is a command', () => {
    expect(pickCommand(['necks', 'next', 'back'])).toBe('next');
    expect(pickCommand(['go back'])).toBe('back');
  });

  test('is nothing when no guess is a command', () => {
    expect(pickCommand(['necks', 'text'])).toBeNull();
    expect(pickCommand([])).toBeNull();
  });
});

describe('speechForStep: what is read aloud', () => {
  const R = { face: 'R', turns: 1 } as const;
  const U2 = { face: 'U', turns: 2 } as const;

  test('before the first move it says how to start', () => {
    expect(speechForStep({ total: 20, index: 0, last: null, undone: null })).toBe(
      'Hold the cube with white on top and green facing you. Say next, or press Next, for the first move.',
    );
  });

  test('a move is read with its number', () => {
    expect(speechForStep({ total: 20, index: 3, last: R, undone: null })).toBe('Move 3 of 20. Right side: turn it up, away from you.');
  });

  test('the last move adds that the cube is solved', () => {
    expect(speechForStep({ total: 20, index: 20, last: U2, undone: null })).toBe(
      'Move 20 of 20. Top layer: turn it halfway round. That was the last move. Your cube is solved. Well done!',
    );
  });

  test('after Back it says how to undo', () => {
    expect(speechForStep({ total: 20, index: 2, last: U2, undone: { face: 'R', turns: 3 } })).toBe(
      'Undo the move you just made. Right side: turn it down, towards you.',
    );
  });

  test('a cube needing no moves says so', () => {
    expect(speechForStep({ total: 0, index: 0, last: null, undone: null })).toBe('Your cube is already solved.');
  });
});
