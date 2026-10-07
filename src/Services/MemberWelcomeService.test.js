import { memberActivationKey, hasSeenMemberWelcome, acknowledgeMemberWelcome, watchMembership } from './MemberWelcomeService';
import { onSnapshot, updateDoc } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
  doc: (_, collection, uid) => `${collection}/${uid}`,
  onSnapshot: jest.fn(), updateDoc: jest.fn(),
}));
jest.mock('../Firebase/config', () => ({ db: {} }));
const activation = (ms) => ({ usage: { tier: 'pro' }, billing: { welcomeVersion: 1, proSince: { toMillis: () => ms } } });

beforeEach(() => { localStorage.clear(); });

test('requires a new Stripe welcome version, confirmed Pro tier and valid activation date', () => {
  expect(memberActivationKey(activation(1000))).toBe('v1:1000');
  expect(memberActivationKey({ ...activation(1000), usage: { tier: 'free' } })).toBeNull();
  expect(memberActivationKey({ usage: { tier: 'pro' }, billing: { proSince: 1000 } })).toBeNull();
  expect(memberActivationKey({ ...activation(1000), billing: { welcomeVersion: 1, proSince: 'bad' } })).toBeNull();
});

test('waits for a server snapshot, including metadata-only confirmation after the cache', () => {
  const onProfile = jest.fn();
  watchMembership('alice', onProfile, () => {});
  const [reference, options, callback] = onSnapshot.mock.calls[0];
  expect(reference).toBe('users/alice'); expect(options.includeMetadataChanges).toBe(true);
  const snap = (fromCache, hasPendingWrites) => ({ metadata: { fromCache, hasPendingWrites }, exists: () => true, data: () => activation(1000) });
  callback(snap(true, false)); callback(snap(false, true));
  expect(onProfile).not.toHaveBeenCalled();
  callback(snap(false, false)); expect(memberActivationKey(onProfile.mock.calls[0][0])).toBe('v1:1000');
});

test('acknowledges only the welcome, persists across reloads and isolates users and resubscriptions', async () => {
  updateDoc.mockResolvedValue(undefined);
  await acknowledgeMemberWelcome('alice', 'v1:1000');
  expect(updateDoc).toHaveBeenCalledWith('users/alice', { memberWelcomeSeen: 'v1:1000' });
  expect(hasSeenMemberWelcome('alice', 'v1:1000', {})).toBe(true);
  expect(hasSeenMemberWelcome('bob', 'v1:1000', {})).toBe(false);
  expect(hasSeenMemberWelcome('alice', 'v1:2000', {})).toBe(false);
  expect(hasSeenMemberWelcome('bob', 'v1:1000', { memberWelcomeSeen: 'v1:1000' })).toBe(true);
});

test('keeps the device acknowledgement when the remote write fails', async () => {
  updateDoc.mockRejectedValue(new Error('offline'));
  await expect(acknowledgeMemberWelcome('alice', 'v1:1000')).rejects.toThrow('offline');
  expect(hasSeenMemberWelcome('alice', 'v1:1000', {})).toBe(true);
});
