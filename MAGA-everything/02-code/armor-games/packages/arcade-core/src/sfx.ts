/**
 * WebAudio synth — SFX + music engine, zero binary assets (MAESTRO doctrine).
 *
 * Two layers:
 *  1. `blip()` / `preset()` — short envelope one-shots (retro SFX).
 *  2. `playSong(song)` — a lookahead-scheduled multi-voice chip sequencer:
 *     square/lead tracks + a noise drum channel, 16th-note steps, loops.
 *     `startMusic(notes, stepMs)` (legacy single-voice API) maps onto it.
 *
 * Master chain: voices → sfxGain/musicGain → masterGain → destination.
 * `volume` (0..1) and `muted` affect everything live.
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

/** one melodic voice of a song; notes are Hz, 0 = rest */
export interface SongTrack {
  wave: Wave;
  notes: number[];
  /** gain multiplier (default .22) */
  gain?: number;
  /** note length as a fraction of a step (default .9) */
  gate?: number;
  /** lowpass cutoff in Hz (0 = off) */
  lp?: number;
  /** transpose in semitones (applied to every note) */
  shift?: number;
}

/** drum channel: one char per step — k=kick s=snare h=hat . = rest */
export interface DrumTrack {
  steps: string;
  gain?: number;
}

export interface Song {
  /** milliseconds per 16th-note step (60000 / bpm / 4) */
  stepMs: number;
  tracks: SongTrack[];
  drums?: DrumTrack;
}

/** milliseconds per 16th-note step at a given BPM */
export function stepsFromBpm(bpmValue: number): number {
  return 60000 / bpmValue / 4;
}

/** frequency transposed by semitones (equal temperament) */
function semitone(n: number, shift: number): number {
  return n * Math.pow(2, shift / 12);
}

/** window.setInterval handle (DOM) */
export type TimerId = number;

