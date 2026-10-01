/* Sooper Ranga — game engine, levels, UI.  Modules: audio.js, art.js, cloud.js.
   Debug URLs:  ?debug (read-out)  ?touch (force touch buttons)  ?level=N&start=TILE (jump into a level)  ?bot (auto-runner for testing) */
import * as AU from './audio.js';
import * as ART from './art.js';
import * as CLOUD from './cloud.js';

const T = 16, VH = 176, STEP = 1000 / 60;
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug'), BOT = QS.has('bot'), START_TILE = +(QS.get('start') || 0);

const PHYS = {
  walk: 1.65, run: 2.7, accWalk: .1, accRun: .13, accAir: .09, fric: .08, airFric: .012, skid: .24, skidAir: .15, over: .04,
  jump: 5.8, jumpSpd: .25,          // ~4 tiles standing, ~4.6 running (hold); ~2 tiles on a tap
  gHold: .26, gFall: .55, maxFall: 6.5, coyote: 8, buffer: 7
};
const SOLID = new Set(['#', 'B', '?', 'M', 'Q', 'H', 'U']);
const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d');
let S = 1, VW = 400;

/* ---------------- storage / save ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('sr_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sr_' + k, JSON.stringify(v)); } catch (e) {} }
};
let SAVE = store.get('save', { unlocked: 0, levels: {}, coins: 0 });
function persist() { store.set('save', SAVE); CLOUD.saveProgress(SAVE); }
function mergeSave(a, b) {
  const out = { unlocked: Math.max(a.unlocked || 0, b.unlocked || 0), levels: {}, coins: 0 };
  const ids = new Set([...Object.keys(a.levels || {}), ...Object.keys(b.levels || {})]);
  ids.forEach(id => { const x = (a.levels || {})[id] || {}, y = (b.levels || {})[id] || {}; out.levels[id] = { best: Math.max(x.best || 0, y.best || 0), stars: Math.max(x.stars || 0, y.stars || 0), coins: Math.max(x.coins || 0, y.coins || 0) }; out.coins += out.levels[id].coins; });
  return out;
}

/* ---------------- input ---------------- */
const kb = {}, tc = {};
const inp = k => !!(kb[k] || tc[k]);
let jumpPress = false, state = 'home', paused = false;
const KMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run' };
addEventListener('keydown', e => {
  AU.init();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play' && !e.repeat) setPause(!paused); e.preventDefault(); return; }
  const k = KMAP[e.code]; if (!k || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
  e.preventDefault(); if (k === 'jump' && !e.repeat) jumpPress = true; kb[k] = true;
});
addEventListener('keyup', e => { const k = KMAP[e.code]; if (k) { kb[k] = false; } });
function clearInput() { for (const k in kb) kb[k] = false; for (const k in tc) tc[k] = false; $('#dpad').className = ''; document.querySelectorAll('.tb').forEach(b => b.classList.remove('on')); }
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k, up = () => { tc[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', e => { AU.init(); try { b.setPointerCapture(e.pointerId); } catch (x) {} if (k === 'jump') jumpPress = true; tc[k] = true; b.classList.add('on'); e.preventDefault(); });
  ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => b.addEventListener(ev, up));
});
const dp = $('#dpad');
function dpSet(e) { const r = dp.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; tc.left = x < .46; tc.right = x > .54; dp.className = tc.left ? 'l' : tc.right ? 'r' : ''; }
dp.addEventListener('pointerdown', e => { AU.init(); try { dp.setPointerCapture(e.pointerId); } catch (x) {} dpSet(e); e.preventDefault(); });
dp.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') dpSet(e); });
const dpEnd = () => { tc.left = tc.right = false; dp.className = ''; };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => dp.addEventListener(ev, dpEnd));
if (matchMedia('(pointer:coarse)').matches || QS.has('touch')) $('#touch').hidden = false;
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- sizing / art ---------------- */
let TSET = {}, skyKey = '';
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  S = cv.height / VH; VW = cv.width / S;
  TSET = { village: ART.makeTiles(S, 'village'), stone: ART.makeTiles(S, 'stone') };
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 250));
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
const IMGS = { hero: null, far: null, mid: null };
Promise.all([loadImg('hero.png'), loadImg('bg-far.png'), loadImg('bg-mid.png')]).then(([h, f, m]) => { IMGS.hero = h; IMGS.far = f; IMGS.mid = m; });

/* ---------------- level + run state ---------------- */
let LVLIST = [], LV = null, curIdx = 0;
const G = { lives: 3, coins: 0 };
let R = null, tick = 0, hintT = 0;
const P = {}, cam = {};
const tileAt = (tx, ty) => tx < 0 || tx >= LV.w ? '#' : (ty < 0 || ty >= LV.h) ? '.' : LV.rows[ty][tx];
const isSolid = (tx, ty) => { const c = tileAt(tx, ty); return SOLID.has(c) || (c === 'D' && !R.doorOpen); };
const setTile = (tx, ty, c) => { if (tx >= 0 && tx < LV.w && ty >= 0 && ty < LV.h) LV.rows[ty][tx] = c; };
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function rectSolid(x, y, w, h) { for (let ty = Math.floor(y / T); ty <= Math.floor((y + h - .01) / T); ty++) for (let tx = Math.floor(x / T); tx <= Math.floor((x + w - .01) / T); tx++) if (isSolid(tx, ty)) return true; return false; }

