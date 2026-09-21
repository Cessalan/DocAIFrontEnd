import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './MatrixQuestion.css';

export function gradeMatrix(question, selections) {
  const rows = question.rows || [];
  const score = rows.filter(row => selections[row.id] === row.correctColumnId).length;
  return { questionType: 'matrix', selectedRows: { ...selections }, score, maxScore: rows.length,
    isCorrect: rows.length > 0 && score === rows.length, percentage: rows.length ? Math.round(score / rows.length * 100) : 0 };
}

export default function MatrixQuestion({ quiz, previousAnswer, onAnswerSelect, onNext, isLastQuestion, viewOnly = false }) {
  const { t } = useTranslation();
  const group = useId();
  const [selections, setSelections] = useState(previousAnswer?.selectedRows || {});
  const [submitted, setSubmitted] = useState(!!previousAnswer);
  const [openRow, setOpenRow] = useState(null);
  const submittedRef = useRef(!!previousAnswer);
  const rows = quiz.rows || [], columns = quiz.columns || [];
  const valid = rows.length >= 3 && columns.length >= 2 && rows.every(row => columns.some(c => c.id === row.correctColumnId));
  const complete = valid && rows.every(row => columns.some(c => c.id === selections[row.id]));
  const result = gradeMatrix(quiz, selections);
  const submit = () => {
    if (!complete || submittedRef.current || viewOnly) return;
    submittedRef.current = true;
    setSubmitted(true);
    setOpenRow(rows.find(row => selections[row.id] !== row.correctColumnId)?.id ?? null);
    onAnswerSelect?.(result);
  };
  if (!valid) return <div role="alert">{t('matrix.invalid', 'This question could not load. Please reopen this step.')}</div>;
  return <section className={`matrix-question${submitted ? ' is-reviewed' : ''}`} aria-label={t('matrix.title', 'Matrix question')}>
    <p className="study-quiz-question">{quiz.question}</p>
    <p className="matrix-instruction" id={`${group}-instruction`}>{t('matrix.instruction', 'Choose one answer in each row. A column can be used more than once.')}</p>
    {submitted && <div className="matrix-feedback">
      <p role="status">{t('matrix.score', { score: result.score, total: result.maxScore, defaultValue: '{{score}} of {{total}} rows correct' })}</p>
    </div>}
    <div className="matrix-scroll" role="region" aria-label={t('matrix.table', 'Answer grid')} tabIndex={0}>
      <table aria-describedby={`${group}-instruction`}>
        <thead><tr><th scope="col">{t('matrix.item', 'Finding or action')}</th>{columns.map(column => <th key={column.id} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <React.Fragment key={row.id}><tr className={openRow === row.id ? 'matrix-row-open' : ''}>
          <th scope="row">{row.text}
            {submitted && <button type="button" className="matrix-why" aria-expanded={openRow === row.id}
              aria-controls={`${group}-${row.id}-explanation`}
              aria-label={`${t('matrix.why', 'Why?')} ${row.text}`}
              onClick={() => setOpenRow(current => current === row.id ? null : row.id)}>
              {t('matrix.why', 'Why?')} <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
            </button>}
          </th>
          {columns.map(column => {
            const selected = selections[row.id] === column.id;
            const correct = submitted && row.correctColumnId === column.id;
            const wrong = submitted && selected && !correct;
            return <td key={column.id} className={correct ? 'is-correct' : wrong ? 'is-incorrect' : selected ? 'is-selected' : ''}>
              <label className="matrix-choice">
                <input type="radio" name={`${group}-${row.id}`} value={column.id} checked={selected}
                  className={submitted ? 'matrix-saved-input' : undefined}
                  disabled={submitted || viewOnly} aria-label={`${row.text}: ${column.label}`}
                  onChange={() => setSelections(previous => ({ ...previous, [row.id]: column.id }))} />
                {correct && <span className="matrix-result-marker correct" aria-label={t('matrix.correct', 'Correct answer')}>✓</span>}
                {wrong && <span className="matrix-result-marker incorrect" aria-label={t('matrix.incorrect', 'Incorrect answer')}>×</span>}
                {submitted && !correct && !wrong && <span className="matrix-empty-marker" aria-hidden="true">—</span>}
                {submitted && (selected || correct) && <span className={`matrix-answer-caption${wrong ? ' incorrect' : selected ? ' correct' : ''}`}>
                  {selected
                    ? correct ? t('matrix.yourAnswerCorrect', 'Your answer · Correct') : t('matrix.yourAnswerIncorrect', 'Your answer · Incorrect')
                    : t('matrix.correct', 'Correct answer')}
                </span>}
              </label>
            </td>;
          })}
        </tr>
          {submitted && <tr className={`matrix-rationale-row${openRow === row.id ? ' is-open' : ''}`} aria-hidden={openRow !== row.id} id={`${group}-${row.id}-explanation`}>
            <td colSpan={columns.length + 1}>
              <div className="matrix-row-rationale">
                <div className="matrix-rationale-clip"><p>{row.explanation}</p></div>
              </div>
            </td>
          </tr>}
        </React.Fragment>)}</tbody>
      </table>
    </div>
    {!submitted && !viewOnly && <div className="matrix-actions">
      <span>{t('matrix.progress', { count: rows.filter(row => selections[row.id]).length, total: rows.length, defaultValue: '{{count}} of {{total}} rows answered' })}</span>
      <button type="button" className="study-continue-btn" disabled={!complete} onClick={submit}>{t('matrix.check', 'Check answers')}</button>
    </div>}
    {(submitted || viewOnly) && <button type="button" className="study-continue-btn" onClick={onNext}>
      {isLastQuestion ? t('matrix.finish', 'Finish') : t('matrix.next', 'Next question')}
    </button>}
  </section>;
}
