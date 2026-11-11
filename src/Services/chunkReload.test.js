import { isChunkLoadError, isHtmlServedAsScript, reloadOnceForChunkError, RELOAD_GUARD_MS } from './chunkReload';

describe('isChunkLoadError', () => {
  it('recognises webpack and native module-load failures', () => {
    const chunk = new Error('Loading chunk 694 failed.\n(missing: https://nursequizai.com/static/js/694.854ed8cc.chunk.js)');
    chunk.name = 'ChunkLoadError';
    expect(isChunkLoadError(chunk)).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk 694 failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
  });

  it('ignores ordinary errors, including JSON parsed from an HTML page', () => {
    expect(isChunkLoadError(new Error('Missing or insufficient permissions.'))).toBe(false);
    expect(isChunkLoadError(new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('isHtmlServedAsScript', () => {
  it('only counts the parse error when it came from one of our bundles', () => {
    expect(isHtmlServedAsScript({ message: "Uncaught SyntaxError: Unexpected token '<'", filename: 'https://nursequizai.com/static/js/694.854ed8cc.chunk.js' })).toBe(true);
    expect(isHtmlServedAsScript({ message: "Uncaught SyntaxError: Unexpected token '<'", filename: 'https://nursequizai.com/c/abc' })).toBe(false);
    expect(isHtmlServedAsScript({ message: 'Script error.', filename: 'https://nursequizai.com/static/js/main.js' })).toBe(false);
  });
});

describe('reloadOnceForChunkError', () => {
  const realLocation = window.location;
  let reload;

  beforeEach(() => {
    window.sessionStorage.clear();
    reload = jest.fn();
    delete window.location;
    window.location = { reload };
  });

  afterEach(() => {
    window.location = realLocation;
  });

  it('reloads once, then refuses inside the guard window, then allows again', () => {
    const t0 = 1_000_000;
    expect(reloadOnceForChunkError(new Error('x'), t0)).toBe(true);
    expect(reloadOnceForChunkError(new Error('x'), t0 + 1000)).toBe(false);
    expect(reloadOnceForChunkError(new Error('x'), t0 + RELOAD_GUARD_MS + 1)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
