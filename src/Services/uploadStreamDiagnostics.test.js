import { upload_files_with_progress } from './FastAPICalls';
import { uploadFailureReason } from './uploadFailure';

jest.mock('./config', () => ({ API_BASE_URL: 'http://localhost:8000' }));
jest.mock('../Firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('./StudyReasoningService', () => ({ loadNodeReasoning: jest.fn(), saveReasoningSummary: jest.fn() }));
const { TextEncoder, TextDecoder } = require('util');

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
