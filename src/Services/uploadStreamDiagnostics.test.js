import { upload_files_with_progress } from './FastAPICalls';
import { uploadFailureReason } from './uploadFailure';

jest.mock('./config', () => ({ API_BASE_URL: 'http://localhost:8000' }));
jest.mock('../Firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('./StudyReasoningService', () => ({ loadNodeReasoning: jest.fn(), saveReasoningSummary: jest.fn() }));
jest.mock('./storageUpload', () => ({
  ...jest.requireActual('./storageUpload'),
  stageFilesInStorage: jest.fn((files) => Promise.resolve(files.map(f => f.name))),
}));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), uploadBytesResumable: jest.fn() }));
const { stageFilesInStorage } = require('./storageUpload');
const { TextEncoder, TextDecoder } = require('util');
// CRA resets mock implementations before each test.
beforeEach(() => stageFilesInStorage.mockImplementation((files) => Promise.resolve(files.map(f => f.name))));

const file = (name, size) => ({ name, size });
const streaming = (lines) => {
  const chunks = lines.map(l => new TextEncoder().encode(JSON.stringify(l) + '\n'));
  return { ok: true, body: { getReader: () => ({
    read: () => Promise.resolve(chunks.length ? { value: chunks.shift(), done: false } : { done: true }),
  }) } };
};
const failure = async (promise) => {
  try { await promise; } catch (error) { return error; }
  throw new Error('expected the upload to fail');
};

describe('upload stream failure diagnostics', () => {
  const originalFetch = global.fetch;
  const originalDecoder = global.TextDecoder;
  beforeEach(() => {
    global.TextDecoder = TextDecoder;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { global.fetch = originalFetch; global.TextDecoder = originalDecoder; jest.restoreAllMocks(); });

  it('a stream that ends without all_complete says how far it got', async () => {
    global.fetch = jest.fn().mockResolvedValue(streaming([
      { type: 'batch_start' }, { type: 'heartbeat' }, { type: 'file_complete', file_id: 'a', word_count: 10 },
    ]));
    const error = await failure(upload_files_with_progress([file('a.pdf', 100), file('b.pdf', 200)], 'c1', () => {}, 'en'));
    expect(uploadFailureReason(error)).toBe('stream_ended_early');
    expect(error.upload).toMatchObject({
      phase: 'streaming', lastEvent: 'file_complete', eventsSeen: 2, filesCompleted: 1, totalBytes: 300,
    });
    expect(error.upload.elapsedMs).toEqual(expect.any(Number));
  });

  it('a non-2xx response records its status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable', text: () => Promise.resolve('') });
    const error = await failure(upload_files_with_progress([file('a.pdf', 1)], 'c1', () => {}, 'en'));
    expect(uploadFailureReason(error)).toBe('http_503');
  });

  it('a fetch that never connects fails in the sending phase', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await failure(upload_files_with_progress([file('a.pdf', 1)], 'c1', () => {}, 'en'));
    expect(error.upload.phase).toBe('sending');
    expect(['network', 'offline']).toContain(uploadFailureReason(error));
  });

  it('a backend batch error keeps its code', async () => {
    global.fetch = jest.fn().mockResolvedValue(streaming([{ type: 'error', code: 'legacy_office', message: 'x' }]));
    const error = await failure(upload_files_with_progress([file('a.ppt', 1)], 'c1', () => {}, 'en'));
    expect(uploadFailureReason(error)).toBe('legacy_office');
  });

  it('sends the upload id so the row can be matched to the server log', async () => {
    global.fetch = jest.fn().mockResolvedValue(streaming([{ type: 'all_complete' }]));
    await upload_files_with_progress([file('a.pdf', 1)], 'c1', () => {}, 'en', { clientUploadId: 'f_1' });
    expect(global.fetch.mock.calls[0][1].body.get('client_upload_id')).toBe('f_1');
  });
});

describe('uploads go through Firebase Storage first', () => {
  const originalFetch = global.fetch;
  const originalDecoder = global.TextDecoder;
  const MB = 1024 * 1024;
  beforeEach(() => {
    global.TextDecoder = TextDecoder;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { global.fetch = originalFetch; global.TextDecoder = originalDecoder; jest.restoreAllMocks(); });

  it('sends only the stored names, never the bytes, so 32 MB+ decks get through', async () => {
    global.fetch = jest.fn().mockResolvedValue(streaming([{ type: 'all_complete' }]));
    await upload_files_with_progress([file('Renal.pptx', 49 * MB)], 'c1', () => {}, 'en');
    const body = global.fetch.mock.calls[0][1].body;
    expect(stageFilesInStorage).toHaveBeenCalledWith([expect.objectContaining({ name: 'Renal.pptx' })], 'c1');
    expect(JSON.parse(body.get('storage_files'))).toEqual(['Renal.pptx']);
    expect(body.getAll('files')).toEqual([]);
  });

  it('a small batch falls back to the direct request when Storage fails', async () => {
    stageFilesInStorage.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'storage/unauthorized' }));
    global.fetch = jest.fn().mockResolvedValue(streaming([{ type: 'all_complete' }]));
    await upload_files_with_progress([new File(['abc'], 'a.pdf')], 'c1', () => {}, 'en');
    const body = global.fetch.mock.calls[0][1].body;
    expect(body.get('storage_files')).toBeNull();
    expect(body.getAll('files')).toHaveLength(1);
  });

  it('a big batch that cannot reach Storage fails as a staging failure, without calling the backend', async () => {
    stageFilesInStorage.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'storage/retry-limit-exceeded' }));
    global.fetch = jest.fn();
    const error = await failure(upload_files_with_progress([file('big.pptx', 40 * MB)], 'c1', () => {}, 'en'));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(uploadFailureReason(error)).toBe('staging_retry-limit-exceeded');
    expect(error.upload).toMatchObject({ phase: 'staging', staged: false, stagingError: 'storage/retry-limit-exceeded' });
  });

  it('a file over the cap is refused before anything is uploaded', async () => {
    global.fetch = jest.fn();
    const error = await failure(upload_files_with_progress([file('huge.pptx', 151 * MB)], 'c1', () => {}, 'en'));
    expect(stageFilesInStorage).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(error.code).toBe('file_too_large');
    expect(uploadFailureReason(error)).toBe('file_too_large');
  });
});
