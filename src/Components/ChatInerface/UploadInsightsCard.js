import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { rankUploadTopics, PRIORITY_BANDS } from './uploadPriority';
import { FUNNEL, logFunnelStepOnce } from '../../Services/FunnelService';
import './UploadInsightsCard.css';

/**
 * UploadInsightsCard — the first thing she sees after an upload.
 *
 * WHAT IT REPLACES
 *
 * A four-button menu ("Quiz me / Flashcards / Break it down / Check my
 * understanding") shown at the moment of peak motivation. 34% of completed
 * uploads never became a plan, and a menu that asks the student to decide
 * what a tutor is for is the prime suspect.
 *
 * This card makes the decision instead. It reports what we found in her
 * material, ranks it, and offers exactly one way forward.
 *
 * THE ONE RULE
 *
 * Every line on this card has to be something we can actually defend. The
 * whole effect — "it read my notes" — is worth precisely as much as its
 * least true line, and a student who catches one invented claim stops
 * believing the plan we are about to sell her. So the reasons come from
 * uploadPriority, which cites what is in her document and says nothing when
 * it has nothing (see that file's header). This component renders reasons;
 * it never composes them.
 *
 * The banding is a RANKING within this upload, not a verdict on her
 * knowledge — the copy says "start here", never "you're weak on this".
 * It once could, from stored scores, and the number it quoted was wrong:
 * see the removal note in uploadPriority's header. This card no longer
 * receives past performance at all.
 */

const BAND_DOT = {
  high: '🔴',
  review: '🟡',
  foundation: '🟢',
};

const UploadInsightsCard = ({
  topics = [],
  insights = [],
  fileCount = 0,
  disabled = false,
  onContinue,
}) => {
  const { t } = useTranslation();

  const ranked = useMemo(
    () => rankUploadTopics({ topics, insights, max: 6 }),
    [topics, insights]
  );

  // Logged once per funnel: a card that re-renders four times would otherwise
  // report four views and understate every rate below it by 4x.
  useEffect(() => {
    logFunnelStepOnce(FUNNEL.INSIGHTS_VIEWED, {
      topicsFound: ranked.topics.length,
      highestRiskTopic: ranked.top?.topic || null,
    });
  }, [ranked]);

  // Group for display. Empty bands are dropped rather than rendered as an
  // empty heading — "NEEDS REVIEW (none)" is noise on a card whose whole job
  // is to look like it knows something.
  const groups = useMemo(
    () => PRIORITY_BANDS
      .map(band => ({ band, items: ranked.topics.filter(t => t.band === band) }))
      .filter(g => g.items.length > 0),
    [ranked]
  );

  if (ranked.topics.length === 0) {
    // No topics extracted. Say so plainly and still offer the way forward,
    // rather than showing a confident-looking empty map.
    return (
      <div className="upload-insights">
        <p className="upload-insights__headline">{t('uploadInsights.emptyHeadline')}</p>
        <p className="upload-insights__sub">{t('uploadInsights.emptySub')}</p>
        <button
          type="button"
          className="upload-insights__cta"
          onClick={onContinue}
          disabled={disabled}
        >
          <span>{t('uploadInsights.ctaGeneric')}</span>
          <span className="upload-insights__arrow" aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="upload-insights">
      <p className="upload-insights__eyebrow">{t('uploadInsights.eyebrow')}</p>

      <h3 className="upload-insights__headline">
        {t('uploadInsights.headline', {
          count: ranked.topics.length,
          files: fileCount,
        })}
      </h3>
      <p className="upload-insights__sub">
        {ranked.hasEvidence
          ? t('uploadInsights.subheadline', { count: ranked.counts.high })
          : t('uploadInsights.subheadlinePlain')}
      </p>

      {/* No coverage came back from the extractor, so there is nothing to rank
          on and nothing true to say about any single topic. Show the list and
          stop — a band heading here would be a judgement we cannot support,
          and the subtitle slot would have to be filled with an assertion.
          See uploadPriority's header for why this is the common case. */}
      {!ranked.hasEvidence && (
        <ul className="upload-insights__topics is-plain">
          {ranked.topics.map(item => (
            <li key={item.topic} className="upload-insights__topic">
              <span className="upload-insights__topic-name">{item.topic}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="upload-insights__map">
        {groups.map(({ band, items }) => (
          <section key={band} className={`upload-insights__band is-${band}`}>
            <h4 className="upload-insights__band-title">
              <span className="upload-insights__dot" aria-hidden="true">{BAND_DOT[band]}</span>
              {t(`uploadInsights.bands.${band}`)}
            </h4>
            <ul className="upload-insights__topics">
              {items.map(item => (
                <li key={item.topic} className="upload-insights__topic">
                  <span className="upload-insights__topic-name">{item.topic}</span>
                  {/* The reason is what turns a coloured list into evidence.
                      Rendered from a key the model chose — never composed here. */}
                  <span className="upload-insights__topic-reason">
                    {t(item.reason.key, item.reason.vars)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <button
        type="button"
        className="upload-insights__cta"
        onClick={onContinue}
        disabled={disabled}
      >
        {/* "Start with X" is a recommendation. We only make it when the
            ranking behind it is real; otherwise the neutral label, which
            promises a starting point without claiming this one is special. */}
        <span>
          {ranked.hasEvidence
            ? t('uploadInsights.cta', { topic: ranked.top.topic })
            : t('uploadInsights.ctaGeneric')}
        </span>
        <span className="upload-insights__arrow" aria-hidden="true">→</span>
      </button>
    </div>
  );
};

export default UploadInsightsCard;
