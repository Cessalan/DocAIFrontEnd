/**
 * In-memory store for pending file uploads.
 *
 * Why this exists:
 *   The landing page (QuizRoomLanding) lets users pick files before navigating
 *   to the chat view. Previously the files were base64-encoded and stored in
 *   sessionStorage. iOS Safari enforces a strict 5 MB sessionStorage quota, so
 *   any file larger than ~3.5 MB (before base64 inflation) silently failed.
 *
 *   Because the app is a single-page React Router app, an in-memory store
 *   survives client-side navigations. We only fall back to sessionStorage for
 *   the small metadata object (filenames, flags) — never for binary data.
 *
 * Usage:
 *   - QuizRoomLanding: call setPendingFiles(files, meta) before navigating.
 *   - App.js (ChatLayout): call getPendingFiles() to retrieve them once.
 *   - Login/SignUp: call hasPendingFiles() to decide redirect.
 */

let _pendingFiles = null;
let _pendingMeta = null;

export function setPendingFiles(files, meta) {
  _pendingFiles = files;
  _pendingMeta = meta;

  // Also store lightweight metadata in sessionStorage so Login/SignUp
  // can detect the pending upload and redirect to /c after auth.
  try {
    sessionStorage.setItem('pendingUploadState', JSON.stringify(meta));
  } catch {
    // sessionStorage full or unavailable — the in-memory store still works
    // as long as the user doesn't do a full page reload before uploading.
  }
}

export function getPendingFiles() {
  const files = _pendingFiles;
  const meta = _pendingMeta;
  // Clear after retrieval (one-shot)
  _pendingFiles = null;
  _pendingMeta = null;
  try {
    sessionStorage.removeItem('pendingUploadState');
    sessionStorage.removeItem('pendingUploadFiles');
  } catch {
    // ignore
  }
  return { files, meta };
}

export function hasPendingFiles() {
  if (_pendingFiles && _pendingFiles.length > 0) return true;
  // Fallback: check sessionStorage metadata (covers page-reload edge case)
  try {
    return !!sessionStorage.getItem('pendingUploadState');
  } catch {
    return false;
  }
}

export function clearPendingFiles() {
  _pendingFiles = null;
  _pendingMeta = null;
  try {
    sessionStorage.removeItem('pendingUploadState');
    sessionStorage.removeItem('pendingUploadFiles');
  } catch {
    // ignore
  }
}
