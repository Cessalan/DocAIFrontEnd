import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import NclexShell from './NclexShell';
import { findSubject } from './nclexCurriculum';
import { estimatedMinutes } from './nclexSpec';
import { AreaIcon, CompassIcon } from './NclexIcons';
import { loadMeta, saveMeta, daysUntil } from '../../Services/NclexService';
import {
  readIntent,
  commitIntent,
  sessionParamsFor,
  INTENT_TTL_MS,
} from '../../Services/NclexHandoffService';
import { trackSeo } from '../../Services/SeoMiniProductService';
import { devLog } from '../../Services/devLogger';
import './Nclex.css';

/**
 * NclexArrival — the first screen after a landing page.
 *
 * WHY A SCREEN AND NOT A REDIRECT
 * ───────────────────────────────
 * She just answered four questions, was shown what she missed, and signed
 * up on the strength of that. Dropping her on the generic home page — or
 * worse, the chat — says the product forgot. This screen says it back to
 * her in the app's own voice, tells her the answers are already counted,
 * and proposes exactly one thing: the session built from what she missed.
 *
 * WHERE THE DATA COMES FROM
 * ─────────────────────────
 * Browser storage first (`readIntent`), because that is what survives the
 * signup redirect on the same device. If it is missing — a new device, or
 * storage cleared — the context persisted to `nclexMeta/profile.seoContext`
 * is tried. Nothing at all → straight to /nclex, never an empty greeting.
 *
 * `commitIntent` runs here as well as in the post-signup hook. It is
 * idempotent, and running it from the screen she can SEE means a student
 * whose signup hook failed still gets her answers seeded.
 */
const SESSION_COUNT = 10;

