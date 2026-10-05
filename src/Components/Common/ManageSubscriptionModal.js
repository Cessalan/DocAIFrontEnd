import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openBillingPortal } from '../../config/billing';
import { recordSignal, SURFACE } from '../../Services/SatisfactionService';
import {
  CANCEL_REASONS,
  EXAM_OUTCOMES,
  asksOutcome,
  buildCancelSignal,
  reasonFor
} from './cancelSurveyModel';
import './ManageSubscriptionModal.css';

/**
 * ManageSubscriptionModal — the step between "Manage subscription" and Stripe.
 *
 * WHY THIS EXISTS
 *
 * "Manage subscription" used to jump straight to Stripe's portal, so the only
 * thing we learned from a cancellation was Stripe's generic reason list. The
 * first churned subscriber picked "other" there and wrote nothing. This screen
 * asks three questions in the product's own vocabulary, and only of people who
 * have said they are cancelling: someone updating a card goes straight through.
 *
 * DESIGN NOTES
 *
 *  - Never a wall. "Skip" is on screen from the start and goes to the same
 *    portal. Making cancelling harder costs trust and buys nothing.
 *
 *  - The row is written on the first reason tap and refined after that, the
 *    same rule as every other satisfaction surface: a student who answers one
 *    question and then closes the tab still leaves a usable row. The create is
 *    held as a PROMISE in a ref, so a fast second tap refines the row the first
 *    tap is still creating instead of inserting a duplicate.
 *
 *  - The final write is awaited before redirecting (capped), because leaving
 *    the page drops an in-flight Firestore write.
 *
 * Rendered once by UsageProvider; opened via `openManageSubscription()`.
 */

const STEP = { CHOOSE: 'choose', SURVEY: 'survey' };
const FINAL_WRITE_CAP_MS = 1500;

