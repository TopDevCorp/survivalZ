class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private isMuted = false;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupAmbientLoop();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupAmbientLoop() {
    if (!this.ctx) return;

    // Create 3-second noise buffer for wind and rain
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Baltic coastal wind (low-passed noise)
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 240;
    windFilter.Q.value = 2.5;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.035;

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    windSource.start();

    // Rain patter (high-passed noise)
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1800;
    rainFilter.Q.value = 0.9;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0;

    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.ctx.destination);
    rainSource.start();
  }

  public updateAmbience(isRaining: boolean, isIndoors: boolean, altitude: number) {
    if (!this.ctx || !this.windGain || !this.rainGain) return;
    const now = this.ctx.currentTime;
    const shelterMult = isIndoors ? 0.35 : 1.0;
    const windTarget = this.isMuted ? 0 : Math.min(0.08, (0.028 + altitude * 0.0006) * shelterMult);
    const rainTarget = this.isMuted ? 0 : isRaining ? 0.065 * shelterMult : 0;

    this.windGain.gain.setTargetAtTime(windTarget, now, 0.4);
    this.rainGain.gain.setTargetAtTime(rainTarget, now, 0.4);
  }

  public playFootstep(surface: 'sand' | 'grass' | 'road' | 'indoor' | 'water', stance: 'crouch' | 'walk' | 'sprint') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = surface === 'water' ? 0.16 : 0.085;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 1.8);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    if (surface === 'indoor') {
      filter.type = 'lowpass';
      filter.frequency.value = 340 + Math.random() * 60;
    } else if (surface === 'road') {
      filter.type = 'bandpass';
      filter.frequency.value = 950 + Math.random() * 140;
    } else if (surface === 'sand') {
      filter.type = 'bandpass';
      filter.frequency.value = 1400 + Math.random() * 200;
    } else if (surface === 'water') {
      filter.type = 'bandpass';
      filter.frequency.value = 720 + Math.random() * 180;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 620 + Math.random() * 120;
    }

    const gain = ctx.createGain();
    const vol = stance === 'crouch' ? 0.025 : stance === 'walk' ? 0.065 : 0.12;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playGunshot(caliber: '9x18' | '762') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = caliber === '762' ? 0.42 : 0.26;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const crack = t < 0.06 ? 1.0 : Math.pow(1 - t, 2.6);
      data[i] = (Math.random() * 2 - 1) * crack;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(caliber === '762' ? 2600 : 3200, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(caliber === '762' ? 0.34 : 0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playMeleeSwing(heavy: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(heavy ? 170 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playHitImpact() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playZombieGroan(distance: number) {
    const ctx = this.ensureContext();
    if (!ctx || distance > 38) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const baseFreq = 85 + Math.random() * 35;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.18, now + 0.18);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.78, now + 0.48);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 3.2;

    const distAtten = Math.max(0.01, (1 - distance / 40) * 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(distAtten, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  public playUiSound(type: 'pickup' | 'bandage' | 'craft' | 'empty') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'pickup') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.07);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'empty') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(680, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(310, now + 0.16);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.windGain && this.rainGain && this.ctx) {
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const soundEngine = new ProceduralSoundEngine();