import { load, save } from './storage';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  /** persisted mute (merged from origin's parallel improvement) */
  private _muted = load('arcade', 'muted', false);
  get muted(): boolean { return this._muted; }
  set muted(v: boolean) { this._muted = v; save('arcade', 'muted', v); this.applyMaster(); }
  private _volume = 0.5;

  /** master volume 0..1 — live */
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.applyMaster();
  }
  get volume(): number { return this._volume; }

  private applyMaster(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this._volume, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(m: boolean): void { this.muted = m; this.applyMaster(); }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.9;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 1;
        this.sfxGain.connect(this.master);
        this.applyMaster();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noise(): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /** short envelope blip — the atomic unit of retro sound */
  blip(opts: BlipOptions = {}): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const { wave = 'square', freq = 440, freqEnd = freq, duration = 0.08, volume = 1 } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** noise burst — hits, explosions, percussion (SFX side) */
  burst(opts: { duration?: number; volume?: number; lp?: number; hp?: number; freq?: number; freqEnd?: number } = {}): void {
    if (this.muted) return;
    const ctx = this.ensure();
    const buf = this.noise();
    if (!ctx || !buf || !this.sfxGain) return;
    const { duration = 0.15, volume = 0.6, lp = 0, hp = 0 } = opts;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    let node: AudioNode = src;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    node.connect(gain).connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /** named presets; games may add their own via registerPreset */
  preset(name: 'shoot' | 'hit' | 'pickup' | 'death' | 'ui' | string): void {
    const custom = Sfx.customPresets[name];
    if (custom) { custom(this); return; }
    switch (name) {
      case 'shoot': this.blip({ wave: 'square', freq: 880, freqEnd: 220, duration: 0.07 }); break;
      case 'hit': this.blip({ wave: 'sawtooth', freq: 200, freqEnd: 60, duration: 0.12 }); break;
      case 'pickup': this.blip({ wave: 'triangle', freq: 660, freqEnd: 1320, duration: 0.09 }); break;
      case 'death': this.blip({ wave: 'sawtooth', freq: 320, freqEnd: 40, duration: 0.4, volume: 0.8 }); break;
      case 'ui': this.blip({ wave: 'square', freq: 520, freqEnd: 700, duration: 0.05, volume: 0.6 }); break;
      case 'explode': this.burst({ duration: 0.5, volume: 0.7, lp: 900 }); this.blip({ wave: 'sawtooth', freq: 120, freqEnd: 30, duration: 0.4, volume: 0.7 }); break;
      case 'missile': this.burst({ duration: 0.3, volume: 0.4, hp: 800 }); this.blip({ wave: 'sawtooth', freq: 300, freqEnd: 900, duration: 0.25, volume: 0.4 }); break;
    }
  }

  static customPresets: Record<string, (s: Sfx) => void> = {};
  static registerPreset(name: string, fn: (s: Sfx) => void): void { Sfx.customPresets[name] = fn; }

  // --- music: lookahead chip sequencer ----------------------------------------

  private timer: TimerId | null = null;
  private step = 0;
  private nextTime = 0;
  private song: Song | null = null;

  /**
   * Legacy single-voice API (kept for existing callers): wraps the notes in a
   * one-track Song. `stepMs` is the per-note interval.
   */
  startMusic(notes: number[], stepMs = 140, opts: BlipOptions = {}): void {
    this.playSong({ stepMs, tracks: [{ wave: opts.wave ?? 'triangle', notes, gain: 0.3 }] });
  }

  /** Start a looping multi-voice song. Replaces any current song. */
  playSong(song: Song): void {
    this.stopMusic();
    this.song = song;
    this.step = 0;
    const ctx = this.ensure();
    if (!ctx) return;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.pump(), 25);
    this.pump();
  }

  stopMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.song = null;
  }

  get musicPlaying(): boolean { return this.song !== null; }

  /** schedule ahead ~120ms; skipped while the context is suspended (no gesture yet) */
  private pump(): void {
    const ctx = this.ctx;
    const song = this.song;
    if (!ctx || !song || !this.musicGain) return;
    if (ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 0.12;
    while (this.nextTime < horizon) {
      this.scheduleStep(song, this.step, this.nextTime);
      this.step += 1;
      this.nextTime += song.stepMs / 1000;
    }
  }

  private scheduleStep(song: Song, step: number, t: number): void {
    const ctx = this.ctx!;
    const len = song.tracks.reduce((m, tr) => Math.max(m, tr.notes.length), song.drums ? song.drums.steps.length : 0);
    if (len === 0) return;
    const s = step % len;
    for (const tr of song.tracks) {
      const f0 = tr.notes[s % tr.notes.length];
      if (!f0) continue;
      const freq = semitone(f0, tr.shift ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tr.wave;
      osc.frequency.setValueAtTime(freq, t);
      const dur = (song.stepMs / 1000) * (tr.gate ?? 0.9);
      const g = tr.gain ?? 0.22;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(g, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node: AudioNode = osc;
      if (tr.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = tr.lp; node.connect(f); node = f; }
      node.connect(gain).connect(this.musicGain!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    if (song.drums) {
      const ch = song.drums.steps[s % song.drums.steps.length];
      const dg = song.drums.gain ?? 0.5;
      if (ch === 'k') this.drumKick(t, dg);
      else if (ch === 's') this.drumSnare(t, dg * 0.7);
      else if (ch === 'h') this.drumHat(t, dg * 0.35);
    }
  }

  private drumKick(t: number, g: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(g, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(this.musicGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private drumSnare(t: number, g: number): void {
    const ctx = this.ctx!;
    const buf = this.noise();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(g, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(gain).connect(this.musicGain!);
    src.start(t);
    src.stop(t + 0.1);
  }

  private drumHat(t: number, g: number): void {
    const ctx = this.ctx!;
    const buf = this.noise();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(g, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(f).connect(gain).connect(this.musicGain!);
    src.start(t);
    src.stop(t + 0.05);
  }
}
