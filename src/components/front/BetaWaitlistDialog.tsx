"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Instagram } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useBetaWaitlistDialog } from "@/lib/contexts/beta-waitlist-dialog-context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHandle(value: string): string | null {
  const trimmed = value.trim().replace(/^@+/, "");
  return trimmed.length === 0 ? null : trimmed;
}

export function BetaWaitlistDialog() {
  const ctx = useBetaWaitlistDialog();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [otherSocials, setOtherSocials] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!ctx) return null;

  const reset = () => {
    setEmail("");
    setInstagram("");
    setOtherSocials("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      toast.error("Enter a valid email");
      return;
    }

    setIsSubmitting(true);
    try {
      const igHandle = normalizeHandle(instagram);
      const otherTrimmed = otherSocials.trim();

      const { error } = await supabase.from("beta_signup_emails").insert({
        email: trimmedEmail,
        instagram_handle: igHandle,
        other_socials: otherTrimmed.length > 0 ? otherTrimmed : null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.success("You're already on the waitlist — we'll be in touch.");
          reset();
          ctx.close();
          return;
        }
        console.error("beta_signup_emails insert:", error);
        toast.error("Something went wrong. Please try again.");
        return;
      }

      toast.success("You're on the beta waitlist! We'll email you soon.");
      reset();
      ctx.close();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={ctx.isOpen} onOpenChange={ctx.setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join the beta waitlist</DialogTitle>
          <DialogDescription>
            Tell us where to reach you and where to find you. We&apos;re onboarding
            creators in waves and will be in touch when your spot opens up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="beta-waitlist-email">Email</Label>
            <Input
              id="beta-waitlist-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beta-waitlist-instagram">
              Instagram handle <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                id="beta-waitlist-instagram"
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="yourhandle"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                disabled={isSubmitting}
                maxLength={64}
                className="pl-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beta-waitlist-other">
              Other socials <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="beta-waitlist-other"
              placeholder="TikTok: @you · X: @you · YouTube: /@you"
              value={otherSocials}
              onChange={(e) => setOtherSocials(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-pink-500 text-white hover:bg-pink-600"
            >
              {isSubmitting ? "Sending…" : "Join waitlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
