// The animated 3D cube. The only file that touches three.js.
//
// Sticker positions and turn directions come from cube/geometry.ts, the same
// tables the move logic uses, so the picture cannot disagree with the maths.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from '../config';
import { STICKERS, applyMove, layer, turnAngle } from '../cube/geometry';
import { COLOR_HEX, FACE_TO_COLOR, SOLVED, type Face, type Facelets, type Move } from '../cube/types';

const HOME_VIEW = new THREE.Vector3(4.5, 4, 6);
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

interface Part {
  mesh: THREE.Mesh;
  /** Which small cube this part belongs to (each coordinate -1, 0 or 1). */
  cubie: [number, number, number];
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
}

export class Cube3D {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly parts: Part[] = [];
  private readonly stickerMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly resizeObserver: ResizeObserver;
  private facelets: Facelets = SOLVED;
  private frame = 0;
  /** Bumped whenever an animation must stop early. */
  private generation = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = 'block';
    container.append(this.renderer.domElement);

    this.scene.add(this.root);
    this.root.add(this.pivot);
    this.build();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.addEventListener('change', () => this.requestRender());
    this.resetView();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setState(SOLVED);
  }

  private build(): void {
    const body = new THREE.MeshBasicMaterial({ color: 0x0c0d0f });
    const box = new THREE.BoxGeometry(0.97, 0.97, 0.97);
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const mesh = new THREE.Mesh(box, body);
          mesh.position.set(x, y, z);
          this.addPart(mesh, [x, y, z]);
        }
      }
    }

    const square = new THREE.PlaneGeometry(0.84, 0.84);
    const forward = new THREE.Vector3(0, 0, 1);
    for (const sticker of STICKERS) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      this.stickerMaterials.push(material);
      const mesh = new THREE.Mesh(square, material);
      const normal = new THREE.Vector3(...sticker.normal);
      mesh.position.set(...sticker.pos).addScaledVector(normal, 0.49);
      mesh.quaternion.setFromUnitVectors(forward, normal);
      this.addPart(mesh, sticker.pos);
    }
  }

  private addPart(mesh: THREE.Mesh, cubie: [number, number, number]): void {
    this.root.add(mesh);
    this.parts.push({ mesh, cubie, homePosition: mesh.position.clone(), homeQuaternion: mesh.quaternion.clone() });
  }

  /** Put every part back in its home place and out of the turning group. */
  private restoreParts(): void {
    this.pivot.rotation.set(0, 0, 0);
    for (const part of this.parts) {
      this.root.add(part.mesh);
      part.mesh.position.copy(part.homePosition);
      part.mesh.quaternion.copy(part.homeQuaternion);
    }
  }

  /** Show a cube instantly. Stops any animation in progress. */
  setState(f: Facelets): void {
    this.generation++;
    this.facelets = f;
    this.restoreParts();
    for (let i = 0; i < 54; i++) {
      this.stickerMaterials[i].color.set(COLOR_HEX[FACE_TO_COLOR[f[i] as Face]] ?? '#555555');
    }
    this.requestRender();
  }

  /** Turn one layer, then settle on the resulting cube. Resolves when finished (or cut short). */
  animateMove(m: Move, ms: number = CONFIG.moveMs): Promise<void> {
    const after = applyMove(this.facelets, m);
    const { axis, coord } = layer(m.face);
    const angle = turnAngle(m);

    this.restoreParts();
    for (const part of this.parts) {
      if (part.cubie[axis] === coord) this.pivot.add(part.mesh);
    }
    const generation = ++this.generation;
    const start = performance.now();
    const duration = Math.max(1, ms * (m.turns === 2 ? 1.4 : 1));

    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (this.disposed || generation !== this.generation) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.pivot.setRotationFromAxisAngle(AXES[axis], angle * eased);
        this.renderer.render(this.scene, this.camera);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.setState(after);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  /** Look at the cube from the front-right and above: top, front and right faces visible. */
  resetView(): void {
    this.camera.position.copy(HOME_VIEW);
    this.camera.up.set(0, 1, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.requestRender();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.disposed) this.renderer.render(this.scene, this.camera);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const material of this.stickerMaterials) material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
