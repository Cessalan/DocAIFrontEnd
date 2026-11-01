import posthog from 'posthog-js';

/**
 * PostHogService — product analytics alongside Clarity's recordings.
 *
 * Clarity answers "what did this session look like"; PostHog answers "how
 * many students got from step A to step B, and who". So events are tied to
 * the Firebase uid (identify on sign-in, reset on sign-out) and every
 * ClarityService event is forwarded here with its properties.
 *
 * Like Clarity, it only runs in production builds and only when
 * REACT_APP_POSTHOG_KEY is set, so local testing never pollutes the data.
 * Every call swallows failure — analytics must never break a study session.
 */

const KEY = process.env.REACT_APP_POSTHOG_KEY;
const HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';

let started = false;

export const initPostHog = () => {
  if (started || process.env.NODE_ENV !== 'production' || !KEY) return;
  try {
    posthog.init(KEY, {
      api_host: HOST,
      person_profiles: 'identified_only',
      capture_pageview: 'history_change', // SPA route changes count as pageviews
      autocapture: true,
      disable_session_recording: true, // Clarity already records sessions
    });
    started = true;
  } catch { /* Analytics must never interrupt learning. */ }
};

export const phIdentify = (user) => {
  try {
    if (started && user?.uid) posthog.identify(user.uid, { email: user.email || undefined });
  } catch { /* Analytics must never interrupt learning. */ }
};

export const phReset = () => {
  try {
    if (started) posthog.reset();
  } catch { /* Analytics must never interrupt learning. */ }
};

export const phCapture = (name, props) => {
  try {
    if (started && name) posthog.capture(name, props);
  } catch { /* Analytics must never interrupt learning. */ }
};
