# Stripe Setup Guide

## Environment Variables Required

To use Stripe Connect embedded components and other Stripe features, you need to set up the following environment variables:

### 1. Create a `.env.local` file

Create a `.env.local` file in your project root (if it doesn't exist) and add the following variables:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Base URL for the application (used for business profile URLs)
NEXT_PUBLIC_VOICE_AI_BASE_URL=https://your-domain.com
```

### 2. Get Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Sign in to your Stripe account
3. Copy your **Publishable key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)
4. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)

### 3. Update Your Environment Variables

Replace the placeholder values in your `.env.local` file:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890EFG
STRIPE_SECRET_KEY=sk_test_51ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890EFG
NEXT_PUBLIC_VOICE_AI_BASE_URL=https://your-domain.com
```

### 4. Restart Your Development Server

After updating the environment variables, restart your Next.js development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

## Important Notes

- **Test vs Live Keys**: Use test keys (`pk_test_` and `sk_test_`) for development and testing
- **Security**: Never commit your `.env.local` file to version control
- **Public Key**: The `NEXT_PUBLIC_` prefix makes the key available in the browser (safe to expose)
- **Secret Key**: Keep the secret key secure and only use it on the server side

## Troubleshooting

If you still see "Stripe is not configured" error:

1. Check that your `.env.local` file exists in the project root
2. Verify the environment variable names are exactly as shown
3. Restart your development server
4. Check the browser console for any additional error messages

## Next Steps

Once Stripe is configured, you should be able to:
- Access the payouts tab in the creator dashboard
- Complete Stripe onboarding in the become-a-creator page
- Use all Stripe-related features in the application 