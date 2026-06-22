import { SeverityNumber } from '@opentelemetry/api-logs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const logId = crypto.randomUUID();

  globalThis.__posthogLogger?.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: `PostHog log test ${logId}`,
    attributes: {
      log_id: logId,
      route: '/api/posthog-log-test',
      app_env: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
    },
  });

  await globalThis.__posthogLoggerProvider?.forceFlush();

  return NextResponse.json({
    ok: Boolean(globalThis.__posthogLogger),
    logId,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
  });
}
