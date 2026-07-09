import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import './StudyMode.css';

/**
 * ExamConfigModal — Shown when student taps an exam node.
 * Lets her configure the mini-test before it generates.
 *
 * Minimal config:
 *   - Question types: MCQ, SATA, Case Study (all on by default)
 *   - Question count: 5-20 (default 10)
 *   - Timer toggle: off by default
 *   - Custom instructions text field
 */
const ExamConfigModal = ({
  isOpen,
  onClose,
  onStart,       // (config) => generate and start the exam
  topic,         // Topic label for this exam
  isLoading,     // Whether exam is being generated
}) => {
  const { t } = useTranslation();
  const { isPro, remaining, openUpgrade } = useUsageLimit();

  // Question types — all on by default
  const [questionTypes, setQuestionTypes] = useState({
    mcq: true,
    sata: true,
    casestudy: true,
  });

  // Question count
  const [questionCount, setQuestionCount] = useState(10);

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(false);

  // Custom instructions
  const [customInstructions, setCustomInstructions] = useState('');

  // Rotating loading messages (i18n keys)
  const loadingKeys = [
    'loading1', 'loading2', 'loading3', 'loading4', 'loading5',
    'loading6', 'loading7', 'loading8', 'loading9', 'loading10', 'loading11',
  ];
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex(prev =>
        prev < loadingKeys.length - 1 ? prev + 1 : prev
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const toggleType = (type) => {
    setQuestionTypes(prev => {
      const next = { ...prev, [type]: !prev[type] };
      // At least one type must be selected
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const handleStart = () => {
    const selectedTypes = Object.entries(questionTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type);

    onStart({
      questionTypes: selectedTypes,
      questionCount,
      timerEnabled,
      timerSeconds: timerEnabled ? getTimerSeconds(selectedTypes) : null,
      customInstructions: customInstructions.trim() || null,
    });
  };

  // Calculate per-question timer based on question mix
  const getTimerSeconds = (types) => {
    const timings = { mcq: 60, sata: 90, casestudy: 150 };
    const totalTime = types.reduce((sum, t) => sum + (timings[t] || 90), 0);
    return Math.round(totalTime / types.length);
  };

  if (!isOpen) return null;

  const selectedCount = Object.values(questionTypes).filter(Boolean).length;

  // Grace case: she still has free questions, but fewer than this exam needs.
  // We generate the full exam anyway (the gate only blocks at zero) — this
  // banner makes the generosity visible instead of silently overshooting.
  const willOvershoot =
    !isPro && Number.isFinite(remaining) && remaining > 0 && questionCount > remaining;

  return (
    <div className="exam-config-overlay" onClick={!isLoading ? onClose : undefined}>
      <div className="exam-config-modal" onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        {!isLoading && (
          <button className="exam-config__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="exam-config__loading">
            <h3>{t('exam.generating', 'Building your mini-test...')}</h3>
            <p className="exam-config__loading-msg" key={loadingMsgIndex}>
              {t(`exam.${loadingKeys[loadingMsgIndex]}`)}
            </p>
            <div className="exam-config__loading-dots">
              <span /><span /><span />
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="exam-config__header">
              <div className="exam-config__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <div>
                <h2 className="exam-config__title">{t('exam.configTitle', 'Mini-Test')}</h2>
                <p className="exam-config__topic">{topic}</p>
              </div>
            </div>

            <p className="exam-config__description">
              {t('exam.configDescription', 'Configure your mini-test to match how your real exam will look.')}
            </p>

            {/* Question Types */}
            <div className="exam-config__section">
              <label className="exam-config__label">
                {t('exam.questionTypes', 'Question types')}
              </label>
              <div className="exam-config__types">
                <button
                  className={`exam-config__type-btn ${questionTypes.mcq ? 'active' : ''}`}
                  onClick={() => toggleType('mcq')}
                >
                  <span className="exam-config__type-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </span>
                  <span className="exam-config__type-name">{t('exam.typeMCQ', 'Multiple Choice')}</span>
                  <span className="exam-config__type-desc">{t('exam.typeMCQDesc', '1 correct answer')}</span>
                </button>

                <button
                  className={`exam-config__type-btn ${questionTypes.sata ? 'active' : ''}`}
                  onClick={() => toggleType('sata')}
                >
                  <span className="exam-config__type-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zM22.24 5.59L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                    </svg>
                  </span>
                  <span className="exam-config__type-name">{t('exam.typeSATA', 'Select All That Apply')}</span>
                  <span className="exam-config__type-desc">{t('exam.typeSATADesc', 'Multiple correct answers')}</span>
                </button>

                <button
                  className={`exam-config__type-btn ${questionTypes.casestudy ? 'active' : ''}`}
                  onClick={() => toggleType('casestudy')}
                >
                  <span className="exam-config__type-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/>
                    </svg>
                  </span>
                  <span className="exam-config__type-name">{t('exam.typeCaseStudy', 'Case Study')}</span>
                  <span className="exam-config__type-desc">{t('exam.typeCaseStudyDesc', 'NGN clinical scenarios')}</span>
                </button>
              </div>
            </div>

            {/* Question Count */}
            <div className="exam-config__section">
              <label className="exam-config__label">
                {t('exam.questionCount', 'Number of questions')}
              </label>
              <div className="exam-config__count-row">
                <input
                  type="range"
                  min="5"
                  max="20"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="exam-config__slider"
                />
                <span className="exam-config__count-value">{questionCount}</span>
              </div>
              <p className="exam-config__estimate">
                {t('exam.timeEstimate', '~{{minutes}} min', {
                  minutes: Math.round(questionCount * 1.5)
                })}
              </p>

              {willOvershoot && (
                <div className="exam-config__grace" role="status">
                  <span className="exam-config__grace-icon" aria-hidden="true">💙</span>
                  <div>
                    <p className="exam-config__grace-text">
                      {t('exam.graceNote', {
                        remaining,
                        count: questionCount,
                        defaultValue:
                          'You have {{remaining}} free questions left right now and this mini-test needs {{count}}. We’ll build the full test anyway — your success comes first.'
                      })}
                    </p>
                    <button
                      type="button"
                      className="exam-config__grace-upgrade"
                      onClick={openUpgrade}
                    >
                      {t('exam.graceUpgrade', 'Free questions refill every 3 hours · Go unlimited with Pro')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Timer Toggle */}
            <div className="exam-config__section exam-config__toggle-section">
              <div className="exam-config__toggle-info">
                <label className="exam-config__label">
                  {t('exam.simulateTiming', 'Simulate exam timing')}
                </label>
                <p className="exam-config__toggle-hint">
                  {t('exam.timerHint', 'Countdown per question to practice pacing')}
                </p>
              </div>
              <button
                className={`exam-config__toggle ${timerEnabled ? 'active' : ''}`}
                onClick={() => setTimerEnabled(!timerEnabled)}
                role="switch"
                aria-checked={timerEnabled}
              >
                <span className="exam-config__toggle-thumb" />
              </button>
            </div>

            {/* Custom Instructions */}
            <div className="exam-config__section">
              <label className="exam-config__label">
                {t('exam.customInstructions', 'Additional instructions')}
                <span className="exam-config__label-optional"> ({t('exam.optional', 'optional')})</span>
              </label>
              <textarea
                className="exam-config__textarea"
                placeholder={t('exam.customPlaceholder', 'e.g. "My professor focuses on prioritization" or "Include drug calculations"')}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
                maxLength={300}
              />
            </div>

            {/* Start Button */}
            <button
              className="exam-config__start"
              onClick={handleStart}
              disabled={selectedCount === 0}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {t('exam.startExam', 'Start Mini-Test')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExamConfigModal;