const NclexArrival = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { currentUser, isLoading: authLoading } = useAuth() || {};

  const [intent, setIntent] = useState(undefined); // undefined = resolving
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading) return;
      const uid = currentUser?.uid || null;

      let local = readIntent();
      if (uid && local) local = (await commitIntent(uid)) || local;

      const m = uid ? await loadMeta(uid) : null;
      if (cancelled) return;
      setMeta(m);

      let resolved = local;
      if (!resolved && m?.seoContext?.at && Date.now() - m.seoContext.at < INTENT_TTL_MS) {
        resolved = { ...m.seoContext, attempts: [] };
      }

      if (!resolved) {
        devLog('[nclex] arrival with no intent → home');
        navigate('/nclex', { replace: true });
        return;
      }

      trackSeo('seo_nclex_arrived', null, {
        sourcePage: resolved.sourcePage,
        from: params.get('from') || null,
        kind: resolved.kind,
      });
      setIntent(resolved);
    })();
    return () => { cancelled = true; };
  }, [authLoading, currentUser, navigate, params]);

  const handleSaveExamDate = useCallback(
    async (date) => {
      setMeta((m) => ({ ...(m || {}), examDate: date }));
      if (currentUser?.uid) await saveMeta(currentUser.uid, { examDate: date });
    },
    [currentUser]
  );

  const examDate = meta?.examDate || intent?.plan?.examDate || null;
  const daysLeft = daysUntil(examDate);
  const shellProps = { examDate, daysLeft, onSaveExamDate: handleSaveExamDate };

  const subject = useMemo(() => findSubject(intent?.subject), [intent]);
  const minutes = estimatedMinutes(SESSION_COUNT);

  const start = () => {
    trackSeo('seo_nclex_session_started', null, {
      sourcePage: intent?.sourcePage,
      subject: intent?.subject || null,
      area: intent?.area || null,
    });
    navigate(`/nclex/practice?${sessionParamsFor(intent, SESSION_COUNT)}`);
  };

  if (intent === undefined) {
    return (
      <NclexShell {...shellProps}>
        <div className="nq-loading">{t('nclex.arrivalLoading', 'Bringing your results over…')}</div>
      </NclexShell>
    );
  }

  const isPlan = intent.kind === 'planner';
  const score = intent.score;
  const pct = score ? score.percentage : null;
  const subjectLabel = subject?.label || t('nclex.theBlueprint', 'the blueprint');
  const focusLabel = intent.area || subjectLabel;

  return (
    <NclexShell {...shellProps}>
      <section className="nq-arrival">
        <div className="nq-hero-glow" aria-hidden="true" />
        <span className="nq-hand">
          {t('nclex.arrivalHand', 'picking up right where you left off')}
        </span>

        <div className="nq-paper nq-arrival-card">
          <span className="nq-tape" aria-hidden="true" />

          {isPlan ? (
            <>
              <p className="nq-eyebrow">{t('nclex.planSaved', 'Your plan is saved')}</p>
              <h1 className="nq-arrival-title">
                {intent.plan?.days
                  ? t('nclex.planTitle', {
                      defaultValue: 'Your {{days}}-day NCLEX-{{track}} plan lives here now.',
                      days: intent.plan.days,
                      track: intent.examTrack || 'RN',
                    })
                  : t('nclex.planTitleShort', 'Your NCLEX plan lives here now.')}
              </h1>
              <p className="nq-arrival-lede">
                {t(
                  'nclex.planLede',
                  'Every question you answer from here is scored against the real exam blueprint, so the plan learns which days to spend where.'
                )}
              </p>

              <div className="nq-arrival-facts">
                {typeof daysLeft === 'number' && (
                  <div>
                    <strong>{daysLeft}</strong>
                    <span>{t('nclex.daysToExamShort', 'days to your exam')}</span>
                  </div>
                )}
                {intent.plan?.minutes && (
                  <div>
                    <strong>{intent.plan.minutes}</strong>
                    <span>{t('nclex.minutesADay', 'minutes a day')}</span>
                  </div>
                )}
                {intent.plan?.priorities?.length > 0 && (
                  <div>
                    <strong>{intent.plan.priorities.length}</strong>
                    <span>{t('nclex.prioritySubjects', 'priority subjects')}</span>
                  </div>
                )}
              </div>

              {intent.plan?.priorities?.length > 0 && (
                <div className="nq-arrival-tags">
                  {intent.plan.priorities.map((p, i) => (
                    <span key={p}>
                      <b>{String(i + 1).padStart(2, '0')}</b>
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="nq-eyebrow">{t('nclex.fromYourPractice', 'From your practice')}</p>
              <div className="nq-arrival-top">
                {pct !== null && (
                  <div className="nq-ring" style={{ '--score': `${pct * 3.6}deg` }}>
                    <div>
                      <strong>{pct}%</strong>
                      <span>
                        {score.correct}/{score.total}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <h1 className="nq-arrival-title">
                    {score
                      ? t('nclex.arrivalScoreTitle', {
                          defaultValue: 'You got {{correct}} of {{total}} on {{subject}}.',
                          correct: score.correct,
                          total: score.total,
                          subject: subjectLabel.toLowerCase(),
                        })
                      : t('nclex.arrivalTitleNoScore', 'Welcome to your NCLEX workspace.')}
                  </h1>
                  <p className="nq-arrival-lede">
                    {score
                      ? t(
                          'nclex.arrivalLede',
                          'Those answers are already in your profile — nothing to redo. Here is what to do with them.'
                        )
                      : t(
                          'nclex.arrivalLedeNoScore',
                          'Everything you answer here is scored against the real exam blueprint.'
                        )}
                  </p>
                </div>
              </div>

              {intent.missedConcepts?.length > 0 ? (
                <div className="nq-arrival-missed">
                  <span className="nq-arrival-label">
                    {t('nclex.startWithMissed', 'Start with what changed your answer')}
                  </span>
                  <div className="nq-arrival-tags">
                    {intent.missedConcepts.map((c, i) => (
                      <span key={c}>
                        <b>{String(i + 1).padStart(2, '0')}</b>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                score && (
                  <p className="nq-arrival-clean">
                    {t(
                      'nclex.arrivalClean',
                      'Nothing missed in that set — so the first session widens out instead of repeating what you know.'
                    )}
                  </p>
                )
              )}
            </>
          )}

          {/* ── The one thing to do ─────────────────────────────────── */}
          <div className="nq-arrival-session">
            <span className="nq-arrival-session-icon" aria-hidden="true">
              {intent.area ? <AreaIcon area={intent.area} /> : <CompassIcon />}
            </span>
            <div className="nq-arrival-session-body">
              <span className="nq-arrival-label">
                {isPlan
                  ? t('nclex.todaysSession', "Today's session")
                  : t('nclex.yourFirstSession', 'Your first session')}
              </span>
              <strong>
                {subject ? subject.label : t('nclex.mixedBlueprint', 'Across the blueprint')}
                {intent.area ? ` · ${intent.area}` : ''}
              </strong>
              <span className="nq-arrival-session-meta">
                {t('nclex.nQuestions', '{{n}} questions', { n: SESSION_COUNT })} ·{' '}
                {t('nclex.aboutMin', 'about {{n}} min', { n: minutes })}
                {intent.missedConcepts?.length > 0 &&
                  ` · ${t('nclex.writtenAround', 'written around what you missed')}`}
              </span>
            </div>
          </div>

          <button type="button" className="nq-cta" onClick={start}>
            {isPlan
              ? t('nclex.startToday', "Start today's practice")
              : t('nclex.startFocused', 'Start my {{focus}} session', { focus: focusLabel.toLowerCase() })}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="nq-secondary">
          <p>{t('nclex.orFirst', 'or, first')}</p>
          <button type="button" onClick={() => navigate('/nclex')}>
            {t('nclex.seeReadiness', 'See my full readiness picture →')}
          </button>
        </div>
      </section>
    </NclexShell>
  );
};

export default NclexArrival;
