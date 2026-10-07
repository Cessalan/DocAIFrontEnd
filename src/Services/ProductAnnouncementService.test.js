import { acknowledgeAnnouncement, hasSeenAnnouncement, nextAnnouncement } from './ProductAnnouncementService';
import { updateDoc } from 'firebase/firestore';
import { FASTER_QUIZZES_ANNOUNCEMENT_ID as speedId } from '../config/productAnnouncements';

jest.mock('firebase/firestore', () => ({ doc: (_, collection, uid) => `${collection}/${uid}`, updateDoc: jest.fn() }));
jest.mock('../Firebase/config', () => ({ db: {} }));
const pro = { usage: { tier: 'pro' } };
beforeEach(() => { localStorage.clear(); });

test('reaches existing Pro members with no welcome marker, and excludes free or signed-out users', () => {
  expect(nextAnnouncement('alice', pro).id).toBe(speedId);
  expect(nextAnnouncement('alice', {})).toBeNull();
  expect(nextAnnouncement('alice', { usage: { tier: 'free' } })).toBeNull();
  expect(nextAnnouncement(null, pro)).toBeNull();
  expect(nextAnnouncement('alice', null)).toBeNull();
});

test('remembers the specific release across visits and devices, but not for a different user or release', async () => {
  updateDoc.mockResolvedValue(undefined);
  await acknowledgeAnnouncement('alice', speedId);
  expect(updateDoc).toHaveBeenCalledWith('users/alice', { [`featureAnnouncementsSeen.${speedId}`]: true });
  expect(nextAnnouncement('alice', pro)).toBeNull();
  expect(nextAnnouncement('bob', pro).id).toBe(speedId);
  expect(nextAnnouncement('bob', { ...pro, featureAnnouncementsSeen: { [speedId]: true } })).toBeNull();
  expect(nextAnnouncement('alice', pro, [{ id: 'a-new-release', audience: 'pro', enabled: true }]).id).toBe('a-new-release');
});

test('selects the first enabled unseen announcement for the intended audience', () => {
  const releases = [
    { id: 'retired', audience: 'pro', enabled: false },
    { id: 'free-news', audience: 'free', enabled: true },
    { id: 'already-seen', audience: 'pro', enabled: true },
    { id: 'latest-news', audience: 'all', enabled: true },
    { id: 'older-news', audience: 'pro', enabled: true },
  ];
  expect(nextAnnouncement('alice', { ...pro, featureAnnouncementsSeen: { 'already-seen': true } }, releases).id).toBe('latest-news');
  expect(nextAnnouncement('alice', {}, releases).id).toBe('free-news');
});

test('keeps dismissal on this device when Firestore is temporarily unavailable', async () => {
  updateDoc.mockRejectedValue(new Error('offline'));
  await expect(acknowledgeAnnouncement('alice', speedId)).rejects.toThrow('offline');
  expect(hasSeenAnnouncement('alice', speedId, pro)).toBe(true);
});
