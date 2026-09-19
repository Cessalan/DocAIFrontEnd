import React from 'react';
import { useTranslation } from 'react-i18next';
import { compareTopicResult } from '../../Services/topicProgressModel';
import './TopicEvidence.css';

export function ReviewReason({ reason, compact = false }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  if (!reason || reason.source !== 'quick_check' || !reason.topic || !reason.answered || reason.correct >= reason.answered) return null;
  if (compact) {
    const concepts = (reason.missedConcepts || []).filter(value => typeof value === 'string' && value.trim()).slice(0, 2);
    const outcome = reason.priorityMisses >= 2
      ? (fr ? 'Entraîne-toi à choisir la première action' : 'Practise choosing what to do first')
      : concepts.length
        ? `${fr ? 'Priorité' : 'Focus'}: ${concepts.join(' · ')}`
        : (fr ? 'Priorité : les notions derrière les questions manquées.' : 'Focus: the ideas behind the questions you missed.');
    return <div className="topic-evidence topic-evidence--compact">
      <p>{outcome}</p>
      <small className="topic-evidence__attribution">{fr ? 'Choisi à partir des questions manquées dans ton bilan.' : 'Chosen from the questions you missed in your quick check.'}</small>
    </div>;
  }
  return <div className={`topic-evidence${compact ? ' topic-evidence--compact' : ''}`}>
    {!compact && <strong className="topic-evidence__title">{fr ? 'Pourquoi cette révision ?' : 'Why this review?'}</strong>}
    <p>{fr
      ? `Tu as répondu correctement à ${reason.correct} question${reason.correct > 1 ? 's' : ''} sur ${reason.answered} sur ce sujet pendant le bilan initial. Revoyons-le avant de réessayer.`
      : `You got ${reason.correct} of ${reason.answered} questions right on this topic in your quick check. Let’s review it before you try again.`}</p>
  </div>;
}

export function TopicProgress({ baseline, latest }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const comparison = compareTopicResult(baseline, latest);
  if (!comparison) return null;
  const { delta, direction } = comparison;
  return <section className="topic-progress" aria-label={fr ? 'Progression par sujet' : 'Topic progress'}>
    <strong>{baseline.topic}</strong>
    <div className="topic-progress__scores">
      <span>{fr ? 'Bilan initial' : 'Quick check'}<b>{baseline.correct}/{baseline.answered}</b></span>
      <span aria-hidden="true">→</span>
      <span>{fr ? 'Dernière pratique' : 'Latest practice'}<b>{latest.correct}/{latest.answered}</b></span>
    </div>
    <p>{direction === 'same' ? (fr ? 'Même taux de bonnes réponses.' : 'Same accuracy on this set.')
      : fr ? `${Math.abs(delta)} points de pourcentage ${direction === 'higher' ? 'de plus' : 'de moins'} sur cette série.`
        : `${Math.abs(delta)} percentage points ${direction === 'higher' ? 'higher' : 'lower'} on this set.`}</p>
    <small>{fr ? 'Premières tentatives sur des questions nouvelles. Un premier signal, pas une mesure de maîtrise.'
      : 'First attempts on fresh questions. An early signal, not a mastery score.'}</small>
  </section>;
}
