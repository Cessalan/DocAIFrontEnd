import { run_course_intelligence } from './CourseIntelligenceService';

jest.mock('./config', () => ({ API_BASE_URL: 'http://localhost:8000' }));
const { TextEncoder, TextDecoder } = require('util');

describe('course intelligence stream transport', () => {
  const originalFetch = global.fetch;
  const originalDecoder = global.TextDecoder;
  beforeEach(() => { global.TextDecoder = TextDecoder; });
  afterEach(() => { global.fetch = originalFetch; global.TextDecoder = originalDecoder; jest.restoreAllMocks(); });

  it('delivers CRLF events before the connection closes, including split delimiters', async () => {
    const onEvent = jest.fn();
    const chunks = ['data:{"status":"course_material_excerpt","source":{}}\r\n\r', '\n'];
    let finish;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: { getReader: () => ({
      read: () => chunks.length
        ? Promise.resolve({ value: new TextEncoder().encode(chunks.shift()), done: false })
        : new Promise(resolve => { finish = resolve; }),
    }) } });
    const run = run_course_intelligence({ chatId: 'test', materialsOnly: true, onEvent });
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'course_material_excerpt' }));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).materials_only).toBe(true);
    finish({ done: true });
    await run.promise;
  });

  it('preserves backend errors instead of silently resolving an empty report', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({ ok: true,
      text: async () => 'data: {"status":"error","message":"session unavailable"}\n\n',
    });
    await expect(run_course_intelligence({ chatId: 'test' }).promise).rejects.toThrow('session unavailable');
  });
});
