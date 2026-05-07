import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSoundMuted } from '../../utils/soundEffects';

/**
 * Speaker icons — single SVG with two states. We swap classes to fade
 * between them so the toggle feels alive, not just a glyph swap.
 */
const SpeakerOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const SpeakerOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

/**
 * StudyModeHeader - Header bar for study mode
 * Shows unit title centered, plus a sound-mute toggle on the right so
 * users can silence quiz feedback sounds when listening to music.
 *
 * @param {string} unitTitle - Main title of the study unit
 * @param {string} unitSubtitle - Subtitle/description
 */
const StudyModeHeader = ({
  unitTitle,
  unitSubtitle = ''
}) => {
  const { t } = useTranslation();
  const [muted, toggleMuted] = useSoundMuted();
  const displayTitle = unitTitle || t('study.yourStudyPlan', 'Study Session');

  const muteLabel = muted
    ? t('study.unmuteSounds', 'Unmute sounds')
    : t('study.muteSounds', 'Mute sounds');

  return (
    <div className="study-mode-header">
      <div className="study-header-inner">
        {/* Center: title */}
        <div className="study-header-center">
          <div className="study-header-info">
            <h1 className="study-unit-title">{displayTitle}</h1>
            {unitSubtitle && (
              <p className="study-unit-subtitle">{unitSubtitle}</p>
            )}
          </div>
        </div>

        {/* Right: sound toggle. Sits on the inner row so it floats on the
            right edge regardless of how long the centered title is. */}
        <button
          type="button"
          className={`study-sound-toggle${muted ? ' is-muted' : ''}`}
          onClick={toggleMuted}
          aria-pressed={muted}
          aria-label={muteLabel}
          title={muteLabel}
        >
          <span className="study-sound-toggle-icon">
            {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          </span>
        </button>
      </div>
    </div>
  );
};

export default StudyModeHeader;
