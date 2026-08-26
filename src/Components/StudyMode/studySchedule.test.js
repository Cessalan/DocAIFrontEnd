/**
 * Dated-plan tests.
 *
 * The scheduling rules here are behavioural, not cosmetic — "the mission must
 * not shrink as you work through it" and "yesterday's nodes are not today's
 * progress" are the difference between a card that can be completed and one
 * that retreats forever. They're cheap to break by accident, so they're pinned.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { buildStudySchedule, getExamPhase, calendarDaysBetween } from './studySchedule';
import TodaySessionCard from './TodaySessionCard';

// react-i18next is not initialised in tests; t(key, fallback) → fallback,
// with {{var}} interpolation so assertions can match real copy.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, opts) => {
      let out = typeof fallback === 'string' ? fallback : key;
      const vars = typeof fallback === 'object' ? fallback : opts;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
}));

/* Default plan unit: lesson(5) quiz(4) audio(6) flashcard(3) quiz(4) = 22 min */
const unit = (topic, i) => [
  { id: `${i}-l`, type: 'lesson', label: `${topic} - Review`, status: 'locked' },
  { id: `${i}-q1`, type: 'quiz', label: `${topic} - Quiz`, status: 'locked' },
  { id: `${i}-a`, type: 'audio', label: `${topic} - Listen`, status: 'locked' },
  { id: `${i}-f`, type: 'flashcard', label: `${topic} - Recap`, status: 'locked' },
  { id: `${i}-q2`, type: 'quiz', label: `${topic} - Quiz`, status: 'locked' },
];
const makePlan = (topics) => topics.flatMap((name, i) => unit(name, i));
const FOUR_TOPICS = ['Cardiovascular meds', 'Diuretics', 'Endocrine', 'Renal'];

const NOW = new Date(2026, 7, 7, 9, 0, 0); // Aug 7 2026, 9am local
const dayOffset = (n) => new Date(2026, 7, 7 + n, 9, 0, 0);
const todayAt = (h, m = 0) => new Date(2026, 7, 7, h, m).toISOString();

describe('getExamPhase', () => {
  it.each([
    [20, 'steady'], [8, 'steady'], [7, 'focus'], [3, 'focus'],
    [2, 'final'], [1, 'final'], [0, 'examDay'], [-1, 'past'], [null, 'none'],
  ])('%s days remaining → %s', (days, expected) => {
    expect(getExamPhase(days)).toBe(expected);
  });
});

describe('calendarDaysBetween', () => {
  it('counts calendar days, not elapsed hours', () => {
    // 11pm tonight → 8am tomorrow is 9 hours but one sleep: it must read as 1.
    expect(calendarDaysBetween(new Date(2026, 7, 7, 23), new Date(2026, 7, 8, 8))).toBe(1);
  });
});

