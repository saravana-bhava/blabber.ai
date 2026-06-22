import * as Sentry from '@sentry/nextjs';

type AppEnv = 'local' | 'staging' | 'production';

const ENV = (process.env.NEXT_PUBLIC_APP_ENV ?? 'local') as AppEnv;
const isProduction = ENV === 'production';
const isLocal = ENV === 'local';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !isLocal,
  environment: ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: isLocal ? 0 : isProduction ? 0.1 : 0.5,
  beforeSend(event) {
    if (event.request?.cookies) event.request.cookies = {};
    return event;
  },
});
