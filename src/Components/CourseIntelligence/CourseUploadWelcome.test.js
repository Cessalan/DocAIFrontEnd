import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import { CourseUploadWelcome } from './CourseExamWelcome';

describe('CourseUploadWelcome', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rotates tips without advancing real progress and resets the wait after files are ready', () => {
    const { container, rerender, unmount } = render(<CourseUploadWelcome />);
    expect(container.querySelector('[aria-current="step"]').textContent).toContain('Read your notes');
    act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByText('A short check will help you find a clear place to start.')).toBeTruthy();
    act(() => jest.advanceTimersByTime(24000));
    expect(screen.getByText(/This is taking a little longer/)).toBeTruthy();
    expect(container.querySelector('[aria-current="step"]').textContent).toContain('Read your notes');
    rerender(<CourseUploadWelcome materialsReady />);
    expect(container.querySelector('[aria-current="step"]').textContent).toContain('Identify key topics');
    expect(container.querySelector('.is-done').textContent).toContain('Read your notes');
    expect(screen.queryByText(/This is taking a little longer/)).toBeNull();
    act(() => jest.advanceTimersByTime(16000));
    expect(container.querySelector('[aria-current="step"]').textContent).toContain('Identify key topics');
    rerender(<CourseUploadWelcome materialsReady preparingCheck />);
    expect(container.querySelector('[aria-current="step"]').textContent).toContain('Prepare a quick check');
    expect(screen.getByText('Preparing practice questions from your notes…')).toBeTruthy();
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops loading on failure and keeps retry available', () => {
    const retry = jest.fn();
    const { container, rerender } = render(<CourseUploadWelcome materialsReady />);
    act(() => jest.advanceTimersByTime(32000));
    rerender(<CourseUploadWelcome materialsReady failed onRetry={retry} />);
    expect(container.querySelector('.cs-upload-welcome__shimmer')).toBeNull();
    expect(screen.queryByText(/This is taking a little longer/)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<CourseUploadWelcome materialsReady onRetry={retry} />);
    expect(container.querySelector('.cs-upload-welcome__shimmer')).toBeTruthy();
    expect(screen.getByText('Your course notes give this quick check its focus.')).toBeTruthy();
  });
});
