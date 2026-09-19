import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPaywallEvents,
  fetchReadinessEvents,
  fetchUsers,
  fetchUidsByEmail,
  fetchPayingUsers,
  MAX_PAYWALL_ROWS,
  MAX_READINESS_ROWS,
} from '../../Services/PaywallQueries';
import { buildPaywallRollup, TRIGGER_LABELS, TEST_EMAILS } from './paywallRollup';
import { buildReadinessFunnel } from './readinessFunnel';
import './SatisfactionDashboard.css';
import './PaywallTracker.css';

/**
 * PaywallTracker — dev-only read screen for the paywall rows in `funnelEvents`.
 *
 * WHAT IT ANSWERS, IN ORDER
 *
 *   1. How long since someone last paid, and has anyone been asked since?
 *   2. In this window, how many were stopped vs. chose to look?
 *   3. Which gate is doing the asking?
 *   4. Who, exactly — the list you would email.
 *
 * It reuses the satisfaction dashboard's stylesheet for the shared chrome
 * (header, cards, sections, window buttons) so the admin screens read as one
 * tool. See paywallRollup for the counting rules and PaywallQueries for why the
 * query is shaped the way it is.
 */

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 0, label: 'All time' },
];

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'wall', label: 'Hit a limit', test: (r) => r.wall },
  { id: 'browse', label: 'Only browsed', test: (r) => !r.wall },
  { id: 'checkout', label: 'Started checkout', test: (r) => r.checkouts > 0 },
  { id: 'paid', label: 'Pro now', test: (r) => r.status === 'paid' },
];

const STATUS_LABELS = { paid: 'Pro now', checkout: 'Started checkout' };

const triggerLabel = (key) => TRIGGER_LABELS[key] || key;

const formatDate = (d) =>
  d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

const formatDateTime = (d) =>
  d
    ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

const ratio = (used, max) => (used === null ? '—' : `${used}/${max ?? '?'}`);

