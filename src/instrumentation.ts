import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    await registerPostHogLogger();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

async function registerPostHogLogger() {
  if (globalThis.__posthogLoggerProvider) return;

  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
  const posthogKey =
    appEnv === 'production'
      ? process.env.NEXT_PUBLIC_POSTHOG_KEY_PROD
      : process.env.NEXT_PUBLIC_POSTHOG_KEY_DEV;

  if (!posthogKey) return;

  const [{ OTLPLogExporter }, { resourceFromAttributes }, { LoggerProvider, SimpleLogRecordProcessor }] =
    await Promise.all([
      import('@opentelemetry/exporter-logs-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/sdk-logs'),
    ]);

  const exporter = new OTLPLogExporter({
    url: 'https://us.i.posthog.com/otlp/v1/logs',
    headers: {
      Authorization: `Bearer ${posthogKey}`,
    },
  });

  const loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({
      'service.name': 'blabber-web',
      'deployment.environment': appEnv,
    }),
    processors: [new SimpleLogRecordProcessor(exporter)],
  });

  globalThis.__posthogLoggerProvider = loggerProvider;
  globalThis.__posthogLogger = loggerProvider.getLogger('blabber-web');
}
