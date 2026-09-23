import type { Gladiator } from './model';

export interface Scene { gladiator: Gladiator; opponent: number; fighting: boolean; champion: boolean; now: number; impact: number; damage: number; action: string }
const W = 960, H = 520;
const colors = ['#a53332', '#38768e', '#bc862d'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Authored vector art: oversize helmets, different weapons and painted colosseum tiers. */
export function createArena(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const background = document.createElement('canvas'); background.width = W; background.height = H;
  const a = background.getContext('2d')!;
  const sky = a.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f6d694'); sky.addColorStop(1, '#c2853a');
  a.fillStyle = sky; a.fillRect(0, 0, W, H);
  const sun = a.createRadialGradient(730, 42, 4, 730, 42, 280); sun.addColorStop(0, '#fff7cf'); sun.addColorStop(1, '#fff7cf00');
  a.fillStyle = sun; a.fillRect(0, 0, W, H);
  [66, 151, 236].forEach((y, tier) => {
    const stone = a.createLinearGradient(0, y, 0, y + 85); stone.addColorStop(0, ['#bf9360', '#b0844e', '#9b6e3e'][tier]); stone.addColorStop(1, '#775431');
    a.fillStyle = stone; a.fillRect(0, y, W, 85);
    for (let x = -18; x < W; x += 62) {
      a.fillStyle = '#382b21'; a.beginPath(); a.roundRect(x + 8, y + 22, 38, 66, [20, 20, 0, 0]); a.fill();
      a.strokeStyle = '#e3bd8266'; a.lineWidth = 3; a.stroke();
      for (let i = 0; i < 12; i++) {
        const px = x + 12 + ((i * 11 + tier * 17) % 30), py = y + 40 + ((i * 17) % 39);
        a.fillStyle = ['#c49260', '#5e4233', '#ddc495', '#9d6346'][i % 4]; a.beginPath(); a.arc(px, py, 2.4, 0, Math.PI * 2); a.fill();
      }
      a.fillStyle = '#6e4c2d'; a.fillRect(x, y + 14, 5, 69);
    }
    a.fillStyle = '#d7ae75'; a.fillRect(0, y, W, 5); a.fillStyle = '#493521'; a.fillRect(0, y + 81, W, 4);
    for (let x = 70 + tier * 45; x < W; x += 225) {
      a.fillStyle = colors[(tier + Math.floor(x / 225)) % 3]; a.beginPath(); a.moveTo(x, y + 65); a.lineTo(x + 28, y + 65); a.lineTo(x + 28, y + 103); a.lineTo(x + 14, y + 92); a.lineTo(x, y + 103); a.fill();
      a.strokeStyle = '#dab475'; a.lineWidth = 2; a.stroke();
    }
  });
  const wall = a.createLinearGradient(0, 322, 0, 370); wall.addColorStop(0, '#b08851'); wall.addColorStop(1, '#6c4c2c');
  a.fillStyle = wall; a.fillRect(0, 322, W, 52); a.fillStyle = '#d2ab72'; a.fillRect(0, 322, W, 6);
  for (let x = 30; x < W; x += 70) { a.fillStyle = '#513d2766'; a.fillRect(x, 329, 2, 45); }
  const sand = a.createRadialGradient(480, 430, 40, 480, 430, 520); sand.addColorStop(0, '#edcc90'); sand.addColorStop(1, '#bd8846');
  a.fillStyle = sand; a.fillRect(0, 374, W, H);
  a.strokeStyle = '#9f753c44'; a.lineWidth = 2;
  for (let r = 45; r < 620; r += 38) { a.beginPath(); a.ellipse(480, 555, r, r * .38, 0, 0, Math.PI * 2); a.stroke(); }
  for (let i = 0; i < 200; i++) { a.fillStyle = i % 2 ? '#fff4c333' : '#71512822'; a.fillRect((i * 113) % W, 380 + (i * 31) % 140, 2, 2); }

  function shape(color: string, path: () => void) { ctx.fillStyle = color; ctx.beginPath(); path(); ctx.fill(); ctx.strokeStyle = '#35261d'; ctx.lineWidth = 1.6; ctx.stroke(); }
  function ellipse(x: number, y: number, rx: number, ry: number, color: string) { shape(color, () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)); }
  function weapon(kind: number) {
    ctx.save(); ctx.translate(26, -43); ctx.rotate(-.16);
    shape('#704924', () => ctx.roundRect(-3, -56, 6, 64, 2));
    if (kind === 0) { shape('#8d693d', () => ctx.roundRect(-10, -69, 21, 37, 6)); ctx.fillStyle = '#bca176'; ctx.fillRect(-11, -62, 23, 5); ctx.fillRect(-11, -42, 23, 5); }
    else if (kind === 3) { shape('#d5bb75', () => { ctx.moveTo(0, -66); ctx.quadraticCurveTo(39, -72, 30, -38); ctx.lineTo(0, -44); ctx.closePath(); }); }
    else { shape('#e0e2d5', () => { ctx.moveTo(-5, -7); ctx.lineTo(-5, -62); ctx.lineTo(0, -75); ctx.lineTo(6, -62); ctx.lineTo(6, -7); ctx.closePath(); }); ctx.strokeStyle = '#819392'; ctx.beginPath(); ctx.moveTo(0, -61); ctx.lineTo(0, -10); ctx.stroke(); shape('#c8a05c', () => ctx.roundRect(-12, -9, 25, 6, 2)); }
    ctx.restore();
  }
  function fighter(x: number, y: number, flip: boolean, tint: string, equipment: number, kind: number, t: number, hurt: boolean, lunge: number) {
    ctx.save(); ctx.translate(x + lunge, y); ctx.scale(flip ? -2.22 : 2.22, 2.22);
    const bob = reducedMotion ? 0 : Math.sin(t / 530 + x) * 1.1;
    ctx.fillStyle = '#4c311e44'; ctx.beginPath(); ctx.ellipse(0, 1, 31, 6, 0, 0, 7); ctx.fill();
    ctx.translate(0, bob); if (hurt) ctx.globalAlpha = .66;
    const skin = flip ? ['#d3ac7b', '#a78065', '#d4a272', '#9c7560'][kind] : '#e6b68b';
    ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#473022';
    for (const dx of [-8, 8]) { ctx.beginPath(); ctx.moveTo(dx, -31); ctx.lineTo(dx * 1.6, -5); ctx.stroke(); }
    ctx.strokeStyle = skin; ctx.lineWidth = 7;
    for (const dx of [-8, 8]) { ctx.beginPath(); ctx.moveTo(dx, -31); ctx.lineTo(dx * 1.6, -5); ctx.stroke(); }
    ellipse(-14, -4, 8, 4, '#533820'); ellipse(14, -4, 8, 4, '#533820');
    shape(tint, () => { ctx.moveTo(-17, -69); ctx.lineTo(17, -69); ctx.lineTo(20, -29); ctx.lineTo(-20, -29); ctx.closePath(); });
    shape(equipment >= 8 ? '#cfb578' : equipment ? '#9fa9a4' : '#ab8661', () => ctx.roundRect(-17, -68, 34, 30, 7));
    if (equipment) { ctx.strokeStyle = '#596360'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-16, -59 + i * 8); ctx.lineTo(16, -59 + i * 8); ctx.stroke(); } }
    ctx.fillStyle = '#473022'; ctx.fillRect(-19, -35, 38, 7); ctx.fillStyle = '#e2be70'; ctx.fillRect(-4, -35, 8, 7);
    ctx.strokeStyle = skin; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(16, -62); ctx.lineTo(26, -43); ctx.stroke(); weapon(kind);
    if (equipment >= 3 || kind === 2) { ellipse(-19, -48, 16, 21, tint); ellipse(-19, -48, 6, 7, '#ddbd7a'); ctx.strokeStyle = '#dec38a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-19, -48, 13, 18, 0, 0, 7); ctx.stroke(); }
    ellipse(0, -86, 19, 22, skin);
    // Large readable brow and comic nose, with a proper helmet silhouette.
    shape(kind === 3 ? '#d8b16c' : '#aab0aa', () => { ctx.moveTo(-21, -91); ctx.quadraticCurveTo(-20, -115, 4, -110); ctx.quadraticCurveTo(21, -108, 21, -89); ctx.closePath(); });
    ctx.fillStyle = tint; ctx.beginPath(); ctx.moveTo(-12, -107); ctx.quadraticCurveTo(-7, -128, 15, -115); ctx.lineTo(13, -107); ctx.fill();
    ctx.fillStyle = '#565d56'; ctx.fillRect(-21, -91, 42, 5); ctx.fillRect(-20, -87, 7, 17);
    ctx.fillStyle = '#fff4db'; ctx.fillRect(3, -84, 9, 6); ctx.fillStyle = '#2d231c'; ctx.fillRect(8, -84, 3, 5);
    ctx.strokeStyle = '#40281c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(2, -87); ctx.lineTo(13, -85); ctx.stroke();
    ellipse(17, -77, 5, 4, skin); ctx.strokeStyle = '#6c3924'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(5, -70); ctx.lineTo(14, -72); ctx.stroke(); ctx.restore();
  }
  return (scene: Scene) => {
    const { gladiator: g, now, impact, damage, action } = scene;
    const elapsed = now - impact, hit = elapsed >= 0 && elapsed < 500;
    ctx.clearRect(0, 0, W, H); ctx.drawImage(background, 0, 0);
    // Braziers and slow dust bring the arena to life without obscuring combat.
    [62, 898].forEach(x => {
      ctx.fillStyle = '#473124'; ctx.fillRect(x - 5, 327, 10, 56); ctx.beginPath(); ctx.ellipse(x, 326, 20, 7, 0, 0, 7); ctx.fill();
      const flicker = reducedMotion ? 0 : Math.sin(now / 90 + x) * 3;
      ctx.fillStyle = '#ffb441'; ctx.beginPath(); ctx.moveTo(x - 12, 322); ctx.quadraticCurveTo(x - 17, 307, x + flicker, 286); ctx.quadraticCurveTo(x + 18, 310, x + 12, 322); ctx.fill(); ctx.fillStyle = '#ffe6a0'; ctx.beginPath(); ctx.ellipse(x, 315, 5, 11, 0, 0, 7); ctx.fill();
    });
    for (let i = 0; i < 18; i++) { ctx.fillStyle = '#fff0c83d'; ctx.fillRect((i * 79 + now * (reducedMotion ? 0 : .007)) % W, 320 + (i * 47) % 155, 2, 2); }
    const lunge = hit && !reducedMotion && action !== 'guard' && action !== 'potion' ? Math.sin(Math.min(1, elapsed / 350) * Math.PI) * 30 : 0;
    const tier = Math.floor(scene.opponent / 4), opponentStyle = scene.opponent % 4;
    if (tier > 0) { ctx.fillStyle = tier === 1 ? '#84522612' : '#773e781b'; ctx.fillRect(0, 0, W, H); }
    const tint = colors[['Scarlet', 'Azure', 'Gold'].indexOf(g.look)];
    fighter(248, 448, false, tint, g.armor, g.weapon >= 10 ? 3 : 1, now, false, lunge);
    if (scene.fighting || !scene.champion) fighter(712, 448, true, [['#71614c', '#435674', '#737444', '#852a32'], ['#714a7a', '#51736d', '#aa7434', '#985735'], ['#376c7e', '#baa988', '#ad3d35', '#d4a347']][tier][opponentStyle], scene.opponent * 2, opponentStyle, now, hit && damage > 0, -lunge * .3);
    if (hit && damage > 0) {
      ctx.font = 'bold 48px Georgia'; ctx.textAlign = 'center'; ctx.strokeStyle = '#3e291c'; ctx.lineWidth = 5; ctx.fillStyle = '#fff0bf';
      ctx.globalAlpha = Math.min(1, (500 - elapsed) / 160); ctx.strokeText(`−${damage}`, 713, 185 - elapsed / 10); ctx.fillText(`−${damage}`, 713, 185 - elapsed / 10); ctx.globalAlpha = 1;
    }
    if (scene.champion) {
      ctx.textAlign = 'center'; ctx.font = 'bold 49px Georgia'; ctx.strokeStyle = '#3b281a'; ctx.lineWidth = 6; ctx.strokeText('CHAMPION', 650, 247); ctx.fillStyle = '#ffe09b'; ctx.fillText('CHAMPION', 650, 247);
      ctx.font = '18px Georgia'; ctx.fillText('The arena remembers your name.', 650, 281);
      for (let i = 0; i < 60; i++) { ctx.fillStyle = ['#ffe49a', '#ad3d33', '#fff1c9'][i % 3]; ctx.fillRect((i * 163) % W, (i * 37 + now * (reducedMotion ? 0 : .035)) % H, 5, 8); }
    }
  };
}
