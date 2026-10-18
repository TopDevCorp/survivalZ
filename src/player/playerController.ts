import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { getRandomBeachSpawn, getSurfaceType, getTerrainHeight } from '../world/heightmap';
import { isPlayerIndoors, resolveBuildingCollisions } from '../world/settlements';
import { soundEngine } from '../audio/soundEngine';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export class PlayerController {
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public yaw = 0;
  public pitch = 0;
  public freeLookYawOffset = 0;
  public freeLookPitchOffset = 0;

  public isThirdPerson = false;
  public isCrouching = false;
  public isSprinting = false;
  public isMoving = false;
  public isFreeLooking = false;
  public isGrounded = true;
  public stamina = BALANCE.PLAYER.STAMINA_MAX;
  public currentNoiseRadius = 0;
  public flareActive = false;

  private currentEyeHeight = BALANCE.PLAYER.EYE_HEIGHT_STAND;
  private currentThirdPersonBlend = 0; // 0 = 1st person, 1 = 3rd person
  private footstepTimer = 0;
  private walkCycle = 0;

  // Composite 9-part 3D character mesh for 3rd-person view
  public characterGroup: THREE.Group;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private backpackMesh: THREE.Mesh;
  private weaponPropGroup: THREE.Group;
  private flareLight: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    this.characterGroup = this.buildCompositeSurvivorMesh();
    this.leftArm = this.characterGroup.getObjectByName('leftArm') as THREE.Mesh;
    this.rightArm = this.characterGroup.getObjectByName('rightArm') as THREE.Mesh;
    this.leftLeg = this.characterGroup.getObjectByName('leftLeg') as THREE.Mesh;
    this.rightLeg = this.characterGroup.getObjectByName('rightLeg') as THREE.Mesh;
    this.backpackMesh = this.characterGroup.getObjectByName('backpack') as THREE.Mesh;
    this.weaponPropGroup = this.characterGroup.getObjectByName('weaponProp') as THREE.Group;

    this.flareLight = new THREE.PointLight(0xff3b1f, 0, 18, 1.7);
    this.flareLight.position.set(0.35, 1.25, -0.35);
    this.characterGroup.add(this.flareLight);

    scene.add(this.characterGroup);
    this.respawnOnBeach();
  }

  private buildCompositeSurvivorMesh(): THREE.Group {
    const group = new THREE.Group();

    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2f3b37, roughness: 0.85, metalness: 0.08 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.88, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8a992, roughness: 0.65, metalness: 0.02 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.92, metalness: 0.02 });
    const packMat = new THREE.MeshStandardMaterial({ color: 0x4a3f31, roughness: 0.82, metalness: 0.12 });

    // 1. Torso Jacket
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.66, 0.26), jacketMat);
    torso.position.y = 1.12;
    torso.castShadow = true;
    group.add(torso);

    // 2. Head & 3. Knit Beanie Cap
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skinMat);
    head.position.y = 1.61;
    head.castShadow = true;
    group.add(head);

    const beanie = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.14, 8), capMat);
    beanie.position.y = 1.74;
    group.add(beanie);

    // 4. Canvas Backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.2), packMat);
    pack.name = 'backpack';
    pack.position.set(0, 1.15, 0.22);
    pack.castShadow = true;
    group.add(pack);

    // 5 & 6. Arms (pivoted at shoulder)
    const armGeo = new THREE.BoxGeometry(0.14, 0.58, 0.14);
    armGeo.translate(0, -0.24, 0);
    const leftArm = new THREE.Mesh(armGeo, jacketMat);
    leftArm.name = 'leftArm';
    leftArm.position.set(-0.31, 1.38, 0);
    leftArm.castShadow = true;

    const rightArm = new THREE.Mesh(armGeo, jacketMat);
    rightArm.name = 'rightArm';
    rightArm.position.set(0.31, 1.38, 0);
    rightArm.castShadow = true;

    const weaponProp = new THREE.Group();
    weaponProp.name = 'weaponProp';
    weaponProp.position.set(0, -0.48, -0.15);
    rightArm.add(weaponProp);

    group.add(leftArm, rightArm);

    // 7 & 8. Legs (pivoted at hip)
    const legGeo = new THREE.BoxGeometry(0.17, 0.76, 0.18);
    legGeo.translate(0, -0.38, 0);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.name = 'leftLeg';
    leftLeg.position.set(-0.13, 0.78, 0);
    leftLeg.castShadow = true;

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.name = 'rightLeg';
    rightLeg.position.set(0.13, 0.78, 0);
    rightLeg.castShadow = true;

    group.add(leftLeg, rightLeg);
    return group;
  }

  public setHeldWeaponVisual(weaponId: string, hasBackpack: boolean) {
    this.backpackMesh.visible = hasBackpack;
    while (this.weaponPropGroup.children.length > 0) {
      this.weaponPropGroup.remove(this.weaponPropGroup.children[0]);
    }

    if (weaponId === 'axe') {
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.025, 0.65, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.8 })
      );
      handle.rotation.x = Math.PI / 2;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.18, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.75 })
      );
      blade.position.set(0, 0.06, -0.26);
      this.weaponPropGroup.add(handle, blade);
    } else if (weaponId === 'pipe') {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.58, 8),
        new THREE.MeshStandardMaterial({ color: 0x646b73, roughness: 0.45, metalness: 0.85 })
      );
      pipe.rotation.x = Math.PI / 2;
      this.weaponPropGroup.add(pipe);
    } else if (weaponId === 'ij70') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.1, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.35, metalness: 0.85 })
      );
      this.weaponPropGroup.add(body);
    } else if (weaponId === 'sk59') {
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.11, 0.78),
        new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.75 })
      );
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6),
        new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.3, metalness: 0.9 })
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.35);
      this.weaponPropGroup.add(stock, barrel);
    }
  }

  public respawnOnBeach() {
    const spawn = getRandomBeachSpawn();
    this.position.set(spawn.x, spawn.y, spawn.z);
    this.velocity.set(0, 0, 0);
    this.yaw = spawn.yaw;
    this.pitch = -0.04;
    this.freeLookYawOffset = 0;
    this.freeLookPitchOffset = 0;
    this.stamina = BALANCE.PLAYER.STAMINA_MAX;
    this.isCrouching = false;
    this.flareActive = false;
    this.flareLight.intensity = 0;
  }

  public togglePerspective(): boolean {
    this.isThirdPerson = !this.isThirdPerson;
    return this.isThirdPerson;
  }

  public toggleCrouch(): boolean {
    this.isCrouching = !this.isCrouching;
    return this.isCrouching;
  }

  public toggleFlare(): boolean {
    this.flareActive = !this.flareActive;
    this.flareLight.intensity = this.flareActive ? 3.8 : 0;
    return this.flareActive;
  }

  public applyRecoil(pitchKick: number, yawKick: number) {
    this.pitch = Math.min(Math.PI * 0.47, this.pitch + pitchKick);
    this.yaw += (Math.random() - 0.5) * 2 * yawKick;
  }

  public onMouseMove(movementX: number, movementY: number) {
    const sens = BALANCE.PLAYER.MOUSE_SENSITIVITY;
    if (this.isFreeLooking) {
      this.freeLookYawOffset = THREE.MathUtils.clamp(
        this.freeLookYawOffset - movementX * sens,
        -Math.PI * 0.65,
        Math.PI * 0.65
      );
      this.freeLookPitchOffset = THREE.MathUtils.clamp(
        this.freeLookPitchOffset - movementY * sens,
        -Math.PI * 0.4,
        Math.PI * 0.4
      );
    } else {
      this.yaw -= movementX * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - movementY * sens, -Math.PI * 0.46, Math.PI * 0.46);
    }
  }

  public update(
    dt: number,
    keys: Set<string>,
    camera: THREE.PerspectiveCamera,
    hasFracture: boolean
  ): { surface: 'sand' | 'grass' | 'road' | 'indoor' | 'water'; isIndoors: boolean } {
    this.isFreeLooking = keys.has('AltLeft') || keys.has('AltRight');
    if (!this.isFreeLooking) {
      this.freeLookYawOffset = THREE.MathUtils.damp(this.freeLookYawOffset, 0, 14, dt);
      this.freeLookPitchOffset = THREE.MathUtils.damp(this.freeLookPitchOffset, 0, 14, dt);
    }

    // Forward/Right vectors in XZ plane
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    _moveDir.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) _moveDir.add(_forward);
    if (keys.has('KeyS') || keys.has('ArrowDown')) _moveDir.sub(_forward);
    if (keys.has('KeyD') || keys.has('ArrowRight')) _moveDir.add(_right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) _moveDir.sub(_right);

    this.isMoving = _moveDir.lengthSq() > 0.001;
    if (this.isMoving) {
      _moveDir.normalize();
    }

    const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && this.isMoving && !this.isCrouching && !hasFracture;
    if (wantsSprint && this.stamina > 1.0) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - BALANCE.PLAYER.STAMINA_SPRINT_DRAIN * dt);
    } else {
      this.isSprinting = false;
      const regenRate = this.isMoving ? BALANCE.PLAYER.STAMINA_REGEN_WALK : BALANCE.PLAYER.STAMINA_REGEN_IDLE;
      this.stamina = Math.min(BALANCE.PLAYER.STAMINA_MAX, this.stamina + regenRate * dt);
    }

    let speed = this.isCrouching
      ? BALANCE.PLAYER.CROUCH_SPEED
      : this.isSprinting
      ? BALANCE.PLAYER.SPRINT_SPEED
      : BALANCE.PLAYER.WALK_SPEED;

    if (hasFracture) {
      speed *= BALANCE.PLAYER.LIMP_SPEED_MULTIPLIER;
    }

    // Jump
    if (keys.has('Space') && this.isGrounded && this.stamina >= BALANCE.PLAYER.STAMINA_JUMP_COST && !this.isCrouching) {
      this.velocity.y = BALANCE.PLAYER.JUMP_VELOCITY;
      this.isGrounded = false;
      this.stamina -= BALANCE.PLAYER.STAMINA_JUMP_COST;
      this.currentNoiseRadius = Math.max(this.currentNoiseRadius, BALANCE.PLAYER.NOISE_JUMP);
    }

    // Horizontal motion + Wall AABB resolution
    const nextX = THREE.MathUtils.clamp(
      this.position.x + _moveDir.x * speed * dt,
      -BALANCE.WORLD.HALF_SIZE + 15,
      BALANCE.WORLD.HALF_SIZE - 15
    );
    const nextZ = THREE.MathUtils.clamp(
      this.position.z + _moveDir.z * speed * dt,
      -BALANCE.WORLD.HALF_SIZE + 15,
      BALANCE.WORLD.HALF_SIZE - 15
    );

    const resolved = resolveBuildingCollisions(this.position.x, this.position.z, nextX, nextZ, this.position.y);
    this.position.x = resolved.x;
    this.position.z = resolved.z;

    // Gravity & Ground snapping
    const groundY = Math.max(BALANCE.WORLD.WATER_LEVEL - 0.65, getTerrainHeight(this.position.x, this.position.z));
    const indoors = isPlayerIndoors(this.position.x, this.position.y, this.position.z);
    const floorTargetY = indoors ? groundY + 0.18 : groundY;

    this.velocity.y -= BALANCE.PLAYER.GRAVITY * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.y <= floorTargetY) {
      this.position.y = floorTargetY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Determine surface and footstep acoustics
    const rawSurface = getSurfaceType(this.position.x, this.position.z);
    const surface: 'sand' | 'grass' | 'road' | 'indoor' | 'water' = indoors
      ? 'indoor'
      : rawSurface === 'rock'
      ? 'road'
      : rawSurface;

    if (this.isMoving && this.isGrounded) {
      const targetNoise = this.isCrouching
        ? BALANCE.PLAYER.NOISE_CROUCH
        : this.isSprinting
        ? BALANCE.PLAYER.NOISE_SPRINT
        : BALANCE.PLAYER.NOISE_WALK;
      this.currentNoiseRadius = THREE.MathUtils.damp(this.currentNoiseRadius, targetNoise, 8, dt);

      const stepInterval = this.isCrouching
        ? BALANCE.PLAYER.FOOTSTEP_INTERVAL_CROUCH
        : this.isSprinting
        ? BALANCE.PLAYER.FOOTSTEP_INTERVAL_SPRINT
        : BALANCE.PLAYER.FOOTSTEP_INTERVAL_WALK;

      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = stepInterval;
        soundEngine.playFootstep(
          surface,
          this.isCrouching ? 'crouch' : this.isSprinting ? 'sprint' : 'walk'
        );
      }
      this.walkCycle += dt * (this.isSprinting ? 11 : this.isCrouching ? 4.5 : 7);
    } else {
      this.currentNoiseRadius = THREE.MathUtils.damp(this.currentNoiseRadius, 0.5, 6, dt);
      this.footstepTimer = 0.05;
    }

    // Update 3D character pose & visibility
    const targetEye = this.isCrouching ? BALANCE.PLAYER.EYE_HEIGHT_CROUCH : BALANCE.PLAYER.EYE_HEIGHT_STAND;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 10, dt);

    const targetBlend = this.isThirdPerson ? 1.0 : 0.0;
    this.currentThirdPersonBlend = THREE.MathUtils.damp(
      this.currentThirdPersonBlend,
      targetBlend,
      BALANCE.PLAYER.CAMERA_DAMPING,
      dt
    );

    this.characterGroup.visible = this.currentThirdPersonBlend > 0.08;
    this.characterGroup.position.copy(this.position);
    this.characterGroup.rotation.y = this.yaw;
    this.characterGroup.scale.y = this.isCrouching ? 0.68 : 1.0;

    // Limb swing animation
    const swingAmp = this.isMoving ? (this.isSprinting ? 0.65 : 0.38) : 0.02;
    this.leftLeg.rotation.x = Math.sin(this.walkCycle) * swingAmp;
    this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * swingAmp;
    this.leftArm.rotation.x = -Math.sin(this.walkCycle) * swingAmp * 0.7;
    this.rightArm.rotation.x = 0.35 + Math.sin(this.walkCycle) * swingAmp * 0.3;

    // Camera choreography (1st person eye vs 3rd person over-shoulder with smooth damping)
    const lookYaw = this.yaw + this.freeLookYawOffset;
    const lookPitch = THREE.MathUtils.clamp(
      this.pitch + this.freeLookPitchOffset,
      -Math.PI * 0.46,
      Math.PI * 0.46
    );

    const headBob = this.isMoving && this.isGrounded ? Math.sin(this.walkCycle * 2) * (this.isSprinting ? 0.045 : 0.022) : 0;
    const eyeX = this.position.x;
    const eyeY = this.position.y + this.currentEyeHeight + headBob;
    const eyeZ = this.position.z;

    // View direction vector
    const dirX = -Math.sin(lookYaw) * Math.cos(lookPitch);
    const dirY = Math.sin(lookPitch);
    const dirZ = -Math.cos(lookYaw) * Math.cos(lookPitch);

    const rightX = Math.cos(lookYaw);
    const rightZ = -Math.sin(lookYaw);

    const tpDist = BALANCE.PLAYER.THIRD_PERSON_DISTANCE * this.currentThirdPersonBlend;
    const tpRight = BALANCE.PLAYER.THIRD_PERSON_RIGHT_OFFSET * this.currentThirdPersonBlend;
    const tpUp = BALANCE.PLAYER.THIRD_PERSON_HEIGHT * this.currentThirdPersonBlend;

    _camTargetPos.set(
      eyeX - dirX * tpDist + rightX * tpRight,
      Math.max(groundY + 0.35, eyeY - dirY * tpDist + tpUp),
      eyeZ - dirZ * tpDist + rightZ * tpRight
    );

    camera.position.copy(_camTargetPos);
    _lookTarget.set(
      eyeX + dirX * 20 + rightX * tpRight * 0.35,
      eyeY + dirY * 20,
      eyeZ + dirZ * 20 + rightZ * tpRight * 0.35
    );
    camera.lookAt(_lookTarget);

    // Subtle FOV widening on sprint
    const targetFov = this.isSprinting ? 79 : 73;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
      camera.updateProjectionMatrix();
    }

    return { surface, isIndoors: indoors };
  }
}
