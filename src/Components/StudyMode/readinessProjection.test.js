/**
 * Readiness projection + session arc.
 *
 * These numbers are shown to an anxious student as "complete today's mission →
 * readiness 26%". The model must never promise a gain that finishing the work
 * wouldn't produce, never project backwards, and never render a delta of zero
 * as if it were progress. Those are the properties pinned here.
 */

import { projectReadiness, gradedQuestionCount, normalizeTopic } from './readinessProjection';
import { buildMissionArc, phaseForType } from './missionArc';

const topic = (name, correct, total, extra = {}) => ({
  name,
  correct,
  total,
  pct: total > 0 ? Math.round((correct / total) * 100) : 0,
  level: total === 0 ? 'weak' : correct / total >= 0.85 ? 'strong' : correct / total >= 0.6 ? 'developing' : 'weak',
  untested: total < 5,
  ...extra,
});

const node = (id, type, label, status = 'locked') => ({ id, type, label, status });
const labelOf = (n) => n.label;

describe('gradedQuestionCount', () => {
  it('counts only node types that produce graded answers', () => {
    expect(gradedQuestionCount('quiz')).toBe(5);
    expect(gradedQuestionCount('exam')).toBe(10);
    // Mirrors buildScoredTopics, which excludes these on purpose.
    expect(gradedQuestionCount('lesson')).toBe(0);
    expect(gradedQuestionCount('flashcard')).toBe(0);
    expect(gradedQuestionCount('audio')).toBe(0);
  });
});

describe('normalizeTopic', () => {
  it('strips diacritics and case so labels bucket consistently', () => {
    expect(normalizeTopic('  Élimination  Urinaire ')).toBe('elimination urinaire');
  });
});

describe('projectReadiness', () => {
  it('returns no data when nothing has been scored', () => {
    expect(projectReadiness({ scoredTopics: [] }).hasData).toBe(false);
    expect(projectReadiness({ scoredTopics: [topic('A', 0, 0)] }).hasData).toBe(false);
  });

  it('matches the readiness number the page already displays', () => {
    // Coverage-aware mean with untested counted as 0 — same as buildReadinessSnapshot.
    const scoredTopics = [topic('Cardio', 8, 10), topic('Renal', 0, 0)];
    const p = projectReadiness({ scoredTopics, labelOf });
    expect(p.currentPct).toBe(40); // (80 + 0) / 2
  });

  it('raises readiness when today includes a graded node', () => {
    const scoredTopics = [topic('Cardio', 8, 10), topic('Renal', 0, 0)];
    const p = projectReadiness({
      scoredTopics,
      missionNodes: [node('1', 'quiz', 'Renal')],
      labelOf,
    });
    expect(p.movesToday).toBe(true);
    expect(p.todayPct).toBeGreaterThan(p.currentPct);
    // Renal goes from an untested 0 to roughly the student's smoothed accuracy.
    expect(p.todayPct).toBeLessThanOrEqual(80);
  });

  it('does not move on a lesson-only day', () => {
    const scoredTopics = [topic('Cardio', 8, 10), topic('Renal', 0, 0)];
    const p = projectReadiness({
      scoredTopics,
      missionNodes: [node('1', 'lesson', 'Renal'), node('2', 'audio', 'Renal')],
      labelOf,
    });
    expect(p.movesToday).toBe(false);
    expect(p.todayPct).toBe(p.currentPct);
  });

  // "Do this session → get worse" is arithmetically possible when the student's
  // smoothed accuracy sits below a strong topic's score. It is also useless as
  // a nudge and actively discouraging, so the projection floors at today.
  it('never projects backwards', () => {
    const scoredTopics = [topic('Cardio', 10, 10)]; // 100%
    const p = projectReadiness({
      scoredTopics,
      missionNodes: [node('1', 'quiz', 'Cardio')],
      labelOf,
    });
    expect(p.todayPct).toBeGreaterThanOrEqual(p.currentPct);
  });

  it('smooths accuracy so one disastrous quiz does not project to zero', () => {
    const wiped = projectReadiness({
      scoredTopics: [topic('Cardio', 0, 5), topic('Renal', 0, 0)],
      missionNodes: [node('1', 'quiz', 'Renal')],
      labelOf,
    });
    // Prior pulls the assumption up off the floor rather than predicting 0%.
    expect(wiped.assumedAccuracy).toBeGreaterThan(0.3);
    expect(wiped.assumedAccuracy).toBeLessThan(0.7);
  });

  it('converges on real accuracy once there is enough evidence', () => {
    const p = projectReadiness({
      scoredTopics: [topic('Cardio', 90, 100)],
      labelOf,
    });
    expect(p.assumedAccuracy).toBeGreaterThan(0.85);
  });

  it('projects the full plan at least as high as today', () => {
    const scoredTopics = [topic('Cardio', 6, 10), topic('Renal', 0, 0), topic('Endo', 0, 0)];
    const p = projectReadiness({
      scoredTopics,
      missionNodes: [node('1', 'quiz', 'Renal')],
      remainingNodes: [
        node('1', 'quiz', 'Renal'),
        node('2', 'quiz', 'Endo'),
        node('3', 'exam', 'Cardio'),
      ],
      labelOf,
    });
    expect(p.planPct).toBeGreaterThanOrEqual(p.todayPct);
  });

  it('names the focus topic and how the student stands on it', () => {
    const scoredTopics = [topic('Renal', 0, 0), topic('Cardio', 9, 10)];
    const p = projectReadiness({
      scoredTopics,
      missionNodes: [node('1', 'quiz', 'Renal - Quiz')],
      labelOf: (n) => n.label.replace(/\s*-\s*Quiz$/, ''),
    });
    expect(p.focusTopic).toBe('Renal');
    expect(p.focusLevel).toBe('untested');
  });

  it('ignores mission nodes whose topic is not in the curriculum', () => {
    const scoredTopics = [topic('Cardio', 8, 10)];
    const p = projectReadiness({
      scoredTopics,
      missionNodes: [node('1', 'quiz', 'Something Unrelated')],
      labelOf,
    });
    expect(p.todayPct).toBe(p.currentPct);
    expect(p.movesToday).toBe(false);
  });
});

