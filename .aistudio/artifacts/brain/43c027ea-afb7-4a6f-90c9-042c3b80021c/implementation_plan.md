# DEADLANDS: Coastline

A hardcore browser-based open-world survival game set on an abandoned Baltic island, delivering a seamless 2km × 2km procedural wilderness, tactical first/third-person movement, and interdependent physiological survival mechanics at a locked 60 FPS.

### User Review & Critical Decisions

> [!IMPORTANT]
> The core technical architecture and atmospheric direction incorporate your confirmed preferences and are ready for execution with Argon:

- **Confirmed Rendering Engine**: Direct Three.js WebGL pipeline with custom fixed-timestep physics and 3×3 chunk streaming for maximum 60 FPS performance.
- **Confirmed Camera & Controls**: Pointer Lock mouse capture with free-look (`Alt`), smooth damped camera switching between 1st-person and 3rd-person (`V`), and stance control (`Shift` sprint, `C` crouch).
- **Confirmed Biome & Atmosphere**: Bleak post-Soviet Baltic coastline featuring dense Scotch pine forests, cold coastal fog, decaying concrete settlements, and dynamic rain squalls.
- **Confirmed Scope & Phased Rollout**: Immediate full-featured playable build of Steps 1–3 (Seamless 2km × 2km Island & Settlements, Player Kinematics & Acoustic Footsteps, and Interdependent Survival Telemetry & Weather Exposure), alongside complete interactive systems for Loot/Tetris Inventory, Infected AI, Combat, Crafting, and Permadeath so the entire survival loop can be experienced and tested immediately.

---

### 1. Overview & Core Concept

- **What It Does**: Drops the player onto a cold, fog-shrouded island with only a road flare and a sterile rag. Players navigate coastal beaches, pine forests, three decaying towns (*Zalivsk*, *Krasno*, *Pribor*), and a fortified radar compound (*Object-44*), managing body heat, hydration, nutrition, blood loss, and acoustic stealth while scavenging and surviving infected inhabitants.
- **Target Audience / Persona**: Fans of hardcore open-world survival simulations who value atmospheric tension, environmental storytelling, tactile inventory management, and punishing physiological realism over arcade hand-holding.
- **Key Value**: Delivers a zero-loading-screen 3D open-world survival sandbox directly in the browser using 100% procedural geometry, physicalized materials, and synthesized spatial Web Audio.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Shoreline Awakening**: The player spawns on a random gravel beach segment. Clicking the viewport engages Pointer Lock. Moving inland along cracked asphalt roads reveals road signs, forest clearings, and coastal towns.
  2. **Locomotion, Stance & Acoustics**: Walking, sprinting, or crouching dynamically alters stamina consumption, camera bob, and the acoustic noise radius emitted by footsteps on sand, grass, asphalt, or indoor wood floors. Pressing `V` smoothly interpolates between first-person eye level and an over-the-shoulder third-person rig.
  3. **Weather Exposure & Thermoregulation**: Dynamic rain squalls drench exposed players, increasing clothing wetness. Wet clothing accelerates core body temperature loss; dropping into hypothermia triggers shivering and steady health drain unless the player takes shelter inside an enterable building or ignites a crafted campfire.
  4. **Scavenging, Combat & Permadeath**: Pressing `Tab` opens the spatial grid inventory to equip clothing, bandage lacerations, craft survival tools, or load magazines. Upon death, a stark permadeath screen reports survival duration and infected kills before respawning the player on a new shoreline.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Gritty, utilitarian, desaturated Eastern European coastal realism. No arcade scoreboards, floating health bars, or neon chrome.
  - *Color Palette & Mood*:
    - `--background`: Deep Baltic slate `#0F1419` and overcast horizon `#4A5863`
    - `--surface`: Weathered concrete `#1C2228` with subtle hairline borders `rgba(255, 255, 255, 0.08)`
    - `--primary`: Cold steel `#94A3B8` for primary typography and normal telemetry
    - `--accent`: Warning amber `#D97706`, arterial crimson `#DC2626` for critical trauma/bleeding, and hypothermic cyan `#38BDF8`
  - *Typography & Hierarchy*: Clean neo-grotesque geometric sans (`Plus Jakarta Sans`) for diegetic sensory notifications and inventory labels, paired with tabular monospace (`JetBrains Mono` / `tabular-nums`) for spatial coordinates, weapon calibers, and grid capacities.
  - *Component Styling & Layout*: Full-viewport (`100vw × 100vh`) unobstructed 3D canvas. The HUD consists strictly of muted bottom-right physiological glyphs (Health, Blood, Hunger, Thirst, Temperature, Energy, Wetness, Bleeding) that highlight only when thresholds become critical, paired with plain-language bottom-left sensory messages (*"You feel thirsty."*, *"Your clothes are soaked."*).

- **Interactive Feedback & Motion**:
  - Camera transitions between 1st and 3rd person use frame-rate independent exponential damping (`THREE.MathUtils.damp`).
  - Critical low-blood states subtly desaturate the scene exposure, while sprinting widens camera FOV slightly and elevates heart rate audio.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Three.js Engine with Custom Chunk Streamer**
  - *Chosen Approach*: Mount a persistent `THREE.WebGLRenderer` inside an isolated React container with pre-allocated math objects (`Vector3`, `Matrix4`, `Color`) and a 3×3 active chunk streaming manager around the player.
  - *Why*: Eliminates React reconciliation overhead during 60Hz physics/AI updates and prevents garbage-collection frame hitches while streaming thousands of instanced trees and multi-part buildings.
  - *Alternatives Considered*: Declarative React wrapper components were passed over to guarantee deterministic memory management and raw instancing speed.

