/**
 * Beta / waitlist mode. Set IS_BETA=true in the environment (e.g. .env.local).
 * Defaults to false when unset or empty.
 */
export function getIsBeta(): boolean {
  const v = process.env.IS_BETA;
  if (v == null || v === "") return false;
  const normalized = v.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}