const examLabel = (days) => {
  if (days === null) return '—';
  if (days < 0) return `${-days}d ago`;
  return days === 0 ? 'today' : `${days}d`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The verdict screen's two button labels (LockedPlanPreview CTA_VARIANTS).
const CTA_LABELS = { fix: '“Fix my weak spots”', build: '“Build my plan”' };

const shareLabel = (v) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/* Conversion rates here sit in single digits on small groups; a rounded
   "3%" and "4%" would hide the difference the section exists to show. */
const rateLabel = (v) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

const PaywallTracker = () => {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [events, pros, readinessEvents, testUids] = await Promise.all([
        fetchPaywallEvents(),
        fetchPayingUsers(),
        fetchReadinessEvents(),
        // One query instead of a user read per uploader.
        fetchUidsByEmail(TEST_EMAILS),
      ]);
      const uids = [...new Set(events.map((e) => e.uid).filter(Boolean))];
      const users = await fetchUsers(uids);
      setData({
        events,
        pros,
        users,
        readinessEvents,
        testUids,
        truncated: events.length >= MAX_PAYWALL_ROWS,
        readinessTruncated: readinessEvents.length >= MAX_READINESS_ROWS,
      });
    } catch (err) {
      console.error('Failed to load paywall events:', err);
      setError(err?.message || 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetched once, windowed here: switching windows is instant and never refetches.
  const rollup = useMemo(
    () => (data ? buildPaywallRollup({ ...data, days, now: new Date() }) : null),
    [data, days]
  );

  const readiness = useMemo(() => {
    if (!data || !rollup) return null;
    return buildReadinessFunnel({
      // Paywall rows ride along so "then saw the paywall" can be ordered
      // against the finding inside the same upload funnel.
      events: [...data.readinessEvents, ...data.events],
      pros: data.pros,
      excludeUids: [...data.testUids, ...rollup.testUids],
      days,
      now: new Date(),
    });
  }, [data, rollup, days]);

  const visible = useMemo(() => {
    if (!rollup) return [];
    const test = (FILTERS.find((f) => f.id === filter) || FILTERS[0]).test;
    const q = search.trim().toLowerCase();
    return rollup.people.filter(test).filter((r) => {
      if (!q) return true;
      return [r.email, r.name, r.studyGoal, r.topic, r.place, ...r.triggers.map((t) => triggerLabel(t.trigger))]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rollup, filter, search]);

  const maxDayViews = useMemo(
    () => (rollup ? Math.max(1, ...rollup.byDay.map((d) => d.views)) : 1),
    [rollup]
  );

  const copyEmails = async () => {
    const emails = visible.map((r) => r.email).filter(Boolean);
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const { totals, lastPro, sinceLastPro } = rollup || {};

  return (
    <div className="sat-dash pay-dash">
      <header className="sat-dash__header">
        <div>
          <h1 className="sat-dash__title">Paywall</h1>
          <p className="sat-dash__sub">
            <code>funnelEvents</code> · dev only
            {rollup && rollup.hiddenTestAccounts > 0 && ` · ${plural(rollup.hiddenTestAccounts, 'test account')} hidden`}
            {' · '}
            <Link to="/admin/satisfaction" className="sat-dash__link">satisfaction</Link>
          </p>
        </div>
        <div className="sat-dash__windows">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              className={`sat-dash__window ${days === w.days ? 'is-active' : ''}`}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </button>
          ))}
          <button type="button" className="sat-dash__refresh" onClick={load}>
            Refresh
          </button>
        </div>
      </header>

      {loading && <p className="sat-dash__state">Loading…</p>}

      {error && (
        <p className="sat-dash__state sat-dash__state--error">Couldn’t load paywall events: {error}</p>
      )}

      {!loading && !error && data?.truncated && (
        <p className="sat-dash__warn">
          Hit the {MAX_PAYWALL_ROWS.toLocaleString()}-row read cap — some rows are missing and every
          number below is a floor. Time for a backend aggregation.
        </p>
      )}

      {!loading && !error && data?.readinessTruncated && (
        <p className="sat-dash__warn">
          Hit the {MAX_READINESS_ROWS.toLocaleString()}-row read cap on upload rows — the readiness
          loop below is missing funnels and its shares are unreliable.
        </p>
      )}

      {!loading && !error && rollup && (
        <>
          {/* ── 1. The drought ── */}
          {lastPro && sinceLastPro && (
            <section className="sat-dash__section">
              <h2 className="sat-dash__h2">Since the last new Pro</h2>
              <p className="sat-dash__note">
                Last upgrade {formatDateTime(lastPro.at)}
                {lastPro.email ? ` · ${lastPro.email}` : ''}. Counted across all time, not the window
                above, so the gap is measured from where it really starts.
              </p>
              <div className="sat-dash__cards">
                <div className="sat-card sat-card--primary">
                  <span className="sat-card__label">Days without a new Pro</span>
                  <span className="sat-card__value">{lastPro.daysAgo}</span>
                  <span className="sat-card__meta">since {formatDate(lastPro.at)}</span>
                </div>
                <div className="sat-card">
                  <span className="sat-card__label">Saw the paywall since</span>
                  <span className="sat-card__value">{sinceLastPro.people}</span>
                  <span className="sat-card__meta">
                    {plural(sinceLastPro.views, 'view')} · {sinceLastPro.firstTimePeople} seeing it for the first time
                  </span>
                </div>
                <div className="sat-card">
                  <span className="sat-card__label">Hit a limit since</span>
                  <span className="sat-card__value">{sinceLastPro.wallPeople}</span>
                  <span className="sat-card__meta">people stopped by a gate</span>
                </div>
                <div className="sat-card">
                  <span className="sat-card__label">Started checkout since</span>
                  <span className="sat-card__value">{sinceLastPro.checkoutPeople}</span>
                  <span className="sat-card__meta">and none of them paid</span>
                </div>
              </div>
            </section>
          )}

          {/* ── The strategy's own numbers ── */}
          {readiness && (
            <section className="sat-dash__section">
              <h2 className="sat-dash__h2">Readiness loop</h2>
              <p className="sat-dash__note">
                The bet: a student who sees where she is weak is likelier to pay than one who simply
                runs out of questions. Counted per upload in this window. Until the readiness check
                ships, the quick-check score is the only scored result an upload produces — shown in
                italics as a proxy and never added to real findings.
              </p>
              {readiness.uploads === 0 ? (
                <p className="sat-dash__state">No uploads in this window.</p>
              ) : (
                <>
                  <div className="sat-dash__cards">
                    <div className="sat-card sat-card--primary">
                      <span className="sat-card__label">Uploaders who saw a weakness finding</span>
                      <span className="sat-card__value">{shareLabel(readiness.reach.share)}</span>
                      <span className="sat-card__meta">
                        {readiness.reach.finding} of {plural(readiness.reach.uploaders, 'student')} · the north-star
                      </span>
                    </div>
                  </div>

                  <table className="sat-table pay-table--spaced">
                    <thead>
                      <tr><th>Stage</th><th>Uploads</th><th>Share</th></tr>
                    </thead>
                    <tbody>
                      {readiness.stages.map((s) => (
                        <tr key={s.key} className={s.proxy ? 'pay-row--proxy' : undefined}>
                          <td>{s.label}</td>
                          <td>{s.count}</td>
                          <td>{shareLabel(s.share)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h3 className="sat-dash__h3">Paid within {readiness.windowDays} days</h3>
                  <p className="sat-dash__note">
                    Each student counted once, at the best moment she reached. Only people whose moment
                    is at least {readiness.windowDays} days old are judged — anyone newer is “too recent”,
                    not a miss. Students who were already Pro are left out.
                  </p>
                  <table className="sat-table">
                    <thead>
                      <tr>
                        <th>Best moment reached</th><th>People</th><th>Judged</th><th>Paid</th>
                        <th>Rate</th><th>Too recent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readiness.groups.map((g) => (
                        <tr key={g.key} className={g.key === 'proxy' ? 'pay-row--proxy' : undefined}>
                          <td>{g.label}</td>
                          <td>{g.people}</td>
                          <td>{g.judged}</td>
                          <td>{g.paid}</td>
                          <td>{rateLabel(g.rate)}</td>
                          <td>
                            {g.tooRecent}
                            {g.tooRecentPaid > 0 && ` (${g.tooRecentPaid} paid)`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {readiness.byCtaVariant.length > 0 && (
                    <>
                      <h3 className="sat-dash__h3">Verdict button test</h3>
                      <p className="sat-dash__note">
                        Each browser keeps one label. Counted per upload that showed a verdict; a click or
                        checkout only counts when it came after that verdict. Small numbers for a while:
                        read the checkout column before the click rate.
                      </p>
                      <table className="sat-table">
                        <thead>
                          <tr><th>Button</th><th>Verdicts</th><th>Clicked</th><th>Checkout</th><th>Click rate</th></tr>
                        </thead>
                        <tbody>
                          {readiness.byCtaVariant.map((v) => (
                            <tr key={v.variant}>
                              <td>{CTA_LABELS[v.variant] || v.variant}</td>
                              <td>{v.shown}</td>
                              <td>{v.clicked}</td>
                              <td>{v.checkout}</td>
                              <td>{shareLabel(v.shown ? v.clicked / v.shown : null)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </section>
          )}

          {totals.views === 0 ? (
            <p className="sat-dash__state">
              No paywall views in this window. That’s an absence of data, not a count of zero asks —
              try a longer window before concluding the gates never fire.
            </p>
          ) : (
            <>
              {/* ── 2. Wall vs browse ── */}
              <section className="sat-dash__section">
                <h2 className="sat-dash__h2">In this window</h2>
                <p className="sat-dash__note">
                  “Hit a limit” means a gate stopped her. “Only browsed” means she opened the offer with
                  budget left — a pull signal, and kept apart so it doesn’t pad the wall count. The upload
                  gate always counts as a wall.
                </p>
                <div className="sat-dash__cards">
                  <div className="sat-card">
                    <span className="sat-card__label">Saw the paywall</span>
                    <span className="sat-card__value">{totals.people}</span>
                    <span className="sat-card__meta">
                      {plural(totals.views, 'view')} · {totals.dismissals} closed
                    </span>
                  </div>
                  <div className="sat-card">
                    <span className="sat-card__label">Hit a limit</span>
                    <span className="sat-card__value">{totals.wallPeople}</span>
                    <span className="sat-card__meta">people</span>
                  </div>
                  <div className="sat-card">
                    <span className="sat-card__label">Only browsed</span>
                    <span className="sat-card__value">{totals.browsePeople}</span>
                    <span className="sat-card__meta">people</span>
                  </div>
                  <div className="sat-card">
                    <span className="sat-card__label">Started checkout</span>
                    <span className="sat-card__value">{totals.checkoutPeople}</span>
                    <span className="sat-card__meta">clicked through to Stripe</span>
                  </div>
                  <div className="sat-card">
                    <span className="sat-card__label">Pro now</span>
                    <span className="sat-card__value">{totals.paidPeople}</span>
                    <span className="sat-card__meta">of the people who saw it</span>
                  </div>
                </div>
              </section>

              {/* ── 3. Which gate ── */}
              <section className="sat-dash__section">
                <h2 className="sat-dash__h2">How it opened</h2>
                <table className="sat-table">
                  <thead>
                    <tr>
                      <th>Trigger</th><th>Views</th><th>People</th><th>Blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollup.byTrigger.map((t) => (
                      <tr key={t.trigger}>
                        <td>{triggerLabel(t.trigger)}</td>
                        <td>{t.views}</td>
                        <td>{t.people}</td>
                        <td>{t.wallViews}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* ── Where they are ── */}
              <section className="sat-dash__section">
                <h2 className="sat-dash__h2">Where they are</h2>
                {rollup.placesKnown === 0 ? (
                  <p className="sat-dash__state">
                    Nobody in this window can be placed yet. The browser’s timezone is only stamped on
                    rows written after the capture shipped (Sep 15), so this fills in from the next
                    paywall view onward — it does not backfill.
                  </p>
                ) : (
                  <>
                    <p className="sat-dash__note">
                      From the browser’s timezone, the only geography the product collects — no IP, no
                      third party. {rollup.placesKnown} of {totals.people} people carry one; the rest saw
                      the paywall before the capture shipped. Counted per person, and an unrecognised
                      zone is shown as itself rather than filed as unknown.
                    </p>
                    <table className="sat-table">
                      <thead>
                        <tr><th>Place</th><th>People</th><th>Views</th></tr>
                      </thead>
                      <tbody>
                        {rollup.byCountry.map((c) => (
                          <tr key={c.key}>
                            <td>{c.label}</td>
                            <td>{c.people}</td>
                            <td>{c.views}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>

              {rollup.byDay.length > 1 && (
                <section className="sat-dash__section">
                  <h2 className="sat-dash__h2">Views per day</h2>
                  <div className="pay-days">
                    {rollup.byDay.map((d) => (
                      <div
                        key={d.day}
                        className="pay-days__col"
                        title={`${d.day}: ${plural(d.views, 'view')}, ${plural(d.people, 'person')}`}
                      >
                        <div className="pay-days__bar" style={{ height: `${(d.views / maxDayViews) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                  <p className="sat-dash__note">
                    {rollup.byDay[0].day} → {rollup.byDay[rollup.byDay.length - 1].day} · peak {maxDayViews}/day
                  </p>
                </section>
              )}

              {/* ── 4. Who ── */}
              <section className="sat-dash__section">
                <h2 className="sat-dash__h2">
                  People <span className="sat-dash__count">{visible.length}</span>
                </h2>
                <p className="sat-dash__note">
                  Newest first. Questions, plans and exam date are from her most recent view. “Started
                  checkout” means she reached Stripe; whether she abandoned or is still on the page is only
                  in Stripe.
                </p>
                <div className="pay-toolbar">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`sat-dash__window ${filter === f.id ? 'is-active' : ''}`}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                  <input
                    type="search"
                    className="pay-search"
                    placeholder="Search email, goal, topic…"
                    aria-label="Search people"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="sat-dash__refresh"
                    onClick={copyEmails}
                    disabled={visible.length === 0}
                  >
                    {copied ? 'Copied' : 'Copy emails'}
                  </button>
                </div>

                {visible.length === 0 ? (
                  <p className="sat-dash__state">Nobody matches this filter.</p>
                ) : (
                  <div className="pay-table-wrap">
                    <table className="pay-table">
                      <thead>
                        <tr>
                          <th>Last seen</th>
                          <th>Student</th>
                          <th>Views</th>
                          <th>How it opened</th>
                          <th>Limit?</th>
                          <th>Questions</th>
                          <th>Plans</th>
                          <th>Exam in</th>
                          <th>Checkout</th>
                          <th>First seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => {
                          const meta = [r.name, r.place, r.studyGoal, r.topic].filter(Boolean).join(' · ');
                          return (
                            <tr key={r.uid}>
                              <td className="pay-num">{formatDateTime(r.lastAt)}</td>
                              <td>
                                <span className="pay-who__email">{r.email || r.uid.slice(0, 10)}</span>
                                {meta && <span className="pay-who__meta">{meta}</span>}
                              </td>
                              <td className="pay-num">{r.views}</td>
                              <td>
                                {r.triggers
                                  .map((t) => `${triggerLabel(t.trigger)}${t.count > 1 ? ` ×${t.count}` : ''}`)
                                  .join(', ')}
                              </td>
                              <td>
                                <span className={`pay-pill ${r.wall ? 'is-wall' : 'is-browse'}`}>
                                  {r.wall ? 'Blocked' : 'Browsing'}
                                </span>
                              </td>
                              <td className="pay-num">{ratio(r.questionsUsed, r.questionsLimit)}</td>
                              <td className="pay-num">{ratio(r.plansUsed, r.planLimit)}</td>
                              <td className="pay-num">{examLabel(r.examDaysAway)}</td>
                              <td>
                                {r.status === 'none' ? (
                                  '—'
                                ) : (
                                  <span className={`pay-pill is-${r.status}`}>{STATUS_LABELS[r.status]}</span>
                                )}
                                {r.checkoutPlans.length > 0 && (
                                  <span className="pay-who__meta">{r.checkoutPlans.join(', ')}</span>
                                )}
                              </td>
                              <td className="pay-num">{formatDate(r.firstAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PaywallTracker;
