import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildKnowledgeMap } from './knowledgeMapModel';
import { buildNarration, revealedAt } from './knowledgeNarration';
import { useTypedBeats } from './useTypedBeats';
import './KnowledgeMap.css';

/**
 * KnowledgeMap — the screen the whole diagnostic is paying for.
 *
 * Target reaction, written down so it can be judged rather than admired:
 * ***"Holy shit. It actually understands me."***
 *
 * REBUILT as a narration. The first version was three labelled sections —
 * "You're strong in", "You need to work on", "Your path" — stacked and
 * arriving in a single frame, with one human sentence at the bottom. It felt
 * robotic, and the reasons were structural rather than cosmetic:
 *
 *   · Two bulleted lists with headings is the shape of a REPORT. A tutor who
 *     had just watched you answer six questions would not hand you a document.
 *   · The one warm sentence sat UNDERNEATH the data, which made the data the
 *     point and the warmth decoration.
 *   · Everything arrived AT ONCE. A reveal is a sequence; if the whole finding
 *     is on screen in one frame then nothing was revealed, it was already
 *     there — which means it was prepared in advance, which means it is not
 *     about her.
 *
 * So now she is talked to, and the evidence lands as it is mentioned:
 * strengths appear while the sentence naming them is still typing, gaps appear
 * on the beat that introduces them, and the deadline and plan close it out in
 * the same voice the dashboard uses.
 *
 * Two things that must survive future edits:
 *   · STRENGTHS FIRST. Opening on what she got wrong repeats the emotional
 *     mistake the diagnostic just spent six questions avoiding.
 *   · NO PERCENTAGES. The instant a number appears beside a topic she starts
 *     grading herself and stops reading the sentence next to it.
 *
 * And the CTA is never gated on the typing finishing. A student in a hurry
 * must always be able to leave for her plan.
 */
const KnowledgeMap = ({
  answers = [],
  hardestTopics = [],
  examName,
  daysToExam,
  onContinue,
  busy = false,
  voicedLines = null,
}) => {
  const { t } = useTranslation();

  const map = useMemo(
    () => buildKnowledgeMap(answers, hardestTopics),
    [answers, hardestTopics]
  );

  const beats = useMemo(
    () => buildNarration(map, daysToExam, examName),
    [map, daysToExam, examName]
  );

  const lines = useMemo(() => {
    const templated = beats.map((b) => t(b.key, b.fallback, b.params));
    /* Voiced lines are a rewrite of exactly these, produced upstream and
       already validated server-side (no invented numbers, every topic name
       intact). The length check is the last guard: these map onto beats by
       INDEX to decide which evidence appears under which sentence, so a
       mismatch would put the wrong notes under the wrong line. */
    if (Array.isArray(voicedLines) && voicedLines.length === templated.length) {
      return voicedLines;
    }
    return templated;
  }, [beats, t, voicedLines]);

  const { shown, stage, done, skip } = useTypedBeats(lines);

  const visible = useMemo(
    () => revealedAt(beats, done ? beats.length - 1 : stage),
    [beats, stage, done]
  );

  if (!map.hasEvidence) return null;

  const { strong, needsWork } = map;
  const rendered = done ? lines : shown;

  /* Evidence line for a topic she has. Names what she got right, because
     "you know this" with nothing behind it is a compliment, and a compliment
     is not the same as being seen. */
  const strongEvidence = (topic) =>
    topic.got.length
      ? t('map.strongEvidence', 'You had {{concepts}}.', {
          concepts: topic.got.slice(0, 2).join(t('map.and', ' and ')),
        })
      : null;

  const workEvidence = (topic) =>
    topic.missed.length
      ? topic.missed.slice(0, 2).join(t('map.and', ' and '))
      : null;

  const renderList = (topics, kind) => (
    <ul className="kmap__list">
      {topics.map((topic, i) => (
        <li
          key={topic.topic}
          className={`kmap__item kmap__item--${kind}`}
          /* Staggered so the notes land one after another rather than as a
             block. Capped so a long list never keeps her waiting. */
          style={{ animationDelay: `${Math.min(i, 4) * 90}ms` }}
        >
          <span className={`kmap__mark kmap__mark--${kind}`} aria-hidden="true" />
          <div className="kmap__itemBody">
            <p className="kmap__itemName">{topic.topic}</p>
            {kind === 'strong' ? (
              strongEvidence(topic) && (
                <p className="kmap__itemEvidence">{strongEvidence(topic)}</p>
              )
            ) : workEvidence(topic) ? (
              <p className="kmap__itemEvidence">
                {t('map.workEvidence', 'Specifically: {{concepts}}.', {
                  concepts: workEvidence(topic),
                })}
              </p>
            ) : (
              <p className="kmap__itemEvidence">
                {t('map.workEvidenceGeneric', 'We haven’t proven this one yet.')}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  /* Beats render in place, with the evidence for a beat slotted directly
     beneath the sentence that introduces it — which is what makes this read
     as one continuous thought rather than narration bolted onto a table. */
  return (
    <div
      className="kmap"
      onClick={done ? undefined : skip}
      role="region"
      aria-label={t('map.eyebrow', 'Here’s where you stand')}
    >
      <div className="kmap__stream" aria-live="polite">
        {rendered.map((line, i) => {
          const beat = beats[i];
          const isLast = i === rendered.length - 1;
          return (
            <React.Fragment key={beat?.key || i}>
              <p
                className={
                  'kmap__line' +
                  (beat?.key === 'narration.contradiction' ? ' is-twist' : '') +
                  (i === 0 ? ' is-open' : '')
                }
              >
                {line}
                {!done && isLast && <span className="kmap__caret" aria-hidden="true" />}
              </p>

              {beat?.reveals === 'strong' && visible.has('strong') && (
                <div className="kmap__reveal">{renderList(strong, 'strong')}</div>
              )}
              {beat?.reveals === 'work' && visible.has('work') && (
                <div className="kmap__reveal">{renderList(needsWork, 'work')}</div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <button
        type="button"
        className={`kmap__cta${done ? ' is-ready' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onContinue?.();
        }}
        disabled={busy}
      >
        {busy
          ? t('map.ctaBusy', 'Building your path…')
          : t('map.cta', 'Show me the plan')}
      </button>
    </div>
  );
};

export default KnowledgeMap;