async function loadLevelFile(meta) {
  const res = await fetch(meta.file, { cache: 'no-store' }); if (!res.ok) throw new Error(meta.file + ' -> HTTP ' + res.status);
  const j = await res.json(); const src = j.rows;
  LV = Object.assign({}, meta, j, { src, w: src[0].length, h: src.length, start: { x: 2, y: 2 } });
  src.forEach((r, y) => { const x = r.indexOf('P'); if (x >= 0) LV.start = { x, y }; });
  let dr = -1, dc = -1; src.forEach((r, y) => { const x = r.indexOf('D'); if (x >= 0) { dr = Math.max(dr, y); dc = x; } }); LV.doorAt = dr >= 0 ? { x: dc * T, by: (dr + 1) * T } : null;
}
function newRun() {
  R = { phase: 'play', time: LV.time || 300, tf: 0, score: 0, cpScore: 0, coinsRun: 0, gotStars: new Set(), hasKey: false, doorOpen: false, ents: [], plats: [], bump: {}, pops: [], parts: [], cp: null, boss: null, clearT: 0, deadT: 0, shake: 0, flagBonus: 0 };
}
function buildRows() { LV.rows = LV.src.map(r => r.split('')); }
function spawnEnts() {
  R.ents = []; R.plats = []; R.boss = null; R.bump = {};
  const rows = LV.rows, MAP = 'PosgekbGRYCFTJj=+vVcOW';
  for (let ty = 0; ty < LV.h; ty++) for (let tx = 0; tx < LV.w; tx++) {
    const c = rows[ty][tx], X = tx * T, Y = ty * T; let e = null, keep = false;
    switch (c) {
      case 'o': e = { t: 'coin', x: X + 4, y: Y + 3, w: 8, h: 10 }; break;
      case 's': { const id = 's' + tx + ',' + ty; if (!R.gotStars.has(id)) e = { t: 'star', id, x: X + 2, y: Y + 2, w: 12, h: 12 }; break; }
      case 'g': e = { t: 'gem', x: X + 3, y: Y + 2, w: 10, h: 12 }; break;
      case 'e': e = { t: 'walker', x: X + 2, y: Y + 4, w: 12, h: 12, vx: -.55, sp: .55, vy: 0, dead: 0 }; break;
      case 'k': e = { t: 'shell', x: X + 2, y: Y + 2, w: 12, h: 14, vx: -.5, sp: .5, vy: 0, state: 0 }; break;
      case 'b': e = { t: 'bat', x: X + 1, y: Y + 3, w: 14, h: 10, vx: -.7, x0: X, range: 56, y0: Y + 3, ph: tx }; break;
      case 'G': e = { t: 'golem', x: X + 1, y: Y, w: 14, h: 16, vx: -.3, sp: .3, vy: 0, hp: 2, stun: 0 }; break;
      case 'R': e = { t: 'ball', x: X - 2, y: Y - 4, w: 20, h: 20, vx: 0, vy: 0, on: false, rot: 0 }; break;
      case 'Y': e = { t: 'boss', x: X - 6, y: Y + T - 36, w: 28, h: 36, vx: 0, vy: 0, hp: 3, state: 'sleep', timer: 0, inv: 0, face: -1, shots: 0, active: false }; R.boss = e; break;
      case 'C': e = { t: 'cp', x: X + 3, y: Y + T - 28, w: 10, h: 28, cx: X + 8, by: Y + T, tx, on: !!(R.cp && R.cp.tx === tx) }; break;
      case 'F': e = LV.goal === 'flag' ? { t: 'goal', kind: 'flag', x: X + 6, y: -2000, w: 4, h: 4000, ph: 112, cx: X + 8, by: Y + T } : { t: 'goal', kind: 'door', x: X, y: Y + T - 32, w: 16, h: 32, cx: X + 8, by: Y + T }; break;
      case 'T': e = { t: 'torch', x: X + 8, by: Y + T }; break;
      case 'J': case 'j': keep = true; e = { t: 'jet', tx, ty, dir: c === 'J' ? 1 : -1, phase: (tx * 53) % 280, len: 0 }; break;
      case 'W': e = { t: 'chain', px: X + 8, py: Y, len: 52, amp: 1.05, ph: tx * .7, bx: 0, by: 0 }; break;
      case '=': R.plats.push({ mode: 'h', ox: X, oy: Y + 4, x: X, y: Y + 4, w: 32, h: 7, amp: 40, sp: .022, ph: tx, dx: 0, dy: 0, px: X, py: Y + 4, state: 0 }); break;
      case '+': R.plats.push({ mode: 'h', ox: X, oy: Y + 4, x: X, y: Y + 4, w: 32, h: 7, amp: 72, sp: .016, ph: tx, dx: 0, dy: 0, px: X, py: Y + 4, state: 0 }); break;
      case 'v': R.plats.push({ mode: 'v', ox: X, oy: Y + 4, x: X, y: Y + 4, w: 32, h: 7, amp: 36, sp: .02, ph: tx, dx: 0, dy: 0, px: X, py: Y + 4, state: 0 }); break;
      case 'V': R.plats.push({ mode: 'v', ox: X, oy: Y + 4, x: X, y: Y + 4, w: 32, h: 7, amp: 60, sp: .015, ph: tx, dx: 0, dy: 0, px: X, py: Y + 4, state: 0 }); break;
      case 'c': R.plats.push({ mode: 'c', ox: X, oy: Y + 4, x: X, y: Y + 4, w: 32, h: 7, dx: 0, dy: 0, px: X, py: Y + 4, state: 0, timer: 0, vy: 0 }); break;
      case 'O': R.plats.push({ mode: 'O', cx: X + 8, cy: Y + 8, x: X - 5, y: Y - 5, w: 26, h: 7, dx: 0, dy: 0, px: X - 3, py: Y - 5, state: 0, ph: tx, rot: 0 }); break;
      case 'Q': if (R.gotStars.has('q' + tx + ',' + ty)) rows[ty][tx] = 'U'; break;
    }
    if (e) R.ents.push(e);
    if (!keep && MAP.includes(c)) rows[ty][tx] = '.';
  }
}
function setBody(big) {
  const bottom = P.y + P.h, cx = P.x + P.w / 2;
  P.big = big; P.w = big ? 15 : 12; P.h = big ? 29 : 18; P.x = cx - P.w / 2; P.y = bottom - P.h;
}
function respawnHero() {
  P.big = false; P.w = 12; P.h = 18; Object.assign(P, { vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, buf: 0, jumping: false, anim: 0, dead: 0, sx: 1, sy: 1, lastVy: 0, inv: 0, ride: null, combo: 0, alpha: 1 });
  const s = R.cp ? { x: R.cp.tx, y: R.cp.ty } : LV.start;
  P.x = (START_TILE && !R.cp ? START_TILE : s.x) * T + 2; P.y = (START_TILE && !R.cp ? Math.max(0, s.y - 6) : s.y + 1) * T - P.h;
  P.px = P.x; P.py = P.y; jumpPress = false;
  Object.assign(cam, { x: 0, y: 0, look: 0 }); camTarget(true); cam.px = cam.x; cam.py = cam.y;
}
function startAttempt(first) {
  buildRows(); if (first) newRun(); else { R.phase = 'play'; R.time = LV.time || 300; R.tf = 0; R.hasKey = false; R.doorOpen = false; R.score = R.cpScore; R.clearT = 0; R.deadT = 0; R.parts = []; R.pops = []; R.boss = null; R.coinsRun = R.cpCoins || 0; }
  spawnEnts(); respawnHero(); hintT = first && LV.id === '1-1' ? 420 : 0; hudForce();
}

/* ---------------- physics ---------------- */
function stepUp(o, tx, ty, bot) {
  if (o.onGround || ty !== bot || o.vy < -1) return false; const top = ty * T; if (o.y + o.h - top > 6) return false;
  const ny = top - o.h, c0 = Math.floor(o.x / T), c1 = Math.floor((o.x + o.w - .01) / T);
  for (let r = Math.floor(ny / T); r < ty; r++) for (let c = c0; c <= c1; c++) if (isSolid(c, r)) return false;
  o.y = ny; return true;
}
function moveBody(o, hero) {
  o.x += o.vx; o.hitX = false;
  const top = Math.floor(o.y / T), bot = Math.floor((o.y + o.h - .01) / T);
  if (o.vx > 0) { const tx = Math.floor((o.x + o.w - .01) / T); for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { if (hero && stepUp(o, tx, ty, bot)) break; o.x = tx * T - o.w; o.vx = 0; o.hitX = true; break; } }
  else if (o.vx < 0) { const tx = Math.floor(o.x / T); for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { if (hero && stepUp(o, tx, ty, bot)) break; o.x = (tx + 1) * T; o.vx = 0; o.hitX = true; break; } }
  const pb = o.y + o.h; o.lastVy = o.vy; o.y += o.vy; o.onGround = false; o.ceil = null;
  const l = Math.floor(o.x / T), r = Math.floor((o.x + o.w - .01) / T);
  if (o.vy > 0) { const ty = Math.floor((o.y + o.h - .01) / T); for (let tx = l; tx <= r; tx++) { const c = tileAt(tx, ty); if (isSolid(tx, ty) || (c === '-' && pb <= ty * T + .5)) { o.y = ty * T - o.h; o.vy = 0; o.onGround = true; break; } } }
  else if (o.vy < 0) {
    const ty = Math.floor(o.y / T); let best = -1, bx = 0;
    for (let tx = l; tx <= r; tx++) if (isSolid(tx, ty)) { const w = Math.min(o.x + o.w, (tx + 1) * T) - Math.max(o.x, tx * T); if (w > best) { best = w; bx = tx; } }
    if (best >= 0) { if (hero && best <= 4 && !rectSolid(o.x + (bx === l ? best + .2 : -best - .2), o.y, o.w, o.h)) o.x += bx === l ? best + .2 : -best - .2; else { o.y = (ty + 1) * T; o.vy = 0; o.ceil = { tx: bx, ty }; } }
  }
  return pb;
}

/* ---------------- helpers: score, pops, particles ---------------- */
const pop = (x, y, txt) => R.pops.push({ x, y, txt, life: 50 });
const addScore = (n, x, y) => { R.score += n; if (x != null) pop(x, y, String(n)); };
function oneUp(x, y) { G.lives++; AU.sfx('oneup'); pop(x, y, '1UP'); hudForce(); }
function addCoin(x, y) { G.coins++; R.coinsRun++; R.score += 200; AU.sfx('coin'); if (G.coins >= 100) { G.coins -= 100; oneUp(x, y - 10); } }
function debris(tx, ty) { for (let i = 0; i < 4; i++) R.parts.push({ k: 'deb', x: tx * T + 4 + (i % 2) * 8, y: ty * T + 4 + (i >> 1) * 8, vx: (i % 2 ? 1 : -1) * (.8 + Math.random()), vy: -3.2 - Math.random() * 1.5, life: 50 }); }
function dust(x, y, n, dir) { for (let i = 0; i < n; i++) R.parts.push({ k: 'dust', x: x + (Math.random() - .5) * 6, y, vx: (Math.random() - .5) * .7 - dir * .35, vy: -Math.random() * .5 - .1, r: 1 + Math.random() * 1.3, life: 22 + Math.random() * 10, max: 32 }); }
function boom(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 2.4; R.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30 + Math.random() * 20, max: 50 }); } }

