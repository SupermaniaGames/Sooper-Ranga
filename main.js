'use strict';
/* ==========================================================
   Sooper Ranga — engine (step 1, revision 2)
   - Renders at the screen's native resolution (no blur): the world is
     drawn in "world units" (1 tile = 16) and scaled by S.
   - Fixed 60 Hz update, tile collision, smooth camera, parallax.
   - All tuning numbers live in PHYS (world units per frame at 60 Hz).
   Add ?debug to the URL for a physics read-out, ?touch to force touch buttons.
   ========================================================== */
const T = 16, VH = 176, STEP = 1000 / 60;   // view is always 11 tiles tall
const DEBUG = /debug/.test(location.search);
const START_TILE = +(new URLSearchParams(location.search).get('start') || 0);   // ?start=90 spawns at tile column 90 (for testing)

const PHYS = {
  walk: 1.4, run: 2.4,
  accWalk: .09, accRun: .12, accAir: .085,
  fric: .07, airFric: .012,
  skid: .22, skidAir: .14,
  over: .04,
  jump: 5.5, jumpSpd: .25,        // ~3.5 tiles standing, ~4.3 tiles running (hold), ~1.6 tap
  gHold: .27, gFall: .6,
  maxFall: 6.5,
  coyote: 6, buffer: 6
};

const SOLID = new Set(['#', 'B', '?', 'H']);
const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d');
let S = 1, VW = 400;

const store = {
  get(k, d) { try { const v = localStorage.getItem('sr_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sr_' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------------- Audio (files if present, else synth) ---------------- */
const SFX_NAMES = ['jump', 'coin', 'stomp', 'powerup', 'hurt', 'death', 'clear'];
const SYN = {
  jump: [[280, .2, 'square', 640, 0]],
  coin: [[988, .07, 'square', 0, 0], [1319, .25, 'square', 0, .07]],
  stomp: [[240, .1, 'square', 90, 0]],
  powerup: [[392, .09, 'square', 0, 0], [494, .09, 'square', 0, .09], [587, .09, 'square', 0, .18], [784, .09, 'square', 0, .27], [988, .2, 'square', 0, .36]],
  hurt: [[420, .28, 'sawtooth', 90, 0]],
  death: [[523, .14, 'square', 0, 0], [494, .14, 'square', 0, .14], [440, .14, 'square', 0, .28], [220, .5, 'square', 70, .42]],
  clear: [[523, .12, 'square', 0, 0], [659, .12, 'square', 0, .12], [784, .12, 'square', 0, .24], [1047, .4, 'square', 0, .36]]
};
const AC = window.AudioContext || window.webkitAudioContext;
let ac = null, muted = store.get('muted', false);
const buffers = {};
async function loadSample(n) { try { const r = await fetch(n + '.mp3'); if (!r.ok) return; buffers[n] = await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) {} }
function audioInit() { if (!AC) return; if (!ac) { ac = new AC(); SFX_NAMES.forEach(loadSample); } if (ac.state === 'suspended') ac.resume(); }
function sfx(n) {
  if (muted || !ac) return;
  if (buffers[n]) { const s = ac.createBufferSource(); s.buffer = buffers[n]; s.connect(ac.destination); s.start(); return; }
  const t0 = ac.currentTime;
  (SYN[n] || []).forEach(([f, d, w, to, dl]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = w; o.frequency.setValueAtTime(f, t0 + dl);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dl + d);
    g.gain.setValueAtTime(.14, t0 + dl); g.gain.exponentialRampToValueAtTime(.001, t0 + dl + d);
    o.connect(g); g.connect(ac.destination); o.start(t0 + dl); o.stop(t0 + dl + d + .02);
  });
}
function paintMute() { $('#mute').textContent = muted ? '🔇' : '🔊'; }
$('#mute').onclick = () => { audioInit(); muted = !muted; store.set('muted', muted); paintMute(); };
paintMute();

/* ---------------- Input: keyboard + touch merged ---------------- */
const kb = {}, tc = {};
const inp = k => !!(kb[k] || tc[k]);
let jumpPress = false;
const KMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run' };
addEventListener('keydown', e => {
  audioInit();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play' && !e.repeat) setPause(!paused); e.preventDefault(); return; }
  const k = KMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k === 'jump' && !e.repeat) jumpPress = true;
  kb[k] = true;
});
addEventListener('keyup', e => { const k = KMAP[e.code]; if (k) { kb[k] = false; e.preventDefault(); } });
function clearInput() { for (const k in kb) kb[k] = false; for (const k in tc) tc[k] = false; $('#dpad').className = ''; document.querySelectorAll('.tb').forEach(b => b.classList.remove('on')); }

// action buttons (every release path clears the flag so a jump can never get "stuck")
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  const up = () => { tc[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', e => { audioInit(); try { b.setPointerCapture(e.pointerId); } catch (x) {} if (k === 'jump') jumpPress = true; tc[k] = true; b.classList.add('on'); e.preventDefault(); });
  ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => b.addEventListener(ev, up));
});
const dp = $('#dpad');
function dpSet(e) { const r = dp.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; tc.left = x < .46; tc.right = x > .54; dp.className = tc.left ? 'l' : tc.right ? 'r' : ''; }
dp.addEventListener('pointerdown', e => { audioInit(); try { dp.setPointerCapture(e.pointerId); } catch (x) {} dpSet(e); e.preventDefault(); });
dp.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') dpSet(e); });
const dpEnd = () => { tc.left = tc.right = false; dp.className = ''; };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => dp.addEventListener(ev, dpEnd));
if (matchMedia('(pointer:coarse)').matches || /touch/.test(location.search)) $('#touch').hidden = false;
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- Sizing: render at native resolution ---------------- */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  S = cv.height / VH; VW = cv.width / S;
  skyGrad = null; buildTiles();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));

