'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface CaptchaProps {
  onVerified: (verified: boolean) => void;
  className?: string;
}

type CharStyle = { transform: string; color: string };

function generateCaptchaText(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCharStyles(length: number): CharStyle[] {
  return Array.from({ length }, () => ({
    transform: `rotate(${Math.random() * 20 - 10}deg)`,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
  }));
}

export function Captcha({ onVerified, className }: CaptchaProps) {
  const [captchaText, setCaptchaText] = useState('');
  const [charStyles, setCharStyles] = useState<CharStyle[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const text = generateCaptchaText();
    setCaptchaText(text);
    setCharStyles(generateCharStyles(text.length));
  }, []);

  const syncVerified = useCallback(
    (input: string, expected: string) => {
      const ok = input.length === expected.length && input === expected;
      setIsVerified(ok);
      onVerified(ok);
    },
    [onVerified]
  );

  const handleRefresh = () => {
    const next = generateCaptchaText();
    setCaptchaText(next);
    setCharStyles(generateCharStyles(next.length));
    setUserInput('');
    setIsVerified(false);
    onVerified(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setUserInput(value);
    syncVerified(value, captchaText);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Verify you&apos;re human</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-8 w-8 p-0"
          aria-label="Refresh verification code"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border">
            <div className="font-mono text-lg font-bold tracking-wider text-center select-none">
              {captchaText.split('').map((char, index) => (
                <span
                  key={`${captchaText}-${index}`}
                  className="inline-block mx-0.5"
                  style={charStyles[index]}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <input
            type="text"
            value={userInput}
            onChange={handleInputChange}
            placeholder="Enter code"
            className={`w-full px-3 py-2 border rounded-md text-sm ${
              isVerified
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {userInput && !isVerified && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Code doesn&apos;t match. Please try again.
        </p>
      )}

      {isVerified && (
        <p className="text-sm text-green-600 dark:text-green-400">
          ✓ Verification successful
        </p>
      )}
    </div>
  );
}
