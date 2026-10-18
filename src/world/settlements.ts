import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { getTerrainHeight, hash2D } from './heightmap';

export type BuildingCategory = 'house' | 'medical' | 'military' | 'industrial';

export interface WallAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface BuildingInstance {
  id: string;
  settlementId: string;
  category: BuildingCategory;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotationY: number; // 0, Math.PI/2, Math.PI, or -Math.PI/2 for crisp AABB collisions
  wallColliders: WallAABB[];
  roofBounds: { minX: number; maxX: number; minZ: number; maxZ: number; floorY: number; roofY: number };
  lootPoints: { x: number; y: number; z: number; category: BuildingCategory }[];
}

function createBuildingLayout(): BuildingInstance[] {
  const buildings: BuildingInstance[] = [];

  // Shared helper to register an axis-aligned enterable building with a front doorway (+Z or -Z or +X or -X)
  const addBuilding = (
    id: string,
    settlementId: string,
    category: BuildingCategory,
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    doorSide: 'north' | 'south' | 'east' | 'west'
  ) => {
    const y = getTerrainHeight(x, z);
    const halfW = width / 2;
    const halfD = depth / 2;
    const wallThick = 0.35;
    const doorWidth = 1.65;

    const minX = x - halfW;
    const maxX = x + halfW;
    const minZ = z - halfD;
    const maxZ = z + halfD;

    const wallColliders: WallAABB[] = [];

    // North wall (-Z)
    if (doorSide === 'north') {
      wallColliders.push(
        { minX, maxX: x - doorWidth / 2, minZ: minZ - wallThick, maxZ: minZ + wallThick, maxY: y + height },
        { minX: x + doorWidth / 2, maxX, minZ: minZ - wallThick, maxZ: minZ + wallThick, maxY: y + height }
      );
    } else {
      wallColliders.push({ minX, maxX, minZ: minZ - wallThick, maxZ: minZ + wallThick, maxY: y + height });
    }

    // South wall (+Z)
    if (doorSide === 'south') {
      wallColliders.push(
        { minX, maxX: x - doorWidth / 2, minZ: maxZ - wallThick, maxZ: maxZ + wallThick, maxY: y + height },
        { minX: x + doorWidth / 2, maxX, minZ: maxZ - wallThick, maxZ: maxZ + wallThick, maxY: y + height }
      );
    } else {
      wallColliders.push({ minX, maxX, minZ: maxZ - wallThick, maxZ: maxZ + wallThick, maxY: y + height });
    }

    // West wall (-X)
    if (doorSide === 'west') {
      wallColliders.push(
        { minX: minX - wallThick, maxX: minX + wallThick, minZ, maxZ: z - doorWidth / 2, maxY: y + height },
        { minX: minX - wallThick, maxX: minX + wallThick, minZ: z + doorWidth / 2, maxZ, maxY: y + height }
      );
    } else {
      wallColliders.push({ minX: minX - wallThick, maxX: minX + wallThick, minZ, maxZ, maxY: y + height });
    }

    // East wall (+X)
    if (doorSide === 'east') {
      wallColliders.push(
        { minX: maxX - wallThick, maxX: maxX + wallThick, minZ, maxZ: z - doorWidth / 2, maxY: y + height },
        { minX: maxX - wallThick, maxX: maxX + wallThick, minZ: z + doorWidth / 2, maxZ, maxY: y + height }
      );
    } else {
      wallColliders.push({ minX: maxX - wallThick, maxX: maxX + wallThick, minZ, maxZ, maxY: y + height });
    }

    const lootPoints = [
      { x: x - halfW * 0.45, y: y + 0.25, z: z - halfD * 0.4, category },
      { x: x + halfW * 0.45, y: y + 0.25, z: z + halfD * 0.35, category },
    ];
    if (width >= 9 || category === 'military' || category === 'medical') {
      lootPoints.push({ x, y: y + 0.25, z: z - halfD * 0.15, category });
    }

    buildings.push({
      id,
      settlementId,
      category,
      x,
      y,
      z,
      width,
      depth,
      height,
      rotationY:
        doorSide === 'south'
          ? 0
          : doorSide === 'north'
          ? Math.PI
          : doorSide === 'east'
          ? Math.PI / 2
          : -Math.PI / 2,
      wallColliders,
      roofBounds: { minX, maxX, minZ, maxZ, floorY: y, roofY: y + height },
      lootPoints,
    });
  };

  // 1. ZALIVSK (-340, 460) - Southern Coastal Town
  addBuilding('zal_1', 'zalivsk', 'house', -365, 435, 8.5, 7.5, 4.0, 'south');
  addBuilding('zal_2', 'zalivsk', 'house', -315, 435, 9.0, 7.5, 4.0, 'south');
  addBuilding('zal_3', 'zalivsk', 'medical', -370, 480, 10.5, 8.0, 4.2, 'north');
  addBuilding('zal_4', 'zalivsk', 'house', -315, 485, 8.5, 8.0, 4.0, 'north');
  addBuilding('zal_5', 'zalivsk', 'industrial', -340, 515, 12.0, 8.5, 4.8, 'north');
  addBuilding('zal_6', 'zalivsk', 'house', -285, 460, 8.0, 7.5, 3.8, 'west');

  // 2. KRASNO (80, 60) - Central Crossroads Town
  addBuilding('kra_1', 'krasno', 'house', 52, 35, 9.0, 8.0, 4.1, 'south');
  addBuilding('kra_2', 'krasno', 'medical', 105, 32, 11.5, 8.5, 4.3, 'south');
  addBuilding('kra_3', 'krasno', 'house', 48, 86, 8.5, 7.5, 4.0, 'north');
  addBuilding('kra_4', 'krasno', 'house', 108, 88, 9.5, 8.0, 4.0, 'north');
  addBuilding('kra_5', 'krasno', 'industrial', 138, 60, 11.0, 9.0, 4.6, 'west');
  addBuilding('kra_6', 'krasno', 'house', 24, 60, 8.0, 8.0, 3.9, 'east');
  addBuilding('kra_7', 'krasno', 'military', 80, 112, 10.0, 7.5, 3.9, 'north'); // Village militia post

  // 3. PRIBOR (450, -180) - Eastern Polyclinic & Timber Town
  addBuilding('pri_1', 'pribor', 'medical', 425, -205, 12.5, 9.0, 4.4, 'south');
  addBuilding('pri_2', 'pribor', 'house', 475, -205, 8.5, 7.5, 4.0, 'south');
  addBuilding('pri_3', 'pribor', 'house', 425, -155, 9.0, 8.0, 4.0, 'north');
  addBuilding('pri_4', 'pribor', 'industrial', 478, -152, 13.0, 9.0, 5.0, 'north');
  addBuilding('pri_5', 'pribor', 'house', 506, -180, 8.5, 7.5, 3.9, 'west');
  addBuilding('pri_6', 'pribor', 'house', 396, -180, 8.5, 7.5, 3.9, 'east');

  // 4. OBJECT-44 (-180, -470) - Northern Military Radar Garrison
  addBuilding('mil_1', 'object44', 'military', -208, -496, 13.0, 8.0, 4.0, 'south'); // Barracks Alpha
  addBuilding('mil_2', 'object44', 'military', -152, -496, 13.0, 8.0, 4.0, 'south'); // Barracks Bravo
  addBuilding('mil_3', 'object44', 'military', -212, -445, 11.5, 8.5, 4.2, 'north'); // Armory Command
  addBuilding('mil_4', 'object44', 'medical', -150, -445, 10.5, 8.0, 4.0, 'north'); // Field Infirmary
  addBuilding('mil_5', 'object44', 'military', -180, -525, 9.5, 9.5, 5.6, 'south'); // Radar Control Bunker

  return buildings;
}

