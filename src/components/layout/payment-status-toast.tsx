'use client';

import { Suspense } from 'react';
import { usePaymentStatusToast } from '@/hooks/usePaymentStatusToast';

function PaymentStatusToastContent() {
  usePaymentStatusToast();
  return null;
}

export function PaymentStatusToast() {
  return (
    <Suspense fallback={null}>
      <PaymentStatusToastContent />
    </Suspense>
  );
}

