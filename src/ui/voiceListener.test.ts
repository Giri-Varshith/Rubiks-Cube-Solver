// The listener must only ever switch the microphone on when the browser has
// confirmed it can recognise speech ON THE DEVICE. These tests use a stand-in
// for the browser's recogniser and check that promise from every direction.
import { describe, expect, test } from 'vitest';
import type { VoiceCommand } from './voiceCommands';
import { createListener, type ListenerState, type RecognitionCtor } from './voiceListener';

interface Fake {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  starts: number;
  aborts: number;
  startedWithProcessLocally: (boolean | undefined)[];
  start(): void;
  abort(): void;
}

function makeBrowser(o: { available?: string | null; install?: boolean; hasProcessLocally?: boolean } = {}) {
  const made: Fake[] = [];
  const calls = { available: [] as unknown[], install: [] as unknown[] };
  const hasProcessLocally = o.hasProcessLocally ?? true;

  function Ctor(this: Fake) {
    this.lang = '';
    this.continuous = false;
    this.interimResults = true;
    this.maxAlternatives = 1;
    if (hasProcessLocally) this.processLocally = false;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.starts = 0;
    this.aborts = 0;
    this.startedWithProcessLocally = [];
    this.start = () => {
      this.starts++;
      this.startedWithProcessLocally.push(this.processLocally);
    };
    this.abort = () => {
      this.aborts++;
      this.onend?.();
    };
    made.push(this);
  }
  const ctor = Ctor as unknown as RecognitionCtor;
  if (o.available !== null) {
    ctor.available = async (options) => {
      calls.available.push(options);
      return o.available ?? 'available';
    };
    ctor.install = async (options) => {
      calls.install.push(options);
      return o.install ?? true;
    };
  }
  return { ctor, made, calls };
}

function listen(ctor: RecognitionCtor | undefined) {
  const states: ListenerState[] = [];
  const commands: VoiceCommand[] = [];
  const heard: string[] = [];
  const listener = createListener(ctor, {
    onState: (state) => states.push(state),
    onCommand: (command) => commands.push(command),
    onHeard: (text) => heard.push(text),
  });
  return { listener, states, commands, heard };
}

const finalResult = (...alternatives: string[]) => ({
  resultIndex: 0,
  results: [Object.assign(alternatives.map((transcript) => ({ transcript })), { isFinal: true })],
});

describe('the microphone is only used when recognition is on this device', () => {
  test('a browser with no speech recognition: unsupported, nothing started', async () => {
    const { listener, states } = listen(undefined);
    await listener.start();
    expect(states.at(-1)).toBe('unsupported');
  });

  test('a browser that cannot say whether it works on-device: unavailable, nothing started', async () => {
    const browser = makeBrowser({ available: null });
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    expect(states.at(-1)).toBe('unavailable');
    expect(browser.made.every((r) => r.starts === 0)).toBe(true);
  });

  test('a recogniser without the on-device switch: unavailable, nothing started', async () => {
    const browser = makeBrowser({ hasProcessLocally: false });
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    expect(states.at(-1)).toBe('unavailable');
    expect(browser.made.every((r) => r.starts === 0)).toBe(true);
  });

  test('the browser says on-device English is not available: unavailable, nothing started', async () => {
    const browser = makeBrowser({ available: 'unavailable' });
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    expect(states.at(-1)).toBe('unavailable');
    expect(browser.made.every((r) => r.starts === 0)).toBe(true);
  });

  test('available on-device: it asks specifically for on-device English, then listens on-device', async () => {
    const browser = makeBrowser({ available: 'available' });
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    expect(browser.calls.available).toEqual([{ langs: ['en-US'], processLocally: true }]);
    expect(states.at(-1)).toBe('listening');
    const recogniser = browser.made.at(-1)!;
    expect(recogniser.starts).toBe(1);
    expect(recogniser.startedWithProcessLocally).toEqual([true]);
    expect(recogniser.lang).toBe('en-US');
  });

  test('needs a one-time download: shows downloading, installs, then listens on-device', async () => {
    const browser = makeBrowser({ available: 'downloadable', install: true });
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    expect(states).toContain('downloading');
    expect(browser.calls.install).toHaveLength(1);
    expect(states.at(-1)).toBe('listening');
    expect(browser.made.at(-1)!.startedWithProcessLocally).toEqual([true]);
  });

  test('the download fails: unavailable, nothing started', async () => {
    const browser = makeBrowser({ available: 'downloadable', install: false });
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    expect(states.at(-1)).toBe('unavailable');
    expect(browser.made.every((r) => r.starts === 0)).toBe(true);
  });

  test('every restart is on-device too', async () => {
    const browser = makeBrowser();
    const { listener } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    recogniser.onend?.(); // the browser stops after a silence
    listener.pause();
    listener.resume();
    expect(recogniser.startedWithProcessLocally.every((value) => value === true)).toBe(true);
    expect(recogniser.starts).toBeGreaterThanOrEqual(3);
  });
});