/* ---------------- Optional art files (used automatically when present) ----------------
   hero.png      : row of 32x32 cells, facing right, feet at bottom centre:
                   idle, walk1, walk2, walk3, jump, skid
   tiles.png     : row of 16x16 cells: grass, dirt, brick, star block, used, hard
   bg-far.png    : any wide image (sky + far scenery), scrolls across the whole level
   bg-mid.png    : wide transparent PNG (hills, palms), bottom-aligned, scrolls faster
------------------------------------------------------------------------------------------- */
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
let heroImg = null, tilesImg = null, bgFar = null, bgMid = null;
Promise.all([loadImg('hero.png'), loadImg('tiles.png'), loadImg('bg-far.png'), loadImg('bg-mid.png')])
  .then(([h, t, f, m]) => { heroImg = h; tilesImg = t; bgFar = f; bgMid = m; if (t) buildTiles(); });

/* ---------------- Tile art (vector, drawn at native resolution) ---------------- */
const INK = '#2b1608';
const TS = {}; let tsz = T;
function mkTile(fn) { const c = document.createElement('canvas'); c.width = c.height = tsz; const g = c.getContext('2d'); g.scale(tsz / T, tsz / T); fn(g); return c; }
const blob = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
function star(g, cx, cy, R, r, fill, stroke, lw) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || .6; g.lineJoin = 'round'; g.stroke(); }
}
function artDirt(g) {
  g.fillStyle = '#a9622d'; g.fillRect(0, 0, T, T);
  g.fillStyle = '#8c4b20'; blob(g, 3.5, 9, 2.3, 1.5); blob(g, 11, 12.5, 2.7, 1.6); blob(g, 8.5, 5.5, 1.6, 1.1); blob(g, 14, 8, 1.3, 1);
  g.fillStyle = '#c98444'; blob(g, 6, 12, 1.1, .6); blob(g, 12, 7, 1, .6); blob(g, 2, 14, 1, .5); blob(g, 9, 9.5, .8, .5);
}
function artGrass(g) {
  artDirt(g);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(T, 0); g.lineTo(T, 5);
  for (let i = 4; i > 0; i--) g.quadraticCurveTo(i * 4 - 2, 8.4, (i - 1) * 4, 5);
  g.closePath(); g.fillStyle = '#3fae3f'; g.fill();
  g.fillStyle = '#86e35f'; g.fillRect(0, 0, T, 1.9);
  g.fillStyle = '#2c8f35'; g.fillRect(0, 3.3, T, .9);
  g.beginPath(); g.moveTo(T, 5); for (let i = 4; i > 0; i--) g.quadraticCurveTo(i * 4 - 2, 8.4, (i - 1) * 4, 5);
  g.strokeStyle = '#1f5a25'; g.lineWidth = .7; g.lineJoin = 'round'; g.stroke();
}
function artBrick(g) {
  g.fillStyle = '#3b1608'; g.fillRect(0, 0, T, T);
  g.save(); g.beginPath(); g.rect(0, 0, T, T); g.clip();
  for (let r = 0; r < 4; r++) for (let x = (r % 2 ? 0 : -4); x < T; x += 8) {
    g.fillStyle = '#cc5a2c'; g.fillRect(x + .6, r * 4 + .6, 6.8, 2.8);
    g.fillStyle = '#ec8d55'; g.fillRect(x + .6, r * 4 + .6, 6.8, .8);
    g.fillStyle = '#a9441f'; g.fillRect(x + .6, r * 4 + 2.8, 6.8, .6);
  }
  g.restore(); g.strokeStyle = INK; g.lineWidth = .7; g.strokeRect(.35, .35, T - .7, T - .7);
}
function artQ(g) {
  g.fillStyle = '#b86a00'; g.fillRect(0, 0, T, T);
  g.fillStyle = '#ffc928'; g.fillRect(1, 1, T - 2, T - 2);
  g.fillStyle = '#ffe680'; g.fillRect(1, 1, T - 2, 1.2); g.fillRect(1, 1, 1.2, T - 2);
  g.fillStyle = '#e29a10'; g.fillRect(1, T - 2.2, T - 2, 1.2); g.fillRect(T - 2.2, 1, 1.2, T - 2);
  g.fillStyle = '#b86a00'; [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]].forEach(([x, y]) => blob(g, x, y, .7, .7));
  star(g, 8, 8.4, 4.8, 2.1, '#fff3a6', '#a45a00', .7);
  g.strokeStyle = INK; g.lineWidth = .7; g.strokeRect(.35, .35, T - .7, T - .7);
}
function artUsed(g) { g.fillStyle = '#4a3520'; g.fillRect(0, 0, T, T); g.fillStyle = '#8a6a45'; g.fillRect(1, 1, T - 2, T - 2); g.fillStyle = '#4a3520'; [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]].forEach(([x, y]) => blob(g, x, y, .7, .7)); g.strokeStyle = INK; g.lineWidth = .7; g.strokeRect(.35, .35, T - .7, T - .7); }
function artHard(g) {
  g.fillStyle = '#444c60'; g.fillRect(0, 0, T, T); g.fillStyle = '#b9c1d4'; g.fillRect(0, 0, T - 1, T - 1);
  g.fillStyle = '#8b94ab'; g.fillRect(2, 2, T - 4, T - 4); g.fillStyle = '#a4adc2'; g.fillRect(2, 2, T - 4, 1.2);
  g.strokeStyle = '#5b6478'; g.lineWidth = .5; g.beginPath(); g.moveTo(5, 9); g.lineTo(8, 11); g.lineTo(10, 10); g.stroke();
  g.strokeStyle = INK; g.lineWidth = .7; g.strokeRect(.35, .35, T - .7, T - .7);
}
function buildTiles() {
  tsz = Math.ceil(T * S) + 1;
  if (tilesImg) { ['grass', 'dirt', 'brick', 'q', 'used', 'hard'].forEach((n, i) => TS[n] = mkTile(g => g.drawImage(tilesImg, i * T, 0, T, T, 0, 0, T, T))); return; }
  TS.dirt = mkTile(artDirt); TS.grass = mkTile(artGrass); TS.brick = mkTile(artBrick); TS.q = mkTile(artQ); TS.used = mkTile(artUsed); TS.hard = mkTile(artHard);
}

