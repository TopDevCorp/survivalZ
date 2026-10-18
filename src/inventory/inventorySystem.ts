import * as THREE from 'three';
import { WORLD_BUILDINGS, BuildingCategory } from '../world/settlements';
import { getTerrainHeight, hash2D } from '../world/heightmap';

export type ItemCondition = 'Pristine' | 'Worn' | 'Damaged' | 'Ruined';

export type ItemCategory =
  | 'food'
  | 'drink'
  | 'medical'
  | 'melee'
  | 'firearm'
  | 'magazine'
  | 'ammo'
  | 'clothing'
  | 'utility'
  | 'material';

export type ClothingSlotType = 'jacket' | 'pants' | 'backpack';

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  width: number; // Tetris grid columns
  height: number; // Tetris grid rows
  colorHex: number;
  maxStack: number;
  // Optional stats
  foodGain?: number;
  waterGain?: number;
  healthGain?: number;
  tempGain?: number;
  weaponKey?: 'fists' | 'pipe' | 'axe' | 'ij70' | 'sk59';
  clothingSlot?: ClothingSlotType;
  storageGrid?: [number, number]; // [cols, rows] added when worn
  insulation?: number; // 0..0.45
}

export const ITEM_TEMPLATES: Record<string, ItemTemplate> = {
  flare: {
    id: 'flare',
    name: 'Road Emergency Flare',
    description: 'Phosphorus coastal signal flare. Emits crimson light and mild warmth when ignited (L key).',
    category: 'utility',
    width: 1,
    height: 2,
    colorHex: 0xdc2626,
    maxStack: 1,
  },
  rag: {
    id: 'rag',
    name: 'Torn Cloth Rag',
    description: 'Improvised cotton strip. Can bind a bleeding laceration or craft a splint.',
    category: 'medical',
    width: 1,
    height: 1,
    colorHex: 0xd6d3d1,
    maxStack: 4,
  },
  bandage_medical: {
    id: 'bandage_medical',
    name: 'Sterile Field Dressing',
    description: 'Sealed Soviet military gauze bandage. Immediately stops bleeding from a cut.',
    category: 'medical',
    width: 1,
    height: 2,
    colorHex: 0xfef3c7,
    maxStack: 2,
  },
  saline_bag: {
    id: 'saline_bag',
    name: 'IV Saline Infusion Kit',
    description: '0.9% Sodium Chloride IV bag with catheter. Restores 1,200ml of lost blood volume.',
    category: 'medical',
    width: 2,
    height: 2,
    colorHex: 0x38bdf8,
    maxStack: 1,
  },
  splint: {
    id: 'splint',
    name: 'Improvised Wooden Splint',
    description: 'Braces fractured or sprained limbs.',
    category: 'medical',
    width: 1,
    height: 3,
    colorHex: 0x854d0e,
    maxStack: 1,
  },
  canned_sprats: {
    id: 'canned_sprats',
    name: 'Baltic Smoked Sprats (Tin)',
    description: 'Oily smoked fish preserved in tin. Restores +38 Hunger and +8 Thirst.',
    category: 'food',
    width: 1,
    height: 1,
    colorHex: 0xd97706,
    maxStack: 1,
    foodGain: 38,
    waterGain: 8,
    healthGain: 4,
    tempGain: 0,
  },
  canned_peaches: {
    id: 'canned_peaches',
    name: 'Canned Compote Peaches',
    description: 'Heavy syrup fruit tin. Restores +32 Hunger and +28 Thirst.',
    category: 'food',
    width: 1,
    height: 2,
    colorHex: 0xf59e0b,
    maxStack: 1,
    foodGain: 32,
    waterGain: 28,
    healthGain: 5,
    tempGain: 0,
  },
  kvass_bottle: {
    id: 'kvass_bottle',
    name: 'Fermented Rye Kvass (1L)',
    description: 'Dark glass bottle of slightly sweet rye beverage. Restores +52 Thirst and +10 Hunger.',
    category: 'drink',
    width: 1,
    height: 2,
    colorHex: 0x0284c7,
    maxStack: 1,
    foodGain: 10,
    waterGain: 52,
    healthGain: 2,
    tempGain: 0,
  },
  water_canteen: {
    id: 'water_canteen',
    name: 'Aluminum Military Canteen',
    description: 'Surplus army canteen filled with clean fresh water. Restores +65 Thirst.',
    category: 'drink',
    width: 2,
    height: 2,
    colorHex: 0x4b5563,
    maxStack: 1,
    foodGain: 0,
    waterGain: 65,
    healthGain: 0,
    tempGain: 0,
  },
  meat_raw: {
    id: 'meat_raw',
    name: 'Raw Venison Cut',
    description: 'Uncooked game meat. Roast over an active campfire before eating.',
    category: 'food',
    width: 2,
    height: 1,
    colorHex: 0x991b1b,
    maxStack: 1,
    foodGain: 18,
    waterGain: 4,
    healthGain: -8,
    tempGain: 0,
  },
  meat_cooked: {
    id: 'meat_cooked',
    name: 'Charred Venison Steak',
    description: 'Hot, smoky roasted venison. Restores +65 Hunger, +15 Health, and warms core temperature.',
    category: 'food',
    width: 2,
    height: 1,
    colorHex: 0x78350f,
    maxStack: 1,
    foodGain: 65,
    waterGain: 10,
    healthGain: 15,
    tempGain: 0.65,
  },
  wooden_sticks: {
    id: 'wooden_sticks',
    name: 'Dry Pine Branches',
    description: 'Bundle of dry deadwood sticks gathered from the forest floor. Used for campfires and splints.',
    category: 'material',
    width: 2,
    height: 1,
    colorHex: 0x713f12,
    maxStack: 3,
  },
  birch_bark: {
    id: 'birch_bark',
    name: 'Papery Birch Bark Tinder',
    description: 'Resinous dry bark that catches a spark even in damp coastal wind.',
    category: 'material',
    width: 1,
    height: 1,
    colorHex: 0xe7e5e4,
    maxStack: 3,
  },
  campfire_kit: {
    id: 'campfire_kit',
    name: 'Prepared Campfire Bundle',
    description: 'Use from inventory to place and ignite a roaring campfire at your feet.',
    category: 'utility',
    width: 2,
    height: 2,
    colorHex: 0xea580c,
    maxStack: 1,
  },
  island_map: {
    id: 'island_map',
    name: 'Coastal Topographic Map',
    description: 'Classified 1:25,000 survey chart of the island. Unlocks the full topographic map overlay (M key).',
    category: 'utility',
    width: 1,
    height: 2,
    colorHex: 0x10b981,
    maxStack: 1,
  },
  pipe: {
    id: 'pipe',
    name: 'Lead Plumbing Pipe',
    description: 'Heavy threaded iron water pipe. Blunt melee weapon with solid knockdown impact.',
    category: 'melee',
    width: 1,
    height: 3,
    colorHex: 0x64748b,
    maxStack: 1,
    weaponKey: 'pipe',
  },
  axe: {
    id: 'axe',
    name: 'Firefighter Splitting Axe',
    description: 'Heavy steel wedge axe. Lethal melee weapon capable of felling infected in 2 blows.',
    category: 'melee',
    width: 2,
    height: 3,
    colorHex: 0xb91c1c,
    maxStack: 1,
    weaponKey: 'axe',
  },
  ij70: {
    id: 'ij70',
    name: 'IJ-70 9x18mm Pistol',
    description: 'Compact semi-automatic sidearm. Requires 9x18mm Makarov rounds.',
    category: 'firearm',
    width: 2,
    height: 2,
    colorHex: 0x334155,
    maxStack: 1,
    weaponKey: 'ij70',
  },
  sk59: {
    id: 'sk59',
    name: 'SK-59/66 7.62mm Carbine',
    description: 'Semi-automatic military rifle with high stopping power and loud acoustic report.',
    category: 'firearm',
    width: 4,
    height: 2,
    colorHex: 0x451a03,
    maxStack: 1,
    weaponKey: 'sk59',
  },
  ammo_9x18: {
    id: 'ammo_9x18',
    name: '9x18mm Makarov Cartridges',
    description: 'Box of 9x18mm pistol ammunition.',
    category: 'ammo',
    width: 1,
    height: 1,
    colorHex: 0xa16207,
    maxStack: 24,
  },
  ammo_762: {
    id: 'ammo_762',
    name: '7.62x39mm Rifle Cartridges',
    description: 'Heavy intermediate rifle rounds for the SK-59/66 Carbine.',
    category: 'ammo',
    width: 1,
    height: 2,
    colorHex: 0x4d7c0f,
    maxStack: 20,
  },
  shirt_work: {
    id: 'shirt_work',
    name: 'Flannel Work Shirt',
    description: 'Light cotton work shirt (4x2 slots). Can be worn or torn into 2 cloth rags.',
    category: 'clothing',
    width: 2,
    height: 2,
    colorHex: 0x475569,
    maxStack: 1,
    clothingSlot: 'jacket',
    storageGrid: [4, 2],
    insulation: 0.16,
  },
  jacket_track: {
    id: 'jacket_track',
    name: 'Padded Sailor Pea Coat',
    description: 'Heavy wool naval coat (5x3 slots) offering strong wind and cold insulation.',
    category: 'clothing',
    width: 2,
    height: 2,
    colorHex: 0x1e293b,
    maxStack: 1,
    clothingSlot: 'jacket',
    storageGrid: [5, 3],
    insulation: 0.34,
  },
  jacket_gorka: {
    id: 'jacket_gorka',
    name: 'Gorka-4 Mountain Field Jacket',
    description: 'Military windproof canvas smock (6x3 slots) with maximum thermal insulation.',
    category: 'clothing',
    width: 2,
    height: 2,
    colorHex: 0x3f4d3b,
    maxStack: 1,
    clothingSlot: 'jacket',
    storageGrid: [6, 3],
    insulation: 0.45,
  },
  pants_cargo: {
    id: 'pants_cargo',
    name: 'Reinforced Cargo Trousers',
    description: 'Durable work trousers with thigh pockets (4x2 slots).',
    category: 'clothing',
    width: 2,
    height: 2,
    colorHex: 0x374151,
    maxStack: 1,
    clothingSlot: 'pants',
    storageGrid: [4, 2],
    insulation: 0.22,
  },
  backpack_taloon: {
    id: 'backpack_taloon',
    name: 'Canvas Hiker Rucksack',
    description: 'Sturdy civilian mountaineering pack (5x4 slots).',
    category: 'clothing',
    width: 3,
    height: 3,
    colorHex: 0x9a3412,
    maxStack: 1,
    clothingSlot: 'backpack',
    storageGrid: [5, 4],
    insulation: 0.08,
  },
  backpack_tortilla: {
    id: 'backpack_tortilla',
    name: 'Assault Field Pack (6x5)',
    description: 'Large military patrol backpack providing 30 cells of grid storage.',
    category: 'clothing',
    width: 3,
    height: 3,
    colorHex: 0x365314,
    maxStack: 1,
    clothingSlot: 'backpack',
    storageGrid: [6, 5],
    insulation: 0.12,
  },
};

