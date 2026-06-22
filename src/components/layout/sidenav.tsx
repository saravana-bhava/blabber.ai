'use client';

import Link from "next/link";
import Image from "next/image";
import { RemoteImage } from '@/components/ui/remote-image';
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Home, MessageSquare, Bell, Bookmark, Star, User as UserIcon, LogOut, Loader2,
  PlusCircle, DollarSign, UserPlus,
  Coins, Search, Shield, UserCog, BookOpen, Sparkles, Briefcase, Building2, Gift, Link2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn, randomUUID } from "@/lib/utils";
import { AccountMenu } from "@/components/layout/account-menu";
import { useUser } from "@/lib/contexts/user-context";
import { toast } from "sonner";
import { GoLiveModal } from "@/components/live/GoLiveModal";
import { createClient } from "@/lib/supabase/client";
import { InviteFriendsModal } from "@/components/referral/invite-friends-modal";
const BuyCreditsModal = dynamic(
  () =>
    import("@/components/credits/BuyCreditsModal").then((m) => ({
      default: m.BuyCreditsModal,
    })),
  { ssr: false }
);
import { useCreditsModal } from "@/lib/contexts/credits-modal-context";
import { PulseGlow } from "@/components/motion/PulseGlow";
import { AnimatedInteger } from "@/components/motion/AnimatedInteger";
import { usePulseUI } from "@/lib/contexts/pulse-ui-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

interface SideNavProps {
  isInDrawer?: boolean;
  onLinkClick?: () => void;
  isStandalone?: boolean;
  isIOS?: boolean;
}

const WHALE_CREDITS_THRESHOLD = 10_000;

function SectionDivider({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 px-3 pt-4 pb-1.5">
      <span
        className="text-[10.5px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full shrink-0"
        style={
          label === "Creator"
            ? { background: "var(--brand-grad-soft)", color: "var(--brand-pink)" }
            : { background: "var(--brand-surface)", color: "var(--muted-foreground)" }
        }
      >
        {label}
      </span>
      <span className="flex-1 h-px bg-border" />
    </li>
  );
}

