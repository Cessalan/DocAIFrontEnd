import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import './PracticeDebrief.css';

/**
 * The note after a finished practice (2026-10-06 redesign).
 *
 * WHY IT CHANGED
 * It used to open on a bold grade ("2/5 correct on your first try"), then
 * three labelled lines cut at 14 words, then a second sentence from the
 * coverage model that repeated the misses in other words, then three
 * buttons that disagreed ("Review my mistake" beside "Redo my 2 mistakes",
 * and "Practise Examen primaire" right after a quiz on the primary survey).
 * Two authors, two counts, one grade first. It read as a report, not a tutor.
 *
 * NOW
 * - One voice: the backend's note, two short paragraphs (what she can
 *   already do, then the one idea that explains her misses). No grade; the
 *   quiz card above shows the score.
 * - One primary action, chosen in this order:
 *     1. redo THIS quiz's first-try misses, stored questions replayed verbatim;
 *     2. practise the first part of her material she hasn't touched (`next`,
 *        latest review only, so older reviews don't repeat it);
 *     3. a short practice on this topic.
 * - One quiet link to see every answer, which opens the quiz itself.
 */
export default function PracticeDebrief({ message, onSendMessage, onRetry, next = null, mistakes = [],
  onRedoMistakes, onOpenPractice }) {
  const { i18n, t } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const [review, setReview] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const [redoError, setRedoError] = useState('');

  const missed = Array.isArray(mistakes) ? mistakes : [];
  const topics = [...new Set(missed.map(q => q?.topic || q?.metadata?.topic).filter(Boolean))];
  const redoSet = missed.length > 0 && onRedoMistakes
    ? { topic: topics.slice(0, 2).join(' · ') || t('practiceNext.thisPractice'), missedCount: missed.length, questions: missed }
    : null;
  const fresh = next?.fresh || null;

  async function redo() {
    setRedoing(true); setRedoError('');
    try { await onRedoMistakes(redoSet); }
    catch { setRedoError(t('practiceNext.failed')); }
    finally { setRedoing(false); }
  }

  let primary;
  if (redoSet) {
    primary = <button className="practice-debrief-primary" disabled={redoing} onClick={redo}>
      {redoing ? t('practiceNext.preparing') : t('practiceNext.redoThese', { count: redoSet.missedCount })}</button>;
  } else if (fresh) {
    primary = <button className="practice-debrief-primary" disabled={!onSendMessage}
      onClick={() => onSendMessage(null, t('practiceNext.focusPrompt', { topic: fresh }))}>{t('practiceNext.practise', { topic: fresh })}</button>;
  } else {
    primary = <button className="practice-debrief-primary" disabled={!onSendMessage}
      onClick={() => onSendMessage(null, message.practicePrompt)}>{fr ? 'Pratiquer ce sujet' : 'Practice this topic'}</button>;
  }

  // Opening the quiz shows every answer with its explanation. Where that is
  // not available (tests, older call sites) the saved focus question is
  // shown inline instead, as before.
  const canOpen = Boolean(onOpenPractice && message.sourceQuizId);
  const secondary = canOpen
    ? <button className="practice-debrief-link" onClick={() => onOpenPractice(message.sourceQuizId)}>{t('practiceNext.seeAnswers')}</button>
    : message.reviewQuestion
      ? <button className="practice-debrief-link" aria-expanded={review} onClick={() => setReview(value => !value)}>{message.reviewLabel}</button>
      : null;

  return <div className="practice-debrief">
    <div aria-live="polite"><ReactMarkdown>{message.content}</ReactMarkdown></div>
    {message.isStreaming ? <div className="practice-debrief-loading" role="status">{fr ? 'Un instant…' : 'One moment…'}</div> : message.debriefError ?
      <button onClick={() => onRetry?.({ messageId: message.sourceQuizId, questionCount: message.questionCount })}>{fr ? 'Réessayer' : 'Retry review'}</button> : <>
        <div className="practice-debrief-actions">{primary}{secondary}</div>
        {redoError && <p className="practice-debrief-error" role="alert">{redoError}</p>}
        {review && !canOpen && <div className="practice-debrief-review"><strong>{message.reviewQuestion}</strong>
          {message.reviewAnswer && <p>{fr ? 'Ta réponse : ' : 'Your answer: '}{message.reviewAnswer}</p>}
          <ReactMarkdown>{message.reviewFeedback || (fr ? 'Reprends la question et explique pourquoi tu as choisi cette réponse. Compare les autres options avant de réessayer.' : 'Restate what the question asks and explain why you chose your answer. Compare the alternatives before trying again.')}</ReactMarkdown>
        </div>}
      </>}
  </div>;
}
