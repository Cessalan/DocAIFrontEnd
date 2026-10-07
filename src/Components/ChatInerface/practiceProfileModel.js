/* ══════════════════════════════════════════════════════════════════════
   PRACTICE PROFILE — what this chat remembers about the practice she wants.

   WHY THIS EXISTS
   ───────────────
   On 2026-09-28 a Pro student wrote "i dont want the in order questions".
   The next batch obeyed; "more questions" brought them straight back; the
   next day she had to say it again. Settings lived on one quiz message, so
   every new request started from defaults.

   The backend now keeps `chats/{chatId}.practiceProfile` and applies it to
   every batch (NQBackEnd2/services/practice_profile.py). This file is the
   frontend's reading of the same record: the one line that SHOWS her what
   was remembered, and the edit she makes by tapping it. Showing it is half
   the fix: the students in the study couldn't tell what had been kept, so
   they re-typed everything.

   CROSS-REPO CONTRACT
   ───────────────────
   FORMATS, DEFAULT_FORMATS and effectiveFormats() mirror the Python module.
   "casestudy" is the ordering / drag-and-drop question there too. If the two
   disagree, this line promises a mix the next batch doesn't deliver.
   ══════════════════════════════════════════════════════════════════════ */

export const FORMATS = ['mcq', 'sata', 'casestudy', 'true_false', 'matrix', 'unfoldingcase'];
export const DEFAULT_FORMATS = ['mcq', 'sata'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const cleanFormats = values => (Array.isArray(values) ? values : [])
  .map(v => String(v).toLowerCase())
  .map(v => (v === 'ordering' || v === 'bowtie' ? 'casestudy' : v))
  .filter((v, i, all) => FORMATS.includes(v) && all.indexOf(v) === i);

/** The formats the next batch will use: saved allow-list or guess, minus exclusions. Never empty. */
export function effectiveFormats(profile, guess) {
  const excluded = new Set(cleanFormats(profile?.excludedFormats));
  const saved = cleanFormats(profile?.formats);
  const base = saved.length ? saved : (cleanFormats(guess).length ? cleanFormats(guess) : DEFAULT_FORMATS);
  const result = base.filter(f => !excluded.has(f));
  if (result.length) return result;
  return [FORMATS.find(f => !excluded.has(f)) || 'mcq'];
}

/**
 * The pieces of the one-line summary, as i18n keys + values, in reading
 * order. Returns [] when nothing has been remembered yet, so a brand-new
 * chat shows no line at all rather than a row of defaults.
 */
export function describeProfile(profile, guess) {
  if (!profile || typeof profile !== 'object') return [];
  const parts = [];
  const source = profile.source || {};
  if (source.kind === 'uploads' && source.files?.length) {
    parts.push(source.files.length === 1
      ? { key: 'practiceProfile.fromFile', values: { name: source.files[0] } }
      : { key: 'practiceProfile.fromFiles', values: { count: source.files.length } });
  } else if (source.kind === 'pasted') {
    parts.push({ key: 'practiceProfile.fromNotes' });
  }
  const explicit = cleanFormats(profile.formats).length || cleanFormats(profile.excludedFormats).length;
  if (explicit) {
    parts.push({ key: 'practiceProfile.formats', formats: effectiveFormats(profile, guess) });
  }
  if (cleanFormats(profile.excludedFormats).includes('casestudy')) {
    parts.push({ key: 'practiceProfile.noOrdering' });
  }
  if (DIFFICULTIES.includes(profile.difficulty)) {
    parts.push({ key: `practiceProfile.difficulty.${profile.difficulty}` });
  }
  if (profile.emphasis) {
    parts.push({ key: 'practiceProfile.emphasis', values: { text: profile.emphasis } });
  }
  return parts;
}

/**
 * The profile after she switches one format on or off in the settings line.
 * An edit made by hand is a complete statement of what she wants, so it saves
 * the allow-list AND the exclusions: the backend then can't re-add a format
 * from a model's guess on the next "more".
 */
export function toggleFormat(profile, format, on, { guess, now = new Date() } = {}) {
  const current = effectiveFormats(profile, guess);
  const next = on ? [...new Set([...current, format])] : current.filter(f => f !== format);
  if (!next.length) return profile; // the last format can't be switched off
  const ordered = FORMATS.filter(f => next.includes(f));
  return {
    ...(profile || {}),
    formats: ordered,
    excludedFormats: FORMATS.filter(f => !ordered.includes(f)),
    updatedAt: now.toISOString(),
    updatedBy: 'student'
  };
}

export function setDifficulty(profile, difficulty, now = new Date()) {
  if (!DIFFICULTIES.includes(difficulty)) return profile;
  return { ...(profile || {}), difficulty, updatedAt: now.toISOString(), updatedBy: 'student' };
}

/** The settings a quiz's next batch should send, given the chat's profile. */
export function settingsWithProfile(settings, profile) {
  if (!profile) return settings;
  const next = { ...settings, question_types: effectiveFormats(profile, settings?.question_types) };
  if (DIFFICULTIES.includes(profile.difficulty)) next.difficulty = profile.difficulty;
  return next;
}
