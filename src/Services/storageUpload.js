/* ══════════════════════════════════════════════════════════════════════
   UPLOADS GO TO FIREBASE STORAGE FIRST (2026-10-22)

   WHY THIS EXISTS
   ───────────────
   An upload used to be one multipart POST to the backend. Cloud Run's front
   end refuses any request body over 32 MiB with a 413 that has no CORS
   header, so the browser saw a bare "network" error a few seconds in. Over
   21 days, 9 of 20 logged failures were over 32 MB, 7 of them a single
   slide deck. Most of the rest were a phone locked mid-send, which kills a
   fetch but only pauses a resumable upload.

   So each file is written straight to chats/{chatId}/uploads/{name} (where
   the backend already kept them) and the backend is sent only the names.
   A Pro student who cancelled wrote "doesnt work half the time".

   MAX_UPLOAD_FILE_BYTES mirrors MAX_STAGED_FILE_BYTES in NQBackEnd2
   services/staged_upload.py. A file over it is refused here, before she
   waits for it to upload.
   ══════════════════════════════════════════════════════════════════════ */
import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../Firebase/config';

export const MAX_UPLOAD_FILE_BYTES = 150 * 1024 * 1024;
// Below this a batch still fits the old one-request path, which is what a
// staging failure falls back to (a Storage outage must not stop small uploads).
export const DIRECT_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
// A resumable upload pauses while a phone is locked and carries on after, so
// this is generous; it only has to end an upload that will never finish.
export const STAGING_TIMEOUT_MS = 10 * 60 * 1000;

/** Files over the per-file cap. Pure. */
export const oversizedFiles = (files) => files.filter(f => (f?.size || 0) > MAX_UPLOAD_FILE_BYTES);

/** Whether a failed staging may fall back to the direct POST. Pure. */
export const canSendDirect = (files) =>
  files.reduce((sum, f) => sum + (f?.size || 0), 0) <= DIRECT_UPLOAD_MAX_BYTES;

/** Fraction of all bytes sent so far, from per-file byte counts. Pure. */
export const stagedFraction = (sentByFile, files) => {
  const total = files.reduce((sum, f) => sum + (f?.size || 0), 0);
  if (!total) return 1;
  const sent = Object.values(sentByFile).reduce((sum, n) => sum + n, 0);
  return Math.min(1, sent / total);
};

/**
 * Upload every file to chats/{chatId}/uploads/{name} with Firebase resumable
 * uploads. Resolves to the names once all are stored. Rejects on the first
 * failure, on `signal` abort, or after STAGING_TIMEOUT_MS; the other uploads
 * are cancelled either way.
 */
export function stageFilesInStorage(files, chatId, { onProgress, signal } = {}) {
  const tasks = [];
  const sentByFile = {};
  const cancelAll = () => tasks.forEach(task => { try { task.cancel(); } catch { /* already done */ } });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      if (fn === reject) cancelAll();
      fn(value);
    };
    const timer = setTimeout(() => {
      const error = new Error('Upload to storage timed out');
      error.code = 'staging_timeout';
      finish(reject, error);
    }, STAGING_TIMEOUT_MS);
    const onAbort = () => {
      const error = new Error('Upload cancelled');
      error.code = 'staging_aborted';
      finish(reject, error);
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener?.('abort', onAbort);

    Promise.all(files.map((file, index) => new Promise((done, fail) => {
      const task = uploadBytesResumable(ref(storage, `chats/${chatId}/uploads/${file.name}`), file,
        file.type ? { contentType: file.type } : undefined);
      tasks.push(task);
      task.on('state_changed',
        snapshot => {
          sentByFile[index] = snapshot.bytesTransferred;
          onProgress?.(stagedFraction(sentByFile, files));
        },
        fail,
        () => done(file.name));
    })))
      .then(names => finish(resolve, names))
      .catch(error => finish(reject, error));
  });
}
