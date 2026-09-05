import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * DrillWriting — what the student sees while the next question is generated.
 *
 * WHY A SKELETON AND NOT A SPINNER
 * ────────────────────────────────
 * A spinner says "something is happening somewhere". The drill always produces
 * the same shape — a stem and a set of options — so showing that shape
 * shimmering into place says "your next question is arriving, and this is what
 * it will look like". The page also stops jumping: the skeleton occupies
 * roughly the space the question will take, so nothing reflows when it lands.
 *
 * WHY THE MESSAGES ARE SPECIFIC
 * ─────────────────────────────
 * They are not filler. The drill really does read the answer, choose a spec
 * (topic × format × difficulty) and only then write a question — see
 * selectNextSpec in drillModel. Naming those steps is the one moment the
 * student can see that the thing is adapting rather than dealing off a deck,
 * which is the entire promise of the feature.
 *
 * Same escalation principle as StudyLoadingScreen: past SLOW_AT we stop
 * pretending it is quick, because a cheerful message frozen at 25 seconds is
 * what actually makes people leave.
 */

const MESSAGE_KEYS = [
  'drill.writing1',
  'drill.writing2',
  'drill.writing3',
  'drill.writing4',
];

/* Opening a drill has no previous answer to read, so it gets its own copy.
   Telling a student we are "reading what you just answered" before she has
   answered anything is the kind of small lie that makes the rest feel
   scripted. */
const STARTUP_KEYS = [
  'drill.startup1',
  'drill.startup2',
  'drill.startup3',
];

const FALLBACKS = {
  'drill.writing1': 'Reading what you just answered…',
  'drill.writing2': 'Deciding what to ask next…',
  'drill.writing3': 'Writing the question…',
  'drill.writing4': 'Checking the rationale…',
  'drill.startup1': 'Opening your material…',
  'drill.startup2': 'Choosing where to start…',
  'drill.startup3': 'Writing your first question…',
};

/** Seconds after which we stop pretending this is quick. */
const SLOW_AT = 14;

const ROTATE_MS = 2200;

const DrillWriting = ({ startup = false }) => {
  const { t } = useTranslation();
  const keys = startup ? STARTUP_KEYS : MESSAGE_KEYS;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const rotate = setInterval(() => {
      setIndex((i) => (i + 1) % keys.length);
    }, ROTATE_MS);
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, [keys.length]);

  const isSlow = elapsed >= SLOW_AT;
  const key = keys[index % keys.length];
  const message = isSlow
    ? t('drill.writingSlow', 'Taking a moment longer on this one — it is worth getting right.')
    : t(key, FALLBACKS[key]);

  return (
    <div className="drill-writing" role="status" aria-live="polite">
      {/* The shape of the question to come. aria-hidden: the live message
          below is what a screen reader should hear, not six empty boxes. */}
      <div className="drill-skeleton" aria-hidden="true">
        <div className="drill-skeleton__stem">
          <span className="drill-skeleton__line" />
          <span className="drill-skeleton__line drill-skeleton__line--short" />
        </div>
        <div className="drill-skeleton__options">
          <span className="drill-skeleton__option" />
          <span className="drill-skeleton__option" />
          <span className="drill-skeleton__option" />
          <span className="drill-skeleton__option" />
        </div>
      </div>

      <p className={`drill-writing__text${isSlow ? ' is-slow' : ''}`} key={isSlow ? 'slow' : key}>
        {message}
      </p>
    </div>
  );
};

/**
 * The whole exam surface in its loading state.
 *
 * Shared by the route wrapper (while the chat's topics load) and by the drill
 * itself (while the first question generates), so pressing "Keep drilling"
 * lands on ONE continuous surface that becomes the question — instead of a
 * bare spinner, then a different bare spinner, then a hard cut to content.
 */
export const DrillLoadingShell = ({ startup = true }) => (
  <div className="drill-shell drill-shell--exam">
    <header className="drill-bar">
      <div className="drill-bar__left">
        <span className="drill-bar__count drill-bar__count--placeholder" />
      </div>
    </header>
    <div className="drill-progress" role="presentation">
      <div className="drill-progress__fill" style={{ width: '0%' }} />
    </div>
    <main className="drill-body">
      <DrillWriting startup={startup} />
    </main>
  </div>
);

export default DrillWriting;
