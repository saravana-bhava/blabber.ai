import * as Sentry from '@sentry/nextjs';

type AppEnv = 'local' | 'staging' | 'production';

const ENV = (process.env.NEXT_PUBLIC_APP_ENV ?? 'local') as AppEnv;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: ENV !== 'local',
  environment: ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0,
});
