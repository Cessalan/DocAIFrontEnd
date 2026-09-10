import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Native modal top layer keeps focus inside, makes the chat inert, and avoids
// clipping by the message card's overflow/transform without duplicating tokens.
export default function CourseSourceDrawer({ title, onClose, children }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="cs-source-drawer" aria-modal="true" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header><h3 id={titleId}>{title}</h3><button type="button" onClick={onClose} aria-label={t('courseStudio.closeSources')}>×</button></header>
    <div className="cs-source-drawer-content">{children}</div>
  </dialog>;
}
