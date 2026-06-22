"use client";

import { Button } from "@/components/ui/button";
import { useBetaWaitlistDialog } from "@/lib/contexts/beta-waitlist-dialog-context";

export function BetaWaitlistSection() {
  const waitlistDialog = useBetaWaitlistDialog();

  return (
    <section
      id="beta-waitlist"
      className="max-w-[1200px] mx-auto px-6 py-20 md:py-28 scroll-mt-28"
    >
      <div className="max-w-xl mx-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-8 md:p-10 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Join the beta waitlist</h2>
        <p className="text-muted-foreground mb-6">
          Drop your email and socials—we&apos;re onboarding creators in waves and
          will be in touch when your spot opens up.
        </p>
        <Button
          type="button"
          onClick={() => waitlistDialog?.open()}
          className="bg-pink-500 hover:bg-pink-600 text-white"
        >
          JOIN BETA WAITLIST
        </Button>
      </div>
    </section>
  );
}
