import { useEffect, useRef } from 'react';
import { markMessageEngaged } from '../../Services/FireBaseServiceChats';

/**
 * useArtifactEngagement
 *
 * Records whether a student actually consumed a passive artifact.
 *
 * Quizzes and flashcards produce their own engagement signal — you cannot
 * answer a question without writing to the message. Study sheets, concept maps
 * and audio are just rendered content, so delivery was the only thing ever
 * recorded about them. That made them look inert next to quizzes in any
 * analysis, when in reality they were simply not instrumented.
 *
 * Rather than threading chat/message ids down into the markdown renderer and
 * the diagram viewer, this watches the message container itself: an artifact
 * that stays meaningfully on screen for DWELL_MS counts as read. One hook, one
 * call site, covers every passive type including ones added later.
 *
 * Deliberate choices:
 *  - Dwell, not render. Scrolling past an artifact must not count as reading
 *    it, or the metric measures scroll position instead of attention.
 *  - Fires at most once per message, and never if the message already carries
 *    an `engagedAt`, so re-renders and scroll-backs don't inflate the number
 *    or burn writes.
 *  - Silent on failure — see markMessageEngaged.
 */

// Passive artifacts: rendered content with no natural "I used it" event.
// Quiz and flashcard are intentionally ABSENT — they stamp on answer/review,
// which is a far stronger signal than dwell, and mixing the two would corrupt
// the comparison.
const DWELL_TRACKED_TYPES = new Set([
  'studysheet',
  'summary',
  'mindmap',
  'audio',
  'audio_player'
]);

// Long enough that scrolling past doesn't register, short enough that a
// student who genuinely reads the top of a study sheet is counted.
const DWELL_MS = 8000;
const VISIBLE_RATIO = 0.4;

export default function useArtifactEngagement(chatId, message, nodeRef) {
  const firedRef = useRef(false);

  const messageId = message?.id;
  const type = message?.type;
  const alreadyEngaged = Boolean(message?.engagedAt);

  useEffect(() => {
    const node = nodeRef?.current;

    if (!node || !chatId || !messageId) return undefined;
    if (!DWELL_TRACKED_TYPES.has(type)) return undefined;
    if (alreadyEngaged || firedRef.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    let timer = null;

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const visible =
          entry && entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO;

        if (visible) {
          if (timer === null) {
            timer = setTimeout(() => {
              if (firedRef.current) return;
              firedRef.current = true;
              markMessageEngaged(chatId, messageId, type);
              observer.disconnect();
            }, DWELL_MS);
          }
        } else {
          // Left the viewport before the threshold — start over next time.
          clear();
        }
      },
      { threshold: [VISIBLE_RATIO] }
    );

    observer.observe(node);

    return () => {
      clear();
      observer.disconnect();
    };
  }, [chatId, messageId, type, alreadyEngaged, nodeRef]);
}

export { DWELL_TRACKED_TYPES, DWELL_MS, VISIBLE_RATIO };
