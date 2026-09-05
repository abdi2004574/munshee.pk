import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initErrorTracking() {
  if (!SENTRY_DSN) {
    console.info('[errors] Sentry not configured (VITE_SENTRY_DSN not set) — skipping');
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
  console.info('[errors] Sentry initialized');
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}
