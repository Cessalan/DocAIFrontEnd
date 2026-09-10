import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import CourseExamWelcome from './CourseExamWelcome';

const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  jest.useFakeTimers();
  window.matchMedia = jest.fn(() => ({ matches: false }));
});
afterEach(() => {
  jest.useRealTimers();
  window.matchMedia = originalMatchMedia;
});
const selectToday = () => {
  const day = screen.getByRole('gridcell', { name: new Date().toDateString() });
  fireEvent.click(day);
  return day;
};

it('acknowledges one selected date before handing it to the next screen', () => {
  const onChoose = jest.fn();
  render(<CourseExamWelcome onChoose={onChoose} />);
  const day = selectToday();
  expect(day).toHaveAttribute('aria-selected', 'true');
  expect(day).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Exam on');
  expect(screen.queryByRole('button', { name: 'I don’t know yet' })).toBeNull();
  fireEvent.click(day);
  act(() => jest.advanceTimersByTime(739));
  expect(onChoose).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
});

it('cancels the pending handoff if the welcome is removed', () => {
  const onChoose = jest.fn();
  const { unmount } = render(<CourseExamWelcome onChoose={onChoose} />);
  selectToday();
  unmount();
  act(() => jest.runAllTimers());
  expect(onChoose).not.toHaveBeenCalled();
});

it('uses a brief acknowledgment without the animation delay for reduced motion', () => {
  window.matchMedia = jest.fn(() => ({ matches: true }));
  const onChoose = jest.fn();
  render(<CourseExamWelcome onChoose={onChoose} />);
  selectToday();
  act(() => jest.advanceTimersByTime(120));
  expect(onChoose).toHaveBeenCalledTimes(1);
});
