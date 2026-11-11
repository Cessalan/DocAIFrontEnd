import { lazy } from 'react';

// ============================================
// RECOVER FROM A DEPLOY UNDER AN OPEN TAB
// ============================================
// Every deploy replaces the hashed files in build/static, and Firebase Hosting
// answers a request for a file that no longer exists with index.html (the SPA
// rewrite), status 200, text/html. A tab opened before the deploy still asks
// for the old chunk names, so the browser runs HTML as JavaScript:
// "SyntaxError: Unexpected token '<'", then webpack's "ChunkLoadError: Loading
// chunk N failed". PostHog showed this on ~6 students in the first ten days of
// November, each at the moment they clicked into a part of the app they had
// not opened yet (study mode, a mindmap, the exam).
//
// The fix is the boring one: when a chunk fails to load, reload the page once,
// which fetches the new index.html and the new chunk names. A timestamp in
// sessionStorage stops a loop if the chunk is genuinely broken: a second
// failure within RELOAD_GUARD_MS is thrown to the error boundary as before.
// ============================================

const STORAGE_KEY = 'nqChunkReload';
export const RELOAD_GUARD_MS = 30 * 1000;

const CHUNK_PATTERNS = [
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

export const isChunkLoadError = (err) => {
  if (!err) return false;
  if (err.name === 'ChunkLoadError') return true;
  const text = `${err.name || ''} ${err.message || err}`;
  return CHUNK_PATTERNS.some((re) => re.test(text));
};

// "Unexpected token '<'" alone also describes res.json() on an HTML error page,
// which must never reload the app. Only count it when the file that failed to
// parse is one of our own bundles.
export const isHtmlServedAsScript = (event) =>
  /Unexpected token '<'/i.test(String(event?.message || '')) &&
  /\/static\/js\/[^/]+\.js/.test(String(event?.filename || ''));

const readState = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

const writeState = (state) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
};

/**
 * Reload the page unless we already did so in the last RELOAD_GUARD_MS.
 * Returns true when a reload was started.
 */
export const reloadOnceForChunkError = (err, now = Date.now()) => {
  const last = readState();
  if (last && now - last.ts < RELOAD_GUARD_MS) return false;
  // Without sessionStorage there is no loop guard, so don't reload at all.
  if (!writeState({ ts: now, pending: true, message: String(err?.message || err).slice(0, 200) })) {
    return false;
  }
  window.location.reload();
  return true;
};

/**
 * React.lazy that reloads the page once instead of crashing when the chunk is
 * gone. While the reload is in flight the promise never settles, so Suspense
 * keeps showing its fallback rather than flashing an error.
 */
export const lazyWithReload = (factory) =>
  lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnceForChunkError(err)) {
        return new Promise(() => {});
      }
      throw err;
    })
  );

/**
 * Catches the chunk failures that don't go through React.lazy: the plain
 * `await import(...)` calls in services and contexts, and the SyntaxError a
 * script tag throws when it is handed HTML. Call once at startup.
 * `onRecovered` fires on the load after a reload, so the recovery is countable.
 */
export const installChunkErrorReload = ({ onRecovered } = {}) => {
  const last = readState();
  if (last?.pending) {
    writeState({ ...last, pending: false });
    try {
      onRecovered?.(last);
    } catch {
      /* never let telemetry break startup */
    }
  }

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) reloadOnceForChunkError(event.reason);
  });
  window.addEventListener('error', (event) => {
    const err = event.error || { message: event.message };
    if (isChunkLoadError(err) || isHtmlServedAsScript(event)) reloadOnceForChunkError(err);
  });
};
