import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../Firebase/config';
import { FREE_LIMIT, FREE_PLANS_PER_WINDOW } from '../../Services/UsageService';
import './ProMembersViewer.css';

/**
 * ProMembersViewer — dev-only roster of paying subscribers.
 *
 * Exists because answering "who converted, when, and what gated them" used to
 * mean a Firestore script cross-referenced against the Stripe API by hand.
 * Everything here is already in the user doc; it just had no surface.
 *
 * The trigger column is INFERRED, not logged. It leans on a real property of
 * the meters: consumeGeneration/consumePlan short-circuit on tier === 'pro',
 * so both counters FREEZE at the moment of payment. The stored numbers are
 * therefore the allowance the student had left when they paid — a maxed plan
 * counter means they hit the plan wall. Once a `paywall_shown` event exists,
 * delete this inference and read the real reason.
 */

/** Firestore Timestamp | Date | ISO string | epoch ms → Date | null. */
const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(typeof v === 'number' ? v : String(v));
  return isNaN(d.getTime()) ? null : d;
};

const fmtDateTime = (d) =>
  d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (d) =>
  d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

/** "3d ago" / "today" — coarse on purpose; the exact stamp is in the title attr. */
const relative = (d) => {
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / (60 * 24));
  return days === 1 ? 'yesterday' : `${days}d ago`;
};

