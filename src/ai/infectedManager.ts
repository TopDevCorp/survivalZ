import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { getTerrainHeight, hash2D } from '../world/heightmap';
import { WORLD_BUILDINGS, resolveBuildingCollisions } from '../world/settlements';
import { soundEngine } from '../audio/soundEngine';

export type InfectedState = 'idle' | 'wander' | 'alerted' | 'chase' | 'attack' | 'dead';

export interface InfectedAgent {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  state: InfectedState;
  stateTimer: number;
  attackCooldown: number;
  losMemoryTimer: number;
  targetX: number;
  targetZ: number;
  animPhase: number;
  isMilitary: boolean;
  group: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
}

export class InfectedManager {
  private scene: THREE.Scene;
  public agents: InfectedAgent[] = [];

  // Shared materials for performance
  private skinMat = new THREE.MeshStandardMaterial({ color: 0x6f7b6d, roughness: 0.85, metalness: 0.05 });
  private civCoatMat = new THREE.MeshStandardMaterial({ color: 0x3b3834, roughness: 0.92, metalness: 0.04 });
  private milCoatMat = new THREE.MeshStandardMaterial({ color: 0x344230, roughness: 0.88, metalness: 0.08 });
  private pantsMat = new THREE.MeshStandardMaterial({ color: 0x25282c, roughness: 0.9, metalness: 0.04 });
  private bloodMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.65, metalness: 0.1 });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.spawnInitialPopulation();
  }

  private createInfectedMesh(isMilitary: boolean): {
    group: THREE.Group;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const coat = isMilitary ? this.milCoatMat : this.civCoatMat;

    // 1. Hunched Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.64, 0.25), coat);
    torso.position.y = 1.08;
    torso.rotation.x = 0.18;
    torso.castShadow = true;
    group.add(torso);

    // 2. Bloodstain Chest Accent
    const stain = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.27), this.bloodMat);
    stain.position.set(0.02, 1.06, -0.01);
    stain.rotation.x = 0.18;
    group.add(stain);

    // 3. Head (tilted forward/sideways)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.27, 0.25), this.skinMat);
    head.position.set(0, 1.56, -0.06);
    head.rotation.z = 0.12;
    head.castShadow = true;
    group.add(head);

    if (isMilitary) {
      // Soviet steel helmet
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), this.milCoatMat);
      helmet.position.set(0, 1.62, -0.06);
      group.add(helmet);
    }

    // 4 & 5. Arms
    const armGeo = new THREE.BoxGeometry(0.13, 0.56, 0.13);
    armGeo.translate(0, -0.24, 0);
    const leftArm = new THREE.Mesh(armGeo, coat);
    leftArm.position.set(-0.29, 1.34, -0.04);
    leftArm.castShadow = true;

    const rightArm = new THREE.Mesh(armGeo, coat);
    rightArm.position.set(0.29, 1.34, -0.04);
    rightArm.castShadow = true;
    group.add(leftArm, rightArm);

    // 6 & 7. Legs
    const legGeo = new THREE.BoxGeometry(0.16, 0.74, 0.16);
    legGeo.translate(0, -0.37, 0);
    const leftLeg = new THREE.Mesh(legGeo, this.pantsMat);
    leftLeg.position.set(-0.12, 0.75, 0);
    leftLeg.castShadow = true;

    const rightLeg = new THREE.Mesh(legGeo, this.pantsMat);
    rightLeg.position.set(0.12, 0.75, 0);
    rightLeg.castShadow = true;
    group.add(leftLeg, rightLeg);

    return { group, leftArm, rightArm, leftLeg, rightLeg };
  }

  public spawnInitialPopulation() {
    // Clear existing
    for (const a of this.agents) {
      this.scene.remove(a.group);
    }
    this.agents = [];

    // Spawn town & military hordes up to MAX_ACTIVE_ZOMBIES (40)
    let idCounter = 1;
    for (const settlement of BALANCE.SETTLEMENTS) {
      const count = Math.min(9, settlement.infectedCount);
      for (let i = 0; i < count; i++) {
        if (this.agents.length >= BALANCE.AI.MAX_ACTIVE_ZOMBIES) break;
        const angle = hash2D(i * 17, settlement.center[0]) * Math.PI * 2;
        const dist = 14 + hash2D(settlement.center[1], i * 31) * (settlement.radius * 0.75);
        const x = settlement.center[0] + Math.cos(angle) * dist;
        const z = settlement.center[1] + Math.sin(angle) * dist;
        const y = Math.max(0.5, getTerrainHeight(x, z));
        this.spawnAgent(`z_${idCounter++}`, x, y, z, settlement.type === 'military_camp');
      }
    }

    // Sparse forest / road infected for remaining slots up to 40
    while (this.agents.length < BALANCE.AI.MAX_ACTIVE_ZOMBIES) {
      const idx = this.agents.length;
      const angle = hash2D(idx * 43, idx * 19) * Math.PI * 2;
      const dist = 120 + hash2D(idx * 71, idx * 11) * 520;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);
      if (y > BALANCE.WORLD.BEACH_HEIGHT + 1.0) {
        this.spawnAgent(`z_${idCounter++}`, x, y, z, false);
      } else {
        this.spawnAgent(`z_${idCounter++}`, -320 + (idx % 7) * 14, getTerrainHeight(-320, 440), 440 + (idx % 5) * 12, false);
      }
    }
  }

  private spawnAgent(id: string, x: number, y: number, z: number, isMilitary: boolean) {
    const parts = this.createInfectedMesh(isMilitary);
    parts.group.position.set(x, y, z);
    this.scene.add(parts.group);

    this.agents.push({
      id,
      x,
      y,
      z,
      yaw: Math.random() * Math.PI * 2,
      health: isMilitary ? 115 : 85,
      state: 'idle',
      stateTimer: 2 + Math.random() * 5,
      attackCooldown: 0,
      losMemoryTimer: 0,
      targetX: x,
      targetZ: z,
      animPhase: Math.random() * 10,
      isMilitary,
      ...parts,
    });
  }

  public notifySoundEmission(x: number, z: number, radius: number) {
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.state === 'dead') continue;
      const dx = x - a.x;
      const dz = z - a.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= radius * BALANCE.AI.HEARING_SENSITIVITY) {
        a.targetX = x;
        a.targetZ = z;
        if (a.state === 'idle' || a.state === 'wander') {
          a.state = dist < radius * 0.55 ? 'chase' : 'alerted';
          a.stateTimer = 8.0;
          a.losMemoryTimer = BALANCE.AI.LOS_MEMORY_SECONDS;
          soundEngine.playZombieGroan(dist);
        } else if (a.state === 'alerted' || a.state === 'chase') {
          a.losMemoryTimer = BALANCE.AI.LOS_MEMORY_SECONDS;
        }
      }
    }
  }

  private hasLineOfSight(ax: number, az: number, px: number, pz: number): boolean {
    // Check if any building wall AABB intersects the 2D segment between zombie (ax, az) and player (px, pz)
    const steps = 6;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const sx = ax + (px - ax) * t;
      const sz = az + (pz - az) * t;

      for (let bIdx = 0; bIdx < WORLD_BUILDINGS.length; bIdx++) {
        const b = WORLD_BUILDINGS[bIdx];
        if (Math.abs(sx - b.x) > b.width + 2 || Math.abs(sz - b.z) > b.depth + 2) continue;
        for (let w = 0; w < b.wallColliders.length; w++) {
          const c = b.wallColliders[w];
          if (sx >= c.minX && sx <= c.maxX && sz >= c.minZ && sz <= c.maxZ) {
            return false; // Blocked by solid wall
          }
        }
      }
    }
    return true;
  }

  public damageAgent(agent: InfectedAgent, amount: number, playerX: number, playerZ: number): boolean {
    if (agent.state === 'dead') return false;
    agent.health -= amount;
    agent.targetX = playerX;
    agent.targetZ = playerZ;
    agent.state = 'chase';
    agent.losMemoryTimer = BALANCE.AI.LOS_MEMORY_SECONDS;

    if (agent.health <= 0) {
      agent.state = 'dead';
      agent.group.rotation.x = -Math.PI / 2;
      agent.group.position.y = agent.y + 0.18;
      return true; // Killed!
    }
    return false;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerNoiseRadius: number,
    isNight: boolean,
    isPlayerCrouching: boolean,
    onPlayerHit: (damage: number, causesBleed: boolean) => void
  ) {
    const sightRange = (isNight ? BALANCE.AI.SIGHT_RANGE_NIGHT : BALANCE.AI.SIGHT_RANGE_DAY) *
      (isPlayerCrouching ? 0.65 : 1.0);

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.state === 'dead') continue;

      const dx = playerPos.x - a.x;
      const dz = playerPos.z - a.z;
      const distSq = dx * dx + dz * dz;

      // Skip heavy AI math for distant zombies (> 165m), just keep idle
      if (distSq > 165 * 165) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;

      const dist = Math.sqrt(distSq);
      a.attackCooldown = Math.max(0, a.attackCooldown - dt);

      // Check Hearing
      const hearsPlayer = dist <= playerNoiseRadius * BALANCE.AI.HEARING_SENSITIVITY;

      // Check Vision Cone + Line of Sight
      let seesPlayer = false;
      if (dist <= sightRange) {
        const forwardX = -Math.sin(a.yaw);
        const forwardZ = -Math.cos(a.yaw);
        const dirX = dx / (dist || 1);
        const dirZ = dz / (dist || 1);
        const dot = forwardX * dirX + forwardZ * dirZ;
        if (dot >= BALANCE.AI.SIGHT_FOV_COS || dist < 4.5) {
          seesPlayer = this.hasLineOfSight(a.x, a.z, playerPos.x, playerPos.z);
        }
      }

      if (seesPlayer || hearsPlayer) {
        a.targetX = playerPos.x;
        a.targetZ = playerPos.z;
        a.losMemoryTimer = BALANCE.AI.LOS_MEMORY_SECONDS;
        if (a.state !== 'chase' && a.state !== 'attack') {
          a.state = seesPlayer ? 'chase' : 'alerted';
          soundEngine.playZombieGroan(dist);
        }
      }

      // State Machine Transitions
      switch (a.state) {
        case 'idle': {
          a.stateTimer -= dt;
          if (a.stateTimer <= 0) {
            a.state = 'wander';
            a.stateTimer = 4 + Math.random() * 6;
            const angle = Math.random() * Math.PI * 2;
            a.targetX = a.x + Math.cos(angle) * 14;
            a.targetZ = a.z + Math.sin(angle) * 14;
          }
          break;
        }

        case 'wander': {
          a.stateTimer -= dt;
          const reached = this.moveToward(a, a.targetX, a.targetZ, BALANCE.AI.WANDER_SPEED, dt);
          if (reached || a.stateTimer <= 0) {
            a.state = 'idle';
            a.stateTimer = 2.5 + Math.random() * 4;
          }
          break;
        }

        case 'alerted': {
          a.losMemoryTimer -= dt;
          if (seesPlayer) {
            a.state = 'chase';
          } else {
            const reached = this.moveToward(a, a.targetX, a.targetZ, BALANCE.AI.ALERT_INVESTIGATE_SPEED, dt);
            if (reached || a.losMemoryTimer <= 0) {
              a.state = 'idle';
              a.stateTimer = 3.0;
            }
          }
          break;
        }

        case 'chase': {
          if (!seesPlayer && !hearsPlayer) {
            a.losMemoryTimer -= dt;
            if (a.losMemoryTimer <= 0) {
              // Lost player after breaking line of sight and going quiet!
              a.state = 'alerted';
              break;
            }
          }
          if (dist <= BALANCE.AI.ATTACK_RANGE) {
            a.state = 'attack';
          } else {
            this.moveToward(a, a.targetX, a.targetZ, BALANCE.AI.CHASE_SPEED, dt);
          }
          break;
        }

        case 'attack': {
          // Face player
          a.yaw = Math.atan2(-dx, -dz);
          if (dist > BALANCE.AI.ATTACK_RANGE * 1.2) {
            a.state = 'chase';
          } else if (a.attackCooldown <= 0) {
            a.attackCooldown = BALANCE.AI.ATTACK_INTERVAL;
            soundEngine.playZombieGroan(dist);
            soundEngine.playHitImpact();
            const causesBleed = Math.random() < BALANCE.AI.BLEED_CHANCE_ON_HIT;
            onPlayerHit(BALANCE.AI.ATTACK_DAMAGE, causesBleed);
          }
          break;
        }
      }

      // Update limb animations
      const isMoving = a.state === 'wander' || a.state === 'alerted' || a.state === 'chase';
      const speedMult = a.state === 'chase' ? 11.5 : 5.5;
      if (isMoving) {
        a.animPhase += dt * speedMult;
      }
      const legSwing = isMoving ? Math.sin(a.animPhase) * 0.55 : 0;
      a.leftLeg.rotation.x = legSwing;
      a.rightLeg.rotation.x = -legSwing;

      if (a.state === 'chase' || a.state === 'attack') {
        // Outstretched zombie arms
        const attackLunge = a.attackCooldown > BALANCE.AI.ATTACK_INTERVAL - 0.25 ? 0.65 : 0;
        a.leftArm.rotation.x = 1.35 + Math.sin(a.animPhase) * 0.2 + attackLunge;
        a.rightArm.rotation.x = 1.35 - Math.sin(a.animPhase) * 0.2 + attackLunge;
      } else {
        a.leftArm.rotation.x = 0.25 + legSwing * 0.4;
        a.rightArm.rotation.x = 0.25 - legSwing * 0.4;
      }

      a.group.position.set(a.x, a.y, a.z);
      a.group.rotation.y = a.yaw;
    }
  }

  private moveToward(a: InfectedAgent, tx: number, tz: number, speed: number, dt: number): boolean {
    const dx = tx - a.x;
    const dz = tz - a.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.65) return true;

    const dirX = dx / dist;
    const dirZ = dz / dist;
    a.yaw = Math.atan2(-dirX, -dirZ);

    const nextX = a.x + dirX * speed * dt;
    const nextZ = a.z + dirZ * speed * dt;
    const resolved = resolveBuildingCollisions(a.x, a.z, nextX, nextZ, a.y, 0.38);

    a.x = resolved.x;
    a.z = resolved.z;
    a.y = Math.max(0.1, getTerrainHeight(a.x, a.z));
    return false;
  }
}
