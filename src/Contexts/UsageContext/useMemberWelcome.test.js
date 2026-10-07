import { renderHook, act } from '@testing-library/react';
import useMemberWelcome from './useMemberWelcome';
import { acknowledgeMemberWelcome } from '../../Services/MemberWelcomeService';
import { acknowledgeAnnouncement } from '../../Services/ProductAnnouncementService';

jest.mock('../../Services/ProductAnnouncementService', () => ({ acknowledgeAnnouncement: jest.fn() }));

let mockCallbacks = {};
let mockStopped = [];
jest.mock('../../Services/MemberWelcomeService', () => ({
  ...jest.requireActual('../../Services/MemberWelcomeService'),
  watchMembership: (uid, callback) => { mockCallbacks[uid] = callback; return () => mockStopped.push(uid); },
  acknowledgeMemberWelcome: jest.fn(),
}));
jest.mock('../../Firebase/config', () => ({ db: {} }));
const profile = (ms) => ({ usage: { tier: 'pro' }, billing: { welcomeVersion: 1, proSince: ms } });
beforeEach(() => {
  localStorage.clear(); mockCallbacks = {}; mockStopped = [];
  acknowledgeMemberWelcome.mockResolvedValue(undefined);
  acknowledgeAnnouncement.mockResolvedValue(undefined);
});

test('acknowledges the release only when the member saw the surprise in their welcome', () => {
  const onProfile = () => {};
  const { result } = renderHook(() => useMemberWelcome('alice', onProfile));
  act(() => mockCallbacks.alice(profile(1000)));
  act(() => result.current.dismiss());
  expect(acknowledgeAnnouncement).not.toHaveBeenCalled();
  act(() => mockCallbacks.alice(profile(2000)));
  act(() => result.current.dismiss({ seenAnnouncementIds: ['faster-course-quizzes-v1'] }));
  expect(acknowledgeAnnouncement).toHaveBeenCalledWith('alice', 'faster-course-quizzes-v1');
});

test('opens after a delayed paid activation, once for that subscription, and again after resubscribing', () => {
  const onProfile = jest.fn();
  const { result } = renderHook(() => useMemberWelcome('alice', onProfile));
  act(() => mockCallbacks.alice({ usage: { tier: 'free' } }));
  expect(result.current.welcome).toBeNull();
  act(() => mockCallbacks.alice(profile(1000)));
  expect(result.current.welcome.key).toBe('v1:1000');
  act(() => result.current.dismiss());
  expect(acknowledgeMemberWelcome).toHaveBeenCalledWith('alice', 'v1:1000');
  act(() => mockCallbacks.alice(profile(1000)));
  expect(result.current.welcome).toBeNull();
  act(() => mockCallbacks.alice({ usage: { tier: 'free' } }));
  act(() => mockCallbacks.alice(profile(2000)));
  expect(result.current.welcome.key).toBe('v1:2000');
  expect(onProfile).toHaveBeenCalledWith(profile(2000));
});

test('does not interrupt existing Pro members or replay an acknowledged welcome on another device', () => {
  const onProfile = () => {};
  const { result } = renderHook(() => useMemberWelcome('alice', onProfile));
  act(() => mockCallbacks.alice({ usage: { tier: 'pro' }, billing: { proSince: 1000 } }));
  expect(result.current.welcome).toBeNull();
  act(() => mockCallbacks.alice({ ...profile(1000), memberWelcomeSeen: 'v1:1000' }));
  expect(result.current.welcome).toBeNull();
});

test('closes on downgrade and ignores late callbacks from a previous account', () => {
  const onProfile = jest.fn();
  const { result, rerender, unmount } = renderHook(({ uid }) => useMemberWelcome(uid, onProfile), { initialProps: { uid: 'alice' } });
  act(() => mockCallbacks.alice(profile(1000)));
  act(() => mockCallbacks.alice({ usage: { tier: 'free' } }));
  expect(result.current.welcome).toBeNull();
  act(() => mockCallbacks.alice(profile(1000)));
  const old = mockCallbacks.alice;
  rerender({ uid: 'bob' });
  expect(result.current.welcome).toBeNull();
  const callCount = onProfile.mock.calls.length;
  act(() => old(profile(3000)));
  expect(onProfile.mock.calls).toHaveLength(callCount);
  act(() => mockCallbacks.bob(profile(2000)));
  expect(result.current.welcome.uid).toBe('bob');
  unmount(); expect(mockStopped).toEqual(['alice', 'bob']);
});