export interface InventoryItem {
  uid: string;
  templateId: string;
  condition: ItemCondition;
  quantity: number;
  loadedAmmo?: number; // for firearms
  gridX: number;
  gridY: number;
  container: ClothingSlotType;
}

export interface WorldLootItem {
  uid: string;
  templateId: string;
  condition: ItemCondition;
  quantity: number;
  loadedAmmo?: number;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
}

export class InventorySystem {
  private scene: THREE.Scene;
  public equippedClothing: Record<ClothingSlotType, InventoryItem | null> = {
    jacket: null,
    pants: null,
    backpack: null,
  };
  public heldWeaponItem: InventoryItem | null = null;
  public storedItems: InventoryItem[] = [];
  public worldLoot: WorldLootItem[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.resetStarterLoadout();
    this.populateWorldLoot();
  }

  public resetStarterLoadout() {
    this.storedItems = [];
    this.heldWeaponItem = null;

    // Starter worn work shirt (4x2) & cargo pants (4x2)
    this.equippedClothing = {
      jacket: {
        uid: `starter_jacket_${Date.now()}`,
        templateId: 'shirt_work',
        condition: 'Worn',
        quantity: 1,
        gridX: 0,
        gridY: 0,
        container: 'jacket',
      },
      pants: {
        uid: `starter_pants_${Date.now()}`,
        templateId: 'pants_cargo',
        condition: 'Worn',
        quantity: 1,
        gridX: 0,
        gridY: 0,
        container: 'pants',
      },
      backpack: null,
    };

    // Spawn on beach with a Flare and a Rag as specified in the brief
    this.addItemToStorage('flare', 'Pristine', 1);
    this.addItemToStorage('rag', 'Pristine', 1);
  }