/* ---------------- Level ---------------- */
let LV = null;
const tileAt = (tx, ty) => tx < 0 || tx >= LV.w ? '#' : (ty < 0 || ty >= LV.h) ? '.' : LV.rows[ty][tx];
const solid = (tx, ty) => SOLID.has(tileAt(tx, ty));
async function loadLevel(url) {
  let res = await fetch(url, { cache: 'no-store' });
  if (!res.ok && url.startsWith('levels/')) res = await fetch(url.slice(7), { cache: 'no-store' });
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  const j = await res.json();
  const rows = j.rows.map(r => r.split('')); let start = { x: 2, y: 2 };
  rows.forEach((r, y) => r.forEach((c, x) => { if (c === 'P') { start = { x, y }; r[x] = '.'; } }));
  LV = { name: j.name, theme: j.theme, rows, w: rows[0].length, h: rows.length, start, url };
}

/* ---------------- Player ---------------- */
const P = {}, cam = {}; let parts = [], tick = 0, hintT = 0;
function resetPlayer() {
  Object.assign(P, { w: 12, h: 18, vx: 0, vy: 0, face: 1, onGround: false, wasGround: false, coyote: 0, buf: 0, jumping: false, anim: 0, dead: 0, sx: 1, sy: 1, lastVy: 0 });
  P.x = (START_TILE || LV.start.x) * T + 2; P.y = START_TILE ? (LV.start.y - 4) * T : (LV.start.y + 1) * T - P.h; P.px = P.x; P.py = P.y; jumpPress = false; parts = [];
  Object.assign(cam, { x: 0, y: 0, look: 0 }); camTarget(true); cam.px = cam.x; cam.py = cam.y;
  hintT = 360;
}
function killPlayer() { P.dead = 70; P.vx = 0; P.vy = -4.5; sfx('death'); }
function dust(x, y, n, dir) { for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - .5) * 6, y, vx: (Math.random() - .5) * .7 - dir * .35, vy: -Math.random() * .5 - .1, r: 1 + Math.random() * 1.3, life: 22 + Math.random() * 10, max: 32 }); }

