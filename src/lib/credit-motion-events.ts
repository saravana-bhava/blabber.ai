/** Full-screen particle burst from credits badge → creator (credit-based flows only). */
export const BLABBER_CREDIT_MOTION = 'blabber:credit-motion';

/** One-shot PulseGlow on the profile SUBSCRIBE control after a successful subscription. */
export const BLABBER_SUBSCRIBE_BUTTON_PULSE = 'blabber:subscribe-button-pulse';

export type CreditMotionDetail = {
  creatorProfileId: string;
  /** Shown in floating label, e.g. "+25 Credits" or "+$5" */
  label: string;
};

export function dispatchCreditMotion(detail: CreditMotionDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BLABBER_CREDIT_MOTION, { detail }));
}

export function dispatchSubscribeButtonPulse(creatorProfileId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BLABBER_SUBSCRIBE_BUTTON_PULSE, { detail: { creatorProfileId } })
  );
}
