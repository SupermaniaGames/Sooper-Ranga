/* Audio: sound effects + looping music.
   Drop in jump.mp3, coin.mp3, stomp.mp3, powerup.mp3, hurt.mp3, death.mp3, clear.mp3 (and bump, break, kick, fire, key, boss)
   and music.mp3 (or music-village.mp3 / music-temple.mp3 / music-boss.mp3) to replace the synthesized versions. */
const AC = window.AudioContext || window.webkitAudioContext;
let ac = null, master = null, mgain = null, muted = false;
const buffers = {}, musicBufs = {}, tried = {};
const NAMES = ['jump', 'coin', 'stomp', 'powerup', 'hurt', 'death', 'clear', 'bump', 'break', 'kick', 'fire', 'key', 'boss', 'oneup'];
// [freq, duration, wave, slideToFreq(0=none), delay]
const SYN = {
  jump: [[280, .2, 'square', 640, 0]],
  coin: [[988, .07, 'square', 0, 0], [1319, .25, 'square', 0, .07]],
  stomp: [[240, .1, 'square', 90, 0]],
  powerup: [[392, .09, 'square', 0, 0], [494, .09, 'square', 0, .09], [587, .09, 'square', 0, .18], [784, .09, 'square', 0, .27], [988, .2, 'square', 0, .36]],
  hurt: [[420, .28, 'sawtooth', 90, 0]],
  death: [[523, .14, 'square', 0, 0], [494, .14, 'square', 0, .14], [440, .14, 'square', 0, .28], [220, .5, 'square', 70, .42]],
  clear: [[523, .12, 'square', 0, 0], [659, .12, 'square', 0, .12], [784, .12, 'square', 0, .24], [1047, .14, 'square', 0, .36], [784, .1, 'square', 0, .5], [1047, .4, 'square', 0, .6]],
  bump: [[150, .08, 'square', 90, 0]],
  break: [[200, .18, 'sawtooth', 60, 0]],
  kick: [[330, .08, 'square', 660, 0]],
  fire: [[90, .35, 'sawtooth', 180, 0]],
  key: [[784, .08, 'triangle', 0, 0], [1047, .08, 'triangle', 0, .08], [1319, .3, 'triangle', 0, .16]],
  boss: [[110, .3, 'sawtooth', 55, 0]],
  oneup: [[659, .1, 'square', 0, 0], [784, .1, 'square', 0, .1], [1319, .1, 'square', 0, .2], [1047, .1, 'square', 0, .3], [1175, .1, 'square', 0, .4], [1568, .25, 'square', 0, .5]]
};
// music: steps are eighth notes. numbers = semitones above root; null = rest
const SONGS = {
  village: { bpm: 152, root: 60, lead: 'triangle', bassW: 'square',
    melody: [0, 4, 7, 12, 7, 4, 7, null, 9, 7, 4, 2, 4, null, 2, null, 5, 9, 12, 9, 5, 9, 7, null, 7, 4, 2, 0, 2, 4, 0, null],
    bass: [0, null, 7, null, 0, null, 7, null, 5, null, 12, null, 5, null, 12, null, -5, null, 2, null, -5, null, 2, null, 0, null, 7, null, 0, null, 7, null] },
  temple: { bpm: 96, root: 57, lead: 'triangle', bassW: 'sawtooth',
    melody: [0, null, 3, null, 7, null, 3, null, 5, null, 3, null, 2, null, null, null, 0, null, 3, null, 8, null, 7, null, 5, null, 3, null, 2, null, null, null],
    bass: [-12, null, null, null, -12, null, null, null, -9, null, null, null, -9, null, null, null, -12, null, null, null, -12, null, null, null, -14, null, null, null, -14, null, null, null] },
  boss: { bpm: 136, root: 55, lead: 'sawtooth', bassW: 'square',
    melody: [0, 0, 12, 0, 0, 11, 0, 0, 3, 3, 15, 3, 3, 14, 3, 3, 5, 5, 17, 5, 5, 16, 5, 5, -2, -2, 10, -2, -2, 9, -2, null],
    bass: [-12, null, -12, null, -12, null, -12, null, -9, null, -9, null, -9, null, -9, null, -7, null, -7, null, -7, null, -7, null, -14, null, -14, null, -14, null, -14, null] }
};
let song = null, timer = null, step = 0, nextT = 0, srcNode = null, wanted = null;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);

export const isMuted = () => muted;
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 1; }
export function init() {
  if (!AC) return;
  if (!ac) {
    ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination);
    mgain = ac.createGain(); mgain.gain.value = .5; mgain.connect(master);
    NAMES.forEach(loadSample);
    if (wanted) startMusic(wanted);
  }
  if (ac.state === 'suspended') ac.resume();
}
async function loadBuf(url) { try { const r = await fetch(url); if (!r.ok) return null; return await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { return null; } }
async function loadSample(n) { const b = await loadBuf(n + '.mp3'); if (b) buffers[n] = b; }
export function sfx(n) {
  if (muted || !ac) return;
  if (buffers[n]) { const s = ac.createBufferSource(); s.buffer = buffers[n]; s.connect(master); s.start(); return; }
  const t0 = ac.currentTime;
  (SYN[n] || []).forEach(([f, d, w, to, dl]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = w; o.frequency.setValueAtTime(f, t0 + dl);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dl + d);
    g.gain.setValueAtTime(.14, t0 + dl); g.gain.exponentialRampToValueAtTime(.001, t0 + dl + d);
    o.connect(g); g.connect(master); o.start(t0 + dl); o.stop(t0 + dl + d + .02);
  });
}
function tone(f, t, d, type, v) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g); g.connect(mgain); o.start(t); o.stop(t + d + .02);
}
function schedule() {
  if (!song) return; const dur = 60 / song.bpm / 2;
  while (nextT < ac.currentTime + .25) {
    const i = step % song.melody.length, m = song.melody[i], b = song.bass[i];
    if (m != null) tone(midi(song.root + 12 + m), nextT, dur * 1.6, song.lead, .07);
    if (b != null) tone(midi(song.root + b), nextT, dur * 3.2, song.bassW, .06);
    nextT += dur; step++;
  }
}
export async function startMusic(name) {
  wanted = name; if (!ac) return; stopMusic(true);
  if (!(name in musicBufs)) { musicBufs[name] = (await loadBuf('music-' + name + '.mp3')) || (tried.m ? null : null); }
  if (!('generic' in musicBufs)) musicBufs.generic = await loadBuf('music.mp3');
  if (wanted !== name) return;
  const buf = musicBufs[name] || musicBufs.generic;
  if (buf) { srcNode = ac.createBufferSource(); srcNode.buffer = buf; srcNode.loop = true; srcNode.connect(mgain); srcNode.start(); return; }
  song = SONGS[name] || SONGS.village; step = 0; nextT = ac.currentTime + .05; timer = setInterval(schedule, 50);
}
export function stopMusic(keepWanted) {
  if (!keepWanted) wanted = null;
  if (timer) { clearInterval(timer); timer = null; } song = null;
  if (srcNode) { try { srcNode.stop(); } catch (e) {} srcNode = null; }
}
export function duck(on) { if (mgain) mgain.gain.value = on ? 0 : .5; }