function moveX(p) {
  p.x += p.vx;
  const top = Math.floor(p.y / T), bot = Math.floor((p.y + p.h - .01) / T);
  if (p.vx > 0) { const tx = Math.floor((p.x + p.w - .01) / T); for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { p.x = tx * T - p.w; p.vx = 0; break; } }
  else if (p.vx < 0) { const tx = Math.floor(p.x / T); for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { p.x = (tx + 1) * T; p.vx = 0; break; } }
}
function moveY(p) {
  p.lastVy = p.vy; p.y += p.vy; p.onGround = false;
  const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - .01) / T);
  if (p.vy > 0) { const ty = Math.floor((p.y + p.h - .01) / T); for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { p.y = ty * T - p.h; p.vy = 0; p.onGround = true; break; } }
  else if (p.vy < 0) {
    const ty = Math.floor(p.y / T);
    for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { p.y = (ty + 1) * T; p.vy = 0; p.jumping = false; /* step 2: bump block (tx,ty) here */ break; }
  }
}

function update() {
  const p = P; p.px = p.x; p.py = p.y; cam.px = cam.x; cam.py = cam.y; tick++;
  if (hintT > 0) hintT--;
  parts.forEach(q => { q.x += q.vx; q.y += q.vy; q.life--; }); parts = parts.filter(q => q.life > 0);
  if (p.dead > 0) { p.vy = Math.min(p.vy + .3, 7); p.y += p.vy; if (--p.dead === 0) resetPlayer(); return; }
  const dir = (inp('right') ? 1 : 0) - (inp('left') ? 1 : 0), run = inp('run');
  const maxV = run ? PHYS.run : PHYS.walk;

  if (dir) {
    p.face = dir;
    if (p.vx * dir < 0) { p.vx += dir * (p.onGround ? PHYS.skid : PHYS.skidAir); if (p.onGround && Math.abs(p.vx) > 1 && tick % 4 === 0) dust(p.x + p.w / 2, p.y + p.h, 1, Math.sign(p.vx)); }
    else if (Math.abs(p.vx) < maxV) { p.vx += dir * (p.onGround ? (run ? PHYS.accRun : PHYS.accWalk) : PHYS.accAir); if (Math.abs(p.vx) > maxV) p.vx = dir * maxV; }
    else p.vx -= Math.sign(p.vx) * PHYS.over * (p.onGround ? 1 : .25);
  } else {
    const f = p.onGround ? PHYS.fric : PHYS.airFric;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }

  if (p.onGround) p.coyote = PHYS.coyote; else if (p.coyote > 0) p.coyote--;
  if (jumpPress) { p.buf = PHYS.buffer; jumpPress = false; } else if (p.buf > 0) p.buf--;
  if (p.buf > 0 && p.coyote > 0) {
    p.vy = -(PHYS.jump + Math.abs(p.vx) * PHYS.jumpSpd);
    p.jumping = true; p.buf = 0; p.coyote = 0; p.onGround = false; sfx('jump');
    p.sx = .78; p.sy = 1.28; dust(p.x + p.w / 2, p.y + p.h, 4, p.face);
  }
  if (p.vy >= 0) p.jumping = false;
  p.vy += (inp('jump') && p.jumping && p.vy < 0) ? PHYS.gHold : PHYS.gFall;
  if (p.vy > PHYS.maxFall) p.vy = PHYS.maxFall;

  p.wasGround = p.onGround;
  moveX(p); moveY(p);
  if (p.onGround && !p.wasGround && p.lastVy > 2.2) { p.sx = 1.25; p.sy = .76; dust(p.x + p.w / 2, p.y + p.h, 5, 0); }
  p.sx += (1 - p.sx) * .22; p.sy += (1 - p.sy) * .22;
  if (p.onGround) p.anim += Math.abs(p.vx) * .12; else p.anim = 0;
  if (p.y > LV.h * T + 24) killPlayer();
  camTarget(false);
}

function camTarget(snap) {
  const p = P;
  cam.look += (p.face * 26 - cam.look) * .03;
  const tx = p.x + p.w / 2 - VW * .45 + cam.look;
  const top = VH * .36, bot = VH * .72, mid = VH * .58, sy = p.y - cam.y; let ty = cam.y;
  if (sy < top) ty = p.y - top; else if (sy > bot) ty = p.y - bot; else if (p.onGround) ty = p.y - mid;
  if (snap) { cam.x = tx; cam.y = p.y - mid; }
  else { cam.x += (tx - cam.x) * .1; cam.y += (ty - cam.y) * (p.onGround ? .08 : .18); }
  cam.x = Math.max(0, Math.min(cam.x, Math.max(0, LV.w * T - VW)));
  cam.y = Math.max(0, Math.min(cam.y, Math.max(0, LV.h * T - VH)));
}

