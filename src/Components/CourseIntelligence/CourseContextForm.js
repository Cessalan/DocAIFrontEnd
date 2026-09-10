import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DatePicker from '../Common/DatePicker';
import { CalendarIcon } from '../ChatInerface/PlanOnboardingIcons';
import { CourseStudioHeader, StudioFiles } from './CourseStudioFrame';
import { FUNNEL, logFunnelStep, logFunnelStepOnce } from '../../Services/FunnelService';
import './CourseStudio.css';

/**
 * CourseContextForm — four questions about her class, asked while her files
 * are still uploading.
 *
 * WHY IT IS SAFE TO ASK QUESTIONS HERE
 * ────────────────────────────────────
 * This product has a measured, expensive history with pre-value questions:
 * of 3,208 uploads, 26.6% answered the first one when three of them stood
 * between the upload and any generated content. That finding is why
 * PlanOnboarding was inverted, and it has not been repealed.
 *
 * What changed is the cost, not the principle. This form runs CONCURRENTLY
 * with document processing — the parse, the insight extraction and the
 * embedding are all in flight above it — so it occupies time the student was
 * already going to spend waiting. It is not a step in front of the value; it
 * is something to do during one.
 *
 * Three things keep it that way, and each one should be defended:
 *
 *   1. NOTHING BLOCKS. Every field can be left empty, and `Skip` is a
 *      first-class exit, not a link hidden under the button. A skipped form
 *      produces a report built from her materials alone, which is a supported
 *      path — see emptyResearchReason in courseIntelligenceModel.
 *
 *   2. IT DOES NOT ADD AN ASK. The exam date used to be its own screen after
 *      the first lesson. It lives here now, so the flow has the same number
 *      of questions it had yesterday, in one place, at a cheaper moment.
 *
 *   3. IT SAYS WHY. Each field carries the thing it unlocks. "School" alone
 *      is administrative; "so I can look up your actual course" is a trade.
 *
 * If the funnel says otherwise once this is live, the fix is to move this
 * form after the insights card, not to make the fields required.
 */

const FIELDS = ['school', 'course', 'professor', 'examDescription'];

// Free-text fields are capped before they reach the wire. The exam
// description is the only long one and it is a description, not an essay —
// past a few hundred characters the model is reading her lecture notes back
// to itself.
const MAX_SHORT = 120;
const MAX_LONG = 600;

const clamp = (value, max) => (value || '').replace(/\s+/g, ' ').trimStart().slice(0, max);

/**
 * Split "NURS 234 - Pharmacology" into a code and a name.
 *
 * One field is asked, two are sent, because a student writes her course the
 * way her timetable writes it and the search behaves very differently for
 * "NURS 234" than for "Pharmacology". Guessing here is safe: both halves end
 * up in the same query, so a wrong split costs nothing, while forcing her to
 * fill two boxes costs a field.
 */
export const splitCourse = (raw) => {
  const value = (raw || '').replace(/\s+/g, ' ').trim();
  if (!value) return { courseCode: '', courseName: '' };

  const separated = value.match(/^(.{2,20}?)\s*[-–—:|·]\s*(.+)$/);
  if (separated) {
    return { courseCode: separated[1].trim(), courseName: separated[2].trim() };
  }
  // "NURS 234 Pharmacology" — a code is letters then digits, optionally spaced.
  const inline = value.match(/^([A-Za-z]{2,6}\s?-?\s?\d{2,4}[A-Za-z]?)\s+(.{2,})$/);
  if (inline) {
    return { courseCode: inline[1].trim(), courseName: inline[2].trim() };
  }
  // A bare code with nothing after it is a code; anything else is a name.
  if (/^[A-Za-z]{2,6}\s?-?\s?\d{2,4}[A-Za-z]?$/.test(value)) {
    return { courseCode: value, courseName: '' };
  }
  return { courseCode: '', courseName: value };
};