/* ---------------- hero ---------------- */
function hurt() {
  if (P.inv > 0 || R.phase !== 'play') return;
  if (P.big) { setBody(false); P.inv = 120; AU.sfx('hurt'); } else killPlayer();
}
function killPlayer() {
  if (DEBUG) (window.__deaths = window.__deaths || []).push([Math.round(P.x / T), Math.round(P.y / T), LV.id]);
  if (R.phase !== 'play') return; R.phase = 'dead'; R.deadT = 0; P.vx = 0; P.vy = -5; P.dead = 1; AU.sfx('death'); AU.stopMusic();
}
function bounce() { P.vy = inp('jump') ? -6.6 : -4; P.jumping = inp('jump'); P.onGround = false; }
function stompScore(e) { const v = [100, 200, 400, 800, 1000, 2000, 5000]; const n = v[Math.min(P.combo, 6)]; P.combo++; if (P.combo > 7) oneUp(e.x, e.y - 6); else addScore(n, e.x + e.w / 2, e.y - 4); AU.sfx('stomp'); }
function tryGrow(x, y) {
  if (P.big) { addScore(1000, x, y - 6); AU.sfx('powerup'); return; }
  const bottom = P.y + P.h, cx = P.x + P.w / 2; if (rectSolid(cx - 7.5, bottom - 29, 15, 29)) { addScore(1000, x, y - 6); AU.sfx('powerup'); return; }
  setBody(true); P.inv = 40; AU.sfx('powerup'); pop(x, y - 6, 'BIG!');
}
function hitBlock(tx, ty) {
  const c = tileAt(tx, ty); const k = ty * LV.w + tx;
  const bump = () => { R.bump[k] = 0; };
  if (c === '?') { setTile(tx, ty, 'U'); bump(); R.ents.push({ t: 'cpop', x: tx * T + 8, y: ty * T - 2, vy: -4.6, life: 34 }); addCoin(tx * T + 8, ty * T - 8); pop(tx * T + 8, ty * T - 16, '200'); }
  else if (c === 'M') { setTile(tx, ty, 'U'); bump(); AU.sfx('bump'); R.ents.push({ t: 'power', kind: (tx + ty) % 2 ? 'mango' : 'laddu', x: tx * T + 2, y: ty * T + 2, w: 12, h: 12, vx: 0, vy: 0, rise: 28, dir: 1 }); }
  else if (c === 'Q') { const id = 'q' + tx + ',' + ty; setTile(tx, ty, 'U'); bump(); AU.sfx('bump'); if (!R.gotStars.has(id)) R.ents.push({ t: 'star', id, x: tx * T + 2, y: ty * T - 14, w: 12, h: 12 }); }
  else if (c === 'B') { if (P.big) { setTile(tx, ty, '.'); debris(tx, ty); R.score += 50; AU.sfx('break'); } else { bump(); AU.sfx('bump'); } }
  else { AU.sfx('bump'); return; }
  for (const e of R.ents) if ((e.t === 'walker' || e.t === 'shell' || e.t === 'bat' || e.t === 'golem') && !e.kill && e.x + e.w > tx * T && e.x < (tx + 1) * T && Math.abs(e.y + e.h - ty * T) <= 4) killE(e, 100);
}
function killE(e, pts) { e.kill = true; e.flip = true; e.vy = -3; e.vx = (Math.random() - .5) * 1.2; if (pts) addScore(pts, e.x + e.w / 2, e.y - 4); }

function updatePlats() {
  for (const p of R.plats) {
    p.px = p.x; p.py = p.y;
    if (p.mode === 'h') p.x = p.ox + Math.sin(tick * p.sp + p.ph) * p.amp;
    else if (p.mode === 'v') p.y = p.oy + Math.sin(tick * p.sp + p.ph) * p.amp;
    else if (p.mode === 'O') { const a = tick * .018 + p.ph; p.x = p.cx - 13 + Math.cos(a) * 16; p.y = p.cy - 13 + Math.sin(a) * 16; p.rot = a * 3; }
    else if (p.mode === 'c') {
      if (p.state === 1 && --p.timer <= 0) { p.state = 2; p.vy = 0; }
      else if (p.state === 2) { p.vy += .28; p.y += p.vy; if (p.y > p.oy + 160) { p.state = 3; p.timer = 160; } }
      else if (p.state === 3 && --p.timer <= 0) { p.state = 0; p.x = p.ox; p.y = p.oy; }
    }
    p.dx = p.x - p.px; p.dy = p.y - p.py;
  }
}
function updateHero() {
  const p = P;
  if (p.inv > 0) p.inv--;
  if (BOT) botThink();
  const dir = (inp('right') ? 1 : 0) - (inp('left') ? 1 : 0), run = inp('run'), maxV = run ? PHYS.run : PHYS.walk;
  if (p.ride && p.onGround) { p.x += p.ride.dx; p.y += p.ride.dy; }
  if (dir) {
    p.face = dir;
    if (p.vx * dir < 0) { p.vx += dir * (p.onGround ? PHYS.skid : PHYS.skidAir); if (p.onGround && Math.abs(p.vx) > 1 && tick % 4 === 0) dust(p.x + p.w / 2, p.y + p.h, 1, Math.sign(p.vx)); }
    else if (Math.abs(p.vx) < maxV) { p.vx += dir * (p.onGround ? (run ? PHYS.accRun : PHYS.accWalk) : PHYS.accAir); if (Math.abs(p.vx) > maxV) p.vx = dir * maxV; }
    else p.vx -= Math.sign(p.vx) * PHYS.over * (p.onGround ? 1 : .25);
  } else { const f = p.onGround ? PHYS.fric : PHYS.airFric; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  if (p.onGround) p.coyote = PHYS.coyote; else if (p.coyote > 0) p.coyote--;
  if (jumpPress) { p.buf = PHYS.buffer; jumpPress = false; } else if (p.buf > 0) p.buf--;
  if (p.buf > 0 && p.coyote > 0) {
    p.vy = -(PHYS.jump + Math.abs(p.vx) * PHYS.jumpSpd); p.jumping = true; p.buf = 0; p.coyote = 0; p.onGround = false; p.ride = null; AU.sfx('jump');
    p.sx = .78; p.sy = 1.28; dust(p.x + p.w / 2, p.y + p.h, 4, p.face);
  }
  if (p.vy >= 0) p.jumping = false;
  p.vy += (inp('jump') && p.jumping && p.vy < 0) ? PHYS.gHold : PHYS.gFall; if (p.vy > PHYS.maxFall) p.vy = PHYS.maxFall;
  const wasG = p.onGround, pb = moveBody(p, true);
  if (p.ceil) hitBlock(p.ceil.tx, p.ceil.ty);
  if (!p.onGround && p.vy >= 0) {          // moving / crumbling platforms (solid from above only)
    for (const pl of R.plats) if (pl.state < 3 && p.x + p.w > pl.x && p.x < pl.x + pl.w && pb <= pl.y + Math.abs(pl.dy) + 2.5 && p.y + p.h >= pl.y) {
      p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.ride = pl; if (pl.mode === 'c' && pl.state === 0) { pl.state = 1; pl.timer = 26; } break;
    }
  }
  if (p.onGround && !p.ride) p.ride = null; else if (!p.onGround) p.ride = null;
  if (p.onGround) { p.combo = 0; if (!wasG && p.lastVy > 2.2) { p.sx = 1.25; p.sy = .76; dust(p.x + p.w / 2, p.y + p.h, 5, 0); } }
  p.sx += (1 - p.sx) * .22; p.sy += (1 - p.sy) * .22;
  if (p.onGround) p.anim += Math.abs(p.vx) * .12; else p.anim = 0;
  if (R.boss && R.boss.active && !R.boss.dead) { const a = LV.arena; if (p.x < a[0] * T) { p.x = a[0] * T; if (p.vx < 0) p.vx = 0; } }
  if (p.y > LV.h * T + 24) killPlayer();
  // spikes
  for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h) / T); ty++) for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w) / T); tx++) if (tileAt(tx, ty) === 'S' && ov({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 }, { x: tx * T + 1, y: ty * T + 7, w: 14, h: 9 })) { if (P.inv <= 0) { p.vy = -4; } hurt(); }
}
function botThink() {
  const p = P; tc.right = true; tc.run = !QS.has('walk'); tc.left = false; p.inv = Math.max(p.inv, 3);
  const fr = Math.floor((p.y + p.h - 1) / T), fx = p.x + p.w, feet = p.y + p.h, wx = fx + (p.vx > 1.8 ? 26 : 14), wt = Math.floor(wx / T);
  const ex = fx + 2, et = Math.floor(ex / T);
  const platAhead = dx => R.plats.find(pl => pl.state < 3 && pl !== p.ride && pl.x + pl.w > fx - 2 && pl.x - fx < dx && pl.y - feet > -44 && pl.y - feet < 26);
  const groundAt = x => { const t = Math.floor(x / T); for (let r = fr - 1; r <= fr + 2; r++) if (isSolid(t, r) || tileAt(t, r) === '-') return true; return false; };
  let go = false;
  if (p.ride && p.onGround) {                      // standing on a moving/crumbling platform: wait until the next stop is in reach
    const nx = platAhead(46); const ready = groundAt(fx + 38) || (nx && nx.x - fx < 40);
    if (ready) { go = true; if (p.onGround) { jumpPress = true; R.botHold = 30; } } else tc.right = false;
  } else {
    let wall = false, ground = false;
    for (let r = fr - 1; r <= fr; r++) if (isSolid(wt, r)) wall = true;
    for (let r = fr + 1; r <= fr + 2; r++) if (isSolid(et, r) || tileAt(et, r) === '-') ground = true;
    if (tileAt(wt, fr) === 'S' || tileAt(wt - 1, fr) === 'S') wall = true;
    let foe = false; for (const e of R.ents) if ((e.t === 'walker' || e.t === 'shell' || e.t === 'golem' || e.t === 'ball' || e.t === 'bat') && e.x > p.x && e.x - p.x < 46 && Math.abs(e.y - p.y) < 30) foe = true;
    let lip = 99; for (let d = 0; d < 48; d += 2) if (!groundAt(fx + d)) { lip = d; break; }
    const plN = R.plats.find(q => q.state < 3 && q.x + q.w > fx && q.x - fx < 120 && q.y - feet > -44 && q.y - feet < 26);
    if (p.onGround && plN && lip < 24) { if (plN.x - fx < 34 && plN.y - feet > -34) { jumpPress = true; R.botHold = 30; } else { tc.right = false; tc.left = p.vx > .5 && lip < 14; } }   // wait for the platform
    else if (p.onGround && !ground) {                   // at a pit lip
      if (plN) { jumpPress = true; R.botHold = 30; } else { jumpPress = true; R.botHold = 30; }
    } else if (p.onGround && (wall || foe)) { jumpPress = true; R.botHold = 30; }
  }
  tc.jump = (R.botHold || 0) > 0; if (R.botHold > 0) R.botHold--;
  R.botDist = Math.max(R.botDist || 0, p.x);
}

