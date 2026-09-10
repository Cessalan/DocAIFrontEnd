import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CONFIDENCE,
  priorityRows,
  recommendedStart,
  hasPublicFindings,
  emptyResearchReason,
} from './courseIntelligenceModel';
import {
  DocumentsIcon,
  InstructorIcon,
  ExamIcon,
  LibraryIcon,
  LinkIcon,
  SparkIcon,
} from './CourseIntelligenceIcons';
import { FUNNEL, logFunnelStepOnce } from '../../Services/FunnelService';
import './CourseIntelligenceReport.css';

/**
 * CourseIntelligenceReport — what the investigation found.
 *
 * THE ONE RULE, AGAIN
 * ───────────────────
 * Every claim on this card is either something she gave us, something we can
 * link to, or something explicitly labelled as a pattern we noticed. There is
 * no fourth category and no unlabelled assertion. The confidence badge is not
 * decoration; it is the reason a student can trust the two lines that are
 * badged verified, and the reason we are allowed to show the ones that are
 * not.
 *
 * The phrasing rules that follow from that, and that reviewers should hold
 * this file to:
 *
 *   VERIFIED   states a fact.        "Appears in 3 of your 4 files."
 *   PUBLIC     attributes a source.  "Your instructor's public profile lists…"
 *   INFERENCE  hedges, always.       "Appears repeatedly across your materials."
 *
 * Never "your professor will test this". Never "this will be on the exam".
 * The moment this card predicts an exam it becomes a promise we cannot keep,
 * and a student who is failed by it was failed by us specifically.
 *
 * SECTIONS DISAPPEAR RATHER THAN EMPTY OUT
 * ────────────────────────────────────────
 * Each block below returns null when its section is missing. There is no
 * "we couldn't find anything about your instructor" card, because a card
 * about an absence is still a card about her professor. The single line at
 * the bottom covers the whole empty case, once.
 */

export const ConfidenceBadge = ({ level, t }) => {
  if (!level) return null;
  return (
    <span className={`ci-badge ci-badge--${level}`}>
      <span className="ci-badge__dot" aria-hidden="true" />
      {t(`courseIntel.confidence.${level}`)}
    </span>
  );
};

const Citations = ({ citations = [], t }) => {
  if (!citations.length) return null;
  return (
    <ul className="ci-cites">
      {citations.slice(0, 3).map(c => (
        <li key={c.url}>
          <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="ci-cites__link">
            <LinkIcon size={12} />
            <span>{c.host || c.title}</span>
          </a>
        </li>
      ))}
      {citations.length > 3 && (
        <li className="ci-cites__more">
          {t('courseIntel.moreSources', { count: citations.length - 3, defaultValue: '+{{count}} more' })}
        </li>
      )}
    </ul>
  );
};

