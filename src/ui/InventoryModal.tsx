import React, { useState } from 'react';
import { X, Hammer, Package, Shirt, Shield, ArrowUpRight, Trash2 } from 'lucide-react';
import {
  ClothingSlotType,
  ITEM_TEMPLATES,
  InventoryItem,
  ItemCondition,
  WorldLootItem,
} from '../inventory/inventorySystem';
import { CRAFTING_RECIPES, CraftingRecipe } from '../crafting/recipes';

interface InventoryModalProps {
  equippedClothing: Record<ClothingSlotType, InventoryItem | null>;
  heldWeapon: InventoryItem | null;
  storedItems: InventoryItem[];
  nearbyLoot: WorldLootItem[];
  nearCampfire: boolean;
  onClose: () => void;
  onPickupLoot: (uid: string) => void;
  onMoveItemInGrid: (uid: string, targetContainer: ClothingSlotType, gx: number, gy: number) => void;
  onUseItem: (item: InventoryItem) => void;
  onDropItem: (uid: string) => void;
  onEquipWeaponFromStorage: (item: InventoryItem) => void;
  onUnequipWeaponToStorage: () => void;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
}

const CELL_SIZE = 44;

function getConditionColor(cond: ItemCondition): string {
  switch (cond) {
    case 'Pristine':
      return 'text-emerald-400';
    case 'Worn':
      return 'text-amber-300';
    case 'Damaged':
      return 'text-orange-400';
    case 'Ruined':
      return 'text-red-500';
  }
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  equippedClothing,
  heldWeapon,
  storedItems,
  nearbyLoot,
  nearCampfire,
  onClose,
  onPickupLoot,
  onMoveItemInGrid,
  onUseItem,
  onDropItem,
  onEquipWeaponFromStorage,
  onUnequipWeaponToStorage,
  onCraftRecipe,
}) => {
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [selectedItemUid, setSelectedItemUid] = useState<string | null>(null);

  const selectedItem =
    storedItems.find((i) => i.uid === selectedItemUid) ||
    (heldWeapon && heldWeapon.uid === selectedItemUid ? heldWeapon : null);

  const renderContainerGrid = (slot: ClothingSlotType, label: string) => {
    const garment = equippedClothing[slot];
    if (!garment) {
      return (
        <div className="bg-[#11161d] border border-white/10 p-4 rounded">
          <div className="text-xs text-slate-500 font-medium">{label} — No Garment Equipped</div>
        </div>
      );
    }

    const tmpl = ITEM_TEMPLATES[garment.templateId];
    const [cols, rows] = tmpl.storageGrid || [0, 0];
    const containerItems = storedItems.filter((i) => i.container === slot);

    return (
      <div className="bg-[#11161d] border border-white/10 p-4 rounded flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Shirt className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-200">{tmpl.name}</span>
            <span className="text-slate-600">·</span>
            <span className={getConditionColor(garment.condition)}>{garment.condition}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {cols}×{rows} Grid · Warmth +{Math.round((tmpl.insulation || 0) * 100)}%
          </span>
        </div>

        {/* 2D Tetris Matrix */}
        <div
          className="relative bg-[#0a0d12] border border-slate-700/80"
          style={{
            width: cols * CELL_SIZE,
            height: rows * CELL_SIZE,
          }}
        >
          {/* Background Grid Cells (Drop Targets) */}
          {Array.from({ length: rows }).map((_, ry) =>
            Array.from({ length: cols }).map((__, cx) => (
              <div
                key={`${cx}_${ry}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedUid) {
                    onMoveItemInGrid(draggedUid, slot, cx, ry);
                    setDraggedUid(null);
                  }
                }}
                className="absolute border border-slate-800/80 hover:bg-amber-500/10 transition-colors"
                style={{
                  left: cx * CELL_SIZE,
                  top: ry * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
              />
            ))
          )}

          {/* Placed Items */}
          {containerItems.map((item) => {
            const itmpl = ITEM_TEMPLATES[item.templateId];
            const isSelected = selectedItemUid === item.uid;
            return (
              <div
                key={item.uid}
                draggable
                onDragStart={() => setDraggedUid(item.uid)}
                onClick={() => setSelectedItemUid(item.uid)}
                onDoubleClick={() => onUseItem(item)}
                className={`absolute p-1.5 border cursor-grab active:cursor-grabbing flex flex-col justify-between transition-colors ${
                  isSelected
                    ? 'bg-slate-800 border-amber-400 z-20'
                    : 'bg-slate-900/95 border-slate-600 hover:border-slate-400 z-10'
                }`}
                style={{
                  left: item.gridX * CELL_SIZE + 1,
                  top: item.gridY * CELL_SIZE + 1,
                  width: itmpl.width * CELL_SIZE - 2,
                  height: itmpl.height * CELL_SIZE - 2,
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[10px] font-medium text-slate-200 leading-tight line-clamp-2">
                    {itmpl.name}
                  </span>
                  <span
                    className="w-2 h-2 rounded-sm shrink-0 mt-0.5"
                    style={{ backgroundColor: `#${itmpl.colorHex.toString(16).padStart(6, '0')}` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono tabular-nums">
                  <span className={getConditionColor(item.condition)}>{item.condition[0]}</span>
                  {item.quantity > 1 && <span className="text-slate-300">×{item.quantity}</span>}
                  {item.loadedAmmo !== undefined && <span className="text-amber-300">{item.loadedAmmo}r</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-[1260px] h-[84vh] bg-[#0d1117] border border-white/15 rounded flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#11161d]">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold tracking-tight text-slate-100">
              SURVIVOR EQUIPMENT & SPATIAL INVENTORY
            </h2>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">
              Drag items across grid cells or double-click an item to use/equip
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" /> Close [Tab]
          </button>
        </div>

        {/* 3-Column Body: Vicinity & Hands | Clothing Grids | Inspector & Crafting */}
        <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-y-auto">
          {/* Left Column (3 cols): Vicinity Ground Loot + Hands Slot */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-5">
            {/* Hands Weapon Slot */}
            <div className="bg-[#11161d] border border-white/10 p-4 rounded flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" /> Primary Hands Slot
                </span>
              </div>

              {heldWeapon ? (
                <div
                  onClick={() => setSelectedItemUid(heldWeapon.uid)}
                  className="p-3 bg-[#0a0d12] border border-amber-500/40 rounded flex flex-col gap-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-100">
                      {ITEM_TEMPLATES[heldWeapon.templateId].name}
                    </span>
                    <span className={`text-[11px] font-mono ${getConditionColor(heldWeapon.condition)}`}>
                      {heldWeapon.condition}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {heldWeapon.loadedAmmo !== undefined
                        ? `Chambered: ${heldWeapon.loadedAmmo} rounds`
                        : 'Melee Ready'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipWeaponToStorage();
                      }}
                      className="text-amber-400 hover:underline cursor-pointer"
                    >
                      Holster
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#0a0d12] border border-dashed border-slate-800 rounded text-xs text-slate-500 text-center">
                  Bare Hands (Select a weapon in grid to equip)
                </div>
              )}
            </div>

            {/* Ground Vicinity List */}
            <div className="bg-[#11161d] border border-white/10 p-4 rounded flex-1 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-slate-400" /> Ground Vicinity (3.4m)
                </span>
                <span className="font-mono text-slate-400">{nearbyLoot.length}</span>
              </div>

              {nearbyLoot.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  No loose items within reach. Search inside houses, clinics, or military barracks.
                </div>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[340px]">
                  {nearbyLoot.map((loot) => {
                    const tmpl = ITEM_TEMPLATES[loot.templateId];
                    return (
                      <div
                        key={loot.uid}
                        className="p-2.5 bg-[#0a0d12] border border-white/10 rounded flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-200">{tmpl.name}</span>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className={getConditionColor(loot.condition)}>{loot.condition}</span>
                            <span>·</span>
                            <span className="font-mono">
                              {tmpl.width}×{tmpl.height}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onPickupLoot(loot.uid)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded cursor-pointer shrink-0"
                        >
                          Take
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center Column (5 cols): Equipped Clothing Tetris Grids */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-y-auto">
            {renderContainerGrid('jacket', 'Outerwear / Jacket')}
            {renderContainerGrid('pants', 'Trousers / Cargo Pockets')}
            {renderContainerGrid('backpack', 'Field Backpack')}
          </div>

          {/* Right Column (4 cols): Item Inspector & Field Crafting Table */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
            {/* Selected Item Inspector */}
            <div className="bg-[#11161d] border border-white/10 p-4 rounded flex flex-col gap-3">
              <div className="text-xs font-semibold text-slate-200">Item Inspection & Actions</div>
              {selectedItem ? (
                (() => {
                  const tmpl = ITEM_TEMPLATES[selectedItem.templateId];
                  return (
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-100">{tmpl.name}</span>
                          <span className={`text-xs font-mono ${getConditionColor(selectedItem.condition)}`}>
                            {selectedItem.condition}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">{tmpl.description}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>
                            Size: {tmpl.width}×{tmpl.height} cells
                          </span>
                          <span>·</span>
                          <span>Qty: {selectedItem.quantity}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                        {(tmpl.category === 'food' ||
                          tmpl.category === 'drink' ||
                          tmpl.category === 'medical' ||
                          tmpl.category === 'utility') && (
                          <button
                            onClick={() => onUseItem(selectedItem)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            {tmpl.category === 'medical'
                              ? 'Apply Treatment'
                              : tmpl.category === 'utility'
                              ? 'Use / Deploy'
                              : 'Consume'}
                          </button>
                        )}

                        {(tmpl.category === 'melee' || tmpl.category === 'firearm') &&
                          (!heldWeapon || heldWeapon.uid !== selectedItem.uid) && (
                            <button
                              onClick={() => onEquipWeaponFromStorage(selectedItem)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded cursor-pointer"
                            >
                              Equip in Hands
                            </button>
                          )}

                        <button
                          onClick={() => {
                            onDropItem(selectedItem.uid);
                            setSelectedItemUid(null);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-300 text-xs rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Drop on Ground
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-xs text-slate-500 py-4">
                  Click any item inside your clothing grids to inspect its condition or use it.
                </div>
              )}
            </div>

            {/* Field Crafting Table */}
            <div className="bg-[#11161d] border border-white/10 p-4 rounded flex-1 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Hammer className="w-4 h-4 text-amber-400" /> Survival Field Crafting
                </span>
                {nearCampfire && (
                  <span className="text-[11px] text-amber-400 font-mono">Campfire Active Nearby</span>
                )}
              </div>

              <div className="flex flex-col gap-2.5 overflow-y-auto">
                {CRAFTING_RECIPES.map((recipe) => {
                  const hasIngs = recipe.ingredients.every((req) => {
                    const count = storedItems
                      .filter((i) => i.templateId === req.itemId && i.condition !== 'Ruined')
                      .reduce((acc, v) => acc + v.quantity, 0);
                    return count >= req.count;
                  });
                  const fireOk = !recipe.requiresCampfire || nearCampfire;
                  const canCraft = hasIngs && fireOk;

                  return (
                    <div
                      key={recipe.id}
                      className="p-3 bg-[#0a0d12] border border-white/10 rounded flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200">{recipe.name}</span>
                        <button
                          disabled={!canCraft}
                          onClick={() => onCraftRecipe(recipe)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                            canCraft
                              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 cursor-pointer'
                              : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Craft
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">{recipe.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                        {recipe.ingredients.map((ing, idx) => (
                          <span key={ing.itemId}>
                            {idx > 0 && ' + '}
                            {ing.count}× {ITEM_TEMPLATES[ing.itemId]?.name || ing.itemId}
                          </span>
                        ))}
                        {recipe.requiresCampfire && (
                          <span className={nearCampfire ? 'text-emerald-400' : 'text-red-400'}>
                            · Requires Active Fire
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