  public getTotalInsulation(): number {
    let total = 0;
    (['jacket', 'pants', 'backpack'] as ClothingSlotType[]).forEach((slot) => {
      const item = this.equippedClothing[slot];
      if (item && item.condition !== 'Ruined') {
        const tmpl = ITEM_TEMPLATES[item.templateId];
        const condMult = item.condition === 'Pristine' ? 1.0 : item.condition === 'Worn' ? 0.85 : 0.55;
        total += (tmpl.insulation || 0) * condMult;
      }
    });
    return Math.min(1.0, total);
  }

  public degradeRandomClothing(): string | null {
    const slots: ClothingSlotType[] = ['jacket', 'pants', 'backpack'];
    const worn = slots.map((s) => this.equippedClothing[s]).filter((i): i is InventoryItem => i !== null);
    if (worn.length === 0) return null;

    const target = worn[Math.floor(Math.random() * worn.length)];
    const order: ItemCondition[] = ['Pristine', 'Worn', 'Damaged', 'Ruined'];
    const idx = order.indexOf(target.condition);
    if (idx < order.length - 1) {
      target.condition = order[idx + 1];
      return `${ITEM_TEMPLATES[target.templateId].name} is now ${target.condition.toLowerCase()}.`;
    }
    return null;
  }

  public getContainerGridSize(slot: ClothingSlotType): [number, number] {
    const garment = this.equippedClothing[slot];
    if (!garment) return [0, 0];
    return ITEM_TEMPLATES[garment.templateId].storageGrid || [0, 0];
  }

