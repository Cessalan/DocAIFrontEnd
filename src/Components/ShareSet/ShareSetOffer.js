import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { clarityEvent } from '../../Services/ClarityService';
import { copyToClipboard, createShareSet, updateShareVisibility } from '../../Services/QuizShareService';
import { canOfferShare, firstName, shareableQuestions, shortenTopic } from './shareSetModel';
import './ShareSet.css';

/**
 * "Studying with classmates?" on a result screen, and the sheet it opens.
 *
 * One quiet row under the next-step button: it never opens by itself and never
 * sits above the decision she came to make. See shareSetModel.js for the rules.
 *
 * The link is created when the sheet opens, not when she taps Share: the
 * system share sheet only opens inside a tap, and a network write in between
 * loses that on Safari. Her two switches then update the same link.
 */
export default function ShareSetOffer({ questions, topic, score, chatId, nodeId, surface = 'plan_result', viewOnly = false, createLink = createShareSet }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const offered = useRef(false);
  const count = useMemo(() => shareableQuestions(questions).length, [questions]);
  const show = canOfferShare({ questions, viewOnly });

  useEffect(() => {
    if (!show || offered.current) return;
    offered.current = true;
    clarityEvent('share_offered', { surface, questions: count });
  }, [show, surface, count]);

  if (!show) return null;

  return (
    <>
      <div className="share-offer">
        <div className="share-offer__copy">
          <p className="share-offer__title">{t('shareSet.offerTitle')}</p>
          <p className="share-offer__body">{t('shareSet.offerBody', { count })}</p>
        </div>
        <button type="button" className="share-offer__btn" onClick={() => { clarityEvent('share_sheet_opened', { surface }); setOpen(true); }}>
          <SendIcon />
          {t('shareSet.offerButton')}
        </button>
      </div>
      {open && (
        <ShareSetSheet
          questions={questions} topic={topic} score={score} chatId={chatId} nodeId={nodeId}
          surface={surface} count={count} createLink={createLink} onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * "Share" in the header of a quiz or mini-test, usable at any point in the
 * round (owner, 2026-11-11: she should not have to finish first). There is no
 * score yet, so the sheet offers no score switch. Same link, same sheet.
 */
export function ShareSetButton({ questions, topic, chatId, nodeId, surface = 'in_round', viewOnly = false, className = '' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const count = useMemo(() => shareableQuestions(questions).length, [questions]);
  if (!canOfferShare({ questions, viewOnly })) return null;

  return (
    <>
      <button type="button" className={`share-inline-btn ${className}`.trim()} title={t('shareSet.offerButton')}
        onClick={() => { clarityEvent('share_sheet_opened', { surface }); setOpen(true); }}>
        <SendIcon />
        <span>{t('shareSet.share')}</span>
      </button>
      {open && (
        <ShareSetSheet
          questions={questions} topic={topic} score={null} chatId={chatId} nodeId={nodeId}
          surface={surface} count={count} createLink={createShareSet} onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareSetSheet({ questions, topic, score, chatId, nodeId, surface, count, createLink, onClose }) {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth() || {};
  const name = firstName(currentUser?.displayName);
  const [link, setLink] = useState(null);
  const [failed, setFailed] = useState(false);
  const [showName, setShowName] = useState(!!name);
  const [includeScore, setIncludeScore] = useState(false);
  const [copied, setCopied] = useState('');
  const started = useRef(false);
  const closeRef = useRef(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const create = () => {
    setFailed(false);
    createLink({
      uid: currentUser?.uid, chatId, nodeId, questions, topic, senderName: name, score,
      showName, includeScore, language: i18n.language || 'en',
    })
      .then((created) => { setLink(created); clarityEvent('share_link_created', { surface, questions: created.totalQuestions }); })
      .catch((error) => { console.error('Could not create the shared set:', error); setFailed(true); });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create();
    closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = (next) => {
    const state = { showName, includeScore, ...next };
    setShowName(state.showName);
    setIncludeScore(state.includeScore);
    if (link) updateShareVisibility(link.shareId, { senderName: name, score, ...state }).catch(() => {});
  };

  // Written in her voice, short enough to read in a group chat. A long topic
  // ("Systematic Patient Evaluation in Emergency Care") is cut at a word.
  const shortTopic = shortenTopic(topic);
  const minutes = Math.max(1, Math.round(count * 0.75));
  const message = shortTopic
    ? t('shareSet.message', { count, topic: shortTopic, minutes })
    : t('shareSet.messageNoTopic', { count, minutes });

  const flash = (what) => { setCopied(what); window.setTimeout(() => setCopied(''), 2200); };

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ text: message, url: link.url });
      clarityEvent('share_sent', { surface, method: 'native' });
    } catch { /* She closed the system sheet. Nothing was sent, so nothing is logged. */ }
  };

  const copy = async (what) => {
    if (!link) return;
    const ok = await copyToClipboard(what === 'message' ? `${message}\n${link.url}` : link.url);
    if (!ok) return;
    flash(what);
    clarityEvent('share_sent', { surface, method: what === 'message' ? 'copy_message' : 'copy_link' });
  };

  return createPortal(
    <div className="share-sheet-overlay" onClick={onClose}>
      <div className="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" ref={closeRef} className="share-sheet__close" onClick={onClose} aria-label={t('shareSet.close')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <p className="share-sheet__eyebrow">{t('shareSet.sheetEyebrow')}</p>
        <h2 id="share-sheet-title" className="share-sheet__title">
          {topic ? t('shareSet.sheetTitle', { count, topic }) : t('shareSet.sheetTitleNoTopic', { count })}
        </h2>

        <div className="share-sheet__note">
          <p className="share-sheet__message">{message}</p>
          <p className={`share-sheet__link${link ? '' : ' is-pending'}`} aria-live="polite">
            {link ? link.url.replace(/^https?:\/\//, '') : failed ? t('shareSet.linkFailed') : t('shareSet.linkPending')}
          </p>
          {failed && <button type="button" className="share-sheet__retry" onClick={create}>{t('shareSet.retry')}</button>}
        </div>

        <div className="share-sheet__switches">
          {name && (
            <Switch id="share-show-name" checked={showName} onChange={(value) => change({ showName: value })}
              label={t('shareSet.showName', { name })} />
          )}
          {score?.total > 0 && (
            <Switch id="share-include-score" checked={includeScore} onChange={(value) => change({ includeScore: value })}
              label={t('shareSet.includeScore', { got: score.got, total: score.total })} />
          )}
        </div>

        <p className="share-sheet__privacy">{t('shareSet.privacy')}</p>

        <div className="share-sheet__actions">
          {canNativeShare && (
            <button type="button" className="share-sheet__primary" onClick={share} disabled={!link}>
              <SendIcon />{t('shareSet.share')}
            </button>
          )}
          <button type="button" className={canNativeShare ? 'share-sheet__secondary' : 'share-sheet__primary'} onClick={() => copy('message')} disabled={!link}>
            {copied === 'message' ? t('shareSet.copied') : t('shareSet.copyMessage')}
          </button>
          <button type="button" className="share-sheet__secondary" onClick={() => copy('link')} disabled={!link}>
            {copied === 'link' ? t('shareSet.copied') : t('shareSet.copyLink')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Switch({ id, checked, onChange, label }) {
  return (
    <label className="share-switch" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="share-switch__track" aria-hidden="true" />
    </label>
  );
}

export function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}
