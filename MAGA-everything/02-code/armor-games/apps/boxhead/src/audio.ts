import { Sfx, stepsFromBpm, type Song } from '@maga/arcade-core';

/**
 * MAESTRO recipe set for BLOCKHEAD: ARENA NIGHTS —
 * boxhead-2play-recipes.json + boxhead-2play-sound-bible.md, mapped onto the
 * arcade-core synth (blip / burst / preset; bandpass approximated by
 * lp+hp pairs, pink noise by low-passed white). Zero binary assets.
 */

/** rising/falling arpeggio sting — UI blips spaced with timers */
function arp(sfx: Sfx, freqs: number[], spacingMs: number, opts: { wave?: 'square' | 'sawtooth' | 'triangle'; volume: number; duration?: number; freqEnd?: number }): void {
  freqs.forEach((f, i) => {
    window.setTimeout(() => {
      sfx.blip({
        wave: opts.wave ?? 'square',
        freq: f,
        freqEnd: opts.freqEnd ?? f,
        duration: opts.duration ?? 0.09,
        volume: opts.volume,
      });
    }, i * spacingMs);
  });
}

export function registerBoxheadPresets(): void {
  const reg = Sfx.registerPreset;

  // --- player weapons (mix 0.22–0.35) ---
  reg('bh.pistol', (s) => {
    s.blip({ wave: 'square', freq: 420, freqEnd: 180, duration: 0.07, volume: 0.28 });
    s.burst({ duration: 0.06, volume: 0.2, lp: 3400, hp: 400 });
  });
  reg('bh.uzi', (s) => {
    s.blip({ wave: 'square', freq: 880, freqEnd: 440, duration: 0.035, volume: 0.2 });
    s.burst({ duration: 0.03, volume: 0.1, hp: 2500 });
  });
  reg('bh.shotgun', (s) => {
    s.burst({ duration: 0.13, volume: 0.34, lp: 2400 });
    s.blip({ wave: 'sawtooth', freq: 90, freqEnd: 50, duration: 0.12, volume: 0.3 });
  });
  reg('bh.gthrow', (s) => s.blip({ wave: 'square', freq: 220, freqEnd: 160, duration: 0.06, volume: 0.14 }));
  reg('bh.gboom', (s) => {
    s.blip({ wave: 'sawtooth', freq: 100, freqEnd: 40, duration: 0.38, volume: 0.36 });
    s.burst({ duration: 0.35, volume: 0.5, lp: 900 });
  });
  reg('bh.rfire', (s) => {
    s.burst({ duration: 0.25, volume: 0.3, hp: 300 });
    s.blip({ wave: 'sawtooth', freq: 200, freqEnd: 700, duration: 0.25, volume: 0.2 });
  });
  reg('bh.rboom', (s) => {
    s.blip({ wave: 'sawtooth', freq: 120, freqEnd: 32, duration: 0.5, volume: 0.4 });
    s.burst({ duration: 0.5, volume: 0.6, lp: 800 });
  });
  reg('bh.dry', (s) => s.blip({ wave: 'square', freq: 180, duration: 0.025, volume: 0.1 }));

  // --- world / pickups (mix 0.25–0.40) ---
  reg('bh.barrel', (s) => {
    s.blip({ wave: 'sawtooth', freq: 110, freqEnd: 38, duration: 0.42, volume: 0.38 });
    s.burst({ duration: 0.45, volume: 0.55, lp: 800 });
  });
  reg('bh.pickup', (s) => s.blip({ wave: 'square', freq: 660, freqEnd: 990, duration: 0.09, volume: 0.16 }));

  // --- player damage (mix 0.18–0.28) ---
  reg('bh.hurt', (s) => {
    s.burst({ duration: 0.09, volume: 0.24, lp: 1800, hp: 300 });
    s.blip({ wave: 'sawtooth', freq: 300, freqEnd: 120, duration: 0.08, volume: 0.18 });
  });
  reg('bh.pdeath', (s) => {
    s.blip({ wave: 'sawtooth', freq: 140, freqEnd: 45, duration: 0.5, volume: 0.32 });
    s.burst({ duration: 0.4, volume: 0.4, lp: 700 });
  });

  // --- enemies (mix 0.18–0.28) ---
  reg('bh.zhit', (s) => {
    s.burst({ duration: 0.05, volume: 0.18, lp: 1000 });
    s.blip({ wave: 'square', freq: 200, freqEnd: 120, duration: 0.04, volume: 0.12 });
  });
  reg('bh.zdeath', (s) => {
    s.blip({ wave: 'sawtooth', freq: 160, freqEnd: 70, duration: 0.11, volume: 0.22 });
    s.burst({ duration: 0.1, volume: 0.28, lp: 900 });
  });
  reg('bh.zattack', (s) => {
    s.blip({ wave: 'sawtooth', freq: 180, freqEnd: 90, duration: 0.08, volume: 0.2 });
    s.burst({ duration: 0.06, volume: 0.12, hp: 600 });
  });
  reg('bh.dspawn', (s) => {
    s.blip({ wave: 'square', freq: 200, freqEnd: 600, duration: 0.28, volume: 0.22 });
    s.blip({ wave: 'triangle', freq: 620, freqEnd: 560, duration: 0.2, volume: 0.1 });
  });
  reg('bh.ddeath', (s) => s.blip({ wave: 'square', freq: 600, freqEnd: 120, duration: 0.32, volume: 0.22 }));
  reg('bh.dfire', (s) => {
    s.burst({ duration: 0.18, volume: 0.22, lp: 1400 });
    s.blip({ wave: 'sawtooth', freq: 240, freqEnd: 110, duration: 0.18, volume: 0.18 });
  });

  // --- UI (mix 0.12–0.18) ---
  reg('ui.move', (s) => s.blip({ wave: 'square', freq: 520, freqEnd: 620, duration: 0.04, volume: 0.12 }));
  reg('ui.confirm', (s) => s.blip({ wave: 'square', freq: 440, freqEnd: 880, duration: 0.08, volume: 0.16 }));
  reg('ui.join', (s) => arp(s, [261.63, 329.63, 392], 70, { volume: 0.14 }));
  reg('bh.unlock', (s) => arp(s, [261.63, 329.63, 392, 523.25], 80, { volume: 0.2 }));
  reg('ui.wave', (s) => arp(s, [392, 493.88, 587.33], 75, { volume: 0.15 }));
  reg('ui.best', (s) => arp(s, [261.63, 329.63, 392, 523.25], 90, { wave: 'triangle', volume: 0.16 }));
  reg('ui.gameover', (s) => arp(s, [196, 155.56, 130.81, 98], 160, { wave: 'sawtooth', volume: 0.2, duration: 0.22, freqEnd: 90 }));
}

