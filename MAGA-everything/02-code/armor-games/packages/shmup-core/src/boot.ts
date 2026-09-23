import { Application } from 'pixi.js';
import { Input, Sfx, fitIntegerScale, letterboxOffset, viewport } from '@maga/arcade-core';
import type { ContentPack } from './packs';
import { DT, STAGE_H, STAGE_W, ShmupSim, type SimEvent } from './sim';
import { ShmupRenderer } from './render';
import { ShmupTouch } from './touch';

/**
 * Shared app bootstrap for the shmup skeleton — everything a pack app needs:
 * Pixi Application (webgl, fixed stage), integer letterbox, unified input,
 * touch zones, synth SFX, music bed, 120Hz fixed-step loop, ?debug hook.
 * Apps call `bootShmup(PACKS.x, '<storage-ns>')` and are done.
 */

// campy loopable beds — declared-guess melodies, MAESTRO replaces (TBD)
const MUSIC_BEDS: Record<ContentPack['id'], number[]> = {
  replica: [262, 0, 330, 0, 392, 0, 330, 0, 262, 0, 330, 392, 0, 330, 0, 0],
  cluck: [294, 0, 370, 0, 440, 0, 370, 0, 494, 0, 440, 370, 0, 330, 0, 0],
};

function playEvent(sfx: Sfx, e: SimEvent): void {
  switch (e) {
    case 'shoot': sfx.preset('shoot'); break;
    case 'missile': sfx.blip({ wave: 'sawtooth', freq: 180, freqEnd: 900, duration: 0.25 }); break;
    case 'hit': sfx.preset('hit'); break;
    case 'death': sfx.preset('death'); break;
    case 'pickup': sfx.preset('pickup'); break;
    case 'ui': sfx.preset('ui'); break;
    case 'bossSpawn': sfx.blip({ wave: 'sawtooth', freq: 90, freqEnd: 220, duration: 0.6, volume: 0.8 }); break;
    case 'bossDown': sfx.blip({ wave: 'triangle', freq: 220, freqEnd: 880, duration: 0.5 }); break;
    case 'chapterClear': sfx.blip({ wave: 'triangle', freq: 440, freqEnd: 880, duration: 0.35 }); break;
    case 'gameOver': sfx.blip({ wave: 'sawtooth', freq: 320, freqEnd: 40, duration: 0.7, volume: 0.8 }); break;
    case 'win': sfx.blip({ wave: 'triangle', freq: 330, freqEnd: 1320, duration: 0.6 }); break;
  }
}

export interface ShmupHandles {
  app: Application;
  sim: ShmupSim;
  input: Input;
  touch: ShmupTouch;
  renderer: ShmupRenderer;
  sfx: Sfx;
}