describe('buildStudySchedule', () => {
  it('spreads the plan across the days remaining', () => {
    const s = buildStudySchedule({
      nodes: makePlan(FOUR_TOPICS), // 20 nodes, 88 min
      examDate: dayOffset(9),
      startDate: NOW,
      now: NOW,
    });
    expect(s.phase).toBe('steady');
    expect(s.daysRemaining).toBe(9);
    expect([s.dayIndex, s.totalDays]).toEqual([1, 10]);
    expect(s.missionMinutes).toBeLessThanOrEqual(12); // ~88/9
    expect(s.missionSize).toBeGreaterThan(0);
  });

  it('grows the daily dose as the exam gets closer', () => {
    const nodes = makePlan(FOUR_TOPICS);
    const far = buildStudySchedule({ nodes, examDate: dayOffset(9), startDate: NOW, now: NOW });
    const near = buildStudySchedule({ nodes, examDate: dayOffset(3), startDate: NOW, now: NOW });
    expect(near.missionMinutes).toBeGreaterThan(far.missionMinutes);
  });

  it('never asks for more than one sitting, even on exam day', () => {
    const s = buildStudySchedule({
      nodes: makePlan(FOUR_TOPICS),
      examDate: NOW,
      startDate: dayOffset(-8),
      now: NOW,
    });
    expect(s.phase).toBe('examDay');
    expect(s.missionMinutes).toBeLessThanOrEqual(45);
    expect(s.missionSize).toBeLessThan(20);
  });

  // THE load-bearing invariant. Pacing off "what's left right now" would
  // shrink the target every time a node completed, so the mission would
  // retreat as the student advanced and could never be finished.
  it('keeps the mission window fixed as nodes are completed mid-day', () => {
    const before = buildStudySchedule({
      nodes: makePlan(FOUR_TOPICS), examDate: dayOffset(9), startDate: NOW, now: NOW,
    });

    const progressed = makePlan(FOUR_TOPICS);
    progressed[0].status = 'done';
    progressed[0].completedAt = todayAt(9, 30);
    const after = buildStudySchedule({
      nodes: progressed, examDate: dayOffset(9), startDate: NOW, now: NOW,
    });

    expect(after.missionNodes.map(n => n.id)).toEqual(before.missionNodes.map(n => n.id));
    expect(after.doneToday).toBe(1);
    expect(after.remainingMissionMinutes).toBeLessThan(before.missionMinutes);
  });

  it('does not count yesterday\'s work toward today', () => {
    const nodes = makePlan(FOUR_TOPICS);
    nodes[0].status = 'done'; nodes[0].completedAt = new Date(2026, 7, 6, 20).toISOString();
    nodes[1].status = 'done'; nodes[1].completedAt = new Date(2026, 7, 6, 20).toISOString();
    const s = buildStudySchedule({ nodes, examDate: dayOffset(9), startDate: NOW, now: NOW });
    expect(s.doneToday).toBe(0);
    expect(s.anchor).toBe(2);
    expect(s.missionComplete).toBe(false);
  });

  it('marks the mission complete once its window is cleared', () => {
    const nodes = makePlan(FOUR_TOPICS);
    nodes[0].status = 'done'; nodes[0].completedAt = todayAt(9, 30);
    nodes[1].status = 'done'; nodes[1].completedAt = todayAt(9, 40);
    const s = buildStudySchedule({ nodes, examDate: dayOffset(9), startDate: NOW, now: NOW });
    expect(s.missionComplete).toBe(true);
    expect(s.nextUpNodes.length).toBeGreaterThan(0);
  });

  it('rebalances rather than reporting a debt when the student falls behind', () => {
    const s = buildStudySchedule({
      nodes: makePlan(FOUR_TOPICS),
      examDate: dayOffset(3),
      startDate: dayOffset(-6), // 6 days in, nothing done
      now: NOW,
    });
    expect(s.onTrack).toBe(false);
    expect(s.missionSize).toBeGreaterThan(0);
    expect(s.missionMinutes).toBeLessThanOrEqual(45); // still one sitting
  });

  it('handles legacy plans whose completions predate completedAt', () => {
    const nodes = makePlan(['Cardio', 'Diuretics']);
    nodes[0].status = 'done'; // no completedAt
    nodes[1].status = 'done';
    const s = buildStudySchedule({ nodes, examDate: dayOffset(5), startDate: null, now: NOW });
    expect(s.doneToday).toBe(0);
    expect(s.anchor).toBe(2);
    expect(s.dayIndex).toBe(1); // start falls back to today
  });

  it('falls back to a fixed session when there is no exam date', () => {
    const s = buildStudySchedule({ nodes: makePlan(['Cardio', 'Diuretics']), examDate: null, now: NOW });
    expect(s.hasExam).toBe(false);
    expect(s.missionSize).toBe(3);
    expect(s.dayIndex).toBeNull();
  });

  it('stops pacing to an exam that has already happened', () => {
    const s = buildStudySchedule({ nodes: makePlan(['Cardio']), examDate: dayOffset(-2), now: NOW });
    expect(s.phase).toBe('past');
    expect(s.hasExam).toBe(false);
    expect(s.missionSize).toBeGreaterThan(0);
  });

  it.each([
    ['Date', dayOffset(5)],
    ['ISO string', dayOffset(5).toISOString()],
    ['epoch millis', dayOffset(5).getTime()],
    ['Firestore Timestamp', { toDate: () => dayOffset(5) }],
    ['plain {seconds}', { seconds: Math.floor(dayOffset(5).getTime() / 1000) }],
  ])('accepts %s exam dates', (_label, value) => {
    const s = buildStudySchedule({ nodes: makePlan(['Cardio']), examDate: value, startDate: NOW, now: NOW });
    expect(s.daysRemaining).toBe(5);
  });

  it('treats an unparseable exam date as no exam', () => {
    const s = buildStudySchedule({ nodes: makePlan(['Cardio']), examDate: 'not a date', now: NOW });
    expect(s.hasExam).toBe(false);
  });
});

describe('TodaySessionCard', () => {
  const renderCard = (schedule, props = {}) =>
    render(<TodaySessionCard schedule={schedule} onNodeSelect={jest.fn()} {...props} />);

  it('shows the day and exactly one action', () => {
    const schedule = buildStudySchedule({
      nodes: makePlan(FOUR_TOPICS), examDate: dayOffset(9), startDate: NOW, now: NOW,
    });
    renderCard(schedule);

    expect(screen.getByText("Today's mission")).toBeInTheDocument();
    expect(screen.getByText('Day 1 of 10')).toBeInTheDocument();
    // One mission CTA. The old per-node list rendered a button-shaped row per
    // node with only one of them live, which read as a menu with broken items.
    expect(screen.getAllByRole('button', { name: /mission/i })).toHaveLength(1);
  });

  it('launches the current node from the single CTA', () => {
    const onNodeSelect = jest.fn();
    const nodes = makePlan(FOUR_TOPICS);
    const schedule = buildStudySchedule({
      nodes, examDate: dayOffset(9), startDate: NOW, now: NOW,
    });
    renderCard(schedule, { onNodeSelect });

    screen.getByRole('button', { name: /mission/i }).click();
    expect(onNodeSelect).toHaveBeenCalledTimes(1);
    expect(onNodeSelect.mock.calls[0][0].id).toBe(schedule.missionNodes[0].id);
  });

  it('closes the day with a completion state that names tomorrow', () => {
    const nodes = makePlan(FOUR_TOPICS);
    nodes[0].status = 'done'; nodes[0].completedAt = todayAt(9, 30);
    nodes[1].status = 'done'; nodes[1].completedAt = todayAt(9, 40);
    const schedule = buildStudySchedule({ nodes, examDate: dayOffset(9), startDate: NOW, now: NOW });

    renderCard(schedule);
    expect(screen.getByText("Today's mission complete")).toBeInTheDocument();
    expect(screen.getByText(/on track to be ready by/i)).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('switches to review framing on exam day', () => {
    const schedule = buildStudySchedule({
      nodes: makePlan(FOUR_TOPICS), examDate: NOW, startDate: dayOffset(-8), now: NOW,
    });
    renderCard(schedule);
    expect(screen.getByText(/exam day/i)).toBeInTheDocument();
  });

  it('renders nothing once the whole plan is finished', () => {
    const nodes = makePlan(['Cardio']).map(n => ({ ...n, status: 'done' }));
    const schedule = buildStudySchedule({ nodes, examDate: dayOffset(4), startDate: NOW, now: NOW });
    const { container } = renderCard(schedule);
    expect(container).toBeEmptyDOMElement();
  });
});