  public canPlaceInContainer(
    container: ClothingSlotType,
    gridX: number,
    gridY: number,
    width: number,
    height: number,
    ignoreUid?: string
  ): boolean {
    const [cols, rows] = this.getContainerGridSize(container);
    if (cols === 0 || rows === 0) return false;
    if (gridX < 0 || gridY < 0 || gridX + width > cols || gridY + height > rows) return false;

    for (let i = 0; i < this.storedItems.length; i++) {
      const other = this.storedItems[i];
      if (other.container !== container || other.uid === ignoreUid) continue;
      const tmpl = ITEM_TEMPLATES[other.templateId];
      const ox2 = other.gridX + tmpl.width;
      const oy2 = other.gridY + tmpl.height;
      const nx2 = gridX + width;
      const ny2 = gridY + height;

      const overlaps = gridX < ox2 && nx2 > other.gridX && gridY < oy2 && ny2 > other.gridY;
      if (overlaps) return false;
    }
    return true;
  }

  public addItemToStorage(
    templateId: string,
    condition: ItemCondition = 'Worn',
    quantity = 1,
    loadedAmmo?: number
  ): boolean {
    const tmpl = ITEM_TEMPLATES[templateId];
    if (!tmpl) return false;

    // 1. If stackable, try merging into existing stack
    if (tmpl.maxStack > 1) {
      for (const existing of this.storedItems) {
        if (existing.templateId === templateId && existing.quantity < tmpl.maxStack) {
          const add = Math.min(quantity, tmpl.maxStack - existing.quantity);
          existing.quantity += add;
          quantity -= add;
          if (quantity <= 0) return true;
        }
      }
    }

    // 2. If clothing slot is empty and item is clothing, equip directly
    if (tmpl.clothingSlot && !this.equippedClothing[tmpl.clothingSlot]) {
      this.equippedClothing[tmpl.clothingSlot] = {
        uid: `item_${Date.now()}_${Math.random()}`,
        templateId,
        condition,
        quantity: 1,
        gridX: 0,
        gridY: 0,
        container: tmpl.clothingSlot,
      };
      return true;
    }

    // 3. If weapon and hands are empty, equip to hands
    if ((tmpl.category === 'melee' || tmpl.category === 'firearm') && !this.heldWeaponItem) {
      this.heldWeaponItem = {
        uid: `item_${Date.now()}_${Math.random()}`,
        templateId,
        condition,
        quantity: 1,
        loadedAmmo: loadedAmmo ?? (templateId === 'ij70' ? 8 : templateId === 'sk59' ? 6 : undefined),
        gridX: 0,
        gridY: 0,
        container: 'jacket',
      };
      return true;
    }

    // 4. Find first free [gridX, gridY] across Jacket -> Pants -> Backpack
    const containers: ClothingSlotType[] = ['jacket', 'pants', 'backpack'];
    for (const container of containers) {
      const [cols, rows] = this.getContainerGridSize(container);
      for (let gy = 0; gy <= rows - tmpl.height; gy++) {
        for (let gx = 0; gx <= cols - tmpl.width; gx++) {
          if (this.canPlaceInContainer(container, gx, gy, tmpl.width, tmpl.height)) {
            this.storedItems.push({
              uid: `item_${Date.now()}_${Math.random()}`,
              templateId,
              condition,
              quantity,
              loadedAmmo,
              gridX: gx,
              gridY: gy,
              container,
            });
            return true;
          }
        }
      }
    }

    return false;
  }

