/** Benign browser / third-party warnings we cannot fix in app code. */
const SUPPRESSED_WARN_PATTERNS = [
  /mozAudioCaptured property will soon become unsupported/i,
  /Media Chrome: No style sheet found on style tag of/i,
];

let installed = false;

/**
 * Suppresses known-noisy console warnings from Firefox deprecations and Mux/Media Chrome.
 */
export function installNoisyConsoleWarningFilter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const message = args.map((arg) => String(arg)).join(' ');
    if (SUPPRESSED_WARN_PATTERNS.some((pattern) => pattern.test(message))) {
      return;
    }
    originalWarn(...args);
  };
}
