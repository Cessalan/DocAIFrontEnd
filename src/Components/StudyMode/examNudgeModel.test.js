import { buildExamNudge, STEADY_ENOUGH_PCT } from './examNudgeModel';

const nudge = (over) => buildExamNudge({ phase: 'final', daysRemaining: 1, ...over });

describe('the fault this file was written to fix', () => {
  it('never lectures about study technique', () => {
    // "Review beats cramming now" told a student the night before her exam
    // how she ought to be studying. Nothing here is allowed to do that.
    const all = [
      { phase: 'examDay', daysRemaining: 0 },
      { phase: 'final', daysRemaining: 1 },
      { phase: 'final', daysRemaining: 2 },
      { phase: 'focus', daysRemaining: 5 },
      { phase: 'steady', daysRemaining: 20 },
      { phase: 'past', daysRemaining: -2 },
    ];
    all.forEach((ctx) => {
      [null, 30, 80].forEach((pct) => {
        [null, 'Cardiac'].forEach((topic) => {
          const out = buildExamNudge({ ...ctx, readinessPct: pct, nextTopic: topic });
          expect(out.fallback.toLowerCase()).not.toContain('cramming');
          expect(out.fallback.toLowerCase()).not.toContain('highest-impact');
        });
      });
    });
  });

  it('says something different at one day than at two', () => {
    const one = nudge({ daysRemaining: 1, nextTopic: 'Cardiac', readinessPct: 70 });
    const two = nudge({ daysRemaining: 2, nextTopic: 'Cardiac', readinessPct: 70 });
    expect(one.key).not.toBe(two.key);
  });

  it('says something different at 67% than at 25%', () => {
    const ready = nudge({ nextTopic: 'Cardiac', readinessPct: 67 });
    const behind = nudge({ nextTopic: 'Cardiac', readinessPct: 25 });
    expect(ready.key).not.toBe(behind.key);
  });
});

describe('readiness gating', () => {
  it('treats unknown readiness as not-established, never as fine', () => {
    // Absent evidence must not produce "you've got a real base".
    const unknown = nudge({ nextTopic: 'Cardiac', readinessPct: null });
    const behind = nudge({ nextTopic: 'Cardiac', readinessPct: 20 });
    expect(unknown.key).toBe(behind.key);
  });

  it('uses the documented threshold', () => {
    expect(nudge({ nextTopic: 'C', readinessPct: STEADY_ENOUGH_PCT }).key)
      .toBe('warmUrgency.nudgeTomorrowReady');
    expect(nudge({ nextTopic: 'C', readinessPct: STEADY_ENOUGH_PCT - 1 }).key)
      .toBe('warmUrgency.nudgeTomorrowBehind');
  });
});

describe('exam day', () => {
  it('never suggests there is time to learn something', () => {
    [null, 20, 90].forEach((pct) => {
      const out = buildExamNudge({
        phase: 'examDay',
        daysRemaining: 0,
        nextTopic: 'Cardiac',
        readinessPct: pct,
      });
      expect(out.fallback).toMatch(/nothing new|light look/i);
    });
  });

  it('gives permission to stop rather than a task', () => {
    const out = buildExamNudge({ phase: 'examDay', daysRemaining: 0, nextTopic: 'C', readinessPct: 80 });
    expect(out.key).toBe('warmUrgency.nudgeExamDayReady');
  });
});

describe('every branch produces one usable sentence', () => {
  it('always returns a key, a fallback and params', () => {
    const phases = ['none', 'steady', 'focus', 'final', 'examDay', 'past'];
    phases.forEach((phase) => {
      [true, false].forEach((onTrack) => {
        [null, 'Cardiac'].forEach((nextTopic) => {
          const out = buildExamNudge({ phase, nextTopic, onTrack, daysRemaining: 3 });
          expect(typeof out.key).toBe('string');
          expect(out.fallback.length).toBeGreaterThan(10);
          expect(out.params).toBeDefined();
        });
      });
    });
  });

  it('handles a finished plan before anything else', () => {
    const done = buildExamNudge({ phase: 'final', daysRemaining: 1, studyComplete: true });
    expect(done.key).toBe('warmUrgency.nudgeCompletePartial');
    const locked = buildExamNudge({ phase: 'final', studyComplete: true, allLocked: true });
    expect(locked.key).toBe('warmUrgency.nudgeCompleteAllLocked');
  });

  it('only calls it a good position when there are 8+ days', () => {
    // The same words at three days would be a lie, which is why phase is
    // checked before this branch is ever reached.
    expect(buildExamNudge({ phase: 'steady', onTrack: true }).key).toBe('warmUrgency.nudgeCalm');
    expect(buildExamNudge({ phase: 'focus', daysRemaining: 4, nextTopic: 'C' }).key)
      .not.toBe('warmUrgency.nudgeCalm');
  });

  it('reshapes rather than scolds when she has fallen behind', () => {
    const out = buildExamNudge({ phase: 'steady', onTrack: false });
    expect(out.key).toBe('warmUrgency.nudgeRebalanced');
  });
});
