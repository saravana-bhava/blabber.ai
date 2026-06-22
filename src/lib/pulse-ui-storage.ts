const STORAGE_KEY = 'blabber_pulse_ui';

/** When false, the app uses classic UI (no Pulse Engine motion). */
export type PulseUIMode = 'pulse' | 'classic';

export function getStoredPulseMode(): PulseUIMode | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'classic' || v === 'pulse') return v;
  return null;
}

export function setStoredPulseMode(mode: PulseUIMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

/** Env killswitch for production rollback without a deploy. */
export function isPulseDisabledByEnv(): boolean {
  return process.env.NEXT_PUBLIC_BLABBER_PULSE_UI === 'false';
}

export function getDefaultPulseMode(): PulseUIMode {
  if (isPulseDisabledByEnv()) return 'classic';
  return 'pulse';
}