/* ---------------- Background (village) ---------------- */
let skyGrad = null;
function cloud(x, y, s) {
  ctx.fillStyle = '#cfe6ff'; [[0, 4, 13], [16, 2, 16], [34, 4, 13], [17, 7, 15]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s + 2, r * s, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#fff'; [[0, 2, 13], [16, -1, 16], [34, 2, 13], [17, 3, 14]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); });
}
function gopuram(ox, ob) {
  const g = ctx; g.save(); g.translate(ox, ob); g.scale(.6, .6);
  const x = 0, b = 0, stone = g.createLinearGradient(0, 0, 110, 0);
  stone.addColorStop(0, '#e3c696'); stone.addColorStop(1, '#b8915f');
  g.fillStyle = '#cfae7e'; g.fillRect(x - 80, b - 26, 270, 26);                  // compound wall
  g.fillStyle = '#b08c5c'; for (let i = -80; i < 190; i += 14) g.fillRect(x + i, b - 26, 7, 26);
  g.fillStyle = '#dcbf90'; g.fillRect(x - 80, b - 29, 270, 4);
  const cx = x + 55; let y = b - 26;
  g.fillStyle = stone; g.fillRect(cx - 50, y - 18, 100, 18);
  g.fillStyle = '#5a3d22'; g.beginPath(); g.moveTo(cx - 9, y); g.lineTo(cx - 9, y - 11); g.arc(cx, y - 11, 9, Math.PI, 0); g.lineTo(cx + 9, y); g.fill();
  y -= 18;
  for (let i = 0; i < 6; i++) {
    const w = 94 - i * 13, h = 15;
    g.fillStyle = stone; g.fillRect(cx - w / 2, y - h, w, h);
    g.fillStyle = '#f2dcb2'; g.fillRect(cx - w / 2 - 2, y - h - 1.5, w + 4, 2.5);
    g.fillStyle = '#7a5630'; g.fillRect(cx - w / 2 - 2, y - 1, w + 4, 1.4);
    const n = Math.max(1, Math.floor(w / 15));
    for (let k = 0; k < n; k++) { const wx = cx - w / 2 + (k + .5) * (w / n); g.fillStyle = '#4a3019'; g.fillRect(wx - 2, y - h + 4, 4, 7); }
    y -= h + 1;
  }
  g.fillStyle = '#b8915f'; g.beginPath(); g.ellipse(cx, y - 2, 14, 7, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#ffc21a'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(cx + k * 9, y - 12, 2, 5, 0, 0, 7); g.fill(); }
  g.restore();
}
function hillLayer(cx, f, base, amp, wave, color, edge) {
  ctx.beginPath(); ctx.moveTo(0, VH + 4);
  for (let x = 0; x <= VW + 6; x += 6) { const wx = x + cx * f; ctx.lineTo(x, base - amp * (Math.sin(wx / wave) + .5 * Math.sin(wx / (wave * .43) + 1))); }
  ctx.lineTo(VW + 6, VH + 4); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.stroke(); }
}
function palm(px, gy, s) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(px, gy); ctx.quadraticCurveTo(px + 9 * s, gy - 32 * s, px + 4 * s, gy - 62 * s); ctx.stroke();
  ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 4 * s; ctx.stroke();
  const tx = px + 4 * s, ty = gy - 62 * s;
  [[-28, 6], [-20, -8], [-6, -16], [10, -14], [24, -2], [30, 10]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + dx * .5 * s, ty + (dy - 14) * s, tx + dx * s, ty + (dy + 8) * s);
    ctx.strokeStyle = INK; ctx.lineWidth = 6.5 * s; ctx.stroke(); ctx.strokeStyle = '#2f9a45'; ctx.lineWidth = 4.2 * s; ctx.stroke(); ctx.strokeStyle = '#66c863'; ctx.lineWidth = 1.4 * s; ctx.stroke();
  });
}
function drawImgParallax(img, cx, cy, align) {
  const sc = Math.max(VH / img.height, VW / img.width), iw = img.width * sc, ih = img.height * sc;
  const fx = Math.min(1, cx / Math.max(1, LV.w * T - VW)), fy = Math.min(1, cy / Math.max(1, LV.h * T - VH));
  ctx.drawImage(img, -fx * (iw - VW), align === 'bottom' ? VH - ih : -fy * (ih - VH), iw, ih);
}
function drawBG(cx, cy) {
  const dy = cy - (LV.h * T - VH);
  if (!skyGrad) { skyGrad = ctx.createLinearGradient(0, 0, 0, VH); skyGrad.addColorStop(0, '#3f9cf0'); skyGrad.addColorStop(.55, '#8fd4ff'); skyGrad.addColorStop(1, '#e9f6ff'); }
  if (bgFar) drawImgParallax(bgFar, cx, cy);
  else {
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, VW, VH);
    const k0 = Math.floor(cx * .05 / 240) - 1; for (let k = k0; k < k0 + Math.ceil(VW / 240) + 3; k++) cloud(k * 240 + 40 + 50 * Math.sin(k * 2.3) - cx * .05 + tick * .02, 26 + ((k * 53) % 38) - dy * .05, 1.1);
    const p0 = Math.floor(cx * .1 / 560) - 1; for (let k = p0; k < p0 + Math.ceil(VW / 560) + 3; k++) gopuram(k * 560 + 120 - cx * .1, 138 - dy * .12);
  }
  if (bgMid) drawImgParallax(bgMid, cx, cy, 'bottom');
  else {
    hillLayer(cx, .18, 112 - dy * .14, 12, 64, '#8fd49a', '#5faf6d');
    hillLayer(cx, .32, 124 - dy * .22, 11, 46, '#5bbd69', '#3f9a4e');
    const pp = 190, k1 = Math.floor(cx * .5 / pp) - 1;
    for (let k = k1; k < k1 + Math.ceil(VW / pp) + 3; k++) palm(k * pp + 50 + ((k * 41) % 60) - cx * .5, 150 - dy * .42, .75);
    hillLayer(cx, .5, 140 - dy * .34, 9, 34, '#3f9f4e', '#2b7a39');
  }
}

