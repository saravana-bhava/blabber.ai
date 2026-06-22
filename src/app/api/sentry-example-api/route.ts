import * as Sentry from "@sentry/nextjs";
export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring
export async function GET() {
  Sentry.logger.info("Sentry example API called");
  const error = new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
  Sentry.captureException(error);
  await Sentry.flush(2000);
  throw error;
}
