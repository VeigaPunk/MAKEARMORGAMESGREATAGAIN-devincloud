/**
 * Audio: SFX presets + per-screen music beds (arcade-core chip sequencer).
 * Menu = heroic 3/4, shop = jaunty 4/4, combat = tense minor 4/4.
 * All authored note arrays; loops are exact-length so playback wraps cleanly.
 */
import { Sfx, stepsFromBpm } from '@maga/arcade-core';

let registered = false;

export function registerAudioPresets(): void {
  if (registered) return;
  registered = true;
  Sfx.registerPreset('clank', s => {
    s.blip({ wave: 'square', freq: 1650, freqEnd: 900, duration: 0.06, volume: 0.5 });
    s.burst({ duration: 0.08, volume: 0.35, hp: 2400 });
  });
  Sfx.registerPreset('whoosh', s => {
    s.burst({ duration: 0.16, volume: 0.3, lp: 1200, hp: 300 });
  });
  Sfx.registerPreset('crunch', s => {
    s.burst({ duration: 0.22, volume: 0.7, lp: 900 });
    s.blip({ wave: 'sawtooth', freq: 160, freqEnd: 40, duration: 0.22, volume: 0.8 });
  });
  Sfx.registerPreset('glug', s => {
    s.blip({ wave: 'sine', freq: 300, freqEnd: 520, duration: 0.09, volume: 0.6 });
    window.setTimeout(() => s.blip({ wave: 'sine', freq: 260, freqEnd: 480, duration: 0.09, volume: 0.5 }), 110);
    window.setTimeout(() => s.blip({ wave: 'sine', freq: 230, freqEnd: 440, duration: 0.1, volume: 0.4 }), 220);
  });
  Sfx.registerPreset('coin', s => {
    s.blip({ wave: 'square', freq: 1180, duration: 0.06, volume: 0.5 });
    window.setTimeout(() => s.blip({ wave: 'square', freq: 1560, duration: 0.12, volume: 0.5 }), 70);
  });
  Sfx.registerPreset('roar', s => {
    s.burst({ duration: 0.7, volume: 0.5, lp: 700 });
    s.blip({ wave: 'sawtooth', freq: 90, freqEnd: 55, duration: 0.6, volume: 0.4 });
  });
  Sfx.registerPreset('ember', s => {
    s.burst({ duration: 0.3, volume: 0.45, lp: 2000 });
    s.blip({ wave: 'sawtooth', freq: 700, freqEnd: 120, duration: 0.3, volume: 0.5 });
  });
  Sfx.registerPreset('bowshot', s => {
    s.blip({ wave: 'triangle', freq: 900, freqEnd: 300, duration: 0.1, volume: 0.5 });
    s.burst({ duration: 0.06, volume: 0.25, hp: 3000 });
  });
  Sfx.registerPreset('taunt', s => {
    s.blip({ wave: 'square', freq: 420, freqEnd: 620, duration: 0.07, volume: 0.45 });
    window.setTimeout(() => s.blip({ wave: 'square', freq: 520, freqEnd: 760, duration: 0.09, volume: 0.45 }), 90);
  });
  Sfx.registerPreset('mend', s => {
    s.blip({ wave: 'triangle', freq: 520, freqEnd: 780, duration: 0.14, volume: 0.45 });
    window.setTimeout(() => s.blip({ wave: 'triangle', freq: 780, freqEnd: 1040, duration: 0.18, volume: 0.4 }), 140);
  });
  Sfx.registerPreset('warcry', s => {
    s.blip({ wave: 'sawtooth', freq: 190, freqEnd: 320, duration: 0.3, volume: 0.65 });
    s.burst({ duration: 0.25, volume: 0.3, lp: 600 });
  });
}

/* staff-position helper: A4=440; n semitones above A4 */
function N(n: number): number { return 440 * Math.pow(2, n / 12); }
/** note number from a scale degree pattern for compact authoring */
function seq(degrees: number[], root: number): number[] { return degrees.map(d => (d < 0 ? 0 : N(root + d))); }

