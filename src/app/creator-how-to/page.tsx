'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Crown,
  HelpCircle,
  Play,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';

import { PageShell } from '@/components/layout/page-header';
import { RequireAuth } from '@/components/auth/require-auth';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
} from '@/components/admin/admin-ui';

const faqs = [
  {
    q: 'How do I set up my creator profile?',
    a: 'Go to Creator Settings from the sidebar. Complete your profile, set your subscription price, and add payout details. Once identity verification is complete, you can start posting and monetizing.',
  },
  {
    q: 'How do fans interact and pay me?',
    a: 'Fans can subscribe to you for recurring access, tip on posts, unlock PPV (pay-per-view) content, and buy products from your store. All payments go through Blabber; you receive your share according to the platform split.',
  },
  {
    q: 'When and how do I get paid?',
    a: 'Earnings from subscriptions, tips, PPV, and products accumulate in your creator balance. You can request a payout from the Creator Dashboard when you meet the minimum threshold. Payouts are sent to the method you set in Creator Settings.',
  },
  {
    q: 'What should I expect as a new creator?',
    a: 'Start by posting regularly and engaging with your audience. Enable subscriptions and set a price that feels right. Use PPV for exclusive content and tips to let fans show support. You can adjust prices and offerings anytime in Creator Settings.',
  },
];

const quickStartTips = [
  'Complete identity verification in Become a Creator so you can monetize.',
  'Set a subscription price and interval in Creator Settings.',
  'Post a mix of free and PPV content to attract and convert fans.',
  'Add products in Creator Settings to sell directly from your profile.',
  'Check Analytics in Creator Dashboard to see what’s working.',
];

function CreatorFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-[border-color] duration-200 bg-secondary/30"
      style={{ border: `1px solid ${open ? 'var(--brand-violet)' : 'var(--border)'}` }}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={open}
    >
      <div className="flex items-center gap-3.5 px-5 py-4">
        <span className="flex-1 font-semibold text-[15px] leading-snug">{q}</span>
        <span
          className="grid place-items-center w-8 h-8 rounded-full shrink-0 transition-[transform,background] duration-200"
          style={{
            background: open ? 'var(--brand-grad)' : 'var(--secondary)',
            color: open ? 'var(--brand-on-accent)' : 'var(--muted-foreground)',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
        </span>
      </div>
      {open && (
        <div className="px-5 pb-5 text-[13.5px] text-muted-foreground leading-[1.65] max-w-[720px]">
          {a}
        </div>
      )}
    </div>
  );
}

export default function CreatorHowToPage() {
  return (
    <RequireAuth>
      <PageShell
        title="Creator guide"
        subtitle="Set up, monetize, and grow on Blabber"
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            <Crown className="h-3.5 w-3.5" />
            Creator
          </AdminPill>
        }
      >
        <div className="max-w-[820px] mx-auto px-5 md:px-6 py-5 pb-16 space-y-6">
          <AdminCard
            className="relative overflow-hidden"
            padding="lg"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{ background: 'var(--brand-grad-soft)' }}
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <AdminPill variant="staff">
                  <Sparkles className="h-3.5 w-3.5" />
                  Getting started
                </AdminPill>
              </div>
              <h2 className="font-display text-[clamp(22px,3vw,30px)] tracking-tight mb-2">
                Everything you need as a creator
              </h2>
              <p className="text-muted-foreground text-[13.5px] leading-relaxed max-w-[640px]">
                Set up your profile, understand how fans interact, how money flows, and what to
                expect on Blabber.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <AdminGradButton asChild className="h-10">
                  <Link href="/creator-settings">
                    <Settings className="h-4 w-4" />
                    Creator settings
                  </Link>
                </AdminGradButton>
                <AdminGhostButton asChild className="h-10">
                  <Link href="/creator-dashboard">
                    <BarChart3 className="h-4 w-4" />
                    Creator dashboard
                  </Link>
                </AdminGhostButton>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Welcome to Blabber"
              description="A creator-side overview: profile setup, fan interactions, payouts, and what to expect."
            />
            <div
              className="aspect-video w-full rounded-2xl flex flex-col items-center justify-center gap-3 border border-dashed border-border overflow-hidden"
              style={{ background: 'var(--brand-grad-soft)' }}
              aria-label="Video placeholder"
            >
              <span
                className="grid place-items-center w-16 h-16 rounded-2xl text-[var(--brand-on-accent)]"
                style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
              >
                <Play className="h-7 w-7 ml-0.5" fill="currentColor" />
              </span>
              <p className="text-sm font-semibold">Video coming soon</p>
              <p className="text-[12.5px] text-muted-foreground px-6 text-center max-w-md">
                The welcome explainer will be embedded here. We recommend watching before you get
                started.
              </p>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Quick-start checklist"
              description="Five steps to get monetizing faster."
            />
            <ol className="space-y-3">
              {quickStartTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <span
                    className="grid place-items-center w-8 h-8 rounded-full shrink-0 text-[12px] font-bold text-[var(--brand-on-accent)] tabular-nums"
                    style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed pt-1">{tip}</span>
                </li>
              ))}
            </ol>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="FAQ"
              description="Common questions about being a creator on Blabber."
            />
            <div className="space-y-2.5">
              {faqs.map((faq, i) => (
                <CreatorFaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </AdminCard>

          <AdminCard padding="lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <HelpCircle className="h-4 w-4 text-[var(--brand-pink)]" />
                  <p className="font-bold text-[15px]">Need more help?</p>
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  Report a bug or reach out from the Help Center if something isn&apos;t working.
                </p>
              </div>
              <AdminGhostButton asChild className="h-10 shrink-0">
                <Link href="/help-center">Help center</Link>
              </AdminGhostButton>
            </div>
          </AdminCard>
        </div>
      </PageShell>
    </RequireAuth>
  );
}
