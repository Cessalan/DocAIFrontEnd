import { filterBySignup } from './signupFilter';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const users = {
  early: { createdAt: ts('2026-08-01T12:00:00Z') },
  inside: { createdAt: ts('2026-09-05T12:00:00Z') },
  noDate: { email: 'x@y.z' },
};
const range = { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-10T00:00:00Z') };

describe('filterBySignup', () => {
  it('is a no-op without a range', () => {
    const events = [{ uid: 'early' }];
    expect(filterBySignup(events, users, {})).toEqual({ events, unknown: 0 });
  });

  it('keeps students who signed up in range and counts the unplaceable', () => {
    const events = [{ uid: 'early' }, { uid: 'inside' }, { uid: 'noDate' }, { uid: 'missing' }];
    const r = filterBySignup(events, users, range);
    expect(r.events.map((e) => e.uid)).toEqual(['inside']);
    expect(r.unknown).toBe(2);
  });

  it('keeps a funnel\'s logged-out rows with the student it belongs to', () => {
    const events = [
      { funnelId: 'f1', uid: null, step: 'upload_started' },
      { funnelId: 'f1', uid: 'inside', step: 'upload_completed' },
      { funnelId: 'f2', uid: null, step: 'upload_started' },
      { funnelId: 'f2', uid: 'early', step: 'upload_completed' },
    ];
    const r = filterBySignup(events, users, range);
    expect(r.events.map((e) => `${e.funnelId}:${e.step}`)).toEqual(['f1:upload_started', 'f1:upload_completed']);
  });
});