/* ---------------- Hero (vector art drawn in world units; origin = feet centre) ---------------- */
function heroArt(g, o) {
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
    g.lineWidth = .75; g.strokeStyle = INK; g.fillStyle = col; g.beginPath(); g.arc(hx, hy, 1.45, 0, 7); g.fill(); g.stroke();
  };
  const leg = (x, y) => {
    g.fillStyle = SK; g.beginPath(); g.rect(x + .2, -4.4 + y, 1.9, 3.2); g.fill(); g.stroke();
    g.fillStyle = '#6b3d1c'; g.beginPath(); g.roundRect(x - 1.4, -1.8 + y, 4.8, 1.8, .8); g.fill(); g.stroke();
    g.strokeStyle = '#d2a468'; g.lineWidth = .45; g.beginPath(); g.moveTo(x + .3, -1.8 + y); g.lineTo(x + 1.4, -2.7 + y); g.stroke(); g.strokeStyle = INK; g.lineWidth = .75;
  };
  arm(-1, -12.3, ba, SKD);
  leg(-2.4 + bfx, bfy);
  // lungi
  g.save(); g.beginPath(); g.moveTo(-4.6, -8.8); g.lineTo(5, -8.8); g.lineTo(6.6 + sway, -3.4); g.quadraticCurveTo(sway, -2.4, -6.2 + sway, -3.4); g.closePath();
  g.fillStyle = '#37435d'; g.fill(); g.clip();
  g.lineWidth = .4; for (let x = -9; x < 9; x += 2.4) { g.strokeStyle = (x / 2.4 | 0) % 2 ? 'rgba(232,232,240,.55)' : 'rgba(196,71,90,.85)'; g.beginPath(); g.moveTo(x, -9); g.lineTo(x + 1.2, -2); g.stroke(); }
  for (let y = -8; y < -2; y += 1.8) { g.strokeStyle = 'rgba(196,71,90,.6)'; g.beginPath(); g.moveTo(-8, y); g.lineTo(8, y); g.stroke(); }
  g.restore(); g.lineWidth = .75; g.strokeStyle = INK;
  g.beginPath(); g.moveTo(-4.6, -8.8); g.lineTo(5, -8.8); g.lineTo(6.6 + sway, -3.4); g.quadraticCurveTo(sway, -2.4, -6.2 + sway, -3.4); g.closePath(); g.stroke();
  g.fillStyle = '#2c3650'; g.beginPath(); g.ellipse(3.8, -8.4, 1.7, 1.3, 0, 0, 7); g.fill(); g.stroke();
  leg(0.4 + ffx, ffy);
  // vest
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-4, -13.5); g.lineTo(4, -13.5); g.quadraticCurveTo(7, -10.6, 5.4, -8); g.lineTo(-4.8, -8); g.quadraticCurveTo(-5.8, -10.8, -4, -13.5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#dbe3f2'; g.beginPath(); g.moveTo(-4.4, -12.5); g.quadraticCurveTo(-5.4, -10.6, -4.6, -8.6); g.lineTo(-3.2, -8.6); g.quadraticCurveTo(-3.6, -10.6, -2.8, -12.6); g.fill();
  g.fillStyle = SK; g.beginPath(); g.ellipse(.9, -13.5, 2.3, 1.2, 0, 0, Math.PI); g.fill();
  g.strokeStyle = '#ffc21a'; g.lineWidth = .45; g.beginPath(); g.arc(.9, -13.6, 2.2, .2, Math.PI - .2); g.stroke(); g.strokeStyle = INK; g.lineWidth = .75;
  arm(1.6, -12.3, fa, SK);
  // head
  g.fillStyle = SK; g.beginPath(); g.ellipse(-3.6, -14.4, 1, 1.5, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(.8, -14.5, 4.6, 4.2, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#2f2f36'; g.beginPath(); g.moveTo(-4.6, -14.2); g.quadraticCurveTo(-5.6, -19.4, .6, -19.2); g.quadraticCurveTo(5.4, -19, 5.6, -16.6); g.quadraticCurveTo(3.2, -17.8, .8, -16.9); g.quadraticCurveTo(-1.6, -16.4, -3, -14.2); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#b9b9c4'; g.lineWidth = .55; g.beginPath(); g.moveTo(-2.6, -18.2); g.quadraticCurveTo(.4, -19, 3.4, -17.9); g.stroke();
  g.fillStyle = '#8d8d98'; g.fillRect(-4.3, -15.6, 1.1, 2.2);
  g.strokeStyle = INK; g.lineWidth = .35;
  [1.5, 3.8].forEach(ex => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, -14.8, .95, 1.2, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(ex + .35, -14.7, .55, 0, 7); g.fill(); });
  g.strokeStyle = INK; g.lineWidth = .6; g.beginPath(); g.moveTo(.5, -16.4); g.lineTo(2.3, -16.1); g.moveTo(3.1, -16.1); g.lineTo(4.8, -16.5); g.stroke();
  g.fillStyle = SKD; g.beginPath(); g.ellipse(5.5, -13.4, .9, .7, 0, 0, 7); g.fill();
  g.fillStyle = '#1c1416'; g.beginPath(); g.moveTo(.4, -12.4); g.quadraticCurveTo(2, -14, 4.4, -13.2); g.quadraticCurveTo(5.8, -13, 6.5, -14.1); g.quadraticCurveTo(6.7, -12.2, 5, -11.9); g.quadraticCurveTo(2.6, -11.6, .4, -12.4); g.fill();
  g.strokeStyle = '#6b1f1f'; g.lineWidth = .45; g.beginPath(); g.arc(3.4, -11.3, .8, .3, Math.PI - .3); g.stroke();
}
function drawHero(x, y) {
  const p = P, g = ctx, fx = x + p.w / 2, fy = y + p.h;
  g.save(); g.translate(fx, fy);
  if (p.onGround && !p.dead) { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, .4, 6.5, 1.5, 0, 0, 7); g.fill(); }
  if (p.dead) g.rotate(Math.min(1, (70 - p.dead) / 18) * Math.PI * 1.6); else g.scale(p.face * p.sx, p.sy);
  const air = !p.onGround, moving = Math.abs(p.vx) > .15;
  if (heroImg) {
    const skid = p.onGround && ((inp('left') && p.vx > .6) || (inp('right') && p.vx < -.6));
    const f = air ? 4 : skid ? 5 : moving ? 1 + Math.floor(p.anim) % 3 : 0;
    g.drawImage(heroImg, f * 32, 0, 32, 32, -13, -26, 26, 26);
  } else heroArt(g, { ph: p.anim * 1.6, air, moving, rising: p.vy < 0, dead: p.dead });
  g.restore();
}

