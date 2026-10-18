import { BALANCE } from '../config/balance';

export interface SurvivalStats {
  health: number;
  blood: number;
  hunger: number;
  thirst: number;
  temperature: number;
  energy: number;
  wetness: number;
  stamina: number;
  bleedingCuts: number;
  hasFracture: boolean;
  isIndoors: boolean;
  nearCampfire: boolean;
  isShivering: boolean;
  survivedSeconds: number;
  infectedKilled: number;
  isDead: boolean;
  causeOfDeath: string;
}

export interface SensoryMessage {
  id: string;
  text: string;
  severity: 'normal' | 'warning' | 'critical';
  timestamp: number;
}

export class SurvivalSystem {
  public stats: SurvivalStats;
  public messages: SensoryMessage[] = [];
  private lastAlertTimers: Record<string, number> = {};

  constructor() {
    this.stats = this.createFreshStats();
  }

  public createFreshStats(): SurvivalStats {
    return {
      health: BALANCE.SURVIVAL.MAX_HEALTH,
      blood: BALANCE.SURVIVAL.MAX_BLOOD,
      hunger: 78, // Start slightly hungry on the beach
      thirst: 74, // Start slightly thirsty
      temperature: 36.8,
      energy: 92,
      wetness: 18, // Damp from washing ashore
      stamina: BALANCE.PLAYER.STAMINA_MAX,
      bleedingCuts: 0,
      hasFracture: false,
      isIndoors: false,
      nearCampfire: false,
      isShivering: false,
      survivedSeconds: 0,
      infectedKilled: 0,
      isDead: false,
      causeOfDeath: '',
    };
  }

  public resetForRespawn() {
    this.stats = this.createFreshStats();
    this.messages = [];
    this.lastAlertTimers = {};
    this.pushMessage('You wake up cold on the gravel shoreline.', 'normal');
  }

  public pushMessage(text: string, severity: 'normal' | 'warning' | 'critical' = 'normal', cooldownKey?: string) {
    const now = performance.now() / 1000;
    if (cooldownKey) {
      const prev = this.lastAlertTimers[cooldownKey] || 0;
      if (now - prev < 22) return; // Don't spam identical sensory messages
      this.lastAlertTimers[cooldownKey] = now;
    }

    this.messages.unshift({
      id: `${Date.now()}_${Math.random()}`,
      text,
      severity,
      timestamp: Date.now(),
    });
    if (this.messages.length > 6) {
      this.messages.length = 6;
    }
  }

  public applyDamage(amount: number, causesBleed: boolean, sourceLabel = 'Infected wound') {
    if (this.stats.isDead) return;
    this.stats.health = Math.max(0, this.stats.health - amount);
    if (causesBleed) {
      this.stats.bleedingCuts = Math.min(4, this.stats.bleedingCuts + 1);
      this.pushMessage('Warm blood runs from a fresh laceration.', 'critical', 'bleed_hit');
    }
    if (this.stats.health <= 0) {
      this.stats.isDead = true;
      this.stats.causeOfDeath = sourceLabel;
    }
  }

  public useBandageOrRag(itemName: string): boolean {
    if (this.stats.bleedingCuts <= 0) {
      this.pushMessage('You have no open wounds to bandage.', 'normal');
      return false;
    }
    this.stats.bleedingCuts = Math.max(0, this.stats.bleedingCuts - 1);
    this.pushMessage(`You bind the wound tightly with a ${itemName.toLowerCase()}.`, 'normal');
    return true;
  }

  public useSalineBag(): boolean {
    if (this.stats.blood >= BALANCE.SURVIVAL.MAX_BLOOD - 50) {
      this.pushMessage('Your blood volume is already stable.', 'normal');
      return false;
    }
    this.stats.blood = Math.min(BALANCE.SURVIVAL.MAX_BLOOD, this.stats.blood + 1200);
    this.stats.thirst = Math.min(100, this.stats.thirst + 15);
    this.pushMessage('Cold saline courses into your veins. Color returns to your hands.', 'normal');
    return true;
  }

  public useSplint(): boolean {
    if (!this.stats.hasFracture) {
      this.pushMessage('Your limbs do not need a splint right now.', 'normal');
      return false;
    }
    this.stats.hasFracture = false;
    this.pushMessage('You immobilize your leg with the wooden splint.', 'normal');
    return true;
  }

