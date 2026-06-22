'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Map Epoch decline reason codes to user-friendly messages
// Based on Epoch Dynamic Pricing v54.3 documentation
const declineMessages: Record<string, { title: string; description: string }> = {
  'NDECLINED': {
    title: 'Payment Declined',
    description: 'Your payment was declined by your bank. Please check your card details or try a different payment method.',
  },
  'NDECLINEDE': {
    title: 'Payment Declined',
    description: 'Payment declined due to velocity limits. Please try again later.',
  },
  'NDECLINEDINSFUNDS': {
    title: 'Insufficient Funds',
    description: 'Your account does not have sufficient funds. Please use a different payment method.',
  },
  'NDECLINEDCVV2': {
    title: 'Invalid CVV',
    description: 'The CVV code you entered is incorrect. Please check and try again.',
  },
  'NMYINVINFO': {
    title: 'Invalid Information',
    description: 'One or more payment details are invalid. Please check and try again.',
  },
  'NINVCVV2': {
    title: 'Invalid CVV',
    description: 'The CVV code you entered is incorrect. Please check and try again.',
  },
  'NEXPIRED': {
    title: 'Card Expired',
    description: 'Your card has expired. Please use a different payment method.',
  },
  'NMYINVALIDEXP': {
    title: 'Invalid Expiration Date',
    description: 'The card expiration date is invalid. Please check and try again.',
  },
  'NMYINVCARDEXPIRATION': {
    title: 'Invalid Expiration Date',
    description: 'The card expiration date is invalid. Please check and try again.',
  },
  'NMYTESTDENIAL': {
    title: 'Test Card Denied',
    description: 'Test cards are not accepted. Please use a real payment method.',
  },
  'NMYDENIED': {
    title: 'Payment Denied',
    description: 'Your payment was denied. Please try again or contact support.',
  },
  'NMYRETRY': {
    title: 'Payment Error',
    description: 'There was a problem processing your payment. Please try again.',
  },
  'NMYDUPLICATE': {
    title: 'Duplicate Transaction',
    description: 'This appears to be a duplicate transaction. Please contact support if you believe this is an error.',
  },
  'NMYCNDB': {
    title: 'Card Not Accepted',
    description: 'This card type is not accepted. Please use a different payment method.',
  },
  'NMYNOTACCEPTED': {
    title: 'Payment Type Not Accepted',
    description: 'This payment type is not accepted. Please use a different payment method.',
  },
  'NMYBLOCKEDZIP': {
    title: 'Postal Code Not Allowed',
    description: 'The postal code you entered is not allowed. Please contact support.',
  },
  'NMYDNVEL': {
    title: 'Too Many Declines',
    description: 'Too many payment attempts have been declined. Please try again later or contact support.',
  },
  'NINVDATA': {
    title: 'Invalid Payment Data',
    description: 'Please contact your bank for further information about this decline.',
  },
  'NBADZIP': {
    title: 'Invalid Postal Code',
    description: 'The postal code you entered is invalid. Please check and try again.',
  },
};

/**
 * Hook to show payment status toasts based on URL parameters
 * Call this in pages that users are redirected to after payment
 */
export function usePaymentStatusToast() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const payment = searchParams.get('payment');
    const declineCode = searchParams.get('declineCode');
    const paymentType = searchParams.get('paymentType');

    if (payment === 'success') {
      // Show success toast
      const typeMessages: Record<string, string> = {
        credit: 'Credits purchased successfully!',
        subscription: 'Subscription activated successfully!',
        tip: 'Tip sent successfully!',
        ppv: 'Content unlocked successfully!',
        product: 'Product purchased successfully!',
      };

      const message = paymentType && typeMessages[paymentType] 
        ? typeMessages[paymentType]
        : 'Payment successful!';

      toast.success(message, {
        description: 'Your payment has been processed successfully.',
      });

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('paymentType');
      router.replace(url.pathname + url.search);
    } else if (payment === 'failed' && declineCode) {
      // Show error toast based on decline code
      const declineInfo = declineMessages[declineCode];
      
      if (declineInfo) {
        toast.error(declineInfo.title, {
          description: declineInfo.description,
          duration: 5000,
        });
      } else if (declineCode === 'cancelled') {
        toast.error('Payment Cancelled', {
          description: 'The payment was cancelled. You can try again when ready.',
          duration: 5000,
        });
      } else {
        // Generic decline message for unknown codes
        toast.error('Payment Declined', {
          description: `Payment was declined (code: ${declineCode}). Please try again or contact support.`,
          duration: 5000,
        });
      }

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('declineCode');
      url.searchParams.delete('paymentType');
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);
}