describe('hearing commands', () => {
  test('a command is passed on, and what was heard is shown', async () => {
    const browser = makeBrowser();
    const { listener, commands, heard } = listen(browser.ctor);
    await listener.start();
    browser.made.at(-1)!.onresult?.(finalResult('next'));
    expect(commands).toEqual(['next']);
    expect(heard).toEqual(['next']);
  });

  test('anything else is shown but does nothing', async () => {
    const browser = makeBrowser();
    const { listener, commands, heard } = listen(browser.ctor);
    await listener.start();
    browser.made.at(-1)!.onresult?.(finalResult('banana'));
    expect(commands).toEqual([]);
    expect(heard).toEqual(['banana']);
  });

  test('a second guess from the recogniser can be the command', async () => {
    const browser = makeBrowser();
    const { listener, commands } = listen(browser.ctor);
    await listener.start();
    browser.made.at(-1)!.onresult?.(finalResult('necks', 'next'));
    expect(commands).toEqual(['next']);
  });

  test('half-finished results are ignored', async () => {
    const browser = makeBrowser();
    const { listener, commands } = listen(browser.ctor);
    await listener.start();
    const interim = { resultIndex: 0, results: [Object.assign([{ transcript: 'next' }], { isFinal: false })] };
    browser.made.at(-1)!.onresult?.(interim);
    expect(commands).toEqual([]);
  });
});

describe('pausing and stopping', () => {
  test('when the browser stops listening by itself, it is started again', async () => {
    const browser = makeBrowser();
    const { listener } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    recogniser.onend?.();
    expect(recogniser.starts).toBe(2);
  });

  test('paused (while the app is speaking) it stops and stays stopped until resumed', async () => {
    const browser = makeBrowser();
    const { listener, commands } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    listener.pause();
    expect(recogniser.aborts).toBe(1);
    expect(recogniser.starts).toBe(1);
    // Anything it still hears while paused (the app's own voice) is thrown away.
    recogniser.onresult?.(finalResult('back'));
    expect(commands).toEqual([]);
    listener.resume();
    expect(recogniser.starts).toBe(2);
  });

  test('stopped, it does not start again', async () => {
    const browser = makeBrowser();
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    listener.stop();
    recogniser.onend?.();
    listener.resume();
    expect(recogniser.starts).toBe(1);
    expect(states.at(-1)).toBe('off');
  });

  test('microphone permission refused: blocked, and it does not keep trying', async () => {
    const browser = makeBrowser();
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    recogniser.onerror?.({ error: 'not-allowed' });
    recogniser.onend?.();
    expect(states.at(-1)).toBe('blocked');
    expect(recogniser.starts).toBe(1);
  });

  test('after the microphone was refused, switching on again tries afresh', async () => {
    const browser = makeBrowser();
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    browser.made.at(-1)!.onerror?.({ error: 'not-allowed' });
    expect(states.at(-1)).toBe('blocked');
    await listener.start();
    expect(browser.calls.available).toHaveLength(2);
    expect(states.at(-1)).toBe('listening');
    expect(browser.made.at(-1)!.startedWithProcessLocally).toEqual([true]);
  });

  test('the language pack turns out to be missing: unavailable, and it does not keep trying', async () => {
    const browser = makeBrowser();
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    recogniser.onerror?.({ error: 'language-not-supported' });
    recogniser.onend?.();
    expect(states.at(-1)).toBe('unavailable');
    expect(recogniser.starts).toBe(1);
  });

  test('a quiet spell is not an error', async () => {
    const browser = makeBrowser();
    const { listener, states } = listen(browser.ctor);
    await listener.start();
    const recogniser = browser.made.at(-1)!;
    recogniser.onerror?.({ error: 'no-speech' });
    recogniser.onend?.();
    expect(states.at(-1)).toBe('listening');
    expect(recogniser.starts).toBe(2);
  });
});
