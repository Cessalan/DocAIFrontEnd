import {
  uploadFailureReason, describeUploadFailure,
  markUploadStarted, touchUpload, markUploadEnded, takeInterruptedUploads,
  IN_FLIGHT_KEY, INTERRUPTED_AFTER_MS, FORGET_AFTER_MS,
} from './uploadFailure';

const failed = (message, { code, name, upload } = {}) => {
  const error = name === 'TypeError' ? new TypeError(message) : new Error(message);
  if (code) error.code = code;
  if (upload) error.upload = upload;
  return error;
};

const memoryStorage = () => {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    data,
  };
};

describe('uploadFailureReason', () => {
  test('a backend code is its own reason, each points at a different fix', () => {
    expect(uploadFailureReason(failed('x', { code: 'capacity' }))).toBe('capacity');
    expect(uploadFailureReason(failed('x', { code: 'legacy_office' }))).toBe('legacy_office');
    expect(uploadFailureReason(failed('x', { code: 'processing_failed' }))).toBe('processing_failed');
  });

  test('the timer that fired names the timeout', () => {
    expect(uploadFailureReason(failed('t', { upload: { timer: 'first_byte' } }))).toBe('first_byte_timeout');
    expect(uploadFailureReason(failed('t', { upload: { timer: 'stall' } }))).toBe('stall_timeout');
    expect(uploadFailureReason(failed('t', { upload: { timer: 'overall' } }))).toBe('overall_timeout');
  });

  test('an http status and an early end are told apart', () => {
    expect(uploadFailureReason(failed('Upload failed: Bad Gateway', { upload: { status: 502 } }))).toBe('http_502');
    expect(uploadFailureReason(failed('lost', { upload: { endedEarly: true } }))).toBe('stream_ended_early');
  });

  test('a fetch that dies while the phone is locked is not a network fault', () => {
    expect(uploadFailureReason(failed('Load failed', { name: 'TypeError', upload: { wasHidden: true } })))
      .toBe('network_while_hidden');
    expect(uploadFailureReason(failed('Failed to fetch', { name: 'TypeError', upload: { online: false } })))
      .toBe('offline');
    expect(uploadFailureReason(failed('Failed to fetch', { name: 'TypeError', upload: {} }))).toBe('network');
  });

  test('an unknown backend code is kept, not lost in "unknown"', () => {
    expect(uploadFailureReason(failed('x', { code: 'something_new' }))).toBe('backend_something_new');
    expect(uploadFailureReason(failed('x'))).toBe('unknown');
    expect(uploadFailureReason(undefined)).toBe('unknown');
  });
});

test('describeUploadFailure carries what the upload knew, nulls where it knew nothing', () => {
  const row = describeUploadFailure(failed('Upload timed out - the connection went silent', {
    upload: { timer: 'stall', phase: 'streaming', lastEvent: 'embedding_progress', eventsSeen: 14,
      filesCompleted: 2, totalBytes: 9e6, elapsedMs: 118000, wasHidden: false, online: true, connection: '4g' },
  }));
  expect(row).toEqual({
    reason: 'stall_timeout', errorCode: null,
    errorMessage: 'Upload timed out - the connection went silent',
    phase: 'streaming', lastEvent: 'embedding_progress', eventsSeen: 14, filesCompleted: 2,
    totalBytes: 9e6, elapsedMs: 118000, wasHidden: false, online: true, connection: '4g',
  });
  expect(describeUploadFailure(new Error('x')).phase).toBeNull();
  expect(describeUploadFailure(new Error('y'.repeat(500))).errorMessage).toHaveLength(200);
});

describe('in-flight marker', () => {
  test('a finished upload leaves nothing behind', () => {
    const store = memoryStorage();
    markUploadStarted(store, 'f1', { startedAt: 1000, fileCount: 2 });
    touchUpload(store, 'f1', { lastEvent: 'file_complete' });
    markUploadEnded(store, 'f1');
    expect(store.data[IN_FLIGHT_KEY]).toBeUndefined();
    expect(takeInterruptedUploads(store, 10 ** 9)).toEqual([]);
  });

  test('an upload the page never finished is reported once, with how far it got', () => {
    const store = memoryStorage();
    markUploadStarted(store, 'f1', { startedAt: 0, fileCount: 6 });
    touchUpload(store, 'f1', { lastEvent: 'embedding_progress', lastEventAt: 40000 });
    const now = INTERRUPTED_AFTER_MS + 1;
    expect(takeInterruptedUploads(store, now)).toEqual([{
      funnelId: 'f1', startedAt: 0, fileCount: 6, lastEvent: 'embedding_progress', lastEventAt: 40000, ageMs: now,
    }]);
    expect(takeInterruptedUploads(store, now)).toEqual([]);
  });

  test('a young marker may belong to another open tab and is left alone', () => {
    const store = memoryStorage();
    markUploadStarted(store, 'live', { startedAt: 1000 });
    expect(takeInterruptedUploads(store, 1000 + INTERRUPTED_AFTER_MS - 1)).toEqual([]);
    expect(JSON.parse(store.data[IN_FLIGHT_KEY])).toHaveProperty('live');
  });

  test('a marker weeks old is dropped without a late row', () => {
    const store = memoryStorage();
    markUploadStarted(store, 'old', { startedAt: 0 });
    expect(takeInterruptedUploads(store, FORGET_AFTER_MS + 1)).toEqual([]);
    expect(store.data[IN_FLIGHT_KEY]).toBeUndefined();
  });

  test('touching an upload that already ended does not bring it back', () => {
    const store = memoryStorage();
    touchUpload(store, 'gone', { lastEvent: 'heartbeat' });
    expect(store.data[IN_FLIGHT_KEY]).toBeUndefined();
  });

  test('blocked or corrupt storage never breaks an upload', () => {
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
    expect(() => markUploadStarted(throwing, 'f1', {})).not.toThrow();
    expect(takeInterruptedUploads(throwing)).toEqual([]);
    expect(() => markUploadStarted(null, 'f1', {})).not.toThrow();
    const corrupt = memoryStorage();
    corrupt.setItem(IN_FLIGHT_KEY, '{not json');
    expect(takeInterruptedUploads(corrupt)).toEqual([]);
  });
});
