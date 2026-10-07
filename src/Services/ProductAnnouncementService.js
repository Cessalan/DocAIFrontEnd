import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../Firebase/config';
import { PRODUCT_ANNOUNCEMENTS } from '../config/productAnnouncements';

const storageKey = (uid, id) => `nqAnnouncementSeen:${uid}:${id}`;
export const hasSeenAnnouncement = (uid, id, profile) => {
  if (profile?.featureAnnouncementsSeen?.[id] === true) return true;
  try { return window.localStorage.getItem(storageKey(uid, id)) === 'true'; }
  catch { return false; }
};

export const nextAnnouncement = (uid, profile, announcements = PRODUCT_ANNOUNCEMENTS) => {
  if (!uid || !profile) return null;
  const tier = profile.usage?.tier === 'pro' ? 'pro' : 'free';
  return announcements.find((item) => item.enabled
    && (item.audience === 'all' || item.audience === tier)
    && !hasSeenAnnouncement(uid, item.id, profile)) || null;
};

export const acknowledgeAnnouncement = async (uid, id) => {
  try { window.localStorage.setItem(storageKey(uid, id), 'true'); } catch { /* unavailable */ }
  // Field updates preserve acknowledgements for other releases. No billing or
  // entitlement fields are written by this presentation-only acknowledgement.
  await updateDoc(doc(db, 'users', uid), { [`featureAnnouncementsSeen.${id}`]: true });
};
