'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Send, CheckCircle, ShieldAlert } from 'lucide-react';
import {
  LandingDocPage,
  LandingDocHeader,
  LandingDocBody,
  LandingDocPanel,
  LandingDocSuccess,
} from '@/components/landing/LandingDocPage';
import { AdminGradButton } from '@/components/admin/admin-ui';
import { adminInputClass, adminTextareaClass } from '@/components/admin/admin-ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function ContentRemovalPage() {
  const [isCopyrightPrivacy, setIsCopyrightPrivacy] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contentUrls: '',
    agreedToDistribution: false,
    additionalInfo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.contentUrls.trim() ||
      !formData.additionalInfo.trim()
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/content-removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          contentUrls: formData.contentUrls.trim(),
          agreedToDistribution: formData.agreedToDistribution,
          additionalInfo: formData.additionalInfo.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit request');
      }

      toast.success('Content removal request submitted successfully!');
      setIsSubmitted(true);

      setFormData({
        name: '',
        email: '',
        contentUrls: '',
        agreedToDistribution: false,
        additionalInfo: '',
      });
      setIsCopyrightPrivacy(null);
    } catch (error) {
      console.error('Error submitting content removal request:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <LandingDocSuccess
        icon={CheckCircle}
        title="Request submitted"
        description="Thank you for your submission. We will review and resolve all reported complaints within five (5) business days."
        action={
          <AdminGradButton onClick={() => setIsSubmitted(false)} className="min-w-[220px]">
            Submit another request
          </AdminGradButton>
        }
      />
    );
  }

  return (
    <LandingDocPage>
      <LandingDocHeader
        eyebrow="Support"
        title="Content Removal Request"
        description="Report content that violates our policies. We review all submissions within five business days."
      />

      <LandingDocBody className="mb-6">
        <div className="landing-doc-sections">
          <section>
            <p>
              If you have an issue with content on this website, please submit your issue via the
              form below using the following guidelines:
            </p>
            <ol>
              <li>
                As much identifying information as possible about the content that you are reporting:
                <ul>
                  <li>Identifying information about the performer and/or user that generated the issue.</li>
                  <li>A description of your issue with the content/performer/user.</li>
                  <li>The date and time you encountered the content on the website.</li>
                </ul>
              </li>
              <li>Any other information which you believe is relevant to your issue with the content on the website.</li>
            </ol>
          </section>
        </div>
      </LandingDocBody>

      <LandingDocPanel className="brand-form">
        <div className="flex items-start gap-3.5 mb-6">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--brand-on-accent)]"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight">
              Is this issue related to a copyright or a privacy concern?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose an option below to continue.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 rounded-[14px] border border-border/70 px-4 py-3 cursor-pointer transition-colors hover:border-[var(--brand-pink)] hover:bg-[var(--brand-grad-soft)]">
            <input
              type="radio"
              name="copyright-privacy"
              checked={isCopyrightPrivacy === true}
              onChange={() => setIsCopyrightPrivacy(true)}
              className="h-4 w-4 accent-[var(--brand-pink)]"
            />
            <span className="text-sm font-semibold">Yes</span>
          </label>
          <label className="flex items-center gap-3 rounded-[14px] border border-border/70 px-4 py-3 cursor-pointer transition-colors hover:border-[var(--brand-pink)] hover:bg-[var(--brand-grad-soft)]">
            <input
              type="radio"
              name="copyright-privacy"
              checked={isCopyrightPrivacy === false}
              onChange={() => setIsCopyrightPrivacy(false)}
              className="h-4 w-4 accent-[var(--brand-pink)]"
            />
            <span className="text-sm font-semibold">No</span>
          </label>
        </div>

        {isCopyrightPrivacy === true && (
          <div
            className="mt-6 rounded-[14px] border border-border/60 px-4 py-3 text-sm text-muted-foreground"
            style={{ background: 'var(--brand-grad-soft)' }}
          >
            For copyright or privacy concerns please refer to our{' '}
            <Link href="/privacy-policy" className="text-[var(--brand-pink)] font-semibold underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </div>
        )}

        {isCopyrightPrivacy === false && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Your full name"
                className={adminInputClass}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="your.email@example.com"
                className={adminInputClass}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contentUrls">URL/Links of content you are reporting *</Label>
              <Textarea
                id="contentUrls"
                value={formData.contentUrls}
                onChange={(e) => handleInputChange('contentUrls', e.target.value)}
                placeholder="Paste the URLs or links to the content you are reporting..."
                rows={4}
                className={adminTextareaClass}
                required
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.agreedToDistribution}
                onChange={(e) => handleInputChange('agreedToDistribution', e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-[var(--brand-pink)]"
              />
              <span className="text-sm leading-snug">
                Have you ever agreed to the distribution of this content? *
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="additionalInfo">
                Provide any additional information that will help us understand the issue you are reporting *
              </Label>
              <Textarea
                id="additionalInfo"
                value={formData.additionalInfo}
                onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                placeholder="Please provide any additional details about the issue..."
                rows={6}
                className={adminTextareaClass}
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <AdminGradButton
                type="submit"
                disabled={isSubmitting}
                className={cn('w-full sm:w-auto min-w-[200px]', isSubmitting && 'opacity-70')}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Submit request
                  </span>
                )}
              </AdminGradButton>
            </div>
          </form>
        )}
      </LandingDocPanel>
    </LandingDocPage>
  );
}
