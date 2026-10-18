import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BALANCE } from '../config/balance';
import { WORLD_BUILDINGS, createBuildingMesh } from './settlements';

const _skyDay = new THREE.Color(0x6b7b88);
const _skyDusk = new THREE.Color(0x524648);
const _skyNight = new THREE.Color(0x0b1017);
const _skyRain = new THREE.Color(0x414b54);
const _currentSky = new THREE.Color();

export interface ActiveCampfire {
  id: string;
  x: number;
  y: number;
  z: number;
  remainingSeconds: number;
  group: THREE.Group;
  light: THREE.PointLight;
}

export class WorldEnvironment {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  private waterMesh: THREE.Mesh;
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;

  public timeOfDay = BALANCE.WORLD.INITIAL_TIME_OF_DAY; // 0..1
  public isRaining = false;
  private weatherTimer = 22; // first weather check
  public campfires: ActiveCampfire[] = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;

    // 1. Studio PMREM Environment map for realistic PBR metals & wet surfaces
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    pmremGenerator.dispose();

    // 2. Horizon-matched Exponential Fog
    this.fog = new THREE.FogExp2(0x6b7b88, BALANCE.WORLD.FOG_BASE_DENSITY);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0x6b7b88);

    // 3. Balanced Outdoor Lighting Rig (Warm Sun Key + Cool Baltic Hemisphere Fill)
    this.hemiLight = new THREE.HemisphereLight(0x8fa3b5, 0x2b2822, 0.75);
    this.hemiLight.position.set(0, 120, 0);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe6c2, 1.35);
    this.sunLight.position.set(80, 110, 60);
    this.sunLight.castShadow = !renderer.capabilities.isWebGL2 ? false : true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 240;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // 4. Baltic Sea Water Plane (extends 3.6km x 3.6km to horizon)
    const waterGeo = new THREE.PlaneGeometry(3600, 3600, 36, 36);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1e303b,
      roughness: 0.22,
      metalness: 0.68,
      transparent: true,
      opacity: 0.92,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = BALANCE.WORLD.WATER_LEVEL;
    this.waterMesh.receiveShadow = true;
    scene.add(this.waterMesh);

    // 5. Populate all Settlement Buildings (Zalivsk, Krasno, Pribor, Object-44)
    const buildingsRoot = new THREE.Group();
    for (let i = 0; i < WORLD_BUILDINGS.length; i++) {
      buildingsRoot.add(createBuildingMesh(WORLD_BUILDINGS[i]));
    }
    scene.add(buildingsRoot);

    // 6. Rain Particle System (follows player)
    const rainCount = 1100;
    const rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 45;
      this.rainPositions[i * 3 + 1] = Math.random() * 24;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xa5b8c8,
      size: 0.14,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.rainPoints.frustumCulled = false;
    scene.add(this.rainPoints);
  }

  public spawnCampfire(x: number, y: number, z: number): ActiveCampfire {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Composite 6-part campfire: 4 crossed logs, stone ring, glowing ember core
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.92 });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff4500,
      emissiveIntensity: 2.2,
      roughness: 0.4,
    });

    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), logMat);
      log.rotation.z = Math.PI / 2.4;
      log.rotation.y = (i * Math.PI) / 2 + 0.3;
      log.position.y = 0.14;
      group.add(log);
    }

    const core = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 6), emberMat);
    core.position.y = 0.28;
    group.add(core);

    const light = new THREE.PointLight(0xff7b29, 4.5, 14, 1.8);
    light.position.set(0, 0.65, 0);
    group.add(light);

    this.scene.add(group);
    const fire: ActiveCampfire = {
      id: `fire_${Date.now()}`,
      x,
      y,
      z,
      remainingSeconds: 240,
      group,
      light,
    };
    this.campfires.push(fire);
    return fire;
  }

  public isNearActiveCampfire(px: number, pz: number): boolean {
    const rSq = BALANCE.SURVIVAL.CAMPFIRE_RADIUS * BALANCE.SURVIVAL.CAMPFIRE_RADIUS;
    for (let i = 0; i < this.campfires.length; i++) {
      const f = this.campfires[i];
      const dx = px - f.x;
      const dz = pz - f.z;
      if (dx * dx + dz * dz <= rSq) return true;
    }
    return false;
  }

  public toggleRain(): boolean {
    this.isRaining = !this.isRaining;
    return this.isRaining;
  }

  public update(dt: number, elapsed: number, playerPos: THREE.Vector3) {
    // Advance Day/Night cycle
    this.timeOfDay = (this.timeOfDay + dt / BALANCE.WORLD.DAY_LENGTH_SECONDS) % 1.0;

    // Weather roll timer
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = BALANCE.WORLD.WEATHER_CHECK_INTERVAL;
      this.isRaining = Math.random() < BALANCE.WORLD.RAIN_CHANCE;
    }

    // Sun elevation angle (-1 at midnight, +1 at noon)
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    const sunHoriz = Math.cos(sunAngle);

    // Follow player with directional light shadow frustum
    this.sunLight.target.position.set(playerPos.x, playerPos.y, playerPos.z);
    this.sunLight.position.set(
      playerPos.x + sunHoriz * 95,
      playerPos.y + Math.max(18, Math.abs(sunElev) * 115),
      playerPos.z + 45
    );

    // Compute sky color and light intensities smoothly
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.15) / 0.55, 0, 1);
    const duskFactor = THREE.MathUtils.clamp(1.0 - Math.abs(sunElev) * 3.2, 0, 1);

    _currentSky.copy(_skyNight).lerp(_skyDay, dayFactor);
    if (duskFactor > 0) {
      _currentSky.lerp(_skyDusk, duskFactor * 0.55);
    }
    if (this.isRaining) {
      _currentSky.lerp(_skyRain, 0.65);
    }

    this.fog.color.copy(_currentSky);
    (this.scene.background as THREE.Color).copy(_currentSky);

    const targetFog = this.isRaining
      ? BALANCE.WORLD.FOG_RAIN_DENSITY
      : dayFactor < 0.25
      ? BALANCE.WORLD.FOG_NIGHT_DENSITY
      : BALANCE.WORLD.FOG_BASE_DENSITY;
    this.fog.density = THREE.MathUtils.damp(this.fog.density, targetFog, 1.5, dt);

    const rainDim = this.isRaining ? 0.55 : 1.0;
    this.sunLight.intensity = (0.12 + dayFactor * 1.35) * rainDim;
    this.hemiLight.intensity = (0.18 + dayFactor * 0.65) * rainDim;
    this.scene.environmentIntensity = (0.12 + dayFactor * 0.42) * rainDim;

    // Gentle Baltic sea swell
    this.waterMesh.position.y = BALANCE.WORLD.WATER_LEVEL + Math.sin(elapsed * 1.4) * 0.12;

    // Update rain particles around player
    this.rainPoints.visible = this.isRaining;
    if (this.isRaining) {
      this.rainPoints.position.set(playerPos.x, playerPos.y, playerPos.z);
      const posAttr = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let ry = posAttr.getY(i) - dt * 21.0;
        let rx = posAttr.getX(i) - dt * 2.4; // coastal wind slant
        if (ry < -2.0) {
          ry = 22.0;
          rx = (Math.random() - 0.5) * 45;
        }
        posAttr.setX(i, rx);
        posAttr.setY(i, ry);
      }
      posAttr.needsUpdate = true;
    }

    // Update active campfires (flicker + burn lifetime)
    for (let i = this.campfires.length - 1; i >= 0; i--) {
      const f = this.campfires[i];
      f.remainingSeconds -= dt;
      f.light.intensity = 4.2 + Math.sin(elapsed * 17 + i) * 0.65;
      if (f.remainingSeconds <= 0) {
        this.scene.remove(f.group);
        this.campfires.splice(i, 1);
      }
    }
  }

  public isNight(): boolean {
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    return Math.sin(sunAngle) < 0.05;
  }

  public getFormattedTime(): string {
    const totalMinutes = Math.floor(this.timeOfDay * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
