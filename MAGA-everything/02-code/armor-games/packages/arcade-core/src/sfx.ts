/**
 * WebAudio synth SFX — zero binary assets, 8-bit envelope style.
 * MAESTRO owns the per-title recipes; this is the rendering engine.
 */

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export interface BlipOptions {
  wave?: Wave;
  /** Hz */
  freq?: number;
  freqEnd?: number;
  /** seconds */
  duration?: number;
  volume?: number;
}

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;
  volume = 0.5;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** short envelope blip — the atomic unit of retro sound */
  blip(opts: BlipOptions = {}): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const { wave = 'square', freq = 440, freqEnd = freq, duration = 0.08, volume = 1 } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(this.volume * volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  /** named presets — extend per title with MAESTRO's spec */
  preset(name: 'shoot' | 'hit' | 'pickup' | 'death' | 'ui'): void {
    switch (name) {
      case 'shoot': this.blip({ wave: 'square', freq: 880, freqEnd: 220, duration: 0.07 }); break;
      case 'hit': this.blip({ wave: 'sawtooth', freq: 200, freqEnd: 60, duration: 0.12 }); break;
      case 'pickup': this.blip({ wave: 'triangle', freq: 660, freqEnd: 1320, duration: 0.09 }); break;
      case 'death': this.blip({ wave: 'sawtooth', freq: 320, freqEnd: 40, duration: 0.4, volume: 0.8 }); break;
      case 'ui': this.blip({ wave: 'square', freq: 520, freqEnd: 700, duration: 0.05, volume: 0.6 }); break;
    }
  }

  // --- music slot (BH-3.2 MAESTRO drop zone) ----------------------------------
  private musicTimer: number | null = null;
  private musicStep = 0;

  /**
   * Loop a step sequence of notes (Hz; 0 = rest). This is the music SLOT —
   * MAESTRO replaces the pattern per title; games only call start/stop.
   * Honors `muted` live: muting silences the next scheduled step.
   */
  startMusic(notes: number[], stepMs = 140, opts: BlipOptions = {}): void {
    this.stopMusic();
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      const f = notes[this.musicStep % notes.length];
      this.musicStep += 1;
      if (f > 0) this.blip({ wave: 'triangle', freq: f, duration: stepMs / 1000 * 0.9, volume: 0.35, ...opts });
    }, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