export const WORLD_BUILDINGS: BuildingInstance[] = createBuildingLayout();

export function isPlayerIndoors(x: number, y: number, z: number): boolean {
  for (let i = 0; i < WORLD_BUILDINGS.length; i++) {
    const b = WORLD_BUILDINGS[i].roofBounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.floorY - 0.5 && y <= b.roofY) {
      return true;
    }
  }
  return false;
}

export function resolveBuildingCollisions(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  playerY: number,
  radius = 0.42
): { x: number; z: number } {
  let outX = nextX;
  let outZ = nextZ;

  for (let i = 0; i < WORLD_BUILDINGS.length; i++) {
    const b = WORLD_BUILDINGS[i];
    if (Math.abs(outX - b.x) > b.width + 4 || Math.abs(outZ - b.z) > b.depth + 4) continue;
    if (playerY > b.y + b.height) continue;

    for (let w = 0; w < b.wallColliders.length; w++) {
      const c = b.wallColliders[w];
      const expandedMinX = c.minX - radius;
      const expandedMaxX = c.maxX + radius;
      const expandedMinZ = c.minZ - radius;
      const expandedMaxZ = c.maxZ + radius;

      if (outX > expandedMinX && outX < expandedMaxX && outZ > expandedMinZ && outZ < expandedMaxZ) {
        // Resolve along minimum penetration axis
        const penLeft = outX - expandedMinX;
        const penRight = expandedMaxX - outX;
        const penTop = outZ - expandedMinZ;
        const penBottom = expandedMaxZ - outZ;
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);

        if (minPen === penLeft) outX = expandedMinX;
        else if (minPen === penRight) outX = expandedMaxX;
        else if (minPen === penTop) outZ = expandedMinZ;
        else outZ = expandedMaxZ;
      }
    }
  }

  return { x: outX, z: outZ };
}

