import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import './PracticeDebrief.css';

/**
 * `next` (practiceCoverageModel.nextPractice) is passed only to the chat's
 * latest review, so older reviews don't all repeat the same suggestion. It
 * names what the whole chat shows rather than this one quiz: the topic she
 * missed most, and the first part of her material she hasn't practised.
 */
export default function PracticeDebrief({ message, onSendMessage, onRetry, next = null, onRedoMistakes }) {
  const { i18n, t } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const [review, setReview] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const [redoError, setRedoError] = useState('');
  const weak = next?.review, fresh = next?.fresh;
  const sentence = weak && fresh ? t('practiceNext.both', { count: weak.missedCount, weak: weak.topic, fresh })
    : weak ? t('practiceNext.weak', { count: weak.missedCount, weak: weak.topic })
    : fresh ? t('practiceNext.fresh', { fresh }) : null;

  async function redo() {
    setRedoing(true); setRedoError('');
    try { await onRedoMistakes(weak); }
    catch { setRedoError(t('practiceNext.failed')); }
    finally { setRedoing(false); }
  }

  return <div className="practice-debrief">
    <div aria-live="polite"><ReactMarkdown>{message.content}</ReactMarkdown></div>
    {message.isStreaming ? <div className="practice-debrief-loading" role="status">{fr ? 'Un instant…' : 'One moment…'}</div> : message.debriefError ?
      <button onClick={() => onRetry?.({ messageId: message.sourceQuizId, questionCount: message.questionCount })}>{fr ? 'Réessayer' : 'Retry review'}</button> : <>
        {sentence && <p className="practice-debrief-next">{sentence}</p>}
        <div className="practice-debrief-actions">
          <button aria-expanded={review} onClick={() => setReview(value => !value)}>{message.reviewLabel}</button>
          {weak && onRedoMistakes && <button disabled={redoing} onClick={redo}>
            {redoing ? t('practiceNext.preparing') : t('practiceNext.redo', { count: weak.missedCount })}</button>}
          {fresh
            ? <button disabled={!onSendMessage} onClick={() => onSendMessage(null, t('practiceNext.focusPrompt', { topic: fresh }))}>{t('practiceNext.practise', { topic: fresh })}</button>
            : <button disabled={!onSendMessage} onClick={() => onSendMessage(null, message.practicePrompt)}>{fr ? 'Pratiquer ce sujet' : 'Practice this topic'}</button>}
        </div>
        {redoError && <p className="practice-debrief-error" role="alert">{redoError}</p>}
        {review && <div className="practice-debrief-review"><strong>{message.reviewQuestion}</strong>
          {message.reviewAnswer && <p>{fr ? 'Ta réponse : ' : 'Your answer: '}{message.reviewAnswer}</p>}
          <ReactMarkdown>{message.reviewFeedback || (fr ? 'Reprends la question et explique pourquoi tu as choisi cette réponse. Compare les autres options avant de réessayer.' : 'Restate what the question asks and explain why you chose your answer. Compare the alternatives before trying again.')}</ReactMarkdown>
        </div>}
      </>}
  </div>;
}
