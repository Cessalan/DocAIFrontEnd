import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import NclexShell from './NclexShell';
import {
  buildProfile,
  categoryRows,
  subjectRows,
  formatRows,
  openConcepts,
  learningSignals,
} from './nclexProfile';
import { buildVerdict, nextAction, MIN_FOR_READINESS } from './nclexVerdict';
import { FORMAT_LABELS } from './nclexCurriculum';
import { TargetIcon, CompassIcon, AreaIcon } from './NclexIcons';
import { loadAttempts, loadMeta, saveMeta, daysUntil } from '../../Services/NclexService';
import { loadSavedProduct } from '../../Services/SeoMiniProductService';
import { PLANNER_SUBJECTS } from '../SeoPractice/seoToNclex';
import { devLog, devWarn } from '../../Services/devLogger';
import './Nclex.css';

/** Today's row of a saved landing-page plan, or null. Pure, for the card. */
export const todaysPlanRow = (saved, now = new Date()) => {
  const rows = saved?.plan?.rows;
  if (!Array.isArray(rows) || !rows.length) return null;
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = rows.find((r) => r.date === key);
  // Past the last day → nothing; before the first → the first day.
  if (today) return today;
  if (key < rows[0].date) return rows[0];
  return null;
};

/**
 * NclexHome — the surface a student lands on, and the one she comes back to.
 *
 * It has three faces, and which one renders is decided by EVIDENCE rather
 * than by a stored flag — so there is no "onboarding complete" state to get
 * stuck in, and no way for the page to disagree with her answers:
 *
 *   cold      nothing answered           → the pitch, and one thing to do
 *   building  answered, not yet judgable → the engine, visibly working
 *   warm      enough for a verdict       → the verdict
 *
 * The middle one exists because the page used to skip it. Between her first
 * answer and her twelfth it rendered "not enough answers yet" above eight
 * rows of "Not measured" — every word true, and the whole screen reading as
 * a product that knows nothing about her at exactly the moment she is
 * deciding whether it is worth continuing.
 *
 * ORDER OF THE PAGE IS THE ARGUMENT
 * ─────────────────────────────────
 *   verdict → what to do → the blueprint → subjects → formats → concepts
 *
 * The verdict comes first because it is the only thing here she cannot get
 * from a question bank. The subject grid comes fourth on purpose: leading
 * with a library of subjects makes this look like every competitor, and the
 * differentiator is that she should not have to choose.
 */
