'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export function AgeVerificationModal({ isOpen, onClose, onVerified }: AgeVerificationModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleAgeVerification = (isOver18: boolean) => {
    if (isOver18) {
      onVerified();
    } else {
      setIsRedirecting(true);
      // Redirect to Google after a short delay
      setTimeout(() => {
        window.location.href = 'https://www.google.com';
      }, 1000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur effect */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={() => {
          if (!isRedirecting) {
            onClose();
          }
        }}
      />
      
      {/* Modal content */}
      <div className="relative bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4 border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Age Verification Required</h2>
        </div>
        
        <div className="space-y-4">
          <div className="text-left">
            <p className="text-lg font-semibold mb-2">
              Are you over the age of 18?
            </p>
            <p className="text-sm text-muted-foreground">
              This platform contains content intended for adults only. You must be 18 or older to continue.
            </p>
          </div>
          
          {isRedirecting ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleAgeVerification(false)}
              >
                No, I&apos;m under 18
              </Button>
              <Button
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
                onClick={() => handleAgeVerification(true)}
              >
                Yes, I&apos;m 18 or older
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 