export async function bootShmup(pack: ContentPack, game: string): Promise<ShmupHandles> {
  const badgeEl = document.querySelector<HTMLElement>('.badge');
  const muteBtn = document.getElementById('mute');

  const app = new Application();
  await app.init({
    width: STAGE_W,
    height: STAGE_H,
    background: pack.bg0,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    // retro 2D: WebGL everywhere, never hang on WebGPU/Dawn edge cases
    preference: 'webgl',
  });
  document.body.appendChild(app.canvas);

  const input = new Input();
  const sfx = new Sfx();
  if (muteBtn) {
    const paint = () => { muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; };
    muteBtn.addEventListener('click', () => { sfx.muted = !sfx.muted; paint(); });
    paint();
  }

  let cachedScale = 1;
  // getBoundingClientRect() already includes the CSS letterbox offset —
  // divide by scale only (D-09: subtracting it double-counts the offset).
  const toLogical = (cx: number, cy: number) => ({ x: cx / cachedScale, y: cy / cachedScale });

  // ShmupTouch registers canvas pointer handlers BEFORE Input.attach:
  // zone-claimed touches call stopImmediatePropagation so Input never sees
  // them as taps (D-15).
  const touch = new ShmupTouch(STAGE_W, STAGE_H, app.canvas, toLogical);
  input.attach(app.canvas, toLogical);

  const sim = new ShmupSim(pack, game);
  const renderer = new ShmupRenderer(sim);
  app.stage.addChild(renderer.view, touch.view);

  // keybinds beyond arcade-core defaults (proto: Z fire, X/Shift missile,
  // R/Enter end-screen confirm, 1/2 chapter select)
  input.setKeymaps({
    p1: {
      KeyZ: 'fire',
      KeyX: 'action', ShiftLeft: 'action', ShiftRight: 'action',
      KeyR: 'action',
      Digit1: 'slot1', Digit2: 'slot2',
    },
  });

  // PROOF/debug hook: open with ?debug to expose state for automated acceptance
  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __maga: unknown }).__maga = {
      sim, input, touch,
      get state() { return sim.snapshot(); },
    };
  }

  function layout(): void {
    const vp = viewport();
    const badgeH = badgeEl?.offsetHeight ?? 0;
    if (muteBtn) muteBtn.style.top = `${badgeH + 4}px`;
    const avail = { width: vp.width, height: vp.height - badgeH };
    const s = fitIntegerScale(STAGE_W, STAGE_H, avail, 4);
    const off = letterboxOffset(STAGE_W, STAGE_H, s, avail);
    cachedScale = s;
    const cvs = app.canvas as HTMLCanvasElement;
    cvs.style.width = `${STAGE_W * s}px`;
    cvs.style.height = `${STAGE_H * s}px`;
    // single positioning mechanism: fixed canvas + explicit left/top (D-12)
    cvs.style.left = `${off.x}px`;
    cvs.style.top = `${off.y + badgeH}px`;
  }
  window.addEventListener('resize', layout);
  layout();

  let musicOn = false;
  let acc = 0;
  app.ticker.add((ticker) => {
    // ---- flow input (per render frame; edge-triggered) ----
    if (sim.mode === 'title') {
      if (input.wasPressed('slot1')) sim.selectChapter(1);
      if (input.wasPressed('slot2')) sim.selectChapter(2);
      if (input.wasPressed('fire') || input.wasPressed('action')) sim.startGame(sim.titleSel);
      if (input.pointer.tapped) sim.titleClick(input.pointer.x, input.pointer.y);
    } else if (sim.mode === 'gameover' || sim.mode === 'win') {
      if (input.wasPressed('fire') || input.wasPressed('action') || input.pointer.tapped) sim.confirmEnd();
    } else if (sim.mode === 'play') {
      if (input.wasPressed('pause')) sim.togglePause();
    }
    touch.setActive(sim.mode === 'play');

    // ---- combat input ----
    const axis = input.moveAxis(sim.ship.x, sim.ship.y, 40, false); // touch handled by zones (D-15)
    if (touch.drag) { axis.x = touch.drag.x; axis.y = touch.drag.y; }
    sim.moveAxis.x = axis.x; sim.moveAxis.y = axis.y;
    // LMB fires (fine pointer); touch fire comes from the FIRE zone or drag autofire
    const pointerFire = input.pointer.active && input.pointer.seen && !matchMedia('(pointer: coarse)').matches;
    sim.setFire(input.isDown('fire') || touch.fire || pointerFire || touch.drag !== null);
    if (input.wasPressed('action') || touch.takeMissile()) sim.fireMissile();

    // ---- fixed-step sim ----
    acc += Math.min(0.1, ticker.deltaMS / 1000);
    while (acc >= DT) { sim.step(DT); acc -= DT; }

    // ---- music bed follows mode ----
    const wantMusic = sim.mode === 'play' && !sim.paused;
    if (wantMusic && !musicOn) { sfx.startMusic(MUSIC_BEDS[pack.id]); musicOn = true; }
    if (!wantMusic && musicOn) { sfx.stopMusic(); musicOn = false; }

    // ---- drain events → SFX ----
    for (const e of sim.events) playEvent(sfx, e);
    sim.events.length = 0;

    touch.tick();
    renderer.draw();
    input.endFrame();
  });

  return { app, sim, input, touch, renderer, sfx };
}
