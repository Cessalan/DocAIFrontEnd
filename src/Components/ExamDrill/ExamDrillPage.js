import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../Firebase/config';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { saveExamDate, noteExamDateAsked } from '../../Services/ExamDrillService';
import ExamDrill from './ExamDrill';
import DrillExamDate from './DrillExamDate';
import { DrillLoadingShell } from './DrillWriting';
import { devLog } from '../../Services/devLogger';
import './ExamDrill.css';
import DevUploadsPill from '../Common/DevUploadsPill';

/**
 * ExamDrillPage — route wrapper for /drill/:chatId.
 *
 * The drill is a full-screen surface with no sidebar by design: the exam
 * feeling comes from what is NOT on screen, and everything the app usually
 * offers (chat box, plan rail, upload button) is an invitation to stop
 * answering questions.
 *
 * Topics seed the drill's coverage map. They come from the chat's study plan
 * when it has one, but a plan is not required — with an empty topic pool the
 * generator still pulls from this chat's uploaded documents through the
 * vectorstore, which is the part that actually matters. Every paying user
 * uploaded their own course material within minutes of signing up; drilling
 * generic NCLEX content would throw away the reason they are here.
 *
 * THE EXAM DATE
 * ─────────────
 * Asked here, once, and only when we genuinely do not have one — see
 * DrillExamDate for why the drill asks at all.
 *
 * The drill upload asks it first (ChatInterface holds the navigation until she
 * answers, so there is no race with the redirect). This is the fallback that
 * catches everyone that path cannot reach: every drill created before the
 * question existed, and everyone arriving from the resume card rather than
 * from an upload. Both write the same `examDateAskedAt`, so whichever asks
 * first silences the other.
 */
const ExamDrillPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, userProfile, isLoading } = useAuth();

  const [topics, setTopics] = useState(null); // null = still loading
  const [denied, setDenied] = useState(false);
  const [chatMeta, setChatMeta] = useState(null); // { examDate, examDateAskedAt }
  const [dateHandled, setDateHandled] = useState(false); // answered or skipped, this visit

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!chatId || !currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'chats', chatId));
        if (cancelled) return;

        if (!snap.exists() || snap.data()?.userId !== currentUser.uid) {
          setDenied(true);
          return;
        }

        const data = snap.data();
        const planTopics = data?.study?.path?.topics || [];
        setTopics(planTopics.filter((x) => typeof x === 'string' && x.trim()));
        setChatMeta({
          examDate: data?.examDate || null,
          // Recorded at the document ROOT, never under `drill`: saveDrillState
          // rewrites that whole map on every answer, so a flag parked inside it
          // is erased by the student's next question.
          examDateAskedAt: data?.examDateAskedAt || null,
        });
        devLog('🎯 Drill topics:', planTopics.length);
      } catch (error) {
        console.error('❌ Could not load drill context:', error);
        if (!cancelled) {
          setTopics([]);
          // Never block the drill on a failed read — worst case we do not ask.
          setChatMeta({ examDate: null, examDateAskedAt: new Date().toISOString() });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [chatId, currentUser]);

  const handleExit = () => navigate(`/c/${chatId}`);

  const handleDateChosen = useCallback((key, customDate) => {
    setDateHandled(true);
    saveExamDate({ chatId, uid: currentUser?.uid, key, customDate });
  }, [chatId, currentUser]);

  const handleDateSkipped = useCallback(() => {
    setDateHandled(true);
    noteExamDateAsked(chatId);
  }, [chatId]);

  if (denied) {
    return (
      <div className="drill-page">
        <div className="drill-shell drill-shell--centered">
          <p className="drill-loading-text">
            {t('drill.notFound', 'That drill is not available.')}
          </p>
          <button className="drill-btn drill-btn--ghost" onClick={() => navigate('/c')} type="button">
            {t('drill.exit', 'Finish for now')}
          </button>
        </div>
      </div>
    );
  }

  // Identical to the drill's own loading state, so the handover between them
  // is invisible — the student sees one surface being prepared, not two.
  if (topics === null || !chatMeta) {
    return (
      <div className="drill-page">
        <DrillLoadingShell startup />
      </div>
    );
  }

  // `isLoading` gates the decision: the profile arrives a beat after the user,
  // and deciding without it would flash the question at a student who answered
  // it weeks ago on another chat.
  const knownExamDate = chatMeta.examDate || userProfile?.onboarding?.examDate || null;
  const askDate = !isLoading && !dateHandled && !knownExamDate && !chatMeta.examDateAskedAt;

  if (askDate) {
    return (
      <div className="drill-page">
        <DrillExamDate onSubmit={handleDateChosen} onSkip={handleDateSkipped} />
      </div>
    );
  }

  return (
    <div className="drill-page">
      <ExamDrill
        chatId={chatId}
        topics={topics}
        onExit={handleExit}
      />

      {/* Dev-only: download the source files this drill was built from. */}
      <DevUploadsPill chatId={chatId} />
    </div>
  );
};

export default ExamDrillPage;