  public moveItemInGrid(uid: string, targetContainer: ClothingSlotType, gx: number, gy: number): boolean {
    const item = this.storedItems.find((i) => i.uid === uid);
    if (!item) return false;
    const tmpl = ITEM_TEMPLATES[item.templateId];
    if (this.canPlaceInContainer(targetContainer, gx, gy, tmpl.width, tmpl.height, uid)) {
      item.container = targetContainer;
      item.gridX = gx;
      item.gridY = gy;
      return true;
    }
    return false;
  }

  public hasItem(templateId: string, minCount = 1): boolean {
    let count = 0;
    for (const i of this.storedItems) {
      if (i.templateId === templateId && i.condition !== 'Ruined') {
        count += i.quantity;
      }
    }
    return count >= minCount;
  }

  public consumeIngredients(ingredients: { itemId: string; count: number }[]): boolean {
    for (const req of ingredients) {
      if (!this.hasItem(req.itemId, req.count)) return false;
    }
    for (const req of ingredients) {
      let remaining = req.count;
      for (let i = this.storedItems.length - 1; i >= 0 && remaining > 0; i--) {
        const item = this.storedItems[i];
        if (item.templateId === req.itemId) {
          const take = Math.min(remaining, item.quantity);
          item.quantity -= take;
          remaining -= take;
          if (item.quantity <= 0) {
            this.storedItems.splice(i, 1);
          }
        }
      }
    }
    return true;
  }