// Create composite multi-part 3D mesh for a building
export function createBuildingMesh(b: BuildingInstance): THREE.Group {
  const group = new THREE.Group();
  group.position.set(b.x, b.y, b.z);

  const wallColor =
    b.category === 'military'
      ? 0x4b5345
      : b.category === 'medical'
      ? 0x7b858e
      : b.category === 'industrial'
      ? 0x5d534a
      : 0x6c6a63;

  const roofColor =
    b.category === 'military'
      ? 0x2c3329
      : b.category === 'medical'
      ? 0x3b4d5e
      : b.category === 'industrial'
      ? 0x4a352b
      : 0x473a32;

  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.88,
    metalness: 0.08,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.62,
    metalness: 0.32,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x383633,
    roughness: 0.92,
    metalness: 0.05,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: b.category === 'medical' ? 0xb91c1c : 0x2a2e33,
    roughness: 0.5,
    metalness: 0.4,
  });

  // 1. Concrete Foundation Floor Slab (offset +0.06m so it never Z-fights with terrain)
  const floorGeo = new THREE.BoxGeometry(b.width + 0.2, 0.24, b.depth + 0.2);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0.06;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // 2. Wall Segments from exact wallColliders + Door Lintels
  for (let i = 0; i < b.wallColliders.length; i++) {
    const c = b.wallColliders[i];
    const segW = c.maxX - c.minX;
    const segD = c.maxZ - c.minZ;
    const segGeo = new THREE.BoxGeometry(segW, b.height, segD);
    const segMesh = new THREE.Mesh(segGeo, wallMat);
    segMesh.position.set((c.minX + c.maxX) * 0.5 - b.x, b.height * 0.5, (c.minZ + c.maxZ) * 0.5 - b.z);
    segMesh.castShadow = true;
    segMesh.receiveShadow = true;
    group.add(segMesh);
  }

  // Doorway top lintel beam
  const lintelHeight = b.height - 2.35;
  if (lintelHeight > 0.2) {
    const lintelGeo = new THREE.BoxGeometry(1.75, lintelHeight, 0.38);
    const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
    const halfW = b.width / 2;
    const halfD = b.depth / 2;
    if (Math.abs(b.rotationY) < 0.1) {
      lintelMesh.position.set(0, b.height - lintelHeight / 2, halfD);
    } else if (Math.abs(b.rotationY - Math.PI) < 0.1) {
      lintelMesh.position.set(0, b.height - lintelHeight / 2, -halfD);
    } else if (b.rotationY > 0) {
      lintelMesh.rotation.y = Math.PI / 2;
      lintelMesh.position.set(halfW, b.height - lintelHeight / 2, 0);
    } else {
      lintelMesh.rotation.y = Math.PI / 2;
      lintelMesh.position.set(-halfW, b.height - lintelHeight / 2, 0);
    }
    group.add(lintelMesh);
  }

  // 3. Overhanging Roof Slab + Gable Ridge
  const roofGeo = new THREE.BoxGeometry(b.width + 0.7, 0.35, b.depth + 0.7);
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = b.height + 0.17;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  const ridgeGeo = new THREE.BoxGeometry(b.width * 0.88, 0.45, b.depth * 0.55);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, roofMat);
  ridgeMesh.position.y = b.height + 0.52;
  ridgeMesh.castShadow = true;
  group.add(ridgeMesh);

  // 4. Category-Specific Architectural Accents (Chimney, Medical Cross, Radar Dish, Crate)
  if (b.category === 'medical') {
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.15), trimMat);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.4, 0.15), trimMat);
    crossH.position.set(0, b.height + 0.55, b.depth / 2 + 0.32);
    crossV.position.set(0, b.height + 0.55, b.depth / 2 + 0.32);
    group.add(crossH, crossV);
  } else if (b.category === 'military') {
    // Roof radio mast or radar dish
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8), trimMat);
    mast.position.set(b.width * 0.25, b.height + 1.9, -b.depth * 0.2);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), trimMat);
    crossbar.position.set(b.width * 0.25, b.height + 3.1, -b.depth * 0.2);
    group.add(mast, crossbar);
  } else {
    // Brick/concrete chimney stack
    const hVal = hash2D(b.x, b.z);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.4, 0.75), trimMat);
    chimney.position.set((hVal - 0.5) * b.width * 0.5, b.height + 0.9, -b.depth * 0.22);
    chimney.castShadow = true;
    group.add(chimney);
  }

  // 5. Interior wooden table / supply crate for visual realism
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x4d3b2c, roughness: 0.85, metalness: 0.1 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.85), tableMat);
  crate.position.set(-b.width * 0.28, 0.52, -b.depth * 0.25);
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);

  return group;
}