/* ---------------- enemies & items ---------------- */
function nearView(e) { return e.x + (e.w || 0) > cam.x - 90 && e.x < cam.x + VW + 90; }
function patrol(e) {
  e.vy = Math.min(e.vy + .4, 5);
  if (e.onGround) { const d = Math.sign(e.vx) || -1, ax = d > 0 ? e.x + e.w + 1 : e.x - 1, tx = Math.floor(ax / T), ty = Math.floor((e.y + e.h + 2) / T); if (!isSolid(tx, ty)) e.vx = -d * e.sp; }
  const d0 = Math.sign(e.vx) || -1; moveBody(e, false); if (e.hitX) e.vx = -d0 * e.sp;
}
function stompCheck(e, h) { return P.vy > 0 && (P.py + h(P)) <= e.y + 6; }
function updateEnemies() {
  const p = P, list = R.ents;
  for (const e of list) {
    if (e.rm) continue;
    if (e.kill) { e.vy = Math.min(e.vy + .35, 7); e.y += e.vy; e.x += e.vx; if (e.y > LV.h * T + 60) e.rm = true; continue; }
    switch (e.t) {
      case 'cpop': e.vy += .3; e.y += e.vy; if (--e.life <= 0) e.rm = true; break;
      case 'coin': if (ov(p, e)) { e.rm = true; addCoin(e.x + 4, e.y); } break;
      case 'gem': if (ov(p, e)) { e.rm = true; addScore(500, e.x + 5, e.y); AU.sfx('coin'); } break;
      case 'star': if (ov(p, e)) { e.rm = true; R.gotStars.add(e.id); addScore(1000, e.x + 6, e.y); AU.sfx('powerup'); hudForce(); } break;
      case 'key': if (ov(p, e)) { e.rm = true; R.hasKey = true; R.doorOpen = true; AU.sfx('key'); pop(e.x + 6, e.y - 4, 'KEY!'); AU.sfx('powerup'); } break;
      case 'cp': if (!e.on && ov(p, e)) { e.on = true; R.cp = { tx: e.tx, ty: Math.floor((e.by - 1) / T) }; R.cpScore = R.score; R.cpCoins = R.coinsRun; AU.sfx('powerup'); pop(e.cx, e.by - 30, 'CHECKPOINT'); } break;
      case 'goal': if (R.phase === 'play' && ov(p, e)) startClear(e); break;
      case 'power': {
        if (e.rise > 0) { e.y -= .5; e.rise--; if (e.rise === 0) e.vx = .7 * e.dir; break; }
        e.vy = Math.min(e.vy + .4, 5); const d0 = Math.sign(e.vx) || 1; moveBody(e, false); if (e.hitX) e.vx = -d0 * .7; if (e.y > LV.h * T + 40) e.rm = true;
        if (ov(p, e)) { e.rm = true; tryGrow(e.x + 6, e.y); }
        break;
      }
      case 'walker': {
        if (e.dead) { if (--e.dead <= 0) e.rm = true; break; } if (!nearView(e)) break;
        patrol(e);
        if (ov(p, e)) { if (stompCheck(e, q => q.h)) { e.squash = true; e.dead = 26; stompScore(e); bounce(); } else hurt(); }
        break;
      }
      case 'shell': {
        if (!nearView(e) && e.state !== 2) break;
        if (e.state === 0) patrol(e);
        else if (e.state === 1) { e.vy = Math.min(e.vy + .4, 5); e.vx = 0; moveBody(e, false); }
        else { e.vy = Math.min(e.vy + .4, 5); const d0 = Math.sign(e.vx); moveBody(e, false); if (e.hitX) { e.vx = -d0 * 2.8; AU.sfx('bump'); } if (e.kickT > 0) e.kickT--;
          for (const o of list) if (o !== e && !o.kill && !o.rm && (o.t === 'walker' || o.t === 'bat' || o.t === 'golem' || (o.t === 'shell' && o.state === 0)) && ov(e, o)) killE(o, 200); }
        if (e.y > LV.h * T + 40) { e.rm = true; break; }
        e.h = e.state === 0 ? 14 : 10;
        if (ov(p, e)) {
          const st = stompCheck(e, q => q.h);
          if (e.state === 0) { if (st) { e.state = 1; e.vx = 0; e.h = 10; stompScore(e); bounce(); } else hurt(); }
          else if (e.state === 1) { e.state = 2; e.vx = (p.x + p.w / 2 < e.x + e.w / 2) ? 2.8 : -2.8; e.kickT = 12; AU.sfx('kick'); addScore(400, e.x + 6, e.y - 4); if (st) bounce(); }
          else { if (st) { e.state = 1; e.vx = 0; stompScore(e); bounce(); } else if (!e.kickT) hurt(); }
        }
        break;
      }
      case 'bat': {
        if (!nearView(e)) break; e.x += e.vx; if (e.x < e.x0 - e.range) e.vx = Math.abs(e.vx); if (e.x > e.x0 + e.range) e.vx = -Math.abs(e.vx); e.y = e.y0 + Math.sin(tick * .05 + e.ph) * 14;
        if (ov(p, e)) { if (stompCheck(e, q => q.h)) { killE(e, 0); stompScore(e); bounce(); } else hurt(); }
        break;
      }
      case 'golem': {
        if (!nearView(e)) break; if (e.stun > 0) { e.stun--; e.vy = Math.min(e.vy + .4, 5); e.vx = 0; moveBody(e, false); if (!e.stun) e.vx = (p.x < e.x ? -1 : 1) * e.sp; } else { e.vy = Math.min(e.vy + .4, 5); if (e.vx === 0) e.vx = -e.sp; patrol(e); }
        if (ov(p, e)) { if (stompCheck(e, q => q.h)) { if (e.hp > 1) { e.hp = 1; e.stun = 100; e.sp = .55; AU.sfx('stomp'); addScore(200, e.x + 7, e.y - 4); bounce(); P.combo++; } else { killE(e, 0); stompScore(e); bounce(); } } else if (e.stun <= 0) hurt(); }
        break;
      }
      case 'ball': {
        if (!e.on) { if (e.x > p.x && e.x - p.x < 190 && Math.abs(e.y - p.y) < 90) { e.on = true; e.vx = -1.9; AU.sfx('boss'); } break; }
        e.vy = Math.min(e.vy + .4, 6); const d0 = Math.sign(e.vx); moveBody(e, false); if (e.hitX) e.vx = -d0 * 1.9; e.rot += e.vx * .1; if (e.y > LV.h * T + 60 || e.x < -40) e.rm = true;
        if (ov(p, e)) { if (P.vy > 0 && (P.py + P.h) <= e.y + 8) bounce(); else hurt(); }
        break;
      }
      case 'jet': {
        const c = (tick + e.phase) % 280; let len = 0; e.warn = c >= 150 && c < 200;
        if (c >= 200 && c < 260) len = Math.min(56, (c - 200) * 4); else if (c >= 260) len = Math.max(0, 56 - (c - 260) * 4);
        if (len > 0) { const mx = e.dir > 0 ? (e.tx + 1) * T : e.tx * T; for (let i = 1; i <= 4; i++) { if (isSolid(Math.floor((mx + e.dir * i * T - (e.dir < 0 ? 1 : 0)) / T), e.ty)) { len = Math.min(len, (i - 1) * T + 4); break; } } }
        if (c === 200 && Math.abs(e.tx * T - p.x) < 200) AU.sfx('fire');
        e.len = len; if (len > 4) { const mx = e.dir > 0 ? (e.tx + 1) * T : e.tx * T; if (ov({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 }, { x: e.dir > 0 ? mx : mx - len, y: e.ty * T + T / 2 - 4, w: len, h: 8 })) hurt(); }
        break;
      }
      case 'chain': {
        if (!nearView({ x: e.px - 60, w: 120 })) break; const a = e.amp * Math.sin(tick * .028 + e.ph); e.ang = a; e.bx = e.px + Math.sin(a) * e.len; e.by = e.py + Math.cos(a) * e.len;
        const nx = Math.max(p.x, Math.min(e.bx, p.x + p.w)), ny = Math.max(p.y, Math.min(e.by, p.y + p.h)); if ((nx - e.bx) ** 2 + (ny - e.by) ** 2 < 6.5 * 6.5) hurt();
        break;
      }
      case 'proj': e.x += e.vx; if (--e.life <= 0 || isSolid(Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / T), Math.floor((e.y + 2) / T))) e.rm = true; if (ov(p, e)) hurt(); break;
      case 'wave': e.x += e.vx; if (--e.life <= 0 || isSolid(Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / T), Math.floor((e.y + 4) / T))) e.rm = true; if (ov(p, e)) hurt(); break;
      case 'boss': updateBoss(e); break;
    }
  }
  R.ents = list.filter(e => !e.rm);
}
function updateBoss(b) {
  const p = P, a = LV.arena, gy = b.y + b.h; if (b.dead) { if (--b.dieT <= 0) { b.rm = true; R.ents.push({ t: 'key', x: b.x + 8, y: b.y + b.h - 14, w: 12, h: 12 }); } if (tick % 4 === 0) boom(b.x + b.w / 2 + (Math.random() - .5) * 24, b.y + Math.random() * 32, 6); return; }
  if (!b.active) { if (p.x > a[0] * T + 40) { b.active = true; b.state = 'walk'; b.timer = 90; AU.startMusic('boss'); AU.sfx('boss'); pop(b.x + 14, b.y - 6, 'GUARDIAN!'); } return; }
  if (b.inv > 0) b.inv--; b.face = (p.x + p.w / 2) < (b.x + b.w / 2) ? -1 : 1;
  const sp = 1 + (3 - b.hp) * .28; b.timer--;
  if (b.state === 'walk') { b.x += b.face * .6 * sp; if (b.timer <= 0) { b.state = 'throw'; b.timer = 100; b.shots = 0; } }
  else if (b.state === 'throw') { if (b.timer === 70 || b.timer === 35) { R.ents.push({ t: 'proj', x: b.x + b.w / 2 + b.face * 14, y: gy - 12, w: 14, h: 5, vx: b.face * 2.1 * sp, life: 200, dir: b.face }); AU.sfx('kick'); } if (b.timer <= 0) { b.state = 'slam'; b.timer = 75; } }
  else if (b.state === 'slam') { if (b.timer === 0) { R.shake = 14; AU.sfx('boss'); [-1, 1].forEach(d => R.ents.push({ t: 'wave', x: b.x + b.w / 2 - 5 + d * 14, y: gy - 10, w: 10, h: 10, vx: d * 1.7 * sp, life: 150 })); b.state = 'dizzy'; b.timer = 120; } }
  else if (b.state === 'dizzy') { if (b.timer <= 0) { b.state = 'walk'; b.timer = 80; } }
  else if (b.state === 'hurt') { if (b.timer <= 0) { b.state = 'walk'; b.timer = 70; } }
  b.x = Math.max(a[0] * T + 4, Math.min(b.x, (a[1] + 1) * T - b.w - 4));
  if (ov(p, b)) {
    if (p.vy > 0 && (p.py + p.h) <= b.y + 12) {
      if (b.state === 'dizzy' && b.inv <= 0) { b.hp--; b.inv = 50; AU.sfx('stomp'); AU.sfx('boss'); boom(b.x + 14, b.y + 6, 14); bounce(); addScore(1000, b.x + 14, b.y - 6);
        if (b.hp <= 0) { b.dead = true; b.dieT = 90; addScore(5000, b.x + 14, b.y - 20); AU.sfx('powerup'); } else { b.state = 'hurt'; b.timer = 50; } }
      else bounce();
    } else if (b.state !== 'dizzy' && b.state !== 'hurt') hurt();
  }
}

