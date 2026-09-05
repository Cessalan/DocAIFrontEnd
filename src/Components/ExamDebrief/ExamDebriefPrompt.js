import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ExamDebriefModal from './ExamDebriefModal';
import { atTurnLimit } from './examDebriefConversation';
import { EXAM_DEBRIEF_DEV_OPEN } from './devTrigger';
import {
  findPendingExamDebrief,
  loadStudyContext,
  nextDebriefMessage,
  markExamDebriefHandled,
  saveExamDebrief
} from '../../Services/ExamDebriefService';

/**
 * ExamDebriefPrompt — decides when to open the post-exam conversation, drives
 * its turns, and owns every write it produces.
 *
 * The modal is deliberately dumb: it renders a transcript and reports what she
 * typed. Everything that talks to the backend or to Firestore is here, so the
 * modal stays testable and the write order — save what she said, then ask what
 * to say next — is decided in one place.
 *
 * DESIGN NOTES
 *
 *  - Raised once per app load, tracked in a module-level flag rather than
 *    state. This mounts in the app shell, which remounts on navigation between
 *    chats; without the flag a student who dismissed the popup would meet it
 *    again on her next click, before the dismissal had finished writing.
 *
 *  - OPEN_DELAY_MS lets the app paint first. A modal that beats the interface
 *    it is covering reads as an interstitial ad and gets closed the same way —
 *    reflexively, before it has been read.
 *
 *  - The exam is marked handled the moment she says her FIRST thing, not when
 *    the conversation ends. She has already given us the answer that matters
 *    most, and a closed tab mid-conversation must not put the question back in
 *    the queue.
 *
 *  - Every turn is saved as it happens, refining one row. Most conversations
 *    end by being closed rather than finished, and a save-at-the-end design
 *    would systematically lose the debriefs of the students who had the worst
 *    exams — the ones who answer once and go.
 *
 *  - A failed turn closes the conversation warmly rather than showing an error.
 *    Everything she said up to that point is already written.
 */

/** Once per app load, whatever remounts underneath. */
let raisedThisSession = false;

/** Long enough for the shell to paint and settle before anything covers it. */
const OPEN_DELAY_MS = 2500;

/**
 * Dev-only preview, in the same shape as `nqDevFreeLimit`. Without it this can
 * only be seen by having actually sat an exam the app knows about, which makes
 * a copy change or a dark-mode check a multi-day round trip. In a development
 * build, from the console:
 *
 *   localStorage.nqDevExamDebrief = 'Pharmacology'   // fake a named exam
 *   localStorage.nqDevExamDebrief = '1'              // fake an unnamed one
 *   delete localStorage.nqDevExamDebrief             // back to real data
 *
 * The conversation it produces is real — this fakes the trigger, not the model
 * — but nothing is marked handled, so it can be reopened. Rows written this way
 * carry `context.devPreview` and are dropped by the dashboard rollup. Ignored
 * entirely in production builds.
 */
const DEV_PREVIEW_KEY = 'nqDevExamDebrief';

const devPreviewExam = () => {
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const raw = window.localStorage.getItem(DEV_PREVIEW_KEY);
    if (!raw) return null;
    const date = new Date(Date.now() - 2 * 86400000);
    return {
      key: 'dev-preview',
      label: raw === '1' || raw === 'true' ? null : raw,
      date,
      day: null,
      daysAgo: 2,
      isThisWeek: true,
      devPreview: true
    };
  } catch {
    return null;
  }
};