  public consumeNutrition(foodGain: number, waterGain: number, healthGain: number, tempGain: number, label: string) {
    this.stats.hunger = Math.min(100, this.stats.hunger + foodGain);
    this.stats.thirst = Math.min(100, this.stats.thirst + waterGain);
    this.stats.health = Math.min(100, this.stats.health + healthGain);
    this.stats.temperature = Math.min(BALANCE.SURVIVAL.MAX_TEMP, this.stats.temperature + tempGain);
    this.stats.energy = Math.min(100, this.stats.energy + foodGain * 0.35);
    this.pushMessage(`You consume the ${label.toLowerCase()}.`, 'normal');
  }

  public update(
    dt: number,
    context: {
      isSprinting: boolean;
      isMoving: boolean;
      isRaining: boolean;
      isNight: boolean;
      isIndoors: boolean;
      nearCampfire: boolean;
      inWater: boolean;
      clothingInsulation: number; // 0..1
    }
  ) {
    if (this.stats.isDead) return;

    this.stats.survivedSeconds += dt;
    this.stats.isIndoors = context.isIndoors;
    this.stats.nearCampfire = context.nearCampfire;

    // 1. Wetness calculation
    if (context.inWater) {
      this.stats.wetness = Math.min(100, this.stats.wetness + dt * 25.0);
    } else if (context.isRaining && !context.isIndoors) {
      this.stats.wetness = Math.min(100, this.stats.wetness + dt * BALANCE.SURVIVAL.RAIN_WETNESS_GAIN);
    } else if (context.nearCampfire) {
      this.stats.wetness = Math.max(0, this.stats.wetness - dt * BALANCE.SURVIVAL.CAMPFIRE_DRY_RATE);
    } else if (context.isIndoors) {
      this.stats.wetness = Math.max(0, this.stats.wetness - dt * BALANCE.SURVIVAL.SHELTER_DRY_RATE);
    } else {
      this.stats.wetness = Math.max(0, this.stats.wetness - dt * 0.65);
    }

    // 2. Thermoregulation (Rain -> Wet -> Cold -> Health Drain)
    const wetNorm = this.stats.wetness / 100;
    let tempDelta = 0;

    if (context.nearCampfire) {
      tempDelta += BALANCE.SURVIVAL.CAMPFIRE_WARM_RATE;
      this.pushMessage('You feel warmth radiating from the campfire.', 'normal', 'campfire_warm');
    } else {
      const envCooling =
        (context.isNight ? BALANCE.SURVIVAL.BASE_COOLING_NIGHT : 0.012) +
        (context.isRaining && !context.isIndoors ? BALANCE.SURVIVAL.BASE_COOLING_RAIN : 0) +
        wetNorm * BALANCE.SURVIVAL.WETNESS_COOLING_FACTOR;

      const insulationProtection = 0.25 + context.clothingInsulation * 0.55 + (context.isIndoors ? 0.35 : 0);
      const netCooling = Math.max(0, envCooling * (1.15 - insulationProtection));
      tempDelta -= netCooling;

      if (context.isSprinting) {
        tempDelta += BALANCE.SURVIVAL.SPRINT_WARMING_RATE;
      } else if (this.stats.wetness < 20 && context.isIndoors && this.stats.temperature < 36.8) {
        tempDelta += 0.025; // Slowly warm toward normal indoors when dry
      }
    }

    this.stats.temperature = Math.max(
      BALANCE.SURVIVAL.MIN_TEMP,
      Math.min(BALANCE.SURVIVAL.MAX_TEMP, this.stats.temperature + tempDelta * dt)
    );

    this.stats.isShivering = this.stats.temperature < BALANCE.SURVIVAL.CHILLY_THRESHOLD;

    // 3. Hunger, Thirst & Energy decay
    const sprintHungerMult = context.isSprinting ? BALANCE.SURVIVAL.HUNGER_DECAY_SPRINT_MULT : 1.0;
    const coldHungerMult = this.stats.isShivering ? BALANCE.SURVIVAL.HUNGER_DECAY_COLD_MULT : 1.0;
    const sprintThirstMult = context.isSprinting ? BALANCE.SURVIVAL.THIRST_DECAY_SPRINT_MULT : 1.0;

    this.stats.hunger = Math.max(
      0,
      this.stats.hunger - BALANCE.SURVIVAL.HUNGER_DECAY_BASE * sprintHungerMult * coldHungerMult * dt
    );
    this.stats.thirst = Math.max(
      0,
      this.stats.thirst - BALANCE.SURVIVAL.THIRST_DECAY_BASE * sprintThirstMult * dt
    );
    this.stats.energy = Math.max(
      0,
      this.stats.energy - BALANCE.SURVIVAL.ENERGY_DECAY_BASE * (context.isSprinting ? 1.7 : 1.0) * dt
    );

    // 4. Bleeding & Vital Organ Drain
    if (this.stats.bleedingCuts > 0) {
      this.stats.blood = Math.max(
        0,
        this.stats.blood - this.stats.bleedingCuts * BALANCE.SURVIVAL.BLEED_BLOOD_DRAIN_PER_CUT * dt
      );
      this.stats.health = Math.max(
        0,
        this.stats.health - this.stats.bleedingCuts * BALANCE.SURVIVAL.BLEED_HEALTH_DRAIN_PER_CUT * dt
      );
      this.pushMessage('You are losing blood from an untreated wound.', 'critical', 'bleed_tick');
    }

    if (this.stats.hunger <= 0) {
      this.stats.health = Math.max(0, this.stats.health - BALANCE.SURVIVAL.STARVATION_HEALTH_DRAIN * dt);
      this.pushMessage('You are starving to death.', 'critical', 'starve_crit');
    } else if (this.stats.hunger < BALANCE.SURVIVAL.CRITICAL_HUNGER) {
      this.pushMessage('You feel hungry.', 'warning', 'hungry_warn');
    }

    if (this.stats.thirst <= 0) {
      this.stats.health = Math.max(0, this.stats.health - BALANCE.SURVIVAL.DEHYDRATION_HEALTH_DRAIN * dt);
      this.pushMessage('You are dying of dehydration.', 'critical', 'thirst_crit');
    } else if (this.stats.thirst < BALANCE.SURVIVAL.CRITICAL_THIRST) {
      this.pushMessage('You feel thirsty.', 'warning', 'thirst_warn');
    }

    if (this.stats.temperature < BALANCE.SURVIVAL.HYPOTHERMIA_THRESHOLD) {
      this.stats.health = Math.max(0, this.stats.health - BALANCE.SURVIVAL.HYPOTHERMIA_HEALTH_DRAIN * dt);
      this.pushMessage('You are freezing. Hypothermia is draining your life.', 'critical', 'hypo_crit');
    } else if (this.stats.isShivering) {
      this.pushMessage('You are shivering from the cold.', 'warning', 'chilly_warn');
    }

    if (this.stats.wetness > 65) {
      this.pushMessage('Your clothes are soaked through.', 'warning', 'soaked_warn');
    }

    if (this.stats.blood < 2500) {
      this.stats.health = Math.max(0, this.stats.health - BALANCE.SURVIVAL.LOW_BLOOD_HEALTH_DRAIN * dt);
    }

    // Natural recovery when well-fed, hydrated, warm, and not bleeding
    if (
      this.stats.bleedingCuts === 0 &&
      this.stats.hunger > 65 &&
      this.stats.thirst > 65 &&
      this.stats.temperature >= 36.1
    ) {
      this.stats.blood = Math.min(
        BALANCE.SURVIVAL.MAX_BLOOD,
        this.stats.blood + BALANCE.SURVIVAL.BLOOD_REGEN_WHEN_FED * dt
      );
      if (this.stats.blood > 4000) {
        this.stats.health = Math.min(
          BALANCE.SURVIVAL.MAX_HEALTH,
          this.stats.health + BALANCE.SURVIVAL.HEALTH_REGEN_WHEN_FED * dt
        );
      }
    }

    // Check Permadeath
    if (this.stats.health <= 0 || this.stats.blood <= 0) {
      this.stats.isDead = true;
      if (!this.stats.causeOfDeath) {
        if (this.stats.blood <= 0) this.stats.causeOfDeath = 'Exsanguination (Blood Loss)';
        else if (this.stats.temperature < BALANCE.SURVIVAL.HYPOTHERMIA_THRESHOLD)
          this.stats.causeOfDeath = 'Severe Hypothermia';
        else if (this.stats.thirst <= 0) this.stats.causeOfDeath = 'Terminal Dehydration';
        else if (this.stats.hunger <= 0) this.stats.causeOfDeath = 'Starvation';
        else this.stats.causeOfDeath = 'Organ Failure';
      }
    }
  }
}