  public reloadHeldFirearm(): { reloaded: number; message: string } {
    if (!this.heldWeaponItem) {
      return { reloaded: 0, message: 'No firearm in hands.' };
    }
    const tmpl = ITEM_TEMPLATES[this.heldWeaponItem.templateId];
    if (tmpl.category !== 'firearm') {
      return { reloaded: 0, message: 'Held weapon does not use ammunition.' };
    }

    const ammoId = this.heldWeaponItem.templateId === 'ij70' ? 'ammo_9x18' : 'ammo_762';
    const maxCap = this.heldWeaponItem.templateId === 'ij70' ? 12 : 10;
    const current = this.heldWeaponItem.loadedAmmo || 0;
    const needed = maxCap - current;

    if (needed <= 0) {
      return { reloaded: 0, message: 'Magazine is already full.' };
    }

    let loaded = 0;
    for (let i = this.storedItems.length - 1; i >= 0 && loaded < needed; i--) {
      const item = this.storedItems[i];
      if (item.templateId === ammoId) {
        const take = Math.min(needed - loaded, item.quantity);
        item.quantity -= take;
        loaded += take;
        if (item.quantity <= 0) {
          this.storedItems.splice(i, 1);
        }
      }
    }

    if (loaded > 0) {
      this.heldWeaponItem.loadedAmmo = current + loaded;
      return {
        reloaded: loaded,
        message: `Loaded ${loaded} rounds into ${tmpl.name} (${this.heldWeaponItem.loadedAmmo}/${maxCap}).`,
      };
    }

    return { reloaded: 0, message: `No matching ammunition found in inventory.` };
  }

