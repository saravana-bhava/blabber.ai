'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { HelioCheckout } from '@heliofi/checkout-react';
import type { HelioEmbedConfig } from '@heliofi/checkout-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { useUser } from '@/lib/contexts/user-context';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

function CryptoPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { session, profile, isLoading } = useUser();
  const { resolvedTheme } = useTheme();
  const [moonpayConfig, setMoonpayConfig] = useState<any>(null);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paymentType = searchParams.get('type') as 'ppv' | 'tip' | 'product' | 'subscription' | 'credit' | null;
  const transactionId = searchParams.get('transactionId');
  const paymentId = searchParams.get('paymentId'); // For subscriptions

  // Retrieve checkout config from Supabase (secure, can't be manipulated)
  // Only fetch once - prevent re-fetching when app regains focus
  useEffect(() => {
    if (!paymentType || !session?.user || moonpayConfig) return; // Don't refetch if config already exists

    const fetchConfig = async () => {
      try {
        setIsLoadingCheckout(true);
        setError(null);

        // Get the ID (transactionId for most, paymentId for subscriptions)
        const id = paymentId || transactionId;
        if (!id) {
          throw new Error('Missing transaction ID');
        }

        // Build query params
        const params = new URLSearchParams({
          type: paymentType,
          userId: session.user.id, // Include userId for security verification
        });
        if (transactionId) params.set('transactionId', transactionId);
        if (paymentId) params.set('paymentId', paymentId);

        // Fetch config from API (which queries Supabase)
        const response = await fetch(`/api/moonpay/get-checkout-config?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load payment session');
        }

        const config = await response.json();
        setMoonpayConfig(config);
      } catch (err: any) {
        console.error('Error retrieving checkout config:', err);
        setError(err.message || 'Failed to load payment session');
        toast.error(err.message || 'Failed to load payment session');
      } finally {
        setIsLoadingCheckout(false);
      }
    };

    fetchConfig();
  }, [paymentType, session, transactionId, paymentId]); // Removed moonpayConfig from deps to prevent re-fetch

  const handleSuccess = useCallback(async () => {
    toast.success('Payment submitted! Your purchase will be processed shortly.');
    
    // Redirect based on payment type
    // Use data from moonpayConfig for redirect info
    const config = moonpayConfig;
    switch (paymentType) {
      case 'ppv':
        if (config?.additionalJSON?.postId) {
          router.push(`/p/${config.additionalJSON.postId}`);
        } else if (config?.additionalJSON?.messageId) {
          router.push('/messages');
        } else {
          router.push('/home');
        }
        break;
      case 'tip':
        if (config?.additionalJSON?.postId) {
          router.push(`/p/${config.additionalJSON.postId}`);
        } else {
          router.push('/home');
        }
        break;
      case 'product':
        router.push('/marketplace');
        break;
      case 'subscription':
        if (config?.additionalJSON?.creatorUsername) {
          router.push(`/u/${config.additionalJSON.creatorUsername}`);
        } else if (config?.additionalJSON?.creatorId) {
          // Fallback to UUID if username not available
          router.push(`/u/${config.additionalJSON.creatorId}`);
        } else {
          router.push('/subscriptions');
        }
        break;
      case 'credit':
        router.push('/home');
        break;
      default:
        router.push('/home');
    }
  }, [paymentType, moonpayConfig, router]);

  // Memoize MoonPay config - use stable key to prevent re-initialization
  const helioCheckoutConfig = useMemo<HelioEmbedConfig | null>(() => {
    if (!moonpayConfig) return null;
    // Set theme to opposite of app theme (dark app = light checkout, light app = dark checkout)
    const checkoutTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    return {
      paylinkId: String(moonpayConfig.paylinkId),
      amount: String(moonpayConfig.amount),
      additionalJSON: moonpayConfig.additionalJSON,
      display: 'inline' as const,
      theme: {
        themeMode: checkoutTheme,
      },
      onSuccess: handleSuccess,
      onError: (error: unknown) => {
        console.error('MoonPay error:', error);
        toast.error('Payment failed. Please try again.');
      },
      onPending: () => {
        toast.info('Payment is being processed...');
      },
    };
  }, [moonpayConfig, handleSuccess, resolvedTheme]);

  // Generate stable key for HelioCheckout to prevent re-mounting
  const helioCheckoutKey = useMemo(() => {
    if (!moonpayConfig) return null;
    const id = moonpayConfig.paymentId || moonpayConfig.transactionId;
    return `helio-${id}`;
  }, [moonpayConfig]);

  const getPaymentTitle = () => {
    switch (paymentType) {
      case 'ppv':
        return 'Pay with Crypto (PPV)';
      case 'tip':
        return 'Pay with Crypto (Tip)';
      case 'product':
        return 'Pay with Crypto (Product)';
      case 'subscription':
        return 'Pay with Crypto (Subscription)';
      case 'credit':
        return 'Pay with Crypto (Credits)';
      default:
        return 'Pay with Crypto';
    }
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (isLoading || isLoadingCheckout) {
    return (
      <RequireAuth>
        <main className="flex-1 flex flex-col h-[100dvh] md:h-[100svh]">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-96 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </main>
      </RequireAuth>
    );
  }

  if (error || !paymentType) {
    return (
      <RequireAuth>
        <main className="flex-1 flex flex-col h-[100dvh] md:h-[100svh]">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-destructive font-medium">
                  {error || 'Invalid payment request'}
                </p>
              </div>
            </div>
          </div>
        </main>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <main className="flex-1 flex flex-col h-[100dvh] md:h-[100svh]">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => router.back()}
                  className="shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Button>
                <h1 className="text-md uppercase font-semibold">{getPaymentTitle()}</h1>
              </div>

              {moonpayConfig && moonpayConfig.amount && (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Amount</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">${moonpayConfig.amount}</p>
                    {paymentType === 'credit' && moonpayConfig.additionalJSON?.credits && (
                      <p className="text-sm text-muted-foreground">
                        ({moonpayConfig.additionalJSON.credits} credits)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Shipping Address for Product Purchases */}
              {paymentType === 'product' && moonpayConfig?.additionalJSON?.shippingAddress && (
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Shipping Address</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{moonpayConfig.additionalJSON.shippingAddress.name}</p>
                    <p>{moonpayConfig.additionalJSON.shippingAddress.address_line1}</p>
                    {moonpayConfig.additionalJSON.shippingAddress.address_line2 && (
                      <p>{moonpayConfig.additionalJSON.shippingAddress.address_line2}</p>
                    )}
                    <p>
                      {moonpayConfig.additionalJSON.shippingAddress.city}, {moonpayConfig.additionalJSON.shippingAddress.state} {moonpayConfig.additionalJSON.shippingAddress.postal_code}
                    </p>
                    {moonpayConfig.additionalJSON.shippingAddress.country && (
                      <p>{moonpayConfig.additionalJSON.shippingAddress.country}</p>
                    )}
                  </div>
                </div>
              )}

              {paymentType === 'subscription' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-xs text-yellow-600">
                    ⚠️ Crypto subscriptions expire in 30 days and cannot be automatically renewed
                  </p>
                </div>
              )}

              <div className="min-h-[500px] relative overflow-visible w-full max-w-[calc(100vw-2rem)]">
                {helioCheckoutConfig && moonpayConfig && helioCheckoutKey && (
                  <HelioCheckout key={helioCheckoutKey} config={helioCheckoutConfig} />
                )}
              </div>
            </div>
          </div>
        </main>
    </RequireAuth>
  );
}

export default function CryptoPaymentPage() {
  return (
    <Suspense
      fallback={
        <RequireAuth>
          <main className="flex-1 flex flex-col h-[100dvh] md:h-[100svh]">
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-2xl mx-auto">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                  <div className="h-96 bg-muted rounded"></div>
                </div>
              </div>
            </div>
          </main>
        </RequireAuth>
      }
    >
      <CryptoPaymentContent />
    </Suspense>
  );
}

