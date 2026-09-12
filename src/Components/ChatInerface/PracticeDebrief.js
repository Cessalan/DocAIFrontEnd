import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import './PracticeDebrief.css';

export default function PracticeDebrief({ message, onSendMessage, onRetry }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const [review, setReview] = useState(false);
  return <div className="practice-debrief">
    <div aria-live="polite"><ReactMarkdown>{message.content}</ReactMarkdown></div>
    {message.isStreaming ? <div className="practice-debrief-loading" role="status">{fr ? 'Un instant…' : 'One moment…'}</div> : message.debriefError ?
      <button onClick={() => onRetry?.({ messageId: message.sourceQuizId, questionCount: message.questionCount })}>{fr ? 'Réessayer' : 'Retry review'}</button> : <>
        <div className="practice-debrief-actions">
          <button aria-expanded={review} onClick={() => setReview(value => !value)}>{message.reviewLabel}</button>
          <button disabled={!onSendMessage} onClick={() => onSendMessage(null, message.practicePrompt)}>{fr ? 'Pratiquer ce sujet' : 'Practice this topic'}</button>
        </div>
        {review && <div className="practice-debrief-review"><strong>{message.reviewQuestion}</strong>
          {message.reviewAnswer && <p>{fr ? 'Ta réponse : ' : 'Your answer: '}{message.reviewAnswer}</p>}
          <ReactMarkdown>{message.reviewFeedback || (fr ? 'Reprends la question et explique pourquoi tu as choisi cette réponse. Compare les autres options avant de réessayer.' : 'Restate what the question asks and explain why you chose your answer. Compare the alternatives before trying again.')}</ReactMarkdown>
        </div>}
      </>}
  </div>;
}
