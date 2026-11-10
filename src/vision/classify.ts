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

/**
 * Name every square. faces is six faces of nine samples (index 4 is the
 * centre). Each of the 48 other squares goes to the centre colour it is
 * closest to, with exactly eight per colour. That limit is what keeps red and
 * orange apart: the eight reddest are red, the eight most orange are orange.
 */
export function classify(faces: Lab[][]): FaceReading[] {
  if (faces.length !== 6 || faces.some((face) => face.length !== 9)) {
    throw new Error('Classifying needs six faces of nine samples each');
  }
  const anchors = faces.map((face) => face[4]);
  const names = nameAnchors(anchors);

  const squares: { face: number; cell: number }[] = [];
  faces.forEach((_, face) => {
    for (let cell = 0; cell < 9; cell++) if (cell !== 4) squares.push({ face, cell });
  });

  // 48 squares against 48 places: each anchor repeated eight times.
  const cost = squares.map(({ face, cell }) => {
    const row = new Array<number>(48);
    for (let a = 0; a < 6; a++) {
      const d = labDistance(faces[face][cell], anchors[a]);
      for (let k = 0; k < 8; k++) row[a * 8 + k] = d;
    }
    return row;
  });
  const place = assign(cost);

  const readings = faces.map((_, face) => {
    const reading = new Array<Color>(9);
    reading[4] = names[face];
    return reading;
  });
  squares.forEach(({ face, cell }, i) => {
    readings[face][cell] = names[Math.floor(place[i] / 8)];
  });
  return readings;
}
