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
  integrations: [Sentry.replayIntegration()],

  tracesSampleRate: isLocal ? 0 : isProduction ? 0.1 : 0.5,
  replaysSessionSampleRate: isProduction ? 0.05 : 0,
  replaysOnErrorSampleRate: isLocal ? 0 : isProduction ? 1.0 : 0.2,

  beforeSend(event) {
    const exception = event.exception?.values?.[0];
    const message = (exception?.value ?? '').toLowerCase();

    if (message.includes('too many requests')) return null;
    if (message.includes('jwt') && message.includes('expired')) return null;

    const websocketCloseCode = event.extra?.websocket_close_code;
    if (websocketCloseCode === 1000 || websocketCloseCode === 1001) return null;

    const hasExtensionFrame = exception?.stacktrace?.frames?.some((frame) =>
      frame.filename?.includes('extension://')
    );
    if (hasExtensionFrame) return null;

    if (event.request?.cookies) event.request.cookies = {};

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