/* ---------------- level clear / results ---------------- */
function startClear(g) {
  R.phase = 'clear'; R.clearT = 0; R.clearKind = g.kind; R.goal = g; P.vx = 0; P.vy = 0; AU.stopMusic(); AU.sfx('clear');
  if (g.kind === 'flag') { const h = Math.min(1, Math.max(0, (g.by - (P.y + P.h)) / g.ph)); R.flagBonus = Math.max(100, Math.round((100 + h * 4900) / 100) * 100); addScore(R.flagBonus, g.cx, P.y - 10); P.x = g.cx - P.w / 2 - 3; P.face = 1; }
}
function updateClear() {
  const p = P, g = R.goal; R.clearT++;
  if (g.kind === 'flag') {
    if (R.clearT < 400 && !p.onGround) { p.y += 1.6; p.vy = 0; const ty = Math.floor((p.y + p.h) / T); if (isSolid(Math.floor((p.x + 6) / T), ty) || isSolid(Math.floor((p.x + 6) / T), ty - 0)) { p.y = ty * T - p.h; p.onGround = true; } p.anim = R.clearT * .05; }
    else { p.face = 1; p.vx = 1.1; p.vy = Math.min(p.vy + .5, 6); moveBody(p, false); p.anim += 1.1 * .12; }
    if (R.clearT > 150) finishLevel();
  } else {
    const dx = g.cx - (p.x + p.w / 2); p.face = dx > 0 ? 1 : -1; p.vx = Math.abs(dx) > 1.5 ? Math.sign(dx) * .9 : 0; p.vy = Math.min(p.vy + .5, 6); moveBody(p, false); p.anim += Math.abs(p.vx) * .12;
    if (Math.abs(dx) <= 1.5) p.alpha = Math.max(0, p.alpha - .035); if (R.clearT > 130) finishLevel();
  }
}
let resultShown = false;
function finishLevel() {
  if (resultShown) return; resultShown = true; R.phase = 'done';
  const tb = R.time * 50, sb = R.gotStars.size * 1000; R.score += tb + sb;
  const id = LV.id, old = SAVE.levels[id] || {}, isBest = R.score > (old.best || 0);
  SAVE.levels[id] = { best: Math.max(old.best || 0, R.score), stars: Math.max(old.stars || 0, R.gotStars.size), coins: Math.max(old.coins || 0, R.coinsRun) };
  SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(curIdx + 1, LVLIST.length - 1)); SAVE.coins = Object.values(SAVE.levels).reduce((a, l) => a + (l.coins || 0), 0);
  persist(); CLOUD.submitScore(id, R.score, R.gotStars.size);
  const last = curIdx >= LVLIST.length - 1;
  $('#rt').textContent = last ? 'You did it!' : 'Level clear!'; $('#rsub').textContent = `${LV.id}  ${LV.name}`;
  $('#rlist').innerHTML = `<div class="rrow"><span>Time bonus</span><b>${tb}</b></div><div class="rrow"><span>Stars ${'★'.repeat(R.gotStars.size)}${'☆'.repeat(3 - R.gotStars.size)}</span><b>${sb}</b></div><div class="rrow"><span>Rupee coins</span><b>${R.coinsRun}</b></div><div class="rrow tot"><span>Score ${isBest ? '(new best!)' : ''}</span><b>${R.score}</b></div>`;
  $('#rnext').textContent = last ? 'Levels' : 'Next'; show('#result', true); spawnConfetti();
}
function spawnConfetti() { const c = $('#confetti'); c.innerHTML = ''; for (let i = 0; i < 26; i++) { const s = document.createElement('span'); s.textContent = ['🪙', '⭐', '🎉', '✨'][i % 4]; s.style.left = Math.random() * 100 + '%'; s.style.animationDuration = 2.4 + Math.random() * 2 + 's'; s.style.animationDelay = Math.random() * 1.5 + 's'; c.appendChild(s); } }

