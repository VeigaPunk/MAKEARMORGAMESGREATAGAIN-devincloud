import { Sfx, stepsFromBpm, type Song } from '@maga/arcade-core';
import type { ContentPack } from './packs';

/**
 * Per-pack audio — MAESTRO doctrine, zero binary assets. Each pack gets:
 * a title jingle, an escalating chapter bed (two rotating bass/lead
 * patterns A+B, bpm + drum intensity climb per chapter, boss adds heat),
 * a boss alarm sting, a chapter-clear fanfare, game-over/win stings, and
 * pack-flavored combat SFX via Sfx.registerPreset.
 */

interface BedNotes { bassA: number[]; bassB: number[]; leadA: number[]; leadB: number[] }

// A minor space march (replica) / C major kitchen bounce (cluck)
const BEDS: Record<ContentPack['id'], BedNotes> = {
  replica: {
    bassA: [110, 0, 110, 0, 164.81, 0, 110, 0, 130.81, 0, 130.81, 0, 98, 0, 110, 0],
    bassB: [87.31, 0, 87.31, 0, 130.81, 0, 87.31, 0, 110, 0, 110, 0, 164.81, 0, 146.83, 0],
    leadA: [440, 0, 523.25, 0, 659.25, 0, 587.33, 0, 440, 0, 392, 0, 523.25, 0, 0, 0],
    leadB: [659.25, 0, 587.33, 659.25, 783.99, 0, 659.25, 0, 587.33, 0, 523.25, 0, 440, 0, 0, 0],
  },
  cluck: {
    bassA: [130.81, 0, 164.81, 0, 196, 0, 174.61, 0, 130.81, 0, 164.81, 0, 196, 0, 98, 0],
    bassB: [174.61, 0, 220, 0, 196, 0, 174.61, 0, 164.81, 0, 146.83, 0, 130.81, 0, 0, 0],
    leadA: [523.25, 0, 659.25, 0, 783.99, 0, 659.25, 0, 523.25, 659.25, 523.25, 0, 392, 0, 0, 0],
    leadB: [659.25, 0, 698.46, 0, 783.99, 0, 880, 0, 783.99, 659.25, 587.33, 0, 523.25, 0, 0, 0],
  },
};

const DRUM_TIERS = [
  'k...s...k...s...',
  'k.h.s.h.k.h.s.h.',
  'k.hks.hkk.h.s.h.',
  'k.hks.hkk.hks.hk',
];

const JINGLES: Record<ContentPack['id'], number[]> = {
  replica: [440, 523.25, 659.25, 880, 659.25, 880, 1046.5, 0],
  cluck: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25, 0],
};

/** the looped chapter bed — pattern A+B rotate inside one loop; bpm, lead
 *  octave and drum tier escalate with the chapter (boss fights add heat) */
export function bedSong(pack: ContentPack, chapter: number, boss: boolean): Song {
  const bed = BEDS[pack.id];
  const bpm = Math.min(174, 108 + (chapter - 1) * 5 + (boss ? 10 : 0));
  const tier = Math.min(3, Math.floor((chapter - 1) / 3) + (boss ? 1 : 0));
  const shift = Math.floor((chapter - 1) / 3); // lead climbs an octave step per tier
  return {
    stepMs: stepsFromBpm(bpm),
    tracks: [
      { wave: 'square', notes: [...bed.leadA, ...bed.leadB], gain: 0.15, gate: 0.55, shift, lp: 2600 },
      { wave: 'triangle', notes: [...bed.bassA, ...bed.bassB], gain: 0.3, gate: 0.9 },
    ],
    drums: { steps: DRUM_TIERS[tier], gain: 0.5 },
  };
}

function melody(sfx: Sfx, notes: number[], stepMs: number, wave: 'square' | 'triangle' | 'sawtooth', vol: number): void {
  notes.forEach((f, i) => {
    if (!f) return;
    window.setTimeout(() => sfx.blip({ wave, freq: f, duration: stepMs / 1000 * 0.9, volume: vol }), i * stepMs);
  });
}

export interface ShmupAudio {
  /** pack-flavored combat presets (namespaced by pack id) */
  register(): void;
  jingle(): void;
  bossAlarm(): void;
  fanfare(): void;
  gameOver(): void;
  win(): void;
}

export function makeAudio(pack: ContentPack, sfx: Sfx): ShmupAudio {
  const id = pack.id;
  let jingleTimer = 0;

  return {
    register() {
      Sfx.registerPreset(`${id}-shoot`, (s) => {
        if (id === 'replica') s.blip({ wave: 'square', freq: 950, freqEnd: 260, duration: 0.06, volume: 0.35 });
        else s.blip({ wave: 'triangle', freq: 760, freqEnd: 300, duration: 0.07, volume: 0.4 });
      });
      Sfx.registerPreset(`${id}-gift`, (s) => {
        s.blip({ wave: 'square', freq: 523.25, freqEnd: 783.99, duration: 0.09, volume: 0.5 });
        window.setTimeout(() => s.blip({ wave: 'triangle', freq: 783.99, freqEnd: 1174.66, duration: 0.12, volume: 0.5 }), 90);
      });
      Sfx.registerPreset(`${id}-food`, (s) => {
        s.burst({ duration: 0.1, volume: 0.45, lp: 1200 });
        s.blip({ wave: 'square', freq: 220, freqEnd: 90, duration: 0.08, volume: 0.5 });
      });
      Sfx.registerPreset(`${id}-boom`, (s) => {
        s.burst({ duration: 0.55, volume: 0.8, lp: 800 });
        s.blip({ wave: 'sawtooth', freq: 110, freqEnd: 26, duration: 0.5, volume: 0.7 });
      });
      Sfx.registerPreset(`${id}-phit`, (s) => {
        s.blip({ wave: 'sawtooth', freq: 300, freqEnd: 36, duration: 0.45, volume: 0.8 });
        s.burst({ duration: 0.35, volume: 0.5, lp: 1500 });
      });
    },
    jingle() {
      const notes = JINGLES[id];
      const stepMs = 110;
      sfx.playSong({ stepMs, tracks: [{ wave: 'square', notes, gain: 0.2, gate: 0.8 }] });
      window.clearTimeout(jingleTimer);
      // playSong loops forever — stop it after one pass
      jingleTimer = window.setTimeout(() => sfx.stopMusic(), notes.length * stepMs + 200);
    },
    bossAlarm() {
      for (let i = 0; i < 6; i++) {
        window.setTimeout(() => sfx.blip({ wave: 'square', freq: i % 2 === 0 ? 880 : 622.25, duration: 0.09, volume: 0.55 }), i * 95);
      }
    },
    fanfare() {
      melody(sfx, [523.25, 659.25, 783.99, 1046.5], 105, 'square', 0.5);
      window.setTimeout(() => sfx.blip({ wave: 'triangle', freq: 1046.5, freqEnd: 1318.5, duration: 0.4, volume: 0.5 }), 420);
    },
    gameOver() {
      melody(sfx, [392, 329.63, 261.63, 196], 190, 'sawtooth', 0.55);
    },
    win() {
      melody(sfx, [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 0, 1318.5], 130, 'square', 0.5);
      window.setTimeout(() => sfx.burst({ duration: 0.6, volume: 0.4, lp: 3000 }), 1170);
    },
  };
}
