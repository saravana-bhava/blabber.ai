'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function GoatCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // GOAT echoes the transaction id back to us as a query param after a 3DS /
    // step-up redirect. We don't yet know the exact key name they use, so accept
    // a few common variants — adjust this list once the live integration is wired.
    const transactionId =
      searchParams.get('transaction_id') ||
      searchParams.get('transactionId') ||
      searchParams.get('order_id') ||
      searchParams.get('id');
    const returnUrl =
      searchParams.get('returnUrl') ||
      searchParams.get('return_url') ||
      window.location.origin;

    if (!transactionId) {
      setError('Missing transaction_id');
      const url = new URL(returnUrl);
      url.searchParams.set('payment', 'failed');
      url.searchParams.set('reason', 'missing_transaction_id');
      router.replace(url.toString());
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/goat/check-payment-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction_id: transactionId }),
        });
        const data = await res.json();

        if (cancelled) return;

        const baseUrl = typeof returnUrl === 'string' ? returnUrl : window.location.origin;
        const url = new URL(baseUrl);

        if (data.status === 'success') {
          url.searchParams.set('payment', 'success');
          if (data.transaction_id) url.searchParams.set('transaction_id', data.transaction_id);
        } else {
          url.searchParams.set('payment', 'failed');
          if (data.message) url.searchParams.set('reason', data.message);
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

export default function GoatCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      }
    >
      <GoatCallbackContent />
    </Suspense>
  );
}
