'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function EpochCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ans = searchParams.get('ans');
    const type = searchParams.get('type');
    const returnUrl = searchParams.get('returnUrl');

    // Redirect immediately - don't show loading state
    if (ans === 'Y' || ans === 'y' || ans === '1') {
      // Payment successful
      
      // Redirect back to original page with success param
      const baseUrl = returnUrl || window.location.origin;
      const url = new URL(baseUrl);
      url.searchParams.set('payment', 'success');
      if (type) {
        url.searchParams.set('paymentType', type);
      }
      router.replace(url.toString());
    } else {
      // Payment failed or cancelled
      
      // Get decline reason code for URL param
      let declineCode = ans || 'cancelled';
      if (ans) {
      } else {
      }
      
      // Redirect back to original page with error params
      const baseUrl = returnUrl || window.location.origin;
      const url = new URL(baseUrl);
      url.searchParams.set('payment', 'failed');
      url.searchParams.set('declineCode', declineCode);
      if (type) {
        url.searchParams.set('paymentType', type);
      }
      router.replace(url.toString());
    }
  }, [searchParams, router]);

  // Show minimal loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );
}

export default function EpochCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    }>
      <EpochCallbackContent />
    </Suspense>
  );
}

