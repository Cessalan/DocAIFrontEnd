import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewReason } from './TopicEvidence';
import { getStepTopicLabel, formatNodeType, getNodeEstimate } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';
import './PlanNextSteps.css';

const topicLabel = node => node.topic || getStepTopicLabel(node.label).replace(/\s*[-–]\s*(Quick Check|Drill|Bilan rapide|Entraînement)\s*$/i, '');
const topicKey = node => String(node.topicKey || topicLabel(node)).trim().replace(/\s+/g, ' ').toLowerCase();

const stepPurpose = (node, index, nodes, fr) => {
  if (node.type === 'quiz') {
    const alreadyPractised = nodes.slice(0, index).some(previous => previous.type === 'quiz' && topicKey(previous) === topicKey(node));
    return alreadyPractised
      ? (fr ? 'Mets tes connaissances en pratique' : 'Put what you learned into practice')
      : (fr ? 'Vérifie ce que tu as compris' : 'Check what you understood');
  }
  const copy = {
    audio: ['Hear the key ideas again', 'Réécoute les idées essentielles'],
    flashcard: ['Practise recalling the key facts', 'Entraîne-toi à retenir les faits clés'],
    exam: ['Check your progress on fresh questions', 'Vérifie tes progrès avec de nouvelles questions'],
    lesson: ['Review the key ideas', 'Revois les idées essentielles'],
    review: ['Revisit what needs more practice', 'Reprends les points à travailler'],
    mindmap: ['See how the ideas connect', 'Fais le lien entre les idées'],
  };
  return copy[node.type]?.[fr ? 1 : 0] || getStepTopicLabel(node.label) || node.type;
};

export default function PlanNextSteps({ nodes, reserveCount = 0, onStart, progress = null }) {
  const { t, i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const listRef = useRef(null);
  const [highlight, setHighlight] = useState(null);
  const isTravelling = !!progress;
  const activeId = progress?.activeId;
  useLayoutEffect(() => {
    if (!isTravelling || !listRef.current) return undefined;
    const list = listRef.current;
    const measure = () => {
      const active = list.querySelector('[aria-current="step"]');
      if (active) setHighlight({ top: active.offsetTop - 6, height: active.offsetHeight + 12 });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(list);
    return () => observer?.disconnect();
  }, [activeId, isTravelling]);
  if (!nodes.length) return null;
  return <ul ref={listRef} className={`study-modal-plan-list plan-next-steps${progress ? ' is-travelling' : ''}`}
    style={progress && highlight ? { '--active-top': `${highlight.top}px`, '--active-height': `${highlight.height}px` } : undefined}>
    {nodes.map((node, index) => <li key={node.id || index}
      className={`study-modal-plan-item${index === 0 ? ' is-first' : ''}${node.detour ? ' is-detour' : ''}${progress?.activeId === node.id ? ' is-current' : ''}${progress && (node.status === 'done' || progress.completedId === node.id) ? ' is-finished' : ''}`}
      aria-current={progress?.activeId === node.id ? 'step' : undefined}
      data-type={node.type} data-entering-detour={progress?.detourId === node.id || undefined} style={{ animationDelay: `${index * 70}ms` }}>
      <span className="study-modal-plan-icon" aria-hidden="true">{getStudyNodeIcon(node.type)}
        {progress && (node.status === 'done' || progress.completedId === node.id) && <span className="plan-next-steps__check">✓</span>}
      </span>
      <div className="study-modal-plan-content">
        <span className="study-modal-plan-type">{formatNodeType(node.type, t)}</span>
        {node.detour && <small className="plan-next-steps__detour-label">{fr ? 'Pratique ciblée ajoutée' : 'Added focused practice'}</small>}
        <span className="study-modal-plan-label">{index === 0 ? getStepTopicLabel(node.label) || node.type : stepPurpose(node, index, nodes, fr)}</span>
        {index > 0 && topicKey(node) !== topicKey(nodes[index - 1]) &&
          <small className="plan-next-steps__topic">{topicLabel(node)}</small>}
        {index === 0 && node.type === 'lesson' && <ReviewReason reason={node.reviewReason} compact />}
        {progress && (node.status === 'done' || progress.completedId === node.id) && <span className="plan-next-steps__completed">{fr ? 'Terminé' : 'Completed'}</span>}
      </div>
      {index === 0 && !progress && <div className="plan-next-steps__action"><button type="button" className="study-modal-start study-modal-start--inline" onClick={onStart}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {t('study.planFirstBadge', 'Start here')}
      </button><small>{fr ? `Environ ${getNodeEstimate(node.type)} min pour commencer` : `About ${getNodeEstimate(node.type)} min to start`}</small></div>}
    </li>)}
    {reserveCount > 0 && <li className="study-modal-plan-more">{t('study.planReserveNote', '+{{count}} more, unlocked when you finish these', { count: reserveCount })}</li>}
  </ul>;
}
