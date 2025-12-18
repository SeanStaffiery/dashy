import * as Sentry from '@sentry/vue';
import { warningMsg, statusMsg, statusErrorMsg } from '@/utils/CoolConsole';
import { sessionStorageKeys } from '@/utils/defaults';

/* Makes the current time, like hh:mm:ss */
const makeTime = () => {
  const now = new Date();
  const pad = (digit) => String(digit).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/* Sanitizes error messages to mask sensitive environment variable names before logging */
const sanitizeErrorMessage = (msg) => {
  // Mask environment variable names and their values containing sensitive keywords
  let sanitized = msg
    // Match patterns like MY_PASSWORD=something, MY_TOKEN:abc... or for MY_PASSWORD (and similar) in the message
    .replace(/\b(VUE_APP_)?([A-Z0-9_-]*(PASSWORD|SECRET|TOKEN)[A-Z0-9_-]*)\s*[:=]\s*([^\s,;"']+)/gi, '[REDACTED_ENV]=[REDACTED]')
    // Mask names only (if values not provided)
    .replace(/\b(VUE_APP_)?([A-Z0-9_-]*(PASSWORD|SECRET|TOKEN)[A-Z0-9_-]*)\b/gi, '[REDACTED_ENV]')
    // Also mask values shown in quotes after known keys: for example: 'Missing environmental variable for MY_PASSWORD'
    .replace(/(for|of)\s+\[REDACTED_ENV\]([^\s,;"']*)/gi, 'for [REDACTED_ENV]')
    // Mask common JSON key-value leaks: "token":"something", 'secret' : 'aaaa'
    .replace(/"?(password|secret|token)"?\s*[:=]\s*"?([^",\s}]*)"?/gi, '"$1":"[REDACTED]"');
  return sanitized;
};

/* Appends recent errors to local storage, for viewing in the UI */
const appendToErrorLog = (msg) => {
  let errorLog = sessionStorage.getItem(sessionStorageKeys.ERROR_LOG) || '';
  const sanitizedMsg = sanitizeErrorMessage(msg);
  errorLog += `[${makeTime()}] ${sanitizedMsg}\n`;
  sessionStorage.setItem(sessionStorageKeys.ERROR_LOG, errorLog);
};

/**
 * Function called when an error happens
 * Will call to function which prints helpful message to console
 * If error reporting is enabled, will also log the message to Sentry
 * If you wish to use your own error logging service, put code for it here
 */
export const ErrorHandler = function handler(msg, errorStack) {
  warningMsg(msg, errorStack); // Print to console
  appendToErrorLog(msg); // Save to local storage
  Sentry.captureMessage(`[USER-WARN] ${msg}`); // Report to bug tracker (if enabled)
};

/* Similar to error handler, but for recording general info */
export const InfoHandler = (msg, title) => {
  statusMsg(title || 'Info', msg);
};

/* Outputs warnings caused by the user, such as missing field */
export const WarningInfoHandler = (msg, title, log) => {
  statusErrorMsg(title || 'Warning', msg, log);
};

/* Titles for info logging */
export const InfoKeys = {
  AUTH: 'Authentication',
  CLOUD_BACKUP: 'Cloud Backup & Restore',
  EDITOR: 'Interactive Editor',
  RAW_EDITOR: 'Raw Config Editor',
  VISUAL: 'Layout & Styles',
};

export default ErrorHandler;
