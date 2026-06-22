'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { toast } from 'sonner';

function AgencyVeriffCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing verification...');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxPollAttempts = 60;
  const pollAttemptsRef = useRef(0);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!profile?.id) {
      setStatus('error');
      setMessage('User not authenticated');
      return;
    }

    const pollForResults = async (): Promise<void> => {
      if (pollAttemptsRef.current >= maxPollAttempts) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setStatus('loading');
        setMessage('Verification is taking longer than expected. We will notify you when it is complete.');
        toast.info('Verification in progress. Check back soon!');
        setTimeout(() => {
          router.push('/');
        }, 3000);
        return;
      }

      pollAttemptsRef.current += 1;

      try {
        const response = await fetch('/api/agency/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.id,
            sessionId: sessionId || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to check verification status');
        }

        const data = await response.json();

        if (data.verification_status === 'completed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setStatus('success');
          setMessage('Agency verification completed successfully!');
          toast.success('Agency verification completed!');

          setTimeout(() => {
            router.push('/agency-dashboard');
          }, 1500);
        } else if (data.verification_status === 'rejected') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          const isUnderage = data.is_over_18 === false && data.estimated_age !== null;
          setStatus('error');
          setMessage(
            isUnderage
              ? 'You must be at least 18 years old to operate an agency.'
              : 'Verification was not successful. Please try again.'
          );
          toast.error(isUnderage ? 'Age requirement not met.' : 'Verification failed. Please try again.');
        } else {
          setStatus('loading');
          setMessage('Verification in progress...');
        }
      } catch (error: any) {
        console.error('Error polling agency verification status:', error);
      }
    };

    pollForResults();

    if (!pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(pollForResults, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [searchParams, profile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-lg">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg text-green-600">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to your agency dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-lg text-red-600">{message}</p>
            <button
              onClick={() => router.push('/become-an-agency')}
              className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-lg">Loading...</p>
      </div>
    </div>
  );
}

export default function AgencyVeriffCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AgencyVeriffCallbackContent />
    </Suspense>
  );
}