const ExamDebriefPrompt = ({ uid }) => {
  const { t, i18n } = useTranslation();

  const [exam, setExam] = useState(null);
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // The row this conversation is writing into, so each turn refines it instead
  // of inserting a second, half-empty row. Held as the PROMISE of the previous
  // save: she can send her next message well inside the round trip.
  const savePromiseRef = useRef(null);
  const studyContextRef = useRef(null);

  /* `t` is read through a ref, and the open effect below depends on `uid`
     ALONE. react-i18next hands back a new `t` identity when the language
     resource tree settles, and with `t` in the dependency array that re-ran the
     effect — whose cleanup clears the pending timer. The modal then restarted
     its 2.5s delay on every such change, and in the worst case never opened at
     all. Nothing here needs the newest `t`: the opener is read once, at the
     moment the timer fires. */
  const translateRef = useRef(t);
  translateRef.current = t;

  /**
   * Open the conversation on a given exam, from a clean slate.
   *
   * The one place a conversation starts — the login trigger and the dev pill
   * both come through here, so a conversation opened for review is the same
   * object in the same state as one opened for real.
   */
  const openConversation = useCallback((pending) => {
    savePromiseRef.current = null;
    setExam(pending);
    setIsDone(false);
    setIsThinking(false);
    // The opening line is ours, not the model's: it must be on screen the
    // instant this opens, and it is the same sentence every time anyway.
    setMessages([
      {
        role: 'assistant',
        content: pending.label
          ? translateRef.current(
              'examDebrief.openerNamed',
              'Hey! Welcome back 👋 You had your {{exam}} exam recently. How did it go?',
              { exam: pending.label }
            )
          : translateRef.current(
              'examDebrief.opener',
              'Hey! Welcome back 👋 You had your exam recently. How did it go?'
            )
      }
    ]);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!uid || raisedThisSession) return undefined;

    let cancelled = false;
    let timer = null;

    (async () => {
      const pending = devPreviewExam() || (await findPendingExamDebrief(uid));
      if (cancelled || !pending) return;

      // Fetched while the delay runs, so the tutor's first real question
      // already knows what her plan covered.
      loadStudyContext(pending).then((context) => {
        studyContextRef.current = context;
      });

      timer = setTimeout(() => {
        if (cancelled) return;
        raisedThisSession = true;
        openConversation(pending);
      }, OPEN_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [uid, openConversation]);

  /**
   * Dev pill: open on demand, bypassing the trigger, the delay and the
   * once-per-session flag. Never registered outside development.
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;

    const onDevOpen = async (event) => {
      const { label = 'Pharmacology', useReal = false } = event.detail || {};

      let pending;
      if (useReal) {
        pending = await findPendingExamDebrief(uid);
        if (!pending) {
          // findPendingExamDebrief already devLogs which gate failed.
          console.warn('[dev] No real exam is pending a debrief for this account.');
          return;
        }
      } else {
        pending = {
          key: 'dev-preview',
          examId: null,
          label: label || null,
          date: new Date(Date.now() - 2 * 86400000),
          day: null,
          daysAgo: 2,
          isThisWeek: true,
          devPreview: true
        };
      }

      studyContextRef.current = await loadStudyContext(pending);
      openConversation(pending);
    };

    window.addEventListener(EXAM_DEBRIEF_DEV_OPEN, onDevOpen);
    return () => window.removeEventListener(EXAM_DEBRIEF_DEV_OPEN, onDevOpen);
  }, [uid, openConversation]);

  /** Save this turn, or refine the row an earlier turn already opened. */
  const persist = useCallback(
    async (insights, transcript) => {
      const previous = await savePromiseRef.current;
      const pending = saveExamDebrief({
        exam,
        insights,
        messages: transcript,
        signalId: previous?.signalId,
        locale: i18n.language
      });
      savePromiseRef.current = pending;
      return pending;
    },
    [exam, i18n.language]
  );

  const handleSend = useCallback(
    async (text) => {
      const withReply = [...messages, { role: 'user', content: text }];
      const isFirstAnswer = messages.every((m) => m.role !== 'user');

      setMessages(withReply);
      setIsThinking(true);

      // She has taken part. Whatever happens next, this exam is never raised
      // again — including if she closes the tab mid-answer.
      if (isFirstAnswer && !exam.devPreview) {
        markExamDebriefHandled(uid, exam, 'answered');
      }

      try {
        const turn = await nextDebriefMessage({
          messages: withReply,
          exam,
          studyContext: studyContextRef.current,
          locale: i18n.language
        });

        const withTutor = [...withReply, { role: 'assistant', content: turn.reply }];
        setMessages(withTutor);
        setIsDone(Boolean(turn.done) || atTurnLimit(withTutor));
        persist(turn.insights, withTutor);
      } catch (error) {
        /* In production: close warmly. She has just walked out of an exam and
           an error dialog helps nobody; what she already said is saved, and the
           only thing lost is a follow-up.

           In development: say so, loudly. This closing line is the ONLY reply a
           broken backend ever produces, and it is indistinguishable from a real
           one — which cost a whole round of testing to a backend that had not
           been restarted and was 404ing every turn. A failure path that looks
           exactly like success is worse than no failure path. */
        console.error('Exam debrief turn failed:', error);

        const isDev = process.env.NODE_ENV === 'development';
        setMessages([
          ...withReply,
          {
            role: 'assistant',
            content: isDev
              ? `⚠️ DEV: the debrief backend did not answer — ${
                  error?.message || 'unknown error'
                }. This is NOT the tutor talking. Check that NQBackEnd2 is running with POST /exam-debrief/turn (restart it if it predates that endpoint).`
              : translateRef.current(
                  'examDebrief.closing',
                  'Thank you — this is genuinely helpful. Feedback like this helps us improve the preparation for your next exam and for other students too ❤️'
                )
          }
        ]);
        setIsDone(true);
      } finally {
        setIsThinking(false);
      }
    },
    [messages, exam, uid, i18n.language, persist]
  );

  // Closed without saying anything. Recorded as a dismissal rather than left
  // pending: a skip is an answer to "do you want to talk about this", and
  // asking again would be the app arguing with it.
  const handleDismiss = useCallback(() => {
    if (!exam.devPreview) markExamDebriefHandled(uid, exam, 'dismissed');
    setVisible(false);
  }, [uid, exam]);

  const handleClose = useCallback(() => setVisible(false), []);

  if (!visible || !exam) return null;

  return (
    <ExamDebriefModal
      exam={exam}
      messages={messages}
      isThinking={isThinking}
      isDone={isDone}
      onSend={handleSend}
      onDismiss={handleDismiss}
      onClose={handleClose}
    />
  );
};

export default ExamDebriefPrompt;
