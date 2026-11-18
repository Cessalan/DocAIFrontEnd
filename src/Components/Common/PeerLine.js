import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { quizPeerLine } from './peerFormatsModel';
import { FUNNEL, logFunnelStep } from '../../Services/FunnelService';
import './PeerLine.css';

/**
 * One line under the verdict of the question she just answered: how other
 * students do on this question type (peerFormatsModel.js has the rules).
 * Renders nothing when the rules say there is nothing to add.
 */
export default function PeerLine({ format, correct, surface = 'quiz' }) {
  const { t } = useTranslation();
  const line = quizPeerLine({ format, correct });
  const kind = line?.kind || null;
  const logged = useRef(false);
  useEffect(() => {
    if (!kind || logged.current) return;
    logged.current = true;
    logFunnelStep(FUNNEL.PEER_COMPARISON_VIEWED, { surface, kind, format: line.key, percent: line.percent });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  if (!line) return null;

  return <p className="peer-line">
    <svg className="peer-line__icon" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
      <circle cx="7" cy="7" r="3" /><path d="M1.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="14.5" cy="7.5" r="2.3" /><path d="M14.5 12.2c2.4 0 4 1.6 4 4" />
    </svg>
    <span>{t(line.kind === 'right' ? 'peer.quizRight' : 'peer.quizMissed',
      { percent: line.percent, typeIn: t(`peer.typeIn.${line.key}`) })}</span>
  </p>;
}
