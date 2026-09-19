import { buildReadinessFunnel } from './readinessFunnel';

const NOW = new Date('2026-09-30T12:00:00Z');
const ts = (iso) => ({ toDate: () => new Date(iso) });

let seq = 0;
const row = (step, funnelId, uid, iso, over = {}) => ({
  id: `r${(seq += 1)}`,
  step,
  funnelId,
  uid,
  createdAt: ts(iso),
  ...over,
});

const stage = (r, key) => r.stages.find((s) => s.key === key);
const group = (r, key) => r.groups.find((g) => g.key === key);

describe('buildReadinessFunnel', () => {
  it('is empty, not zero-filled with fake shares, when there are no uploads', () => {
    const r = buildReadinessFunnel({ now: NOW });
    expect(r.uploads).toBe(0);
    expect(stage(r, 'finding').share).toBeNull();
    expect(group(r, 'finding').rate).toBeNull();
  });

  it('counts each stage once per upload funnel', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [
        row('upload_started', 'f1', 'a', '2026-09-20T10:00:00Z'),
        row('upload_completed', 'f1', 'a', '2026-09-20T10:01:00Z'),
        row('upload_completed', 'f1', 'a', '2026-09-20T10:01:05Z'),
        row('readiness_check_started', 'f1', 'a', '2026-09-20T10:02:00Z'),
        row('weakness_insight_viewed', 'f1', 'a', '2026-09-20T10:08:00Z'),
        row('upload_started', 'f2', 'b', '2026-09-21T10:00:00Z'),
      ],
    });
    expect(r.uploads).toBe(2);
    expect(stage(r, 'completed')).toMatchObject({ count: 1, share: 0.5 });
    expect(stage(r, 'check').count).toBe(1);
    expect(stage(r, 'finding').count).toBe(1);
  });

  it('only credits the paywall and checkout when they come after the finding', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [
        row('upload_started', 'f1', 'a', '2026-09-20T10:00:00Z'),
        row('paywall_viewed', 'f1', 'a', '2026-09-20T10:03:00Z'),
        row('weakness_insight_viewed', 'f1', 'a', '2026-09-20T10:08:00Z'),
        row('checkout_started', 'f1', 'a', '2026-09-20T10:09:00Z'),
      ],
    });
    expect(stage(r, 'findingPaywall').count).toBe(0);
    expect(stage(r, 'findingCheckout').count).toBe(1);
  });

  it('keeps the quick-check proxy separate from real findings', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [
        row('upload_started', 'f1', 'a', '2026-09-20T10:00:00Z'),
        row('quick_check_completed', 'f1', 'a', '2026-09-20T10:05:00Z'),
      ],
    });
    expect(stage(r, 'proxy')).toMatchObject({ count: 1, proxy: true });
    expect(stage(r, 'finding').count).toBe(0);
    expect(group(r, 'proxy').people).toBe(1);
    expect(group(r, 'finding').people).toBe(0);
  });

  it('drops test accounts and uploads outside the window', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      days: 30,
      excludeUids: ['owner'],
      events: [
        row('upload_started', 'f1', 'owner', '2026-09-20T10:00:00Z'),
        row('upload_started', 'f2', 'old', '2026-08-01T10:00:00Z'),
        row('upload_started', 'f3', 'x', '2026-09-20T10:00:00Z'),
      ],
    });
    expect(r.uploads).toBe(1);
  });

  it('places a person in the best group she reached', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [
        row('upload_started', 'f1', 'a', '2026-09-10T10:00:00Z'),
        row('upload_started', 'f2', 'a', '2026-09-12T10:00:00Z'),
        row('weakness_insight_viewed', 'f2', 'a', '2026-09-12T10:08:00Z'),
      ],
    });
    expect(group(r, 'finding').people).toBe(1);
    expect(group(r, 'neither').people).toBe(0);
  });

  it('judges only people whose moment is a week old, and counts payment inside the week', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      pros: [
        { id: 'quick', billing: { firstProAt: ts('2026-09-12T09:00:00Z') } },
        { id: 'late', billing: { firstProAt: ts('2026-09-25T09:00:00Z') } },
        { id: 'fresh', billing: { firstProAt: ts('2026-09-29T09:00:00Z') } },
        { id: 'before', billing: { firstProAt: ts('2026-09-01T09:00:00Z') } },
      ],
      events: [
        // paid 2 days after the finding → a conversion
        row('upload_started', 'f1', 'quick', '2026-09-10T10:00:00Z'),
        row('weakness_insight_viewed', 'f1', 'quick', '2026-09-10T10:08:00Z'),
        // paid 15 days after → judged, not a conversion
        row('upload_started', 'f2', 'late', '2026-09-10T10:00:00Z'),
        row('weakness_insight_viewed', 'f2', 'late', '2026-09-10T10:08:00Z'),
        // finding 2 days ago → too recent to judge, even though she paid
        row('upload_started', 'f3', 'fresh', '2026-09-28T10:00:00Z'),
        row('weakness_insight_viewed', 'f3', 'fresh', '2026-09-28T10:08:00Z'),
        // already Pro when she saw it → not a conversion from it
        row('upload_started', 'f4', 'before', '2026-09-10T10:00:00Z'),
        row('weakness_insight_viewed', 'f4', 'before', '2026-09-10T10:08:00Z'),
        // never paid, old enough → judged, not converted
        row('upload_started', 'f5', 'none', '2026-09-10T10:00:00Z'),
        row('weakness_insight_viewed', 'f5', 'none', '2026-09-10T10:08:00Z'),
      ],
    });
    expect(group(r, 'finding')).toMatchObject({
      people: 5,
      judged: 3,
      paid: 1,
      tooRecent: 1,
      // "fresh" paid inside her window: visible, but not in the rate.
      tooRecentPaid: 1,
      alreadyPro: 1,
    });
    expect(group(r, 'finding').rate).toBeCloseTo(1 / 3);
  });

  it('reports reach per person, not per upload', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [
        // one student, two uploads, a finding on one of them
        row('upload_started', 'f1', 'a', '2026-09-20T10:00:00Z'),
        row('upload_started', 'f2', 'a', '2026-09-21T10:00:00Z'),
        row('weakness_insight_viewed', 'f2', 'a', '2026-09-21T10:08:00Z'),
        row('upload_started', 'f3', 'b', '2026-09-21T10:00:00Z'),
      ],
    });
    expect(r.uploads).toBe(3);
    expect(r.reach).toEqual({ uploaders: 2, finding: 1, share: 0.5 });
  });

  it('counts a payment by a student who is no longer Pro', () => {
    // The page passes everyone who ever paid; a lapsed subscriber still
    // carries firstProAt, and her conversion must not disappear.
    const r = buildReadinessFunnel({
      now: NOW,
      pros: [{ id: 'lapsed', usage: { tier: 'free' }, billing: { firstProAt: ts('2026-09-11T09:00:00Z') } }],
      events: [
        row('upload_started', 'f1', 'lapsed', '2026-09-10T10:00:00Z'),
        row('weakness_insight_viewed', 'f1', 'lapsed', '2026-09-10T10:08:00Z'),
      ],
    });
    expect(group(r, 'finding')).toMatchObject({ judged: 1, paid: 1 });
  });

  it('splits the verdict button test by label, counting only what followed the verdict', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [
        row('upload_started', 'f1', 'a', '2026-09-20T10:00:00Z'),
        row('weakness_insight_viewed', 'f1', 'a', '2026-09-20T10:08:00Z', { ctaVariant: 'fix' }),
        row('paywall_cta_clicked', 'f1', 'a', '2026-09-20T10:09:00Z'),
        row('checkout_started', 'f1', 'a', '2026-09-20T10:10:00Z'),
        row('upload_started', 'f2', 'b', '2026-09-20T11:00:00Z'),
        row('paywall_cta_clicked', 'f2', 'b', '2026-09-20T11:01:00Z'),
        row('weakness_insight_viewed', 'f2', 'b', '2026-09-20T11:08:00Z', { ctaVariant: 'build' }),
        // A verdict from before the test existed carries no label and is left out.
        row('upload_started', 'f3', 'c', '2026-09-20T12:00:00Z'),
        row('weakness_insight_viewed', 'f3', 'c', '2026-09-20T12:08:00Z'),
      ],
    });
    expect(r.byCtaVariant).toEqual([
      { variant: 'build', shown: 1, clicked: 0, checkout: 0 },
      { variant: 'fix', shown: 1, clicked: 1, checkout: 1 },
    ]);
  });

  it('ignores logged-out uploads for the people groups but keeps them in the stages', () => {
    const r = buildReadinessFunnel({
      now: NOW,
      events: [row('upload_started', 'f1', null, '2026-09-20T10:00:00Z')],
    });
    expect(r.uploads).toBe(1);
    expect(r.groups.every((g) => g.people === 0)).toBe(true);
  });
});
