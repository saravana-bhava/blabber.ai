'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, LifeBuoy, Loader2, Send, Sparkles } from 'lucide-react';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
  AdminLoadingSpinner,
  adminInputClass,
  adminTextareaClass,
  adminSelectTriggerClass,
} from '@/components/admin/admin-ui';

const initialFormData = {
  title: '',
  description: '',
  category: '',
  severity: '',
  steps_to_reproduce: '',
  expected_behavior: '',
  actual_behavior: '',
  browser: '',
  device: '',
  additional_info: '',
};

const bugReportTips = [
  'Be specific and detailed in your description',
  'Include steps to reproduce the issue',
  'Mention your browser and device information',
  'Provide screenshots if possible',
  'Check if the issue has already been reported',
];

export default function HelpCenterPage() {
  const supabase = createClient();
  const { session, isLoading } = useUser();

  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user) {
      toast.error('You must be logged in to submit a bug report');
      return;
    }

    if (!formData.title.trim() || !formData.description.trim() || !formData.category || !formData.severity) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('bug_reports').insert({
        user_id: session.user.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        severity: formData.severity,
        steps_to_reproduce: formData.steps_to_reproduce.trim() || null,
        expected_behavior: formData.expected_behavior.trim() || null,
        actual_behavior: formData.actual_behavior.trim() || null,
        browser: formData.browser.trim() || null,
        device: formData.device.trim() || null,
        additional_info: formData.additional_info.trim() || null,
        status: 'open',
      });

      if (error) {
        console.error('Error submitting bug report:', error);
        toast.error('Failed to submit bug report. Please try again.');
        return;
      }

      toast.success('Bug report submitted successfully!');
      setIsSubmitted(true);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error submitting bug report:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <RequireAuth>
        <PageShell title="Help center">
          <AdminLoadingSpinner className="min-h-[320px]" />
        </PageShell>
      </RequireAuth>
    );
  }

  if (isSubmitted) {
    return (
      <RequireAuth>
        <PageShell title="Help center" subtitle="Thanks for your feedback">
          <div className="max-w-[560px] mx-auto px-5 md:px-6 py-5 pb-16">
            <AdminCard padding="lg" className="text-center">
              <span
                className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-2xl text-[var(--brand-on-accent)]"
                style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
              >
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h2 className="font-display text-2xl tracking-tight mb-2">Bug report submitted</h2>
              <p className="text-muted-foreground text-[13.5px] leading-relaxed mb-6">
                Thank you for your feedback. Our team will review your report and get back to you
                soon.
              </p>
              <AdminGradButton onClick={() => setIsSubmitted(false)} className="w-full sm:w-auto">
                Submit another report
              </AdminGradButton>
            </AdminCard>
          </div>
        </PageShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <PageShell
        title="Help center"
        subtitle="Report bugs and help us improve Blabber"
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            <LifeBuoy className="h-3.5 w-3.5" />
            Support
          </AdminPill>
        }
      >
        <div className="max-w-[820px] mx-auto px-5 md:px-6 py-5 pb-16 space-y-6">
          <AdminCard className="relative overflow-hidden" padding="lg">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{ background: 'var(--brand-grad-soft)' }}
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <AdminPill variant="staff">
                  <Sparkles className="h-3.5 w-3.5" />
                  We read every report
                </AdminPill>
              </div>
              <h2 className="font-display text-[clamp(22px,3vw,30px)] tracking-tight mb-2">
                Report a bug
              </h2>
              <p className="text-muted-foreground text-[13.5px] leading-relaxed max-w-[640px]">
                Help us improve by reporting any issues you encounter. Please provide as much detail
                as possible — fields marked with * are required.
              </p>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Bug report form"
              description="Describe what went wrong so we can reproduce and fix it."
            />
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold">
                  Bug title *
                </Label>
                <Input
                  id="title"
                  className={adminInputClass}
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold">
                    Category *
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger id="category" className={adminSelectTriggerClass}>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ui_ux">UI/UX Issue</SelectItem>
                      <SelectItem value="functionality">Functionality Bug</SelectItem>
                      <SelectItem value="performance">Performance Issue</SelectItem>
                      <SelectItem value="payment">Payment/Billing</SelectItem>
                      <SelectItem value="media">Media/Upload Issue</SelectItem>
                      <SelectItem value="notifications">Notifications</SelectItem>
                      <SelectItem value="mobile">Mobile App Issue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="severity" className="text-sm font-semibold">
                    Severity *
                  </Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => handleInputChange('severity', value)}
                  >
                    <SelectTrigger id="severity" className={adminSelectTriggerClass}>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low — minor inconvenience</SelectItem>
                      <SelectItem value="medium">Medium — affects functionality</SelectItem>
                      <SelectItem value="high">High — major functionality broken</SelectItem>
                      <SelectItem value="critical">Critical — app unusable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">
                  Detailed description *
                </Label>
                <Textarea
                  id="description"
                  className={adminTextareaClass}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the bug in detail..."
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="steps_to_reproduce" className="text-sm font-semibold">
                  Steps to reproduce
                </Label>
                <Textarea
                  id="steps_to_reproduce"
                  className={adminTextareaClass}
                  value={formData.steps_to_reproduce}
                  onChange={(e) => handleInputChange('steps_to_reproduce', e.target.value)}
                  placeholder={'1. Go to...\n2. Click on...\n3. See error...'}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected_behavior" className="text-sm font-semibold">
                    Expected behavior
                  </Label>
                  <Textarea
                    id="expected_behavior"
                    className={adminTextareaClass}
                    value={formData.expected_behavior}
                    onChange={(e) => handleInputChange('expected_behavior', e.target.value)}
                    placeholder="What should happen?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actual_behavior" className="text-sm font-semibold">
                    Actual behavior
                  </Label>
                  <Textarea
                    id="actual_behavior"
                    className={adminTextareaClass}
                    value={formData.actual_behavior}
                    onChange={(e) => handleInputChange('actual_behavior', e.target.value)}
                    placeholder="What actually happens?"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="browser" className="text-sm font-semibold">
                    Browser / app version
                  </Label>
                  <Input
                    id="browser"
                    className={adminInputClass}
                    value={formData.browser}
                    onChange={(e) => handleInputChange('browser', e.target.value)}
                    placeholder="e.g. Chrome 120, Safari 17"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="device" className="text-sm font-semibold">
                    Device / OS
                  </Label>
                  <Input
                    id="device"
                    className={adminInputClass}
                    value={formData.device}
                    onChange={(e) => handleInputChange('device', e.target.value)}
                    placeholder="e.g. iPhone 15, Windows 11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional_info" className="text-sm font-semibold">
                  Additional information
                </Label>
                <Textarea
                  id="additional_info"
                  className={adminTextareaClass}
                  value={formData.additional_info}
                  onChange={(e) => handleInputChange('additional_info', e.target.value)}
                  placeholder="Screenshots, error messages, or anything else helpful"
                  rows={3}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
                <AdminGhostButton type="button" asChild className="h-10">
                  <Link href="/creator-how-to">Creator guide</Link>
                </AdminGhostButton>
                <AdminGradButton type="submit" disabled={isSubmitting} className="h-10">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit bug report
                    </>
                  )}
                </AdminGradButton>
              </div>
            </form>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Tips for a good report"
              description="The more context you share, the faster we can help."
            />
            <ul className="space-y-2.5">
              {bugReportTips.map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ background: 'var(--brand-pink)' }}
                  />
                  <span className="text-sm leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-muted-foreground mt-4 pt-4 border-t border-border">
              For urgent account issues, contact our support team directly.
            </p>
          </AdminCard>
        </div>
      </PageShell>
    </RequireAuth>
  );
}
