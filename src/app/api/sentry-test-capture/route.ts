import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

class SentryJsonTestError extends Error {
  constructor(kind: string) {
    super(`Sentry JSON test error ${kind} ${new Date().toISOString()}`);
    this.name = 'SentryJsonTestError';
  }
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind')?.trim() || 'default';
  const eventId = Sentry.withScope((scope) => {
    scope.setFingerprint(['sentry-json-test', kind]);
    scope.setTag('sentry_test_kind', kind);
    return Sentry.captureException(new SentryJsonTestError(kind));
  });
  const flushed = await Sentry.flush(2000);

  return NextResponse.json({
    eventId,
    flushed,
    kind,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