const ManageSubscriptionModal = ({ isOpen, onClose, examDate = null, proSince = null }) => {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(STEP.CHOOSE);
  const [reasonId, setReasonId] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [detail, setDetail] = useState('');
  const [stayNote, setStayNote] = useState('');
  const [leaving, setLeaving] = useState(false);
  const createRef = useRef(null);   // Promise<signalId | null> once the row exists

  // Stays mounted between openings: start every visit clean.
  useEffect(() => {
    if (!isOpen) return;
    setStep(STEP.CHOOSE);
    setReasonId(null); setOutcome(null); setDetail(''); setStayNote('');
    setLeaving(false);
    createRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !leaving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, leaving, onClose]);

  if (!isOpen) return null;

  const persist = (answers) => {
    const row = buildCancelSignal({ examDate, proSince, locale: i18n.language, ...answers });
    if (!row.reasons.length) return Promise.resolve();
    // Dev and prod share one Firebase project; the rollup drops these.
    if (process.env.NODE_ENV === 'development') row.context.devPreview = true;
    if (!createRef.current) {
      createRef.current = recordSignal({ surface: SURFACE.CANCELLATION, ...row })
        .then((r) => (r?.success ? r.signalId : null));
      return createRef.current;
    }
    return createRef.current.then((signalId) =>
      signalId ? recordSignal({ surface: SURFACE.CANCELLATION, signalId, ...row }) : null
    );
  };

  const current = { reasonId, outcome, detail, stayNote };

  const pickReason = (id) => {
    setReasonId(id);
    persist({ ...current, reasonId: id });
  };

  const pickOutcome = (value) => {
    setOutcome(value);
    persist({ ...current, outcome: value });
  };

  const goToPortal = async ({ withAnswers }) => {
    setLeaving(true);
    if (withAnswers && reasonId) {
      const write = persist({ ...current, continuedToPortal: true });
      await Promise.race([write, new Promise((r) => setTimeout(r, FINAL_WRITE_CAP_MS))]);
    }
    const redirected = await openBillingPortal();
    if (!redirected) setLeaving(false);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !leaving) onClose();
  };

  const selected = reasonFor(reasonId);

  return (
    <div className="msub-overlay" onClick={handleOverlayClick}>
      <div
        className="msub-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="msub-title"
      >
        <div className="msub-top">
          {step === STEP.SURVEY ? (
            <button
              type="button"
              className="msub-icon-btn"
              onClick={() => setStep(STEP.CHOOSE)}
              aria-label={t('cancelSurvey.back', 'Back')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : <span />}
          <button
            type="button"
            className="msub-icon-btn"
            onClick={onClose}
            disabled={leaving}
            aria-label={t('account.close', 'Close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === STEP.CHOOSE ? (
          <>
            <h2 id="msub-title" className="msub-title">
              {t('cancelSurvey.chooseTitle', 'Manage your subscription')}
            </h2>
            <ul className="msub-choices">
              <li>
                <button
                  type="button"
                  className="msub-choice"
                  onClick={() => goToPortal({ withAnswers: false })}
                  disabled={leaving}
                >
                  <span className="msub-choice-text">
                    <span className="msub-choice-name">
                      {leaving
                        ? t('account.portalOpening', 'Opening…')
                        : t('cancelSurvey.billing', 'Update card or switch plan')}
                    </span>
                    <span className="msub-choice-sub">
                      {t('cancelSurvey.billingSub', "Opens Stripe's secure billing page")}
                    </span>
                  </span>
                  <span className="msub-chevron" aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="msub-choice"
                  onClick={() => setStep(STEP.SURVEY)}
                  disabled={leaving}
                >
                  <span className="msub-choice-text">
                    <span className="msub-choice-name">
                      {t('cancelSurvey.cancel', 'Cancel my subscription')}
                    </span>
                    <span className="msub-choice-sub">
                      {t('cancelSurvey.cancelSub', 'You keep Pro until the end of the period you paid for')}
                    </span>
                  </span>
                  <span className="msub-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            </ul>
          </>
        ) : (
          <>
            <h2 id="msub-title" className="msub-title">
              {t('cancelSurvey.title', 'Before you go')}
            </h2>
            <p className="msub-lede">
              {t('cancelSurvey.lede', 'Three quick questions. Every answer is read by the people building NurseQuiz, and it decides what we fix next.')}
            </p>

            <fieldset className="msub-q">
              <legend className="msub-q-label">
                {t('cancelSurvey.q1', "What's the main reason you're cancelling?")}
              </legend>
              <ul className="msub-reasons" role="radiogroup">
                {CANCEL_REASONS.map((r) => {
                  const on = reasonId === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`msub-reason ${on ? 'is-on' : ''}`}
                        onClick={() => pickReason(r.id)}
                      >
                        <span className="msub-radio" aria-hidden="true" />
                        {t(`cancelSurvey.reasons.${r.id}`)}
                      </button>
                      {on && r.needsDetail && (
                        <input
                          className="msub-input"
                          type="text"
                          maxLength={500}
                          autoFocus
                          value={detail}
                          onChange={(e) => setDetail(e.target.value)}
                          onBlur={() => persist(current)}
                          placeholder={t(`cancelSurvey.detail.${r.id}`)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            {asksOutcome(reasonId) && (
              <fieldset className="msub-q msub-reveal">
                <legend className="msub-q-label">
                  {t('cancelSurvey.q2', 'How did it go?')}
                </legend>
                <div className="msub-segments" role="radiogroup">
                  {EXAM_OUTCOMES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={outcome === value}
                      className={`msub-segment ${outcome === value ? 'is-on' : ''}`}
                      onClick={() => pickOutcome(value)}
                    >
                      {t(`cancelSurvey.outcomes.${value}`)}
                    </button>
                  ))}
                </div>
                {outcome === 'passed' && (
                  <p className="msub-congrats">
                    {t('cancelSurvey.congrats', 'Congratulations. That is exactly what we were here for.')}
                  </p>
                )}
              </fieldset>
            )}

            {selected && (
              <div className="msub-q msub-reveal">
                <label className="msub-q-label" htmlFor="msub-stay">
                  {t('cancelSurvey.q3', 'What one thing would have made you stay, or bring you back?')}
                  <span className="msub-optional">{t('cancelSurvey.optional', 'Optional')}</span>
                </label>
                <textarea
                  id="msub-stay"
                  className="msub-textarea"
                  rows={3}
                  maxLength={1000}
                  value={stayNote}
                  onChange={(e) => setStayNote(e.target.value)}
                  onBlur={() => persist(current)}
                  placeholder={t('cancelSurvey.q3Placeholder', 'e.g. NCLEX practice after my course ends')}
                />
              </div>
            )}

            <div className="msub-footer">
              <button
                type="button"
                className="msub-cta"
                onClick={() => goToPortal({ withAnswers: true })}
                disabled={!reasonId || leaving}
              >
                {leaving
                  ? t('account.portalOpening', 'Opening…')
                  : t('cancelSurvey.continue', 'Continue to cancel')}
              </button>
              <button
                type="button"
                className="msub-skip"
                onClick={() => goToPortal({ withAnswers: true })}
                disabled={leaving}
              >
                {t('cancelSurvey.skip', 'Skip and go to Stripe')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ManageSubscriptionModal;
