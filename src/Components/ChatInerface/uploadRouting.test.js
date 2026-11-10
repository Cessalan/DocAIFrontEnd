import { isUploadOnScreen, ownsSharedUploadState } from './uploadRouting';

describe('isUploadOnScreen', () => {
  it('draws into the chat the upload started in', () => {
    expect(isUploadOnScreen('chatA', 'chatA')).toBe(true);
  });

  it('does not draw into a new chat she opened mid-upload (2026-11-03 empty report)', () => {
    expect(isUploadOnScreen('chatA', 'chatB')).toBe(false);
  });

  it('treats no open chat as this upload\'s screen (first upload creates the chat)', () => {
    expect(isUploadOnScreen('chatA', null)).toBe(true);
    expect(isUploadOnScreen('chatA', undefined)).toBe(true);
  });
});

describe('ownsSharedUploadState', () => {
  const first = { chatId: 'chatA' };
  const second = { chatId: 'chatB' };

  it('lets the newest upload clear the shared refs', () => {
    expect(ownsSharedUploadState(first, first)).toBe(true);
  });

  it('stops an older upload from clearing a newer one\'s card', () => {
    expect(ownsSharedUploadState(first, second)).toBe(false);
  });

  it('a caller without its own upload state falls back to owning them', () => {
    expect(ownsSharedUploadState(null, second)).toBe(true);
  });
});
