import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { InfectedManager } from '../ai/infectedManager';
import { InventorySystem, ITEM_TEMPLATES } from '../inventory/inventorySystem';
import { PlayerController } from '../player/playerController';
import { SurvivalSystem } from '../survival/survivalSystem';
import { soundEngine } from '../audio/soundEngine';

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _toZombie = new THREE.Vector3();

export class CombatSystem {
  private cooldownTimer = 0;
  private muzzleLight: THREE.PointLight;
  private muzzleTimer = 0;

  constructor(scene: THREE.Scene) {
    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 22, 1.8);
    scene.add(this.muzzleLight);
  }

  public getActiveWeaponKey(inventory: InventorySystem): 'fists' | 'pipe' | 'axe' | 'ij70' | 'sk59' {
    if (!inventory.heldWeaponItem || inventory.heldWeaponItem.condition === 'Ruined') {
      return 'fists';
    }
    const tmpl = ITEM_TEMPLATES[inventory.heldWeaponItem.templateId];
    return tmpl.weaponKey || 'fists';
  }

  public triggerPrimaryAttack(
    camera: THREE.PerspectiveCamera,
    player: PlayerController,
    inventory: InventorySystem,
    infected: InfectedManager,
    survival: SurvivalSystem
  ) {
    if (this.cooldownTimer > 0 || survival.stats.isDead) return;

    const weaponKey = this.getActiveWeaponKey(inventory);
    const spec = BALANCE.COMBAT.WEAPONS[weaponKey];

    // Check melee stamina
    if (spec.type === 'melee') {
      if (player.stamina < spec.staminaCost) {
        survival.pushMessage('You are too exhausted to swing.', 'warning', 'exhaust_swing');
        return;
      }
      player.stamina = Math.max(0, player.stamina - spec.staminaCost);
      soundEngine.playMeleeSwing(weaponKey === 'axe' || weaponKey === 'pipe');
    } else {
      // Firearm check ammo
      const held = inventory.heldWeaponItem;
      if (!held || (held.loadedAmmo || 0) <= 0) {
        soundEngine.playUiSound('empty');
        survival.pushMessage('Click. Chamber is empty (Press R to reload).', 'warning', 'empty_gun');
        this.cooldownTimer = 0.25;
        return;
      }
      held.loadedAmmo = (held.loadedAmmo || 1) - 1;
      soundEngine.playGunshot(weaponKey === 'sk59' ? '762' : '9x18');

      // Muzzle flash
      this.muzzleLight.position.set(player.position.x, player.position.y + 1.5, player.position.z);
      this.muzzleLight.intensity = 6.5;
      this.muzzleTimer = 0.06;
    }

    this.cooldownTimer = spec.cooldown;

    // Apply camera recoil
    const yawKick = 'recoilYaw' in spec ? spec.recoilYaw : 0.01;
    player.applyRecoil(spec.recoilPitch, yawKick);

    // Emit acoustic noise ring to alert nearby zombies
    player.currentNoiseRadius = Math.max(player.currentNoiseRadius, spec.noiseRadius);
    infected.notifySoundEmission(player.position.x, player.position.z, spec.noiseRadius);

    // Perform hit detection along camera aim ray
    _rayOrigin.copy(camera.position);
    camera.getWorldDirection(_rayDir);

    let closestAgent = null;
    let closestDist = spec.range + (player.isThirdPerson ? 3.5 : 0);

    for (let i = 0; i < infected.agents.length; i++) {
      const a = infected.agents[i];
      if (a.state === 'dead') continue;

      // Target zombie upper chest / head center
      _toZombie.set(a.x - _rayOrigin.x, a.y + 1.15 - _rayOrigin.y, a.z - _rayOrigin.z);
      const dist = _toZombie.length();
      if (dist > closestDist) continue;

      const proj = _toZombie.dot(_rayDir);
      if (proj < 0) continue;

      // Perpendicular distance from aim ray to zombie cylinder
      const perpSq = Math.max(0, _toZombie.lengthSq() - proj * proj);
      const hitRadius = spec.type === 'melee' ? 0.88 : 0.56;
      if (perpSq <= hitRadius * hitRadius) {
        closestDist = dist;
        closestAgent = a;
      }
    }

    if (closestAgent) {
      soundEngine.playHitImpact();
      // Headshot multiplier if aiming high
      const aimElev = _rayOrigin.y + _rayDir.y * closestDist - closestAgent.y;
      const isHeadshot = aimElev >= 1.42;
      const finalDamage = isHeadshot ? spec.damage * 1.85 : spec.damage;

      const killed = infected.damageAgent(
        closestAgent,
        finalDamage,
        player.position.x,
        player.position.z
      );
      if (killed) {
        survival.stats.infectedKilled += 1;
        // 35% chance for killed infected to drop a rag or canned food or ammo
        if (Math.random() < 0.38) {
          const drops = ['rag', 'canned_sprats', 'ammo_9x18', 'birch_bark'];
          const dropId = drops[Math.floor(Math.random() * drops.length)];
          inventory.spawnWorldLoot(dropId, closestAgent.x, closestAgent.y + 0.08, closestAgent.z, 'Worn', 1);
        }
      }
    }
  }

  public update(dt: number) {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleLight.intensity = 0;
      }
    }
  }
}
