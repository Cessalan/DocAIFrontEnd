import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { clampScore, scoreAnswer, scoreMessage, meterFill, SCORE_STATUS } from './examScoreModel';
import { buildDebriefWrite } from './examDebriefConversation';
import ExamScoreMeter from './ExamScoreMeter';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) })
}));

describe('the exam score', () => {
  test('is a whole percentage between 0 and 100, or nothing', () => {
    expect(clampScore(88.3)).toBe(88);
    expect(clampScore('77')).toBe(77);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(null)).toBeNull();
    expect(clampScore('')).toBeNull();
    expect(clampScore('abc')).toBeNull();
  });

  test('"not yet" is stored as an answer with no number, never as a score', () => {
    expect(scoreAnswer(SCORE_STATUS.NOT_YET, 75)).toEqual({ score: null, scoreStatus: 'not_yet' });
  });

  test('a given score without a usable number becomes skipped, not zero', () => {
    expect(scoreAnswer(SCORE_STATUS.GIVEN, 'x')).toEqual({ score: null, scoreStatus: 'skipped' });
    expect(scoreAnswer(SCORE_STATUS.GIVEN, 82)).toEqual({ score: 82, scoreStatus: 'given' });
  });

  test('her answer is said in the conversation in her words', () => {
    expect(scoreMessage({ score: 82, scoreStatus: 'given' })).toEqual({ key: 'examDebrief.score.said', values: { score: 82 } });
    expect(scoreMessage({ score: null, scoreStatus: 'not_yet' }).key).toBe('examDebrief.score.notYetSaid');
  });

  test('the meter shows no fill until she has moved it', () => {
    expect(meterFill(75, false)).toBe(0);
    expect(meterFill(75, true)).toBe(0.75);
  });

  test('the debrief record carries the score and why it is missing', () => {
    const given = buildDebriefWrite({ messages: [], exam: { key: 'k' }, score: { score: 91, scoreStatus: 'given' } });
    expect(given.context.score).toBe(91);
    expect(given.context.scoreStatus).toBe('given');
    const typed = buildDebriefWrite({ messages: [], exam: { key: 'k' } });
    expect(typed.context.score).toBeNull();
    expect(typed.context.scoreStatus).toBeNull();
  });
});

describe('the score meter', () => {
  test('cannot be saved until she has moved it', () => {
    const onAnswer = jest.fn();
    render(<ExamScoreMeter onAnswer={onAnswer} />);
    const save = screen.getByRole('button', { name: 'Save my score' });
    expect(save.disabled).toBe(true);
    expect(screen.getByText('Slide to your score')).toBeTruthy();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '86' } });
    expect(screen.getByText('86%')).toBeTruthy();
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onAnswer).toHaveBeenCalledWith('given', 86);
  });

  test('"I don\'t know my score yet" answers without a number', () => {
    const onAnswer = jest.fn();
    render(<ExamScoreMeter onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: "I don't know my score yet" }));
    expect(onAnswer).toHaveBeenCalledWith('not_yet');
  });
});
