// The animation must turn each layer the same way the move logic does.
// This rotates sticker positions with three.js exactly as the 3D cube does and
// checks every sticker lands where applyMove says it should.
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { STICKERS, applyMove, layer, turnAngle } from '../cube/geometry';
import { formatMove } from '../cube/moves';
import { FACES, type Move } from '../cube/types';

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const ALL_MOVES: Move[] = FACES.flatMap((face) => ([1, 2, 3] as const).map((turns) => ({ face, turns })));

// 54 different characters, so every sticker can be followed.
const LABELS = Array.from({ length: 54 }, (_, i) => String.fromCharCode(48 + i)).join('');

const place = (v: THREE.Vector3) => `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;
const INDEX = new Map(STICKERS.map((s, i) => [`${s.pos.join(',')}|${s.normal.join(',')}`, i]));

describe('the animated turn agrees with the move logic', () => {
  test.each(ALL_MOVES.map((m) => ({ name: formatMove(m), m })))('$name', ({ m }) => {
    const after = applyMove(LABELS, m);
    const { axis, coord } = layer(m.face);
    let moved = 0;
    STICKERS.forEach((sticker, i) => {
      if (sticker.pos[axis] !== coord) return;
      const pos = new THREE.Vector3(...sticker.pos).applyAxisAngle(AXES[axis], turnAngle(m));
      const normal = new THREE.Vector3(...sticker.normal).applyAxisAngle(AXES[axis], turnAngle(m));
      const landed = INDEX.get(`${place(pos)}|${place(normal)}`);
      expect(landed).toBeDefined();
      expect(after[landed!]).toBe(LABELS[i]);
      moved++;
    });
    expect(moved).toBe(21);
  });

  test('an anticlockwise turn is drawn as one quarter turn, not three', () => {
    expect(Math.abs(turnAngle({ face: 'R', turns: 3 }))).toBeCloseTo(Math.PI / 2);
    expect(turnAngle({ face: 'R', turns: 3 })).toBeCloseTo(-turnAngle({ face: 'R', turns: 1 }));
    expect(Math.abs(turnAngle({ face: 'U', turns: 2 }))).toBeCloseTo(Math.PI);
  });
});
