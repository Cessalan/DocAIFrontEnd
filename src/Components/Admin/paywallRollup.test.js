import {
  buildPaywallRollup,
  normalizeEvent,
  isWallView,
  TEST_EMAILS,
} from './paywallRollup';

const NOW = new Date('2026-09-15T18:00:00Z');
const ts = (iso) => ({ toDate: () => new Date(iso) });

let seq = 0;
const view = (uid, iso, over = {}) => ({
  id: `e${(seq += 1)}`,
  step: 'paywall_viewed',
  uid,
  createdAt: ts(iso),
  trigger: 'badge',
  blocked: false,
  questionsUsed: 10,
  questionsLimit: 70,
  plansUsed: 0,
  planLimit: 3,
  ...over,
});
const step = (name, uid, iso, over = {}) => ({ id: `e${(seq += 1)}`, step: name, uid, createdAt: ts(iso), ...over });

describe('normalizeEvent', () => {
  it('unwraps a Firestore Timestamp', () => {
    expect(normalizeEvent({ createdAt: ts('2026-09-10T12:00:00Z') }).at.toISOString())
      .toBe('2026-09-10T12:00:00.000Z');
  });

  it('falls back to the client clock when the server time is missing', () => {
    const ms = Date.parse('2026-09-11T09:30:00Z');
    expect(normalizeEvent({ createdAt: null, clientTs: ms }).at.getTime()).toBe(ms);
  });

  it('survives a row with nothing on it', () => {
    const e = normalizeEvent({});
    expect(e.uid).toBeNull();
    expect(e.at).toBeNull();
    expect(e.trigger).toBe('unknown');
    expect(e.blocked).toBe(false);
    expect(e.questionsUsed).toBeNull();
    expect(e.examDaysAway).toBeNull();
  });
});

describe('isWallView', () => {
  it('counts the upload gate as a wall even when the row was logged unblocked', () => {
    expect(isWallView(normalizeEvent({ trigger: 'upload_gate', blocked: false }))).toBe(true);
  });

  it('treats a badge tap with budget left as a browse', () => {
    expect(isWallView(normalizeEvent({ trigger: 'badge', blocked: false }))).toBe(false);
  });

  it('trusts blocked:true from any trigger', () => {
    expect(isWallView(normalizeEvent({ trigger: 'badge', blocked: true }))).toBe(true);
  });
});