- **Decision 2: Analytic Continuous Heightmap with Flattened Settlement Pads**
  - *Chosen Approach*: Combine multi-octave simplex noise with a radial coastal island mask and smooth blending weights around town centers and road splines.
  - *Why*: Enables $O(1)$ exact terrain elevation and surface normal queries at any $(x, z)$ coordinate for instant grounding of players, infected agents, trees, and enterable building doorways without expensive mesh-triangle raycasting.

- **Decision 3: Multi-Part Composite Procedural Architecture & Actors**
  - *Chosen Approach*: Construct every tree, player model, infected agent, weapon, and enterable building as a composite `THREE.Group` with distinct primary silhouettes, secondary roofs/canopies/limbs, and accent details (window frames, doorways, packs, visors) using varied PBR roughness and metalness.
  - *Why*: Ensures visual depth, clear silhouette recognition through coastal fog, and authentic interior room navigation without relying on external `.glb` model downloads.

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DEADLANDS: Coastline Runtime                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐                  ┌───────────────────────────┐  │
│  │   Player & Camera Rig   │                  │   Survival & Vitals Core  │  │
│  │  • 1st / 3rd Person (V) │                  │  • Health, Blood, Energy  │  │
│  │  • Free-look & Stances  │◄────────────────►│  • Hunger, Thirst, Temp   │  │
│  │  • Acoustic Footsteps   │                  │  • Wetness & Bleeding     │  │
│  └────────────┬────────────┘                  └─────────────┬─────────────┘  │
│               │                                             │                │
│               ▼                                             ▼                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     2km × 2km World & Chunk Streamer                   │  │
│  │  • Continuous Island Heightmap + Coastal Water Plane                   │  │
│  │  • 3×3 Active Chunk Grid (Instanced Pines, Birches, Rocks, Bushes)     │  │
│  │  • 3 Enterable Settlements (Zalivsk, Krasno, Pribor) + Military Camp   │  │
│  │  • Dynamic Day/Night Sun Arc, Horizon Fog & Rain Particle Squalls      │  │
│  └────────────┬─────────────────────────────────────────────┬─────────────┘  │
│               │                                             │                │
│               ▼                                             ▼                │
│  ┌────────────────────────────────────┐      ┌────────────────────────────┐  │
│  │    Infected AI & Combat Director   │      │  Tetris Grid & Crafting    │  │
│  │  • Max 40 Active Agents (Pooled)   │      │  • 2D W×H Spatial Matrix   │  │
│  │  • State Machine: Idle → Wander    │◄────►│  • Clothing Storage Slots  │  │
│  │    → Alert (Sight/Noise) → Chase   │      │  • Condition Degradation   │  │
│  │  • Melee & Ballistic Raycasting    │      │  • Rags, Splints, Campfire │  │
│  └────────────┬───────────────────────┘      └──────────────┬─────────────┘  │
│               │                                             │                │
│               └──────────────────────┬──────────────────────┘                │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                   Gritty DOM HUD & Procedural Web Audio                │  │
│  │  • Critical-Only Vitals Icons + Plain-Language Sensory Feed            │  │
│  │  • Drag-and-Drop Inventory Modal (Tab) & Lootable Island Map (M)       │  │
│  │  • Permadeath Summary Screen ("Survived X min, killed Y")              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Central Balance Configuration**: A unified tuning store defines world dimensions (`2000m × 2000m`), chunk size (`200m`), movement speeds (crouch, walk, sprint), stamina drain/regen, acoustic noise radii, metabolic decay rates, hypothermia thresholds, weapon ballistics, and crafting recipes.
  - **Player & Survival State**: Tracks 3D world position, velocity, yaw/pitch, free-look offset, stance, noise output, and physiological vitals (`health`, `blood`, `hunger`, `thirst`, `temperature`, `energy`, `wetness`, `bleedingCuts`), plus session telemetry (`survivedSeconds`, `infectedKilled`).
  - **Spatial Grid Inventory State**: Represents equipment slots (`Jacket`, `Pants`, `Backpack`, `Hands`) where each worn garment provides a 2D cell grid (`width × height`). Items occupy specific `[x, y, w, h]` coordinates and carry a condition state (`Pristine`, `Worn`, `Damaged`, `Ruined`) alongside stack/magazine counts.

- **Interactive Component & State Mapping**:
  - **Viewport & Pointer Lock Handler**: Clicking the canvas locks the cursor and routes mouse deltas to camera yaw/pitch (or free-look head rotation when `Alt` is held). Pressing `V` toggles camera perspective; pressing `F` interacts with ground loot, doors, or campfires within reach.
  - **Inventory & Crafting Drawer (`Tab`)**: Releases Pointer Lock and renders nearby ground items, equipped clothing grids, and available crafting combinations. Dragging an item validates `W × H` cell collisions before committing placement; right-clicking provides context actions (*Bandage Wound*, *Eat/Drink*, *Tear into Rags*, *Load Magazine*, *Ignite Flare*).
  - **Map Overlay (`M`)**: Checks if the player has looted the *Topographic Island Map* item; if present, displays the 2km × 2km contour map with roads, coastal contours, and settlement names (*Zalivsk*, *Krasno*, *Pribor*, *Object-44*).
  - **Permadeath & Respawn Flow**: When `health <= 0` or `blood <= 0`, halts player input, displays the stark death summary (*"You are dead. Survived X min, killed Y."*), and provides a single action to respawn fresh on a random beach with a flare and a rag.
