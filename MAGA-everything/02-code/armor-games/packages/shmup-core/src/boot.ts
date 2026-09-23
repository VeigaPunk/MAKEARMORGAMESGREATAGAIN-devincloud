import { Application } from 'pixi.js';
import { Input, Sfx, fitIntegerScale, letterboxOffset, load, save, viewport } from '@maga/arcade-core';
import type { ContentPack } from './packs';
import { DT, STAGE_H, STAGE_W, ShmupSim, type SimEvent } from './sim';
import { ShmupRenderer } from './render';
import { ShmupTouch } from './touch';
import { bedSong, makeAudio } from './audio';

/**
 * Shared app bootstrap for the shmup engine — everything a pack app needs:
 * Pixi Application (webgl, fixed stage), integer letterbox, unified input
 * (incl. RMB missile), touch zones, per-pack synth audio (escalating beds,
 * jingles, stings), settings persistence, 120Hz fixed-step loop, ?debug hook.
 * Apps call `bootShmup(PACKS.x, '<storage-ns>')` and are done.
 */

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
    background: pack.chapters[0].tint[0],
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    // retro 2D: WebGL everywhere, never hang on WebGPU/Dawn edge cases
    preference: 'webgl',
  });
  document.body.appendChild(app.canvas);

  const input = new Input();
  const sfx = new Sfx();
  // settings persist: volume + mute survive reloads (spec: settings persist)
  sfx.volume = load(game, 'volume', 0.5);
  sfx.setMuted(load(game, 'muted', false));
  const paintMute = () => { if (muteBtn) muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; };
  if (muteBtn) {
    muteBtn.addEventListener('click', () => { sfx.muted = !sfx.muted; save(game, 'muted', sfx.muted); paintMute(); });
    paintMute();
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
  const audio = makeAudio(pack, sfx);
  audio.register();

  // keybinds beyond arcade-core defaults (Z fire, X/Shift missile, R/Enter
  // end-screen confirm, 1/2 chapter select)
  input.setKeymaps({
    p1: {
      KeyZ: 'fire',
      KeyX: 'action', ShiftLeft: 'action', ShiftRight: 'action',
      KeyR: 'action',
      Digit1: 'slot1', Digit2: 'slot2',
    },
  });

  // keys the frozen arcade-core action set can't express: digits 3-0 jump
  // straight to a chapter on the title, Q bails to the title screen.
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (sim.mode === 'title' && /^Digit[0-9]$/.test(e.code)) {
      const n = e.code === 'Digit0' ? 10 : Number(e.code.slice(5));
      sim.selectChapter(n);
    }
    if (e.code === 'KeyQ' && (sim.mode === 'gameover' || sim.mode === 'win' || (sim.mode === 'play' && sim.paused))) {
      sim.quitToTitle();
    }
  });

  // PROOF/debug hook: open with ?debug to expose state for automated acceptance
  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __maga: unknown }).__maga = {
      sim, input, touch, sfx, app,
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

  function playEvent(e: SimEvent): void {
    switch (e) {
      case 'shoot': sfx.preset(`${pack.id}-shoot`); break;
      case 'missile': sfx.preset('missile'); break;
      case 'hit': sfx.preset('hit'); break;
      case 'death': sfx.preset(`${pack.id}-phit`); break;
      case 'pickup': sfx.preset('pickup'); break;
      case 'gift': sfx.preset(`${pack.id}-gift`); break;
      case 'food': sfx.preset(`${pack.id}-food`); break;
      case 'extraLife': sfx.preset(`${pack.id}-gift`); sfx.preset('ui'); break;
      case 'explode': sfx.preset(`${pack.id}-boom`); break;
      case 'ui': sfx.preset('ui'); break;
      case 'bossSpawn': audio.bossAlarm(); break;
      case 'bossPhase': audio.bossAlarm(); break;
      case 'bossDown': sfx.preset(`${pack.id}-boom`); break;
      case 'chapterClear': audio.fanfare(); break;
      case 'gameOver': audio.gameOver(); break;
      case 'win': audio.win(); break;
    }
  }

  let jinglePlayed = false;
  let musicKey = '';
  let rmbWas = false;
  let acc = 0;
  app.ticker.add((ticker) => {
    if (sim.mode === 'title') {
      if (input.wasPressed('left')) sim.moveChapterSel(-1);
      if (input.wasPressed('right')) sim.moveChapterSel(1);
      if (input.wasPressed('slot1')) sim.selectChapter(1);
      if (input.wasPressed('slot2')) sim.selectChapter(2);
      if (input.wasPressed('fire') || input.wasPressed('action')) sim.startGame(sim.titleSel);
      if (input.pointer.tapped) sim.titleClick(input.pointer.x, input.pointer.y);
      if (!jinglePlayed && (input.pointer.seen || input.wasPressed('fire'))) { jinglePlayed = true; audio.jingle(); }
    } else if (sim.mode === 'gameover' || sim.mode === 'win') {
      if (input.wasPressed('pause')) sim.quitToTitle();
      if (input.wasPressed('fire') || input.wasPressed('action') || input.pointer.tapped) sim.confirmEnd();
    } else if (sim.mode === 'play') {
      if (input.wasPressed('pause')) sim.togglePause();
      if (sim.paused) {
        // settings live on the pause screen: ↑/↓ volume (persisted)
        if (input.wasPressed('up')) { sfx.volume = Math.min(1, sfx.volume + 0.1); save(game, 'volume', sfx.volume); sfx.preset('ui'); }
        if (input.wasPressed('down')) { sfx.volume = Math.max(0, sfx.volume - 0.1); save(game, 'volume', sfx.volume); sfx.preset('ui'); }
      }
    }
    touch.setActive(sim.mode === 'play' && !sim.paused);

    // ---- combat input ----
    const axis = input.moveAxis(sim.ship.x, sim.ship.y, 40, false); // touch handled by zones (D-15)
    if (touch.drag) { axis.x = touch.drag.x; axis.y = touch.drag.y; }
    sim.moveAxis.x = axis.x; sim.moveAxis.y = axis.y;
    // LMB fires (fine pointer); touch fire comes from the FIRE zone or drag autofire
    const pointerFire = input.pointer.active && input.pointer.seen && !matchMedia('(pointer: coarse)').matches;
    sim.setFire(input.isDown('fire') || touch.fire || pointerFire || touch.drag !== null);
    // RMB missile (pointer.button 2) — edge-detected here
    const rmb = input.pointer.active && input.pointer.button === 2;
    if (rmb && !rmbWas) sim.fireMissile();
    rmbWas = rmb;
    if (input.wasPressed('action') || touch.takeMissile()) sim.fireMissile();

    // ---- fixed-step sim ----
    acc += Math.min(0.1, ticker.deltaMS / 1000);
    while (acc >= DT) { sim.step(DT); acc -= DT; }

    // ---- music bed follows mode/chapter/boss ----
    const wantBed = sim.mode === 'play' && !sim.paused;
    const key = wantBed ? `bed:${sim.chapter}:${sim.boss ? 1 : 0}` : '';
    if (key !== musicKey) {
      musicKey = key;
      if (key) sfx.playSong(bedSong(pack, sim.chapter, !!sim.boss));
      else sfx.stopMusic();
    }

    // ---- drain events → SFX ----
    for (const e of sim.events) playEvent(e);
    sim.events.length = 0;

    touch.tick();
    renderer.draw();
    input.endFrame();
  });

  return { app, sim, input, touch, renderer, sfx };
}
