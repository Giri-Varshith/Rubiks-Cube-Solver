import { describe, expect, test } from 'vitest';
import type { SwapSuggestion } from '../cube/assemble';
import type { Color } from '../cube/types';
import { rgbToLab, type Lab } from '../vision/colorMath';
import { describeSquare, rankSwaps } from './swapHints';

const parse = (s: string) => s.replace(/\s+/g, '').split('') as Color[];
const readings = [
  parse('WWW WWW WWW'),
  parse('BYR RRR BYR'),
  parse('YBY OYG YOY'),
  parse('OOG OOB OGG'),
  parse('GBO BGR GGR'),
  parse('BYO GBY BRR'),
];

describe('describeSquare', () => {
  test('names a square by where it is, which face it is on, and the colour shown', () => {
    expect(describeSquare(readings, { face: 4, cell: 2 })).toBe('the top-right square of the green-centre face (shown as orange)');
    expect(describeSquare(readings, { face: 5, cell: 8 })).toBe('the bottom-right square of the blue-centre face (shown as red)');
    expect(describeSquare(readings, { face: 1, cell: 1 })).toBe('the top-middle square of the red-centre face (shown as yellow)');
    expect(describeSquare(readings, { face: 2, cell: 3 })).toBe('the middle-left square of the yellow-centre face (shown as orange)');
  });
});

describe('rankSwaps', () => {
  // What the camera saw: every square a clear colour, except two that are hard to tell apart.
  const plain: Record<Color, Lab> = {
    W: rgbToLab([235, 235, 235]),
    Y: rgbToLab([240, 210, 20]),
    R: rgbToLab([190, 30, 40]),
    O: rgbToLab([245, 110, 20]),
    B: rgbToLab([20, 70, 180]),
    G: rgbToLab([20, 150, 70]),
  };
  const samples = readings.map((reading) => reading.map((colour) => plain[colour]));
  samples[4][2] = rgbToLab([215, 60, 30]); // read as orange, really a reddish square
  samples[5][8] = rgbToLab([222, 72, 28]); // read as red, really an orange-ish square

  const lookAlike: SwapSuggestion = { a: { face: 4, cell: 2 }, b: { face: 5, cell: 8 } };
  const farApart: SwapSuggestion = { a: { face: 1, cell: 0 }, b: { face: 2, cell: 8 } }; // blue and yellow

  test('puts the pair that looked most alike to the camera first', () => {
    expect(rankSwaps([farApart, lookAlike], samples)).toEqual([lookAlike, farApart]);
    expect(rankSwaps([lookAlike, farApart], samples)).toEqual([lookAlike, farApart]);
  });

  test('does not change the list it was given', () => {
    const list = [farApart, lookAlike];
    rankSwaps(list, samples);
    expect(list).toEqual([farApart, lookAlike]);
  });
});
