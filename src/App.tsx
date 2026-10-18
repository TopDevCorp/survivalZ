import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { BALANCE } from './config/balance';
import { ChunkManager } from './world/chunkManager';
import { WorldEnvironment } from './world/environment';
import { PlayerController } from './player/playerController';
import { SurvivalSystem, SurvivalStats, SensoryMessage } from './survival/survivalSystem';
import {
  InventorySystem,
  ITEM_TEMPLATES,
  InventoryItem,
  WorldLootItem,
  ClothingSlotType,
} from './inventory/inventorySystem';
import { InfectedManager } from './ai/infectedManager';
import { CombatSystem } from './combat/combatSystem';
import { CraftingRecipe } from './crafting/recipes';
import { soundEngine } from './audio/soundEngine';
import { HudOverlay } from './ui/HudOverlay';
import { InventoryModal } from './ui/InventoryModal';
import { IslandMapModal } from './ui/IslandMapModal';
import { DeathScreen } from './ui/DeathScreen';

interface EngineRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  chunks: ChunkManager;
  environment: WorldEnvironment;
  player: PlayerController;
  survival: SurvivalSystem;
  inventory: InventorySystem;
  infected: InfectedManager;
  combat: CombatSystem;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EngineRefs | null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // React UI state synced at 10Hz from the 60Hz game loop so React never slows down WebGL
  const [hudStats, setHudStats] = useState<SurvivalStats>(() => new SurvivalSystem().createFreshStats());
  const [messages, setMessages] = useState<SensoryMessage[]>([]);
  const [nearbyLoot, setNearbyLoot] = useState<WorldLootItem[]>([]);
  const [heldWeapon, setHeldWeapon] = useState<InventoryItem | null>(null);
  const [equippedClothing, setEquippedClothing] = useState<Record<ClothingSlotType, InventoryItem | null>>({
    jacket: null,
    pants: null,
    backpack: null,
  });
  const [storedItems, setStoredItems] = useState<InventoryItem[]>([]);
  const [noiseRadius, setNoiseRadius] = useState(0);
  const [isThirdPerson, setIsThirdPerson] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);
  const [flareActive, setFlareActive] = useState(false);
  const [formattedTime, setFormattedTime] = useState('08:15');
  const [isRaining, setIsRaining] = useState(false);
  const [hasMapItem, setHasMapItem] = useState(false);
  const [playerCoords, setPlayerCoords] = useState<{
    x: number;
    z: number;
    yaw: number;
    settlementName: string | null;
  }>({ x: -460, z: 560, yaw: 0, settlementName: null });

  const syncUiSnapshot = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    const { player, survival, inventory, environment } = eng;
    survival.stats.stamina = player.stamina;
    setHudStats({ ...survival.stats });
    setMessages([...survival.messages]);
    setNearbyLoot([...inventory.getNearbyWorldLoot(player.position.x, player.position.z)]);
    setHeldWeapon(inventory.heldWeaponItem ? { ...inventory.heldWeaponItem } : null);
    setEquippedClothing({ ...inventory.equippedClothing });
    setStoredItems([...inventory.storedItems]);
    setNoiseRadius(player.currentNoiseRadius);
    setIsThirdPerson(player.isThirdPerson);
    setIsCrouching(player.isCrouching);
    setFlareActive(player.flareActive);
    setFormattedTime(environment.getFormattedTime());
    setIsRaining(environment.isRaining);
    setHasMapItem(inventory.hasItem('island_map', 1));

    // Check if inside a named settlement
    let currentSettlement: string | null = null;
    for (const s of BALANCE.SETTLEMENTS) {
      const dx = player.position.x - s.center[0];
      const dz = player.position.z - s.center[1];
      if (dx * dx + dz * dz <= s.radius * s.radius * 1.35) {
        currentSettlement = `${s.name} (${s.subtitle})`;
        break;
      }
    }

    setPlayerCoords({
      x: player.position.x,
      z: player.position.z,
      yaw: player.yaw,
      settlementName: currentSettlement,
    });

    const activeWeaponKey = eng.combat.getActiveWeaponKey(inventory);
    player.setHeldWeaponVisual(activeWeaponKey, Boolean(inventory.equippedClothing.backpack));
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(73, window.innerWidth / window.innerHeight, 0.12, 950);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const environment = new WorldEnvironment(scene, renderer);
    const chunks = new ChunkManager(scene);
    const player = new PlayerController(scene);
    const survival = new SurvivalSystem();
    const inventory = new InventorySystem(scene);
    const infected = new InfectedManager(scene);
    const combat = new CombatSystem(scene);

    survival.pushMessage('You wake up cold on the gravel shoreline of Zalivsk bay.', 'normal');

    chunks.update(player.position.x, player.position.z);
    renderer.compile(scene, camera);

    engineRef.current = {
      scene,
      camera,
      renderer,
      chunks,
      environment,
      player,
      survival,
      inventory,
      infected,
      combat,
    };

    syncUiSnapshot();

    const clock = new THREE.Clock();
    let uiSyncAccumulator = 0;
    let animFrameId = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (!survival.stats.isDead) {
        const moveContext = player.update(dt, keysRef.current, camera, survival.stats.hasFracture);
        chunks.update(player.position.x, player.position.z);
        environment.update(dt, elapsed, player.position);
        combat.update(dt);

        const nearFire =
          environment.isNearActiveCampfire(player.position.x, player.position.z) || player.flareActive;

        survival.update(dt, {
          isSprinting: player.isSprinting,
          isMoving: player.isMoving,
          isRaining: environment.isRaining,
          isNight: environment.isNight(),
          isIndoors: moveContext.isIndoors,
          nearCampfire: nearFire,
          inWater: moveContext.surface === 'water',
          clothingInsulation: inventory.getTotalInsulation(),
        });

        soundEngine.updateAmbience(environment.isRaining, moveContext.isIndoors, player.position.y);

        infected.update(
          dt,
          player.position,
          player.currentNoiseRadius,
          environment.isNight(),
          player.isCrouching,
          (dmg, causesBleed) => {
            survival.applyDamage(dmg, causesBleed, 'Mauled by Infected');
            if (Math.random() < BALANCE.AI.CLOTHING_DAMAGE_CHANCE) {
              const msg = inventory.degradeRandomClothing();
              if (msg) survival.pushMessage(msg, 'warning');
            }
          }
        );

        // Adjust exposure slightly based on blood loss
        const bloodRatio = Math.max(0.45, survival.stats.blood / BALANCE.SURVIVAL.MAX_BLOOD);
        renderer.toneMappingExposure = 0.72 + bloodRatio * 0.38;
      }

      renderer.render(scene, camera);

      uiSyncAccumulator += dt;
      if (uiSyncAccumulator >= 0.1) {
        uiSyncAccumulator = 0;
        syncUiSnapshot();
      }
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [syncUiSnapshot]);

  // Keyboard, Mouse & Pointer Lock Event Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;

      if (e.code === 'Tab') {
        e.preventDefault();
        setMapOpen(false);
        setInventoryOpen((prev) => {
          const next = !prev;
          if (next && document.pointerLockElement) {
            document.exitPointerLock();
          }
          return next;
        });
        syncUiSnapshot();
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        setInventoryOpen(false);
        setMapOpen((prev) => {
          const next = !prev;
          if (next && document.pointerLockElement) {
            document.exitPointerLock();
          }
          return next;
        });
        syncUiSnapshot();
        return;
      }

      if (inventoryOpen || mapOpen || eng.survival.stats.isDead) return;

      keysRef.current.add(e.code);

      if (e.code === 'KeyV') {
        const tp = eng.player.togglePerspective();
        eng.survival.pushMessage(tp ? 'Camera: Third-Person Perspective' : 'Camera: First-Person Perspective');
        syncUiSnapshot();
      } else if (e.code === 'KeyC') {
        eng.player.toggleCrouch();
        syncUiSnapshot();
      } else if (e.code === 'KeyL') {
        if (eng.inventory.hasItem('flare', 1)) {
          const on = eng.player.toggleFlare();
          eng.survival.pushMessage(
            on ? 'You strike the road flare. Crimson sparks hiss in the damp air.' : 'You douse the road flare.'
          );
          syncUiSnapshot();
        } else {
          eng.survival.pushMessage('You do not have a road flare in your inventory.', 'warning');
          syncUiSnapshot();
        }
      } else if (e.code === 'KeyF') {
        const nearby = eng.inventory.getNearbyWorldLoot(eng.player.position.x, eng.player.position.z);
        if (nearby.length > 0) {
          const res = eng.inventory.pickupWorldLoot(nearby[0].uid);
          if (res.ok) soundEngine.playUiSound('pickup');
          if (res.message) eng.survival.pushMessage(res.message, res.ok ? 'normal' : 'warning');
          syncUiSnapshot();
        }
      } else if (e.code === 'KeyG') {
        // Forage sticks & birch bark from forest floor
        const addedSticks = eng.inventory.addItemToStorage('wooden_sticks', 'Worn', 1);
        const addedBark = eng.inventory.addItemToStorage('birch_bark', 'Worn', 1);
        if (addedSticks || addedBark) {
          soundEngine.playUiSound('pickup');
          eng.survival.pushMessage('You gather dry pine branches and birch bark tinder from the ground.');
        } else {
          eng.survival.pushMessage('Your clothing pockets are full.', 'warning');
        }
        syncUiSnapshot();
      } else if (e.code === 'KeyR') {
        const res = eng.inventory.reloadHeldFirearm();
        if (res.reloaded > 0) soundEngine.playUiSound('craft');
        eng.survival.pushMessage(res.message, res.reloaded > 0 ? 'normal' : 'warning');
        syncUiSnapshot();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
      const eng = engineRef.current;
      if (!eng || inventoryOpen || mapOpen || eng.survival.stats.isDead) return;
      if (document.pointerLockElement === eng.renderer.domElement || e.buttons === 1) {
        eng.player.onMouseMove(e.movementX, e.movementY);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const eng = engineRef.current;
      if (!eng || inventoryOpen || mapOpen || eng.survival.stats.isDead) return;
      if (e.target !== eng.renderer.domElement) return;

      if (document.pointerLockElement !== eng.renderer.domElement) {
        eng.renderer.domElement.requestPointerLock?.();
      } else if (e.button === 0) {
        eng.combat.triggerPrimaryAttack(
          eng.camera,
          eng.player,
          eng.inventory,
          eng.infected,
          eng.survival
        );
        syncUiSnapshot();
      }
    };

    const onPointerLockChange = () => {
      const eng = engineRef.current;
      setIsPointerLocked(Boolean(eng && document.pointerLockElement === eng.renderer.domElement));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [inventoryOpen, mapOpen, syncUiSnapshot]);

  // Inventory & Crafting Action Handlers
  const handleUseItem = (item: InventoryItem) => {
    const eng = engineRef.current;
    if (!eng) return;
    const tmpl = ITEM_TEMPLATES[item.templateId];

    if (item.templateId === 'rag' || item.templateId === 'bandage_medical') {
      if (eng.survival.useBandageOrRag(tmpl.name)) {
        soundEngine.playUiSound('bandage');
        eng.inventory.consumeIngredients([{ itemId: item.templateId, count: 1 }]);
      }
    } else if (item.templateId === 'saline_bag') {
      if (eng.survival.useSalineBag()) {
        soundEngine.playUiSound('bandage');
        eng.inventory.consumeIngredients([{ itemId: 'saline_bag', count: 1 }]);
      }
    } else if (item.templateId === 'splint') {
      if (eng.survival.useSplint()) {
        soundEngine.playUiSound('bandage');
        eng.inventory.consumeIngredients([{ itemId: 'splint', count: 1 }]);
      }
    } else if (tmpl.category === 'food' || tmpl.category === 'drink') {
      eng.survival.consumeNutrition(
        tmpl.foodGain || 0,
        tmpl.waterGain || 0,
        tmpl.healthGain || 0,
        tmpl.tempGain || 0,
        tmpl.name
      );
      soundEngine.playUiSound('pickup');
      eng.inventory.consumeIngredients([{ itemId: item.templateId, count: 1 }]);
    } else if (item.templateId === 'flare') {
      const on = eng.player.toggleFlare();
      eng.survival.pushMessage(on ? 'You ignite the emergency road flare.' : 'You extinguish the flare.');
    } else if (item.templateId === 'campfire_kit') {
      const forwardX = -Math.sin(eng.player.yaw) * 2.2;
      const forwardZ = -Math.cos(eng.player.yaw) * 2.2;
      eng.environment.spawnCampfire(
        eng.player.position.x + forwardX,
        eng.player.position.y,
        eng.player.position.z + forwardZ
      );
      eng.inventory.consumeIngredients([{ itemId: 'campfire_kit', count: 1 }]);
      soundEngine.playUiSound('craft');
      eng.survival.pushMessage('You stack the pine branches and ignite a crackling campfire.');
    } else if (item.templateId === 'island_map') {
      setInventoryOpen(false);
      setMapOpen(true);
    }

    syncUiSnapshot();
  };

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    const eng = engineRef.current;
    if (!eng) return;

    if (recipe.requiresCampfire && !eng.environment.isNearActiveCampfire(eng.player.position.x, eng.player.position.z)) {
      eng.survival.pushMessage('You must stand near an active campfire to cook meat.', 'warning');
      syncUiSnapshot();
      return;
    }

    if (!eng.inventory.consumeIngredients(recipe.ingredients)) {
      eng.survival.pushMessage('Missing required crafting materials.', 'warning');
      syncUiSnapshot();
      return;
    }

    soundEngine.playUiSound('craft');

    if (recipe.placesCampfireInWorld) {
      const forwardX = -Math.sin(eng.player.yaw) * 2.2;
      const forwardZ = -Math.cos(eng.player.yaw) * 2.2;
      eng.environment.spawnCampfire(
        eng.player.position.x + forwardX,
        eng.player.position.y,
        eng.player.position.z + forwardZ
      );
      eng.survival.pushMessage('You build and ignite a roaring campfire in front of you.');
    } else {
      eng.inventory.addItemToStorage(recipe.outputItemId, 'Pristine', recipe.outputCount);
      eng.survival.pushMessage(
        `Crafted ${recipe.outputCount}× ${ITEM_TEMPLATES[recipe.outputItemId].name}.`
      );
    }

    syncUiSnapshot();
  };

  const handleRespawn = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.player.respawnOnBeach();
    eng.survival.resetForRespawn();
    eng.inventory.resetStarterLoadout();
    eng.infected.spawnInitialPopulation();
    setInventoryOpen(false);
    setMapOpen(false);
    syncUiSnapshot();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0e11]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* Gritty HUD Overlay */}
      <HudOverlay
        stats={hudStats}
        messages={messages}
        heldWeapon={heldWeapon}
        nearbyLoot={nearbyLoot}
        noiseRadius={noiseRadius}
        isThirdPerson={isThirdPerson}
        isCrouching={isCrouching}
        flareActive={flareActive}
        isPointerLocked={isPointerLocked}
        formattedTime={formattedTime}
        isRaining={isRaining}
        hasMapItem={hasMapItem}
        playerCoords={playerCoords}
        onRequestPointerLock={() => {
          engineRef.current?.renderer.domElement.requestPointerLock?.();
        }}
        onOpenInventory={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setMapOpen(false);
          setInventoryOpen(true);
          syncUiSnapshot();
        }}
        onOpenMap={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setInventoryOpen(false);
          setMapOpen(true);
          syncUiSnapshot();
        }}
        onTogglePerspective={() => {
          engineRef.current?.player.togglePerspective();
          syncUiSnapshot();
        }}
        onToggleRain={() => {
          const eng = engineRef.current;
          if (!eng) return;
          const rain = eng.environment.toggleRain();
          eng.survival.pushMessage(
            rain ? 'A cold Baltic rain squall sweeps across the coast.' : 'The rain squall subsides.'
          );
          syncUiSnapshot();
        }}
        onToggleFlare={() => {
          const eng = engineRef.current;
          if (!eng) return;
          const on = eng.player.toggleFlare();
          eng.survival.pushMessage(
            on ? 'You ignite your road flare.' : 'You extinguish your road flare.'
          );
          syncUiSnapshot();
        }}
        onPickupNearest={() => {
          const eng = engineRef.current;
          if (!eng || nearbyLoot.length === 0) return;
          const res = eng.inventory.pickupWorldLoot(nearbyLoot[0].uid);
          if (res.ok) soundEngine.playUiSound('pickup');
          if (res.message) eng.survival.pushMessage(res.message);
          syncUiSnapshot();
        }}
        onGatherForestMaterial={() => {
          const eng = engineRef.current;
          if (!eng) return;
          eng.inventory.addItemToStorage('wooden_sticks', 'Worn', 1);
          eng.inventory.addItemToStorage('birch_bark', 'Worn', 1);
          soundEngine.playUiSound('pickup');
          eng.survival.pushMessage('Foraged dry pine sticks and birch bark tinder.');
          syncUiSnapshot();
        }}
      />

      {/* Tetris Grid Inventory & Crafting Drawer [Tab] */}
      {inventoryOpen && !hudStats.isDead && (
        <InventoryModal
          equippedClothing={equippedClothing}
          heldWeapon={heldWeapon}
          storedItems={storedItems}
          nearbyLoot={nearbyLoot}
          nearCampfire={hudStats.nearCampfire}
          onClose={() => setInventoryOpen(false)}
          onPickupLoot={(uid) => {
            const eng = engineRef.current;
            if (!eng) return;
            const res = eng.inventory.pickupWorldLoot(uid);
            if (res.ok) soundEngine.playUiSound('pickup');
            if (res.message) eng.survival.pushMessage(res.message, res.ok ? 'normal' : 'warning');
            syncUiSnapshot();
          }}
          onMoveItemInGrid={(uid, targetContainer, gx, gy) => {
            const eng = engineRef.current;
            if (!eng) return;
            eng.inventory.moveItemInGrid(uid, targetContainer, gx, gy);
            syncUiSnapshot();
          }}
          onUseItem={handleUseItem}
          onDropItem={(uid) => {
            const eng = engineRef.current;
            if (!eng) return;
            eng.inventory.dropStoredItem(
              uid,
              eng.player.position.x,
              eng.player.position.y,
              eng.player.position.z
            );
            syncUiSnapshot();
          }}
          onEquipWeaponFromStorage={(item) => {
            const eng = engineRef.current;
            if (!eng) return;
            const prevHeld = eng.inventory.heldWeaponItem;
            eng.inventory.storedItems = eng.inventory.storedItems.filter((i) => i.uid !== item.uid);
            eng.inventory.heldWeaponItem = item;
            if (prevHeld) {
              eng.inventory.addItemToStorage(
                prevHeld.templateId,
                prevHeld.condition,
                prevHeld.quantity,
                prevHeld.loadedAmmo
              );
            }
            soundEngine.playUiSound('pickup');
            syncUiSnapshot();
          }}
          onUnequipWeaponToStorage={() => {
            const eng = engineRef.current;
            if (!eng || !eng.inventory.heldWeaponItem) return;
            const held = eng.inventory.heldWeaponItem;
            if (
              eng.inventory.addItemToStorage(
                held.templateId,
                held.condition,
                held.quantity,
                held.loadedAmmo
              )
            ) {
              eng.inventory.heldWeaponItem = null;
            }
            syncUiSnapshot();
          }}
          onCraftRecipe={handleCraftRecipe}
        />
      )}

      {/* Lootable Topographic Island Map [M] */}
      {mapOpen && !hudStats.isDead && (
        <IslandMapModal
          hasMapItem={hasMapItem}
          playerX={playerCoords.x}
          playerZ={playerCoords.z}
          playerYaw={playerCoords.yaw}
          onClose={() => setMapOpen(false)}
          onGrantMapForTesting={() => {
            const eng = engineRef.current;
            if (!eng) return;
            eng.inventory.addItemToStorage('island_map', 'Pristine', 1);
            eng.survival.pushMessage('Added Coastal Topographic Map to your jacket.');
            syncUiSnapshot();
          }}
        />
      )}

      {/* Permadeath Summary Screen */}
      {hudStats.isDead && (
        <DeathScreen
          survivedSeconds={hudStats.survivedSeconds}
          infectedKilled={hudStats.infectedKilled}
          causeOfDeath={hudStats.causeOfDeath}
          onRespawn={handleRespawn}
        />
      )}
    </div>
  );
}
