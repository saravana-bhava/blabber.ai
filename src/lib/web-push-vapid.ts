import webpush from 'web-push';

let vapidConfigured = false;

/** Call before webpush.sendNotification. Safe at module load / build time (no-op if keys missing). */
export function ensureWebPushVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails('mailto:accounts@blabber.ai', publicKey, privateKey);
  vapidConfigured = true;
  return true;
}
