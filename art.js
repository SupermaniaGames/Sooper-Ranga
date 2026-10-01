/* All procedural art (vector, drawn at native resolution in world units: 1 tile = 16).
   To replace with your own art later, hero.png / tiles.png / bg-far.png / bg-mid.png are picked up by main.js. */
export const INK = '#2b1608', T = 16;
const TAU = Math.PI * 2;
const blob = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };
export function star(g, cx, cy, R, r, fill, stroke, lw) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || .6; g.lineJoin = 'round'; g.stroke(); }
}

/* ============================ TILES ============================ */
function mkTile(S, fn) { const s = Math.ceil(T * S) + 1, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); g.scale(s / T, s / T); fn(g); return c; }
const frame = g => { g.strokeStyle = INK; g.lineWidth = .7; g.strokeRect(.35, .35, T - .7, T - .7); };
function qBlock(g) {
  g.fillStyle = '#b86a00'; g.fillRect(0, 0, T, T); g.fillStyle = '#ffc928'; g.fillRect(1, 1, T - 2, T - 2);
  g.fillStyle = '#ffe680'; g.fillRect(1, 1, T - 2, 1.2); g.fillRect(1, 1, 1.2, T - 2);
  g.fillStyle = '#e29a10'; g.fillRect(1, T - 2.2, T - 2, 1.2); g.fillRect(T - 2.2, 1, 1.2, T - 2);
  g.fillStyle = '#b86a00'; [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]].forEach(([x, y]) => blob(g, x, y, .7, .7));
  star(g, 8, 8.4, 4.8, 2.1, '#fff3a6', '#a45a00', .7); frame(g);
}
function usedBlock(g) { g.fillStyle = '#4a3520'; g.fillRect(0, 0, T, T); g.fillStyle = '#8a6a45'; g.fillRect(1, 1, T - 2, T - 2); g.fillStyle = '#4a3520'; [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]].forEach(([x, y]) => blob(g, x, y, .7, .7)); frame(g); }
function spikes(g) {
  g.fillStyle = '#9aa3b5'; g.strokeStyle = INK; g.lineWidth = .6; g.lineJoin = 'round';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 4, T); g.lineTo(i * 4 + 2, 6); g.lineTo(i * 4 + 4, T); g.closePath(); g.fill(); g.stroke(); }
  g.fillStyle = '#e8edf7'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 4 + 1.2, T); g.lineTo(i * 4 + 2, 7.4); g.lineTo(i * 4 + 2.6, T); g.fill(); }
}
function lion(g, dir) {
  g.save(); if (dir < 0) { g.translate(T, 0); g.scale(-1, 1); }
  g.fillStyle = '#6b5b45'; g.fillRect(0, 0, T, T); g.strokeStyle = INK; g.lineWidth = .7; g.strokeRect(.35, .35, T - .7, T - .7);
  g.fillStyle = '#c59a3a'; blob(g, 8, 8, 7, 7); g.strokeStyle = INK; g.stroke();            // mane
  g.fillStyle = '#e5b850'; blob(g, 8, 8.4, 5, 5); g.strokeStyle = INK; g.lineWidth = .5; g.stroke();
  g.fillStyle = '#ff5a1a'; blob(g, 6.2, 6.6, 1, .8); blob(g, 10, 6.6, 1, .8);
  g.fillStyle = '#2b1608'; g.fillRect(9.4, 9.4, 6.6, 3.2); g.fillStyle = '#ff7a2a'; g.fillRect(12, 10, 4, 2);    // open mouth facing +x
  g.restore();
}
export function makeTiles(S, style) {
  const TS = {};
  if (style === 'stone') {
    const stoneFill = (g, a, b) => { g.fillStyle = a; g.fillRect(0, 0, T, T); g.fillStyle = b; [[3, 4, 2, 1.2], [11, 3, 2.5, 1], [7, 10, 2.5, 1.3], [13, 12, 1.5, 1]].forEach(([x, y, rx, ry]) => blob(g, x, y, rx, ry)); };
    TS.dirt = mkTile(S, g => { stoneFill(g, '#585168', '#463f56'); g.strokeStyle = '#2f2a3d'; g.lineWidth = .5; g.beginPath(); g.moveTo(0, 8); g.lineTo(T, 8); g.moveTo(8, 0); g.lineTo(8, 8); g.moveTo(4, 8); g.lineTo(4, T); g.moveTo(12, 8); g.lineTo(12, T); g.stroke(); });
    TS.grass = mkTile(S, g => {
      stoneFill(g, '#585168', '#463f56'); g.fillStyle = '#8b829f'; g.fillRect(0, 0, T, 4); g.fillStyle = '#b0a7c4'; g.fillRect(0, 0, T, 1.4);
      g.fillStyle = '#3a3450'; g.fillRect(0, 4, T, .8); g.fillStyle = '#4c8a48'; [[2, 4.8, 3, 1.3], [10, 4.8, 4, 1.6]].forEach(([x, y, rx, ry]) => blob(g, x, y, rx, ry));
      g.strokeStyle = '#2f2a3d'; g.lineWidth = .5; g.beginPath(); g.moveTo(8, 0); g.lineTo(8, 4); g.stroke();
    });
    TS.brick = mkTile(S, g => {
      g.fillStyle = '#23202f'; g.fillRect(0, 0, T, T); g.save(); g.beginPath(); g.rect(0, 0, T, T); g.clip();
      for (let r = 0; r < 4; r++) for (let x = (r % 2 ? 0 : -4); x < T; x += 8) { g.fillStyle = '#7a6c8c'; g.fillRect(x + .6, r * 4 + .6, 6.8, 2.8); g.fillStyle = '#9a8cae'; g.fillRect(x + .6, r * 4 + .6, 6.8, .8); g.fillStyle = '#5e5270'; g.fillRect(x + .6, r * 4 + 2.8, 6.8, .6); }
      g.restore(); frame(g);
    });
    TS.hard = mkTile(S, g => {
      g.fillStyle = '#3a3450'; g.fillRect(0, 0, T, T); g.fillStyle = '#847a9a'; g.fillRect(.5, .5, T - 1.5, T - 1.5); g.fillStyle = '#6c6282'; g.fillRect(2, 2, T - 4, T - 4);
      g.strokeStyle = '#b3a9c8'; g.lineWidth = .6; g.beginPath(); g.arc(8, 8, 3, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(8, 4.5); g.lineTo(8, 11.5); g.moveTo(4.5, 8); g.lineTo(11.5, 8); g.stroke(); frame(g);
    });
  } else {
    const dirt = g => {
      g.fillStyle = '#a9622d'; g.fillRect(0, 0, T, T);
      g.fillStyle = '#8c4b20'; blob(g, 3.5, 9, 2.3, 1.5); blob(g, 11, 12.5, 2.7, 1.6); blob(g, 8.5, 5.5, 1.6, 1.1); blob(g, 14, 8, 1.3, 1);
      g.fillStyle = '#c98444'; blob(g, 6, 12, 1.1, .6); blob(g, 12, 7, 1, .6); blob(g, 2, 14, 1, .5); blob(g, 9, 9.5, .8, .5);
    };
    TS.dirt = mkTile(S, dirt);
    TS.grass = mkTile(S, g => {
      dirt(g); g.beginPath(); g.moveTo(0, 0); g.lineTo(T, 0); g.lineTo(T, 5);
      for (let i = 4; i > 0; i--) g.quadraticCurveTo(i * 4 - 2, 8.4, (i - 1) * 4, 5);
      g.closePath(); g.fillStyle = '#3fae3f'; g.fill(); g.fillStyle = '#86e35f'; g.fillRect(0, 0, T, 1.9); g.fillStyle = '#2c8f35'; g.fillRect(0, 3.3, T, .9);
      g.beginPath(); g.moveTo(T, 5); for (let i = 4; i > 0; i--) g.quadraticCurveTo(i * 4 - 2, 8.4, (i - 1) * 4, 5);
      g.strokeStyle = '#1f5a25'; g.lineWidth = .7; g.lineJoin = 'round'; g.stroke();
    });
    TS.brick = mkTile(S, g => {
      g.fillStyle = '#3b1608'; g.fillRect(0, 0, T, T); g.save(); g.beginPath(); g.rect(0, 0, T, T); g.clip();
      for (let r = 0; r < 4; r++) for (let x = (r % 2 ? 0 : -4); x < T; x += 8) { g.fillStyle = '#cc5a2c'; g.fillRect(x + .6, r * 4 + .6, 6.8, 2.8); g.fillStyle = '#ec8d55'; g.fillRect(x + .6, r * 4 + .6, 6.8, .8); g.fillStyle = '#a9441f'; g.fillRect(x + .6, r * 4 + 2.8, 6.8, .6); }
      g.restore(); frame(g);
    });
    TS.hard = mkTile(S, g => {
      g.fillStyle = '#444c60'; g.fillRect(0, 0, T, T); g.fillStyle = '#b9c1d4'; g.fillRect(0, 0, T - 1, T - 1); g.fillStyle = '#8b94ab'; g.fillRect(2, 2, T - 4, T - 4); g.fillStyle = '#a4adc2'; g.fillRect(2, 2, T - 4, 1.2);
      g.strokeStyle = '#5b6478'; g.lineWidth = .5; g.beginPath(); g.moveTo(5, 9); g.lineTo(8, 11); g.lineTo(10, 10); g.stroke(); frame(g);
    });
  }
  TS.q = mkTile(S, qBlock); TS.used = mkTile(S, usedBlock);
  TS.spike = mkTile(S, spikes); TS.lionR = mkTile(S, g => lion(g, 1)); TS.lionL = mkTile(S, g => lion(g, -1));
  TS.oneway = mkTile(S, g => {
    const stone = style === 'stone';
    g.fillStyle = stone ? '#8b829f' : '#9a6a3a'; g.fillRect(0, 0, T, 5); g.fillStyle = stone ? '#b0a7c4' : '#c58f55'; g.fillRect(0, 0, T, 1.6);
    g.fillStyle = stone ? '#5a5070' : '#6b4424'; g.fillRect(0, 4.2, T, .8); g.strokeStyle = INK; g.lineWidth = .6; g.strokeRect(.3, .3, T - .6, 4.4);
    g.fillStyle = INK; [3, 13].forEach(x => blob(g, x, 2.6, .6, .6));
  });
  return TS;
}

/* ============================ PICKUPS ============================ */
export function coin(g, x, y, t) {
  const w = Math.max(.18, Math.abs(Math.cos(t * .07))), rx = 4.2 * w;
  g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, rx + .7, 5.2 + .7, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffc21a'; g.beginPath(); g.ellipse(x, y, rx, 5.2, 0, 0, TAU); g.fill();
  if (w > .45) { g.strokeStyle = '#ffe98c'; g.lineWidth = .6; g.beginPath(); g.ellipse(x, y, rx * .75, 4, 0, 0, TAU); g.stroke();
    g.fillStyle = '#8a4e00'; g.font = 'bold 6px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₹', x, y + .4); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
}
export function starPick(g, x, y, t) {
  const b = Math.sin(t * .08) * 1.4; star(g, x, y + b, 6.2, 2.8, '#ffd21a', INK, .8);
  g.fillStyle = 'rgba(255,255,255,.9)'; const s = (Math.sin(t * .15) + 1) * .5; g.fillRect(x - 5 + s * 8, y + b - 4, .8, .8);
}
export function gem(g, x, y, t) {
  const b = Math.sin(t * .07) * 1; g.beginPath(); g.moveTo(x, y - 6 + b); g.lineTo(x + 4.5, y + b); g.lineTo(x, y + 6 + b); g.lineTo(x - 4.5, y + b); g.closePath();
  g.fillStyle = '#b44cff'; g.fill(); g.strokeStyle = INK; g.lineWidth = .7; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = '#e6b8ff'; g.beginPath(); g.moveTo(x, y - 5 + b); g.lineTo(x + 2, y + b); g.lineTo(x, y + b); g.fill();
}
export function laddu(g, x, y) { // x,y = centre
  g.fillStyle = INK; blob(g, x, y, 6.7, 6.7); g.fillStyle = '#f3a019'; blob(g, x, y, 6, 6);
  g.fillStyle = '#ffd36b'; blob(g, x - 1.6, y - 2, 2.6, 1.8); g.fillStyle = '#c36b00'; [[-2, 2], [2, 1], [0, -1], [3, -2.5], [-3, -.5], [1, 3.6]].forEach(([dx, dy]) => blob(g, x + dx, y + dy, .55, .55));
}
export function mango(g, x, y) {
  g.save(); g.translate(x, y); g.rotate(-.35);
  g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, 6.2, 7.6, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(-5, -6, 5, 6); gr.addColorStop(0, '#ffd23a'); gr.addColorStop(.6, '#ff9a1e'); gr.addColorStop(1, '#e8412a');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 5.4, 6.8, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffffff55'; blob(g, -2, -2.5, 1.3, 2.2); g.fillStyle = '#2f9a45'; g.beginPath(); g.ellipse(2.4, -7.2, 3, 1.4, -.5, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = .5; g.stroke(); g.restore();
}
export function key(g, x, y, t) {
  const b = Math.sin(t * .08) * 1.5; g.save(); g.translate(x, y + b);
  g.fillStyle = 'rgba(120,220,255,.25)'; blob(g, 0, 0, 10, 10);
  g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.arc(-3, 0, 3.4, 0, TAU); g.moveTo(0, 0); g.lineTo(8, 0); g.moveTo(6, 0); g.lineTo(6, 3); g.moveTo(8, 0); g.lineTo(8, 3); g.stroke();
  g.strokeStyle = '#ffc21a'; g.lineWidth = 1.4; g.stroke(); g.restore();
}

/* ============================ ENEMIES ============================ */
const eyes = (g, x, y, dir, big) => {
  [-1.8, 1.8].forEach(dx => { g.fillStyle = '#fff'; blob(g, x + dx, y, 1.5 * big, 1.8 * big); g.fillStyle = '#111'; blob(g, x + dx + dir * .5, y + .3, .75 * big, .95 * big); });
  g.strokeStyle = INK; g.lineWidth = .7; g.beginPath(); g.moveTo(x - 4, y - 2.8 * big); g.lineTo(x - .6, y - 1.6 * big); g.moveTo(x + 4, y - 2.8 * big); g.lineTo(x + .6, y - 1.6 * big); g.stroke();
};
export function walker(g, e, t) { // e.x,e.y top-left, 12x12
  const cx = e.x + 6, by = e.y + 12; g.save(); g.translate(cx, by);
  if (e.flip) g.scale(1, -1);
  if (e.squash) { g.fillStyle = INK; blob(g, 0, -2, 7.4, 3); g.fillStyle = '#a9622d'; blob(g, 0, -2, 6.6, 2.4); g.restore(); return; }
  const st = Math.floor(t / 8) % 2;
  g.fillStyle = '#5a2f12'; g.strokeStyle = INK; g.lineWidth = .7;
  [[-3.6 + st, 0], [3.6 - st, 0]].forEach(([fx]) => { g.beginPath(); g.ellipse(fx, -1, 2.8, 1.8, 0, 0, TAU); g.fill(); g.stroke(); });
  g.fillStyle = '#b06a30'; g.beginPath(); g.ellipse(0, -6.2, 6.4, 5.6, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#d99a5a'; blob(g, 0, -3.6, 4, 2.2); eyes(g, 0, -7, Math.sign(e.vx || -1), 1); g.restore();
}
export function shell(g, e, t) { // 12x14 walking / 12x10 shell
  const cx = e.x + e.w / 2, by = e.y + e.h; g.save(); g.translate(cx, by); if (e.flip) g.scale(1, -1);
  g.lineWidth = .7; g.strokeStyle = INK;
  if (e.state === 0) {
    const dir = Math.sign(e.vx || -1), st = Math.floor(t / 8) % 2; g.scale(dir, 1);
    g.fillStyle = '#e0b878'; [[-3 + st, 0], [3 - st, 0]].forEach(([fx]) => { g.beginPath(); g.ellipse(fx, -1, 2.3, 1.5, 0, 0, TAU); g.fill(); g.stroke(); });
    g.beginPath(); g.ellipse(5, -9, 3.2, 3.4, 0, 0, TAU); g.fill(); g.stroke();             // head
    g.fillStyle = '#111'; blob(g, 6.2, -9.6, .8, 1);
    g.fillStyle = '#b8401f'; g.beginPath(); g.ellipse(-.5, -6, 6, 5.4, 0, Math.PI, 0); g.lineTo(5.5, -5.8); g.lineTo(-6.5, -5.8); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#ffb36b'; g.lineWidth = .6; g.beginPath(); g.moveTo(-3, -10); g.lineTo(-3, -6); g.moveTo(1.6, -10.6); g.lineTo(1.6, -6); g.stroke();
  } else {
    g.save(); if (e.state === 2) g.rotate(t * .4 * Math.sign(e.vx)); else g.translate(0, 0);
    g.fillStyle = '#b8401f'; g.beginPath(); g.ellipse(0, e.state === 2 ? -5 : -4.5, 6, 4.8, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
    g.fillStyle = '#e0b878'; g.fillRect(-5.4, -2, 10.8, 1.6); g.strokeStyle = '#ffb36b'; g.lineWidth = .6; g.beginPath(); g.moveTo(-2.4, -8); g.lineTo(-2.4, -2.4); g.moveTo(2.4, -8); g.lineTo(2.4, -2.4); g.stroke();
  }
  g.restore();
}
export function bat(g, e, t) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, fl = Math.sin(t * .35) * 5; g.save(); g.translate(cx, cy); if (e.flip) g.scale(1, -1);
  g.fillStyle = '#6a2f45'; g.strokeStyle = INK; g.lineWidth = .7; g.lineJoin = 'round';
  [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 2, -1); g.lineTo(s * 9, -5 + fl * .6); g.lineTo(s * 12, 1 + fl); g.lineTo(s * 8, .6 + fl * .4); g.lineTo(s * 6, 3.4 + fl * .3); g.lineTo(s * 2, 3); g.closePath(); g.fill(); g.stroke(); });
  g.fillStyle = '#8c4660'; blob(g, 0, 1, 3.6, 4); g.stroke();
  g.fillStyle = '#6a2f45'; g.beginPath(); g.moveTo(-3, -2); g.lineTo(-2.4, -6); g.lineTo(-.6, -3); g.moveTo(3, -2); g.lineTo(2.4, -6); g.lineTo(.6, -3); g.fill();
  g.fillStyle = '#ffdd33'; blob(g, -1.5, .4, .9, .9); blob(g, 1.5, .4, .9, .9); g.restore();
}
export function golem(g, e, t) { // 14x16
  const cx = e.x + e.w / 2, by = e.y + e.h, st = e.stun > 0 ? 0 : Math.sin(t * .15) * 1; g.save(); g.translate(cx, by); if (e.flip) g.scale(1, -1);
  g.strokeStyle = INK; g.lineWidth = .7; g.lineJoin = 'round';
  const cracked = e.hp < 2, body = cracked ? '#8a8494' : '#9d97ab';
  g.fillStyle = '#6e687c'; g.fillRect(-6, -5, 4.6, 5); g.strokeRect(-6, -5, 4.6, 5); g.fillRect(1.4, -5, 4.6, 5 ); g.strokeRect(1.4, -5, 4.6, 5);
  g.fillStyle = body; g.fillRect(-6.4, -12.5, 12.8, 8); g.strokeRect(-6.4, -12.5, 12.8, 8);
  g.fillRect(-8.6 + st, -12, 2.6, 7); g.strokeRect(-8.6 + st, -12, 2.6, 7); g.fillRect(6 - st, -12, 2.6, 7); g.strokeRect(6 - st, -12, 2.6, 7);
  g.fillStyle = '#b3adc1'; g.fillRect(-4.8, -18, 9.6, 6.2); g.strokeRect(-4.8, -18, 9.6, 6.2);
  g.fillStyle = e.stun > 0 ? '#555' : '#ffb02a'; blob(g, -1.9, -15, 1, 1.1); blob(g, 1.9, -15, 1, 1.1);
  if (cracked) { g.strokeStyle = '#3a3450'; g.lineWidth = .5; g.beginPath(); g.moveTo(-1, -18); g.lineTo(0, -15); g.lineTo(-1.6, -12); g.stroke(); }
  g.restore();
}
export function ball(g, e) { // 20x20
  const cx = e.x + 10, cy = e.y + 10; g.save(); g.translate(cx, cy);
  g.fillStyle = INK; blob(g, 0, 0, 10.6, 10.6);
  const gr = g.createRadialGradient(-3, -3, 1, 0, 0, 10); gr.addColorStop(0, '#c9bba3'); gr.addColorStop(1, '#85775f'); g.fillStyle = gr; blob(g, 0, 0, 10, 10);
  g.save(); g.rotate(e.rot || 0); g.strokeStyle = '#5a4c38'; g.lineWidth = .9; g.beginPath(); g.arc(0, 0, 7, 0, 4.4); g.stroke(); g.beginPath(); g.arc(0, 0, 3.6, 1, 5.2); g.stroke(); g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.moveTo(0, -9); g.lineTo(0, 9); g.stroke(); g.restore();
  g.fillStyle = '#fff6c2'; blob(g, -3, -1.5, 2, 2.2); blob(g, 3, -1.5, 2, 2.2); g.fillStyle = '#d33'; blob(g, -2.6, -1.3, 1, 1.2); blob(g, 3.4, -1.3, 1, 1.2); g.restore();
}
export function fire(g, x, y, dir, len, t) { // flame from x,y (mouth) outward; y centre
  if (len < 2) return; g.save(); g.translate(x, y); g.scale(dir, 1);
  const f = Math.sin(t * .6) * 1.2;
  [['#3a7dff', 1], ['#ff7a1a', .82], ['#ffd84a', .58], ['#fff6c8', .34]].forEach(([c, k]) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(0, -5 * k); g.quadraticCurveTo(len * .5, -6.5 * k + f, len * k + 2, f * .5); g.quadraticCurveTo(len * .5, 6.5 * k - f, 0, 5 * k); g.closePath(); g.fill();
  }); g.restore();
}
export function spark(g, x, y, t) { g.fillStyle = (Math.floor(t / 4) % 2) ? '#ffd84a' : '#ff7a1a'; blob(g, x, y, 2 + Math.sin(t * .8), 2 + Math.sin(t * .8)); }
export function chain(g, px, py, ang, len, t) {
  const bx = px + Math.sin(ang) * len, by = py + Math.cos(ang) * len;
  g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(px, py); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = '#9aa0ac'; g.lineWidth = 1.2; g.setLineDash([2, 1.4]); g.stroke(); g.setLineDash([]);
  g.fillStyle = INK; blob(g, bx, by, 8.2, 8.2); const gr = g.createRadialGradient(bx - 2, by - 2, 1, bx, by, 7.5); gr.addColorStop(0, '#c7ccd8'); gr.addColorStop(1, '#5f6577');
  g.fillStyle = gr; blob(g, bx, by, 7.5, 7.5);
  g.strokeStyle = INK; g.lineWidth = .7; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + ang; g.beginPath(); g.moveTo(bx + Math.cos(a) * 7.5, by + Math.sin(a) * 7.5); g.lineTo(bx + Math.cos(a) * 10.5, by + Math.sin(a) * 10.5); g.stroke(); }
  g.fillStyle = '#6b7184'; g.beginPath(); g.arc(px, py, 2.4, 0, TAU); g.fill(); g.stroke();
}
export function gear(g, x, y, r, teeth, rot, fill, edge) {
  g.beginPath(); for (let i = 0; i < teeth * 2; i++) { const a = rot + i * Math.PI / teeth, rr = i % 2 ? r * .82 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a - .12) * rr, y + Math.sin(a - .12) * rr); g.lineTo(x + Math.cos(a + .12) * rr, y + Math.sin(a + .12) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = .8; g.lineJoin = 'round'; g.stroke(); }
}
export function plat(g, p, t) { // solid-top slab
  if (p.mode === 'O') {
    const cx = p.x + p.w / 2, cy = p.y + 13;
    gear(g, cx, cy, 14, 10, (p.rot || 0), '#8a6a2a', INK); gear(g, cx, cy, 10.5, 8, -(p.rot || 0) * 1.2, '#b98a34', null);
    g.fillStyle = '#5a4316'; blob(g, cx, cy, 3.2, 3.2); g.strokeStyle = INK; g.lineWidth = .6; g.stroke();
    g.fillStyle = '#d9b25a'; g.fillRect(p.x + 1, p.y - .4, p.w - 2, 1.4); return;
  }
  const sh = p.mode === 'c' && p.state === 1 ? Math.sin(t * 2.4) * .7 : 0;
  g.save(); g.translate(sh, 0);
  g.fillStyle = INK; g.fillRect(p.x - .7, p.y - .7, p.w + 1.4, p.h + 1.4);
  g.fillStyle = p.mode === 'c' ? '#8d7a66' : '#8b829f'; g.fillRect(p.x, p.y, p.w, p.h);
  g.fillStyle = p.mode === 'c' ? '#b39e86' : '#b0a7c4'; g.fillRect(p.x, p.y, p.w, 1.6);
  g.fillStyle = '#ffffff22'; for (let i = 3; i < p.w - 2; i += 6) g.fillRect(p.x + i, p.y + 3, 2.4, 1.6);
  if (p.mode === 'c') { g.strokeStyle = '#3d3326'; g.lineWidth = .5; g.beginPath(); g.moveTo(p.x + 9, p.y); g.lineTo(p.x + 11, p.y + 3); g.lineTo(p.x + 8, p.y + p.h); g.stroke(); }
  g.restore();
}
export function trident(g, x, y, dir) { g.save(); g.translate(x, y); g.scale(dir, 1); g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-7, 0); g.lineTo(6, 0); g.moveTo(3, -3); g.lineTo(3, 3); g.moveTo(3, -3); g.lineTo(7, -3); g.moveTo(3, 3); g.lineTo(7, 3); g.moveTo(6, 0); g.lineTo(9, 0); g.stroke(); g.strokeStyle = '#ffc21a'; g.lineWidth = 1; g.stroke(); g.restore(); }
export function wave(g, x, y, t) { g.fillStyle = '#ffb02a'; g.beginPath(); g.moveTo(x - 6, y + 5); g.quadraticCurveTo(x - 3, y - 6 + Math.sin(t * .5) * 1.5, x, y - 7); g.quadraticCurveTo(x + 3, y - 6, x + 6, y + 5); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = .7; g.stroke(); g.fillStyle = '#fff2a8'; g.beginPath(); g.moveTo(x - 2.5, y + 5); g.quadraticCurveTo(x, y - 3, x + 2.5, y + 5); g.fill(); }

