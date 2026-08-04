/**
 * StudyReminderService — opt-in "come back tomorrow" nudge.
 *
 * SCOPE / HONEST LIMITS
 * This is a *local* reminder. It uses the browser Notification API, so it can
 * only fire while the site is open, plus a catch-up check the next time the app
 * loads. It is NOT web push and NOT email — neither exists yet (push needs a
 * service worker + VAPID keys + a backend sender; email needs a provider).
 *
 * What it does do, deliberately, is record the INTENT durably:
 *   localStorage['nqStudyReminders'] = { [chatId]: { dueAt, label, type } }
 * so once a push or email sender exists it can consume the same records
 * without re-asking the user for permission or re-designing the opt-in.
 *
 * Permission is only ever requested from a user gesture, after they have
 * completed a node — never on page load. A cold permission prompt gets denied
 * and the denial is sticky, which would poison the channel permanently.
 */

const STORE_KEY = 'nqStudyReminders';
const DEFAULT_HOUR = 18; // 6pm local, next day

const canUseNotifications = () =>
  typeof window !== 'undefined' && 'Notification' in window;

const readStore = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeStore = (data) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked — reminder is best-effort */
  }
};

/** Is the reminder toggle worth rendering at all? */
export const isReminderSupported = () => canUseNotifications();

/**
 * Current state for a session:
 *   'off'      — supported, not enabled
 *   'on'       — enabled and scheduled
 *   'blocked'  — user denied notifications at the browser level
 */
export const getReminderState = (chatId) => {
  if (!canUseNotifications()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const entry = readStore()[chatId];
  return entry && entry.dueAt > Date.now() ? 'on' : 'off';
};

/** Next occurrence of DEFAULT_HOUR, at least ~12h out so it lands tomorrow. */
const nextReminderTime = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(DEFAULT_HOUR, 0, 0, 0);
  return d.getTime();
};

/**
 * Enable a reminder. MUST be called from a user gesture (permission prompt).
 * Returns the resulting state so the caller can reflect it immediately.
 */
export const enableReminder = async (chatId, { label, type } = {}) => {
  if (!canUseNotifications()) return 'unsupported';

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return 'off';
    }
  }
  if (permission !== 'granted') return 'blocked';

  const dueAt = nextReminderTime();
  const store = readStore();
  store[chatId] = { dueAt, label: label || null, type: type || null };
  writeStore(store);

  scheduleIfSoon(chatId, store[chatId]);
  return 'on';
};

export const disableReminder = (chatId) => {
  const store = readStore();
  delete store[chatId];
  writeStore(store);
  const timer = _timers.get(chatId);
  if (timer) {
    clearTimeout(timer);
    _timers.delete(chatId);
  }
  return 'off';
};

const _timers = new Map();

const fire = (chatId, entry) => {
  if (!canUseNotifications() || Notification.permission !== 'granted') return;
  const body = entry.label
    ? `Next up: ${entry.label}`
    : 'Your next study step is ready.';
  try {
    new Notification('Ready when you are', { body, tag: `nq-study-${chatId}` });
  } catch {
    /* some browsers block constructor notifications outside a SW */
  }
  disableReminder(chatId);
};

/** setTimeout only survives while the tab lives; cap at ~24h. */
const scheduleIfSoon = (chatId, entry) => {
  const delay = entry.dueAt - Date.now();
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
  if (_timers.has(chatId)) clearTimeout(_timers.get(chatId));
  _timers.set(chatId, setTimeout(() => fire(chatId, entry), delay));
};

/**
 * Catch-up pass — call once on app start. Fires anything that came due while
 * the app was closed, and re-arms timers for anything still pending.
 */
export const initStudyReminders = () => {
  if (!canUseNotifications() || Notification.permission !== 'granted') return;
  const store = readStore();
  const now = Date.now();
  Object.entries(store).forEach(([chatId, entry]) => {
    if (!entry?.dueAt) return;
    if (entry.dueAt <= now) fire(chatId, entry);
    else scheduleIfSoon(chatId, entry);
  });
};

/** All pending reminders — the seam a future push/email sender reads. */
export const getPendingReminders = () => readStore();

export default {
  isReminderSupported,
  getReminderState,
  enableReminder,
  disableReminder,
  initStudyReminders,
  getPendingReminders,
};
