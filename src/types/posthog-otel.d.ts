import type { Logger } from '@opentelemetry/api-logs';
import type { LoggerProvider } from '@opentelemetry/sdk-logs';

declare global {
  // eslint-disable-next-line no-var
  var __posthogLogger: Logger | undefined;
  // eslint-disable-next-line no-var
  var __posthogLoggerProvider: LoggerProvider | undefined;
}

export {};
