import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import NclexShell from './NclexShell';
import { buildProfile, areaRows, subjectRows } from './nclexProfile';
import { findSubject, findCategory } from './nclexCurriculum';
import { AreaIcon } from './NclexIcons';
import { estimatedMinutes } from './nclexSpec';
import { loadAttempts, loadMeta, saveMeta, daysUntil } from '../../Services/NclexService';
import './Nclex.css';

/**
 * NclexSubject — one subject, broken into the areas inside it.
 *
 * The plan this implements called for "meaningful structure rather than
 * immediately starting a generic quiz", and the reason is concrete: a
 * student who knows she is bad at insulin should not have to sit through
 * cardiac questions to reach it. Every area is independently startable.
 *
 * Areas she has never met read "Not measured", never a zero. A 0% on
 * something never asked is the same authoritative-sounding lie as a "needs
 * practice" derived from one miss, and this product's only asset is that its
 * numbers can be trusted.
 *
 * The header also names which client-needs categories this subject scores
 * into, and what share of the exam they carry. That mapping is the honest
 * answer to "why should I care about this subject" and it is the one thing a
 * generic question bank's subject page cannot tell her.
 */
/** Questions in a subject-level session. */
const SUBJECT_SESSION = 10;

const NclexSubject = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, isLoading: authLoading } = useAuth() || {};

  const [attempts, setAttempts] = useState(null);
  const [meta, setMeta] = useState(null);

  const subject = findSubject(subjectId);

  /* The blueprint line under the title. Ranges are SUMMED across the
     categories the subject scores into — Adult Health touching both
     Physiological Adaptation (11–17%) and Reduction of Risk (9–15%) really
     does put 20–32% of her exam behind this one page, and that total is the
     reason to open it. */
  const cats = (subject?.needs || []).map(findCategory).filter(Boolean);
  const needLabels = cats.map((c) => c.label).join(` ${t('nclex.and', 'and')} `);
  const shareMin = cats.reduce((n, c) => n + c.min, 0);
  const shareMax = cats.reduce((n, c) => n + c.max, 0);
  const minutes = estimatedMinutes(SUBJECT_SESSION);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading) return;
      if (!currentUser?.uid) {
        if (!cancelled) setAttempts([]);
        return;
      }
      const [rows, m] = await Promise.all([
        loadAttempts(currentUser.uid),
        loadMeta(currentUser.uid),
      ]);
      if (cancelled) return;
      setAttempts(rows);
      setMeta(m);
    })();
    return () => { cancelled = true; };
  }, [currentUser, authLoading]);

  const profile = useMemo(() => buildProfile(attempts || []), [attempts]);
  const areas = useMemo(() => areaRows(profile, subjectId), [profile, subjectId]);
  const summary = useMemo(
    () => subjectRows(profile).find((s) => s.id === subjectId) || null,
    [profile, subjectId]
  );

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
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      navigate(`/nclex/practice?${qs}`);
    },
    [navigate]
  );

  const examDate = meta?.examDate || null;
  const daysLeft = daysUntil(examDate);

  const shellProps = { examDate, daysLeft, onSaveExamDate: handleSaveExamDate };

  if (!subject) {
    return (
      <NclexShell {...shellProps}>
        <button type="button" className="nq-back" onClick={() => navigate('/nclex')}>
          ← {t('nclex.back', 'All subjects')}
        </button>
        <div className="nq-empty">
          {t('nclex.unknownSubject', 'That subject does not exist.')}
        </div>
      </NclexShell>
    );
  }

  if (attempts === null) {
    return (
      <NclexShell {...shellProps}>
        <div className="nq-loading">{t('nclex.loading', 'Reading your progress…')}</div>
      </NclexShell>
    );
  }

  const verdictLabel = (v) =>
    ({
      solid: t('nclex.v.solid', 'Strong'),
      provisional: t('nclex.v.provisional', 'Looks strong'),
      improving: t('nclex.v.improving', 'Improving'),
      gap: t('nclex.v.gap', 'Needs work'),
      untested: t('nclex.v.untested', 'Not measured'),
    }[v] || v);

  return (
    <NclexShell {...shellProps}>
      <button type="button" className="nq-back" onClick={() => navigate('/nclex')}>
        ← {t('nclex.backPrep', 'NCLEX Prep')}
      </button>

      <div className="nq-subject-page">
        <header className="nq-subject-hero">
          <h1 className="nq-subject-title">{subject.label}</h1>
          <p className="nq-subject-blurb">{subject.blurb}</p>

          {/* One honest sentence rather than three competing pills — and it is
              the thing a generic question bank's subject page cannot say. */}
          <p className="nq-subject-share">
            {t('nclex.scoresInto', 'Scores into')}{' '}
            <b>{needLabels}</b> —{' '}
            {t('nclex.aboutShare', 'about {{min}}–{{max}}% of your exam.', {
              min: shareMin,
              max: shareMax,
            })}
          </p>

          {/* Only shown once it means something. On an untested subject a
              "Not measured" badge is the page repeating what the empty area
              tiles already say. */}
          {summary && summary.total > 0 && (
            <span className={`nq-pill is-${summary.verdict} nq-subject-standing`}>
              {verdictLabel(summary.verdict)} · {summary.correct}/{summary.total}
            </span>
          )}
        </header>

        <div className="nq-start-card">
          <h2>{t('nclex.whereStart', 'Where should I start?')}</h2>
          <p>
            {t(
              'nclex.whereStartBody',
              "Answer a few questions and we'll identify what to focus on."
            )}
          </p>
          <div className="nq-start-meta">
            {t('nclex.nQuestions', '{{n}} questions', { n: SUBJECT_SESSION })} ·{' '}
            {t('nclex.aboutMin', 'about {{n}} min', { n: minutes })}
          </div>
          <button
            type="button"
            className="nq-cta"
            onClick={() => startPractice({ subject: subject.id, count: SUBJECT_SESSION })}
          >
            {t('nclex.findStart', 'Find my starting point')}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <section className="nq-section" style={{ marginTop: 0 }}>
        <div className="nq-or">
          <span>{t('nclex.orChooseArea', 'Or choose an area')}</span>
        </div>

        <div className="nq-area-grid">
          {areas.map((a) => (
            <button
              type="button"
              className="nq-area-tile"
              key={a.area}
              onClick={() => startPractice({ subject: subject.id, area: a.area, count: 8 })}
            >
              <span className="nq-area-icon" aria-hidden="true">
                <AreaIcon area={a.area} />
              </span>
              <span className="nq-area-body">
                <span className="nq-area-title">{a.area}</span>
                {a.total > 0 && (
                  <span className={`nq-area-status is-${a.verdict}`}>
                    {a.verdict === 'untested'
                      ? `${a.correct}/${a.total} · ${t('nclex.needMore', 'need more')}`
                      : `${Math.round(a.accuracy * 100)}% · ${verdictLabel(a.verdict)}`}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </section>
    </NclexShell>
  );
};

export default NclexSubject;
