import React from 'react';
import { contentType, journeyRows, textOf, timeMs } from './studyTimelineModel';

const when = at => timeMs(at) === null ? 'Time not recorded' : new Date(timeMs(at)).toLocaleString();

export default function StudyExperience({ steps, events, loading, incomplete, onSelect }) {
  const rows = journeyRows(steps, events);
  const planned = rows.filter(r => r.node);
  const observed = rows.filter(r => r.hasActivity);
  const completed = planned.filter(r => r.completed);
  const warnings = rows.filter(r => r.warnings);
  const last = rows.filter(r => r.last).sort((a, b) => timeMs(b.last.at) - timeMs(a.last.at))[0];
  const pending = planned.filter(r => !r.hasActivity);
  return <section className="si-experience" aria-label="Student experience overview">
    <p className="si-eyebrow">STUDENT EXPERIENCE</p>
    <h2>What happened in this plan?</h2>
    <p className="si-lead">{completed.length} of {planned.length} planned steps are marked complete.
      {last ? <> The latest dated progress is in <strong>{last.label}</strong>.</> : ' No dated progress is available yet.'}</p>
    {(loading || incomplete) && <p className="si-warning">{loading ? 'History is still loading. These counts may change.' : 'Some history could not be loaded. This overview is incomplete.'}</p>}
    <div className="si-metrics">
      <div><strong>{completed.length} / {planned.length}</strong><span>Steps marked complete</span></div>
      <div><strong>{observed.length}</strong><span>Steps / records with progress</span></div>
      <div><strong>{pending.length}</strong><span>Planned steps without confirmed use</span></div>
    </div>
    <h3>Where to investigate</h3>
    <div className="si-investigations">
      {last && <button onClick={() => onSelect(last.id, last.last.messageId, last.last.questionIndex)}><span className="si-eyebrow">LAST RECORDED PROGRESS</span><strong>{last.label}</strong><span>{last.last.label} · {when(last.last.at)}</span><p>Inspect the final answers and feedback here. This is the last saved progress, not proof the student left at this point.</p><b>Inspect this moment →</b></button>}
      {warnings.length > 0 && <button onClick={() => onSelect(warnings[0].id)}><span className="si-eyebrow">MEASUREMENT GAP</span><strong>{warnings.length} step{warnings.length === 1 ? '' : 's'} with unreliable first-answer records</strong><p>Some records disagree or predate the question set. Fix this tracking before using first-attempt scores to judge whether practice works.</p><b>Inspect the evidence →</b></button>}
      {pending.length > 0 && <button onClick={() => onSelect(pending[0].id)}><span className="si-eyebrow">FOLLOW-THROUGH TO CHECK</span><strong>{pending.length} planned step{pending.length === 1 ? '' : 's'} without confirmed use</strong><p>Check whether the next step was useful and easy to reach. Saved content alone does not show that someone read or listened to it.</p><b>Inspect the first such step →</b></button>}
    </div>
    <h3>The journey, step by step</h3>
    <p className="si-muted">Plan order. Open a step for answers, the student’s own words, and the AI’s response. Use Activity timeline for timestamp order.</p>
    <div className="si-journey">{rows.map(row => <button key={row.id} onClick={() => onSelect(row.id)}>
      <span className="si-step-number">{row.number || '·'}</span><span className="si-journey-copy"><span className="si-content-type" data-type={contentType(row.node, row.messages[0])}>{contentType(row.node, row.messages[0])}</span><strong>{row.label}</strong><span>{row.statusLabel}{row.answerCount ? ` · ${row.answerCount} question${row.answerCount === 1 ? '' : 's'} with answer records` : ''}</span>{row.warnings > 0 && <small>First-answer evidence needs review</small>}</span><span aria-hidden="true">→</span>
    </button>)}</div>
    {!rows.length && <p>No saved journey is available.</p>}
    <p className="si-footnote">Questions to investigate, not proven causes. This plan alone cannot establish why someone stopped, how long they actively studied, whether they improved on new questions, or whether they passed the exam.</p>
  </section>;
}

export function QuestionReviewSummary({ rows, onFilter, filter }) {
  const firstKnown = rows.filter(r => r.evidence.firstCorrect !== null);
  const firstCorrect = firstKnown.filter(r => r.evidence.firstCorrect);
  const missed = rows.filter(r => r.evidence.firstCorrect === false || r.evidence.latestCorrect === false);
  const discussions = rows.filter(r => r.studentTurns.length);
  const changed = rows.filter(r => r.evidence.firstCorrect === false && r.evidence.latestCorrect === true);
  const uncertain = rows.filter(r => r.evidence.stale || r.evidence.conflict);
  return <section className="si-review-summary">
    <h3>What this practice shows</h3>
    <div className="si-metrics"><div><strong>{firstKnown.length ? `${firstCorrect.length} / ${firstKnown.length}` : 'Unknown'}</strong><span>Correct on reliable first attempts</span><small>{rows.length - firstKnown.length} of {rows.length} questions have no reliable first result</small></div><div><strong>{missed.length}</strong><span>Questions with a recorded miss</span></div><div><strong>{discussions.length}</strong><span>Questions the student discussed</span></div></div>
    {changed.length > 0 && <p><strong>{changed.length} initially wrong, latest correct.</strong> This is a change on the same question, not evidence of improvement on a new one.</p>}
    {discussions.length > 0 && <div className="si-student-voice"><h4>In the student’s words</h4><blockquote>{textOf(discussions[0].studentTurns[0].content)}</blockquote><p>Inspect the tutor’s response and the saved result to check whether the help addressed their question. Timing and causation may not be recorded.</p></div>}
    {uncertain.length > 0 && <p className="si-warning">First-attempt tracking is unreliable for {uncertain.length} question{uncertain.length === 1 ? '' : 's'}. Those results are excluded from the first-attempt count above.</p>}
    <div className="si-question-filters" role="group" aria-label="Filter questions">{[['all', `All questions (${rows.length})`], ['missed', `Missed (${missed.length})`], ['discussion', `Discussed (${discussions.length})`], ['uncertain', `Uncertain (${uncertain.length})`]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => onFilter(key)}>{label}</button>)}</div>
  </section>;
}