const CourseIntelligenceReport = ({ report, onContinue, disabled = false, embedded = false }) => {
  const { t } = useTranslation();

  const rows = useMemo(() => {
    if (!report) return [];
    // Missing exam context is not a finding. Keep material evidence visible
    // without repeating the model's absence-of-description text.
    const hasExamContext = Boolean(report.context?.examDescription?.trim());
    return priorityRows({ ...report, priorityTopics: report.priorityTopics.map(row => ({
      ...row,
      evidence: row.evidence.filter(item => hasExamContext || item.source !== 'exam_description'),
    })) }, 5);
  }, [report]);
  const start = useMemo(() => recommendedStart(report), [report]);
  const emptyReason = useMemo(() => emptyResearchReason(report), [report]);

  useEffect(() => {
    if (!embedded) logFunnelStepOnce(FUNNEL.REPORT_VIEWED, {
      researchFound: hasPublicFindings(report),
      priorityCount: rows.length,
      hasExam: Boolean(report && report.exam),
    });
  }, [report, rows.length, embedded]);

  if (!report) return null;

  const { context, materials, course, instructor, resources, exam } = report;
  const examRows = context.examDescription?.trim() && exam?.coverage?.length
    ? rows.filter(row => row.signals.exam_relevance > 0 && row.evidence.some(item => item.source === 'exam_description'))
    : [];
  const courseLabel = [context.courseCode, context.courseName].filter(Boolean).join(' · ');

  return (
    <article className={`ci-report${embedded ? ' ci-report--embedded' : ''}`}>
      <header className="ci-report__header">
        <span className="ci-report__eyebrow">
          <SparkIcon size={14} />
          {t('courseIntel.report.eyebrow', 'I investigated your course')}
        </span>
        {courseLabel && <h3 className="ci-report__title">{courseLabel}</h3>}
        {context.school && <p className="ci-report__school">{context.school}</p>}
        {!courseLabel && (
          <h3 className="ci-report__title">
            {t('courseIntel.report.titleMaterialsOnly', 'What your material is about')}
          </h3>
        )}
      </header>

      {/* ── Her material. Always first, always verified. ─────────────── */}
      {rows.length > 0 && (
        <section className="ci-block">
          <h4 className="ci-block__title">
            <DocumentsIcon size={16} />
            {t('courseIntel.report.focusTitle', 'Your course focuses on')}
            <ConfidenceBadge level={CONFIDENCE.VERIFIED} t={t} />
          </h4>
          <ol className="ci-focus">
            {rows.slice(0, 3).map(row => (
              <li key={row.topic} className={`ci-focus__item is-${row.band}`}>
                <span className="ci-focus__rank" aria-hidden="true">{row.rank}</span>
                <span className="ci-focus__body">
                  <span className="ci-focus__topic">{row.topic}</span>
                  {row.lead && (
                    <span className={`ci-focus__reason is-${row.lead.confidence}`}>
                      {row.lead.text}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="ci-block__foot">
            {t('courseIntel.report.materialsFoot', {
              topics: materials.topicCount || rows.length,
              files: materials.fileCount,
              defaultValue: 'Counted across {{topics}} topics in {{files}} of your files.',
            })}
          </p>
        </section>
      )}

      {/* ── Her exam, in her own words, structured. ──────────────────── */}
      {exam && (
        <section className="ci-block">
          <h4 className="ci-block__title">
            <ExamIcon size={16} />
            {exam.type || t('courseIntel.report.examTitle', 'Your upcoming exam')}
            <ConfidenceBadge level={CONFIDENCE.VERIFIED} t={t} />
          </h4>
          <p className="ci-block__lead">
            {t('courseIntel.report.examLead', 'Based on your description:')}
          </p>
          {exam.coverage.length > 0 && (
            <>
              <p className="ci-block__subhead">{t('courseIntel.report.examCoverage', 'Primary coverage')}</p>
              <ul className="ci-list">
                {exam.coverage.map(item => <li key={item}>{item}</li>)}
              </ul>
            </>
          )}
          {exam.formats.length > 0 && (
            <>
              <p className="ci-block__subhead">{t('courseIntel.report.examFormat', 'Expected format')}</p>
              <ul className="ci-list">
                {exam.formats.map(item => <li key={item}>{item}</li>)}
              </ul>
            </>
          )}
          {/* What she did NOT tell us, said out loud. A report that lists only
              what it knows invites the reader to assume it knows the rest. */}
          {exam.unstated.length > 0 && (
            <p className="ci-block__foot ci-block__foot--muted">
              {t('courseIntel.report.examUnstated', {
                items: exam.unstated.join(', '),
                defaultValue: "Your description doesn't say: {{items}}.",
              })}
            </p>
          )}
        </section>
      )}

      {/* ── Public course page. Only when we can link to it. ─────────── */}
      {course && (
        <section className="ci-block">
          <h4 className="ci-block__title">
            <LibraryIcon size={16} />
            {t('courseIntel.report.courseTitle', 'Your course, publicly')}
            <ConfidenceBadge level={course.confidence} t={t} />
          </h4>
          {course.officialName && <p className="ci-block__lead">{course.officialName}</p>}
          {course.department && <p className="ci-block__meta">{course.department}</p>}
          {course.description && <p className="ci-block__text">{course.description}</p>}
          {course.objectives.length > 0 && (
            <>
              <p className="ci-block__subhead">
                {t('courseIntel.report.objectives', 'Published learning objectives')}
              </p>
              <ul className="ci-list">
                {course.objectives.slice(0, 4).map(o => <li key={o}>{o}</li>)}
              </ul>
            </>
          )}
          <Citations citations={course.citations} t={t} />
        </section>
      )}

      {/* ── Instructor. Professional context, never a character sketch.
             Rendered only when the model returned a verifiable role, and
             every line here is attributed to a public profile rather than
             asserted. See the schema note in the backend service. ─────── */}
      {instructor && (
        <section className="ci-block">
          <h4 className="ci-block__title">
            <InstructorIcon size={16} />
            {t('courseIntel.report.instructorTitle', 'Instructor context')}
            <ConfidenceBadge level={instructor.confidence} t={t} />
          </h4>
          <p className="ci-block__lead">
            {t('courseIntel.report.instructorLead', 'Publicly available information indicates:')}
          </p>
          <ul className="ci-list">
            {instructor.title && (
              <li>
                {instructor.department
                  ? `${instructor.title} — ${instructor.department}`
                  : instructor.title}
              </li>
            )}
            {instructor.specialties.length > 0 && (
              <li>
                {t('courseIntel.report.instructorSpecialty', {
                  areas: instructor.specialties.join(', '),
                  defaultValue: 'Professional experience in {{areas}}',
                })}
              </li>
            )}
            {instructor.research.length > 0 && (
              <li>
                {t('courseIntel.report.instructorResearch', {
                  areas: instructor.research.join(', '),
                  defaultValue: 'Research interests: {{areas}}',
                })}
              </li>
            )}
          </ul>
          <p className="ci-block__foot ci-block__foot--muted">
            {t(
              'courseIntel.report.instructorCaveat',
              'Useful background only. Your uploaded material remains the basis for your plan.'
            )}
          </p>
          <Citations citations={instructor.citations} t={t} />
        </section>
      )}

      {/* ── Public resources. ────────────────────────────────────────── */}
      {resources && (
        <section className="ci-block">
          <h4 className="ci-block__title">
            <LibraryIcon size={16} />
            {t('courseIntel.report.resourcesTitle', 'Public resources worth knowing about')}
            <ConfidenceBadge level={CONFIDENCE.PUBLIC} t={t} />
          </h4>
          <ul className="ci-resources">
            {resources.resources.map(r => (
              <li key={r.url} className="ci-resources__item">
                <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">
                  <span className="ci-resources__title">{r.title}</span>
                  <span className="ci-resources__host">{r.host}</span>
                </a>
                {r.why && <span className="ci-resources__why">{r.why}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Priority. The only section that is openly an inference, and it
             says so in its own heading. ─────────────────────────────── */}
      {examRows.length > 0 && (
        <section className="ci-block ci-block--priority">
          <h4 className="ci-block__title">
            <SparkIcon size={16} />
            {t('courseIntel.report.priorityTitle', 'What deserves your attention')}
            <ConfidenceBadge level={CONFIDENCE.INFERENCE} t={t} />
          </h4>
          <p className="ci-block__lead">
            {t(
              'courseIntel.report.priorityLead',
              'Ranked by how your exam description lines up with your own materials.'
            )}
          </p>
          <ol className="ci-priority">
            {examRows.map(row => (
              <li key={row.topic} className="ci-priority__row">
                <span className="ci-priority__score" aria-hidden="true">{row.rank}</span>
                <span className="ci-priority__body">
                  <span className="ci-priority__topic">{row.topic}</span>
                  {row.evidence.slice(0, 2).map(e => (
                    <span key={e.text} className={`ci-priority__evidence is-${e.confidence}`}>
                      {e.text}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── The empty case. One line, no apology, no error styling. ──── */}
      {emptyReason && (
        <p className="ci-report__empty">
          {t(`courseIntel.report.empty.${emptyReason}`)}
        </p>
      )}

      {!embedded && start && (
        <p className="ci-report__handoff">
          {t('courseIntel.report.handoff', {
            topic: start.topic,
            defaultValue: 'Your plan will start with {{topic}}.',
          })}
        </p>
      )}

      {!embedded && <button
        type="button"
        className="ci-report__cta"
        onClick={onContinue}
        disabled={disabled}
      >
        <span>{t('courseIntel.report.cta', 'Show me my plan')}</span>
        <span className="ci-report__arrow" aria-hidden="true">→</span>
      </button>}
    </article>
  );
};

export default CourseIntelligenceReport;
