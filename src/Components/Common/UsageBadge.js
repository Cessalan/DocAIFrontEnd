import React from 'react';
import { useTranslation } from 'react-i18next';
import './UsageBadge.css';

/**
 * UsageBadge
 * Small always-visible pill showing how many AI generations remain in the
 * current hourly window. Hidden for Pro (unlimited) users. Rendered globally
 * by UsageProvider so it appears on every screen (chat + study) without
 * threading props through the big container components.
 *
 * @param {boolean} isPro
 * @param {number} remaining
 * @param {number} limit
 * @param {number} msUntilReset
 * @param {() => void} [onClick]  - e.g. open the upgrade modal
 */
const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const UsageBadge = ({ isPro, remaining, limit, msUntilReset, onClick }) => {
  const { t } = useTranslation();

  // Pro users have no cap — nothing to show.
  if (isPro) return null;

  const blocked = remaining <= 0;

  return (
    <button
      type="button"
      className={`usage-badge ${blocked ? 'is-blocked' : ''}`}
      onClick={onClick}
      title={blocked
        ? t('usageBadge.blockedTitle', 'Out of questions — resets soon, or upgrade to skip the wait')
        : t('usageBadge.title', 'Questions left this hour')}
    >
      <span className="usage-badge-dot" aria-hidden="true">⚡</span>
      {blocked ? (
        <span className="usage-badge-text">
          {t('usageBadge.resetsIn', 'Resets in {{time}}', { time: formatCountdown(msUntilReset) })}
        </span>
      ) : (
        <span className="usage-badge-text">
          {t('usageBadge.remaining', '{{remaining}}/{{limit}} questions', { remaining, limit })}
        </span>
      )}
    </button>
  );
};

export default UsageBadge;
