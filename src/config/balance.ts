export interface SettlementDef {
  id: string;
  name: string;
  subtitle: string;
  type: 'coastal_town' | 'inland_town' | 'industrial_town' | 'military_camp';
  center: [number, number]; // [x, z] in world meters (-1000 to +1000)
  radius: number;
  infectedCount: number;
}

export const BALANCE = {
  WORLD: {
    SIZE: 2000, // 2km x 2km (-1000 to +1000 on X and Z)
    HALF_SIZE: 1000,
    CHUNK_SIZE: 200, // 200m x 200m chunks (10x10 grid across island)
    STREAM_RADIUS: 1, // 3x3 chunks streamed around player (600m x 600m active detail)
    CHUNK_SEGMENTS: 40, // Vertex resolution per chunk
    WATER_LEVEL: 0.0,
    BEACH_HEIGHT: 2.8,
    MAX_HEIGHT: 58.0,
    TREES_PER_FOREST_CHUNK: 55,
    ROCKS_PER_CHUNK: 14,
    BUSHES_PER_CHUNK: 26,
    DAY_LENGTH_SECONDS: 480, // 8 minutes per full 24h cycle
    INITIAL_TIME_OF_DAY: 0.34, // Morning overcast (0..1, where 0.25 is dawn, 0.5 noon, 0.75 dusk)
    FOG_BASE_DENSITY: 0.0042,
    FOG_RAIN_DENSITY: 0.0085,
    FOG_NIGHT_DENSITY: 0.0072,
    WEATHER_CHECK_INTERVAL: 45, // seconds between weather shifts
    RAIN_CHANCE: 0.38,
  },

  SETTLEMENTS: [
    {
      id: 'zalivsk',
      name: 'Zalivsk',
      subtitle: 'Abandoned Southern Fishing Port',
      type: 'coastal_town',
      center: [-340, 460],
      radius: 135,
      infectedCount: 12,
    },
    {
      id: 'krasno',
      name: 'Krasno',
      subtitle: 'Central Collective Crossroads',
      type: 'inland_town',
      center: [80, 60],
      radius: 145,
      infectedCount: 14,
    },
    {
      id: 'pribor',
      name: 'Pribor',
      subtitle: 'Eastern Polyclinic & Timber Yard',
      type: 'industrial_town',
      center: [450, -180],
      radius: 130,
      infectedCount: 12,
    },
    {
      id: 'object44',
      name: 'Object-44',
      subtitle: 'Northern Coastal Radar Garrison',
      type: 'military_camp',
      center: [-180, -470],
      radius: 120,
      infectedCount: 15,
    },
  ] as SettlementDef[],

  PLAYER: {
    WALK_SPEED: 3.9, // m/s
    SPRINT_SPEED: 6.7, // m/s
    CROUCH_SPEED: 2.1, // m/s
    LIMP_SPEED_MULTIPLIER: 0.55,
    JUMP_VELOCITY: 5.8,
    GRAVITY: 16.5,
    EYE_HEIGHT_STAND: 1.72,
    EYE_HEIGHT_CROUCH: 1.02,
    THIRD_PERSON_DISTANCE: 3.4,
    THIRD_PERSON_HEIGHT: 0.55,
    THIRD_PERSON_RIGHT_OFFSET: 0.65,
    CAMERA_DAMPING: 12.0,
    MOUSE_SENSITIVITY: 0.0021,
    STAMINA_MAX: 100,
    STAMINA_SPRINT_DRAIN: 11.5, // per sec
    STAMINA_JUMP_COST: 16,
    STAMINA_MELEE_COST: 12,
    STAMINA_REGEN_IDLE: 14.0,
    STAMINA_REGEN_WALK: 7.5,
    NOISE_CROUCH: 3.5, // meters audible radius
    NOISE_WALK: 12.0,
    NOISE_SPRINT: 29.0,
    NOISE_JUMP: 18.0,
    FOOTSTEP_INTERVAL_WALK: 0.52,
    FOOTSTEP_INTERVAL_SPRINT: 0.33,
    FOOTSTEP_INTERVAL_CROUCH: 0.72,
    INTERACT_DISTANCE: 3.4,
  },

  SURVIVAL: {
    MAX_HEALTH: 100,
    MAX_BLOOD: 5000,
    MAX_HUNGER: 100, // 100 = full, 0 = starving
    MAX_THIRST: 100, // 100 = hydrated, 0 = dehydrated
    MAX_ENERGY: 100,
    NORMAL_TEMP: 37.0, // Celsius
    MIN_TEMP: 33.5,
    MAX_TEMP: 39.0,
    CHILLY_THRESHOLD: 36.1,
    HYPOTHERMIA_THRESHOLD: 35.3,
    CRITICAL_HUNGER: 22,
    CRITICAL_THIRST: 25,
    CRITICAL_BLOOD: 3000,
    CRITICAL_HEALTH: 35,
    CRITICAL_ENERGY: 20,

    // Decay rates per second (tuned so starvation/exposure is palpable in minutes)
    HUNGER_DECAY_BASE: 0.24,
    HUNGER_DECAY_SPRINT_MULT: 1.8,
    HUNGER_DECAY_COLD_MULT: 1.65, // shivering burns calories
    THIRST_DECAY_BASE: 0.34,
    THIRST_DECAY_SPRINT_MULT: 2.1,
    ENERGY_DECAY_BASE: 0.12,

    // Damage rates per second when depleted
    STARVATION_HEALTH_DRAIN: 0.85,
    DEHYDRATION_HEALTH_DRAIN: 1.15,
    HYPOTHERMIA_HEALTH_DRAIN: 0.95,
    BLEED_BLOOD_DRAIN_PER_CUT: 24.0, // ml/sec per cut
    BLEED_HEALTH_DRAIN_PER_CUT: 0.42, // hp/sec per cut
    LOW_BLOOD_HEALTH_DRAIN: 0.7, // when blood < 2500
    BLOOD_REGEN_WHEN_FED: 8.5, // ml/sec when hunger > 70 and thirst > 70
    HEALTH_REGEN_WHEN_FED: 0.35, // hp/sec when blood > 4200 and fed

    // Weather & Thermoregulation
    RAIN_WETNESS_GAIN: 3.2, // % per sec in rain outdoors
    SHELTER_DRY_RATE: 1.8, // % per sec under roof
    CAMPFIRE_DRY_RATE: 6.5, // % per sec near fire
    CAMPFIRE_WARM_RATE: 0.16, // °C per sec near fire
    CAMPFIRE_RADIUS: 6.0,
    BASE_COOLING_NIGHT: 0.032, // °C per sec
    BASE_COOLING_RAIN: 0.045,
    WETNESS_COOLING_FACTOR: 0.065, // additional °C loss at 100% wetness
    SPRINT_WARMING_RATE: 0.022,
  },

  AI: {
    MAX_ACTIVE_ZOMBIES: 40,
    SPAWN_RADIUS_MIN: 32,
    SPAWN_RADIUS_MAX: 155,
    DESPAWN_RADIUS: 185,
    WANDER_SPEED: 1.45,
    ALERT_INVESTIGATE_SPEED: 2.5,
    CHASE_SPEED: 5.15,
    SIGHT_RANGE_DAY: 34,
    SIGHT_RANGE_NIGHT: 19,
    SIGHT_FOV_COS: 0.35, // ~138 degree cone
    HEARING_SENSITIVITY: 1.15,
    ATTACK_RANGE: 1.85,
    ATTACK_INTERVAL: 1.35,
    ATTACK_DAMAGE: 13,
    BLEED_CHANCE_ON_HIT: 0.58,
    CLOTHING_DAMAGE_CHANCE: 0.45,
    LOS_MEMORY_SECONDS: 7.5, // how long they keep chasing after losing sight & sound
  },

  COMBAT: {
    WEAPONS: {
      fists: {
        name: 'Bare Hands',
        type: 'melee' as const,
        damage: 14,
        range: 2.1,
        cooldown: 0.55,
        noiseRadius: 4,
        staminaCost: 8,
        recoilPitch: 0.02,
      },
      pipe: {
        name: 'Lead Plumbing Pipe',
        type: 'melee' as const,
        damage: 34,
        range: 2.45,
        cooldown: 0.78,
        noiseRadius: 8,
        staminaCost: 13,
        recoilPitch: 0.04,
      },
      axe: {
        name: 'Firefighter Splitting Axe',
        type: 'melee' as const,
        damage: 58,
        range: 2.65,
        cooldown: 0.92,
        noiseRadius: 10,
        staminaCost: 16,
        recoilPitch: 0.05,
      },
      ij70: {
        name: 'IJ-70 9x18mm Service Pistol',
        type: 'firearm' as const,
        ammoId: 'ammo_9x18',
        magId: 'mag_ij70',
        magCapacity: 12,
        damage: 46,
        range: 95,
        cooldown: 0.24,
        noiseRadius: 115,
        staminaCost: 0,
        recoilPitch: 0.065,
        recoilYaw: 0.025,
      },
      sk59: {
        name: 'SK-59/66 7.62x39mm Carbine',
        type: 'firearm' as const,
        ammoId: 'ammo_762',
        magId: 'mag_sk59',
        magCapacity: 10,
        damage: 88,
        range: 190,
        cooldown: 0.36,
        noiseRadius: 175,
        staminaCost: 0,
        recoilPitch: 0.11,
        recoilYaw: 0.038,
      },
    },
  },
};
