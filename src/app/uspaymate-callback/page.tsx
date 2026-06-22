'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function UsPaymateCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const orderKey =
      searchParams.get('order_key') ||
      searchParams.get('orderKey') ||
      searchParams.get('order');
    const type = searchParams.get('type');
    const returnUrl = searchParams.get('returnUrl') || window.location.origin;

    if (!orderKey) {
      setError('Missing order_key');
      const url = new URL(returnUrl);
      url.searchParams.set('payment', 'failed');
      url.searchParams.set('reason', 'missing_order_key');
      router.replace(url.toString());
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/uspaymate/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_key: orderKey }),
        });
        const data = await res.json();

        if (cancelled) return;

        const baseUrl = typeof returnUrl === 'string' ? returnUrl : window.location.origin;
        const url = new URL(baseUrl);

        if (data.status === 'success' || data.alreadyFulfilled) {
          url.searchParams.set('payment', 'success');
          if (type) url.searchParams.set('paymentType', type);
          if (data.payment_intent_id) {
            url.searchParams.set('transaction_id', data.payment_intent_id);
          }
        } else if (data.status === 'expired') {
          url.searchParams.set('payment', 'failed');
          url.searchParams.set('reason', 'session_expired');
          if (type) url.searchParams.set('paymentType', type);
        } else {
          url.searchParams.set('payment', 'pending');
          if (type) url.searchParams.set('paymentType', type);
        }

        router.replace(url.toString());
      } catch (_err) {
        if (!cancelled) {
          setError('Could not verify payment');
          const url = new URL(returnUrl);
          url.searchParams.set('payment', 'failed');
          url.searchParams.set('reason', 'error');
          router.replace(url.toString());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );
}

export default function UsPaymateCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      }
    >
      <UsPaymateCallbackContent />
    </Suspense>
  );
}