const CourseContextForm = ({
  language = 'en',
  fileCount = 0,
  filenames = [],
  uploading = false,
  disabled = false,
  initialValues = {},
  onSubmit,
  onSkip,
}) => {
  const { t } = useTranslation();

  const [values, setValues] = useState(() => ({
    school: initialValues.school || '',
    course: initialValues.course || [initialValues.courseCode, initialValues.courseName].filter(Boolean).join(' · ') || '',
    professor: initialValues.professor || '',
    examDescription: initialValues.examDescription || '',
  }));
  const [examDate, setExamDate] = useState(initialValues.examDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dateAnchorRef = useRef(null);

  React.useEffect(() => {
    logFunnelStepOnce(FUNNEL.COURSE_CONTEXT_SHOWN, { fileCount });
  }, [fileCount]);

  const setField = useCallback((field, raw) => {
    setValues(prev => ({
      ...prev,
      [field]: clamp(raw, field === 'examDescription' ? MAX_LONG : MAX_SHORT),
    }));
  }, []);

  const filledCount = useMemo(
    () => FIELDS.filter(f => (values[f] || '').trim().length > 0).length,
    [values]
  );

  // What the student is told she will get. Honest about the difference: a
  // course we can look up is a different promise from a course we cannot.
  const promise = useMemo(() => {
    if (filledCount === 0) return 'none';
    if (values.school && values.course) return 'full';
    return 'partial';
  }, [filledCount, values.school, values.course]);

  const dateLabel = useMemo(() => {
    if (!examDate) return null;
    const d = new Date(`${examDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const locale = (language || 'en').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [examDate, language]);

  const buildContext = useCallback(() => {
    const { courseCode, courseName } = splitCourse(values.course);
    return {
      school: values.school.trim(),
      courseCode,
      courseName,
      professor: values.professor.trim(),
      examDescription: values.examDescription.trim(),
      examDate: examDate || null,
    };
  }, [values, examDate]);

  const handleSubmit = (event) => {
    if (event) event.preventDefault();
    if (disabled || submitted) return;
    setSubmitted(true);
    logFunnelStep(FUNNEL.COURSE_CONTEXT_SUBMITTED, {
      fieldsFilled: filledCount,
      hasExamDate: Boolean(examDate),
      promise,
    });
    onSubmit && onSubmit(buildContext());
  };

  const handleSkip = () => {
    if (disabled || submitted) return;
    setSubmitted(true);
    logFunnelStep(FUNNEL.COURSE_CONTEXT_SKIPPED, { fieldsFilled: filledCount });
    // A skip still sends whatever she typed before changing her mind. Throwing
    // away two filled fields because she did not want to fill the third would
    // make the research worse for no reason.
    (onSkip || onSubmit) && (onSkip || onSubmit)(buildContext());
  };

  return (
    <form className="cs-shell cs-context" onSubmit={handleSubmit} noValidate>
      <CourseStudioHeader context={{ course: values.course }} />
      <div className="cs-body">
        <div className="cs-section-heading">
          <span className="cs-kicker cs-accent">{t('courseStudio.setup')}</span>
          <h3 className="cs-title">{t('courseStudio.contextTitle')}</h3>
          <p className="cs-sub">{t('courseStudio.contextSub')}</p>
        </div>
        <StudioFiles filenames={filenames} fileCount={fileCount} processing={uploading} />
        <div className="cs-form-grid">
          <label className="cs-field">
            <span>{t('courseStudio.course')} <small>{t('courseStudio.optional')}</small></span>
            <input className="course-context__input" type="text" value={values.course} onChange={e => setField('course', e.target.value)}
              placeholder={t('courseStudio.coursePlaceholder')} disabled={disabled || submitted} maxLength={MAX_SHORT} />
          </label>
          <div className="cs-field">
            <span>{t('courseStudio.examDate')} <small>{t('courseStudio.optional')}</small></span>
            <button ref={dateAnchorRef} type="button" className="course-context__date-chip cs-date-button" disabled={disabled || submitted}
              onClick={() => setShowDatePicker(s => !s)} aria-haspopup="dialog" aria-expanded={showDatePicker}>
              <CalendarIcon width="16" height="16" />{dateLabel || t('courseStudio.addDate')}
            </button>
            {showDatePicker && <DatePicker value={examDate} onChange={value => { setExamDate(value); setShowDatePicker(false); }}
              minDate={new Date()} onClose={() => setShowDatePicker(false)} anchorRef={dateAnchorRef} language={language} />}
          </div>
        </div>
        <details className="cs-form-disclosure" open={values.examDescription ? true : undefined}>
          <summary><span>{t('courseStudio.details')}<small>{t('courseStudio.detailsHint')}</small></span><span aria-hidden="true">+</span></summary>
          <label className="cs-field"><span>{t('courseStudio.exam')}</span>
            <textarea className="course-context__input course-context__input--area" value={values.examDescription} onChange={e => setField('examDescription', e.target.value)}
              placeholder={t('courseStudio.examPlaceholder')} rows={3} disabled={disabled || submitted} maxLength={MAX_LONG} />
          </label>
        </details>
        <details className="cs-form-disclosure">
          <summary><span>{t('courseStudio.schoolDetails')}</span><span aria-hidden="true">+</span></summary>
          <div className="cs-form-grid">
            <label className="cs-field"><span>{t('courseStudio.school')}</span>
              <input className="course-context__input" value={values.school} onChange={e => setField('school', e.target.value)}
                placeholder={t('courseStudio.schoolPlaceholder')} autoComplete="organization" disabled={disabled || submitted} maxLength={MAX_SHORT} />
            </label>
            <label className="cs-field"><span>{t('courseStudio.professor')}</span>
              <input className="course-context__input" value={values.professor} onChange={e => setField('professor', e.target.value)}
                placeholder={t('courseStudio.professorPlaceholder')} disabled={disabled || submitted} maxLength={MAX_SHORT} />
            </label>
          </div>
          <p className="cs-sample-note">{t('courseStudio.publicOnly')}</p>
        </details>
      </div>
      <footer className="cs-footer">
        <button type="button" className="course-context__skip" onClick={handleSkip} disabled={disabled || submitted}>{t('courseStudio.materialsOnly')}</button>
        <button type="submit" className="course-context__cta cs-button" disabled={disabled || submitted}>{t('courseStudio.contextCta')}<span aria-hidden="true">→</span></button>
      </footer>
    </form>
  );
};

export default CourseContextForm;
