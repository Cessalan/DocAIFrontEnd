import { renderHook, act } from '@testing-library/react';
import useProductAnnouncement from './useProductAnnouncement';
import { acknowledgeAnnouncement } from '../../Services/ProductAnnouncementService';
import { FASTER_QUIZZES_ANNOUNCEMENT_ID as speedId } from '../../config/productAnnouncements';

jest.mock('../../Services/ProductAnnouncementService', () => ({
  ...jest.requireActual('../../Services/ProductAnnouncementService'), acknowledgeAnnouncement: jest.fn(),
}));
jest.mock('../../Firebase/config', () => ({ db: {} }));
const pro = { usage: { tier: 'pro' } };
beforeEach(() => { localStorage.clear(); acknowledgeAnnouncement.mockResolvedValue(undefined); });

test('waits for a confirmed profile and shows existing Pro members the update only once this visit', () => {
  const { result, rerender } = renderHook(({ profile }) => useProductAnnouncement('alice', profile), { initialProps: { profile: null } });
  expect(result.current.announcement).toBeNull();
  rerender({ profile: pro });
  expect(result.current.announcement.id).toBe(speedId);
  act(() => result.current.dismiss());
  expect(acknowledgeAnnouncement).toHaveBeenCalledWith('alice', speedId);
  rerender({ profile: { ...pro } });
  expect(result.current.announcement).toBeNull();
});

test('does not stack an announcement after the subscription welcome', () => {
  const { result, rerender } = renderHook(({ suppress }) => useProductAnnouncement('alice', pro, suppress), { initialProps: { suppress: true } });
  expect(result.current.announcement).toBeNull();
  rerender({ suppress: false });
  expect(result.current.announcement).toBeNull();
});

test('does not interrupt a free member when they upgrade during a study visit', () => {
  const { result, rerender } = renderHook(({ profile }) => useProductAnnouncement('alice', profile), { initialProps: { profile: { usage: { tier: 'free' } } } });
  rerender({ profile: pro });
  expect(result.current.announcement).toBeNull();
});

test('closes when another device acknowledges the release or the member loses Pro', () => {
  const { result, rerender } = renderHook(({ profile }) => useProductAnnouncement('alice', profile), { initialProps: { profile: pro } });
  rerender({ profile: { ...pro, featureAnnouncementsSeen: { [speedId]: true } } });
  expect(result.current.announcement).toBeNull();
  const { result: bobResult, rerender: rerenderBob } = renderHook(({ profile }) => useProductAnnouncement('bob', profile), { initialProps: { profile: pro } });
  rerenderBob({ profile: { usage: { tier: 'free' } } });
  expect(bobResult.current.announcement).toBeNull();
});

test('isolates users and shows the next user their own unseen update', () => {
  const { result, rerender } = renderHook(({ uid, profile }) => useProductAnnouncement(uid, profile), { initialProps: { uid: 'alice', profile: pro } });
  act(() => result.current.dismiss());
  rerender({ uid: 'bob', profile: null });
  expect(result.current.announcement).toBeNull();
  rerender({ uid: 'bob', profile: pro });
  expect(result.current.announcement.id).toBe(speedId);
});
