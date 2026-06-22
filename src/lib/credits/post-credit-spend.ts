import type { CreditSpendRequest } from '@/lib/payments/credit-spend-types';

export type CreditSpendResponse =
  | { ok: true; creditsCharged?: number }
  | { ok: false; insufficientCredits: boolean; error: string };

export async function postCreditSpend(body: CreditSpendRequest): Promise<CreditSpendResponse> {
  const res = await fetch('/api/credits/spend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    creditsCharged?: number;
  };

  if (res.status === 402 && data.code === 'INSUFFICIENT_CREDITS') {
    return { ok: false, insufficientCredits: true, error: data.error || 'Insufficient credits' };
  }
  if (!res.ok) {
    return {
      ok: false,
      insufficientCredits: false,
      error: data.error || 'Could not complete purchase',
    };
  }
  return { ok: true, creditsCharged: data.creditsCharged };
}