// —— Menu: heroic waltz (3/4, 12 sixteenth-steps per bar) ——
// D minor → F → A → D lifts. Bass on beat 1, lead carrying the anthem.
const MENU_BASS = seq([0, -1, 0, -1, 0, -1, -5, -1, -5, -1, -7, -1,
  3, -1, 3, -1, 3, -1, -2, -1, -2, -1, -5, -1,
  7, -1, 7, -1, 7, -1, 5, -1, 5, -1, 3, -1,
  8, -1, 8, -1, 7, -1, 5, -1, 3, -1, 2, -1], -31);
const MENU_LEAD = seq([12, -1, 15, -1, 17, -1, 12, -1, -1, 15, -1, -1,
  17, -1, 20, -1, 19, -1, 17, -1, -1, -1, -1, -1,
  15, -1, 17, -1, 19, -1, 20, -1, -1, 24, -1, -1,
  23, -1, 20, -1, 17, -1, 19, -1, -1, -1, -1, -1], -31);
const MENU_DRUMS = 'k.h.s.h.k.h.h.h.k.h.s.h.k.h.h.h.k.h.s.h.k.h.hhhh';

// —— Shop: jaunty 4/4 major bounce ——
const SHOP_BASS = seq([0, -1, -1, 7, 0, -1, -1, 7, 5, -1, -1, 0, 5, -1, -1, 0], -19);
const SHOP_LEAD = seq([12, -1, 16, -1, 19, -1, 16, -1, 17, -1, 21, -1, 24, -1, 21, -1,
  19, -1, 16, -1, 12, -1, 16, -1, 14, -1, 17, -1, 12, -1, -1, -1], -19);
const SHOP_DRUMS = 'k.h.s.h.k.h.s.hk.h.s.h.k.hks.h';

// —— Combat: tense minor 4/4, driving ——
const COMBAT_BASS = seq([0, 0, -1, 0, 0, -1, 3, -1, 0, 0, -1, 0, -2, -1, -5, -1], -33);
const COMBAT_LEAD = seq([12, -1, 13, -1, 15, -1, 13, -1, 12, -1, 10, -1, 8, -1, 10, -1,
  12, -1, 13, -1, 15, -1, 18, -1, 17, -1, 15, -1, 13, -1, 12, -1], -33);
const COMBAT_DRUMS = 'k.hks.h.k.hks.hkk.hks.h.k.hks.hk';

// —— Victory fanfare: one-shot (not looped; short) ——
const FANFARE_LEAD = seq([0, 4, 7, 12, -1, 12, -1, 16, -1, 12], 0);

export type Bed = 'menu' | 'shop' | 'combat' | 'none';

export function playBed(sfx: Sfx, bed: Bed): void {
  if (bed === 'none') { sfx.stopMusic(); return; }
  if (bed === 'menu') {
    sfx.playSong({ stepMs: stepsFromBpm(132), tracks: [
      { wave: 'triangle', notes: MENU_BASS, gain: 0.26, gate: 0.85 },
      { wave: 'square', notes: MENU_LEAD, gain: 0.14, gate: 0.7, lp: 2600 },
    ], drums: { steps: MENU_DRUMS, gain: 0.4 } });
  } else if (bed === 'shop') {
    sfx.playSong({ stepMs: stepsFromBpm(126), tracks: [
      { wave: 'triangle', notes: SHOP_BASS, gain: 0.24, gate: 0.8 },
      { wave: 'square', notes: SHOP_LEAD, gain: 0.13, gate: 0.55, lp: 3000 },
    ], drums: { steps: SHOP_DRUMS, gain: 0.35 } });
  } else {
    sfx.playSong({ stepMs: stepsFromBpm(140), tracks: [
      { wave: 'sawtooth', notes: COMBAT_BASS, gain: 0.2, gate: 0.6, lp: 900 },
      { wave: 'square', notes: COMBAT_LEAD, gain: 0.12, gate: 0.55, lp: 2200 },
    ], drums: { steps: COMBAT_DRUMS, gain: 0.42 } });
  }
}

export function playFanfare(sfx: Sfx): void {
  sfx.stopMusic();
  sfx.playSong({ stepMs: 130, tracks: [
    { wave: 'square', notes: FANFARE_LEAD, gain: 0.2, gate: 0.9, lp: 3000 },
    { wave: 'triangle', notes: seq([0, -1, 0, -1, 0, -1, 0, -1, 0, -1], -12), gain: 0.22, gate: 0.8 },
  ], drums: { steps: 'k...s...k.k.s...', gain: 0.4 } });
}
