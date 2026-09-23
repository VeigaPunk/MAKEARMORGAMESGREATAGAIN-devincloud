import { Application } from 'pixi.js';
import { Input, Sfx, fitIntegerScale, letterboxOffset, viewport } from '@maga/arcade-core';
import { Game } from './game';
import { TouchControls } from './touch';

/**
 * Boxhead native replica — bootstrap.
 * Fixed logical stage, integer letterboxed scaling, unified input, synth SFX.
 */

const STAGE_W = 640;
const STAGE_H = 400;
// badge height is measured live (it wraps on narrow screens — RT-3)
const badgeEl = document.querySelector<HTMLElement>('.badge');

const app = new Application();
await app.init({
  width: STAGE_W,
  height: STAGE_H,
  background: 0x0a0a0f,
  antialias: false,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  // retro 2D: WebGL everywhere, never hang on WebGPU/Dawn edge cases
  preference: 'webgl',
});
document.body.appendChild(app.canvas);

const input = new Input();
const sfx = new Sfx();
// BH-3.2 MAESTRO drop zone: mute toggle lives in page chrome, not the stage,
// so it stays reachable on every screen including menus.
const muteBtn = document.getElementById('mute');
if (muteBtn) {
  const paint = () => { muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; };
  muteBtn.addEventListener('click', () => { sfx.muted = !sfx.muted; paint(); });
  paint();
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
  (window as unknown as { __maga: unknown }).__maga = { game, input, touch };
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
