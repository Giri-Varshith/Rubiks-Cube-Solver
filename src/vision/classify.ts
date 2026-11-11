// Turn 54 sampled colours into colour names.
//
// Nothing here uses fixed "this is red" values. The six centre squares of the
// cube being scanned are the reference colours, so the result adapts to the
// room's lighting and to this particular cube.
import type { Color, FaceReading } from '../cube/types';
import { chroma, hueDeg, labDistance, type Lab } from './colorMath';

/** The five non-white colours in the order they appear going round the hue circle, with a typical hue for each. */
const HUE_ORDER: { colour: Color; hue: number }[] = [
  { colour: 'R', hue: 38 },
  { colour: 'O', hue: 60 },
  { colour: 'Y', hue: 93 },
  { colour: 'G', hue: 150 },
  { colour: 'B', hue: 290 },
];

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Name the six centre colours. The least colourful one is white. The other
 * five must come in the order red, orange, yellow, green, blue going round
 * the hue circle, so only the starting point has to be chosen.
 */
export function nameAnchors(centres: Lab[]): Color[] {
  if (centres.length !== 6) throw new Error('Naming needs exactly six centre colours');
  const names = new Array<Color>(6);

  let white = 0;
  for (let i = 1; i < 6; i++) if (chroma(centres[i]) < chroma(centres[white])) white = i;
  names[white] = 'W';

  const rest = [0, 1, 2, 3, 4, 5].filter((i) => i !== white).sort((p, q) => hueDeg(centres[p]) - hueDeg(centres[q]));
  let bestShift = 0;
  let bestCost = Infinity;
  for (let shift = 0; shift < 5; shift++) {
    let cost = 0;
    for (let k = 0; k < 5; k++) cost += hueGap(hueDeg(centres[rest[(k + shift) % 5]]), HUE_ORDER[k].hue);
    if (cost < bestCost) {
      bestCost = cost;
      bestShift = shift;
    }
  }
  for (let k = 0; k < 5; k++) names[rest[(k + bestShift) % 5]] = HUE_ORDER[k].colour;
  return names;
}

/**
 * Minimum-cost one-to-one assignment (the Hungarian algorithm).
 * cost is a square matrix; the result gives, for each row, its column.
 */
function assign(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const columnOfRow = new Array<number>(n);
  for (let j = 1; j <= n; j++) columnOfRow[p[j] - 1] = j - 1;
  return columnOfRow;
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Share the samples out among the six reference colours, exactly eight each, as cheaply as possible. */
function shareOut(samples: Lab[], references: Lab[]): number[] {
  // 48 squares against 48 places: each reference repeated eight times.
  const cost = samples.map((sample) => {
    const row = new Array<number>(48);
    for (let r = 0; r < 6; r++) {
      const d = labDistance(sample, references[r]);
      for (let k = 0; k < 8; k++) row[r * 8 + k] = d;
    }
    return row;
  });
  return assign(cost).map((place) => Math.floor(place / 8));
}

const REFINE_PASSES = 3;

/**
 * If two starting colours are nearly the same while some squares are far from
 * every starting colour, one centre has been read as another face's colour
 * (a logo, or glare). Swap one of the twins for the square that is furthest
 * from everything, so all six real colours have a starting point.
 */
function spreadOut(references: Lab[], samples: Lab[]): Lab[] {
  const refs = [...references];
  for (let round = 0; round < 5; round++) {
    let twinB = 1;
    let closest = Infinity;
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const d = labDistance(refs[i], refs[j]);
        if (d < closest) {
          closest = d;
          twinB = j;
        }
      }
    }
    let loneliest = -1;
    let furthest = 0;
    samples.forEach((sample, index) => {
      const nearest = Math.min(...refs.map((ref) => labDistance(sample, ref)));
      if (nearest > furthest) {
        furthest = nearest;
        loneliest = index;
      }
    });
    // Only act when it is clear-cut: an ordinary odd reading must not trigger this.
    if (loneliest < 0 || furthest <= 1.5 * closest) break;
    // Either twin will do: both stand for the same colour.
    refs[twinB] = samples[loneliest];
  }
  return refs;
}

/**
 * Name every square. faces is six faces of nine samples (index 4 is the centre).
 *
 * 1. The 48 non-centre squares are shared out among the six centre colours,
 *    exactly eight each. That limit is what keeps red and orange apart: the
 *    eight reddest are red, the eight most orange are orange.
 * 2. Each group's colour is then re-measured as the middle value of its own
 *    eight squares, and the sharing is repeated. After this the centre
 *    readings no longer matter, so a centre that reads wrongly (most often a
 *    maker's logo printed on the white one) cannot spoil the whole cube.
 * 3. The six groups are named, and each centre is given a different one, by
 *    closeness. If a centre reads exactly like another face's colour, colour
 *    alone cannot say which is which; repairCentres in cube/assemble.ts
 *    settles that from how the pieces fit together.
 */
export function classify(faces: Lab[][]): FaceReading[] {
  if (faces.length !== 6 || faces.some((face) => face.length !== 9)) {
    throw new Error('Classifying needs six faces of nine samples each');
  }
  const centres = faces.map((face) => face[4]);
  const squares: { face: number; cell: number }[] = [];
  faces.forEach((_, face) => {
    for (let cell = 0; cell < 9; cell++) if (cell !== 4) squares.push({ face, cell });
  });
  const samples = squares.map(({ face, cell }) => faces[face][cell]);

  let references = spreadOut(centres, samples);
  let group = shareOut(samples, references);
  for (let pass = 0; pass < REFINE_PASSES; pass++) {
    references = [0, 1, 2, 3, 4, 5].map((g) => {
      const members = samples.filter((_, i) => group[i] === g);
      return [0, 1, 2].map((channel) => median(members.map((lab) => lab[channel]))) as Lab;
    });
    const next = shareOut(samples, references);
    const settled = next.every((g, i) => g === group[i]);
    group = next;
    if (settled) break;
  }
  const names = nameAnchors(references);

  // Each centre takes a different group: the pairing with the smallest total colour difference.
  const centreGroup = assign(centres.map((centre) => references.map((reference) => labDistance(centre, reference))));

  const readings = faces.map((_, face) => {
    const reading = new Array<Color>(9);
    reading[4] = names[centreGroup[face]];
    return reading;
  });
  squares.forEach(({ face, cell }, i) => {
    readings[face][cell] = names[group[i]];
  });
  return readings;
}

/**
 * Every pair of faces, the two whose centre readings looked most alike first.
 * If two faces were given each other's names, it is most likely such a pair.
 */
export function centreLookAlikes(faces: Lab[][]): [number, number][] {
  const pairs: { pair: [number, number]; distance: number }[] = [];
  for (let a = 0; a < faces.length; a++) {
    for (let b = a + 1; b < faces.length; b++) {
      pairs.push({ pair: [a, b], distance: labDistance(faces[a][4], faces[b][4]) });
    }
  }
  return pairs.sort((p, q) => p.distance - q.distance).map((entry) => entry.pair);
}
