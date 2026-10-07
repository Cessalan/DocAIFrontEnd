import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../Firebase/config';

// Stripe stamps this version on new activations only. Existing subscribers
// are not interrupted, and renewal events do not start another welcome.
export const memberActivationKey = (profile) => {
  if (profile?.usage?.tier !== 'pro' || profile?.billing?.welcomeVersion !== 1) return null;
  const since = profile.billing.proSince;
  const ms = typeof since?.toMillis === 'function' ? since.toMillis()
    : typeof since?.seconds === 'number' ? since.seconds * 1000
      : typeof since === 'number' ? since : Date.parse(since);
  return Number.isFinite(ms) && ms > 0 ? `v1:${ms}` : null;
};

const storageKey = (uid) => `nqMemberWelcomeSeen:${uid}`;
export const hasSeenMemberWelcome = (uid, activation, profile) => {
  if (profile?.memberWelcomeSeen === activation) return true;
  try { return window.localStorage.getItem(storageKey(uid)) === activation; }
  catch { return false; }
};

export const watchMembership = (uid, onProfile, onError) =>
  onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, (snapshot) => {
    // A cached or optimistic client write cannot confirm a paid activation.
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
      onProfile(snapshot.exists() ? snapshot.data() : {});
    }
  }, onError);

export const acknowledgeMemberWelcome = async (uid, activation) => {
  // Keep dismissals stable even if the acknowledgement cannot reach Firestore
  // right away. The server copy also prevents repeats on other devices.
  try { window.localStorage.setItem(storageKey(uid), activation); } catch { /* unavailable */ }
  await updateDoc(doc(db, 'users', uid), { memberWelcomeSeen: activation });
};
