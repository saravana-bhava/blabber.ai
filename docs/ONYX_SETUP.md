# Onyx Payment Setup

## Environment variables

Set in `.env.local` (see `env.example`):

- **ONYX_API_KEY** – From Onyx dashboard
- **ONYX_MERCHANT_ID** – From Onyx dashboard  
- **ONYX_API_ENDPOINT** – Default `https://dashboard.onyxprocessing.com` (override if using a different endpoint)
- **ONYX_ENVIRONMENT** – `live` or `sandbox`
- **CRON_SECRET** – Secret for the rebill cron (subscription renewals)

## Webhook on Onyx dashboard

**You do not need to set a webhook on the Onyx dashboard for the current flow.**

Payments work like this:

1. User enters card (or uses saved card) → we call Onyx **process** API.
2. If Onyx returns **SUCCESS**, we complete the transaction and (when requested) save the payment method.
3. If Onyx returns **REDIRECT** (3DS), we send the user to the 3DS URL; when they return we call our **check-payment-status** API, which calls Onyx **transaction status** API and then completes the transaction.

So all payment outcomes are driven by our server calling Onyx’s APIs; we don’t rely on Onyx calling us back.

If Onyx’s dashboard offers **optional** webhooks (e.g. for payment success/failure notifications or dispute alerts), you can add them for extra visibility or logging. In that case use a URL like:

`https://your-domain.com/api/onyx-webhook`

and implement that route to verify the webhook (e.g. signature) and log or update state as needed. The app will work correctly without any webhook.

## Subscription rebilling (cron)

Onyx does not manage subscription renewals; we charge saved cards on our side.

1. Set **CRON_SECRET** in your env.
2. Call the rebill endpoint on a schedule (e.g. daily):

   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/onyx-rebill"
   ```

3. **Vercel:** A `vercel.json` cron is included (daily at 12:00 UTC). Set **CRON_SECRET** in your Vercel project env; Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when invoking the cron. No extra config needed.

4. The route finds all **onyx** subscriptions whose `current_period_ends_at` is in the past, charges the user’s default saved payment method, then extends the period and inserts a `subscription_payments` row.

If a user has no default payment method or the charge fails, that subscription is skipped and an error is logged in the response; you can add retry or notification logic later.
