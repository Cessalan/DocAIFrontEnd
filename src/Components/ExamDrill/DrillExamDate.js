import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EXAM_DATE_CHOICES } from '../../Services/examDateChoices';
import DatePicker from '../Common/DatePicker';
import { CalendarIcon } from '../ChatInerface/PlanOnboardingIcons';
// Imported here, not only by the drill page: this now also renders inside the
// chat during a drill upload, where ExamDrill.css would otherwise never load.
import './ExamDrill.css';

/**
 * DrillExamDate — the one question the drill asks before it starts examining.
 *
 * WHY THE DRILL ASKS AT ALL
 * ─────────────────────────
 * The resume card counts down to the exam, and that countdown is the strongest
 * reason a student opens the app again tomorrow. It reads
 * `chat.examDate || userProfile.onboarding.examDate` — both only ever written
 * by plan onboarding. A student who took the "Drill me on my notes" door
 * skipped plan onboarding entirely, so she had no date, so the copy most
 * likely to bring her back never rendered for the users who picked the
 * fastest way in.
 *
 * SAME QUESTION, SAME CONTROLS AS PLAN ONBOARDING Q1
 * ──────────────────────────────────────────────────
 * The quick choices come from Services/examDateChoices (shared, so the two
 * surfaces cannot drift into different countdowns) and the calendar is
 * DatePicker — the shared popover (Common/DatePicker), same one the study
 * plan uses. Two pickers for one
 * question is two things to keep in sync and two things a student has to learn
 * twice; the only difference here is the surrounding chrome, which is the
 * drill's plain exam-room styling rather than the onboarding card's.
 *
 * WHY IT IS ONE SCREEN WITH A VISIBLE SKIP
 * ────────────────────────────────────────
 * The drill's promise is "no plan, no onboarding card, straight into being
 * examined" (see the second-door comment in ChatInterface). This screen earns
 * its place by being answerable in one tap, never appearing twice, and being
 * skippable without an argument. It is shown only when we genuinely do not
 * know the date — never to confirm one we already have.
 */
const DrillExamDate = ({ onSubmit, onSkip, language = 'en' }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const dateAnchorRef = useRef(null);

  // Same friendly label as the onboarding chip, so a picked date reads as
  // "Oct 14, 2026" rather than as the raw value we store.
  const customDateLabel = useMemo(() => {
    if (!customDate) return null;
    const d = new Date(`${customDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const locale = (language || 'en').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [customDate, language]);

  const choose = (key, value) => {
    if (busy) return;
    setBusy(true);
    onSubmit(key, value);
  };

  const handleCustomDate = (value) => {
    setCustomDate(value);
    setShowPicker(false);
    choose('custom', value);
  };

  return (
    <div className="drill-shell drill-shell--centered drill-date">
      <p className="drill-date__eyebrow">
        {t('drill.dateEyebrow', 'Before we start')}
      </p>

      <h2 className="drill-date__question">
        {t('drill.dateQuestion', 'When is your exam?')}
      </h2>

      <p className="drill-date__why">
        {t('drill.dateWhy', 'It sets the pace, and it is the countdown you will see each time you come back.')}
      </p>

      <div
        className="drill-date__chips"
        role="group"
        aria-label={t('drill.dateQuestion', 'When is your exam?')}
      >
        {EXAM_DATE_CHOICES.map((choice) => (
          <button
            key={choice.key}
            type="button"
            className="drill-date__chip"
            onClick={() => choose(choice.key)}
            disabled={busy}
          >
            {t(`planOnboarding.q1.options.${choice.key}`)}
          </button>
        ))}

        <button
          ref={dateAnchorRef}
          type="button"
          className={`drill-date__chip drill-date__chip--date ${customDate ? 'is-selected' : ''}`}
          onClick={() => setShowPicker((open) => !open)}
          disabled={busy}
          aria-haspopup="dialog"
          aria-expanded={showPicker}
          aria-label={t('planOnboarding.q1.pickDate')}
        >
          <span className="drill-date__chip-icon" aria-hidden="true">
            <CalendarIcon width="15" height="15" />
          </span>
          <span>{customDateLabel || t('planOnboarding.q1.pickDate')}</span>
        </button>

        {showPicker && (
          <DatePicker
            value={customDate}
            onChange={handleCustomDate}
            minDate={new Date()}
            onClose={() => setShowPicker(false)}
            anchorRef={dateAnchorRef}
            language={language}
          />
        )}
      </div>

      <button
        type="button"
        className="drill-btn drill-btn--ghost drill-date__skip"
        onClick={onSkip}
        disabled={busy}
      >
        {t('drill.dateSkip', 'I do not have a date yet')}
      </button>
    </div>
  );
};

export default DrillExamDate;
