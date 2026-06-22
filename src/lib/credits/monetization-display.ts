export function usdCentsToCreditsRequired(amountCents: number, pricePerCreditCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const ppc = Number.isFinite(pricePerCreditCents) && pricePerCreditCents > 0 ? pricePerCreditCents : 5;
  return Math.max(1, Math.ceil(amountCents / ppc));
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatUsdWithCreditsSuffix(
  amountCents: number,
  showCredits: boolean,
  pricePerCreditCents: number
): string {
  const usd = formatUsdFromCents(amountCents);
  if (!showCredits) return usd;
  const c = usdCentsToCreditsRequired(amountCents, pricePerCreditCents);
  return `${usd} (${c} credits)`;
}
