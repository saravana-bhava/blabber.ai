'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BlabberWordmark } from '@/components/brand/blabber-wordmark';
import { displayFont } from './_atoms';

export function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [social, setSocial] = useState('');
  const [sent, setSent] = useState(false);
  const ok = email.includes('@') && email.length > 4;

  const inputCls = 'w-full h-12 px-4 rounded-xl border border-border bg-secondary text-foreground outline-none text-[15px]';

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center p-5 sm:p-[22px] bg-[rgba(8,4,14,0.66)] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
    >
      <div
        className="w-full max-w-[460px] bg-card border border-border rounded-[18px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative px-6 sm:px-[26px] pt-6 sm:pt-[26px] pb-4 sm:pb-[18px] overflow-hidden">
          <div className="absolute inset-0 [background:var(--brand-grad)] opacity-14" />
          <div className="relative">
            <BlabberWordmark size="md" />
            <div id="waitlist-title" className="mt-4" style={{ ...displayFont, fontSize: 24 }}>
              {sent ? "You're on the list! 🎉" : 'Join the beta waitlist'}
            </div>
            <p className="text-muted-foreground text-sm mt-1.5 leading-normal">
              {sent
                ? "We're onboarding creators in waves — we'll email you when your spot opens up."
                : "Drop your email and socials. We're onboarding creators in waves."}
            </p>
          </div>
        </div>

        {sent ? (
          <div className="px-6 sm:px-[26px] pb-6 sm:pb-[26px] pt-2">
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 w-full h-[50px] rounded-full text-[15px] font-semibold text-white no-underline [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)]"
            >
              Preview the live platform <ChevronRight size={16} />
            </Link>
            <button type="button" onClick={onClose} className="w-full h-11 mt-2.5 rounded-full border border-border bg-secondary text-foreground font-semibold cursor-pointer">
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 sm:px-[26px] pb-6 sm:pb-[26px] pt-5 flex flex-col gap-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={inputCls} />
            <input value={social} onChange={e => setSocial(e.target.value)} placeholder="Instagram / X / TikTok handle (optional)" className={inputCls} />
            <button
              type="button"
              onClick={() => ok && setSent(true)}
              disabled={!ok}
              className="land-btn-beta h-[50px] text-[15px] mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              JOIN BETA WAITLIST
            </button>
            <p className="text-xs text-muted-foreground text-center leading-normal">
              By joining you confirm you&apos;re 18+ and agree to our Terms &amp; Privacy Policy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