/* ---------------- Render ---------------- */
const lerp = (a, b, t) => a + (b - a) * t;
let fps = 60, fpsT = 0, fpsN = 0;
function drawTiles(cxd, cyd) {
  const x0 = Math.floor(cxd / S / T), x1 = Math.floor((cxd + cv.width) / S / T), y0 = Math.floor(cyd / S / T), y1 = Math.floor((cyd + cv.height) / S / T);
  const X = tx => Math.round(tx * T * S - cxd), Y = ty => Math.round(ty * T * S - cyd);
  for (let ty = y0; ty <= y1; ty++) for (let tx = Math.max(0, x0); tx <= Math.min(LV.w - 1, x1); tx++) {
    const c = tileAt(tx, ty); if (c === '.') continue;
    const s = c === '#' ? (tileAt(tx, ty - 1) === '#' ? TS.dirt : TS.grass) : c === 'B' ? TS.brick : c === '?' ? TS.q : c === 'H' ? TS.hard : null;
    if (s) ctx.drawImage(s, 0, 0, tsz, tsz, X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
  }
}
function render(a) {
  if (!LV) return;
  const cxd = Math.round(lerp(cam.px, cam.x, a) * S), cyd = Math.round(lerp(cam.py, cam.y, a) * S), cx = cxd / S, cy = cyd / S;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(S, 0, 0, S, 0, 0); drawBG(cx, cy);
  ctx.setTransform(1, 0, 0, 1, 0, 0); drawTiles(cxd, cyd);
  ctx.setTransform(S, 0, 0, S, -cxd, -cyd);            // world space
  parts.forEach(q => { ctx.globalAlpha = Math.max(0, q.life / q.max) * .7; ctx.fillStyle = '#f3e7cf'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
  drawHero(Math.round(lerp(P.px, P.x, a) * S) / S, Math.round(lerp(P.py, P.y, a) * S) / S);
  ctx.setTransform(S, 0, 0, S, 0, 0);                  // screen space in world units
  if (hintT > 0) {
    ctx.globalAlpha = Math.min(1, hintT / 60); ctx.font = 'bold 9px "Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#0d1b3e'; ctx.fillStyle = '#ffd54a'; ctx.lineJoin = 'round';
    const t = 'Hold JUMP longer to jump higher. Hold RUN to go faster.'; ctx.strokeText(t, VW / 2, 44); ctx.fillText(t, VW / 2, 44); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  if (DEBUG) { ctx.fillStyle = '#000a'; ctx.fillRect(40, 4, 130, 26); ctx.fillStyle = '#fff'; ctx.font = '7px monospace';
    ctx.fillText(`vx ${P.vx.toFixed(2)} vy ${P.vy.toFixed(2)} gnd ${P.onGround ? 1 : 0}`, 44, 14); ctx.fillText(`fps ${fps.toFixed(0)} scale ${S.toFixed(2)} view ${VW.toFixed(0)}x${VH}`, 44, 25); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ---------------- Loop ---------------- */
let state = 'home', paused = false, last = 0, acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!last) last = t; let dt = t - last; last = t; if (dt > 100) dt = 100;
  fpsT += dt; fpsN++; if (fpsT > 500) { fps = fpsN * 1000 / fpsT; fpsT = 0; fpsN = 0; }
  if (state === 'play' && !paused) { acc += dt; while (acc >= STEP) { update(); acc -= STEP; } } else acc = 0;
  if (state === 'play') render(acc / STEP);
}
resize(); requestAnimationFrame(frame);

/* ---------------- Screens / menus ---------------- */
function show(id, on) { $(id).hidden = !on; }
async function startLevel(url) {
  audioInit();
  try { await loadLevel(url); } catch (e) { alert('Could not load the level (' + e.message + '). Make sure the levels folder with test.json is uploaded next to index.html.'); return; }
  resize(); resetPlayer(); paused = false; state = 'play';
  show('#home', false); show('#pause', false); show('#pausebtn', true); clearInput();
  try { const el = document.documentElement; if (el.requestFullscreen && matchMedia('(pointer:coarse)').matches && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}
function setPause(on) { paused = on; clearInput(); show('#pause', on); }
function goHome() { state = 'home'; paused = false; show('#pause', false); show('#pausebtn', false); show('#home', true); clearInput(); }
function confirmBox(text, yes) { $('#dp').textContent = text; show('#dlg', true); $('#dyes').onclick = () => { show('#dlg', false); yes(); }; $('#dno').onclick = () => show('#dlg', false); }

$('#play').onclick = () => startLevel('levels/test.json');
$('#pausebtn').onclick = () => setPause(true);
$('#resume').onclick = () => setPause(false);
$('#restart').onclick = () => confirmBox('Restart this level from the beginning?', () => { resetPlayer(); setPause(false); });
$('#tomenu').onclick = () => confirmBox('Leave the level and go back to the menu? Progress in this level will be lost.', goHome);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !paused) setPause(true); });

history.replaceState({ g: 1 }, ''); history.pushState({ g: 2 }, '');
addEventListener('popstate', () => { history.pushState({ g: 2 }, ''); if (state === 'play') { setPause(true); confirmBox('Leave the level and go back to the menu?', goHome); } });

let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; };
addEventListener('appinstalled', () => { $('#install').hidden = true; });
$('#shareapp').onclick = async () => {
  const d = { title: 'Sooper Ranga', text: 'Play Sooper Ranga!', url: location.origin + location.pathname };
  try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); alert('Link copied'); } } catch (e) {}
};
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
