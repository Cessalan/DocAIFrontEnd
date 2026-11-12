import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { clarityEvent } from '../../Services/ClarityService';
import { copyToClipboard, shareUrlFor } from '../../Services/QuizShareService';
import { followUpPrompt, isRight } from '../ShareSet/shareSetModel';

/**
 * The end of a shared set, and the only place it asks for anything.
 *
 * Laid out like the plan's result card (NodeResult.css) so a classmate who
 * signs up recognises the product she lands in. The ask is the next thing she
 * wants, more questions on what she just missed, not "create an account".
 *
 * Her practice request rides the same sessionStorage handoff the SEO practice
 * pages use: the chat opens with it filled in. No notes are behind that
 * request, so it names topics.
 */
export default function SharedSetResult({ set, answers, result, onRetry }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const [copied, setCopied] = useState(false);
  const { correct, total, percent, weakTopics } = result;

  const headline = percent >= 80 ? t('shareSet.resultHigh') : percent >= 50 ? t('shareSet.resultMid') : t('shareSet.resultLow');

  const keepGoing = (own = false) => {
    clarityEvent('shared_signup_clicked', { correct, total, own_notes: own, signed_in: !!currentUser });
    if (!own) {
      const prompt = followUpPrompt({ topic: set.topic, weakTopics, language: i18n.language || 'en' });
      try {
        if (prompt) {
          sessionStorage.setItem('pendingQuizPrompt', prompt);
          sessionStorage.setItem('pendingQuizTopic', weakTopics[0] || set.topic || '');
        }
      } catch { /* Without storage she still reaches the app, just with an empty box. */ }
    }
    navigate(currentUser ? '/c' : `/signup?returnTo=${encodeURIComponent('/c')}`);
  };

  const passOn = async () => {
    if (!(await copyToClipboard(shareUrlFor(set.shareId)))) return;
    setCopied(true);
    clarityEvent('share_sent', { surface: 'shared_result', method: 'copy_link' });
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="shared-card shared-result">
      <p className="shared-eyebrow">{t('shareSet.resultEyebrow')}</p>
      <div className="shared-result__hero">
        <div className="shared-result__intro">
          <h1>{headline}</h1>
          {set.topic && <p className="shared-result__topic">{set.topic}</p>}
        </div>
        <div className="shared-result__score">
          <span className="shared-result__number">{correct}</span>
          <span className="shared-result__of">{t('shareSet.ofCorrect', { total })}</span>
        </div>
      </div>
      <div className="shared-segments shared-segments--result" aria-hidden="true">
        {set.questions.map((item, at) => <span key={item.index} className={isRight(answers[at]) ? 'is-right' : 'is-missed'} />)}
      </div>
      {set.senderScore && set.senderName && (
        <p className="shared-result__sender">
          {t('shareSet.senderScore', { name: set.senderName, got: set.senderScore.got, total: set.senderScore.total })}
        </p>
      )}

      <div className="shared-result__next">
        <p className="shared-result__label">
          {weakTopics.length ? t('shareSet.workOn') : t('shareSet.keepSharp')}
        </p>
        <p className="shared-result__focus">
          {weakTopics.length ? weakTopics.join(' · ') : set.topic || t('shareSet.untitled')}
        </p>
        <p className="shared-result__pitch">
          {currentUser ? t('shareSet.pitchSignedIn') : t('shareSet.pitch')}
        </p>
        <button type="button" className="shared-primary" onClick={() => keepGoing(false)}>
          {currentUser ? t('shareSet.ctaSignedIn') : t('shareSet.cta')}
          <span aria-hidden="true">→</span>
        </button>
        {!currentUser && <p className="shared-result__fine">{t('shareSet.ctaFine')}</p>}
      </div>

      <ul className="shared-review">
        {set.questions.map((item, at) => (
          <li key={item.index}>
            <span className={`shared-review__mark${isRight(answers[at]) ? ' is-right' : ''}`} aria-hidden="true" />
            <span className="shared-review__text">{item.question}</span>
            <span className="shared-review__state">{isRight(answers[at]) ? t('shareSet.reviewRight') : t('shareSet.reviewMissed')}</span>
          </li>
        ))}
      </ul>

      <div className="shared-result__links">
        <button type="button" onClick={() => keepGoing(true)}>{t('shareSet.ownNotes')}</button>
        <button type="button" onClick={onRetry}>{t('shareSet.retrySet')}</button>
        <button type="button" onClick={passOn}>{copied ? t('shareSet.copied') : t('shareSet.passOn')}</button>
      </div>
    </div>
  );
}