export function SideNav({
  isInDrawer = false,
  onLinkClick,
  isStandalone = false,
  isIOS = false,
}: SideNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { profile, isLoading, hasUnreadMessages, refreshProfile, isAgency, agency, creator, isAffiliate } =
    useUser();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const supabase = createClient();
  const { isBuyCreditsModalOpen, setIsBuyCreditsModalOpen } = useCreditsModal();
  const { pulseEnabled, setMode, isEarningLive } = usePulseUI();
  const [creditBump, setCreditBump] = useState(false);
  const [creditEarnFloat, setCreditEarnFloat] = useState<{ amount: number; key: number } | null>(
    null
  );
  const prevCreditsRef = useRef(profile?.credits ?? 0);
  const creditsInitialSyncRef = useRef(false);
  const creditEarnClearRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) {
      creditsInitialSyncRef.current = false;
      return;
    }
    const c = profile.credits ?? 0;
    if (!creditsInitialSyncRef.current) {
      creditsInitialSyncRef.current = true;
      prevCreditsRef.current = c;
      return;
    }
    if (c > prevCreditsRef.current) {
      const delta = c - prevCreditsRef.current;
      setCreditBump(true);
      window.setTimeout(() => setCreditBump(false), 650);
      if (creditEarnClearRef.current) {
        clearTimeout(creditEarnClearRef.current);
        creditEarnClearRef.current = null;
      }
      setCreditEarnFloat({ amount: delta, key: Date.now() });
      creditEarnClearRef.current = window.setTimeout(() => {
        setCreditEarnFloat(null);
        creditEarnClearRef.current = null;
      }, 1200);
    }
    prevCreditsRef.current = c;
  }, [profile?.credits, profile]);

  useEffect(() => {
    return () => {
      if (creditEarnClearRef.current) clearTimeout(creditEarnClearRef.current);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkCreatorStatus = async () => {
      if (!profile?.id) return;
      const { data: creatorData, error } = await supabase
        .from("creators")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!error && creatorData) {
        setIsCreator(true);
        setIsOnboardingComplete(creatorData.veriff_verification_status === "completed");
      }
    };
    checkCreatorStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      router.push('/');
    } catch {
      toast.error("Failed to sign out");
      setIsSigningOut(false);
    }
  };

  if (!mounted || isLoading || !profile) return null;

  const profileLoaded = !isLoading && !!profile;

  const generalNavItems: NavItem[] = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "/messages", icon: MessageSquare, label: "Messages" },
    { href: "/notifications", icon: Bell, label: "Notifications" },
    { href: "/marketplace", icon: DollarSign, label: "Marketplace" },
    { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
    { href: "/subscriptions", icon: Star, label: "Subscriptions" },
    {
      href: profile.username ? `/u/${profile.username}` : "/home",
      icon: UserIcon,
      label: "My Profile",
    },
  ];

  const creatorNavItems: NavItem[] = [];
  if (!isCreator || !isOnboardingComplete) {
    creatorNavItems.push({ href: "/become-a-creator", icon: UserPlus, label: "Become a Creator" });
  } else {
    creatorNavItems.push({ href: "/creator-dashboard", icon: UserPlus, label: "Creator Dashboard" });
    if (creator?.can_img_gen) {
      creatorNavItems.push({ href: "/creator-image-gen", icon: Sparkles, label: "AI Image Studio" });
    }
    creatorNavItems.push({ href: "/creator-settings", icon: UserCog, label: "Creator Settings" });
    creatorNavItems.push({ href: "/creator-how-to", icon: BookOpen, label: "How to Use Blabber" });
  }

  const agencyVerified = isAgency && agency?.veriff_verification_status === "completed";
  const manageNavItems: NavItem[] = [];
  if (!isAgency || !agencyVerified) {
    manageNavItems.push({ href: "/become-an-agency", icon: Briefcase, label: "Become an Agency" });
  } else {
    manageNavItems.push({ href: "/agency-dashboard", icon: Building2, label: "Agency Dashboard" });
  }
  if (isAffiliate) {
    manageNavItems.push({ href: "/affiliate-dashboard", icon: Link2, label: "Affiliate Dashboard" });
  } else {
    manageNavItems.push({ href: "/become-an-affiliate", icon: Link2, label: "Become an Affiliate" });
  }
  if (profile.isAdmin) {
    manageNavItems.push({ href: "/admin-dashboard", icon: Shield, label: "Admin Console" });
  }

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href;
    return (
      <li key={item.label}>
        <Link
          href={item.href}
          onClick={onLinkClick}
          data-creator-tour={item.label === "Marketplace" ? "marketplace-nav" : undefined}
          className={cn(
            "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
            isActive
              ? "font-semibold text-foreground"
              : "font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
          style={isActive ? { background: "var(--brand-surface)" } : undefined}
        >
          {isActive && (
            <span
              aria-hidden
              className="absolute"
              style={{
                left: -10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 4,
                height: 22,
                borderRadius: 99,
                background: "var(--brand-grad)",
              }}
            />
          )}
          <span className="relative flex items-center justify-center h-5 w-5 shrink-0">
            <item.icon className="h-5 w-5" />
            {item.label === "Messages" && hasUnreadMessages && (
              <span
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-background animate-pulse"
                style={{ background: "var(--brand-pink)" }}
              />
            )}
          </span>
          <span className="flex-1">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "app-nav flex min-h-0 flex-col bg-background border-r border-border",
          !isInDrawer &&
            "sticky top-[var(--operated-banner-offset,0px)] hidden h-[calc(100dvh-var(--operated-banner-offset,0px))] w-[264px] md:flex shrink-0",
          isInDrawer && "h-full w-full"
        )}
      >
        {/* Wordmark */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <Link href="/home" className="inline-flex" onClick={onLinkClick}>
            <Image
              src="/logo.png"
              alt="Blabber"
              width={130}
              height={30}
              className="w-[130px] h-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* User card (dropdown trigger) */}
        <div className="px-3 shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip open={isEarningLive ? undefined : false}>
              <AccountMenu
                profile={profile}
                isCreator={isCreator}
                isInDrawer={isInDrawer}
                onLinkClick={onLinkClick}
                trigger={
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={isEarningLive ? "Account menu — earning live" : "Account menu"}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition-colors hover:bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        isEarningLive &&
                          "motion-safe:animate-[earning-live-avatar-glow_2.2s_ease-in-out_infinite]"
                      )}
                    >
                      <div
                        className="relative h-10 w-10 shrink-0 rounded-full"
                        data-pulse-earning-target={profile.id}
                      >
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
                          {profile.avatar_url ? (
                            <RemoteImage
                              src={profile.avatar_url}
                              alt={profile.full_name || "User Avatar"}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                              priority
                            />
                          ) : (
                            (profile.full_name || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        {isEarningLive && (
                          <span
                            className="pointer-events-none absolute -bottom-1 -right-1 z-[1] select-none text-sm leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
                            aria-hidden
                          >
                            🔥
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {profile.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{profile.username}
                        </p>
                      </div>
                    </button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent side="right" sideOffset={10} className="text-xs font-medium">
                Earning live
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Credits chip */}
        <div className="px-3 mt-2 mb-1 shrink-0 relative">
          <PulseGlow className="w-full" active={pulseEnabled && creditBump}>
            <button
              data-pulse-credit-badge
              data-creator-tour="credits-badge"
              onClick={() => setIsBuyCreditsModalOpen(true)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-[14px] border border-border/70 transition-colors hover:border-border",
                pulseEnabled &&
                  creditBump &&
                  "motion-safe:animate-[credit-badge-ring_600ms_ease-out_1]"
              )}
              style={{ background: "var(--brand-grad-soft)" }}
            >
              <span
                className="flex items-center justify-center w-7 h-7 rounded-[8px] text-white shrink-0"
                style={{ background: "var(--brand-grad)" }}
              >
                <Coins className="h-[15px] w-[15px]" />
              </span>
              <div className="flex-1 min-w-0 text-left leading-tight">
                <div
                  className={cn(
                    "text-[17px] font-extrabold tabular-nums",
                    !pulseEnabled &&
                      (profile.credits ?? 0) >= WHALE_CREDITS_THRESHOLD &&
                      "text-amber-400"
                  )}
                >
                  <AnimatedInteger value={profile.credits ?? 0} />
                </div>
                <div className="text-[11px] font-semibold text-muted-foreground">credits</div>
              </div>
              <span className="text-[11.5px] font-semibold px-3 py-1 rounded-full bg-foreground text-background shrink-0">
                Top up
              </span>
            </button>
          </PulseGlow>

          {creditEarnFloat ? (
            <span
              className="pointer-events-none absolute left-1/2 top-full z-20 mt-0.5 -translate-x-1/2 motion-reduce:hidden"
              aria-live="polite"
            >
              <span
                key={creditEarnFloat.key}
                className="block whitespace-nowrap text-[11px] font-semibold tabular-nums tracking-tight text-emerald-600 drop-shadow-sm dark:text-emerald-400 motion-safe:animate-[credit-earn-rise_1.1s_ease-out_forwards]"
              >
                +{creditEarnFloat.amount} credits
              </span>
            </span>
          ) : null}
        </div>

        {/* Nav */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1">
          <ul className="space-y-0.5">
            {generalNavItems.map(renderNavItem)}

            <SectionDivider label="Creator" />
            {creatorNavItems.map(renderNavItem)}

            <SectionDivider label="Manage" />
            {manageNavItems.map(renderNavItem)}
          </ul>
        </nav>

        {/* Invite Friends */}
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-muted/60"
            style={{ color: 'var(--brand-pink)' }}
          >
            <span
              className="flex items-center justify-center w-5 h-5 shrink-0"
            >
              <Gift className="h-5 w-5" />
            </span>
            <span className="flex-1 text-left">Invite Friends</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
              style={{ background: 'var(--brand-grad)' }}
            >
              +credits
            </span>
          </button>
        </div>

        {/* Bottom: New post + logout */}
        <div
          className={cn(
            "shrink-0 flex gap-2 px-3 pt-3 border-t border-border/60 bg-background",
            isStandalone && isIOS
              ? "pb-12"
              : "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
          )}
        >
          <Link
            href="/new-post"
            onClick={onLinkClick}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-sm font-semibold text-white transition-[filter] hover:brightness-110 active:scale-[0.97]",
              pulseEnabled && "pulse-money-btn"
            )}
            style={{
              background: "var(--brand-grad)",
              boxShadow: "var(--brand-ring-money)",
            }}
          >
            <PlusCircle className="h-4 w-4" />
            New post
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                title="Log out"
                disabled={isSigningOut}
                className="flex items-center justify-center w-11 h-11 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors bg-background shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningOut ? (
                  <Loader2 className="h-[17px] w-[17px] animate-spin" />
                ) : (
                  <LogOut className="h-[17px] w-[17px]" />
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;ll need to sign in again to access your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSignOut}
                  className="text-white"
                  style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
                >
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      <InviteFriendsModal open={showInviteModal} onOpenChange={setShowInviteModal} />
      <GoLiveModal isOpen={showGoLiveModal} onClose={() => setShowGoLiveModal(false)} />
      <BuyCreditsModal
        isOpen={isBuyCreditsModalOpen}
        onClose={() => setIsBuyCreditsModalOpen(false)}
        onPaymentSuccess={() => {
          void refreshProfile();
        }}
      />
    </>
  );
}
