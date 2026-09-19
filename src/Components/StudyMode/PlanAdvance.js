import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStepTopicLabel, formatNodeType } from './planFormatting';
import PlanNextSteps from './PlanNextSteps';
import './PlanAdvance.css';

export default function PlanAdvance({ nodes, fromId, toId, confirmed, isComplete = false, reserveCount = 0, ready = false, error = false, elapsed = false, onOpenNow, onBack, detour = false, returnId }) {
  const { t, i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!confirmed) { setMoved(false); return undefined; }
    // Give users time to orient before moving; the container then holds the destination for reading.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setMoved(true), reducedMotion ? 0 : 1100);
    return () => clearTimeout(timer);
  }, [confirmed, fromId, toId]);
  const current = nodes.find(node => node.id === fromId);
  const next = nodes.find(node => node.id === toId);
  const toIndex = nodes.findIndex(node => node.id === toId);
  const returnNode = nodes.find(node => node.id === returnId);
  const topic = node => node?.topic || getStepTopicLabel(node?.label);
  const sameTopic = next && String(next.topicKey || topic(next)).toLowerCase() === String(current?.topicKey || topic(current)).toLowerCase();
  const heading = !confirmed ? (detour ? (fr ? 'Ajout d’une pratique ciblée…' : 'Adding focused practice…') : (fr ? 'Enregistrement de ta progression…' : 'Saving your progress…'))
    : isComplete ? (fr ? 'Séance terminée' : 'Session complete')
      : detour ? (fr ? 'Un petit détour pour travailler ce point' : 'A quick detour to practise this weak spot')
      : current?.detour && next ? (fr ? 'Pratique terminée. Retour au parcours.' : 'Practice complete. Back to your plan.')
      : !next ? (fr ? 'Ouverture de la suite du parcours' : 'Opening the next part of your plan')
        : sameTopic && current?.type === 'lesson' && next?.type === 'quiz'
          ? (fr ? 'Révision terminée. À toi de mettre en pratique.' : 'Review complete. Now try applying it.')
        : sameTopic ? (fr ? 'Prochaine étape sur ce sujet' : 'Next step on this topic')
          : (fr ? 'Passons au sujet suivant' : 'Moving to your next topic');
  return <section className={`plan-advance study-modal-plan-preview${confirmed ? ' is-confirmed' : ''}`} aria-label={fr ? 'Ton parcours' : 'Your study path'}>
    <h2 aria-live="polite">{heading}</h2>
    <p className="plan-advance__next">{detour ? (returnNode
      ? `${fr ? 'Puis retour au parcours' : 'Then back to your plan'}: ${formatNodeType(returnNode.type, t)} · ${topic(returnNode)}`
      : (fr ? 'Une dernière pratique ciblée avant de terminer.' : 'One focused practice step before you finish.'))
      : confirmed && next ? `${fr ? 'Ensuite' : 'Next'}: ${formatNodeType(next.type, t)} · ${topic(next)}` : '\u00a0'}</p>
    <PlanNextSteps nodes={nodes} reserveCount={reserveCount} progress={{ activeId: moved ? toId || fromId : fromId, completedId: moved ? fromId : null, detourId: detour ? toId : null, returnId }} />
    <p role="status">{confirmed && next ? (fr ? `Étape ${toIndex + 1} sur ${nodes.length}` : `Step ${toIndex + 1} of ${nodes.length}`) : '\u00a0'}</p>
    {confirmed && next && <div className="plan-advance__actions">
      <span role="status" className="plan-advance__preparing">
        {!ready && !error && <span className="plan-advance__loading-dots" aria-hidden="true"><i /><i /><i /></span>}
        {error ? (fr ? 'La préparation a échoué. Tu peux réessayer.' : 'Preparation failed. You can retry.')
        : ready ? (fr ? 'Prêt quand tu veux.' : 'Ready when you are.')
          : `${fr ? 'Préparation' : 'Preparing'}: ${formatNodeType(next.type, t)}…`}</span>
      {ready && onOpenNow && <button onClick={onOpenNow}>{error ? (fr ? 'Voir les options' : 'Show options') : (fr ? 'Ouvrir maintenant' : 'Open now')}</button>}
      {!ready && elapsed && onBack && <button onClick={onBack}>{fr ? 'Retour au parcours' : 'Back to plan'}</button>}
    </div>}
  </section>;
}
