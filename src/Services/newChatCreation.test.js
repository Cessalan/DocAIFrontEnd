import { provisionalTitle } from './FireBaseServiceChats';
import { generate_title } from './FastAPICalls';

/**
 * Regression cover for the new-conversation blackout.
 *
 * generate_title() used to be awaited BEFORE the chat document was created. A
 * failing or hanging title service therefore destroyed the whole conversation:
 * no chat, no saved message, and the caller fell through to a null chat id and
 * opened a socket to /ws/undefined. The student typed their first message and
 * got nothing at all — no answer, no error, nothing in the sidebar.
 *
 * Two properties matter now:
 *   1. There is always a usable title without any network call.
 *   2. The title call cannot hang forever.
 */
describe('provisionalTitle', () => {
  test('uses the message itself when it is short enough', () => {
    expect(provisionalTitle('what is a MET call')).toBe('what is a MET call');
  });

  test('truncates on a word boundary rather than mid-word', () => {
    const long = 'Ms. Haddad is now presenting with vomiting, abdominal distention, and no stoma output';
    const out = provisionalTitle(long);
    expect(out.length).toBeLessThanOrEqual(51); // 48 + ellipsis
    expect(out.endsWith('...')).toBe(true);
    expect(out).not.toMatch(/\s\.\.\.$/);      // no dangling space before the ellipsis
    expect(long.startsWith(out.replace('...', ''))).toBe(true);
  });

  test('collapses whitespace so pasted case studies do not produce ragged titles', () => {
    expect(provisionalTitle('  a\n\nb   c  ')).toBe('a b c');
  });

  test('never returns empty — a chat always has a name', () => {
    expect(provisionalTitle('')).toBe('New conversation');
    expect(provisionalTitle(null)).toBe('New conversation');
    expect(provisionalTitle(undefined)).toBe('New conversation');
  });
});

describe('generate_title timeout', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  test('aborts instead of hanging when the backend never responds', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // A backend that accepts the connection and then goes quiet — the Cloud Run
    // cold-start case that used to block the first message indefinitely.
    global.fetch = jest.fn((url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    }));

    await expect(generate_title('cardio review', 'en', 30)).rejects.toThrow(/abort/i);

    // Count only the title endpoint: importing the Firebase config also puts
    // the SDK's own background requests through this same global mock.
    const titleCalls = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes('/chat/generate-title')
    );
    expect(titleCalls).toHaveLength(1);
  });

  test('passes the language through instead of defaulting everyone to English', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ title: 'Révision cardio' }) })
    );

    const res = await generate_title('révision cardio', 'fr-CA');

    expect(res.title).toBe('Révision cardio');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).language).toBe('fr');
  });

  test('a rejected title call is the caller\'s to handle, not a silent undefined', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('boom') })
    );

    await expect(generate_title('x')).rejects.toThrow(/500/);
  });
});