/* ---------------- main update ---------------- */
function update() {
  tick++; const p = P; p.px = p.x; p.py = p.y; cam.px = cam.x; cam.py = cam.y;
  R.parts.forEach(q => { q.x += q.vx; q.y += q.vy; if (q.k === 'deb') q.vy += .3; else if (q.k === 'spark') q.vy += .08; q.life--; }); R.parts = R.parts.filter(q => q.life > 0);
  R.pops.forEach(q => { q.y -= .4; q.life--; }); R.pops = R.pops.filter(q => q.life > 0);
  for (const k in R.bump) { R.bump[k]++; if (R.bump[k] > 10) delete R.bump[k]; }
  if (R.shake > 0) R.shake--; if (hintT > 0) hintT--;
  if (R.phase === 'dead') { R.deadT++; p.vy = Math.min(p.vy + .3, 7); p.y += p.vy; if (R.deadT === 100) afterDeath(); return; }
  if (R.phase === 'clear') { updatePlats(); updateEnemies(); updateClear(); camTarget(false); return; }
  if (R.phase === 'done') return;
  if (++R.tf >= 40) { R.tf = 0; R.time--; if (R.time <= 0) { R.time = 0; killPlayer(); } }
  updatePlats(); updateHero(); updateEnemies();
  if (R.doorOpen && LV.doorAt && R.phase === 'play' && ov(P, { x: LV.doorAt.x, y: LV.doorAt.by - 32, w: 16, h: 32 })) startClear({ kind: 'door', cx: LV.doorAt.x + 8, by: LV.doorAt.by });
  camTarget(false); hud();
}
function afterDeath() {
  G.lives--; if (G.lives <= 0) { hudForce(); AU.stopMusic(); show('#gameover', true); return; }
  startAttempt(false); AU.startMusic(LV.music || 'village');
}
function camTarget(snap) {
  const p = P; cam.look += (p.face * 26 - cam.look) * .03;
  let tx = p.x + p.w / 2 - VW * .45 + cam.look;
  const top = VH * .36, bot = VH * .72, mid = VH * .58, sy = p.y - cam.y; let ty = cam.y;
  if (sy < top) ty = p.y - top; else if (sy > bot) ty = p.y - bot; else if (p.onGround) ty = p.y - mid;
  if (snap) { cam.x = tx; cam.y = p.y - mid; } else { cam.x += (tx - cam.x) * .1; cam.y += (ty - cam.y) * (p.onGround ? .08 : .18); }
  let lo = 0, hi = Math.max(0, LV.w * T - VW);
  if (R.boss && R.boss.active && LV.arena) { const a = LV.arena, w = (a[1] - a[0] + 1) * T; if (w <= VW) { lo = hi = a[0] * T - (VW - w) / 2; } else { lo = Math.max(lo, a[0] * T); hi = Math.min(hi, (a[1] + 1) * T - VW); } }
  cam.x = Math.max(lo, Math.min(cam.x, hi)); cam.y = Math.max(0, Math.min(cam.y, Math.max(0, LV.h * T - VH)));
}

