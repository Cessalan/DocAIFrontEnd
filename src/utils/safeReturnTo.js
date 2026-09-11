/**
 * safeReturnTo — sanitise a post-auth redirect target.
 *
 * The SEO landing pages in `public/` are static HTML, so the only way they can
 * tell the app where a visitor was headed is a query string:
 * `/signup?returnTo=/nclex`. That value is attacker-controllable (anyone can
 * mail out a NurseQuizAI signup link), so it must never be handed to
 * `navigate()` unchecked — `?returnTo=https://evil.example` would turn our own
 * auth page into an open redirect, and `//evil.example` is the same attack
 * wearing a protocol-relative disguise.
 *
 * Rule: accept only a same-origin absolute path. One leading slash, never two,
 * no scheme, no backslashes (IE/Edge historically normalised `\` to `/`).
 * Anything else returns null and the caller falls back to its own default.
 */

const HAS_SCHEME = /^\/[a-z][a-z0-9+.-]*:/i;

// Backslash, space and C0 control characters are normalisation tricks, not
// path characters. Tested by codepoint rather than a regex range so that no
// raw control bytes end up embedded in this source file.
function hasUnsafeChar(s) {
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true; // C0 controls and DEL
    if (s[i] === '\\' || s[i] === ' ') return true;
  }
  return false;
}

export function safeReturnTo(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Must be an absolute path, and exactly one leading slash.
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;

  if (hasUnsafeChar(trimmed)) return null;

  // A scheme can only appear here via encoding games; reject outright.
  if (HAS_SCHEME.test(trimmed)) return null;

  return trimmed;
}

export default safeReturnTo;