/** Signup → payment, the consideration window. */
const spanToPaid = (createdAt, proSince) => {
  if (!createdAt || !proSince) return null;
  const mins = Math.round((proSince.getTime() - createdAt.getTime()) / 60000);
  if (mins < 0) return null;
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / (60 * 24))}d`;
};

const isSameDay = (a, b) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Which gate most likely produced the sale, from the frozen meters.
 * Ordered by how conclusive the evidence is: a maxed counter is proof of a
 * hard block; two untouched counters prove no meter was involved at all.
 */
const inferTrigger = (u) => {
  const plans = u.planUsage?.count ?? 0;
  const questions = Number(u.usage?.count ?? 0) || 0;
  if (plans >= FREE_PLANS_PER_WINDOW) {
    return { label: 'Plan wall', tone: 'hard', why: `planUsage ${plans}/${FREE_PLANS_PER_WINDOW} — hard-blocked before checkout` };
  }
  if (questions >= FREE_LIMIT) {
    return { label: 'Question wall', tone: 'hard', why: `usage.count ${questions} at or past the ${FREE_LIMIT} cap` };
  }
  if (!plans && !questions) {
    return { label: 'Pull', tone: 'pull', why: 'both meters untouched — they opened the paywall themselves' };
  }
  return { label: 'Upload gate / pull', tone: 'soft', why: `${questions}/${FREE_LIMIT} questions, ${plans}/${FREE_PLANS_PER_WINDOW} plans — neither meter was full, so the upload gate or a self-serve click` };
};

const ProMembersViewer = ({ onClose, onImpersonateUser }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});   // uid -> { plans, events, loading }
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('usage.tier', '==', 'pro')));
      const rows = snap.docs.map((d) => {
        const x = d.data();
        const billing = x.billing || {};
        return {
          uid: d.id,
          email: x.email || '',
          displayName: x.displayName || '',
          usage: x.usage || {},
          planUsage: x.planUsage || null,
          createdAt: toDate(x.createdAt),
          updatedAt: toDate(x.updatedAt),
          examDate: toDate(x.onboarding?.examDate),
          onboarding: x.onboarding || null,
          stripeCustomerId: x.stripeCustomerId || '',
          stripeSubscriptionId: x.stripeSubscriptionId || '',
          billing,
          // proSince is the webhook's stamp; firstProAt survives churn-and-return.
          proSince: toDate(billing.proSince) || toDate(billing.firstProAt),
          proEndedAt: toDate(billing.proEndedAt),
          cancelAtPeriodEnd: !!billing.cancelAtPeriodEnd,
          accessEndsAt: toDate(billing.accessEndsAt),
          backfilled: !!billing.backfilledFrom
        };
      });
      // Newest conversion first. Rows with no stamp yet sink to the bottom
      // rather than silently sorting as epoch 0 among the oldest members.
      rows.sort((a, b) => {
        if (!a.proSince && !b.proSince) return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
        if (!a.proSince) return 1;
        if (!b.proSince) return -1;
        return b.proSince.getTime() - a.proSince.getTime();
      });
      setMembers(rows);
    } catch (e) {
      console.error('ProMembersViewer load failed:', e);
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Per-row detail is lazy: one chats query and one subcollection read per
  // member, run only when a row is actually opened.
  const loadDetail = useCallback(async (uid) => {
    setDetail((p) => ({ ...p, [uid]: { ...(p[uid] || {}), loading: true } }));
    try {
      const chatSnap = await getDocs(query(collection(db, 'chats'), where('userId', '==', uid)));
      const plans = chatSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.isStudySession)
        .map((c) => {
          const nodes = c.study?.path?.nodes || [];
          return {
            id: c.id,
            title: c.title || '(untitled)',
            examDate: toDate(c.examDate),
            updatedAt: toDate(c.updatedAt),
            done: nodes.filter((n) => n.status === 'done' || n.status === 'completed').length,
            total: nodes.length
          };
        })
        .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));

      let events = [];
      try {
        const evSnap = await getDocs(collection(db, 'users', uid, 'billingEvents'));
        events = evSnap.docs
          .map((d) => ({ id: d.id, ...d.data(), at: toDate(d.data().at) }))
          .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
      } catch { /* subcollection may not exist yet */ }

      setDetail((p) => ({ ...p, [uid]: { plans, events, chatCount: chatSnap.size, loading: false } }));
    } catch (e) {
      console.error('detail load failed:', e);
      setDetail((p) => ({ ...p, [uid]: { plans: [], events: [], loading: false, error: e.message } }));
    }
  }, []);

  const toggleRow = (uid) => {
    const next = expanded === uid ? null : uid;
    setExpanded(next);
    if (next && !detail[next]) loadDetail(next);
  };

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text || '');
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return {
      total: members.length,
      today: members.filter((m) => isSameDay(m.proSince, now)).length,
      week: members.filter((m) => m.proSince && m.proSince >= weekAgo).length,
      churning: members.filter((m) => m.cancelAtPeriodEnd).length,
      undated: members.filter((m) => !m.proSince).length
    };
  }, [members]);

  return (
    <div className="pmv-overlay" onClick={onClose}>
      <div className="pmv-modal" onClick={(e) => e.stopPropagation()}>

        <div className="pmv-header">
          <div>
            <h2>💎 Pro Members</h2>
            <div className="pmv-sub">
              {loading ? 'loading…' : (
                <>
                  <strong>{stats.total}</strong> paying
                  {stats.today > 0 && <> · <span className="pmv-hot">{stats.today} today</span></>}
                  {stats.week > 0 && <> · {stats.week} this week</>}
                  {stats.churning > 0 && <> · <span className="pmv-warn">{stats.churning} cancelling</span></>}
                </>
              )}
            </div>
          </div>
          <div className="pmv-header-actions">
            <button className="pmv-btn" onClick={() => copy(members.map((m) => m.email).filter(Boolean).join(', '), 'all')}>
              {copied === 'all' ? '✓ Copied' : 'Copy emails'}
            </button>
            <button className="pmv-btn" onClick={load} disabled={loading}>↻ Refresh</button>
            <button className="pmv-close" onClick={onClose}>×</button>
          </div>
        </div>

        {stats.undated > 0 && !loading && (
          <div className="pmv-note">
            {stats.undated} member{stats.undated > 1 ? 's have' : ' has'} no <code>billing.proSince</code> — they converted before
            the webhook recorded timestamps. Backfill with{' '}
            <code>python tools/backfill_billing_dates.py --apply</code> in NQBackEnd2.
          </div>
        )}

        <div className="pmv-body">
          {loading && <div className="pmv-empty">Loading subscribers…</div>}
          {error && <div className="pmv-empty pmv-error">{error}</div>}
          {!loading && !error && members.length === 0 && <div className="pmv-empty">No Pro members yet.</div>}

          {!loading && members.map((m) => {
            const trigger = inferTrigger(m);
            const questions = Number(m.usage?.count ?? 0) || 0;
            const plans = m.planUsage?.count ?? 0;
            const open = expanded === m.uid;
            const d = detail[m.uid];

            return (
              <div key={m.uid} className={`pmv-row ${open ? 'open' : ''}`}>
                <div className="pmv-row-main" onClick={() => toggleRow(m.uid)}>
                  <div className="pmv-who">
                    <div className="pmv-email">
                      {m.email || <span className="pmv-muted">(no email)</span>}
                      {isSameDay(m.proSince, new Date()) && <span className="pmv-badge new">NEW</span>}
                      {m.cancelAtPeriodEnd && <span className="pmv-badge churn">CANCELLING</span>}
                    </div>
                    <div className="pmv-name">{m.displayName || <span className="pmv-muted">no display name</span>}</div>
                  </div>

                  <div className="pmv-col">
                    <div className="pmv-label">Pro since</div>
                    <div className="pmv-val" title={m.proSince ? m.proSince.toISOString() : 'not recorded'}>
                      {m.proSince ? fmtDateTime(m.proSince) : <span className="pmv-muted">—</span>}
                      {m.backfilled && <span className="pmv-tick" title="reconstructed from Stripe, not observed live">*</span>}
                    </div>
                    <div className="pmv-sub-val">{relative(m.proSince)}</div>
                  </div>

                  <div className="pmv-col">
                    <div className="pmv-label">Signup → paid</div>
                    <div className="pmv-val">{spanToPaid(m.createdAt, m.proSince) || <span className="pmv-muted">—</span>}</div>
                    <div className="pmv-sub-val">joined {fmtDate(m.createdAt)}</div>
                  </div>

                  <div className="pmv-col pmv-col-wide">
                    <div className="pmv-label">Likely trigger</div>
                    <div className={`pmv-trigger ${trigger.tone}`} title={trigger.why}>{trigger.label}</div>
                    <div className="pmv-meters">
                      <span className={questions >= FREE_LIMIT ? 'full' : ''}>{questions}/{FREE_LIMIT}q</span>
                      <span className={plans >= FREE_PLANS_PER_WINDOW ? 'full' : ''}>{plans}/{FREE_PLANS_PER_WINDOW}p</span>
                    </div>
                  </div>

                  <div className="pmv-col">
                    <div className="pmv-label">Last active</div>
                    <div className="pmv-val">{relative(m.updatedAt) || '—'}</div>
                    <div className="pmv-sub-val">{m.examDate ? `exam ${fmtDate(m.examDate)}` : ''}</div>
                  </div>

                  <div className="pmv-chevron">{open ? '▾' : '▸'}</div>
                </div>

                {open && (
                  <div className="pmv-detail">
                    <div className="pmv-detail-actions">
                      <button className="pmv-btn sm" onClick={() => copy(m.email, m.uid + 'e')}>
                        {copied === m.uid + 'e' ? '✓' : 'Copy email'}
                      </button>
                      <button className="pmv-btn sm" onClick={() => copy(m.uid, m.uid + 'u')}>
                        {copied === m.uid + 'u' ? '✓' : 'Copy UID'}
                      </button>
                      {onImpersonateUser && (
                        <button
                          className="pmv-btn sm accent"
                          onClick={() => { onImpersonateUser(m.uid); onClose(); }}
                        >
                          👁 View as this user
                        </button>
                      )}
                      {m.stripeCustomerId && (
                        <a
                          className="pmv-btn sm"
                          href={`https://dashboard.stripe.com/customers/${m.stripeCustomerId}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Stripe ↗
                        </a>
                      )}
                    </div>

                    <div className="pmv-why">
                      <strong>Why "{trigger.label}":</strong> {trigger.why}. Both meters freeze at payment
                      (consume short-circuits on Pro), so these are the numbers at checkout — not today's.
                    </div>

                    <div className="pmv-detail-grid">
                      <div><span>UID</span><code>{m.uid}</code></div>
                      <div><span>Subscription</span><code>{m.stripeSubscriptionId || '—'}</code></div>
                      <div><span>Status</span><code>{m.billing?.status || 'pro (unrecorded)'}</code></div>
                      {m.accessEndsAt && <div><span>Access ends</span><code>{fmtDateTime(m.accessEndsAt)}</code></div>}
                      {m.proEndedAt && <div><span>Pro ended</span><code>{fmtDateTime(m.proEndedAt)}</code></div>}
                      {m.onboarding?.studyGoal && <div><span>Goal</span><code>{m.onboarding.studyGoal}</code></div>}
                      {m.onboarding?.userStage && <div><span>Stage</span><code>{m.onboarding.userStage}</code></div>}
                      {m.onboarding?.reviewFormat && <div><span>Wants</span><code>{m.onboarding.reviewFormat}</code></div>}
                    </div>

                    {d?.loading && <div className="pmv-empty sm">Loading their plans…</div>}

                    {d && !d.loading && (
                      <>
                        <div className="pmv-detail-head">
                          Study plans ({d.plans.length}) · {d.chatCount} chats
                        </div>
                        {d.plans.length === 0 && <div className="pmv-empty sm">No study plans.</div>}
                        {d.plans.map((p) => (
                          <div key={p.id} className="pmv-plan">
                            <div className="pmv-plan-title">{p.title}</div>
                            <div className="pmv-plan-meta">
                              {p.done}/{p.total} nodes
                              {p.examDate && <> · exam {fmtDate(p.examDate)}</>}
                              {p.updatedAt && <> · {relative(p.updatedAt)}</>}
                            </div>
                          </div>
                        ))}

                        {d.events?.length > 0 && (
                          <>
                            <div className="pmv-detail-head">Billing events ({d.events.length})</div>
                            {d.events.map((e) => (
                              <div key={e.id} className="pmv-plan">
                                <div className="pmv-plan-title">{e.type}</div>
                                <div className="pmv-plan-meta">
                                  {fmtDateTime(e.at)}
                                  {e.amountTotal ? ` · ${(e.amountTotal / 100).toFixed(2)} ${String(e.currency || '').toUpperCase()}` : ''}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProMembersViewer;
