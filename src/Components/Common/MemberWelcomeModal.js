import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import { FASTER_QUIZZES_ANNOUNCEMENT_ID } from '../../config/productAnnouncements';
import useDialogFocus from './useDialogFocus';
import './MemberWelcomeModal.css';

const BenefitIcon = ({ kind }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'practice' && <path d="M6 8a4 4 0 1 0 0 8c4 0 8-8 12-8a4 4 0 0 1 0 8c-4 0-8-8-12-8Z" />}
    {kind === 'plans' && <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-11 5 2 2 4-4" /></>}
    {kind === 'notes' && <><path d="M8 3h8l4 4v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm7 0v5h5M9 12h7m-7 4h5" /></>}
  </svg>
);

export default function MemberWelcomeModal({ onClose }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const dialog = useRef(null);
  const heading = useRef(null);
  const speedSeen = useRef(false);
  const close = () => onClose({ seenAnnouncementIds: speedSeen.current ? [FASTER_QUIZZES_ANNOUNCEMENT_ID] : [] });
  useDialogFocus(dialog, close);
  useEffect(() => {
    heading.current?.focus();
    if (step === 1) speedSeen.current = true;
  }, [step]);
  const copy = (key) => t(`memberWelcome.${key}`);

  return createPortal(
    <div className="member-welcome-overlay">
      <section ref={dialog} className={`member-welcome ${step === 1 ? 'member-welcome--surprise' : ''}`} role="dialog" aria-modal="true" aria-labelledby="member-welcome-title" aria-describedby="member-welcome-body">
        <button className="member-welcome-close" onClick={close} aria-label={copy('close')}>×</button>
        <div className="member-welcome-content" key={step}>
          <div className="member-welcome-art" aria-hidden="true">
            <NurseQuizMascot size={step === 1 ? 142 : 110} isExcited />
            {step === 1 && <span className="member-welcome-bolt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z" /></svg></span>}
          </div>
          <p className="member-welcome-label">{copy(step === 0 ? 'label' : 'surpriseLabel')}</p>
          <h2 id="member-welcome-title" ref={heading} tabIndex={-1}>{copy(step === 0 ? 'title' : 'surpriseTitle')}</h2>
          <p id="member-welcome-body" className="member-welcome-intro">{copy(step === 0 ? 'body' : 'surpriseBody')}</p>
          {step === 0 ? <ul className="member-welcome-benefits">
            {['practice', 'plans', 'notes'].map((kind) => <li key={kind}>
              <span className="member-welcome-icon"><BenefitIcon kind={kind} /></span>
              <div><h3>{copy(`${kind}Title`)}</h3><p>{copy(`${kind}Body`)}</p></div>
            </li>)}
          </ul> : <p className="member-welcome-included"><span aria-hidden="true">✓</span> {copy('included')}</p>}
        </div>
        <footer className="member-welcome-footer">
          <div className="member-welcome-progress" role="img" aria-label={t('memberWelcome.progress', { step: step + 1, total: 2 })}>
            {[0, 1].map((index) => <span key={index} className={index === step ? 'active' : ''} />)}
          </div>
          <button className="member-welcome-primary" onClick={step === 0 ? () => setStep(1) : close}>{copy(step === 0 ? 'next' : 'finish')} <span aria-hidden="true">→</span></button>
          {step === 1 && <button className="member-welcome-back" onClick={() => setStep(0)}>{copy('back')}</button>}
        </footer>
      </section>
    </div>, document.body
  );
}
