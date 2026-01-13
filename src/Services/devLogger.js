/**
 * Development-only logging utility
 *
 * Usage:
 *   import { devLog } from '../Services/devLogger';
 *   devLog('Message', data);
 *
 * In production builds, these calls produce no output and minimal overhead.
 */

const isDev = process.env.NODE_ENV === 'development';

export const devLog = (...args) => {
  if (isDev) console.log(...args);
};

export const devWarn = (...args) => {
  if (isDev) console.warn(...args);
};

export default devLog;
