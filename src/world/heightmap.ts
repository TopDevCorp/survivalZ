import { BALANCE } from '../config/balance';

export interface RoadSegment {
  a: [number, number];
  b: [number, number];
  width: number;
}

export const ROAD_NETWORK: RoadSegment[] = [
  // Main coastal-to-inland arterial from Zalivsk (-340, 460) to Krasno (80, 60)
  { a: [-520, 620], b: [-340, 460], width: 7.5 },
  { a: [-340, 460], b: [-140, 260], width: 7.5 },
  { a: [-140, 260], b: [80, 60], width: 7.5 },
  // Eastern highway from Krasno (80, 60) to Pribor (450, -180)
  { a: [80, 60], b: [270, -50], width: 7.5 },
  { a: [270, -50], b: [450, -180], width: 7.5 },
  { a: [450, -180], b: [620, -240], width: 6.5 },
  // Northern garrison road from Krasno (80, 60) to Object-44 (-180, -470)
  { a: [80, 60], b: [-40, -190], width: 7.0 },
  { a: [-40, -190], b: [-180, -470], width: 7.0 },
];

// Fast deterministic 2D hash
export function hash2D(x: number, z: number): number {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fz * fz * (3.0 - 2.0 * fz);

  const n00 = hash2D(ix, iz);
  const n10 = hash2D(ix + 1, iz);
  const n01 = hash2D(ix, iz + 1);
  const n11 = hash2D(ix + 1, iz + 1);

  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise2D(x * frequency, z * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

export function distanceToSegmentSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const l2 = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
  if (l2 === 0) return (px - ax) * (px - ax) + (pz - az) * (pz - az);
  let t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * (bx - ax);
  const projZ = az + t * (bz - az);
  return (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
}

export function isOnRoad(x: number, z: number): boolean {
  for (let i = 0; i < ROAD_NETWORK.length; i++) {
    const seg = ROAD_NETWORK[i];
    const halfW = seg.width * 0.55;
    const dSq = distanceToSegmentSq(x, z, seg.a[0], seg.a[1], seg.b[0], seg.b[1]);
    if (dSq <= halfW * halfW) return true;
  }
  return false;
}

function computeRawIslandHeight(x: number, z: number): number {
  const half = BALANCE.WORLD.HALF_SIZE;
  // Normalized distance from island center with organic coastal bays/headlands
  const coastWarp = (fbm2D(x * 0.0022 + 11.3, z * 0.0022 - 7.1, 3) - 0.5) * 0.28;
  const distNorm = Math.sqrt(x * x + z * z) / (half * 0.86) + coastWarp;

  if (distNorm >= 1.08) {
    return -4.5; // Deep Baltic sea floor
  }

  // Smooth coastal mask (0 at shoreline distNorm=0.92, 1 inland)
  const islandMask = Math.max(0, Math.min(1, (0.94 - distNorm) / 0.42));
  const smoothMask = islandMask * islandMask * (3 - 2 * islandMask);

  // Rolling hills + central ridge
  const baseHills = fbm2D(x * 0.0018 + 3.7, z * 0.0018 + 9.2, 4);
  const ridgeDetail = fbm2D(x * 0.0065 - 14.2, z * 0.0065 + 5.4, 3);

  const rawElevation = -2.2 + smoothMask * (8.0 + baseHills * 38.0 + ridgeDetail * 14.0);
  return rawElevation;
}

// Precompute target flat elevations for each settlement center
const SETTLEMENT_HEIGHTS: number[] = BALANCE.SETTLEMENTS.map((s) =>
  Math.max(4.5, computeRawIslandHeight(s.center[0], s.center[1]))
);

export function getTerrainHeight(x: number, z: number): number {
  let h = computeRawIslandHeight(x, z);

  // Smoothly flatten terrain pads inside settlements so boxy buildings sit flush
  for (let i = 0; i < BALANCE.SETTLEMENTS.length; i++) {
    const s = BALANCE.SETTLEMENTS[i];
    const dx = x - s.center[0];
    const dz = z - s.center[1];
    const dist = Math.sqrt(dx * dx + dz * dz);
    const outerRadius = s.radius * 1.25;
    if (dist < outerRadius) {
      const t = Math.max(0, Math.min(1, (dist - s.radius * 0.72) / (outerRadius - s.radius * 0.72)));
      const blend = t * t * (3 - 2 * t);
      const targetH = SETTLEMENT_HEIGHTS[i];
      h = targetH * (1 - blend) + h * blend;
    }
  }

  return h;
}

export function getSurfaceType(x: number, z: number): 'water' | 'sand' | 'road' | 'grass' | 'rock' {
  const h = getTerrainHeight(x, z);
  if (h < BALANCE.WORLD.WATER_LEVEL + 0.15) return 'water';
  if (isOnRoad(x, z)) return 'road';
  if (h < BALANCE.WORLD.BEACH_HEIGHT) return 'sand';
  if (h > 36.0) return 'rock';
  return 'grass';
}

export function getRandomBeachSpawn(): { x: number; y: number; z: number; yaw: number } {
  // Pick a random angle along the southern/western/eastern coastline and raymarch inward to beach height
  const candidateAngles = [
    Math.PI * 0.65,
    Math.PI * 0.78,
    Math.PI * 0.52,
    Math.PI * 0.35,
    Math.PI * 0.88,
  ];
  const baseAngle = candidateAngles[Math.floor(Math.random() * candidateAngles.length)] + (Math.random() - 0.5) * 0.18;

  for (let r = 920; r > 220; r -= 8) {
    const x = Math.cos(baseAngle) * r;
    const z = Math.sin(baseAngle) * r;
    const h = getTerrainHeight(x, z);
    if (h >= 0.75 && h <= 2.4) {
      // Face inland toward the island center
      const yaw = Math.atan2(-x, -z);
      return { x, y: h, z, yaw };
    }
  }

  // Fallback near southern Zalivsk coast
  const fallbackX = -460;
  const fallbackZ = 560;
  return {
    x: fallbackX,
    y: Math.max(1.2, getTerrainHeight(fallbackX, fallbackZ)),
    z: fallbackZ,
    yaw: Math.atan2(460, -560),
  };
}
