import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import BookMascot from '../QuizRoom/BookMascot';
import PillMascot from '../QuizRoom/PillMascot';
import CoffeeCupMascot from '../QuizRoom/CoffeeCupMascot';
import MatchaCupMascot from '../QuizRoom/MatchaCupMascot';

/**
 * StudyCelebration - Duolingo-style celebration
 * Can be inline (inside card) or overlay (full screen)
 *
 * @param {string} type - 'milestone' (30%) or 'complete' (100%)
 * @param {boolean} inline - If true, renders inside parent container instead of full screen
 * @param {number} correctCount - Number of correct answers (for context-aware messages)
 * @param {number} totalCount - Total number of items currently received (for context-aware messages)
 * @param {number} expectedTotal - Expected total items (default 12, used during streaming for accurate ratios)
 * @param {Function} onContinue - Callback when user clicks continue
 */
const StudyCelebration = ({
  type = 'milestone',
  inline = true,
  correctCount = 0,
  totalCount = 0,
  expectedTotal = 0,
  onContinue
}) => {
  const { t } = useTranslation();
  const [showContent, setShowContent] = useState(false);

  // Store a random index on mount to keep message consistent
  const [messageIndex] = useState(() => Math.floor(Math.random() * 4));

  // Store a random mascot index on mount
  const [mascotIndex] = useState(() => Math.floor(Math.random() * 5));

  // Array of mascot components to choose from
  const mascots = [
    { Component: NurseQuizMascot, hasExcited: true },
    { Component: BookMascot, hasExcited: false },
    { Component: PillMascot, hasExcited: false },
    { Component: CoffeeCupMascot, hasExcited: false },
    { Component: MatchaCupMascot, hasExcited: false }
  ];

  const selectedMascot = mascots[mascotIndex % mascots.length];

  // Entrance
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Calculate performance ratio for context-aware messages
  // This ratio determines the encouragement message shown:
  // - ≥80%: "You're doing great!" (high performance on attempted items)
  // - 50-79%: "You're making progress!" (moderate performance)
  // - <50%: "You can do this!" / "Don't give up!" (needs encouragement)
  //
  // Use totalCount (actual items attempted/received) as the denominator
  // because we want to measure how well they're doing on what they've tried,
  // not their progress toward the total expected items.
  // Example: 4 correct out of 5 attempted = 80% → great performance message
  const performanceRatio = totalCount > 0 ? correctCount / totalCount : 1;

  // Get message based on type and performance - use useMemo so t() is called fresh
  const message = useMemo(() => {
    if (type === 'complete') {
      // Completion messages
      const completionMessages = [
        t('study.lessonComplete', 'Lesson complete!'),
        t('study.amazingWork', 'Amazing work!'),
        t('study.youDidIt', 'You did it!')
      ];
      return completionMessages[messageIndex % completionMessages.length];
    }

    // Milestone messages based on performance (encouraging, not celebratory)
    if (performanceRatio >= 0.8) {
      // Doing great (80%+)
      const messages = [
        t('study.milestoneGreat1', "You're doing great!"),
        t('study.milestoneGreat2', 'Excellent progress!'),
        t('study.milestoneGreat3', 'Keep up the momentum!')
      ];
      return messages[messageIndex % messages.length];
    } else if (performanceRatio >= 0.5) {
      // Doing okay (50-79%)
      const messages = [
        t('study.milestoneOkay1', "You're making progress!"),
        t('study.milestoneOkay2', 'Keep going, you got this!'),
        t('study.milestoneOkay3', 'Stay focused!')
      ];
      return messages[messageIndex % messages.length];
    } else {
      // Struggling (<50%)
      const messages = [
        t('study.milestoneStruggle1', 'You can do this!'),
        t('study.milestoneStruggle2', 'I admire your perseverance!'),
        t('study.milestoneStruggle3', "Don't give up!"),
        t('study.milestoneStruggle4', 'Every attempt makes you stronger!')
      ];
      return messages[messageIndex % messages.length];
    }
  }, [type, performanceRatio, messageIndex, t]);

  // Determine container class - milestone has different styling (no confetti bg)
  const containerClass = inline
    ? type === 'milestone'
      ? 'study-celebration-inline study-milestone-inline'
      : 'study-celebration-inline'
    : 'study-celebration-overlay';

  return (
    <div className={containerClass}>
      {/* Confetti particles - only for completion, not milestone */}
      {type === 'complete' && (
        <div className="celebration-confetti">
          {[...Array(inline ? 12 : 20)].map((_, i) => (
            <div
              key={i}
              className={`confetti-particle confetti-${i % 5}`}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 1}s`
              }}
            />
          ))}
        </div>
      )}

      <div className={`celebration-content ${showContent ? 'visible' : ''}`}>
        {/* Message - above mascot */}
        <h1 className="celebration-message">{message}</h1>

        {/* Mascot with celebration animation - smaller for inline */}
        <div className="celebration-mascot">
          <selectedMascot.Component
            size={inline ? 100 : 160}
            isActive={true}
            {...(selectedMascot.hasExcited ? { isExcited: type === 'complete' } : {})}
          />
          {/* Celebration sparkles around mascot - only for completion */}
          {type === 'complete' && (
            <div className="mascot-sparkles">
              <span className="sparkle sparkle-1">✨</span>
              <span className="sparkle sparkle-2">⭐</span>
              <span className="sparkle sparkle-3">✨</span>
            </div>
          )}
        </div>

        {/* No stat cards. The XP card had already been commented out as a
            distraction; the two that remained were worse than a distraction
            because they were not true:

              PERFECT! 100% — hardcoded `isPerfect` on lessons, where there is
              nothing to score. Reading four pages was being reported back as a
              perfect result, which devalues the badge on the quiz where it is
              actually earned.

              SPEEDY 10:11 — wall-clock since the card mounted, so it counts
              time the student spent in another tab, and it is labelled SPEEDY
              whatever it says.

            What the student needs at the end of a lesson is the way onward,
            and that is the button below. Real performance feedback lives in
            the post-node readout, which is derived from her answers. */}

        {/* Continue button */}
        <button className="celebration-continue-btn" onClick={onContinue}>
          {type === 'complete'
            ? t('study.continue', 'CONTINUE')
            : t('study.continue', 'CONTINUE')}
        </button>
      </div>
    </div>
  );
};

export default StudyCelebration;
