import React, { useState } from 'react';
import {
  Heart,
  Droplet,
  Thermometer,
  Utensils,
  GlassWater,
  Zap,
  CloudRain,
  Flame,
  Home,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { SurvivalStats, SensoryMessage } from '../survival/survivalSystem';
import { BALANCE } from '../config/balance';
import { ITEM_TEMPLATES, InventoryItem, WorldLootItem } from '../inventory/inventorySystem';

interface HudOverlayProps {
  stats: SurvivalStats;
  messages: SensoryMessage[];
  heldWeapon: InventoryItem | null;
  nearbyLoot: WorldLootItem[];
  noiseRadius: number;
  isThirdPerson: boolean;
  isCrouching: boolean;
  flareActive: boolean;
  isPointerLocked: boolean;
  formattedTime: string;
  isRaining: boolean;
  hasMapItem: boolean;
  playerCoords: { x: number; z: number; settlementName: string | null };
  onRequestPointerLock: () => void;
  onOpenInventory: () => void;
  onOpenMap: () => void;
  onTogglePerspective: () => void;
  onToggleRain: () => void;
  onToggleFlare: () => void;
  onPickupNearest: () => void;
  onGatherForestMaterial: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  stats,
  messages,
  heldWeapon,
  nearbyLoot,
  noiseRadius,
  isThirdPerson,
  isCrouching,
  flareActive,
  isPointerLocked,
  formattedTime,
  isRaining,
  hasMapItem,
  playerCoords,
  onRequestPointerLock,
  onOpenInventory,
  onOpenMap,
  onTogglePerspective,
  onToggleRain,
  onToggleFlare,
  onPickupNearest,
  onGatherForestMaterial,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Determine status criticality for each icon
  const healthCrit = stats.health <= BALANCE.SURVIVAL.CRITICAL_HEALTH;
  const healthWarn = stats.health <= 65;

  const bloodCrit = stats.blood <= BALANCE.SURVIVAL.CRITICAL_BLOOD;
  const bloodWarn = stats.blood <= 4000 || stats.bleedingCuts > 0;

  const tempCrit = stats.temperature <= BALANCE.SURVIVAL.HYPOTHERMIA_THRESHOLD;
  const tempWarn = stats.temperature <= BALANCE.SURVIVAL.CHILLY_THRESHOLD;

  const hungerCrit = stats.hunger <= BALANCE.SURVIVAL.CRITICAL_HUNGER;
  const hungerWarn = stats.hunger <= 48;

  const thirstCrit = stats.thirst <= BALANCE.SURVIVAL.CRITICAL_THIRST;
  const thirstWarn = stats.thirst <= 50;

  const energyCrit = stats.energy <= BALANCE.SURVIVAL.CRITICAL_ENERGY;

  const getIconColor = (isCrit: boolean, isWarn: boolean, critClass = 'text-red-500') => {
    if (isCrit) return `${critClass} opacity-100`;
    if (isWarn) return 'text-amber-400 opacity-95';
    return 'text-slate-400 opacity-45';
  };

  const weaponName = heldWeapon ? ITEM_TEMPLATES[heldWeapon.templateId].name : 'Bare Hands';
  const weaponAmmo =
    heldWeapon && ITEM_TEMPLATES[heldWeapon.templateId].category === 'firearm'
      ? `${heldWeapon.loadedAmmo || 0} rds`
      : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-5 select-none">
      {/* Top Bar: Minimalist Spec Badge & Location Readout */}
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto bg-[#0f1318]/90 border border-white/10 px-4 py-2.5 rounded">
          <div className="flex items-center gap-3 text-xs tracking-wider text-slate-300 font-semibold">
            <span>DEADLANDS: COASTLINE</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400">{formattedTime}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{isRaining ? 'Coastal Squall' : 'Baltic Overcast'}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
            <span>
              Sector {Math.round(playerCoords.x)}m, {Math.round(playerCoords.z)}m
            </span>
            {playerCoords.settlementName && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300 font-sans font-medium">{playerCoords.settlementName}</span>
              </>
            )}
          </div>
        </div>

        {!isPointerLocked && (
          <button
            onClick={onRequestPointerLock}
            className="pointer-events-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded transition-colors cursor-pointer"
          >
            Click Viewport to Lock Cursor (FPS Look)
          </button>
        )}
      </div>

      {/* Center Reticle & Contextual Interaction Prompts */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        <Crosshair className="w-4 h-4 text-white/45 stroke-[1.5]" />

        {nearbyLoot.length > 0 && (
          <div className="mt-6 pointer-events-auto bg-[#0f1318]/92 border border-amber-500/40 px-3.5 py-2 rounded text-xs text-slate-200 flex items-center gap-2">
            <span className="font-mono text-amber-400 font-semibold">[F]</span>
            <span>Pick up {ITEM_TEMPLATES[nearbyLoot[0].templateId].name}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{nearbyLoot[0].condition}</span>
            {nearbyLoot.length > 1 && (
              <span className="text-slate-400 font-mono">(+{nearbyLoot.length - 1} nearby)</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Area: Left Sensory Messages | Center Collapsible Dock | Right Gritty Status Icons */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Plain-Language Sensory Messages & Stamina/Noise Readout */}
        <div className="w-80 flex flex-col gap-2">
          <div className="flex flex-col-reverse gap-1.5">
            {messages.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className={`text-xs px-3 py-1.5 rounded bg-[#0f1318]/88 border ${
                  m.severity === 'critical'
                    ? 'border-red-500/50 text-red-300 font-medium'
                    : m.severity === 'warning'
                    ? 'border-amber-500/40 text-amber-200'
                    : 'border-white/10 text-slate-300'
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>

          {/* Stamina Bar & Acoustic Footstep Meter */}
          <div className="bg-[#0f1318]/90 border border-white/10 p-3 rounded flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>{weaponName}</span>
              <span className="text-amber-400">{weaponAmmo || 'Melee'}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-slate-200 transition-all duration-100"
                style={{ width: `${Math.round(stats.stamina)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>Stance: {isCrouching ? 'Crouched' : 'Standing'}</span>
              <span>Noise: {Math.round(noiseRadius)}m</span>
            </div>
          </div>
        </div>

        {/* Bottom-Center: Collapsible Ergonomic Control Dock */}
        <div className="pointer-events-auto flex flex-col items-center max-w-[640px]">
          <button
            onClick={() => setDockCollapsed(!dockCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#141920] border border-b-0 border-white/15 rounded-t text-[11px] text-slate-300 hover:text-white cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Show Survival Controls' : 'Hide Controls'}</span>
          </button>

          {!dockCollapsed && (
            <div className="bg-[#11161c]/95 border border-white/15 px-4 py-2.5 rounded-b rounded-tl rounded-tr flex flex-wrap items-center justify-center gap-2 text-xs">
              <button
                onClick={onOpenInventory}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                [Tab] Inventory & Craft
              </button>
              <button
                onClick={onOpenMap}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                [M] Map {hasMapItem ? '(Unlocked)' : '(Locked)'}
              </button>
              <button
                onClick={onTogglePerspective}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                [V] {isThirdPerson ? '3rd Person' : '1st Person'}
              </button>
              <button
                onClick={onToggleFlare}
                className={`px-3 py-1.5 rounded cursor-pointer whitespace-nowrap shrink-0 ${
                  flareActive ? 'bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                [L] Flare {flareActive ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={onGatherForestMaterial}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                [G] Forage Sticks/Bark
              </button>
              <button
                onClick={onToggleRain}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                {isRaining ? 'Stop Squall' : 'Trigger Rain'}
              </button>
            </div>
          )}
        </div>

        {/* Bottom-Right: Minimalist Gritty Status Icons (Illuminate when critical) */}
        <div className="bg-[#0f1318]/92 border border-white/10 px-4 py-3 rounded flex flex-col items-end gap-2.5">
          {/* Conditional Exposure & Trauma Badges */}
          <div className="flex items-center gap-3 text-[11px] font-mono">
            {stats.isIndoors && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Home className="w-3.5 h-3.5" /> Sheltered
              </span>
            )}
            {stats.nearCampfire && (
              <span className="flex items-center gap-1 text-amber-400">
                <Flame className="w-3.5 h-3.5" /> Warming
              </span>
            )}
            {stats.wetness > 15 && (
              <span className={`flex items-center gap-1 ${stats.wetness > 60 ? 'text-sky-400 font-semibold' : 'text-slate-400'}`}>
                <CloudRain className="w-3.5 h-3.5" /> Wet {Math.round(stats.wetness)}%
              </span>
            )}
            {stats.bleedingCuts > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" /> Bleeding ×{stats.bleedingCuts}
              </span>
            )}
          </div>

          {/* 6 Core Physiological Icons */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1" title="Health">
              <Heart className={`w-5 h-5 ${getIconColor(healthCrit, healthWarn)}`} />
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{Math.round(stats.health)}</span>
            </div>

            <div className="flex flex-col items-center gap-1" title="Blood Volume (ml)">
              <Droplet className={`w-5 h-5 ${getIconColor(bloodCrit, bloodWarn)}`} />
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{Math.round(stats.blood)}</span>
            </div>

            <div className="flex flex-col items-center gap-1" title="Core Body Temperature">
              <Thermometer
                className={`w-5 h-5 ${getIconColor(tempCrit, tempWarn, 'text-sky-400')}`}
              />
              <span className="text-[10px] font-mono tabular-nums text-slate-400">
                {stats.temperature.toFixed(1)}°
              </span>
            </div>

            <div className="flex flex-col items-center gap-1" title="Hunger / Calories">
              <Utensils className={`w-5 h-5 ${getIconColor(hungerCrit, hungerWarn)}`} />
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{Math.round(stats.hunger)}%</span>
            </div>

            <div className="flex flex-col items-center gap-1" title="Thirst / Hydration">
              <GlassWater className={`w-5 h-5 ${getIconColor(thirstCrit, thirstWarn)}`} />
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{Math.round(stats.thirst)}%</span>
            </div>

            <div className="flex flex-col items-center gap-1" title="Energy">
              <Zap className={`w-5 h-5 ${getIconColor(energyCrit, stats.energy < 45)}`} />
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{Math.round(stats.energy)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