export function boss(g, b, t) { // 28 x 36, origin = feet centre
  const cx = b.x + b.w / 2, by = b.y + b.h; g.save(); g.translate(cx, by);
  if (b.state === 'die') g.translate((Math.random() - .5) * 2, (Math.random() - .5) * 2);
  if (b.inv > 0 && Math.floor(b.inv / 4) % 2) g.globalAlpha = .45;
  const f = -(b.face || -1); g.scale(-f, 1); // face direction
  g.lineJoin = 'round'; g.lineWidth = .9; g.strokeStyle = INK;
  const dizzy = b.state === 'dizzy', up = b.state === 'slam' && b.timer < 45 ? 1 : 0, sw = Math.sin(t * .1) * 1.5;
  // lower body / dhoti
  g.fillStyle = '#7a5a32'; g.beginPath(); g.moveTo(-9, -14); g.lineTo(9, -14); g.lineTo(11, -2); g.lineTo(-11, -2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#5a3f20'; g.fillRect(-12, -3, 10, 3); g.fillRect(2, -3, 10, 3); g.strokeRect(-12, -3, 10, 3); g.strokeRect(2, -3, 10, 3);
  // torso
  g.fillStyle = '#7e8a78'; g.beginPath(); g.ellipse(0, -21, 9.5, 8.5, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#c59a3a'; g.fillRect(-9.4, -15.6, 18.8, 2.6); g.strokeRect(-9.4, -15.6, 18.8, 2.6);
  // six arms
  const arms = [[-9, -25, -19, up ? -44 : -27 + sw, '#c59a3a'], [-9, -21, -21, up ? -38 : -18 - sw, '#9aa0ac'], [-8, -17, -17, up ? -32 : -10 + sw, '#ffc21a'],
    [9, -25, 19, up ? -44 : -27 - sw, '#c59a3a'], [9, -21, 21, up ? -38 : -18 + sw, '#9aa0ac'], [8, -17, 17, up ? -32 : -10 - sw, '#ffc21a']];
  arms.forEach(([sx, sy, hx, hy, w]) => {
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 4.4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = '#7e8a78'; g.lineWidth = 2.8; g.stroke(); g.fillStyle = w; g.strokeStyle = INK; g.lineWidth = .7; blob(g, hx, hy, 2.6, 2.6); g.stroke();
  });
  g.fillStyle = '#9aa0ac'; g.fillRect(-21.6, (up ? -38 : -18 - sw) - 7, 1.6, 8); g.strokeRect(-21.6, (up ? -38 : -18 - sw) - 7, 1.6, 8);
  // head
  g.fillStyle = '#8c987f'; g.beginPath(); g.ellipse(0, -31, 6.2, 6, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#c59a3a'; g.beginPath(); g.moveTo(-6.4, -34); g.lineTo(-4, -42); g.lineTo(-1.6, -36); g.lineTo(0, -44); g.lineTo(1.6, -36); g.lineTo(4, -42); g.lineTo(6.4, -34); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = dizzy ? '#555' : '#ff2a1a'; blob(g, -2.4, -31.5, 1.3, 1.3); blob(g, 2.4, -31.5, 1.3, 1.3);
  if (!dizzy) { g.fillStyle = 'rgba(255,40,20,.35)'; blob(g, -2.4, -31.5, 3.2, 3.2); blob(g, 2.4, -31.5, 3.2, 3.2); }
  g.strokeStyle = INK; g.lineWidth = .8; g.beginPath(); g.moveTo(-3, -28.4); g.lineTo(3, -28.4); g.stroke();
  if (dizzy) { g.strokeStyle = '#ffd54a'; g.lineWidth = .8; for (let i = 0; i < 3; i++) { const a = t * .15 + i * 2.1; g.beginPath(); g.arc(Math.cos(a) * 8, -40 + Math.sin(a) * 2.6, 1, 0, TAU); g.stroke(); } }
  g.restore();
}

/* ============================ FIXTURES ============================ */
export function checkpoint(g, x, by, on, t) { // x centre, by = ground y
  g.fillStyle = INK; g.fillRect(x - 1.1, by - 28, 2.2, 28); g.fillStyle = '#c9c2d6'; g.fillRect(x - .6, by - 27.5, 1.2, 27.5);
  g.fillStyle = INK; blob(g, x, by - 28.5, 2.2, 2.2); g.fillStyle = '#ffc21a'; blob(g, x, by - 28.5, 1.5, 1.5);
  const w = Math.sin(t * .15) * 1.2; g.beginPath(); g.moveTo(x + 1, by - 26); g.quadraticCurveTo(x + 7, by - 26 + w, x + 13, by - 24); g.quadraticCurveTo(x + 7, by - 22 - w, x + 13, by - 18.5); g.lineTo(x + 1, by - 18); g.closePath();
  g.fillStyle = on ? '#3ddc5a' : '#c83a3a'; g.fill(); g.strokeStyle = INK; g.lineWidth = .7; g.stroke();
  if (on) star(g, x + 6, by - 22, 2.6, 1.1, '#fff6a8', null);
}
export function flagpole(g, x, by, h, t) { // x centre, pole height h
  g.fillStyle = INK; g.fillRect(x - 1.6, by - h, 3.2, h); g.fillStyle = '#e6e6f2'; g.fillRect(x - 1, by - h, 2, h);
  g.fillStyle = INK; blob(g, x, by - h - 1, 3.6, 3.6); g.fillStyle = '#ffc21a'; blob(g, x, by - h - 1, 2.8, 2.8);
  const w = Math.sin(t * .13) * 1.4; g.beginPath(); g.moveTo(x - 1.6, by - h + 2); g.quadraticCurveTo(x - 10, by - h + 2 + w, x - 19, by - h + 5); g.quadraticCurveTo(x - 10, by - h + 8 - w, x - 19, by - h + 12); g.lineTo(x - 1.6, by - h + 12); g.closePath();
  g.fillStyle = '#ff9a1a'; g.fill(); g.strokeStyle = INK; g.lineWidth = .8; g.stroke(); star(g, x - 9, by - h + 7.4, 3, 1.3, '#fff3a6', null);
  g.fillStyle = INK; g.fillRect(x - 5, by - 3, 10, 3); g.fillStyle = '#9a8a70'; g.fillRect(x - 4.4, by - 2.6, 8.8, 2.2);
  // little gate beside the pole
  const gx = x + 26; g.fillStyle = '#d9b98a'; g.fillRect(gx - 12, by - 26, 24, 26); g.strokeStyle = INK; g.lineWidth = .8; g.strokeRect(gx - 12, by - 26, 24, 26);
  g.fillStyle = '#b8915f'; g.fillRect(gx - 9, by - 32, 18, 6); g.strokeRect(gx - 9, by - 32, 18, 6); g.fillRect(gx - 6, by - 37, 12, 5); g.strokeRect(gx - 6, by - 37, 12, 5);
  g.fillStyle = '#ffc21a'; blob(g, gx, by - 38.4, 1.8, 2.6); g.fillStyle = '#3b2412'; g.beginPath(); g.moveTo(gx - 5, by); g.lineTo(gx - 5, by - 11); g.arc(gx, by - 11, 5, Math.PI, 0); g.lineTo(gx + 5, by); g.fill();
}
export function templeDoor(g, x, by, open, t) { // 16 wide x 32 tall, x = left
  g.fillStyle = INK; g.fillRect(x - 2, by - 35, 20, 35); g.fillStyle = '#6c6282'; g.fillRect(x - 1.2, by - 34.2, 18.4, 34.2);
  g.fillStyle = open ? '#ffd86b' : '#2f2620'; g.beginPath(); g.moveTo(x + 1, by); g.lineTo(x + 1, by - 22); g.arc(x + 8, by - 22, 7, Math.PI, 0); g.lineTo(x + 15, by); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = .8; g.stroke();
  if (!open) { g.strokeStyle = '#7a7f8c'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 3 + i * 3.4, by); g.lineTo(x + 3 + i * 3.4, by - 28); g.stroke(); } g.strokeStyle = '#9aa0ac'; g.beginPath(); g.moveTo(x + 1, by - 14); g.lineTo(x + 15, by - 14); g.stroke();
    g.fillStyle = '#ffc21a'; g.fillRect(x + 5, by - 18, 6, 6); g.strokeStyle = INK; g.lineWidth = .6; g.strokeRect(x + 5, by - 18, 6, 6); g.fillStyle = INK; blob(g, x + 8, by - 16, .9, .9); }
  else { g.fillStyle = 'rgba(255,240,170,.5)'; g.beginPath(); g.moveTo(x + 4, by); g.lineTo(x + 12, by); g.lineTo(x + 26, by + 6); g.lineTo(x - 10, by + 6); g.fill(); }
}
export function torch(g, x, by, t, glow) { // x centre, by = base
  g.fillStyle = INK; g.fillRect(x - 2.2, by - 9, 4.4, 9); g.fillStyle = '#7a5a32'; g.fillRect(x - 1.4, by - 8.4, 2.8, 8.4);
  g.fillStyle = '#9aa0ac'; g.beginPath(); g.moveTo(x - 3.6, by - 9); g.lineTo(x + 3.6, by - 9); g.lineTo(x + 2.4, by - 12); g.lineTo(x - 2.4, by - 12); g.fill(); g.strokeStyle = INK; g.lineWidth = .6; g.stroke();
  const f = Math.sin(t * .4 + x) * 1, h = 7 + f;
  [['#ff7a1a', 3.6, h], ['#ffd84a', 2.4, h * .7], ['#fff6c8', 1.2, h * .4]].forEach(([c, w, hh]) => { g.fillStyle = c; g.beginPath(); g.moveTo(x - w, by - 12); g.quadraticCurveTo(x - w * 1.1, by - 12 - hh * .6, x + f * .3, by - 12 - hh); g.quadraticCurveTo(x + w * 1.1, by - 12 - hh * .6, x + w, by - 12); g.closePath(); g.fill(); });
  if (glow) { g.save(); g.globalCompositeOperation = 'lighter'; const r = g.createRadialGradient(x, by - 14, 1, x, by - 14, 46); r.addColorStop(0, 'rgba(255,150,40,.32)'); r.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = r; g.fillRect(x - 48, by - 62, 96, 96); g.restore(); }
}

/* ============================ HERO ============================ */
export function heroArt(g, o) {
  const SK = '#b97a48', SKD = '#9a6236';
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = .75;
  const s1 = Math.sin(o.ph), c1 = Math.cos(o.ph);
  const ffx = o.air ? (o.rising ? 2.8 : 2) : o.moving ? s1 * 2.8 : 0, ffy = o.air ? (o.rising ? -2.6 : -1.4) : o.moving ? -Math.max(0, c1) * 1.3 : 0;
  const bfx = o.air ? (o.rising ? -3 : -2.2) : o.moving ? -s1 * 2.8 : 0, bfy = o.air ? (o.rising ? -.6 : -2.2) : o.moving ? -Math.max(0, -c1) * 1.3 : 0;
  const fa = o.air ? (o.rising ? 2.7 : 1.9) : o.moving ? s1 * .95 + .1 : .12, ba = o.air ? -.6 : o.moving ? -s1 * .95 - .1 : -.12;
  const sway = o.moving ? s1 * .7 : 0;
  const arm = (sx, sy, a, col) => {
    const L = 4.7, hx = sx + Math.sin(a) * L, hy = sy + Math.cos(a) * L;
    g.lineWidth = 3.4; g.strokeStyle = INK; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
    g.lineWidth = 2; g.strokeStyle = col; g.stroke();
    g.lineWidth = .75; g.strokeStyle = INK; g.fillStyle = col; g.beginPath(); g.arc(hx, hy, 1.45, 0, TAU); g.fill(); g.stroke();
  };
  const leg = (x, y) => {
    g.fillStyle = SK; g.beginPath(); g.rect(x + .2, -4.4 + y, 1.9, 3.2); g.fill(); g.stroke();
    g.fillStyle = '#6b3d1c'; g.beginPath(); g.roundRect(x - 1.4, -1.8 + y, 4.8, 1.8, .8); g.fill(); g.stroke();
    g.strokeStyle = '#d2a468'; g.lineWidth = .45; g.beginPath(); g.moveTo(x + .3, -1.8 + y); g.lineTo(x + 1.4, -2.7 + y); g.stroke(); g.strokeStyle = INK; g.lineWidth = .75;
  };
  arm(-1, -12.3, ba, SKD);
  leg(-2.4 + bfx, bfy);
  g.save(); g.beginPath(); g.moveTo(-4.6, -8.8); g.lineTo(5, -8.8); g.lineTo(6.6 + sway, -3.4); g.quadraticCurveTo(sway, -2.4, -6.2 + sway, -3.4); g.closePath();
  g.fillStyle = '#37435d'; g.fill(); g.clip();
  g.lineWidth = .4; for (let x = -9; x < 9; x += 2.4) { g.strokeStyle = (x / 2.4 | 0) % 2 ? 'rgba(232,232,240,.55)' : 'rgba(196,71,90,.85)'; g.beginPath(); g.moveTo(x, -9); g.lineTo(x + 1.2, -2); g.stroke(); }
  for (let y = -8; y < -2; y += 1.8) { g.strokeStyle = 'rgba(196,71,90,.6)'; g.beginPath(); g.moveTo(-8, y); g.lineTo(8, y); g.stroke(); }
  g.restore(); g.lineWidth = .75; g.strokeStyle = INK;
  g.beginPath(); g.moveTo(-4.6, -8.8); g.lineTo(5, -8.8); g.lineTo(6.6 + sway, -3.4); g.quadraticCurveTo(sway, -2.4, -6.2 + sway, -3.4); g.closePath(); g.stroke();
  g.fillStyle = '#2c3650'; g.beginPath(); g.ellipse(3.8, -8.4, 1.7, 1.3, 0, 0, TAU); g.fill(); g.stroke();
  leg(0.4 + ffx, ffy);
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-4, -13.5); g.lineTo(4, -13.5); g.quadraticCurveTo(7, -10.6, 5.4, -8); g.lineTo(-4.8, -8); g.quadraticCurveTo(-5.8, -10.8, -4, -13.5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#dbe3f2'; g.beginPath(); g.moveTo(-4.4, -12.5); g.quadraticCurveTo(-5.4, -10.6, -4.6, -8.6); g.lineTo(-3.2, -8.6); g.quadraticCurveTo(-3.6, -10.6, -2.8, -12.6); g.fill();
  g.fillStyle = SK; g.beginPath(); g.ellipse(.9, -13.5, 2.3, 1.2, 0, 0, Math.PI); g.fill();
  g.strokeStyle = '#ffc21a'; g.lineWidth = .45; g.beginPath(); g.arc(.9, -13.6, 2.2, .2, Math.PI - .2); g.stroke(); g.strokeStyle = INK; g.lineWidth = .75;
  arm(1.6, -12.3, fa, SK);
  g.fillStyle = SK; g.beginPath(); g.ellipse(-3.6, -14.4, 1, 1.5, 0, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(.8, -14.5, 4.6, 4.2, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#2f2f36'; g.beginPath(); g.moveTo(-4.6, -14.2); g.quadraticCurveTo(-5.6, -19.4, .6, -19.2); g.quadraticCurveTo(5.4, -19, 5.6, -16.6); g.quadraticCurveTo(3.2, -17.8, .8, -16.9); g.quadraticCurveTo(-1.6, -16.4, -3, -14.2); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#b9b9c4'; g.lineWidth = .55; g.beginPath(); g.moveTo(-2.6, -18.2); g.quadraticCurveTo(.4, -19, 3.4, -17.9); g.stroke();
  g.fillStyle = '#8d8d98'; g.fillRect(-4.3, -15.6, 1.1, 2.2);
  g.strokeStyle = INK; g.lineWidth = .35;
  [1.5, 3.8].forEach(ex => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, -14.8, .95, 1.2, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(ex + .35, -14.7, .55, 0, TAU); g.fill(); });
  g.strokeStyle = INK; g.lineWidth = .6; g.beginPath(); g.moveTo(.5, -16.4); g.lineTo(2.3, -16.1); g.moveTo(3.1, -16.1); g.lineTo(4.8, -16.5); g.stroke();
  g.fillStyle = SKD; g.beginPath(); g.ellipse(5.5, -13.4, .9, .7, 0, 0, TAU); g.fill();
  g.fillStyle = '#1c1416'; g.beginPath(); g.moveTo(.4, -12.4); g.quadraticCurveTo(2, -14, 4.4, -13.2); g.quadraticCurveTo(5.8, -13, 6.5, -14.1); g.quadraticCurveTo(6.7, -12.2, 5, -11.9); g.quadraticCurveTo(2.6, -11.6, .4, -12.4); g.fill();
  g.strokeStyle = '#6b1f1f'; g.lineWidth = .45; g.beginPath(); g.arc(3.4, -11.3, .8, .3, Math.PI - .3); g.stroke();
}

/* ============================ BACKGROUNDS ============================ */
const grads = {};
function vgrad(g, key, VH, stops) { const k = key + VH; if (!grads[k]) { const gr = g.createLinearGradient(0, 0, 0, VH); stops.forEach(([o, c]) => gr.addColorStop(o, c)); grads[k] = gr; } return grads[k]; }
const SKIES = {
  village: [[0, '#3f9cf0'], [.55, '#8fd4ff'], [1, '#e9f6ff']],
  dusk: [[0, '#1c1b55'], [.5, '#5a3a86'], [1, '#e98a6a']],
  temple: [[0, '#151227'], [.6, '#2a2240'], [1, '#3a2c50']],
  treasury: [[0, '#1c1208'], [.6, '#3a2410'], [1, '#6a4418']],
  cog: [[0, '#0f1d26'], [.6, '#1c3340'], [1, '#2c4a54']],
  boss: [[0, '#140808'], [.6, '#2a0e12'], [1, '#4a1a1a']]
};
export function skyStops(kind) { return SKIES[kind] || SKIES.village; }
function cloud(g, x, y, s) {
  g.fillStyle = '#cfe6ff'; [[0, 4, 13], [16, 2, 16], [34, 4, 13], [17, 7, 15]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx * s, y + dy * s + 2, r * s, 0, TAU); g.fill(); });
  g.fillStyle = '#fff'; [[0, 2, 13], [16, -1, 16], [34, 2, 13], [17, 3, 14]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); });
}
function gopuram(g, ox, ob, dark) {
  g.save(); g.translate(ox, ob); g.scale(.6, .6);
  const c1 = dark ? '#2a2350' : '#e3c696', c2 = dark ? '#1e1a3e' : '#b8915f', win = dark ? '#ffb347' : '#4a3019', trim = dark ? '#3c3470' : '#f2dcb2';
  const stone = g.createLinearGradient(0, 0, 110, 0); stone.addColorStop(0, c1); stone.addColorStop(1, c2);
  g.fillStyle = dark ? '#221e46' : '#cfae7e'; g.fillRect(-80, -26, 270, 26);
  g.fillStyle = dark ? '#1a1736' : '#b08c5c'; for (let i = -80; i < 190; i += 14) g.fillRect(i, -26, 7, 26);
  const cx = 55; let y = -26; g.fillStyle = stone; g.fillRect(cx - 50, y - 18, 100, 18);
  g.fillStyle = dark ? '#ffb347' : '#5a3d22'; g.beginPath(); g.moveTo(cx - 9, y); g.lineTo(cx - 9, y - 11); g.arc(cx, y - 11, 9, Math.PI, 0); g.lineTo(cx + 9, y); g.fill();
  y -= 18;
  for (let i = 0; i < 6; i++) {
    const w = 94 - i * 13, h = 15; g.fillStyle = stone; g.fillRect(cx - w / 2, y - h, w, h); g.fillStyle = trim; g.fillRect(cx - w / 2 - 2, y - h - 1.5, w + 4, 2.5);
    const n = Math.max(1, Math.floor(w / 15)); for (let k = 0; k < n; k++) { const wx = cx - w / 2 + (k + .5) * (w / n); g.fillStyle = win; g.fillRect(wx - 2, y - h + 4, 4, 7); }
    y -= h + 1;
  }
  g.fillStyle = c2; g.beginPath(); g.ellipse(cx, y - 2, 14, 7, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#ffc21a'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(cx + k * 9, y - 12, 2, 5, 0, 0, TAU); g.fill(); }
  g.restore();
}
function hillLayer(g, VW, VH, cx, f, base, amp, wave, color, edge) {
  g.beginPath(); g.moveTo(0, VH + 4);
  for (let x = 0; x <= VW + 6; x += 6) { const wx = x + cx * f; g.lineTo(x, base - amp * (Math.sin(wx / wave) + .5 * Math.sin(wx / (wave * .43) + 1))); }
  g.lineTo(VW + 6, VH + 4); g.closePath(); g.fillStyle = color; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 1.4; g.stroke(); }
}
function palm(g, px, gy, s, dark) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = dark ? '#0d0b1f' : INK; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(px, gy); g.quadraticCurveTo(px + 9 * s, gy - 32 * s, px + 4 * s, gy - 62 * s); g.stroke();
  g.strokeStyle = dark ? '#191540' : '#8a5a30'; g.lineWidth = 4 * s; g.stroke();
  const tx = px + 4 * s, ty = gy - 62 * s;
  [[-28, 6], [-20, -8], [-6, -16], [10, -14], [24, -2], [30, 10]].forEach(([dx, dy]) => {
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + dx * .5 * s, ty + (dy - 14) * s, tx + dx * s, ty + (dy + 8) * s);
    g.strokeStyle = dark ? '#0d0b1f' : INK; g.lineWidth = 6.5 * s; g.stroke(); g.strokeStyle = dark ? '#14284a' : '#2f9a45'; g.lineWidth = 4.2 * s; g.stroke();
    if (!dark) { g.strokeStyle = '#66c863'; g.lineWidth = 1.4 * s; g.stroke(); }
  });
}
function imgPar(g, img, LV, cx, cy, VW, VH, align) {
  const sc = Math.max(VH / img.height, VW / img.width), iw = img.width * sc, ih = img.height * sc;
  const fx = Math.min(1, cx / Math.max(1, LV.w * T - VW)), fy = Math.min(1, cy / Math.max(1, LV.h * T - VH));
  g.drawImage(img, -fx * (iw - VW), align === 'bottom' ? VH - ih : -fy * (ih - VH), iw, ih);
}
function pillar(g, x, w, VH, col, hi) {
  g.fillStyle = col; g.fillRect(x, 0, w, VH); g.fillStyle = hi; g.fillRect(x, 0, 2, VH);
  g.fillRect(x - 3, 0, w + 6, 10); g.fillRect(x - 2, 14, w + 4, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + w - 3, 0, 3, VH);
  for (let y = 26; y < VH; y += 22) { g.fillStyle = hi; g.fillRect(x + 2, y, w - 4, 1.4); g.fillRect(x + w / 2 - 1, y + 3, 2, 8); }
}
export function drawBG(g, o) { // o: {kind, cx, cy, VW, VH, LV, tick, imgs, S}
  const { kind, cx, cy, VW, VH, LV, tick, imgs } = o, dy = cy - (LV.h * T - VH);
  g.fillStyle = vgrad(g, kind, VH, SKIES[kind] || SKIES.village); g.fillRect(0, 0, VW, VH);
  if (kind === 'village') {
    if (imgs.far) imgPar(g, imgs.far, LV, cx, cy, VW, VH);
    else {
      const k0 = Math.floor(cx * .05 / 240) - 1; for (let k = k0; k < k0 + Math.ceil(VW / 240) + 3; k++) cloud(g, k * 240 + 40 + 50 * Math.sin(k * 2.3) - cx * .05 + tick * .02, 26 + ((k * 53) % 38) - dy * .05, 1.1);
      const p0 = Math.floor(cx * .1 / 560) - 1; for (let k = p0; k < p0 + Math.ceil(VW / 560) + 3; k++) gopuram(g, k * 560 + 120 - cx * .1, 138 - dy * .12, false);
    }
    if (imgs.mid) imgPar(g, imgs.mid, LV, cx, cy, VW, VH, 'bottom');
    else {
      hillLayer(g, VW, VH, cx, .18, 112 - dy * .14, 12, 64, '#8fd49a', '#5faf6d');
      hillLayer(g, VW, VH, cx, .32, 124 - dy * .22, 11, 46, '#5bbd69', '#3f9a4e');
      const pp = 190, k1 = Math.floor(cx * .5 / pp) - 1; for (let k = k1; k < k1 + Math.ceil(VW / pp) + 3; k++) palm(g, k * pp + 50 + ((k * 41) % 60) - cx * .5, 150 - dy * .42, .75, false);
      hillLayer(g, VW, VH, cx, .5, 140 - dy * .34, 9, 34, '#3f9f4e', '#2b7a39');
    }
    return;
  }
  if (kind === 'dusk') {
    g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const sx = (i * 97 % 400) - cx * .02, sy = (i * 53) % 90; g.globalAlpha = .4 + .5 * Math.abs(Math.sin(tick * .03 + i)); g.fillRect(((sx % VW) + VW) % VW, sy, 1, 1); } g.globalAlpha = 1;
    g.fillStyle = '#ffeec2'; g.beginPath(); g.arc(VW - 60, 34 - dy * .05, 14, 0, TAU); g.fill();
    const p0 = Math.floor(cx * .1 / 520) - 1; for (let k = p0; k < p0 + Math.ceil(VW / 520) + 3; k++) gopuram(g, k * 520 + 100 - cx * .1, 138 - dy * .12, true);
    hillLayer(g, VW, VH, cx, .2, 118 - dy * .14, 10, 60, '#241f4e', '#2f2a66');
    const pp = 200, k1 = Math.floor(cx * .45 / pp) - 1; for (let k = k1; k < k1 + Math.ceil(VW / pp) + 3; k++) palm(g, k * pp + 60 + ((k * 41) % 60) - cx * .45, 150 - dy * .38, .7, true);
    hillLayer(g, VW, VH, cx, .45, 142 - dy * .3, 8, 36, '#181538', '#221e4a');
    return;
  }
  // ---- interiors ----
  const tintWall = { temple: '#2a2440', treasury: '#3a2a16', cog: '#1f3542', boss: '#2e1214' }[kind], tintHi = { temple: '#3d3458', treasury: '#5a4020', cog: '#2f4d5e', boss: '#4a1c1e' }[kind];
  // far arches
  const ap = 170, a0 = Math.floor(cx * .12 / ap) - 1;
  for (let k = a0; k < a0 + Math.ceil(VW / ap) + 3; k++) { const x = k * ap - cx * .12; g.fillStyle = tintWall; g.beginPath(); g.moveTo(x + 20, VH); g.lineTo(x + 20, 70); g.arc(x + ap / 2, 70, ap / 2 - 20, Math.PI, 0); g.lineTo(x + ap - 20, VH); g.closePath(); g.fill(); g.strokeStyle = tintHi; g.lineWidth = 1; g.stroke(); }
  if (kind === 'cog') {
    [[90, 70, 46, 14, .004], [280, 120, 62, 18, -.003], [470, 50, 40, 12, .005], [640, 110, 54, 16, -.004]].forEach(([gx, gy, r, tn, sp]) => {
      const pxx = ((gx - cx * .22) % (VW + 200) + VW + 200) % (VW + 200) - 60; gear(g, pxx, gy - dy * .15, r, tn, tick * sp * 10, '#2b4756', '#16252e'); gear(g, pxx, gy - dy * .15, r * .55, tn / 2 | 0, -tick * sp * 14, '#1c3340', null); });
  }
  if (kind === 'boss') { const sx = VW * .5 - cx * .05; g.fillStyle = '#1e0b0d'; g.beginPath(); g.ellipse(sx, 66, 26, 40, 0, 0, TAU); g.fill(); g.fillRect(sx - 40, 90, 80, 100); g.fillStyle = `rgba(255,40,20,${.5 + .3 * Math.sin(tick * .05)})`; g.beginPath(); g.arc(sx - 8, 56, 2.4, 0, TAU); g.arc(sx + 8, 56, 2.4, 0, TAU); g.fill(); }
  if (kind === 'treasury') { const gp = 70, g0 = Math.floor(cx * .4 / gp) - 1; for (let k = g0; k < g0 + Math.ceil(VW / gp) + 3; k++) { const x = k * gp - cx * .4; g.fillStyle = '#b8862a'; g.beginPath(); g.moveTo(x, VH); g.quadraticCurveTo(x + 30, VH - 50 - ((k * 37) % 25), x + 70, VH); g.fill(); g.fillStyle = '#ffd86b'; for (let j = 0; j < 4; j++) g.fillRect(x + 14 + j * 10 + (k % 3) * 2, VH - 16 - ((k + j) % 4) * 6, 2, 2); } }
  // wall courses + pillars
  g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 10 - (cy * .3) % 14; y < VH; y += 14) g.fillRect(0, y, VW, 1);
  const pp = 150, p0 = Math.floor(cx * .35 / pp) - 1;
  for (let k = p0; k < p0 + Math.ceil(VW / pp) + 3; k++) pillar(g, k * pp + 30 - cx * .35, 20, VH, tintWall, tintHi);
  // glow + vignette
  const v = g.createRadialGradient(VW / 2, VH * .55, VH * .3, VW / 2, VH * .55, VW * .62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = v; g.fillRect(0, 0, VW, VH);
}
