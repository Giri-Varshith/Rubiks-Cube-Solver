import { describe, expect, test } from 'vitest';
import { pickVoice } from './voiceSpeaker';

const voice = (name: string, lang: string, localService: boolean, isDefault = false) => ({ name, lang, localService, default: isDefault });

describe('pickVoice: only voices that speak on this device', () => {
  test('prefers an on-device English voice over an online one', () => {
    const voices = [voice('Google US English', 'en-US', false, true), voice('Microsoft Zira', 'en-US', true)];
    expect(pickVoice(voices)?.name).toBe('Microsoft Zira');
  });

  test('never picks an online voice, even if it is the only English one', () => {
    expect(pickVoice([voice('Online Natural', 'en-GB', false), voice('Hortense', 'fr-FR', true)])).toBeNull();
  });

  test('never picks a voice for another language', () => {
    expect(pickVoice([voice('Hortense', 'fr-FR', true)])).toBeNull();
  });

  test("among on-device English voices, takes the system's default, else a US one, else the first", () => {
    expect(pickVoice([voice('A', 'en-GB', true), voice('B', 'en-IN', true, true), voice('C', 'en-US', true)])?.name).toBe('B');
    expect(pickVoice([voice('A', 'en-GB', true), voice('C', 'en-US', true)])?.name).toBe('C');
    expect(pickVoice([voice('A', 'en-GB', true), voice('D', 'en_AU', true)])?.name).toBe('A');
  });

  test('no voices at all', () => {
    expect(pickVoice([])).toBeNull();
  });
});