const NclexHome = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, isLoading: authLoading } = useAuth() || {};

  const [attempts, setAttempts] = useState(null); // null = still loading
  const [meta, setMeta] = useState(null);
  const [savedPlan, setSavedPlan] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading) return;
      if (!currentUser?.uid) {
        if (!cancelled) setAttempts([]);
        return;
      }
      const [rows, m, plan] = await Promise.all([
        loadAttempts(currentUser.uid),
        loadMeta(currentUser.uid),
        loadSavedProduct('nclex-study-plan').catch((err) => {
          devWarn('[nclex] saved plan unavailable', err);
          return null;
        }),
      ]);
      if (cancelled) return;
      devLog('[nclex] loaded', rows.length, 'attempts');
      setAttempts(rows);
      setMeta(m);
      setSavedPlan(plan);
    })();
    return () => { cancelled = true; };
  }, [currentUser, authLoading]);

  const planRow = useMemo(() => todaysPlanRow(savedPlan), [savedPlan]);

  const profile = useMemo(() => buildProfile(attempts || []), [attempts]);
  const verdict = useMemo(() => buildVerdict(profile), [profile]);
  const action = useMemo(() => nextAction(profile), [profile]);

  const handleSaveExamDate = useCallback(
    async (date) => {
      setMeta((m) => ({ ...(m || {}), examDate: date }));
      if (currentUser?.uid) await saveMeta(currentUser.uid, { examDate: date });
    },
    [currentUser]
  );

  const startPractice = useCallback(
    (params) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      navigate(`/nclex/practice${qs ? `?${qs}` : ''}`);
    },
    [navigate]
  );

  const examDate = meta?.examDate || null;
  const daysLeft = daysUntil(examDate);

  if (attempts === null) {
    return (
      <NclexShell examDate={examDate} daysLeft={daysLeft} onSaveExamDate={handleSaveExamDate}>
        <div className="nq-loading">{t('nclex.loading', 'Reading your progress…')}</div>
      </NclexShell>
    );
  }

  /* Three states, decided by evidence rather than by a flag:
       cold      nothing answered            → the pitch
       building  answered, not yet judgable  → the engine, visibly working
       warm      enough for a verdict        → the verdict */
  const answered = profile.totals.answered;
  const cold = answered === 0;
  const building = answered > 0 && answered < MIN_FOR_READINESS;
  const signals = learningSignals(profile);
  const categories = categoryRows(profile);
  const subjects = subjectRows(profile);
  const formats = formatRows(profile);
  const concepts = openConcepts(profile);

  const verdictLabel = (v) =>
    ({
      solid: t('nclex.v.solid', 'Strong'),
      provisional: t('nclex.v.provisional', 'Looks strong'),
      improving: t('nclex.v.improving', 'Improving'),
      gap: t('nclex.v.gap', 'Needs work'),
      untested: t('nclex.v.untested', 'Not measured'),
    }[v] || v);

  /* Today's task from a plan she built on the landing page. Shown in every
     state — a plan is the one thing that can outrank the verdict, because
     she made it and dated it herself. */
  const planCard = planRow && (
    <div className="nq-plan-card">
      <div className="nq-plan-date" aria-hidden="true">
        <b>{new Date(`${planRow.date}T12:00:00`).getDate()}</b>
        <span>{new Date(`${planRow.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
      </div>
      <div className="nq-plan-body">
        <span className="nq-arrival-label">
          {t('nclex.todayInPlan', "Today in your plan")} · {planRow.phase}
        </span>
        <strong>{planRow.title}</strong>
        <p>{planRow.task}</p>
      </div>
      <button
        type="button"
        className="nq-plan-go"
        onClick={() =>
          startPractice({
            subject: PLANNER_SUBJECTS[planRow.subject] || undefined,
            count: 10,
            from: 'plan',
          })
        }
      >
        {t('nclex.startTodays', "Start today's practice")} →
      </button>
    </div>
  );

  return (
    <NclexShell examDate={examDate} daysLeft={daysLeft} onSaveExamDate={handleSaveExamDate}>
      {cold ? (
        <section className="nq-cold">
          <p className="nq-eyebrow">{t('nclex.kicker', 'NCLEX preparation')}</p>

          <div className="nq-cold-icon" aria-hidden="true">
            <TargetIcon />
          </div>

          <h1 className="nq-cold-title">
            {t('nclex.coldTitleA', 'Find out what to')}{' '}
            <span className="nq-mark">{t('nclex.coldTitleMark', 'focus on first')}</span>.
          </h1>

          <p className="nq-cold-sub">
            {t(
              'nclex.coldSub',
              "Answer questions. We'll find your weak areas and tell you exactly what to study next."
            )}
          </p>

          {planCard}

          <div className="nq-hero-card">
            <span className="nq-tape" aria-hidden="true" />
            <div className="nq-hero-card-kicker">
              <em aria-hidden="true"><CompassIcon /></em>
              <span>{t('nclex.readinessCheck', 'Readiness check')}</span>
            </div>

            <h2>{t('nclex.heroCardTitle', 'Get a personalized starting point.')}</h2>
            <p>
              {t(
                'nclex.heroCardBody',
                'A short check across the whole blueprint, in the formats your exam actually uses.'
              )}
            </p>

            <ul className="nq-checks">
              <li>{t('nclex.check1', '25 questions')}</li>
              <li>{t('nclex.check2', 'Every content area')}</li>
              <li>{t('nclex.check3', 'Personalized results — not a score')}</li>
            </ul>

            <button
              type="button"
              className="nq-cta"
              onClick={() => startPractice({ mode: 'diagnostic', count: 25 })}
            >
              {t('nclex.startCheck', 'Start my check')}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="nq-secondary">
            <p>{t('nclex.alreadyKnow', 'Already know what you need?')}</p>
            <button
              type="button"
              onClick={() =>
                document.getElementById('nq-subjects')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              {t('nclex.door2Cta', 'Practice by subject →')}
            </button>
          </div>
        </section>
      ) : building ? (
        /* ── Building ──────────────────────────────────────────────────
           Between her first answer and her twelfth there is not enough to
           judge her on, and the page used to say so in the flattest way
           available: "not enough answers yet", then eight rows of "Not
           measured". Every word of that was true and the whole screen read
           as a product that knows nothing.

           Same data, told as work in progress. What it reports is not a
           verdict but the evidence being gathered — which is the honest
           description at answer three, and the only one that gives her a
           reason to answer a fourth. */
        <>
          <div className="nq-hero">
          <div className="nq-hero-glow" aria-hidden="true" />
          <span className="nq-hand">{t('nclex.buildingHand', 'the picture is coming together')}</span>
          <section className="nq-verdict">
            <span className="nq-tape" aria-hidden="true" />
            <p className="nq-eyebrow">{t('nclex.whereYouStand', 'Where you stand')}</p>
            <h1 className="nq-verdict-headline">
              {t('nclex.buildingTitle', "We're building your NCLEX profile.")}
            </h1>
            <p className="nq-verdict-detail">
              {t('nclex.buildingBody', {
                defaultValue:
                  "You've answered {{n}} of {{target}}. Keep going — we're looking for patterns in what you know, where you hesitate, and what needs attention.",
                n: answered,
                target: MIN_FOR_READINESS,
              })}
            </p>

            <div className="nq-build-progress">
              <div className="nq-progress">
                <div
                  className="nq-progress-fill"
                  style={{ width: `${Math.min(100, (answered / MIN_FOR_READINESS) * 100)}%` }}
                />
              </div>
              <span className="nq-build-count">
                {t('nclex.ofQuestions', '{{n}} of {{target}} questions', {
                  n: answered,
                  target: MIN_FOR_READINESS,
                })}
              </span>
            </div>
          </section>
          </div>

          {planCard}

          <span className="nq-next-note">{t('nclex.doThisNext', 'do this next →')}</span>
          <button type="button" className="nq-action" onClick={() => startPractice(action)}>
            <span>
              <span className="nq-action-label">
                {t('nclex.continueCheck', 'Continue readiness check')}
              </span>
              <span className="nq-action-sub">{action.sublabel}</span>
            </span>
            <span className="nq-action-arrow" aria-hidden="true">→</span>
          </button>

          {/* Makes the engine visible. Nothing here is invented — each count
              is a real fold over her answers — but a zero reads as "gathering
              data", not as a verdict of nothing. */}
          <section className="nq-section">
            <div className="nq-section-head">
              <h2 className="nq-h2">{t('nclex.measuringTitle', "What we're measuring")}</h2>
            </div>
            <div className="nq-signals">
              {signals.map((sig) => (
                <div className={`nq-signal${sig.has ? ' is-on' : ''}`} key={sig.id}>
                  <span className="nq-signal-dot" aria-hidden="true" />
                  <span className="nq-signal-body">
                    <span className="nq-signal-name">
                      {{
                        knowledge: t('nclex.sig.knowledge', 'Knowledge'),
                        confidence: t('nclex.sig.confidence', 'Confidence'),
                        areas: t('nclex.sig.areas', 'Content areas'),
                        formats: t('nclex.sig.formats', 'Question formats'),
                      }[sig.id]}
                    </span>
                    <span className="nq-signal-state">
                      {sig.has
                        ? t('nclex.sigRecorded', '{{count}} recorded', { count: sig.count })
                        : t('nclex.sigGathering', 'Gathering data')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* The blueprint, as a checklist rather than eight empty bars. */}
          <section className="nq-section">
            <div className="nq-section-head">
              <h2 className="nq-h2">{t('nclex.yourExam', 'Your exam')}</h2>
              <p className="nq-section-note">
                {t('nclex.eightAreas', '8 content areas')}
              </p>
            </div>
            <div className="nq-checklist">
              {categories.map((c) => (
                <div className={`nq-check-row${c.total ? ' is-on' : ''}`} key={c.code}>
                  <span className="nq-signal-dot" aria-hidden="true" />
                  <span className="nq-check-label">{c.label}</span>
                  <span className="nq-check-count">
                    {c.total
                      ? t('nclex.nAnswered', '{{n}} answered', { n: c.total })
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="nq-hero">
          <div className="nq-hero-glow" aria-hidden="true" />
          <span className="nq-hand">{t('nclex.verdictHand', 'here is what your answers say')}</span>
          <section className="nq-verdict">
            <span className="nq-tape" aria-hidden="true" />
            <p className="nq-eyebrow">{t('nclex.whereYouStand', 'Where you stand')}</p>
            <div className="nq-verdict-body">
              <div className="nq-verdict-main">
                <h1 className="nq-verdict-headline">{verdict.headline}</h1>
                <p className="nq-verdict-detail">{verdict.detail}</p>
                <span className="nq-verdict-evidence">{verdict.evidence}</span>
              </div>

              {verdict.showReadiness && (
                <div className="nq-readiness">
                  <div
                    className="nq-ring"
                    style={{ '--score': `${Math.round(verdict.readiness.value * 360)}deg` }}
                    role="img"
                    aria-label={`${Math.round(verdict.readiness.value * 100)}% ${t('nclex.estReadiness', 'Estimated readiness')}`}
                  >
                    <div>
                      <strong>{Math.round(verdict.readiness.value * 100)}%</strong>
                      <span>{t('nclex.estReadiness', 'Estimated readiness')}</span>
                    </div>
                  </div>
                  <span className={`nq-readiness-band is-${verdict.band.key}`}>
                    {verdict.band.label}
                  </span>
                </div>
              )}
            </div>
          </section>
          </div>

          {planCard}

          <span className="nq-next-note">{t('nclex.doThisNext', 'do this next →')}</span>
          <button type="button" className="nq-action" onClick={() => startPractice(action)}>
            <span>
              <span className="nq-action-label">{action.label}</span>
              <span className="nq-action-sub">{action.sublabel}</span>
            </span>
            <span className="nq-action-arrow" aria-hidden="true">→</span>
          </button>
        </>
      )}

      {/* ── Blueprint ───────────────────────────────────────────────────
          Hidden on a cold start. Eight rows reading "Not measured" is the
          product announcing eight times that it knows nothing about her,
          and it was the single deadest thing on the old first screen. */}
      {!cold && !building && (
        <section className="nq-section">
          <div className="nq-section-head">
            <div>
              <span className="nq-hand">{t('nclex.blueprintHand', 'the ledger')}</span>
              <h2 className="nq-h2">{t('nclex.blueprintTitle', 'Your exam, by content area')}</h2>
            </div>
            <p className="nq-section-note">
              {t(
                'nclex.blueprintNote',
                'Percentages are the share of the real NCLEX each area carries.'
              )}
            </p>
          </div>

          <div className="nq-blueprint">
            {categories.map((c) => (
              <div className="nq-bp-row" key={c.code}>
                <div className="nq-bp-name">
                  <span className="nq-bp-label">{c.label}</span>
                  <span className="nq-bp-weight">
                    {c.min}–{c.max}% {t('nclex.ofExam', 'of the exam')}
                  </span>
                </div>
                <div className={`nq-bp-track${c.total ? '' : ' is-empty'}`}>
                  {c.total > 0 && (
                    <div
                      className={`nq-bp-fill is-${c.verdict}`}
                      style={{ width: `${Math.max(4, c.accuracy * 100)}%` }}
                    />
                  )}
                </div>
                {c.verdict === 'untested' ? (
                  <span className="nq-bp-untested">
                    {c.total ? `${c.correct}/${c.total}` : t('nclex.notMeasured', 'Not measured')}
                  </span>
                ) : (
                  <span className={`nq-bp-verdict is-${c.verdict}`}>
                    {Math.round(c.accuracy * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Formats ───────────────────────────────────────────────────── */}
      {!cold && !building && (
        <section className="nq-section">
          <div className="nq-section-head">
            <h2 className="nq-h2">{t('nclex.formatsTitle', 'By question format')}</h2>
            <p className="nq-section-note">
              {t('nclex.formatsNote', 'The gap between these is usually bigger than the gap between subjects.')}
            </p>
          </div>
          <div className="nq-formats">
            {formats.map((f) => (
              <div className="nq-format" key={f.key}>
                <span className="nq-format-name">{FORMAT_LABELS[f.key]}</span>
                {f.total >= 5 ? (
                  <>
                    <span className="nq-format-num">{Math.round(f.accuracy * 100)}%</span>
                    <span className="nq-format-meta">
                      {f.correct}/{f.total} {t('nclex.correct', 'correct')}
                      {f.partial > 0 && ` · ${f.partial} ${t('nclex.partial', 'partial')}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="nq-format-num is-thin">
                      {t('nclex.notEnoughYet', 'Not enough yet')}
                    </span>
                    <span className="nq-format-meta">
                      {f.total} {t('nclex.answered', 'answered')} · {t('nclex.needFive', 'need 5')}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Subjects ──────────────────────────────────────────────────── */}
      <section className="nq-section" id="nq-subjects">
        <div className="nq-section-head">
          <div>
            <span className="nq-hand">{t('nclex.subjectsHand', 'the card box')}</span>
            <h2 className="nq-h2">{t('nclex.subjectsTitle', 'Practice by subject')}</h2>
          </div>
        </div>
        <div className="nq-subjects">
          {subjects.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`nq-subject is-${s.verdict}`}
              onClick={() => navigate(`/nclex/subject/${s.id}`)}
            >
              <div className="nq-subject-head">
                <span className="nq-subject-icon" aria-hidden="true">
                  <AreaIcon area={s.areas[0]} />
                </span>
                <h3>{s.label}</h3>
              </div>
              <p>{s.blurb}</p>
              <div className="nq-subject-foot">
                <span className={`nq-pill is-${s.verdict}`}>{verdictLabel(s.verdict)}</span>
                <span className="nq-subject-count">
                  {s.total
                    ? `${s.correct}/${s.total}`
                    : `${s.areas.length} ${t('nclex.areas', 'areas')}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Open concepts ─────────────────────────────────────────────── */}
      {concepts.length > 0 && (
        <section className="nq-section">
          <div className="nq-section-head">
            <div>
              <span className="nq-hand">{t('nclex.conceptsHand', 'pinned above the desk')}</span>
              <h2 className="nq-h2">{t('nclex.conceptsTitle', 'Still getting these wrong')}</h2>
            </div>
            <p className="nq-section-note">
              {t('nclex.conceptsNote', 'Named from your own missed questions.')}
            </p>
          </div>
          <div className="nq-concepts">
            {concepts.map((c, i) => (
              <div className="nq-concept" key={c.concept}>
                <span className="nq-concept-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="nq-concept-label">{c.concept}</span>
                <span className="nq-concept-score">
                  {c.correct}/{c.total} {t('nclex.correct', 'correct')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </NclexShell>
  );
};

export default NclexHome;
