import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DrillTargetIcon from '../ExamDrill/DrillTargetIcon';

/**
 * BlockCompleteCard — the ending a study plan never used to have.
 *
 * Before the plan was capped, "finished" was unreachable: 2.2% of sessions
 * completed, and not one of the 108 plans longer than 14 nodes ever did. A
 * six-node block makes the finish real, and this card is what the student
 * lands on when they get there.
 *
 * It does two jobs, in this order: mark the achievement, then offer the next
 * block. The nodes are already planned and parked in `study.reserve`, so
 * extending costs no generation and charges no quota — the student is choosing
 * to continue, not being sold to mid-stride.
 *
 * Under both of those sits the drill. Offering it HERE is the point: at the
 * empty-chat door "test my exam readiness" is an abstract choice made by
 * someone who has uploaded nothing, and ~12% take it. After a finished block
 * the same offer answers a question she can actually ask — what did I still
 * miss — and the drill seeds its coverage from the plan's own topics, so it
 * costs no upload and no generation.
 *
 * @param {number} completedCount Nodes in the block they just finished.
 * @param {number} reserveCount   Nodes waiting. 0 means the whole path is done.
 * @param {Function} onExtend     Async; moves the next block onto the plan.
 * @param {Function} onDrillGaps  Opens the drill on this chat. Optional — the
 *                                card renders without it, as it did before.
 */
const BlockCompleteCard = ({ completedCount, reserveCount = 0, onExtend, onDrillGaps }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const nextSize = Math.min(reserveCount, 6);

  const handleExtend = async () => {
    if (busy || !onExtend) return;
    setBusy(true);
    setError(false);
    try {
      await onExtend();
    } catch (err) {
      console.error('Failed to extend study plan:', err);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="block-complete-card" role="status">
      <div className="block-complete-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
             strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h3 className="block-complete-title">{t('study.blockDoneTitle')}</h3>
      <p className="block-complete-body">
        {t('study.blockDoneBody', { count: completedCount })}
      </p>

      {reserveCount > 0 ? (
        <>
          <button
            type="button"
            className="block-complete-cta"
            onClick={handleExtend}
            disabled={busy}
          >
            {busy ? t('study.blockExtending') : t('study.blockExtend', { count: nextSize })}
          </button>
          {error && (
            <p className="block-complete-error" role="alert">
              {t('chat.retry', 'Retry')}
            </p>
          )}
        </>
      ) : (
        <p className="block-complete-body">{t('study.blockAllDone')}</p>
      )}

      {onDrillGaps && (
        <>
          <button
            type="button"
            className="block-complete-drill"
            onClick={onDrillGaps}
          >
            <span className="block-complete-drill__icon" aria-hidden="true">
              <DrillTargetIcon />
            </span>
            {t('study.blockDrillCta', 'Find my remaining gaps')}
          </button>
          <p className="block-complete-drill__note">
            {t('study.blockDrillNote', 'A short drill on everything you just covered')}
          </p>
        </>
      )}
    </div>
  );
};

export default BlockCompleteCard;
