import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTypedBeats } from '../StudyMode/useTypedBeats';
import { buildCheckpointNarration, revealedAt } from './checkpointNarration';

/**
 * DrillCheckpoint — the tutor stops and tells her where she stands.
 *
 * This is a NARRATION, not a readout. It used to be labelled sections with
 * scores pinned to the right ("WEAK SPOTS · Adult Sleep Recommendations ·
 * 0/2"), which read as a dashboard about her rather than someone talking to
 * her. See the header of checkpointNarration.js for why that shape fails
 * regardless of how the labels are worded.
 *
 * WHAT IS DELIBERATELY NOT ON SCREEN
 * ──────────────────────────────────
 *   - No overall score. A percentage is the one number that lets a student
 *     keep believing the average, and the average is exactly what the
 *     topic × format model exists to break.
 *   - No per-topic fractions. "0/2" tells her she got them wrong, which she
 *     was present for. The pattern is the only thing worth interrupting her
 *     drilling to say.
 *
 * The only figures that survive are the two in the format-gap sentence,
 * because that gap IS the finding — and they are spoken inside the sentence,
 * with the strip below as quiet corroboration rather than a headline.
 */
const DrillCheckpoint = ({ checkpoint, onContinue, onExit, canContinue = true, remaining }) => {
  const { t } = useTranslation();

  const beats = useMemo(() => buildCheckpointNarration(checkpoint), [checkpoint]);
  const lines = useMemo(
    () => beats.map((b) => t(b.key, b.fallback, b.params)),
    [beats, t]
  );

  const { shown, stage, skip } = useTypedBeats(lines);
  const revealed = revealedAt(beats, stage);

  if (!checkpoint || beats.length === 0) return null;

  const gap = checkpoint.formatGap;

  const formatWord = (f) => ({
    mcq: t('exam.typeMCQ', 'Multiple Choice'),
    sata: t('exam.typeSATA', 'Select All That Apply'),
    casestudy: t('exam.typeCaseStudy', 'Case Study'),
  }[f] || f);

  // Two beats interpolate a raw format key; swap in the translated name so
  // the line reads as speech in both languages.
  const SPEAKS_A_FORMAT = ['drill.beatRecFormat', 'drill.beatFirstHardWin'];
  const renderLine = (line, i) => {
    const beat = beats[i];
    if (SPEAKS_A_FORMAT.includes(beat?.key) && beat.params?.format) {
      return line.replace(beat.params.format, formatWord(beat.params.format));
    }
    return line;
  };

  return (
    // Clicking anywhere completes the typing — a student in a hurry should
    // never have to sit through a flourish to get back to drilling.
    <div className="drill-cp" onClick={skip} role="presentation">
      <span className="drill-cp__eyebrow">{t('drill.checkpointEyebrow', 'Checkpoint')}</span>

      <div className="drill-cp__narration">
        {shown.map((line, i) => (
          <p
            key={beats[i]?.key || i}
            className={`drill-cp__line ${i === 0 ? 'drill-cp__line--lead' : ''}`}
          >
            {renderLine(line, i)}
          </p>
        ))}
      </div>

      {/* Quiet corroboration for the sentence that just named these numbers. */}
      {gap && revealed.has('gap') && (
        <div className="drill-cp__gap">
          <div className="drill-cp__gap-side">
            <span className="drill-cp__gap-value">{Math.round(gap.mcq.accuracy * 100)}%</span>
            <span className="drill-cp__gap-label">{t('exam.typeMCQ', 'Multiple Choice')}</span>
          </div>
          <div className="drill-cp__gap-rule" aria-hidden="true" />
          <div className="drill-cp__gap-side drill-cp__gap-side--weak">
            <span className="drill-cp__gap-value">{Math.round(gap.hard.accuracy * 100)}%</span>
            <span className="drill-cp__gap-label">{t('drill.gapHardLabel', 'SATA & case studies')}</span>
          </div>
        </div>
      )}

      <div className="drill-cp__actions">
        {canContinue ? (
          <button
            className="drill-btn drill-btn--primary"
            onClick={(e) => { e.stopPropagation(); onContinue(); }}
            type="button"
          >
            {t('drill.continueDrilling', 'Keep drilling')}
          </button>
        ) : (
          <div className="drill-cp__spent">
            <p className="drill-cp__spent-text">
              {t('drill.outOfQuestions', 'You have used your free questions for this week.')}
            </p>
            <button
              className="drill-btn drill-btn--primary"
              onClick={(e) => { e.stopPropagation(); onContinue(); }}
              type="button"
            >
              {t('drill.unlockUnlimited', 'Unlock unlimited drilling')}
            </button>
          </div>
        )}
        <button
          className="drill-btn drill-btn--ghost"
          onClick={(e) => { e.stopPropagation(); onExit(); }}
          type="button"
        >
          {t('drill.exit', 'Finish for now')}
        </button>
      </div>

      {canContinue && Number.isFinite(remaining) && (
        <p className="drill-cp__remaining">
          {t('drill.remainingQuestions', '{{count}} questions left this week', { count: remaining })}
        </p>
      )}
    </div>
  );
};

export default DrillCheckpoint;
