'use strict';
/* ==========================================================
   Sooper Ranga — Step 1: engine
   Fixed 60 Hz update, tile collision, smooth camera, parallax.
   All tuning numbers live in PHYS (px per frame at 60 Hz).
   Add ?debug to the URL for a physics read-out, ?touch to force touch buttons.
   ========================================================== */
const W = 400, H = 224, T = 16, STEP = 1000 / 60;
const DEBUG = /debug/.test(location.search);

const PHYS = {
  walk: 1.4, run: 2.4,            // top speeds
  accWalk: .085, accRun: .12, accAir: .08,
  fric: .07, airFric: .012,       // ground friction / air drag when no input
  skid: .22, skidAir: .14,        // braking when pushing against motion
  over: .04,                      // slow-down from run speed to walk speed when run is released
  jump: 4.9, jumpSpd: .22,        // jump impulse + bonus from horizontal speed
  gHold: .28, gFall: .62,         // gravity while jump held & rising / otherwise
  maxFall: 6.5,
  coyote: 6, buffer: 6            // frames (~100 ms)
};

const SOLID = new Set(['#', 'B', '?', 'H']);
const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d');
cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;

const store = {
  get(k, d) { try { const v = localStorage.getItem('sr_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sr_' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------------- Audio (files if present, else synth) ---------------- */
const SFX_NAMES = ['jump', 'coin', 'stomp', 'powerup', 'hurt', 'death', 'clear'];
// [freq, duration, wave, slideToFreq(0=none), delay]
const SYN = {
  jump: [[300, .16, 'square', 620, 0]],
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
async function loadSample(n) {
  try { const r = await fetch(n + '.mp3'); if (!r.ok) return; buffers[n] = await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) {}
}
function audioInit() {
  if (!AC) return;
  if (!ac) { ac = new AC(); SFX_NAMES.forEach(loadSample); }
  if (ac.state === 'suspended') ac.resume();
}
function sfx(n) {
  if (muted || !ac) return;
  if (buffers[n]) { const s = ac.createBufferSource(); s.buffer = buffers[n]; s.connect(ac.destination); s.start(); return; }
  const t0 = ac.currentTime;
  (SYN[n] || []).forEach(([f, d, w, to, dl]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = w; o.frequency.setValueAtTime(f, t0 + dl);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dl + d);
    g.gain.setValueAtTime(.12, t0 + dl); g.gain.exponentialRampToValueAtTime(.001, t0 + dl + d);
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
  if (k === 'jump' && !kb.jump && !e.repeat) jumpPress = true;
  kb[k] = true;
});
addEventListener('keyup', e => { const k = KMAP[e.code]; if (k) { kb[k] = false; e.preventDefault(); } });
function clearInput() { for (const k in kb) kb[k] = false; for (const k in tc) tc[k] = false; $('#dpad').className = ''; document.querySelectorAll('.tb').forEach(b => b.classList.remove('on')); }

// touch: action buttons
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { audioInit(); b.setPointerCapture(e.pointerId); if (k === 'jump' && !tc.jump) jumpPress = true; tc[k] = true; b.classList.add('on'); e.preventDefault(); });
  const up = () => { tc[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
});
// touch: d-pad is one wide strip; slide thumb left/right across it
const dp = $('#dpad');
function dpSet(e) {
  const r = dp.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
  tc.left = x < .46; tc.right = x > .54;
  dp.className = tc.left ? 'l' : tc.right ? 'r' : '';
}
dp.addEventListener('pointerdown', e => { audioInit(); dp.setPointerCapture(e.pointerId); dpSet(e); e.preventDefault(); });
dp.addEventListener('pointermove', e => { if (dp.hasPointerCapture(e.pointerId)) dpSet(e); });
const dpEnd = () => { tc.left = tc.right = false; dp.className = ''; };
dp.addEventListener('pointerup', dpEnd); dp.addEventListener('pointercancel', dpEnd);
if (matchMedia('(pointer:coarse)').matches || /touch/.test(location.search)) $('#touch').hidden = false;
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- Art (optional sprite sheets; placeholders otherwise) ---------------- */
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
let heroImg = null, tilesImg = null; const TS = {};
function mk(fn) { const c = document.createElement('canvas'); c.width = c.height = T; fn(c.getContext('2d')); return c; }
function star(g, cx, cy, R, r, fill, stroke) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}
function buildTiles() {
  // tiles.png: one row of 16x16 cells: grass, dirt, brick, star block, used block, hard block
  if (tilesImg) { ['grass', 'dirt', 'brick', 'q', 'used', 'hard'].forEach((n, i) => TS[n] = mk(g => g.drawImage(tilesImg, i * T, 0, T, T, 0, 0, T, T))); return; }
  const dirt = g => {
    g.fillStyle = '#b06a30'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#8a4d20'; [[3, 4], [10, 2], [7, 9], [13, 12], [2, 13], [11, 7]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    g.fillStyle = '#c98444'; [[6, 3], [1, 8], [12, 4], [8, 13]].forEach(([x, y]) => g.fillRect(x, y, 2, 1));
  };
  TS.dirt = mk(dirt);
  TS.grass = mk(g => { dirt(g); g.fillStyle = '#3fae47'; g.fillRect(0, 0, T, 5); g.fillStyle = '#74d862'; g.fillRect(0, 0, T, 2); g.fillStyle = '#3fae47'; for (let x = 0; x < T; x += 3) g.fillRect(x, 5, 2, 2); });
  TS.brick = mk(g => {
    g.fillStyle = '#c9562c'; g.fillRect(0, 0, T, T); g.fillStyle = '#6e2a12';
    for (let r = 0; r < 4; r++) { g.fillRect(0, r * 4 + 3, T, 1); const o = r % 2 ? 4 : 0; g.fillRect(o, r * 4, 1, 3); g.fillRect(o + 8, r * 4, 1, 3); }
    g.fillStyle = '#e77c47'; for (let r = 0; r < 4; r++) g.fillRect(1, r * 4, T - 1, 1);
  });
  TS.q = mk(g => {
    g.fillStyle = '#b87400'; g.fillRect(0, 0, T, T); g.fillStyle = '#ffc21a'; g.fillRect(1, 1, T - 2, T - 2);
    g.fillStyle = '#ffe07a'; g.fillRect(1, 1, T - 2, 2); g.fillStyle = '#b87400';[[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    star(g, 8, 8.5, 5, 2.2, '#fff6c2', '#b87400');
  });
  TS.used = mk(g => { g.fillStyle = '#4a3520'; g.fillRect(0, 0, T, T); g.fillStyle = '#8a6a45'; g.fillRect(1, 1, T - 2, T - 2); g.fillStyle = '#4a3520';[[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => g.fillRect(x, y, 2, 2)); });
  TS.hard = mk(g => { g.fillStyle = '#5b6478'; g.fillRect(0, 0, T, T); g.fillStyle = '#a9b2c6'; g.fillRect(0, 0, T - 1, T - 1); g.fillStyle = '#8791a8'; g.fillRect(2, 2, T - 4, T - 4); g.fillStyle = '#c4ccdc'; g.fillRect(2, 2, T - 4, 1); });
}
buildTiles();
Promise.all([loadImg('hero.png'), loadImg('tiles.png')]).then(([h, t]) => { heroImg = h; tilesImg = t; if (t) buildTiles(); });

/* ---------------- Level ---------------- */
let LV = null;
const tileAt = (tx, ty) => tx < 0 || tx >= LV.w ? '#' : (ty < 0 || ty >= LV.h) ? '.' : LV.rows[ty][tx];
const solid = (tx, ty) => SOLID.has(tileAt(tx, ty));
async function loadLevel(url) {
  const j = await (await fetch(url, { cache: 'no-store' })).json();
  const rows = j.rows.map(r => r.split('')); let start = { x: 2, y: 2 };
  rows.forEach((r, y) => r.forEach((c, x) => { if (c === 'P') { start = { x, y }; r[x] = '.'; } }));
  LV = { name: j.name, theme: j.theme, rows, w: rows[0].length, h: rows.length, start, url };
}

/* ---------------- Player ---------------- */
const P = {}, cam = {};
function resetPlayer() {
  Object.assign(P, { x: LV.start.x * T + 2, y: LV.start.y * T, w: 12, h: 16, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, buf: 0, jumping: false, anim: 0, dead: 0 });
  P.px = P.x; P.py = P.y; jumpPress = false;
  Object.assign(cam, { x: 0, y: 0, look: 0 }); camTarget(true); cam.px = cam.x; cam.py = cam.y;
}
function killPlayer() { P.dead = 70; P.vx = 0; P.vy = -4.5; sfx('death'); }

function moveX(p) {
  p.x += p.vx;
  const top = Math.floor(p.y / T), bot = Math.floor((p.y + p.h - .01) / T);
  if (p.vx > 0) { const tx = Math.floor((p.x + p.w - .01) / T); for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { p.x = tx * T - p.w; p.vx = 0; break; } }
  else if (p.vx < 0) { const tx = Math.floor(p.x / T); for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { p.x = (tx + 1) * T; p.vx = 0; break; } }
}
function moveY(p) {
  p.y += p.vy; p.onGround = false;
  const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - .01) / T);
  if (p.vy > 0) { const ty = Math.floor((p.y + p.h - .01) / T); for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { p.y = ty * T - p.h; p.vy = 0; p.onGround = true; break; } }
  else if (p.vy < 0) {
    const ty = Math.floor(p.y / T);
    for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { p.y = (ty + 1) * T; p.vy = 0; p.jumping = false; /* step 2: bump block (tx,ty) here */ break; }
  }
}

function update() {
  const p = P; p.px = p.x; p.py = p.y; cam.px = cam.x; cam.py = cam.y;
  if (p.dead > 0) { // death animation: hop up, fall through the world, then restart
    p.vy = Math.min(p.vy + .3, 7); p.y += p.vy;
    if (--p.dead === 0) resetPlayer();
    return;
  }
  const dir = (inp('right') ? 1 : 0) - (inp('left') ? 1 : 0), run = inp('run');
  const maxV = run ? PHYS.run : PHYS.walk;

  // horizontal: acceleration, skid, friction
  if (dir) {
    p.face = dir;
    if (p.vx * dir < 0) p.vx += dir * (p.onGround ? PHYS.skid : PHYS.skidAir);
    else if (Math.abs(p.vx) < maxV) { p.vx += dir * (p.onGround ? (run ? PHYS.accRun : PHYS.accWalk) : PHYS.accAir); if (Math.abs(p.vx) > maxV) p.vx = dir * maxV; }
    else p.vx -= Math.sign(p.vx) * PHYS.over * (p.onGround ? 1 : .25);
  } else {
    const f = p.onGround ? PHYS.fric : PHYS.airFric;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }

  // jump: coyote time + input buffer + variable height
  if (p.onGround) p.coyote = PHYS.coyote; else if (p.coyote > 0) p.coyote--;
  if (jumpPress) { p.buf = PHYS.buffer; jumpPress = false; } else if (p.buf > 0) p.buf--;
  if (p.buf > 0 && p.coyote > 0) {
    p.vy = -(PHYS.jump + Math.abs(p.vx) * PHYS.jumpSpd);
    p.jumping = true; p.buf = 0; p.coyote = 0; p.onGround = false; sfx('jump');
  }
  if (p.vy >= 0) p.jumping = false;
  p.vy += (inp('jump') && p.jumping && p.vy < 0) ? PHYS.gHold : PHYS.gFall;
  if (p.vy > PHYS.maxFall) p.vy = PHYS.maxFall;

  moveX(p); moveY(p);
  if (p.onGround) p.anim += Math.abs(p.vx) * .12; else p.anim = 0;
  if (p.y > LV.h * T + 24) killPlayer();
  camTarget(false);
}

function camTarget(snap) {
  const p = P;
  cam.look += (p.face * 26 - cam.look) * .03;
  let tx = p.x + p.w / 2 - W / 2 + cam.look;
  const sy = p.y - cam.y; let ty = cam.y;
  if (sy < 72) ty = p.y - 72; else if (sy > 150) ty = p.y - 150; else if (p.onGround) ty = p.y - 112;
  if (snap) { cam.x = tx; cam.y = p.y - 130; }
  else { cam.x += (tx - cam.x) * .1; cam.y += (ty - cam.y) * (p.onGround ? .08 : .18); }
  cam.x = Math.max(0, Math.min(cam.x, LV.w * T - W));
  cam.y = Math.max(0, Math.min(cam.y, LV.h * T - H));
}

/* ---------------- Rendering ---------------- */
let skyGrad = null;
function layer(period, f, cx, fn) { const k0 = Math.floor(cx * f / period) - 1, n = Math.ceil(W / period) + 3; for (let k = k0; k < k0 + n; k++) fn(k, k * period - cx * f); }
function hills(cx, cy, f, base, amp, wave, color, cyF) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H + 4);
  for (let x = 0; x <= W + 8; x += 8) { const wx = x + cx * f; ctx.lineTo(x, base - cy * cyF - amp * (Math.sin(wx / wave) + .5 * Math.sin(wx / (wave * .43) + 1))); }
  ctx.lineTo(W + 8, H + 4); ctx.fill();
}
function drawBG(cx, cy) {
  if (!skyGrad) { skyGrad = ctx.createLinearGradient(0, 0, 0, H); skyGrad.addColorStop(0, '#4aa8f5'); skyGrad.addColorStop(.6, '#9ddcff'); skyGrad.addColorStop(1, '#ffe9b8'); }
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(330, 44 - cy * .05, 20, 0, 7); ctx.fill();
  // distant gopuram temple (slowest layer)
  layer(520, .08, cx, (k, x) => {
    const gy = 148 - cy * .2, x0 = x + 140; ctx.fillStyle = '#a9b8dd';
    ctx.fillRect(x0, gy - 14, 76, 14);
    [[66, 10], [56, 10], [46, 10], [36, 10], [26, 9], [16, 8]].forEach(([w, h], i) => { const yy = gy - 14 - (i + 1) * 10; ctx.fillRect(x0 + (76 - w) / 2, yy, w, h); });
    ctx.fillRect(x0 + 35, gy - 14 - 6 * 10 - 8, 6, 8);
    ctx.fillStyle = '#8f9fcf'; for (let i = 0; i < 6; i++) ctx.fillRect(x0 + 8, gy - 14 - (i + 1) * 10 + 7, 60, 1);
  });
  hills(cx, cy, .2, 158, 14, 60, '#86c98a', .25);
  hills(cx, cy, .4, 182, 12, 44, '#56b560', .4);
  // palm trees
  layer(150, .6, cx, (k, x) => {
    const gy = 206 - cy * .55, px = x + 40 + ((k * 37) % 60);
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, gy); ctx.quadraticCurveTo(px + 6, gy - 28, px + 3, gy - 52); ctx.stroke();
    ctx.strokeStyle = '#2f9a45'; ctx.lineWidth = 3;
    [[-18, 8], [-12, -4], [0, -10], [12, -4], [18, 8]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(px + 3, gy - 52); ctx.quadraticCurveTo(px + 3 + dx * .6, gy - 52 + dy - 10, px + 3 + dx, gy - 52 + dy); ctx.stroke(); });
  });
}
function drawTiles(cx, cy) {
  const x0 = Math.floor(cx / T), x1 = Math.floor((cx + W) / T), y0 = Math.floor(cy / T), y1 = Math.floor((cy + H) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tileAt(tx, ty); if (c === '.' || tx < 0 || tx >= LV.w) continue;
    const s = c === '#' ? (solid(tx, ty - 1) ? TS.dirt : TS.grass) : c === 'B' ? TS.brick : c === '?' ? TS.q : c === 'H' ? TS.hard : null;
    if (s) ctx.drawImage(s, tx * T - cx, ty * T - cy);
  }
}
function drawHero(x, y) {
  const p = P; ctx.save(); ctx.translate(Math.round(x + p.w / 2), Math.round(y + p.h)); ctx.scale(p.face, 1);
  const air = !p.onGround, moving = Math.abs(p.vx) > .15, skid = p.onGround && ((inp('left') && p.vx > .6) || (inp('right') && p.vx < -.6));
  if (heroImg) { // hero.png: row of 16x16 cells: idle, walk1, walk2, walk3, jump, skid
    const f = air ? 4 : skid ? 5 : moving ? 1 + Math.floor(p.anim) % 3 : 0;
    if (p.dead) ctx.scale(1, -1);
    ctx.drawImage(heroImg, f * 16, 0, 16, 16, -8, -16, 16, 16); ctx.restore(); return;
  }
  if (p.dead) ctx.scale(1, -1), ctx.translate(0, 16);
  const r = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const s = Math.floor(p.anim) % 2;
  let f1 = 0, f2 = 0; if (air) { f1 = 2; f2 = -2; } else if (moving) { f1 = s ? 2 : -2; f2 = -f1; }
  r('#7a4a1e', -5 + f2, -2, 4, 2); r('#7a4a1e', 1 + f1, -2, 4, 2);              // sandals
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) r((i + j) % 2 ? '#ffffff' : '#2a5bd7', -5 + i * 2, -6 + j * 2, 2, 2); // checked lungi
  r('#ffffff', -4, -10, 8, 4); r('#e0e6f5', -4, -7, 8, 1);                     // vest
  r('#c98a5a', air ? 3 : (s ? 3 : -5), air ? -13 : -9, 2, 3);                  // arm
  r('#d9a066', -4, -15, 8, 5); r('#d9a066', -3, -16, 6, 1);                    // head
  r('#1a1a1a', -4, -16, 8, 2); r('#1a1a1a', -4, -14, 1, 2);                    // hair
  r('#1a1a1a', 1, -12, 5, 1); r('#1a1a1a', 3, -14, 1, 2);                      // moustache + eye
  ctx.restore();
}
const lerp = (a, b, t) => a + (b - a) * t;
let fps = 60, fpsT = 0, fpsN = 0;
function render(a) {
  if (!LV) return;
  const cx = Math.round(lerp(cam.px, cam.x, a)), cy = Math.round(lerp(cam.py, cam.y, a));
  drawBG(cx, cy); drawTiles(cx, cy);
  drawHero(lerp(P.px, P.x, a) - cx, lerp(P.py, P.y, a) - cy);
  if (DEBUG) { ctx.fillStyle = '#000a'; ctx.fillRect(2, 2, 170, 34); ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
    ctx.fillText(`vx ${P.vx.toFixed(2)} vy ${P.vy.toFixed(2)} gnd ${P.onGround ? 1 : 0}`, 6, 14); ctx.fillText(`fps ${fps.toFixed(0)}  cam ${cx},${cy}`, 6, 28); }
}

