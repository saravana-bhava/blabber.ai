'use client';

type AppEnv = 'local' | 'staging' | 'production';

type CaptureProperties = Record<string, string | number | boolean | null | undefined>;

const APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV ?? 'local') as AppEnv;
const POSTHOG_KEY =
  APP_ENV === 'production'
    ? process.env.NEXT_PUBLIC_POSTHOG_KEY_PROD
    : process.env.NEXT_PUBLIC_POSTHOG_KEY_DEV;

const DISTINCT_ID_STORAGE_KEY = 'blabber_posthog_distinct_id';
const OPT_OUT_STORAGE_KEY = 'blabber_posthog_opted_out';

function getDistinctId() {
  if (typeof window === 'undefined') return 'server';

  const existing = window.localStorage.getItem(DISTINCT_ID_STORAGE_KEY);
  if (existing) return existing;

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(DISTINCT_ID_STORAGE_KEY, next);
  return next;
}

export function isPostHogConfigured() {
  return Boolean(POSTHOG_KEY);
}

export function optOutPostHog() {
  window.localStorage.setItem(OPT_OUT_STORAGE_KEY, 'true');
}

export function optInPostHog() {
  window.localStorage.removeItem(OPT_OUT_STORAGE_KEY);
}

export function isPostHogOptedOut() {
  return window.localStorage.getItem(OPT_OUT_STORAGE_KEY) === 'true';
}

export function initPostHog() {
  if (APP_ENV === 'local') {
    optOutPostHog();
  }
}

export async function capturePostHogEvent(event: string, properties: CaptureProperties = {}) {
  if (!POSTHOG_KEY || isPostHogOptedOut()) return { skipped: true };

  const response = await fetch('/ingest/capture/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: getDistinctId(),
      properties: {
        app_env: APP_ENV,
        $current_url: window.location.href,
        ...properties,
      },
    }),
  });

  return {
    skipped: false,
    ok: response.ok,
    status: response.status,
  };
}