/* ---------------- render ---------------- */
const lerp = (a, b, t) => a + (b - a) * t;
function drawTiles(cxd, cyd, TS) {
  const x0 = Math.floor(cxd / S / T), x1 = Math.floor((cxd + cv.width) / S / T), y0 = Math.floor(cyd / S / T), y1 = Math.floor((cyd + cv.height) / S / T);
  const X = tx => Math.round(tx * T * S - cxd), Y = ty => Math.round(ty * T * S - cyd), sz = TS.dirt.width;
  for (let ty = Math.max(0, y0); ty <= Math.min(LV.h - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(LV.w - 1, x1); tx++) {
    const c = LV.rows[ty][tx]; if (c === '.') continue;
    const s = c === '#' ? (LV.rows[ty - 1] && LV.rows[ty - 1][tx] === '#' ? TS.dirt : TS.grass) : c === 'B' ? TS.brick : (c === '?' || c === 'M' || c === 'Q') ? TS.q : c === 'U' ? TS.used : c === 'H' ? TS.hard : c === '-' ? TS.oneway : c === 'S' ? TS.spike : c === 'J' ? TS.lionR : c === 'j' ? TS.lionL : null;
    if (!s) continue; const b = R.bump[ty * LV.w + tx], off = b == null ? 0 : Math.round(Math.sin(b / 10 * Math.PI) * 5 * S);
    ctx.drawImage(s, 0, 0, sz, sz, X(tx), Y(ty) - off, X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
  }
}
function drawEnts(g) {
  const x0 = cam.x - 40, x1 = cam.x + VW + 40;
  for (const e of R.ents) {
    const ex = e.x != null ? e.x : e.px; if (ex == null || ex + 40 < x0 - 200 || ex > x1 + 200) continue;
    switch (e.t) {
      case 'torch': ART.torch(g, e.x, e.by, tick, LV.style === 'stone'); break;
      case 'coin': case 'cpop': ART.coin(g, e.x + 4, e.y + 5, tick + (e.x | 0)); break;
      case 'star': ART.starPick(g, e.x + 6, e.y + 6, tick); break;
      case 'gem': ART.gem(g, e.x + 5, e.y + 6, tick); break;
      case 'key': ART.key(g, e.x + 6, e.y + 6, tick); break;
      case 'power': (e.kind === 'mango' ? ART.mango : ART.laddu)(g, e.x + 6, e.y + 6); break;
      case 'cp': ART.checkpoint(g, e.cx, e.by, e.on, tick); break;
      case 'goal': if (e.kind === 'flag') ART.flagpole(g, e.cx, e.by, e.ph, tick); else ART.templeDoor(g, e.x, e.by, true, tick); break;
      case 'walker': ART.walker(g, e, tick); break;
      case 'shell': ART.shell(g, e, tick); break;
      case 'bat': ART.bat(g, e, tick); break;
      case 'golem': ART.golem(g, e, tick); break;
      case 'ball': ART.ball(g, e); break;
      case 'chain': if (e.ang != null) ART.chain(g, e.px, e.py, e.ang, e.len, tick); else ART.chain(g, e.px, e.py, 0, e.len, tick); break;
      case 'jet': { const mx = e.dir > 0 ? (e.tx + 1) * T : e.tx * T, cy = e.ty * T + T / 2 + 1; if (e.warn) ART.spark(g, mx + e.dir * 2, cy, tick); ART.fire(g, mx, cy, e.dir, e.len, tick); break; }
      case 'proj': ART.trident(g, e.x + 7, e.y + 2, e.dir); break;
      case 'wave': ART.wave(g, e.x + 5, e.y + 5, tick); break;
      case 'boss': ART.boss(g, e, tick); if (e.active && !e.dead) for (let i = 0; i < 3; i++) { g.fillStyle = i < e.hp ? '#ff3a3a' : '#333'; g.strokeStyle = '#000'; g.lineWidth = .6; g.beginPath(); g.arc(e.x + e.w / 2 - 8 + i * 8, e.y - 7, 2.6, 0, 7); g.fill(); g.stroke(); } break;
    }
  }
  if (LV.doorAt) ART.templeDoor(g, LV.doorAt.x, LV.doorAt.by, R.doorOpen, tick);
}
function drawHero(g, x, y) {
  const p = P; if (p.inv > 0 && p.inv % 6 < 3 && R.phase === 'play') return;
  g.save(); g.translate(x + p.w / 2, y + p.h); g.globalAlpha = p.alpha == null ? 1 : p.alpha;
  if (p.onGround && R.phase !== 'dead') { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, .4, 6.5 * (p.big ? 1.5 : 1), 1.5, 0, 0, 7); g.fill(); }
  const k = p.big ? 1.6 : 1;
  if (p.dead) g.rotate(Math.min(1, R.deadT / 18) * Math.PI * 1.6); else g.scale(p.face * p.sx * k, p.sy * k);
  const air = !p.onGround, moving = Math.abs(p.vx) > .15;
  if (IMGS.hero) { const skid = p.onGround && ((inp('left') && p.vx > .6) || (inp('right') && p.vx < -.6)); const f = air ? 4 : skid ? 5 : moving ? 1 + Math.floor(p.anim) % 3 : 0; g.drawImage(IMGS.hero, f * 32, 0, 32, 32, -13, -26, 26, 26); }
  else ART.heroArt(g, { ph: p.anim * 1.6, air, moving, rising: p.vy < 0 });
  g.restore();
}
function render(a) {
  if (!LV || !R) return;
  const shk = R.shake > 0 ? (Math.random() - .5) * R.shake * .35 : 0;
  const cxd = Math.round(lerp(cam.px, cam.x, a) * S + shk * S), cyd = Math.round(lerp(cam.py, cam.y, a) * S), cx = cxd / S, cy = cyd / S;
  ctx.imageSmoothingEnabled = false; ctx.setTransform(S, 0, 0, S, 0, 0);
  ART.drawBG(ctx, { kind: LV.theme, cx, cy, VW, VH, LV, tick, imgs: IMGS, S });
  { const g0 = LV.h * T - 64 - cy; if (g0 < VH) { const gr = ctx.createLinearGradient(0, g0, 0, g0 + 72); gr.addColorStop(0, 'rgba(6,8,26,.25)'); gr.addColorStop(1, 'rgba(6,8,26,.94)'); ctx.fillStyle = gr; ctx.fillRect(0, Math.max(0, g0), VW, VH); } }   // pits read as dark drops
  ctx.setTransform(S, 0, 0, S, -cxd, -cyd);
  for (const e of R.ents) if (e.t === 'torch' && e.x > cx - 60 && e.x < cx + VW + 60) ART.torch(ctx, e.x, e.by, tick, LV.style === 'stone');
  ctx.setTransform(1, 0, 0, 1, 0, 0); drawTiles(cxd, cyd, TSET[LV.style] || TSET.village);
  ctx.setTransform(S, 0, 0, S, -cxd, -cyd);
  for (const pl of R.plats) if (pl.state < 3) ART.plat(ctx, pl, tick);
  drawEnts(ctx);
  R.parts.forEach(q => {
    if (q.k === 'dust') { ctx.globalAlpha = Math.max(0, q.life / q.max) * .7; ctx.fillStyle = '#f3e7cf'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (q.k === 'deb') { ctx.fillStyle = '#cc5a2c'; ctx.fillRect(q.x, q.y, 4, 4); ctx.strokeStyle = ART.INK; ctx.lineWidth = .5; ctx.strokeRect(q.x, q.y, 4, 4); }
    else { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = '#ffd54a'; ctx.fillRect(q.x, q.y, 2.2, 2.2); ctx.globalAlpha = 1; }
  });
  drawHero(ctx, Math.round(lerp(P.px, P.x, a) * S) / S, Math.round(lerp(P.py, P.y, a) * S) / S);
  ctx.font = 'bold 7px "Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = '#2b1608';
  R.pops.forEach(q => { ctx.globalAlpha = Math.min(1, q.life / 20); ctx.fillStyle = '#fff'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); }); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  ctx.setTransform(S, 0, 0, S, 0, 0);
  if (hintT > 0) { ctx.globalAlpha = Math.min(1, hintT / 60); ctx.font = 'bold 9px "Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#0d1b3e'; ctx.fillStyle = '#ffd54a';
    const t = 'Hold JUMP longer to jump higher. Hold RUN to go faster.'; ctx.strokeText(t, VW / 2, 52); ctx.fillText(t, VW / 2, 52); ctx.globalAlpha = 1; ctx.textAlign = 'left'; }
  if (R.phase === 'dead' && R.deadT > 70) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (R.deadT - 70) / 30)})`; ctx.fillRect(0, 0, VW, VH); }
  if (DEBUG) { ctx.fillStyle = '#000a'; ctx.fillRect(40, 4, 150, 26); ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.fillText(`vx ${P.vx.toFixed(2)} vy ${P.vy.toFixed(2)} gnd ${P.onGround ? 1 : 0} x ${(P.x / T).toFixed(1)}`, 44, 14); ctx.fillText(`fps ${fps.toFixed(0)} S ${S.toFixed(2)} ${VW.toFixed(0)}x${VH}`, 44, 25); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ---------------- HUD (DOM) ---------------- */
const setT = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
let hudKey = '';
function hud() { const k = [G.lives, G.coins, R.gotStars.size, R.time, R.score].join(); if (k === hudKey) return; hudKey = k; hudForce(); }
function hudForce() { if (!R) return; setT('#hl', '❤ ' + Math.max(0, G.lives)); setT('#hc', '₹ ' + G.coins); setT('#hs', '★ ' + R.gotStars.size + '/3'); setT('#ht', '⏱ ' + R.time); setT('#hp', String(R.score).padStart(6, '0')); setT('#hn', `LEVEL ${LV.id}: ${LV.name.toUpperCase()}`); }

/* ---------------- loop ---------------- */
let last = 0, acc = 0, fps = 60, fpsT = 0, fpsN = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!last) last = t; let dt = t - last; last = t; if (dt > 100) dt = 100;
  fpsT += dt; fpsN++; if (fpsT > 500) { fps = fpsN * 1000 / fpsT; fpsT = 0; fpsN = 0; }
  if (state === 'play' && !paused) { acc += dt; let n = 0; while (acc >= STEP && n++ < 5) { update(); acc -= STEP; } if (n >= 5) acc = 0; } else acc = 0;
  if (state === 'play') render(acc / STEP);
}

/* ---------------- screens ---------------- */
const show = (id, on) => { $(id).hidden = !on; };
function hideAll() { ['#home', '#map', '#pause', '#result', '#gameover', '#auth', '#lb', '#dlg'].forEach(i => show(i, false)); }
function gotoHome() { state = 'home'; paused = false; hideAll(); show('#home', true); ['#hud', '#pausebtn'].forEach(i => show(i, false)); AU.stopMusic(); clearInput(); }
function gotoMap() { state = 'map'; paused = false; hideAll(); show('#map', true); ['#hud', '#pausebtn'].forEach(i => show(i, false)); AU.stopMusic(); clearInput(); buildMap(); }
function buildMap() {
  const box = $('#mapbox'); box.innerHTML = '';
  const worlds = [[1, 'World 1: The Village', 'Ranga is on his way to the temple. Run, jump and collect rupees!'], [2, 'World 2: The Temple', 'Brave the depths, beat the guardian and open the treasury.']];
  worlds.forEach(([w, title, sub]) => {
    const sec = document.createElement('div'); sec.className = 'world'; sec.innerHTML = `<h3>${title}</h3><p>${sub}</p><div class="lvs"></div>`; const row = sec.querySelector('.lvs');
    LVLIST.forEach((m, i) => {
      if (m.world !== w) return; const lock = i > SAVE.unlocked, sv = SAVE.levels[m.id] || {};
      const b = document.createElement('button'); b.className = 'lv' + (lock ? ' lock' : '') + (i === SAVE.unlocked ? ' cur' : ''); b.disabled = lock;
      b.innerHTML = `<img src="thumbs/${m.id}.jpg" alt=""><em>${m.id}</em><b>${m.name}</b><i>${'★'.repeat(sv.stars || 0)}${'☆'.repeat(3 - (sv.stars || 0))}</i>${lock ? '<u>🔒</u>' : ''}`;
      b.onclick = () => startLevel(i); row.appendChild(b);
    }); box.appendChild(sec);
  });
  const cur = box.querySelector('.cur'); if (cur) setTimeout(() => cur.scrollIntoView({ inline: 'center', block: 'nearest' }), 50);
}
async function startLevel(i, fresh) {
  AU.init(); curIdx = i; if (fresh !== false) { G.lives = 3; G.coins = 0; }
  try { await loadLevelFile(LVLIST[i]); } catch (e) { alert('Could not load level (' + e.message + '). Make sure the levels folder is uploaded next to index.html.'); return; }
  resize(); resultShown = false; R = null; startAttempt(true); hideAll(); state = 'play'; paused = false; show('#hud', true); show('#pausebtn', true); clearInput();
  AU.startMusic(LV.music || 'village');
  try { const el = document.documentElement; if (el.requestFullscreen && matchMedia('(pointer:coarse)').matches && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}
function setPause(on) { paused = on; clearInput(); show('#pause', on); AU.duck(on); }
function confirmBox(text, yes) { $('#dp').textContent = text; show('#dlg', true); $('#dyes').onclick = () => { show('#dlg', false); yes(); }; $('#dno').onclick = () => show('#dlg', false); }

$('#play').onclick = () => { AU.init(); gotoMap(); };
$('#mapback').onclick = gotoHome;
$('#pausebtn').onclick = () => setPause(true);
$('#resume').onclick = () => setPause(false);
$('#restart').onclick = () => confirmBox('Restart this level from the beginning?', () => { show('#pause', false); AU.duck(false); startLevel(curIdx); });
$('#tomenu').onclick = () => confirmBox('Leave the level and go back to the level map? Progress in this level will be lost.', () => { AU.duck(false); gotoMap(); });
$('#rnext').onclick = () => { show('#result', false); if (curIdx < LVLIST.length - 1) startLevel(curIdx + 1, false); else gotoMap(); };
$('#rreplay').onclick = () => { show('#result', false); startLevel(curIdx); };
$('#rmenu').onclick = () => { show('#result', false); gotoMap(); };
$('#gretry').onclick = () => { show('#gameover', false); startLevel(curIdx); };
$('#gmenu').onclick = () => { show('#gameover', false); gotoMap(); };
$('#rshare').onclick = async () => { const d = { title: 'Sooper Ranga', text: `I scored ${R ? R.score : 0} on level ${LV ? LV.id : ''} of Sooper Ranga!`, url: location.origin + location.pathname }; try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.text + ' ' + d.url); alert('Copied'); } } catch (e) {} };
$('#mute').onclick = () => { AU.init(); AU.setMuted(!AU.isMuted()); store.set('muted', AU.isMuted()); $('#mute').textContent = AU.isMuted() ? '🔇' : '🔊'; };
AU.setMuted(store.get('muted', false)); $('#mute').textContent = AU.isMuted() ? '🔇' : '🔊';
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !paused && R && R.phase === 'play') setPause(true); });
history.replaceState({ g: 1 }, ''); history.pushState({ g: 2 }, '');
addEventListener('popstate', () => { history.pushState({ g: 2 }, ''); if (state === 'play') { setPause(true); confirmBox('Leave the level and go back to the level map?', () => { AU.duck(false); gotoMap(); }); } else if (state === 'map') gotoHome(); });
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show('#install', true); });
$('#install').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; show('#install', false); };
addEventListener('appinstalled', () => show('#install', false));
$('#shareapp').onclick = async () => { const d = { title: 'Sooper Ranga', text: 'Play Sooper Ranga!', url: location.origin + location.pathname }; try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); alert('Link copied'); } } catch (e) {} };
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* ---------------- account + leaderboard (only when Firebase is configured) ---------------- */
function paintWho() { const u = CLOUD.currentUser(); setT('#who', u ? '👤 ' + u.name : ''); setT('#btnacct', u ? 'Sign out' : '☁ Sign in'); }
$('#btnacct').onclick = () => { if (CLOUD.currentUser()) CLOUD.signOut(); else { $('#aerr').textContent = ''; show('#auth', true); } };
$('#aclose').onclick = () => show('#auth', false);
async function doAuth(fn) {
  $('#aerr').textContent = '…';
  try { await fn(); show('#auth', false); const r = await CLOUD.loadProgress(); SAVE = r ? mergeSave(SAVE, r) : SAVE; persist(); if (state === 'map') buildMap(); } catch (e) { $('#aerr').textContent = CLOUD.friendly(e); }
}
$('#asignin').onclick = () => doAuth(() => CLOUD.signIn($('#au').value, $('#ap').value));
$('#asignup').onclick = () => doAuth(() => CLOUD.signUp($('#au').value, $('#ap').value));
$('#aguest').onclick = () => doAuth(() => CLOUD.guest($('#au').value));
$('#btnlb').onclick = () => { const s = $('#lbsel'); if (!s.options.length) { s.innerHTML = '<option value="__coins">Total coins</option>' + LVLIST.map(m => `<option value="${m.id}">${m.id} ${m.name}</option>`).join(''); } show('#lb', true); loadLb(); };
$('#lbclose').onclick = () => show('#lb', false); $('#lbsel').onchange = loadLb;
async function loadLb() {
  const v = $('#lbsel').value, box = $('#lblist'); box.textContent = 'Loading…';
  try { const rows = v === '__coins' ? await CLOUD.topCoins() : await CLOUD.topScores(v); box.innerHTML = rows.length ? rows.map((r, i) => `<div class="rrow"><span>${i + 1}. ${String(r.name).replace(/</g, '&lt;')}</span><b>${r.value}</b></div>`).join('') : 'No scores yet. Be the first!'; } catch (e) { box.textContent = 'Could not load scores.'; }
}

/* ---------------- boot ---------------- */
(async function boot() {
  resize(); requestAnimationFrame(frame);
  try { LVLIST = await (await fetch('levels/index.json', { cache: 'no-store' })).json(); } catch (e) { console.warn(e); }
  const ok = await CLOUD.init(); if (ok) { show('#btnlb', true); show('#btnacct', true); paintWho(); CLOUD.onChange(async () => { paintWho(); }); }
  const q = QS.get('level'); if (q != null && LVLIST.length) { SAVE.unlocked = LVLIST.length; startLevel(+q); }
})();
if (DEBUG) window.SR = { get P() { return P; }, get R() { return R; }, get LV() { return LV; }, get cam() { return cam; }, get G() { return G; }, get state() { return state; }, tp(tx, ty) { P.x = tx * T + 2; P.y = ty * T - P.h; P.vy = 0; camTarget(true); }, hurt, killPlayer };