  private createLootPropMesh(tmpl: ItemTemplate): THREE.Group {
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({
      color: tmpl.colorHex,
      roughness: 0.55,
      metalness: tmpl.category === 'firearm' || tmpl.category === 'melee' ? 0.65 : 0.15,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.4,
      metalness: 0.3,
    });

    const w = tmpl.width * 0.16;
    const d = tmpl.height * 0.18;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), baseMat);
    body.position.y = 0.06;
    body.castShadow = true;

    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.04, d * 0.4), accentMat);
    band.position.y = 0.11;
    group.add(body, band);
    return group;
  }

  public spawnWorldLoot(
    templateId: string,
    x: number,
    y: number,
    z: number,
    condition: ItemCondition = 'Worn',
    quantity = 1,
    loadedAmmo?: number
  ) {
    const tmpl = ITEM_TEMPLATES[templateId];
    if (!tmpl) return;

    const mesh = this.createLootPropMesh(tmpl);
    mesh.position.set(x, y, z);
    mesh.rotation.y = hash2D(x, z) * Math.PI * 2;
    this.scene.add(mesh);

    this.worldLoot.push({
      uid: `loot_${Date.now()}_${Math.random()}`,
      templateId,
      condition,
      quantity,
      loadedAmmo,
      x,
      y,
      z,
      mesh,
    });
  }

  public pickupWorldLoot(uid: string): { ok: boolean; message: string } {
    const idx = this.worldLoot.findIndex((l) => l.uid === uid);
    if (idx === -1) return { ok: false, message: '' };

    const loot = this.worldLoot[idx];
    const tmpl = ITEM_TEMPLATES[loot.templateId];

    // Special check if picking up larger clothing item
    if (tmpl.clothingSlot) {
      const currentGarment = this.equippedClothing[tmpl.clothingSlot];
      const currentCap = currentGarment
        ? (ITEM_TEMPLATES[currentGarment.templateId].storageGrid?.[0] || 0) *
          (ITEM_TEMPLATES[currentGarment.templateId].storageGrid?.[1] || 0)
        : 0;
      const newCap = (tmpl.storageGrid?.[0] || 0) * (tmpl.storageGrid?.[1] || 0);

      if (newCap >= currentCap) {
        this.equippedClothing[tmpl.clothingSlot] = {
          uid: loot.uid,
          templateId: loot.templateId,
          condition: loot.condition,
          quantity: 1,
          gridX: 0,
          gridY: 0,
          container: tmpl.clothingSlot,
        };
        if (currentGarment) {
          this.spawnWorldLoot(
            currentGarment.templateId,
            loot.x + 0.3,
            loot.y,
            loot.z + 0.2,
            currentGarment.condition,
            1
          );
        }
        this.scene.remove(loot.mesh);
        this.worldLoot.splice(idx, 1);
        return { ok: true, message: `Equipped ${tmpl.name} (${loot.condition}).` };
      }
    }

    const placed = this.addItemToStorage(loot.templateId, loot.condition, loot.quantity, loot.loadedAmmo);
    if (!placed) {
      return { ok: false, message: 'Not enough space in clothing grids.' };
    }

    this.scene.remove(loot.mesh);
    this.worldLoot.splice(idx, 1);
    return { ok: true, message: `Picked up ${tmpl.name} (${loot.condition}).` };
  }

  public dropStoredItem(uid: string, px: number, py: number, pz: number) {
    const idx = this.storedItems.findIndex((i) => i.uid === uid);
    if (idx !== -1) {
      const item = this.storedItems[idx];
      this.storedItems.splice(idx, 1);
      this.spawnWorldLoot(
        item.templateId,
        px + (Math.random() - 0.5) * 0.8,
        py + 0.05,
        pz + (Math.random() - 0.5) * 0.8,
        item.condition,
        item.quantity,
        item.loadedAmmo
      );
      return;
    }
    if (this.heldWeaponItem && this.heldWeaponItem.uid === uid) {
      const item = this.heldWeaponItem;
      this.heldWeaponItem = null;
      this.spawnWorldLoot(
        item.templateId,
        px + 0.4,
        py + 0.05,
        pz + 0.4,
        item.condition,
        item.quantity,
        item.loadedAmmo
      );
    }
  }

  public getNearbyWorldLoot(px: number, pz: number, maxDist = 3.4): WorldLootItem[] {
    const dSq = maxDist * maxDist;
    return this.worldLoot.filter((l) => {
      const dx = l.x - px;
      const dz = l.z - pz;
      return dx * dx + dz * dz <= dSq;
    });
  }

  private populateWorldLoot() {
    const tables: Record<BuildingCategory, string[]> = {
      house: [
        'canned_sprats',
        'canned_peaches',
        'kvass_bottle',
        'shirt_work',
        'jacket_track',
        'pants_cargo',
        'backpack_taloon',
        'island_map',
        'meat_raw',
      ],
      medical: ['bandage_medical', 'saline_bag', 'rag', 'splint', 'water_canteen'],
      military: ['ij70', 'sk59', 'ammo_9x18', 'ammo_762', 'jacket_gorka', 'backpack_tortilla', 'water_canteen'],
      industrial: ['axe', 'pipe', 'flare', 'wooden_sticks', 'birch_bark', 'island_map', 'backpack_taloon'],
    };

    const conditions: ItemCondition[] = ['Pristine', 'Worn', 'Worn', 'Damaged'];

    for (let i = 0; i < WORLD_BUILDINGS.length; i++) {
      const b = WORLD_BUILDINGS[i];
      const pool = tables[b.category];

      for (let p = 0; p < b.lootPoints.length; p++) {
        const pt = b.lootPoints[p];
        const h = hash2D(pt.x * 13.7 + i, pt.z * 29.3 + p);
        const itemId = pool[Math.floor(h * pool.length)];
        const cond = conditions[Math.floor(hash2D(pt.z, pt.x) * conditions.length)];
        const qty = itemId === 'ammo_9x18' ? 12 : itemId === 'ammo_762' ? 10 : 1;
        this.spawnWorldLoot(itemId, pt.x, pt.y, pt.z, cond, qty);
      }
    }

    // Also scatter natural sticks, birch bark, and washed-up supplies near the southern coast & woods
    const coastalCacheSpots: [number, number, string][] = [
      [-445, 545, 'canned_sprats'],
      [-438, 538, 'kvass_bottle'],
      [-430, 532, 'pipe'],
      [-418, 520, 'wooden_sticks'],
      [-415, 518, 'birch_bark'],
      [-395, 495, 'island_map'],
      [-20, 120, 'wooden_sticks'],
      [-18, 122, 'birch_bark'],
      [140, 20, 'wooden_sticks'],
      [142, 22, 'meat_raw'],
    ];

    for (const [cx, cz, id] of coastalCacheSpots) {
      const cy = Math.max(0.5, getTerrainHeight(cx, cz));
      this.spawnWorldLoot(id, cx, cy + 0.05, cz, 'Worn', 1);
    }
  }
}
