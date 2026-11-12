import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { clarityEvent } from '../../Services/ClarityService';
import { loadClassSummary } from '../../Services/QuizShareService';
import './ShareSet.css';

/**
 * "3 classmates tried your set", on her plan overview.
 *
 * Hearing that it was used is the reason to send the next one, and the most
 * missed question is something she cannot learn alone. Counts only: never a
 * name, never anyone's score. Renders nothing until a classmate has finished.
 */
export default function ClassmatesNote({ chatId }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth() || {};
  const uid = currentUser?.uid;
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let live = true;
    setSummary(null);
    loadClassSummary(uid, chatId).then((result) => {
      if (!live || !result) return;
      setSummary(result);
      clarityEvent('share_class_note_shown', { classmates: result.completions, has_hardest: !!result.hardest });
    });
    return () => { live = false; };
  }, [uid, chatId]);

  if (!summary) return null;

  return (
    <div className="class-note" role="status">
      <span className="class-note__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </span>
      <div>
        <p className="class-note__title">
          {summary.topic
            ? t('shareSet.classTriedTopic', { count: summary.completions, topic: summary.topic })
            : t('shareSet.classTried', { count: summary.completions })}
        </p>
        {summary.hardest && (
          <p className="class-note__body">{t('shareSet.classHardest', { question: summary.hardest.question })}</p>
        )}
      </div>
    </div>
  );
}
