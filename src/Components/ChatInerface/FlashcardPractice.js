import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import StudyPathMascot from '../QuizRoom/StudyPathMascot';
import ChatSendButton from './ChatSendButton';
import { toDisplayText } from './flashcardText';
import { cleanCardTopic, deckTitle, initialCardReview, startCardSession, rateCard, includeStreamedCards } from './flashcardReviewModel';
import { askFlashcardTutor, saveFlashcardReview } from '../../Services/FlashcardPracticeService';
import './FlashcardPractice.css';
import { paperContour } from './paperTransition';

function CardsIcon() {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="7" width="18" height="22" rx="3" transform="rotate(7 17 18)" /><rect x="5" y="3" width="18" height="22" rx="3" fill="var(--fc-paper)" /><path d="M9 10h10M9 14h7M9 18h9" /></svg>;
}

export default function FlashcardPractice({ message, cards, chatId, files = [], readOnly = false }) {
  const { i18n } = useTranslation();
  const fr = i18n.language?.startsWith('fr');
  const words = (en, french) => fr ? french : en;
  const title = deckTitle(message, cards, words('Your study notes', 'Tes notes de cours'));
  const rawSource = message.sourceName || (files.length === 1 ? files[0]?.filename || files[0]?.name : '');
  const source = typeof rawSource === 'string' ? rawSource.split(/[\\/]/).pop() : '';
  const [review, setReview] = useState(() => initialCardReview(cards, message.flashcardReview));
  const [now, setNow] = useState(Date.now);
  const stateRef = useRef(review);
  const [launchOrigin, setLaunchOrigin] = useState(null);
  const [opening, setOpening] = useState(false);
  const [open, setOpen] = useState(false), [closing, setClosing] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false), [draft, setDraft] = useState(''), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [saveStatus, setSaveStatus] = useState('');
  const dirty = useRef(false), chain = useRef(Promise.resolve()), controller = useRef(null);
  const dialog = useRef(null), launcher = useRef(null), discussion = useRef(null), mounted = useRef(true);
  const update = useCallback(value => {
    const next = typeof value === 'function' ? value(stateRef.current) : value;
    if (next === stateRef.current) return;
    stateRef.current = next; dirty.current = true; setReview(next);
  }, []);
  const persist = useCallback(() => {
    if (!dirty.current || readOnly || message.isStreaming || !chatId) return chain.current;
    const snapshot = stateRef.current; dirty.current = false;
    setSaveStatus('saving');
    chain.current = chain.current.catch(() => {}).then(() => saveFlashcardReview(chatId, message.id, snapshot))
      .then(() => { if (mounted.current) setSaveStatus('saved'); })
      .catch(() => { dirty.current = true; if (mounted.current) setSaveStatus('error'); });
    return chain.current;
  }, [readOnly, message.isStreaming, chatId, message.id]);
  useEffect(() => { const timer = setTimeout(persist, 350); return () => clearTimeout(timer); }, [review, persist]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => () => { persist(); }, [persist]);
  useEffect(() => { if (open) update(state => includeStreamedCards(state, cards.length)); }, [cards.length, open, update]);
  const session = review.session;
  const index = session?.queue[session.cursor];
  const card = cards[index];
  const revealed = !!session?.revealed;
  const complete = !!session?.complete && !message.isStreaming;
  const historyKey = `${index}:${revealed ? 'answer' : 'hint'}`;
  const history = review.discussions[historyKey] || [];
  const isRetry = !!session?.repeated.includes(index) && session.queue.indexOf(index) < session.cursor;
  const ratings = Object.values(review.ratings);
  const got = ratings.filter(r => r.rating === 'got').length;
  const weak = cards.length - got;
  const due = cards.filter((_, i) => !review.ratings[i] || (review.ratings[i].nextReviewAt && Date.parse(review.ratings[i].nextReviewAt) <= now)).length;
  const first = Object.values(session?.firstRatings || {});
  const firstGot = first.filter(r => r === 'got').length;
  const topic = cleanCardTopic(card?.topic);
  const minutes = Math.max(1, Math.ceil(cards.length * .35));
  const nextDue = ratings.map(r => Date.parse(r.nextReviewAt)).filter(Number.isFinite).sort((a, b) => a - b)[0];
  const dueLabel = due > 0 || !nextDue ? words(`${due} ready to review`, `${due} à revoir maintenant`) :
    words('Next review: ', 'Prochaine révision : ') + new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(nextDue);
  useEffect(() => {
    if (!nextDue || nextDue <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(nextDue - now + 50, 2147483647));
    return () => clearTimeout(timer);
  }, [nextDue, now]);

  const close = useCallback(() => {
    if (closing) return;
    persist(); controller.current?.abort(); setBusy(false);
    setClosing(true);
  }, [closing, persist]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => { setOpen(false); setClosing(false); launcher.current?.focus(); }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 620);
    return () => clearTimeout(timer);
  }, [closing]);
  useEffect(() => {
    if (!open) return;
    const root = dialog.current;
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter(el => el !== root);
    const prior = siblings.map(el => el.hasAttribute('inert'));
    siblings.forEach(el => el.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    root.focus();
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(root.querySelectorAll('button:not(:disabled), textarea:not(:disabled), a[href]')).filter(el => el.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const firstControl = controls[0], lastControl = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === firstControl || document.activeElement === root)) { event.preventDefault(); lastControl.focus(); }
      else if (!event.shiftKey && (document.activeElement === lastControl || document.activeElement === root)) { event.preventDefault(); firstControl.focus(); }
    };
    root.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; siblings.forEach((el, i) => { if (!prior[i]) el.removeAttribute('inert'); }); root.removeEventListener('keydown', key); launcher.current?.focus(); };
  }, [open, close]);
  useEffect(() => { controller.current?.abort(); setBusy(false); setDraft(''); setError(''); }, [index, revealed]);
  useEffect(() => { if (discussion.current) discussion.current.scrollTop = discussion.current.scrollHeight; }, [history.length, busy, tutorOpen]);
  useEffect(() => {
    const pane = dialog.current?.querySelector('.fc-workspace');
    if (pane) pane.scrollTop = 0;
  }, [session?.cursor]);
  useEffect(() => {
    if (tutorOpen && window.matchMedia?.('(max-width: 900px)').matches) {
      dialog.current?.querySelector('.fc-tutor')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }, [tutorOpen]);

  function launch(mode) {
    if (mode || !stateRef.current.session || stateRef.current.session.complete) {
      update(state => startCardSession(cards, state, mode || (due > 0 ? 'due' : 'all')));
    }
    if (!open) {
      setLaunchOrigin(launcher.current?.closest('.fc-launch')?.getBoundingClientRect());
      setOpening(true);
    }
    setTutorOpen(false); setOpen(true);
  }
  function rate(rating) { update(state => rateCard(state, rating)); }
  async function send(value = draft) {
    if (!value.trim() || busy || !card || readOnly || message.isStreaming) return;
    const key = historyKey;
    const abort = new AbortController(); controller.current = abort;
    const add = turn => update(state => ({ ...state, discussions: { ...state.discussions, [key]: [...(state.discussions[key] || []), turn] } }));
    setTutorOpen(true); setBusy(true); setError(''); setDraft('');
    add({ role: 'user', content: value });
    try {
      const response = await askFlashcardTutor({ chat_id: chatId, message_id: message.id, card_index: index,
        revealed, message: value, history: history.slice(-8), language: i18n.language }, abort.signal);
      if (!abort.signal.aborted) add({ role: 'assistant', content: response.reply });
    } catch (err) { if (!abort.signal.aborted) { setError(words('Your tutor could not reply. Please try again.', 'Ton tuteur n’a pas pu répondre. Réessaie.')); setDraft(value); } }
    finally { if (controller.current === abort) { setBusy(false); controller.current = null; } }
  }

  const origin = launchOrigin || { left: 0, top: 0, width: 1, height: 1 };
  const width = document.documentElement.clientWidth || window.innerWidth;
  const height = window.innerHeight;
  const originStyle = {
    '--practice-paper-source': paperContour(origin.left, origin.left + origin.width, origin.top, origin.top + origin.height, origin.left, origin.left + origin.width, 22),
    '--practice-paper-bend': paperContour(0, width, 0, Math.max(origin.top + origin.height, height * .76), origin.left, origin.left + origin.width, 18),
    '--practice-paper-full': paperContour(0, width, 0, height, 0, width, 0),
  };
  return <>
    <article className="fc-launch fc-theme">
      <span className="fc-tape" aria-hidden="true" />
      <div className="fc-launch-heading"><span className="fc-deck-icon"><CardsIcon /></span><div><span className="fc-handwritten">{words('a little recall goes a long way…', 'un peu de rappel, ça reste…')}</span><h3>{title}</h3></div></div>
      <p className="fc-launch-meta">{cards.length} {words(cards.length === 1 ? 'card' : 'cards', cards.length === 1 ? 'carte' : 'cartes')} · {message.isStreaming ? words('Still preparing your deck…', 'Préparation en cours…') : words(`About ${minutes} min`, `Environ ${minutes} min`)}</p>
      {source && <p className="fc-source" title={source}>{words('From', 'D’après')} {source}</p>}
      {complete && <div className="fc-inline-recap"><strong>{words(`${firstGot}/${first.length} felt solid on the first pass.`, `${firstGot}/${first.length} bien retenues au premier passage.`)}</strong><span>{weak ? words(`${weak} to revisit. A short review will help.`, `${weak} à revoir. Un petit rappel fera du bien.`) : words('All felt familiar. Come back when they’re due.', 'Tout semblait familier. Reviens pour le prochain rappel.')}</span></div>}
      <div className="fc-launch-footer"><span>{ratings.length ? dueLabel : words('Try recalling it before you peek.', 'Essaie de te rappeler avant de regarder.')}</span><button ref={launcher} type="button" className="fc-primary" disabled={!cards.length} onClick={() => launch()}>{session && !session.complete ? words('Resume review', 'Reprendre') : ratings.length ? words('Review cards', 'Revoir les cartes') : words('Start review', 'Commencer')} <span aria-hidden="true">↗</span></button></div>
    </article>
    {open && createPortal(<section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={words('Flashcard review', 'Révision des cartes')} style={originStyle} onAnimationEnd={event => {
      if (event.target !== event.currentTarget) return;
      if (event.animationName === 'fc-room-open') setOpening(false);
      if (event.animationName === 'fc-room-close') { setOpen(false); setClosing(false); }
    }} className={`fc-room fc-theme ${closing ? 'fc-closing' : opening ? 'fc-opening' : ''}`}>
      <header className="fc-room-header"><div className="fc-header-title"><CardsIcon /><div><span className="fc-eyebrow">{words('A moment to remember', 'Un moment pour retenir')}</span><strong>{title}</strong></div></div><button type="button" className="fc-quiet" onClick={close}>← {words('Back to chat', 'Retour au chat')}</button></header>
      {saveStatus === 'error' && <div className="fc-save-error" role="alert">{words('Your progress hasn’t synced. Keep this tab open and retry.', 'Ta progression n’est pas synchronisée. Garde cet onglet ouvert et réessaie.')} <button onClick={persist}>{words('Retry save', 'Réessayer')}</button></div>}
      {readOnly && <p className="fc-preview-note">{words('Preview of this deck. Progress and tutoring are available in your own conversations.', 'Aperçu de ce jeu. La progression et le tutorat sont disponibles dans tes conversations.')}</p>}
      <div className={`fc-workspace ${tutorOpen && !complete ? 'fc-with-tutor' : ''}`}>
        <main className="fc-study">
          {complete ? <div className="fc-finish"><StudyPathMascot size={80} /><span className="fc-handwritten">{words('one little step, remembered.', 'un petit pas de plus.')}</span><h2>{words('That’s your review.', 'Voilà ta révision.')}</h2><p>{words(`${firstGot} of ${first.length} felt solid on the first pass.`, `${firstGot} sur ${first.length} bien retenues au premier passage.`)}</p><div className="fc-results">{[['got', words('Got it', 'Retenu')], ['almost', words('Almost', 'Presque')], ['again', words('To revisit', 'À revoir')]].map(([value, label]) => <div key={value}><strong>{ratings.filter(r => r.rating === value).length}</strong><span>{label}</span></div>)}</div><p className="fc-muted">{weak ? words('Let the tricky ones settle, then give them another try.', 'Laisse les notions difficiles se poser, puis réessaie.') : words('A good first step. Recalling it again tomorrow will help it stick.', 'Un bon premier pas. Un rappel demain aidera à retenir.')}</p><div className="fc-finish-actions">{weak > 0 && <button className="fc-primary" onClick={() => launch('weak')}>{words(`Revisit ${weak} cards`, `Revoir ${weak} cartes`)} ↗</button>}<button className="fc-secondary" onClick={() => launch('all')}>{words('Review all', 'Tout revoir')}</button><button className="fc-quiet" onClick={close}>{words('Back to chat', 'Retour au chat')} →</button></div><p className="fc-footnote">{words('Based on your own recall ratings. Next review dates are saved with this deck.', 'Selon tes propres évaluations. Les prochaines dates de révision sont enregistrées dans ce jeu.')}</p></div> : <>
            <div className="fc-session-meta"><span>{session?.repeated.includes(index) && session.queue.indexOf(index) < session.cursor ? words('One more try', 'Encore un essai') : words(`Card ${(index ?? 0) + 1} of ${cards.length}`, `Carte ${(index ?? 0) + 1} sur ${cards.length}`)}</span><span>{Object.keys(session?.firstRatings || {}).length}/{cards.length} {words('reviewed', 'revues')}</span></div>
            <div className="fc-progress" role="progressbar" aria-label={words('Cards reviewed', 'Cartes revues')} aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={Object.keys(session?.firstRatings || {}).length}><span style={{ width: `${cards.length ? Object.keys(session?.firstRatings || {}).length / cards.length * 100 : 0}%` }} /></div>
            {card ? <div className={`fc-paper-stack ${revealed ? 'fc-revealed' : ''}`} key={`${index}:${session.cursor}`}>
              <div className="fc-paper-turner">
                <article className="fc-paper fc-paper-front" aria-hidden={revealed}>
                  <span className="fc-tape" aria-hidden="true" />
                  <div className="fc-paper-top"><span className="fc-eyebrow">{words('Take a breath. Think it through.', 'Prends ton temps. Réfléchis.')}</span><span className="fc-card-number">{String(index + 1).padStart(2, '0')}</span></div>
                  {topic && <p className="fc-topic">{topic}</p>}
                  <h2 className="fc-question">{toDisplayText(card.front)}</h2>
                  <div className="fc-paper-bottom"><span>{words('Say it in your head, or out loud.', 'Dis-le dans ta tête, ou à voix haute.')}</span><span aria-hidden="true">✧</span></div>
                </article>
                <article className="fc-paper fc-paper-back" aria-hidden={!revealed}>
                  {revealed && <>
                    <div className="fc-paper-top"><span className="fc-eyebrow">{words('The idea to keep', 'L’idée à retenir')}</span><span className="fc-card-number">{String(index + 1).padStart(2, '0')}</span></div>
                    {topic && <p className="fc-topic">{topic}</p>}
                    <p className="fc-question-reminder">{toDisplayText(card.front)}</p>
                    <div className="fc-answer"><ReactMarkdown>{toDisplayText(card.back)}</ReactMarkdown></div>
                    <div className="fc-paper-bottom"><span>{words('Be honest with yourself. That’s how it sticks.', 'Sois honnête avec toi-même. C’est comme ça qu’on retient.')}</span><span aria-hidden="true">✧</span></div>
                  </>}
                </article>
              </div>
            </div> : <div className="fc-loading" role="status"><span /><span /><span /><p>{words('Finishing your next cards…', 'Préparation des prochaines cartes…')}</p></div>}
            {card && <div className="fc-controls">{!revealed ? <><button type="button" className="fc-primary fc-reveal" onClick={() => update(state => ({ ...state, session: { ...state.session, revealed: true } }))}>{words('Reveal answer', 'Voir la réponse')} <span aria-hidden="true">↻</span></button><button type="button" className="fc-quiet" disabled={readOnly || busy || message.isStreaming} onClick={() => send(words('Give me a small hint without revealing the answer.', 'Donne-moi un petit indice sans révéler la réponse.'))}>{words('A little hint?', 'Un petit indice ?')}</button></> : <><p className="fc-rating-label">{words('How did that feel?', 'Comment ça s’est passé ?')}</p><div className="fc-ratings">{[['again', '↻', words('Again', 'À revoir'), isRetry ? words('Review in 10 minutes', 'Revoir dans 10 minutes') : words('Try again this round', 'Réessayer dans ce tour')], ['almost', '≈', words('Almost', 'Presque'), isRetry ? words('Review tomorrow', 'Revoir demain') : words('One more try, then tomorrow', 'Un essai, puis demain')], ['got', '✓', words('Got it', 'Retenu'), words('Save for a later review', 'Garder pour plus tard')]].map(([value, symbol, label, detail]) => <button key={value} type="button" className={`fc-rate fc-rate-${value}`} onClick={() => rate(value)}><span aria-hidden="true">{symbol}</span><strong>{label}</strong><small>{detail}</small></button>)}</div></>}
            <button type="button" className="fc-tutor-toggle" onClick={() => setTutorOpen(value => !value)}><StudyPathMascot size={28} />{tutorOpen ? words('Close discussion', 'Fermer la discussion') : words('Talk it through', 'On en parle ?')} <span aria-hidden="true">{tutorOpen ? '−' : '+'}</span></button></div>}
            <p className="fc-footnote">{saveStatus === 'saving' ? words('Saving…', 'Enregistrement…') : readOnly ? words('Preview', 'Aperçu') : words('Pick up where you leave off. Your progress stays with this deck.', 'Reprends là où tu t’arrêtes. Ta progression reste dans ce jeu.')}</p>
          </>}
        </main>
        {tutorOpen && !complete && <aside className="fc-tutor" aria-label={words('Card tutor', 'Tuteur de la carte')}><header><StudyPathMascot size={42} /><div><strong>{words('Your tutor', 'Ton tuteur')}</strong><span>{revealed ? words('Let’s make it click.', 'On va éclaircir ça.') : words('A nudge, without giving it away.', 'Un coup de pouce, sans la réponse.')}</span></div><button className="fc-quiet" onClick={() => setTutorOpen(false)} aria-label={words('Close tutor', 'Fermer le tuteur')}>×</button></header><div className="fc-discussion" ref={discussion}>
          {!history.length && <div className="fc-tutor-empty"><span className="fc-handwritten">{words('let’s untangle it together.', 'on démêle ça ensemble.')}</span><p>{revealed ? words('Ask about the answer, a word, or a connection you want to remember.', 'Pose une question sur la réponse, un mot ou un lien à retenir.') : words('Which part feels unclear? We can unpack the question before you reveal it.', 'Quelle partie est floue ? On peut clarifier la question avant de la retourner.')}</p><button className="fc-secondary" disabled={readOnly || busy || message.isStreaming} onClick={() => send(revealed ? words('Explain this in simpler words.', 'Explique avec des mots simples.') : words('Help me understand what this question is asking.', 'Aide-moi à comprendre ce que la question demande.'))}>{words('Make it simpler', 'Plus simplement')}</button></div>}
          {history.map((turn, i) => <div key={i} className={`fc-turn fc-turn-${turn.role}`}><ReactMarkdown>{turn.content}</ReactMarkdown></div>)}
          {busy && <div className="fc-tutor-thinking" role="status">{words('Thinking with you', 'On réfléchit ensemble')}<span> · · ·</span></div>}
          {error && <p role="alert" className="fc-error">{error}</p>}
        </div><form className="fc-composer" onSubmit={event => { event.preventDefault(); send(); }}><label htmlFor={`fc-input-${message.id}`}>{words(`About card ${(index ?? 0) + 1}`, `À propos de la carte ${(index ?? 0) + 1}`)}</label><div><textarea id={`fc-input-${message.id}`} value={draft} rows={2} disabled={readOnly || message.isStreaming} placeholder={words('Ask your tutor…', 'Demande à ton tuteur…')} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} /><ChatSendButton disabled={readOnly || message.isStreaming || !draft.trim() || !card} busy={busy} label={words('Send', 'Envoyer')} /></div>{message.isStreaming && <small>{words('Tutoring opens when your deck is saved.', 'Le tutorat s’ouvre quand le jeu est enregistré.')}</small>}</form></aside>}
      </div>
    </section>, document.body)}
  </>;
}
