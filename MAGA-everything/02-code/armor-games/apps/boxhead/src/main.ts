import { Application } from 'pixi.js';
import { Input, Sfx, fitIntegerScale, letterboxOffset, load, save, viewport } from '@maga/arcade-core';
import { Game } from './game';
import { TouchControls } from './touch';

/**
 * BLOCKHEAD: ARENA NIGHTS — bootstrap.
 * Fixed logical stage, integer letterboxed scaling, unified input, synth SFX.
 */

const STAGE_W = 640;
const STAGE_H = 400;
// badge height is measured live (it wraps on narrow screens — RT-3)
const badgeEl = document.querySelector<HTMLElement>('.badge');

(async () => {
  const app = new Application();
  await app.init({
    width: STAGE_W,
    height: STAGE_H,
    background: 0x0b0b0c,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    // retro 2D: WebGL everywhere, never hang on WebGPU/Dawn edge cases
    preference: 'webgl',
  });
  document.body.appendChild(app.canvas);

const input = new Input();
const sfx = new Sfx();

// settings chrome (page-level so it stays reachable on every screen):
// SOUND ON/OFF button + volume slider, both persisted.
const muteBtn = document.getElementById('mute');
const audioChrome = document.getElementById('audio');
const volSlider = document.getElementById('vol') as HTMLInputElement | null;
sfx.setMuted(load('boxhead', 'muted', false));
sfx.volume = load('boxhead', 'volume', 0.7);
if (volSlider) volSlider.value = String(Math.round(sfx.volume * 100));
const paintMute = () => { if (muteBtn) muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; };
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    sfx.setMuted(!sfx.muted);
    save('boxhead', 'muted', sfx.muted);
    paintMute();
  });
  paintMute();
}
if (volSlider) {
  volSlider.addEventListener('input', () => {
    sfx.volume = Number(volSlider.value) / 100;
    save('boxhead', 'volume', sfx.volume);
  });
}

let cachedScale = 1;
// getBoundingClientRect() already includes the CSS translate() letterbox
// offset — divide by scale only. Subtracting cachedOffset here would
// double-count it and shift every pointer/touch position off-target.
const toLogical = (cx: number, cy: number) => ({
  x: cx / cachedScale,
  y: cy / cachedScale,
});

// TouchControls registers its canvas pointer handlers BEFORE Input.attach:
// zone-claimed touches call stopImmediatePropagation so Input never sees
// them as aim/tap/drag (D-15).
const touch = new TouchControls(STAGE_W, STAGE_H, app.canvas, toLogical);
input.attach(app.canvas, toLogical);

const game = new Game(app, input, sfx, touch);

// PROOF/debug hook: open with ?debug to expose state for automated acceptance
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __maga: unknown }).__maga = {
    game,
    input,
    touch,
    // read-only state hooks — verification depends on these
    get state() { return game.stateName; },
    get mode() { return game.modeName; },
    get wave() { return game.waveNumber; },
    get score() { return game.scoreValue; },
    get mult() { return game.multValue; },
    get weapon() { return game.weaponSnapshot; },
    get players() { return game.playerSnapshot; },
    get enemiesAlive() { return game.enemiesAlive; },
    get rooms() { return game.roomsCount; },
  };
}

function layout(): void {
  const vp = viewport();
  const badgeH = badgeEl?.offsetHeight ?? 0;
  if (audioChrome) audioChrome.style.top = `${badgeH + 4}px`;
  const avail = { width: vp.width, height: vp.height - badgeH };
  const s = fitIntegerScale(STAGE_W, STAGE_H, avail, 4);
  const off = letterboxOffset(STAGE_W, STAGE_H, s, avail);
  cachedScale = s;
  const cvs = app.canvas as HTMLCanvasElement;
  cvs.style.width = `${STAGE_W * s}px`;
  cvs.style.height = `${STAGE_H * s}px`;
  // single positioning mechanism: fixed canvas + explicit left/top.
  // (flex-centering + translate double-counted the offset — D1/D3 defect)
  cvs.style.left = `${off.x}px`;
  cvs.style.top = `${off.y + badgeH}px`;
}
window.addEventListener('resize', layout);
layout();

  app.ticker.add((ticker) => {
    game.tick(ticker.deltaMS / 1000);
  });
})();
