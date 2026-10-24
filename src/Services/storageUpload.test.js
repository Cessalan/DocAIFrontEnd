import {
  MAX_UPLOAD_FILE_BYTES, DIRECT_UPLOAD_MAX_BYTES, oversizedFiles, canSendDirect, stagedFraction, stageFilesInStorage,
} from './storageUpload';

jest.mock('../Firebase/config', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({
  ref: jest.fn((storage, path) => ({ path })),
  uploadBytesResumable: jest.fn(),
}));
const { ref, uploadBytesResumable } = require('firebase/storage');

// A fake resumable task: test code drives progress, success and failure.
const fakeTask = () => {
  const task = { cancel: jest.fn() };
  task.on = (event, next, error, complete) => Object.assign(task, { next, error, complete });
  return task;
};

describe('storageUpload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the per-file cap and the direct-upload fallback cap', () => {
    expect(oversizedFiles([{ size: MAX_UPLOAD_FILE_BYTES }, { size: MAX_UPLOAD_FILE_BYTES + 1 }])).toHaveLength(1);
    expect(canSendDirect([{ size: DIRECT_UPLOAD_MAX_BYTES }])).toBe(true);
    expect(canSendDirect([{ size: DIRECT_UPLOAD_MAX_BYTES / 2 }, { size: DIRECT_UPLOAD_MAX_BYTES / 2 + 1 }])).toBe(false);
  });

  it('progress is bytes sent over all bytes, never past 1', () => {
    const files = [{ size: 100 }, { size: 300 }];
    expect(stagedFraction({ 0: 100, 1: 100 }, files)).toBe(0.5);
    expect(stagedFraction({ 0: 500 }, files)).toBe(1);
    expect(stagedFraction({}, [])).toBe(1);
  });

  it('writes each file to the chat uploads folder and resolves with the names', async () => {
    const tasks = [fakeTask(), fakeTask()];
    uploadBytesResumable.mockImplementation(() => tasks[uploadBytesResumable.mock.calls.length - 1]);
    const files = [{ name: 'a.pdf', size: 10, type: 'application/pdf' }, { name: 'b.pptx', size: 30, type: '' }];
    const progress = [];
    const done = stageFilesInStorage(files, 'c1', { onProgress: p => progress.push(p) });
    expect(ref.mock.calls.map(c => c[1])).toEqual(['chats/c1/uploads/a.pdf', 'chats/c1/uploads/b.pptx']);
    expect(uploadBytesResumable.mock.calls[0][2]).toEqual({ contentType: 'application/pdf' });
    expect(uploadBytesResumable.mock.calls[1][2]).toBeUndefined();
    tasks[0].next({ bytesTransferred: 10 });
    tasks[0].complete();
    tasks[1].next({ bytesTransferred: 30 });
    tasks[1].complete();
    await expect(done).resolves.toEqual(['a.pdf', 'b.pptx']);
    expect(progress).toEqual([0.25, 1]);
  });

  it('one failed file cancels the others and rejects with its code', async () => {
    const tasks = [fakeTask(), fakeTask()];
    uploadBytesResumable.mockImplementation(() => tasks[uploadBytesResumable.mock.calls.length - 1]);
    const done = stageFilesInStorage([{ name: 'a.pdf', size: 1 }, { name: 'b.pdf', size: 1 }], 'c1');
    tasks[1].error(Object.assign(new Error('denied'), { code: 'storage/unauthorized' }));
    await expect(done).rejects.toMatchObject({ code: 'storage/unauthorized' });
    expect(tasks[0].cancel).toHaveBeenCalled();
  });

  it('an abort cancels the uploads', async () => {
    const task = fakeTask();
    uploadBytesResumable.mockReturnValue(task);
    const controller = new AbortController();
    const done = stageFilesInStorage([{ name: 'a.pdf', size: 1 }], 'c1', { signal: controller.signal });
    controller.abort();
    await expect(done).rejects.toMatchObject({ code: 'staging_aborted' });
    expect(task.cancel).toHaveBeenCalled();
  });
});