describe('buildPaywallRollup', () => {
  it('returns an empty rollup, not zeros that look like data, for no rows', () => {
    const r = buildPaywallRollup({ now: NOW });
    expect(r.totals.views).toBe(0);
    expect(r.people).toEqual([]);
    expect(r.byDay).toEqual([]);
    expect(r.lastPro).toBeNull();
    expect(r.sinceLastPro).toBeNull();
  });

  it('counts views and distinct people, splitting walls from browses', () => {
    const r = buildPaywallRollup({
      now: NOW,
      events: [
        view('a', '2026-09-14T12:00:00Z'),
        view('a', '2026-09-14T13:00:00Z'),
        view('b', '2026-09-14T14:00:00Z', { trigger: 'upload_gate' }),
        view('c', '2026-09-14T15:00:00Z', { trigger: 'question_throttle', blocked: true }),
      ],
    });
    expect(r.totals).toMatchObject({ views: 4, people: 3, wallPeople: 2, browsePeople: 1 });
  });

  it('drops test accounts by email (any case) and by dev study goal, including their checkouts', () => {
    const r = buildPaywallRollup({
      now: NOW,
      users: { owner: { email: TEST_EMAILS[0].toUpperCase() } },
      events: [
        view('owner', '2026-09-14T12:00:00Z'),
        view('dev', '2026-09-14T12:00:00Z', { studyGoal: 'Skipped (Dev)' }),
        step('checkout_started', 'dev', '2026-09-14T12:01:00Z'),
        view('x', '2026-09-14T12:00:00Z'),
      ],
    });
    expect(r.people.map((p) => p.uid)).toEqual(['x']);
    expect(r.totals.checkoutPeople).toBe(0);
    expect(r.hiddenTestAccounts).toBe(2);
  });

  it('applies the window to views', () => {
    const events = [view('old', '2026-08-01T12:00:00Z'), view('recent', '2026-09-14T12:00:00Z')];
    expect(buildPaywallRollup({ now: NOW, days: 30, events }).people.map((p) => p.uid)).toEqual(['recent']);
    expect(buildPaywallRollup({ now: NOW, days: 0, events }).totals.people).toBe(2);
  });

  it('rolls one person up with her latest state, triggers and checkout', () => {
    const r = buildPaywallRollup({
      now: NOW,
      users: { s: { email: 's@school.edu' } },
      events: [
        view('s', '2026-09-13T12:00:00Z', { questionsUsed: 10, topic: 'Cardiac' }),
        view('s', '2026-09-14T12:00:00Z', { trigger: 'question_throttle', blocked: true, questionsUsed: 70 }),
        step('paywall_dismissed', 's', '2026-09-14T12:00:30Z'),
        step('checkout_started', 's', '2026-09-14T12:01:00Z', { planId: 'monthly' }),
      ],
    });
    const [p] = r.people;
    expect(p).toMatchObject({
      email: 's@school.edu',
      views: 2,
      wall: true,
      questionsUsed: 70,
      topic: 'Cardiac',
      dismissed: 1,
      checkouts: 1,
      checkoutPlans: ['monthly'],
      status: 'checkout',
    });
    expect(p.firstAt.toISOString()).toBe('2026-09-13T12:00:00.000Z');
    expect(p.lastAt.toISOString()).toBe('2026-09-14T12:00:00.000Z');
    expect(p.triggers).toEqual([
      { trigger: 'badge', count: 1 },
      { trigger: 'question_throttle', count: 1 },
    ]);
  });

  it('marks a viewer who is Pro now as paid', () => {
    const r = buildPaywallRollup({
      now: NOW,
      users: { p: { usage: { tier: 'pro' }, billing: { proSince: ts('2026-09-14T13:00:00Z') } } },
      events: [view('p', '2026-09-14T12:00:00Z')],
    });
    expect(r.people[0].status).toBe('paid');
    expect(r.totals.paidPeople).toBe(1);
  });

  it('counts distinct people per trigger', () => {
    const r = buildPaywallRollup({
      now: NOW,
      events: [
        view('a', '2026-09-14T12:00:00Z'),
        view('a', '2026-09-14T13:00:00Z'),
        view('b', '2026-09-14T14:00:00Z'),
      ],
    });
    expect(r.byTrigger).toEqual([{ trigger: 'badge', views: 3, wallViews: 0, people: 2 }]);
  });

  it('fills days with no views so a quiet day reads as zero', () => {
    const r = buildPaywallRollup({
      now: NOW,
      events: [view('a', '2026-09-10T12:00:00Z'), view('b', '2026-09-12T12:00:00Z')],
    });
    expect(r.byDay.map((d) => d.views)).toEqual([1, 0, 1]);
  });

  it('places people by timezone, counting people not views, with unknown last', () => {
    const r = buildPaywallRollup({
      now: NOW,
      events: [
        view('a', '2026-09-14T12:00:00Z', { timeZone: 'America/Chicago' }),
        view('a', '2026-09-14T13:00:00Z', { timeZone: 'America/Chicago' }),
        view('b', '2026-09-14T14:00:00Z', { timeZone: 'America/New_York' }),
        view('c', '2026-09-14T15:00:00Z', { timeZone: 'Asia/Manila' }),
        // Predates the capture: no timezone at all.
        view('d', '2026-09-14T16:00:00Z'),
      ],
    });
    expect(r.byCountry).toEqual([
      { key: 'US', code: 'US', label: 'United States', people: 2, views: 3 },
      { key: 'PH', code: 'PH', label: 'Philippines', people: 1, views: 1 },
      { key: 'unknown', code: null, label: 'Unknown', people: 1, views: 1 },
    ]);
    expect(r.placesKnown).toBe(3);
  });

  it('keeps an unmapped zone visible instead of filing it as unknown', () => {
    const r = buildPaywallRollup({
      now: NOW,
      events: [view('a', '2026-09-14T12:00:00Z', { timeZone: 'Antarctica/Troll' })],
    });
    expect(r.byCountry).toEqual([
      { key: 'Antarctica/Troll', code: null, label: 'Antarctica/Troll', people: 1, views: 1 },
    ]);
    expect(r.people[0].country).toBeNull();
  });

  it('measures the drought from the newest real Pro, ignoring test accounts and the window', () => {
    const r = buildPaywallRollup({
      now: NOW,
      days: 1,
      pros: [
        { id: 'p0', email: 'early@x.com', billing: { proSince: ts('2026-09-08T00:00:00Z') } },
        { id: 'p1', email: 'last@x.com', billing: { proSince: ts('2026-09-11T16:27:00Z') } },
        { id: 't', email: TEST_EMAILS[1], billing: { proSince: ts('2026-09-14T00:00:00Z') } },
      ],
      events: [
        view('u1', '2026-09-10T12:00:00Z'),
        view('u1', '2026-09-13T12:00:00Z'),
        view('u2', '2026-09-13T15:00:00Z', { trigger: 'upload_gate' }),
        step('checkout_started', 'u2', '2026-09-13T15:05:00Z'),
        view('u3', '2026-09-09T12:00:00Z'),
      ],
    });
    expect(r.lastPro).toMatchObject({ uid: 'p1', email: 'last@x.com', daysAgo: 4 });
    // Every view here is older than the 1-day window; the drought still sees them.
    expect(r.totals.views).toBe(0);
    expect(r.sinceLastPro).toEqual({
      views: 2,
      people: 2,
      firstTimePeople: 1,
      wallPeople: 1,
      checkoutPeople: 1,
    });
  });
});