describe('buildMissionArc', () => {
  it('maps node types onto the three beats', () => {
    expect(phaseForType('lesson')).toBe('learn');
    expect(phaseForType('audio')).toBe('learn');
    expect(phaseForType('mindmap')).toBe('learn');
    expect(phaseForType('quiz')).toBe('practice');
    expect(phaseForType('exam')).toBe('practice');
    expect(phaseForType('flashcard')).toBe('review');
    expect(phaseForType('review')).toBe('review');
    expect(phaseForType('something-new')).toBe('learn');
  });

  it('groups a full unit into Learn → Practice → Review', () => {
    const nodes = [
      node('l', 'lesson', 'T'),
      node('q1', 'quiz', 'T'),
      node('a', 'audio', 'T'),
      node('f', 'flashcard', 'T'),
      node('q2', 'quiz', 'T'),
    ];
    const arc = buildMissionArc(nodes, 'l');
    expect(arc.map(a => a.key)).toEqual(['learn', 'practice', 'review']);
    expect(arc[0].minutes).toBe(11); // lesson 5 + audio 6
    expect(arc[1].minutes).toBe(8);  // quiz 4 + quiz 4
    expect(arc[2].minutes).toBe(3);  // flashcard 3
  });

  it('only renders beats that today actually contains', () => {
    const arc = buildMissionArc([node('q', 'quiz', 'T')], 'q');
    expect(arc.map(a => a.key)).toEqual(['practice']);
    expect(arc[0].status).toBe('active');
  });

  // With interleaved plans a later beat can be partly finished while an
  // earlier one is still active. Marking it 'done' would be a lie.
  it('marks a beat done only when every node in it is finished', () => {
    const nodes = [
      { ...node('l', 'lesson', 'T'), status: 'done' },
      { ...node('q1', 'quiz', 'T'), status: 'done' },
      node('a', 'audio', 'T'),
      node('q2', 'quiz', 'T'),
    ];
    const arc = buildMissionArc(nodes, 'a');
    const learn = arc.find(a => a.key === 'learn');
    const practice = arc.find(a => a.key === 'practice');
    expect(learn.status).toBe('active');   // holds the current node
    expect(practice.status).toBe('upcoming'); // q1 done but q2 isn't
  });

  it('reports remaining minutes separately from total', () => {
    const nodes = [
      { ...node('l', 'lesson', 'T'), status: 'done' },
      node('a', 'audio', 'T'),
    ];
    const [learn] = buildMissionArc(nodes, 'a');
    expect(learn.minutes).toBe(11);
    expect(learn.remainingMinutes).toBe(6);
  });

  it('handles an empty mission', () => {
    expect(buildMissionArc([], null)).toEqual([]);
  });
});
