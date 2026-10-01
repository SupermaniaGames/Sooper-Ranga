/* Optional Firebase: username login or guest, cloud save, leaderboards.
   Everything here is wrapped so the game still works when Firebase is not configured or offline. */
const V = '10.12.2', BASE = `https://www.gstatic.com/firebasejs/${V}/`;
let fb = null, auth = null, db = null, user = null, ready = false;
const listeners = [];
export const isReady = () => ready;
export const currentUser = () => user;
export const onChange = f => listeners.push(f);
const fire = () => listeners.forEach(f => { try { f(user); } catch (e) {} });
const emailOf = u => u.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') + '@sooperranga.app';

export async function init() {
  try {
    const { firebaseConfig } = await import('./firebase-config.js');
    if (!firebaseConfig.apiKey) return false;
    const [app, a, f] = await Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]);
    fb = { ...app, ...a, ...f };
    const inst = fb.initializeApp(firebaseConfig); auth = fb.getAuth(inst); db = fb.getFirestore(inst);
    ready = true;
    fb.onAuthStateChanged(auth, u => { user = u ? { uid: u.uid, name: u.displayName || 'Guest', guest: u.isAnonymous } : null; fire(); });
    return true;
  } catch (e) { console.warn('Firebase unavailable', e); ready = false; return false; }
}
function clean(name) { const n = (name || '').trim().slice(0, 14); return n; }
export async function signUp(name, pw) {
  name = clean(name); if (name.length < 3) throw new Error('Username needs 3+ letters or numbers');
  if ((pw || '').length < 6) throw new Error('Password needs 6+ characters');
  const c = await fb.createUserWithEmailAndPassword(auth, emailOf(name), pw);
  await fb.updateProfile(c.user, { displayName: name }); user = { uid: c.user.uid, name, guest: false }; fire(); return user;
}
export async function signIn(name, pw) {
  name = clean(name); if (!name || !pw) throw new Error('Enter username and password');
  const c = await fb.signInWithEmailAndPassword(auth, emailOf(name), pw); user = { uid: c.user.uid, name: c.user.displayName || name, guest: false }; fire(); return user;
}
export async function guest(name) {
  const c = await fb.signInAnonymously(auth); name = clean(name) || 'Guest' + Math.floor(1000 + Math.random() * 9000);
  await fb.updateProfile(c.user, { displayName: name }); user = { uid: c.user.uid, name, guest: true }; fire(); return user;
}
export async function signOut() { if (auth) await fb.signOut(auth); user = null; fire(); }
export function friendly(e) {
  const c = (e && e.code) || '';
  if (c.includes('email-already')) return 'That username is taken';
  if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('user-not-found')) return 'Wrong username or password';
  if (c.includes('network')) return 'No internet connection';
  if (c.includes('operation-not-allowed')) return 'Enable Email/Password and Anonymous sign-in in Firebase';
  return (e && e.message) || 'Something went wrong';
}
// progress = { unlocked, levels:{id:{best,stars,coins}}, coins }
export async function loadProgress() {
  if (!ready || !user) return null;
  try { const s = await fb.getDoc(fb.doc(db, 'users', user.uid)); return s.exists() ? s.data().progress || null : null; } catch (e) { return null; }
}
export async function saveProgress(progress) {
  if (!ready || !user) return;
  try { await fb.setDoc(fb.doc(db, 'users', user.uid), { username: user.name, progress, totalCoins: progress.coins || 0, updated: Date.now() }, { merge: true }); } catch (e) { console.warn(e); }
}
export async function submitScore(levelId, score, stars) {
  if (!ready || !user) return;
  try {
    const ref = fb.doc(db, 'scores', levelId, 'entries', user.uid), s = await fb.getDoc(ref);
    if (!s.exists() || (s.data().score || 0) < score) await fb.setDoc(ref, { username: user.name, score, stars, updated: Date.now() });
  } catch (e) { console.warn(e); }
}
export async function topScores(levelId) {
  if (!ready) return [];
  const q = fb.query(fb.collection(db, 'scores', levelId, 'entries'), fb.orderBy('score', 'desc'), fb.limit(10));
  return (await fb.getDocs(q)).docs.map(d => ({ name: d.data().username, value: d.data().score }));
}
export async function topCoins() {
  if (!ready) return [];
  const q = fb.query(fb.collection(db, 'users'), fb.orderBy('totalCoins', 'desc'), fb.limit(10));
  return (await fb.getDocs(q)).docs.map(d => ({ name: d.data().username, value: d.data().totalCoins || 0 }));
}
