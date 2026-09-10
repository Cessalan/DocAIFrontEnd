import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
/* The app's real mark. `/NQWarmLogo.png` — which five SEO landing pages point
   at — does not exist in public/, so it renders as a broken image on every one
   of them. Use the same SVG the app shell uses instead. */
import { ReactComponent as HeartLogo } from '../../assets/favicon.svg';
import DatePicker from '../Common/DatePicker';
import './Nclex.css';

/**
 * NclexShell — the chrome for every NCLEX screen.
 *
 * Deliberately NOT ChatLayout. There is no sidebar, no conversation list and
 * no composer, because none of them have anything to offer a student who has
 * graduated and has no documents to talk about. Four of the ten people who
 * have paid for this product have never typed a single message into chat;
 * putting a chat rail beside a readiness dashboard would be furniture.
 *
 * The one thing the bar carries besides identity is the exam countdown. It
 * earns that slot: every recommendation this product makes is a function of
 * how many days are left, and only ~4% of the current user base has a date on
 * file at all. Asking here, once, in a place she passes on every screen, is
 * the cheapest way to fix that — and the ask is a quiet dashed button rather
 * than a modal, because a student who is not ready to answer should be able
 * to keep using the product.
 *
 * The calendar is the app's shared Common/DatePicker, not <input type="date">.
 * A native date input renders in the BROWSER's locale rather than the app's,
 * so an English user on a French-locale machine was being shown jj/mm/aaaa.
 */
const NclexShell = ({ examDate, daysLeft, onSaveExamDate, children }) => {
  const { t, i18n } = useTranslation();
  const [picking, setPicking] = useState(false);
  const anchorRef = useRef(null);

  const urgent = typeof daysLeft === 'number' && daysLeft <= 14;

  /* An exam date in the past is not a date she meant to give us, and every
     countdown downstream reads better for never having to render a negative. */
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const choose = (iso) => {
    onSaveExamDate?.(iso);
    setPicking(false);
  };

  return (
    <div className="nq">
      <header className="nq-topbar">
        <Link to="/nclex" className="nq-brand">
          <HeartLogo className="nq-brand-logo" aria-hidden="true" />
          NurseQuizAI
          <span>{t('nclex.brandTag', 'NCLEX')}</span>
        </Link>

        <div className="nq-topbar-right">
          {typeof daysLeft === 'number' ? (
            <button
              ref={anchorRef}
              type="button"
              className={`nq-countdown${urgent ? ' is-urgent' : ''}`}
              onClick={() => setPicking((v) => !v)}
              title={t('nclex.changeDate', 'Change your exam date')}
            >
              <b>{daysLeft}</b>
              {daysLeft === 1
                ? t('nclex.dayToExam', 'day to your exam')
                : t('nclex.daysToExam', 'days to your exam')}
            </button>
          ) : (
            <button
              ref={anchorRef}
              type="button"
              className="nq-datelink"
              onClick={() => setPicking((v) => !v)}
            >
              {t('nclex.addDate', '+ Add your exam date')}
            </button>
          )}

          {picking && (
            <DatePicker
              value={examDate || ''}
              onChange={choose}
              onClose={() => setPicking(false)}
              minDate={today}
              anchorRef={anchorRef}
              language={i18n.language}
            />
          )}
        </div>
      </header>

      <div className="nq-wrap">{children}</div>
    </div>
  );
};

export default NclexShell;
