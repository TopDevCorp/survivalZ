import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { getTerrainHeight, hash2D, isOnRoad } from './heightmap';
import { WORLD_BUILDINGS } from './settlements';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface StreamedChunk {
  key: string;
  cx: number;
  cz: number;
  group: THREE.Group;
  disposables: (THREE.BufferGeometry | THREE.Material)[];
}

export class ChunkManager {
  private scene: THREE.Scene;
  private activeChunks = new Map<string, StreamedChunk>();
  private lastPlayerChunkX = Number.NaN;
  private lastPlayerChunkZ = Number.NaN;

  // Shared materials and geometries for zero-GC chunk streaming
  private trunkGeo: THREE.CylinderGeometry;
  private canopyLowGeo: THREE.ConeGeometry;
  private canopyMidGeo: THREE.ConeGeometry;
  private canopyTopGeo: THREE.ConeGeometry;
  private rockGeo: THREE.DodecahedronGeometry;
  private bushGeo: THREE.IcosahedronGeometry;

  private trunkMat: THREE.MeshStandardMaterial;
  private foliageMat: THREE.MeshStandardMaterial;
  private rockMat: THREE.MeshStandardMaterial;
  private bushMat: THREE.MeshStandardMaterial;
  private terrainMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pivot all geometries at bottom-center (y = 0 at ground)
    this.trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 3.6, 7);
    this.trunkGeo.translate(0, 1.8, 0);

    this.canopyLowGeo = new THREE.ConeGeometry(2.1, 4.2, 7);
    this.canopyLowGeo.translate(0, 3.9, 0);

    this.canopyMidGeo = new THREE.ConeGeometry(1.65, 3.8, 7);
    this.canopyMidGeo.translate(0, 6.1, 0);

    this.canopyTopGeo = new THREE.ConeGeometry(1.05, 3.0, 7);
    this.canopyTopGeo.translate(0, 8.1, 0);

    this.rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    this.rockGeo.scale(1.3, 0.75, 1.1);
    this.rockGeo.translate(0, 0.35, 0);

    this.bushGeo = new THREE.IcosahedronGeometry(0.85, 1);
    this.bushGeo.scale(1.2, 0.75, 1.2);
    this.bushGeo.translate(0, 0.45, 0);

    this.trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2e24,
      roughness: 0.92,
      metalness: 0.04,
    });

    this.foliageMat = new THREE.MeshStandardMaterial({
      color: 0x243829,
      roughness: 0.84,
      metalness: 0.06,
    });

    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x5c6266,
      roughness: 0.78,
      metalness: 0.14,
    });

    this.bushMat = new THREE.MeshStandardMaterial({
      color: 0x2e3f28,
      roughness: 0.9,
      metalness: 0.03,
    });

    this.terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.91,
      metalness: 0.05,
    });

    // Build distant coarse island base mesh so the 2km x 2km horizon is always visible
    this.createBaseIslandHorizonMesh();
  }

  private createBaseIslandHorizonMesh() {
    const size = BALANCE.WORLD.SIZE;
    const segs = 140;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = getTerrainHeight(vx, vz);
      // Offset coarse base slightly downward (-0.08m) so streamed high-res chunks sit cleanly on top
      pos.setY(i, vy - 0.08);

      const c = this.computeTerrainVertexColor(vx, vy, vz);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private computeTerrainVertexColor(x: number, y: number, z: number): THREE.Color {
    const noise = (hash2D(Math.floor(x * 0.25), Math.floor(z * 0.25)) - 0.5) * 0.05;
    if (y < 0.2) {
      return _color.setRGB(0.22 + noise, 0.21 + noise, 0.18 + noise); // Wet sea floor
    }
    if (isOnRoad(x, z)) {
      return _color.setRGB(0.24 + noise * 0.5, 0.25 + noise * 0.5, 0.26 + noise * 0.5); // Cracked Soviet asphalt
    }
    if (y < BALANCE.WORLD.BEACH_HEIGHT) {
      return _color.setRGB(0.48 + noise, 0.44 + noise, 0.37 + noise); // Baltic shingle & wet sand
    }
    if (y > 35.0) {
      return _color.setRGB(0.36 + noise, 0.38 + noise, 0.39 + noise); // Highland granite rock
    }
    // Pine forest moss & coastal grass
    return _color.setRGB(0.18 + noise, 0.24 + noise, 0.16 + noise);
  }

  public update(playerX: number, playerZ: number) {
    const chunkSize = BALANCE.WORLD.CHUNK_SIZE;
    const cx = Math.floor(playerX / chunkSize);
    const cz = Math.floor(playerZ / chunkSize);

    if (cx === this.lastPlayerChunkX && cz === this.lastPlayerChunkZ) {
      return;
    }
    this.lastPlayerChunkX = cx;
    this.lastPlayerChunkZ = cz;

    const r = BALANCE.WORLD.STREAM_RADIUS + 1; // 5x5 chunks around player (1000m x 1000m)
    const neededKeys = new Set<string>();

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const ncx = cx + dx;
        const ncz = cz + dz;
        const worldCenterX = (ncx + 0.5) * chunkSize;
        const worldCenterZ = (ncz + 0.5) * chunkSize;

        if (
          Math.abs(worldCenterX) > BALANCE.WORLD.HALF_SIZE + chunkSize ||
          Math.abs(worldCenterZ) > BALANCE.WORLD.HALF_SIZE + chunkSize
        ) {
          continue;
        }

        const key = `${ncx},${ncz}`;
        neededKeys.add(key);

        if (!this.activeChunks.has(key)) {
          const chunk = this.buildChunk(ncx, ncz, key);
          this.activeChunks.set(key, chunk);
          this.scene.add(chunk.group);
        }
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.activeChunks.entries()) {
      if (!neededKeys.has(key)) {
        this.scene.remove(chunk.group);
        chunk.disposables.forEach((d) => d.dispose());
        this.activeChunks.delete(key);
      }
    }
  }

  private isNearBuilding(x: number, z: number, pad = 9.0): boolean {
    for (let i = 0; i < WORLD_BUILDINGS.length; i++) {
      const b = WORLD_BUILDINGS[i];
      if (Math.abs(x - b.x) < b.width * 0.5 + pad && Math.abs(z - b.z) < b.depth * 0.5 + pad) {
        return true;
      }
    }
    return false;
  }

  private buildChunk(cx: number, cz: number, key: string): StreamedChunk {
    const chunkSize = BALANCE.WORLD.CHUNK_SIZE;
    const segs = BALANCE.WORLD.CHUNK_SEGMENTS;
    const originX = (cx + 0.5) * chunkSize;
    const originZ = (cz + 0.5) * chunkSize;

    const group = new THREE.Group();
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

    // 1. High-resolution terrain patch
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const wx = originX + pos.getX(i);
      const wz = originZ + pos.getZ(i);
      const wy = getTerrainHeight(wx, wz);
      pos.setY(i, wy);

      const c = this.computeTerrainVertexColor(wx, wy, wz);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    disposables.push(geo);

    const terrainMesh = new THREE.Mesh(geo, this.terrainMat);
    terrainMesh.position.set(originX, 0, originZ);
    terrainMesh.receiveShadow = true;
    group.add(terrainMesh);

    // 2. Instanced Scotch Pine Trees (4-part composite: trunk + 3 layered needle cones)
    const maxTrees = BALANCE.WORLD.TREES_PER_FOREST_CHUNK;
    const treeTransforms: { x: number; y: number; z: number; scale: number; rot: number; tint: number }[] = [];

    for (let i = 0; i < maxTrees; i++) {
      const rx = hash2D(cx * 73 + i * 19, cz * 41 + i * 7);
      const rz = hash2D(cx * 29 + i * 31, cz * 89 + i * 13);
      const wx = originX + (rx - 0.5) * chunkSize;
      const wz = originZ + (rz - 0.5) * chunkSize;
      const wy = getTerrainHeight(wx, wz);

      if (wy < BALANCE.WORLD.BEACH_HEIGHT + 1.1 || wy > 46.0) continue;
      if (isOnRoad(wx, wz) || this.isNearBuilding(wx, wz, 10.5)) continue;

      const scale = 0.82 + hash2D(wx, wz) * 0.45;
      const rot = hash2D(wz, wx) * Math.PI * 2;
      const tint = 0.85 + hash2D(wx * 2, wz * 2) * 0.3;
      treeTransforms.push({ x: wx, y: wy, z: wz, scale, rot, tint });
    }

    if (treeTransforms.length > 0) {
      const count = treeTransforms.length;
      const trunkInst = new THREE.InstancedMesh(this.trunkGeo, this.trunkMat, count);
      const lowInst = new THREE.InstancedMesh(this.canopyLowGeo, this.foliageMat, count);
      const midInst = new THREE.InstancedMesh(this.canopyMidGeo, this.foliageMat, count);
      const topInst = new THREE.InstancedMesh(this.canopyTopGeo, this.foliageMat, count);

      trunkInst.castShadow = true;
      lowInst.castShadow = true;
      midInst.castShadow = true;

      for (let i = 0; i < count; i++) {
        const t = treeTransforms[i];
        _dummy.position.set(t.x, t.y, t.z);
        _dummy.rotation.set(0, t.rot, 0);
        _dummy.scale.setScalar(t.scale);
        _dummy.updateMatrix();

        trunkInst.setMatrixAt(i, _dummy.matrix);
        lowInst.setMatrixAt(i, _dummy.matrix);
        midInst.setMatrixAt(i, _dummy.matrix);
        topInst.setMatrixAt(i, _dummy.matrix);

        _color.setRGB(0.14 * t.tint, 0.23 * t.tint, 0.16 * t.tint);
        lowInst.setColorAt(i, _color);
        midInst.setColorAt(i, _color);
        topInst.setColorAt(i, _color);
      }

      trunkInst.instanceMatrix.needsUpdate = true;
      lowInst.instanceMatrix.needsUpdate = true;
      midInst.instanceMatrix.needsUpdate = true;
      topInst.instanceMatrix.needsUpdate = true;
      if (lowInst.instanceColor) lowInst.instanceColor.needsUpdate = true;
      if (midInst.instanceColor) midInst.instanceColor.needsUpdate = true;
      if (topInst.instanceColor) topInst.instanceColor.needsUpdate = true;

      trunkInst.computeBoundingSphere();
      lowInst.computeBoundingSphere();
      midInst.computeBoundingSphere();
      topInst.computeBoundingSphere();

      group.add(trunkInst, lowInst, midInst, topInst);
    }

    // 3. Instanced Coastal Rocks & Outcrops
    const rockCount = BALANCE.WORLD.ROCKS_PER_CHUNK;
    const rockInst = new THREE.InstancedMesh(this.rockGeo, this.rockMat, rockCount);
    let validRocks = 0;
    for (let i = 0; i < rockCount; i++) {
      const rx = hash2D(cx * 101 + i * 17, cz * 53 + i * 23);
      const rz = hash2D(cx * 67 + i * 43, cz * 19 + i * 11);
      const wx = originX + (rx - 0.5) * chunkSize;
      const wz = originZ + (rz - 0.5) * chunkSize;
      const wy = getTerrainHeight(wx, wz);

      if (wy < 0.2 || isOnRoad(wx, wz) || this.isNearBuilding(wx, wz, 6)) continue;

      _dummy.position.set(wx, wy - 0.1, wz);
      _dummy.rotation.set(0, rx * Math.PI * 2, 0);
      _dummy.scale.set(0.7 + rx * 1.4, 0.6 + rz * 1.1, 0.7 + rx * 1.3);
      _dummy.updateMatrix();
      rockInst.setMatrixAt(validRocks++, _dummy.matrix);
    }
    rockInst.count = validRocks;
    if (validRocks > 0) {
      rockInst.instanceMatrix.needsUpdate = true;
      rockInst.computeBoundingSphere();
      rockInst.castShadow = true;
      rockInst.receiveShadow = true;
      group.add(rockInst);
    }

    // 4. Instanced Scrub Bushes
    const bushCount = BALANCE.WORLD.BUSHES_PER_CHUNK;
    const bushInst = new THREE.InstancedMesh(this.bushGeo, this.bushMat, bushCount);
    let validBushes = 0;
    for (let i = 0; i < bushCount; i++) {
      const rx = hash2D(cx * 37 + i * 29, cz * 79 + i * 3);
      const rz = hash2D(cx * 83 + i * 7, cz * 47 + i * 61);
      const wx = originX + (rx - 0.5) * chunkSize;
      const wz = originZ + (rz - 0.5) * chunkSize;
      const wy = getTerrainHeight(wx, wz);

      if (wy < BALANCE.WORLD.BEACH_HEIGHT + 0.4 || isOnRoad(wx, wz) || this.isNearBuilding(wx, wz, 5)) continue;

      _dummy.position.set(wx, wy, wz);
      _dummy.rotation.set(0, rz * Math.PI * 2, 0);
      _dummy.scale.setScalar(0.65 + rx * 0.65);
      _dummy.updateMatrix();
      bushInst.setMatrixAt(validBushes++, _dummy.matrix);
    }
    bushInst.count = validBushes;
    if (validBushes > 0) {
      bushInst.instanceMatrix.needsUpdate = true;
      bushInst.computeBoundingSphere();
      group.add(bushInst);
    }

    return { key, cx, cz, group, disposables };
  }
}
