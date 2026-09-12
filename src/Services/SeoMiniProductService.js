const PREFIX = 'nq-seo-v1:';
const memory = new Map();
export function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key)) || memory.get(key) || null; } catch { return memory.get(key) || null; }
}
export function writeLocal(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function acquisition(page) {
  const prior = readLocal('acquisition');
  if (prior && Date.now() - prior.at < 30 * 86400000) return prior;
  const params = new URLSearchParams(window.location.search);
  let host = '';
  try { host = new URL(document.referrer).hostname; } catch { /* Direct visit. */ }
  const value = { landingPage: page.slug, keywordCluster: page.cluster, at: Date.now(),
    funnelId: `seo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    source: params.get('utm_source')?.slice(0, 80) || (/google|bing|duckduckgo|yahoo/.test(host) ? 'organic_search' : host ? 'referral' : 'direct'),
    campaign: params.get('utm_campaign')?.slice(0, 80) || null };
  writeLocal('acquisition', value);
  return value;
}
export async function trackSeo(step, page, detail = {}) {
  try {
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    const context = page ? acquisition(page) : readLocal('acquisition');
    if (!context) return;
    const { logFunnelStep } = await import('./FunnelService');
    await logFunnelStep(step, { ...context, productPage: page?.slug || context.landingPage, ...detail, environment: process.env.NODE_ENV });
  } catch { /* Analytics must never interrupt learning. */ }
}
export async function recordSeoSignup(user, isNewUser = true) {
  if (!user?.uid || !readLocal('acquisition')) return;
  if (isNewUser) trackSeo('seo_signup', null, { uid: user.uid, isAnonymous: false });
  await persistAcquisition(user.uid);
  const pending = readLocal('handoff');
  if (pending?.slug && pending.value && Date.now() - pending.at < 86400000) {
    const [{ db }, { doc, setDoc }] = await Promise.all([import('../Firebase/config'), import('firebase/firestore')]);
    await setDoc(doc(db, 'users', user.uid, 'seoMiniProducts', pending.slug), { value: pending.value, updatedAt: new Date().toISOString() });
  }
}
async function persistAcquisition(uid) {
  const context = readLocal('acquisition');
  if (!context || Date.now() - context.at > 30 * 86400000) return;
  const [{ db }, { doc, runTransaction }] = await Promise.all([import('../Firebase/config'), import('firebase/firestore')]);
  await runTransaction(db, async tx => {
    const ref = doc(db, 'users', uid, 'seoAttribution', 'firstTouch');
    const snap = await tx.get(ref);
    if (!snap.exists()) tx.set(ref, context);
  });
}
export async function loadSavedProduct(slug) {
  const [{ auth, db }, { doc, getDoc }] = await Promise.all([import('../Firebase/config'), import('firebase/firestore')]);
  if (!auth.currentUser) return null;
  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'seoMiniProducts', slug));
  return snap.exists() ? snap.data().value : null;
}
export async function continueSeo(page, value, { save = false, topic = '', track = 'RN', automatic = false } = {}) {
  writeLocal(page.slug, value);
  writeLocal('handoff', { slug: page.slug, value, at: Date.now() });
  if (!automatic) trackSeo('seo_nursequiz_cta_clicked', page, { action: save ? 'save' : 'practice' });
  const [{ auth, db }, { doc, setDoc }] = await Promise.all([import('../Firebase/config'), import('firebase/firestore')]);
  const returnTo = save ? `/${page.slug}?save=1#mini-product` : '/c';
  if (!save) {
    const exam = page.cluster === 'HESI A2' ? 'HESI A2 admission' : page.cluster === 'Nursing HESI' ? 'nursing HESI-style' : `NCLEX-${track}`;
    try {
      sessionStorage.setItem('pendingQuizPrompt', `Help me prepare for ${exam}. Start a short practice on ${topic || page.title}. Use my account's remaining question allowance. Explain mistakes clearly.`);
      sessionStorage.setItem('pendingQuizTopic', topic || page.title);
    } catch { throw new Error('Your browser could not keep the practice handoff. Allow site storage and try again.'); }
  }
  if (!auth.currentUser) return `/signup?returnTo=${encodeURIComponent(returnTo)}`;
  persistAcquisition(auth.currentUser.uid).catch(() => {});
  await setDoc(doc(db, 'users', auth.currentUser.uid, 'seoMiniProducts', page.slug), { value, updatedAt: new Date().toISOString() });
  if (save && value?.plan) {
    await setDoc(doc(db, 'users', auth.currentUser.uid, 'nclexMeta', 'profile'), { examDate: value.plan.examDate, examTrack: value.plan.track, dailyStudyMinutes: value.plan.minutes }, { merge: true });
  }
  return save ? null : returnTo;
}
