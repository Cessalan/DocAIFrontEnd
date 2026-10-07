import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import useDialogFocus from './useDialogFocus';
import './MemberWelcomeModal.css';

export default function ProductAnnouncementModal({ announcement, onClose }) {
  const { t } = useTranslation();
  const dialog = useRef(null);
  const heading = useRef(null);
  useDialogFocus(dialog, onClose);
  useEffect(() => { heading.current?.focus(); }, [announcement.id]);
  const copy = (key) => t(`productAnnouncements.${announcement.copyKey}.${key}`);

  return createPortal(
    <div className="member-welcome-overlay">
      <section ref={dialog} className="member-welcome member-welcome--surprise" role="dialog" aria-modal="true" aria-labelledby="product-announcement-title" aria-describedby="product-announcement-body">
        <button className="member-welcome-close" onClick={onClose} aria-label={t('productAnnouncements.close')}>×</button>
        <div className="member-welcome-content">
          <div className="member-welcome-art" aria-hidden="true"><NurseQuizMascot size={142} isExcited /></div>
          <p className="member-welcome-label">{t('productAnnouncements.label')}</p>
          <h2 ref={heading} tabIndex={-1} id="product-announcement-title">{copy('title')}</h2>
          <p id="product-announcement-body" className="member-welcome-intro">{copy('body')} {copy('detail')}</p>
          <p className="member-welcome-included"><span aria-hidden="true">✓</span> {copy('included')}</p>
        </div>
        <div className="member-welcome-footer">
          <button className="member-welcome-primary" onClick={onClose}>{t('productAnnouncements.continue')} <span aria-hidden="true">→</span></button>
        </div>
      </section>
    </div>, document.body
  );
}
