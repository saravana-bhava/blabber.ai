"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { WaitlistModal } from "@/components/landing/WaitlistModal";
import { InView } from "@/components/landing/InView";
import { Eyebrow, displayFont, Btn } from "@/components/landing/_atoms";
import { PRICING_ROWS } from "@/components/landing/_data";
import { createClient } from "@/lib/supabase/client";
import { useBetaMode } from "@/lib/contexts/beta-mode-context";

interface CreditPackage {
  amount: number;
  price_cents: number;
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PricingPage() {
  const isBeta = useBetaMode();
  const [waitlist, setWaitlist] = useState(false);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [pricePerCredit, setPricePerCredit] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data: packagesData, error: packagesError } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "credit_packages")
        .single();

      const { data: priceData, error: priceError } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "price_per_credit")
        .single();

      if (packagesError || priceError || !priceData?.value) {
        setLoadState("error");
        return;
      }

      try {
        const parsed = packagesData?.value
          ? (JSON.parse(packagesData.value as string) as CreditPackage[])
          : [];
        setCreditPackages(Array.isArray(parsed) ? parsed : []);
        setPricePerCredit(parseInt(String(priceData.value), 10));
        setLoadState("ok");
      } catch {
        setLoadState("error");
      }
    })();
  }, []);

  const sortedPackages = useMemo(
    () => [...creditPackages].sort((a, b) => a.amount - b.amount),
    [creditPackages]
  );

  function listPriceCents(pkg: CreditPackage) {
    if (pricePerCredit == null || pricePerCredit <= 0) return null;
    return pkg.amount * pricePerCredit;
  }

  function savingsLabel(pkg: CreditPackage) {
    const list = listPriceCents(pkg);
    if (list == null || list <= 0 || pkg.price_cents >= list) return null;
    const pct = Math.round((1 - pkg.price_cents / list) * 100);
    if (pct <= 0) return null;
    return `Save ${pct}% vs. list`;
  }

  const perCreditDisplay =
    pricePerCredit != null && pricePerCredit > 0
      ? formatUsd(pricePerCredit)
      : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingHeader onWaitlist={() => isBeta && setWaitlist(true)} />

      <main className="max-w-[1140px] mx-auto px-4 sm:px-[34px] pt-28 pb-14 sm:pt-32 sm:pb-[84px]">
        <InView className="text-center mb-10 sm:mb-14">
          <Eyebrow color="var(--brand-pink)">Pricing</Eyebrow>
          <h1
            style={{
              ...displayFont,
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: "-0.03em",
            }}
          >
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-base sm:text-[17px] mt-3.5 max-w-2xl mx-auto">
            Industry-low creator fees and credit bundles that power AI features in the app.
            Rates update automatically when platform settings change.
          </p>
        </InView>

        <InView delay={60} className="mb-12 sm:mb-16">
          <div className="max-w-[720px] mx-auto">
            <h2
              className="text-center mb-6"
              style={{ ...displayFont, fontSize: "clamp(22px, 3.5vw, 30px)" }}
            >
              Creator revenue
            </h2>
            <div className="border border-border rounded-[22px] overflow-hidden bg-card">
              <div className="hidden sm:flex px-6 py-4 bg-secondary border-b border-border text-[12.5px] font-bold tracking-[.04em] uppercase text-muted-foreground">
                <span className="flex-1">Revenue type</span>
                <span className="w-[130px] text-right">You keep</span>
                <span className="w-[180px] text-right">Detail</span>
              </div>
              {PRICING_ROWS.map(([label, keep, detail]) => (
                <div
                  key={label}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 px-4 sm:px-6 py-4 border-b border-border last:border-b-0"
                >
                  <span className="flex-1 font-semibold text-[15px]">{label}</span>
                  <span className="font-display text-xl sm:text-[22px] text-[var(--brand-pink)] sm:w-[130px] sm:text-right">
                    {keep}
                  </span>
                  <span className="text-[13px] text-muted-foreground sm:w-[180px] sm:text-right">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              No monthly fees. No setup costs. You only pay when you earn.
            </p>
          </div>
        </InView>

        <InView delay={100}>
          <div className="max-w-[900px] mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--brand-on-accent)]"
                style={{
                  background: "var(--brand-grad)",
                  boxShadow: "var(--brand-ring-money)",
                }}
              >
                <Coins className="h-5 w-5" aria-hidden />
              </span>
              <h2 style={{ ...displayFont, fontSize: "clamp(22px, 3.5vw, 30px)" }}>
                Fan credits
              </h2>
            </div>
            <p className="text-center text-muted-foreground text-sm sm:text-[15px] max-w-xl mx-auto mb-8">
              Credits power AI messages, voice calls, and image generation. Bundles below
              match checkout in the app.
            </p>

            {loadState === "loading" && (
              <div className="space-y-4" aria-busy="true">
                <div className="h-24 rounded-[22px] border border-border bg-secondary animate-pulse" />
                <div className="grid gap-4 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-36 rounded-[22px] border border-border bg-secondary animate-pulse"
                    />
                  ))}
                </div>
              </div>
            )}

            {loadState === "error" && (
              <p className="text-center text-muted-foreground">
                We couldn&apos;t load credit pricing right now. Please try again later, or sign
                in and open &quot;Buy credits&quot; in the app.
              </p>
            )}

            {loadState === "ok" && (
              <>
                {perCreditDisplay && (
                  <section
                    className="mb-8 rounded-[22px] border border-border px-6 py-5"
                    style={{ background: "var(--brand-grad-soft)" }}
                  >
                    <h3 className="text-[12.5px] font-bold uppercase tracking-[.04em] text-muted-foreground mb-1">
                      List rate
                    </h3>
                    <p className="font-display text-2xl sm:text-3xl font-extrabold tabular-nums">
                      {perCreditDisplay}{" "}
                      <span className="text-base font-semibold text-muted-foreground">
                        per credit
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Custom purchase amounts are billed at this rate (minimum 5 credits in the
                      app).
                    </p>
                  </section>
                )}

                {sortedPackages.length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[.04em] text-muted-foreground mb-4 text-center">
                      Bundles
                    </h3>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {sortedPackages.map((pkg) => {
                        const list = listPriceCents(pkg);
                        const savings = savingsLabel(pkg);
                        return (
                          <li
                            key={pkg.amount}
                            className="rounded-[22px] border border-border p-5 flex flex-col gap-2 bg-card transition-colors hover:border-[var(--brand-pink)]/40"
                          >
                            <div className="text-lg font-semibold">{pkg.amount} credits</div>
                            <div className="font-display text-2xl font-extrabold text-[var(--brand-pink)] tabular-nums">
                              {formatUsd(pkg.price_cents)}
                            </div>
                            {list != null && pkg.price_cents < list && (
                              <div className="text-sm text-muted-foreground line-through">
                                {formatUsd(list)} at list
                              </div>
                            )}
                            {savings && (
                              <span className="text-xs font-semibold text-[var(--brand-violet)]">
                                {savings}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {!isBeta && (
                    <Btn href="/signup" size="lg">
                      Get started
                    </Btn>
                  )}
                  <Link
                    href="/"
                    className="text-sm font-semibold text-muted-foreground hover:text-[var(--brand-pink)] transition-colors"
                  >
                    ← Back to home
                  </Link>
                </div>
              </>
            )}
          </div>
        </InView>
      </main>

      <LandingFooter />
      {isBeta && waitlist && <WaitlistModal onClose={() => setWaitlist(false)} />}
    </div>
  );
}