// --- music beds -----------------------------------------------------------------

/** combat bed — driving 2-track + drums chip at 132 BPM (C minor riff) */
export const COMBAT_SONG: Song = {
  stepMs: stepsFromBpm(132),
  tracks: [
    {
      wave: 'square',
      gain: 0.14,
      gate: 0.5,
      lp: 750,
      notes: [
        65, 0, 65, 0, 65, 0, 78, 0, 65, 0, 65, 0, 87, 0, 98, 0,
        65, 0, 65, 0, 65, 0, 78, 0, 116.5, 0, 98, 0, 87, 0, 78, 0,
      ],
    },
    {
      wave: 'square',
      gain: 0.07,
      gate: 0.75,
      lp: 2500,
      notes: [
        0, 0, 392, 0, 311, 0, 262, 0, 0, 0, 349, 0, 311, 0, 262, 0,
        0, 0, 392, 0, 466, 0, 523, 0, 0, 0, 349, 0, 311, 0, 392, 0,
      ],
    },
  ],
  drums: { steps: 'k.h.s.h.'.repeat(4), gain: 0.5 },
};

/** deathmatch bed — same engine, faster and meaner (D minor) */
export const DM_SONG: Song = {
  stepMs: stepsFromBpm(140),
  tracks: [
    {
      wave: 'square',
      gain: 0.14,
      gate: 0.5,
      lp: 800,
      notes: [
        73.4, 0, 73.4, 0, 73.4, 0, 87.3, 0, 73.4, 0, 73.4, 0, 110, 0, 87.3, 0,
        73.4, 0, 73.4, 0, 73.4, 0, 87.3, 0, 116.5, 0, 110, 0, 87.3, 0, 73.4, 0,
      ],
    },
    {
      wave: 'square',
      gain: 0.07,
      gate: 0.7,
      lp: 2600,
      notes: [
        0, 0, 293.7, 0, 0, 0, 349.2, 0, 0, 0, 440, 0, 0, 523.3, 0, 0,
        0, 0, 293.7, 0, 0, 0, 349.2, 0, 0, 0, 392, 0, 349.2, 0, 293.7, 0,
      ],
    },
  ],
  drums: { steps: 'k.h.s.hk'.repeat(4), gain: 0.5 },
};

/** menu bed — moody slow triangle drone, sparse arpeggio, no drums */
export const MENU_SONG: Song = {
  stepMs: stepsFromBpm(76),
  tracks: [
    {
      wave: 'triangle',
      gain: 0.11,
      gate: 0.95,
      lp: 800,
      notes: [
        130.8, 0, 0, 0, 130.8, 0, 0, 0, 116.5, 0, 0, 0, 116.5, 0, 0, 0,
        103.8, 0, 0, 0, 103.8, 0, 0, 0, 116.5, 0, 0, 0, 116.5, 0, 0, 0,
      ],
    },
    {
      wave: 'triangle',
      gain: 0.055,
      gate: 0.6,
      notes: [
        0, 0, 261.6, 0, 0, 0, 0, 311.1, 0, 0, 0, 0, 0, 392, 0, 0,
        0, 0, 0, 0, 0, 311.1, 0, 0, 0, 0, 349.2, 0, 0, 0, 0, 0,
      ],
    },
  ],
};

/**
 * Music bed controller with a real duck: the sequencer reads track/drum
 * gains live from the Song object we own, so scaling them for ~320 ms
 * attenuates the bed without touching the (frozen) arcade-core bus layout.
 */
export class Music {
  private song: Song | null = null;
  private restoreGains: (() => void) | null = null;

  play(sfx: Sfx, song: Song): void {
    this.cancelRestore();
    this.song = song;
    sfx.playSong(song);
  }

  stop(sfx: Sfx): void {
    this.cancelRestore();
    this.song = null;
    sfx.stopMusic();
  }

  /** brief −8 dB dip on the bed (explosions, death jingles) */
  duck(): void {
    const song = this.song;
    if (!song || this.restoreGains) return;
    const base = song.tracks.map((t) => t.gain ?? 0.22);
    const drumBase = song.drums?.gain ?? 0.5;
    song.tracks.forEach((t, i) => { t.gain = base[i] * 0.4; });
    if (song.drums) song.drums.gain = drumBase * 0.4;
    this.restoreGains = () => {
      song.tracks.forEach((t, i) => { t.gain = base[i]; });
      if (song.drums) song.drums.gain = drumBase;
      this.restoreGains = null;
    };
    window.setTimeout(() => this.restoreGains?.(), 320);
  }

  private cancelRestore(): void {
    this.restoreGains?.();
    this.restoreGains = null;
  }
}