/* ---------------- Loop ---------------- */
let state = 'home', paused = false, last = 0, acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!last) last = t; let dt = t - last; last = t; if (dt > 100) dt = 100;
  fpsT += dt; fpsN++; if (fpsT > 500) { fps = fpsN * 1000 / fpsT; fpsT = 0; fpsN = 0; }
  if (state === 'play' && !paused) { acc += dt; while (acc >= STEP) { update(); acc -= STEP; } } else acc = 0;
  render(acc / STEP);
}
requestAnimationFrame(frame);

/* ---------------- Screens / menus ---------------- */
function show(id, on) { $(id).hidden = !on; }
async function startLevel(url) {
  audioInit();
  try { await loadLevel(url); } catch (e) { alert('Could not load level. If you opened the file directly, run it from a web server or GitHub Pages.'); return; }
  resetPlayer(); paused = false; state = 'play';
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
addEventListener('blur', () => { if (state === 'play' && !paused) setPause(true); });

// Android back button: ask before leaving a level
history.replaceState({ g: 1 }, ''); history.pushState({ g: 2 }, '');
addEventListener('popstate', () => { history.pushState({ g: 2 }, ''); if (state === 'play') { setPause(true); confirmBox('Leave the level and go back to the menu?', goHome); } });

// Install + Share (same pattern as the Ludo app)
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; };
addEventListener('appinstalled', () => { $('#install').hidden = true; });
$('#shareapp').onclick = async () => {
  const d = { title: 'Sooper Ranga', text: 'Play Sooper Ranga!', url: location.origin + location.pathname };
  try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); alert('Link copied'); } } catch (e) {}
};
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
